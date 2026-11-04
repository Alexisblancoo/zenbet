namespace Zenbet.EventsMarkets.Application.Commands.ResettleMarket;

using MediatR;
using Zenbet.EventsMarkets.Domain.Enums;
using Zenbet.EventsMarkets.Domain.ValueObjects;

/// <summary>
/// Comando CQRS para ejecutar el Motor de Re-liquidación y Clawbacks (VAR Resettlement Engine)
/// sobre un mercado previamente liquidado cuyo resultado oficial cambió.
/// </summary>
public sealed record ResettleMarketCommand(
    MarketId MarketId,
    SelectionId NewWinnerSelectionId,
    SettlementResult NewResult,
    string Reason,
    string ResettledBy,
    Guid IdempotencyKey) : IRequest<ResettleMarketResult>;

public sealed record ResettleMarketResult(
    MarketId MarketId,
    SelectionId NewWinnerSelectionId,
    SettlementResult NewResult,
    int ClawbacksExecuted,
    int BetsResettled,
    int WalletsInNegativeDebt,
    DateTimeOffset ResettledAt);

