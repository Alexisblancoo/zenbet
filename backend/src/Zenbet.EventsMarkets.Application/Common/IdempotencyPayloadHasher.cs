namespace Zenbet.EventsMarkets.Application.Common;

using System.Security.Cryptography;
using System.Text.Json;

/// <summary>Creates a stable SHA-256 fingerprint for the semantic request payload.</summary>
public static class IdempotencyPayloadHasher
{
    public static string Compute<TPayload>(TPayload payload)
    {
        var bytes = JsonSerializer.SerializeToUtf8Bytes(payload);
        return Convert.ToHexString(SHA256.HashData(bytes));
    }
}
