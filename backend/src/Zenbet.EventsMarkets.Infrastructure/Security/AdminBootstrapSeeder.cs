namespace Zenbet.EventsMarkets.Infrastructure.Security;

using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Zenbet.EventsMarkets.Application.Interfaces;
using Zenbet.EventsMarkets.Domain.Aggregates;
using Zenbet.EventsMarkets.Domain.ValueObjects;
using Zenbet.EventsMarkets.Infrastructure.Persistence;

/// <summary>
/// Credenciales del primer administrador, inyectadas por variables de entorno
/// (<c>Admin__Bootstrap__Username/Email/Password</c>). Nunca se versionan.
/// </summary>
public sealed class AdminBootstrapOptions
{
    public const string SectionName = "Admin:Bootstrap";

    public const int MinPasswordLength = 14;

    public string Username { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    public string Password { get; set; } = string.Empty;

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(Username) &&
        !string.IsNullOrWhiteSpace(Email) &&
        !string.IsNullOrWhiteSpace(Password);
}

/// <summary>
/// Única vía para crear un administrador: aprovisiona la cuenta definida en la
/// configuración del servidor si todavía no existe ningún admin. Idempotente,
/// sin saldo inicial y con la contraseña hasheada (PBKDF2). Reintenta porque
/// las migraciones pueden aplicarse en paralelo durante el arranque.
/// </summary>
public sealed class AdminBootstrapSeeder : BackgroundService
{
    private const int MaxAttempts = 12;
    private static readonly TimeSpan RetryDelay = TimeSpan.FromSeconds(5);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IOptions<AdminBootstrapOptions> _options;
    private readonly ILogger<AdminBootstrapSeeder> _logger;

    public AdminBootstrapSeeder(
        IServiceScopeFactory scopeFactory,
        IOptions<AdminBootstrapOptions> options,
        ILogger<AdminBootstrapSeeder> logger)
    {
        _scopeFactory = scopeFactory;
        _options = options;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var options = _options.Value;
        if (!options.IsConfigured)
        {
            _logger.LogInformation(
                "Admin bootstrap omitido: define Admin__Bootstrap__Username/Email/Password para crear el primer administrador.");
            return;
        }

        if (options.Password.Length < AdminBootstrapOptions.MinPasswordLength)
        {
            _logger.LogError(
                "Admin bootstrap rechazado: la contraseña debe tener al menos {Min} caracteres.",
                AdminBootstrapOptions.MinPasswordLength);
            return;
        }

        for (var attempt = 1; attempt <= MaxAttempts && !stoppingToken.IsCancellationRequested; attempt++)
        {
            try
            {
                await SeedAsync(options, stoppingToken);
                return;
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }
            catch (Exception exception)
            {
                _logger.LogWarning(
                    exception,
                    "Admin bootstrap: intento {Attempt}/{Max} fallido (¿migraciones pendientes?).",
                    attempt,
                    MaxAttempts);

                try
                {
                    await Task.Delay(RetryDelay, stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    return;
                }
            }
        }

        _logger.LogError("Admin bootstrap no pudo completarse tras {Max} intentos.", MaxAttempts);
    }

    private async Task SeedAsync(AdminBootstrapOptions options, CancellationToken cancellationToken)
    {
        await using var scope = _scopeFactory.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<EventsMarketsDbContext>();
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();

        if (await dbContext.UserAccounts.AnyAsync(account => account.Role == "admin", cancellationToken))
        {
            return;
        }

        var username = options.Username.Trim();
        var email = options.Email.Trim();
        var normalizedUsername = username.ToLowerInvariant();
        var normalizedEmail = email.ToLowerInvariant();

        var taken = await dbContext.UserAccounts.AnyAsync(
            account =>
                account.NormalizedUsername == normalizedUsername ||
                account.NormalizedEmail == normalizedEmail,
            cancellationToken);

        if (taken)
        {
            _logger.LogError(
                "Admin bootstrap abortado: el usuario o correo configurado ya pertenece a una cuenta que no es admin.");
            return;
        }

        var now = DateTimeOffset.UtcNow;
        var accountId = Guid.NewGuid();
        var account = new UserAccount(
            accountId,
            username,
            normalizedUsername,
            email,
            normalizedEmail,
            hasher.Hash(options.Password),
            "admin",
            now,
            now);

        // Billetera en cero: un administrador no recibe fondos de ningún tipo.
        var wallet = new Wallet(WalletId.New(), UserId.From(accountId));

        dbContext.UserAccounts.Add(account);
        dbContext.Wallets.Add(wallet);
        await dbContext.SaveChangesAsync(cancellationToken);

        _logger.LogWarning(
            "Administrador inicial {UserId} creado por bootstrap. Retira Admin__Bootstrap__Password del entorno.",
            accountId);
    }
}
