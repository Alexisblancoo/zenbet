namespace Zenbet.EventsMarkets.Application.Commands.SettleUfcEvent;

using MediatR;
using Zenbet.EventsMarkets.Domain.Enums;
using Zenbet.EventsMarkets.Domain.ValueObjects;

public sealed record SettleUfcEventCommand(
    EventId EventId,
    FightCorner WinnerCorner,
    MmaVictoryMethod Method,
    int Round,
    string SettledBy,
    Guid IdempotencyKey) : IRequest<SettleUfcEventResult>;

public sealed record SettleUfcEventResult(
    Guid EventId,
    string EventName,
    string WinnerCorner,
    string Method,
    int Round,
    string EventStatus,
    bool AlreadyRecorded,
    IReadOnlyList<UfcMarketSettlementResult> Markets);

public sealed record UfcMarketSettlementResult(
    Guid MarketId,
    string MarketType,
    Guid? WinnerSelectionId,
    string Status);
