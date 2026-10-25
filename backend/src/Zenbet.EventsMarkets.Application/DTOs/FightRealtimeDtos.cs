namespace Zenbet.EventsMarkets.Application.DTOs;

/// <summary>
/// Cambio de estado de un combate. Es el contrato mínimo que necesita la UI
/// para cerrar mercados, mostrar el resultado y refrescar una tarjeta sin
/// volver a descargar la cartelera completa.
/// </summary>
public sealed record FightUpdateDto(
    Guid EventId,
    string Status,
    bool IsExpired,
    bool IsBettingOpen,
    DateTimeOffset StartTime,
    DateTimeOffset EndsAt,
    MmaResultDto? Result,
    DateTimeOffset UpdatedAt);

/// <summary>
/// Reloj de combate calculado en servidor. La UI no debe inferir el asalto ni
/// el tiempo restante a partir de la hora local del navegador.
/// </summary>
public sealed record FightClockDto(
    Guid EventId,
    string Status,
    int? Round,
    string? Clock,
    int ElapsedSeconds,
    DateTimeOffset StartTime,
    DateTimeOffset EndsAt,
    DateTimeOffset ServerTime);

/// <summary>Estado agregado de una cartelera para el selector de sábados.</summary>
public sealed record FightCardUpdateDto(
    string CardKey,
    string Status,
    int TotalCount,
    int LiveCount,
    int FinishedCount,
    bool IsBettingOpen,
    DateTimeOffset UpdatedAt);
