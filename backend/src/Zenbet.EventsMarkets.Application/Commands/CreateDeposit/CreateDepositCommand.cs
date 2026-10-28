namespace Zenbet.EventsMarkets.Application.Commands.CreateDeposit;

using MediatR;
using Zenbet.EventsMarkets.Domain.Enums;
using Zenbet.EventsMarkets.Domain.ValueObjects;

public sealed record CreateDepositCommand(
    WalletId WalletId,
    Money Amount,
    PaymentMethod Method,
    string Reference) : IRequest<CreateDepositResult>;

public enum CreateDepositError
{
    None = 0,
    InvalidAmount = 1,
    InvalidReference = 2,
    WalletNotFound = 3
}

public sealed record CreateDepositResult(
    bool Success,
    TransactionId? TransactionId,
    string? Status,
    DateTimeOffset? CreatedAt,
    CreateDepositError Error,
    string? ErrorMessage);
