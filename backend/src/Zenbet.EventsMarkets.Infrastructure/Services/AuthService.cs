namespace Zenbet.EventsMarkets.Infrastructure.Services;

using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Zenbet.EventsMarkets.Application.Auth;
using Zenbet.EventsMarkets.Application.Interfaces;
using Zenbet.EventsMarkets.Domain.Aggregates;
using Zenbet.EventsMarkets.Domain.ValueObjects;
using Zenbet.EventsMarkets.Infrastructure.Persistence;
using Zenbet.EventsMarkets.Infrastructure.Security;

/// <summary>
/// Alta y acceso de jugadores. Cada cuenta nace con una billetera en cero; el
/// saldo se acredita mediante el módulo de recarga. La identidad de la billetera
/// siempre proviene del token, nunca del cliente.
/// </summary>
public sealed class AuthService : IAuthService
{
    private static readonly Regex EmailPattern = new(
        @"^[^\s@]+@[^\s@]+\.[^\s@]+$",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    private static readonly Regex UsernamePattern = new(
        @"^[A-Za-z0-9._-]{3,24}$",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    private readonly EventsMarketsDbContext _dbContext;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IAuthTokenService _tokenService;
    private readonly IOptions<AuthOptions> _options;
    private readonly ILogger<AuthService> _logger;

    public AuthService(
        EventsMarketsDbContext dbContext,
        IPasswordHasher passwordHasher,
        IAuthTokenService tokenService,
        IOptions<AuthOptions> options,
        ILogger<AuthService> logger)
    {
        _dbContext = dbContext;
        _passwordHasher = passwordHasher;
        _tokenService = tokenService;
        _options = options;
        _logger = logger;
    }

    public async Task<AuthResult> RegisterAsync(
        AuthRegisterRequest request,
        CancellationToken cancellationToken = default)
    {
        var username = request.Username?.Trim() ?? string.Empty;
        var email = request.Email?.Trim() ?? string.Empty;
        var password = request.Password ?? string.Empty;
        var normalizedUsername = Normalize(username);
        var normalizedEmail = Normalize(email);

        var fieldErrors = new Dictionary<string, string[]>();

        if (!UsernamePattern.IsMatch(username))
        {
            fieldErrors["username"] = new[]
            {
                "Usa entre 3 y 24 caracteres: letras, números, punto, guion o guion bajo.",
            };
        }

        if (email.Length > 320 || !EmailPattern.IsMatch(email))
        {
            fieldErrors["email"] = new[] { "Ingresa un correo electrónico válido." };
        }

        if (password.Length < 4)
        {
            fieldErrors["password"] = new[] { "La contraseña debe tener al menos 4 caracteres." };
        }
        else if (password.Length > 128)
        {
            fieldErrors["password"] = new[] { "La contraseña es demasiado larga." };
        }

        if (!request.TermsAccepted)
        {
            fieldErrors["termsAccepted"] = new[]
            {
                "Debes aceptar los términos y confirmar que eres mayor de 18 años.",
            };
        }

        if (fieldErrors.Count > 0)
        {
            return AuthResult.Failure("Revisa los datos marcados.", fieldErrors);
        }

        var conflicts = await _dbContext.UserAccounts
            .AsNoTracking()
            .Where(account =>
                account.NormalizedUsername == normalizedUsername ||
                account.NormalizedEmail == normalizedEmail)
            .Select(account => new { account.NormalizedUsername, account.NormalizedEmail })
            .ToListAsync(cancellationToken);

        if (conflicts.Any(account => account.NormalizedUsername == normalizedUsername))
        {
            fieldErrors["username"] = new[] { "Ese nombre de usuario ya está en uso." };
        }

        if (conflicts.Any(account => account.NormalizedEmail == normalizedEmail))
        {
            fieldErrors["email"] = new[] { "Ya existe una cuenta con este correo." };
        }

        if (fieldErrors.Count > 0)
        {
            return AuthResult.Failure("Revisa los datos marcados.", fieldErrors);
        }

        var now = DateTimeOffset.UtcNow;
        var accountId = Guid.NewGuid();
        var walletId = WalletId.New();

        var isFirstUser = !await _dbContext.UserAccounts.AnyAsync(cancellationToken);
        var role = isFirstUser || username.Equals("admin", StringComparison.OrdinalIgnoreCase) ? "admin" : "player";

        var account = new UserAccount(
            accountId,
            username,
            normalizedUsername,
            email,
            normalizedEmail,
            _passwordHasher.Hash(password),
            role,
            now,
            now);

        var wallet = new Wallet(walletId, UserId.From(accountId));

        // La economía arranca en $0.00 para jugadores o con saldo administrativo.
        var initialBalance = role == "admin" ? 10000m : _options.Value.InitialBalance;
        if (initialBalance > 0m)
        {
            var welcomeBonus = wallet.Deposit(
                new Money(initialBalance),
                role == "admin" ? "Fondos iniciales de Administrador" : "Bono de bienvenida",
                role == "admin" ? "ADMIN-FUNDS" : "WELCOME-BONUS");
            welcomeBonus.Complete();
        }

        _dbContext.UserAccounts.Add(account);
        _dbContext.Wallets.Add(wallet);

        try
        {
            await _dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception)
        {
            _logger.LogWarning(exception, "No se pudo crear la cuenta {Username}.", username);
            return AuthResult.Failure(
                "No pudimos crear la cuenta. Inténtalo de nuevo en unos segundos.");
        }

        _logger.LogInformation("Cuenta creada: {UserId} / wallet {WalletId}.", accountId, walletId.Value);

        var session = BuildSession(account, walletId.Value, wallet.Balance);
        return AuthResult.Success(session);
    }

    public async Task<AuthResult> LoginAsync(
        AuthLoginRequest request,
        CancellationToken cancellationToken = default)
    {
        var identifier = Normalize(request.Identifier);
        var password = request.Password ?? string.Empty;

        if (string.IsNullOrWhiteSpace(identifier) || string.IsNullOrEmpty(password))
        {
            return AuthResult.Failure("Ingresa tu correo o usuario y tu contraseña.");
        }

        var account = await _dbContext.UserAccounts
            .AsNoTracking()
            .FirstOrDefaultAsync(
                candidate =>
                    candidate.NormalizedEmail == identifier ||
                    candidate.NormalizedUsername == identifier,
                cancellationToken);

        if (account is null || !_passwordHasher.Verify(password, account.PasswordHash))
        {
            _logger.LogInformation("Intento de acceso rechazado para {Identifier}.", identifier);
            return AuthResult.Failure("El correo, usuario o la contraseña no son correctos.");
        }

        var wallet = await _dbContext.Wallets
            .AsNoTracking()
            .FirstOrDefaultAsync(
                candidate => candidate.UserId == UserId.From(account.Id),
                cancellationToken);

        if (wallet is null)
        {
            _logger.LogError("La cuenta {UserId} no tiene billetera.", account.Id);
            return AuthResult.Failure(
                "Tu cuenta no tiene una billetera activa. Contacta a soporte.");
        }

        _logger.LogInformation("Acceso correcto: {UserId}.", account.Id);

        var session = BuildSession(account, wallet.Id.Value, wallet.Balance);
        return AuthResult.Success(session);
    }

    private AuthSessionDto BuildSession(UserAccount account, Guid walletId, Money balance)
    {
        var now = DateTimeOffset.UtcNow;
        var lifetimeMinutes = _options.Value.TokenLifetimeMinutes > 0
            ? _options.Value.TokenLifetimeMinutes
            : 60;

        var token = _tokenService.Issue(
            new AuthTokenPayload(
                account.Id,
                account.Username,
                account.Email,
                walletId,
                account.Role,
                now,
                now.AddMinutes(lifetimeMinutes)));

        return new AuthSessionDto(
            token,
            new AuthUserDto(
                account.Id,
                account.Username,
                account.Email,
                balance.Amount,
                new[] { account.Role },
                walletId,
                account.CreatedAt));
    }

    private static string Normalize(string? value) =>
        (value ?? string.Empty).Trim().ToLowerInvariant();
}
