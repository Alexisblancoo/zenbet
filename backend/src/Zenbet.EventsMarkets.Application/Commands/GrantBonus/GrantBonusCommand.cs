namespace Zenbet.EventsMarkets.Application.Commands.GrantBonus;

using MediatR;
using Zenbet.EventsMarkets.Domain.ValueObjects;

public sealed record GrantBonusCommand(
    WalletId WalletId,
    Money BonusAmount,
    Money WageringRequirement,
    decimal MinOdds,
    Money MaxConversion,
    Guid IdempotencyKey,
    string? Description = null) : IRequest<GrantBonusResult>;

public sealed record GrantBonusResult(
    bool Success,
    BonusId? BonusId,
    TransactionId? TransactionId,
    Money? BonusAvailable,
    Money? NewBalance,
    string? ErrorMessage);

