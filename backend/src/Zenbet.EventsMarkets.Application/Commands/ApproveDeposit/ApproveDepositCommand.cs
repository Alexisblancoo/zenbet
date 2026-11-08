namespace Zenbet.EventsMarkets.Application.Commands.ApproveDeposit;

using MediatR;
using Zenbet.EventsMarkets.Domain.ValueObjects;

/// <param name="ApproverUserId">
/// Identidad autenticada de quien aprueba (claim del token). Se usa para impedir
/// que un administrador acredite sus propios depósitos.
/// </param>
public sealed record ApproveDepositCommand(TransactionId TransactionId, Guid ApproverUserId)
    : IRequest<ApproveDepositResult>;

public enum ApproveDepositError
{
    None = 0,
    TransactionNotFound = 1,
    NotADeposit = 2,
    LegacyDeposit = 3,
    InvalidState = 4,
    SelfApprovalForbidden = 5
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
