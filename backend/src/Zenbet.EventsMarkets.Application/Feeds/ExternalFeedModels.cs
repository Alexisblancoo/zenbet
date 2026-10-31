namespace Zenbet.EventsMarkets.Application.Feeds;

using System.Text.Json.Serialization;
using Zenbet.EventsMarkets.Domain.Enums;

/// <summary>
/// Modelo de carga útil externa minificada inspirada en los feeds de 1xBet / BetB2B.
/// Claves compactas de 1 solo carácter para streaming de alta densidad.
/// </summary>
public sealed record MinifiedFeedItem(
    [property: JsonPropertyName("I")] string SelectionId,
    [property: JsonPropertyName("C")] decimal Coeff,
    [property: JsonPropertyName("T")] int? MarketType = null,
    [property: JsonPropertyName("G")] int? MarketGroup = null,
    [property: JsonPropertyName("S")] int? SettlementStatus = null, // 1 = Won, 2 = Lost, 3 = Void/Push
    [property: JsonPropertyName("M")] string? MarketId = null,
    [property: JsonPropertyName("P")] string? Provider = null
);

public sealed record MinifiedFeedBatch(
    [property: JsonPropertyName("Id")] Guid? BatchId,
    [property: JsonPropertyName("Ts")] long TimestampEpochMs,
    [property: JsonPropertyName("Items")] IReadOnlyList<MinifiedFeedItem> Items
);

/// <summary>
/// Modelo de carga útil estándar B2B industrial (Sportradar / Betradar / Genius Sports).
/// </summary>
public sealed record IndustryFeedUpdate(
    string EventId,
    string MarketId,
    string SelectionId,
    decimal Odds,
    DateTimeOffset Timestamp,
    string Provider,
    string? Status = null, // "ACTIVE", "SUSPENDED", "SETTLED"
    string? WinnerSelectionId = null,
    SettlementResult? SettlementResult = null
);

public sealed record FeedNormalizationResult<TCommand>(
    bool Success,
    TCommand? Command,
    IReadOnlyList<string> ValidationErrors);

