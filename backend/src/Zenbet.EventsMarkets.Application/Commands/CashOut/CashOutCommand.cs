namespace Zenbet.EventsMarkets.Application.Commands.CashOut;

using MediatR;
using Zenbet.EventsMarkets.Domain.ValueObjects;

/// <summary>
/// Liquida anticipadamente una apuesta pendiente. El <paramref name="BetId"/>
/// es el identificador del cargo de apuesta (<c>TransactionType.BetPlacement</c>),
/// que en este modelo es también el boleto que ve el jugador.
/// </summary>
public sealed record CashOutCommand(
    WalletId WalletId,
    TransactionId BetId,
    Guid IdempotencyKey) : IRequest<CashOutResult>;

public sealed record CashOutResult(
    bool Success,
    TransactionId? TransactionId,
    Money? CashOutAmount,
    Money? NewBalance,
    string? ErrorMessage,
    string? ErrorCode = null,
    bool IdempotentReplay = false,
    Money? NewRealAvailable = null,
    decimal? InitialOdds = null,
    decimal? CurrentOdds = null,
    decimal? RetentionMargin = null);
