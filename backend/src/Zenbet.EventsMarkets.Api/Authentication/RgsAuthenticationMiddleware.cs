namespace Zenbet.EventsMarkets.Api.Authentication;

using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

/// <summary>
/// Configuración criptográfica para la pasarela RGS (Remote Game Server) Seamless Wallet.
/// </summary>
public sealed class RgsOptions
{
    public const string SectionName = "Rgs";

    /// <summary>
    /// Llave compartida (Shared Secret) para validación HMAC-SHA256 de payloads RGS.
    /// </summary>
    public string SharedSecret { get; set; } = string.Empty;

    /// <summary>
    /// Identificador del proveedor por defecto (ej. PRAGMATIC).
    /// </summary>
    public string ProviderId { get; set; } = "PRAGMATIC";

    /// <summary>
    /// Nombre del header HTTP que transporta la firma HMAC-SHA256 en hexadecimal.
    /// </summary>
    public string SignatureHeaderName { get; set; } = "X-Provider-Signature";
}

/// <summary>
/// Middleware de seguridad perimetral que intercepta todas las peticiones a <c>/api/rgs/*</c>
/// y verifica la firma criptográfica HMAC-SHA256 enviada en el header <c>X-Provider-Signature</c>.
/// Protege contra ataques de falsificación (spoofing) y manipulación de payloads (tampering) en tiempo constante.
/// </summary>
public sealed class RgsAuthenticationMiddleware
{
    private const string RgsPathPrefix = "/api/rgs";
    private readonly RequestDelegate _next;
    private readonly IOptionsMonitor<RgsOptions> _options;
    private readonly ILogger<RgsAuthenticationMiddleware> _logger;

    public RgsAuthenticationMiddleware(
        RequestDelegate next,
        IOptionsMonitor<RgsOptions> options,
        ILogger<RgsAuthenticationMiddleware> logger)
    {
        _next = next;
        _options = options;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (!context.Request.Path.StartsWithSegments(RgsPathPrefix, StringComparison.OrdinalIgnoreCase))
        {
            await _next(context);
            return;
        }

        var config = _options.CurrentValue;
        var headerName = string.IsNullOrWhiteSpace(config.SignatureHeaderName)
            ? "X-Provider-Signature"
            : config.SignatureHeaderName;

        if (string.IsNullOrWhiteSpace(config.SharedSecret))
        {
            _logger.LogCritical("RGS SharedSecret is not configured in appsettings.json.");
            await WriteUnauthorizedAsync(context, "RGS_CONFIG_ERROR", "La llave compartida RGS no está configurada.");
            return;
        }

        if (!context.Request.Headers.TryGetValue(headerName, out var signatureHeader) ||
            string.IsNullOrWhiteSpace(signatureHeader))
        {
            _logger.LogWarning("Missing {Header} header on RGS request to {Path}", headerName, context.Request.Path);
            await WriteUnauthorizedAsync(context, "MISSING_SIGNATURE", $"Falta el encabezado criptográfico {headerName}.");
            return;
        }

        context.Request.EnableBuffering();

        string rawBody;
        using (var reader = new StreamReader(
                   context.Request.Body,
                   Encoding.UTF8,
                   detectEncodingFromByteOrderMarks: false,
                   bufferSize: 4096,
                   leaveOpen: true))
        {
            rawBody = await reader.ReadToEndAsync(context.RequestAborted);
            context.Request.Body.Position = 0;
        }

        if (!VerifyHmacSha256(rawBody, config.SharedSecret, signatureHeader.ToString()))
        {
            _logger.LogWarning("Invalid HMAC-SHA256 signature on RGS request to {Path}", context.Request.Path);
            await WriteUnauthorizedAsync(context, "INVALID_SIGNATURE", "La firma HMAC-SHA256 del proveedor RGS no es válida.");
            return;
        }

        await _next(context);
    }

    public static bool VerifyHmacSha256(string payload, string sharedSecret, string providedHexSignature)
    {
        var cleanHex = providedHexSignature.Trim();
        if (cleanHex.StartsWith("sha256=", StringComparison.OrdinalIgnoreCase))
        {
            cleanHex = cleanHex["sha256=".Length..].Trim();
        }

        byte[] providedBytes;
        try
        {
            providedBytes = Convert.FromHexString(cleanHex);
        }
        catch (FormatException)
        {
            return false;
        }

        var keyBytes = Encoding.UTF8.GetBytes(sharedSecret);
        var payloadBytes = Encoding.UTF8.GetBytes(payload);
        var computedBytes = HMACSHA256.HashData(keyBytes, payloadBytes);

        return CryptographicOperations.FixedTimeEquals(computedBytes, providedBytes);
    }

    private static async Task WriteUnauthorizedAsync(HttpContext context, string errorCode, string message)
    {
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        context.Response.ContentType = "application/json";
        await context.Response.WriteAsJsonAsync(new
        {
            success = false,
            errorCode,
            message,
            timestamp = DateTimeOffset.UtcNow,
        });
    }
}

