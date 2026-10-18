namespace Zenbet.EventsMarkets.Application.Commands.SettleMarket;

using MediatR;
using Zenbet.EventsMarkets.Domain.ValueObjects;
using Zenbet.EventsMarkets.Domain.Enums;

public sealed record SettleMarketCommand(
    MarketId MarketId,
    SelectionId WinnerSelectionId,
    SettlementResult Result,
    string SettledBy,
    Guid IdempotencyKey) : IRequest<SettleMarketResult>;

public sealed record SettleMarketResult(
    MarketId MarketId,
    SelectionId WinnerSelectionId,
    SettlementResult Result,
    DateTimeOffset SettledAt);