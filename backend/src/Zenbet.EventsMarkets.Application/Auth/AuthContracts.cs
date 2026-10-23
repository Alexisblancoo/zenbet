namespace Zenbet.EventsMarkets.Application.Auth;

public sealed record AuthUserDto(
    Guid Id,
    string Username,
    string Email,
    decimal WalletBalance,
    IReadOnlyList<string> Roles,
    Guid WalletId,
    DateTimeOffset CreatedAt);

public sealed record AuthSessionDto(string Token, AuthUserDto User);

public sealed record AuthTokenPayload(
    Guid UserId,
    string Username,
    string Email,
    Guid WalletId,
    string Role,
    DateTimeOffset IssuedAt,
    DateTimeOffset ExpiresAt);

public sealed record AuthRegisterRequest(
    string Username,
    string Email,
    string Password,
    bool TermsAccepted);

public sealed record AuthLoginRequest(string Identifier, string Password);

/// <summary>
/// Resultado de un caso de uso de autenticación. Los errores de campo usan
/// exactamente los nombres del formulario para que el frontend pueda pintarlos.
/// </summary>
public sealed record AuthResult(
    AuthSessionDto? Session,
    string? Error,
    IReadOnlyDictionary<string, string[]> FieldErrors)
{
    private static readonly IReadOnlyDictionary<string, string[]> NoFieldErrors =
        new Dictionary<string, string[]>();

    public bool Succeeded => Session is not null;

    public static AuthResult Success(AuthSessionDto session) =>
        new(session, null, NoFieldErrors);

    public static AuthResult Failure(
        string error,
        IReadOnlyDictionary<string, string[]>? fieldErrors = null) =>
        new(null, error, fieldErrors ?? NoFieldErrors);
}
