namespace Zenbet.EventsMarkets.Domain.Events;

using Zenbet.EventsMarkets.Domain.ValueObjects;
using Zenbet.EventsMarkets.Domain.Enums;

public abstract record DomainEvent(DateTimeOffset OccurredAt, Guid CorrelationId)
{
    protected DomainEvent() : this(DateTimeOffset.UtcNow, Guid.NewGuid()) { }
}

public sealed record EventCreatedDomainEvent(
    EventId EventId,
    string Name,
    SportType SportType,
    DateTimeOffset StartTime,
    string? Competition)
    : DomainEvent(DateTimeOffset.UtcNow, EventId.Value);

public sealed record EventStatusChangedDomainEvent(
    EventId EventId,
    EventStatus OldStatus,
    EventStatus NewStatus,
    DateTimeOffset ChangedAt)
    : DomainEvent(ChangedAt, EventId.Value);

/// <summary>
/// Resultado oficial registrado. Se emite incluso si el evento ya estaba
/// cerrado por vencimiento, para que la UI reciba el ganador sin esperar una
/// recarga manual de la cartelera.
/// </summary>
public sealed record MmaResultRecordedDomainEvent(
    EventId EventId,
    DateTimeOffset RecordedAt)
    : DomainEvent(RecordedAt, EventId.Value);

public sealed record EventCancelledDomainEvent(
    EventId EventId,
    string Reason,
    DateTimeOffset CancelledAt)
    : DomainEvent(CancelledAt, EventId.Value);

public sealed record EventVoidedDomainEvent(
    EventId EventId,
    string Reason,
    DateTimeOffset VoidedAt)
    : DomainEvent(VoidedAt, EventId.Value);

public sealed record MarketCreatedDomainEvent(
    MarketId MarketId,
    EventId EventId,
    string Name,
    MarketType Type)
    : DomainEvent(DateTimeOffset.UtcNow, MarketId.Value);

public sealed record OddsChangedDomainEvent(
    MarketId MarketId,
    SelectionId SelectionId,
    Odd OldOdd,
    Odd NewOdd,
    DateTimeOffset Timestamp)
    : DomainEvent(Timestamp, MarketId.Value);

public sealed record MarketSuspendedDomainEvent(
    MarketId MarketId,
    string Reason)
    : DomainEvent(DateTimeOffset.UtcNow, MarketId.Value);

public sealed record MarketResumedDomainEvent(
    MarketId MarketId)
    : DomainEvent(DateTimeOffset.UtcNow, MarketId.Value);

public sealed record MarketSettledDomainEvent(
    MarketId MarketId,
    EventId EventId,
    SelectionId WinnerSelectionId,
    SettlementResult Result,
    string? SettledBy,
    DateTimeOffset SettledAt)
    : DomainEvent(SettledAt, MarketId.Value);

public sealed record MarketVoidedDomainEvent(
    MarketId MarketId,
    EventId EventId,
    string Reason,
    string? VoidedBy,
    DateTimeOffset VoidedAt)
    : DomainEvent(VoidedAt, MarketId.Value);

public sealed record WalletCreatedDomainEvent(
    WalletId WalletId,
    UserId UserId,
    DateTimeOffset CreatedAt)
    : DomainEvent(CreatedAt, WalletId.Value);

public sealed record WalletDepositedDomainEvent(
    WalletId WalletId,
    UserId UserId,
    Money Amount,
    Money NewBalance,
    TransactionId TransactionId,
    DateTimeOffset OccurredAt)
    : DomainEvent(OccurredAt, WalletId.Value);

public sealed record WalletWithdrawnDomainEvent(
    WalletId WalletId,
    UserId UserId,
    Money Amount,
    Money NewBalance,
    TransactionId TransactionId,
    DateTimeOffset OccurredAt)
    : DomainEvent(OccurredAt, WalletId.Value);

public sealed record BetPlacedDomainEvent(
    WalletId WalletId,
    UserId UserId,
    Money Amount,
    Money NewBalance,
    TransactionId TransactionId,
    DateTimeOffset OccurredAt)
    : DomainEvent(OccurredAt, WalletId.Value);

public sealed record BetSettledDomainEvent(
    WalletId WalletId,
    UserId UserId,
    Money Amount,
    Money NewBalance,
    TransactionId TransactionId,
    DateTimeOffset OccurredAt)
    : DomainEvent(OccurredAt, WalletId.Value);

public sealed record BetCancelledDomainEvent(
    WalletId WalletId,
    UserId UserId,
    Money Amount,
    Money NewBalance,
    TransactionId TransactionId,
    DateTimeOffset OccurredAt)
    : DomainEvent(OccurredAt, WalletId.Value);

public sealed record BonusAddedDomainEvent(
    WalletId WalletId,
    UserId UserId,
    Money Amount,
    Money NewBalance,
    TransactionId TransactionId,
    DateTimeOffset OccurredAt)
    : DomainEvent(OccurredAt, WalletId.Value);

public sealed record WalletAdjustedDomainEvent(
    WalletId WalletId,
    UserId UserId,
    Money Amount,
    Money NewBalance,
    TransactionId TransactionId,
    DateTimeOffset OccurredAt)
    : DomainEvent(OccurredAt, WalletId.Value);