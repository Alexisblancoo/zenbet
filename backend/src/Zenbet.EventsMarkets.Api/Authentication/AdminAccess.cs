namespace Zenbet.EventsMarkets.Api.Authentication;

using System.Security.Claims;

/// <summary>Categoría de logger para auditoría de acciones privilegiadas.</summary>
public sealed class AdminAudit;

/// <summary>
/// Acceso administrativo: las operaciones que mueven dinero o cuotas (liquidar,
/// re-liquidar, fijar cuotas, aprobar depósitos) exigen una sesión autenticada
/// con rol <c>admin</c>. La identidad del actor sale SIEMPRE del token firmado,
/// nunca de un campo del body ni de una clave compartida.
/// </summary>
public static class AdminAccess
{
    public const string PolicyName = "AdminOnly";

    public const string Role = "admin";

    /// <summary>Etiqueta persistible (≤ 100 chars) del actor: <c>usuario (guid)</c>.</summary>
    public static string ActorLabel(ClaimsPrincipal user)
    {
        var name = user.Identity?.Name ?? "unknown";
        var id = user.FindFirstValue(ClaimTypes.NameIdentifier) ?? "unknown";
        var label = $"{name} ({id})";
        return label.Length <= 100 ? label : label[..100];
    }

    /// <summary>Traza estructurada (usuario, IP, acción, objetivo) para OpenTelemetry/logs.</summary>
    public static void LogPrivilegedAction(
        ILogger<AdminAudit> logger,
        ClaimsPrincipal user,
        HttpContext httpContext,
        string action,
        object? target)
    {
        logger.LogWarning(
            "ADMIN_ACTION {Action} target={Target} actor={Actor} ip={Ip} traceId={TraceId}",
            action,
            target,
            ActorLabel(user),
            httpContext.Connection.RemoteIpAddress?.ToString(),
            httpContext.TraceIdentifier);
    }
}
