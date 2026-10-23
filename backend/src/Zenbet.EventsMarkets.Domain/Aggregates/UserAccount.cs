namespace Zenbet.EventsMarkets.Domain.Aggregates;

/// <summary>
/// Cuenta de jugador. La billetera vive en <see cref="Wallet"/> y comparte el
/// mismo identificador de usuario; no se duplica el saldo en la cuenta.
/// </summary>
public sealed class UserAccount
{
    private UserAccount() { } // EF Core

    public UserAccount(
        Guid id,
        string username,
        string normalizedUsername,
        string email,
        string normalizedEmail,
        string passwordHash,
        string role,
        DateTimeOffset createdAt,
        DateTimeOffset termsAcceptedAt)
    {
        Id = id;
        Username = username;
        NormalizedUsername = normalizedUsername;
        Email = email;
        NormalizedEmail = normalizedEmail;
        PasswordHash = passwordHash;
        Role = role;
        CreatedAt = createdAt;
        TermsAcceptedAt = termsAcceptedAt;
    }

    public Guid Id { get; private set; }

    public string Username { get; private set; } = string.Empty;

    /// <summary>Clave de búsqueda en minúsculas; evita usuarios duplicados por casing.</summary>
    public string NormalizedUsername { get; private set; } = string.Empty;

    public string Email { get; private set; } = string.Empty;

    /// <summary>Clave de búsqueda en minúsculas; evita correos duplicados por casing.</summary>
    public string NormalizedEmail { get; private set; } = string.Empty;

    public string PasswordHash { get; private set; } = string.Empty;

    public string Role { get; private set; } = "player";

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset TermsAcceptedAt { get; private set; }
}
