namespace Zenbet.EventsMarkets.Application.Commands.SettleFight;

using MediatR;
using Zenbet.EventsMarkets.Application.Commands.SettleUfcEvent;
using Zenbet.EventsMarkets.Domain.Enums;
using Zenbet.EventsMarkets.Domain.ValueObjects;

public sealed record SettleFightCommand(
    EventId EventId,
    FightCorner WinnerCorner,
    MmaVictoryMethod Method,
    int Round,
    string SettledBy,
    Guid? IdempotencyKey = null) : IRequest<SettleUfcEventResult>;
