namespace Zenbet.EventsMarkets.Application.Commands.DepositFunds;

using MediatR;
using Zenbet.EventsMarkets.Domain.ValueObjects;

public sealed record DepositFundsCommand(
    WalletId WalletId,
    Money Amount,
    string PaymentMethod,
    Guid IdempotencyKey) : IRequest<DepositFundsResult>;

public sealed record DepositFundsResult(
    bool Success,
    TransactionId? TransactionId,
    Money? NewBalance,
    string? ErrorMessage);
