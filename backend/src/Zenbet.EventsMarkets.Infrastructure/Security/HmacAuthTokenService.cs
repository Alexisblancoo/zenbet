namespace Zenbet.EventsMarkets.Infrastructure.Security;

using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
using Zenbet.EventsMarkets.Application.Auth;
using Zenbet.EventsMarkets.Application.Interfaces;

/// <summary>
/// Emite y valida JWT HS256 con las primitivas del framework. Evita añadir una
/// dependencia de identidad solo para firmar la sesión de la API.
/// </summary>
public sealed class HmacAuthTokenService : IAuthTokenService
{
    private static readonly string EncodedHeader = Base64UrlEncode(
        JsonSerializer.SerializeToUtf8Bytes(new { alg = "HS256", typ = "JWT" }));

    private readonly AuthOptions _options;
    private readonly byte[] _signingKey;

    public HmacAuthTokenService(IOptions<AuthOptions> options)
    {
        _options = options.Value;

        if (string.IsNullOrWhiteSpace(_options.SigningKey) || _options.SigningKey.Length < 32)
        {
            throw new InvalidOperationException(
                "Auth:SigningKey debe estar configurado con al menos 32 caracteres.");
        }

        _signingKey = Encoding.UTF8.GetBytes(_options.SigningKey);
    }

    public string Issue(AuthTokenPayload payload)
    {
        var issuedAt = payload.IssuedAt.ToUniversalTime();
        var expiresAt = payload.ExpiresAt.ToUniversalTime();

        var body = new Dictionary<string, object?>
        {
            ["sub"] = payload.UserId,
            ["unique_name"] = payload.Username,
            ["email"] = payload.Email,
            ["wallet_id"] = payload.WalletId,
            ["role"] = payload.Role,
            ["iss"] = _options.Issuer,
            ["aud"] = _options.Audience,
            ["iat"] = issuedAt.ToUnixTimeSeconds(),
            ["exp"] = expiresAt.ToUnixTimeSeconds(),
            ["jti"] = Guid.NewGuid().ToString("N"),
        };

        var payloadPart = Base64UrlEncode(JsonSerializer.SerializeToUtf8Bytes(body));
        var signingInput = $"{EncodedHeader}.{payloadPart}";
        var signature = Sign(signingInput);

        return $"{signingInput}.{Base64UrlEncode(signature)}";
    }

    public AuthTokenPayload? Validate(string token)
    {
        if (string.IsNullOrWhiteSpace(token))
            return null;

        var parts = token.Split('.');
        if (parts.Length != 3)
            return null;

        var signingInput = $"{parts[0]}.{parts[1]}";
        var expectedSignature = Sign(signingInput);

        byte[] suppliedSignature;
        try
        {
            suppliedSignature = Base64UrlDecode(parts[2]);
        }
        catch (FormatException)
        {
            return null;
        }

        if (!CryptographicOperations.FixedTimeEquals(expectedSignature, suppliedSignature))
            return null;

        try
        {
            using var header = JsonDocument.Parse(Base64UrlDecode(parts[0]));
            if (!string.Equals(
                    header.RootElement.GetProperty("alg").GetString(),
                    "HS256",
                    StringComparison.Ordinal) ||
                !string.Equals(
                    header.RootElement.GetProperty("typ").GetString(),
                    "JWT",
                    StringComparison.Ordinal))
            {
                return null;
            }

            using var payload = JsonDocument.Parse(Base64UrlDecode(parts[1]));
            var root = payload.RootElement;

            if (!string.Equals(root.GetProperty("iss").GetString(), _options.Issuer, StringComparison.Ordinal) ||
                !string.Equals(root.GetProperty("aud").GetString(), _options.Audience, StringComparison.Ordinal))
            {
                return null;
            }

            var expiresAt = DateTimeOffset.FromUnixTimeSeconds(root.GetProperty("exp").GetInt64());
            if (expiresAt <= DateTimeOffset.UtcNow)
                return null;

            var issuedAt = DateTimeOffset.FromUnixTimeSeconds(root.GetProperty("iat").GetInt64());

            if (!Guid.TryParse(root.GetProperty("sub").GetString(), out var userId) ||
                !Guid.TryParse(root.GetProperty("wallet_id").GetString(), out var walletId))
            {
                return null;
            }

            var username = root.GetProperty("unique_name").GetString();
            var email = root.GetProperty("email").GetString();
            var role = root.GetProperty("role").GetString();

            if (string.IsNullOrWhiteSpace(username) ||
                string.IsNullOrWhiteSpace(email) ||
                string.IsNullOrWhiteSpace(role))
            {
                return null;
            }

            return new AuthTokenPayload(
                userId,
                username,
                email,
                walletId,
                role,
                issuedAt,
                expiresAt);
        }
        catch (Exception exception) when (
            exception is JsonException or KeyNotFoundException or InvalidOperationException or FormatException)
        {
            return null;
        }
    }

    private byte[] Sign(string value) =>
        HMACSHA256.HashData(_signingKey, Encoding.UTF8.GetBytes(value));

    private static string Base64UrlEncode(byte[] value) =>
        Convert.ToBase64String(value)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');

    private static byte[] Base64UrlDecode(string value)
    {
        var normalized = value
            .Replace('-', '+')
            .Replace('_', '/');

        normalized = normalized.PadRight(normalized.Length + ((4 - normalized.Length % 4) % 4), '=');
        return Convert.FromBase64String(normalized);
    }
}
