namespace Zenbet.EventsMarkets.Application.Interfaces;

using Zenbet.EventsMarkets.Application.Auth;

public interface IAuthService
{
    Task<AuthResult> RegisterAsync(
        AuthRegisterRequest request,
        CancellationToken cancellationToken = default);

    Task<AuthResult> LoginAsync(
        AuthLoginRequest request,
        CancellationToken cancellationToken = default);
}

public interface IPasswordHasher
{
    string Hash(string password);

    bool Verify(string password, string passwordHash);
}

public interface IAuthTokenService
{
    string Issue(AuthTokenPayload payload);

    AuthTokenPayload? Validate(string token);
}
