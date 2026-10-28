namespace Zenbet.EventsMarkets.Application.Commands.ApproveDeposit;

using MediatR;
using Zenbet.EventsMarkets.Domain.ValueObjects;

public sealed record ApproveDepositCommand(TransactionId TransactionId)
    : IRequest<ApproveDepositResult>;

public enum ApproveDepositError
{
    None = 0,
    TransactionNotFound = 1,
    NotADeposit = 2,
    LegacyDeposit = 3,
    InvalidState = 4
}

public sealed record ApproveDepositResult(
    bool Success,
    TransactionId? TransactionId,
    string? Status,
    decimal? NewBalance,
    decimal? AtRiskBalance,
    bool AlreadyApproved,
    ApproveDepositError Error,
    string? ErrorMessage);
