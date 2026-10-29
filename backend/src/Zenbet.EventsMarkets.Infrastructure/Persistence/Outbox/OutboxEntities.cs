namespace Zenbet.EventsMarkets.Infrastructure.Persistence.Outbox;

using System.Text.Json.Serialization;
using Zenbet.EventsMarkets.Domain.Events;
using Zenbet.EventsMarkets.Domain.ValueObjects;
using Zenbet.EventsMarkets.Domain.Enums;

public sealed class OutboxMessage
{
    public Guid Id { get; set; }
    public string Type { get; set; } = default!;
    public string Payload { get; set; } = default!;
    public Guid CorrelationId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? ProcessedAt { get; set; }
    public int RetryCount { get; set; }
    public string? Error { get; set; }
}

public sealed class IdempotencyKey
{
    public string Key { get; set; } = default!;
    public string CommandType { get; set; } = default!;
    public string? PayloadHash { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset ExpiresAt { get; set; } = DateTimeOffset.UtcNow.AddDays(7);
}

public sealed class SettlementAuditEntry
{
    public Guid Id { get; set; }
    public MarketId MarketId { get; set; }
    public SelectionId WinnerSelectionId { get; set; }
    public SettlementResult Result { get; set; }
    public string SettledBy { get; set; } = default!;
    public DateTimeOffset SettledAt { get; set; }
    public string IdempotencyKey { get; set; } = default!;
}

public sealed class InboxMessage
{
    public Guid Id { get; set; }
    public string Source { get; set; } = default!;
    public string MessageType { get; set; } = default!;
    public string Payload { get; set; } = default!;
    public string? Headers { get; set; }
    public DateTimeOffset ReceivedAt { get; set; }
    public DateTimeOffset? ProcessedAt { get; set; }
    public int RetryCount { get; set; }
    public string? LastError { get; set; }
}

public sealed class DeadLetterEntry
{
    public Guid Id { get; set; }
    public string OriginalTable { get; set; } = default!;
    public Guid OriginalId { get; set; }
    public string Payload { get; set; } = default!;
    public string Error { get; set; } = default!;
    public DateTimeOffset FailedAt { get; set; }
    public int RetryCount { get; set; }
}
