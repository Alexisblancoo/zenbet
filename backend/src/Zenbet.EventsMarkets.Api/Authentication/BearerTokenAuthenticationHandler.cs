namespace Zenbet.EventsMarkets.Api.Authentication;

using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;
using Zenbet.EventsMarkets.Application.Interfaces;

/// <summary>
/// Autentica las peticiones con el JWT HS256 emitido por AuthService. El
/// esquema no desafía con redirecciones: las APIs responden 401/403.
/// </summary>
public sealed class BearerTokenAuthenticationHandler
    : AuthenticationHandler<AuthenticationSchemeOptions>
{
    public const string SchemeName = "ZenbetBearer";

    public BearerTokenAuthenticationHandler(
        IOptionsMonitor<AuthenticationSchemeOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder)
        : base(options, logger, encoder)
    {
    }

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var token = ExtractToken();

        if (string.IsNullOrWhiteSpace(token))
        {
            return Task.FromResult(AuthenticateResult.NoResult());
        }

        var tokenService = Context.RequestServices.GetRequiredService<IAuthTokenService>();
        var payload = tokenService.Validate(token);

        if (payload is null)
        {
            return Task.FromResult(
                AuthenticateResult.Fail("La sesión no es válida o ha expirado."));
        }

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, payload.UserId.ToString()),
            new Claim(ClaimTypes.Name, payload.Username),
            new Claim(ClaimTypes.Email, payload.Email),
            new Claim(ClaimTypes.Role, payload.Role),
            new Claim("wallet_id", payload.WalletId.ToString()),
        };

        var identity = new ClaimsIdentity(claims, SchemeName);
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, SchemeName);

        return Task.FromResult(AuthenticateResult.Success(ticket));
    }

    /// <summary>
    /// Acepta el token del header estándar o del query string. SignalR no puede
    /// enviar headers en el handshake WebSocket, así que su cliente viaja con
    /// <c>?access_token=…</c> (lo inyecta el accessTokenFactory del front).
    /// </summary>
    private string? ExtractToken()
    {
        var authorization = Request.Headers.Authorization.ToString();
        if (!string.IsNullOrWhiteSpace(authorization)
            && authorization.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            return authorization["Bearer ".Length..].Trim();
        }

        var accessToken = Request.Query["access_token"].ToString();
        return string.IsNullOrWhiteSpace(accessToken) ? null : accessToken.Trim();
    }
}
