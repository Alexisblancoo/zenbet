namespace Zenbet.EventsMarkets.Infrastructure.Security;

public sealed class AuthOptions
{
    public const string SectionName = "Auth";

    public string Issuer { get; set; } = "zenbet";

    public string Audience { get; set; } = "zenbet-web";

    /// <summary>
    /// Secreto HMAC. Debe superar 32 caracteres. En producción se inyecta por
    /// variable de entorno (Auth__SigningKey) y nunca se reutiliza el valor local.
    /// </summary>
    public string SigningKey { get; set; } = string.Empty;

    public int TokenLifetimeMinutes { get; set; } = 60 * 24 * 7;

    public decimal InitialBalance { get; set; } = 0m;
}
