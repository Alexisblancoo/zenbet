namespace Zenbet.EventsMarkets.Application.Commands.PlaceBet;

using MediatR;
using Zenbet.EventsMarkets.Domain.ValueObjects;

public sealed record PlaceBetCommand(
    WalletId WalletId,
    SelectionId SelectionId,
    Money Amount,
    string Description,
    Guid IdempotencyKey,
    string? PromoCode = null,
    decimal? ExpectedOdds = null,
    decimal? MaxSlippagePercent = null,
    decimal? MinAcceptedOdds = null) : IRequest<PlaceBetResult>;

public sealed record PlaceBetResult(
    bool Success,
    BetId? BetId,
    TransactionId? TransactionId,
    Money? NewBalance,
    string? ErrorMessage,
    bool IdempotentReplay = false,
    string? ErrorCode = null,
    decimal? CurrentOdds = null,
    decimal? ExpectedOdds = null,
    Money? RealStake = null,
    Money? BonusStake = null,
    Money? RealAvailable = null,
    Money? BonusAvailable = null,
    bool RolloverCompleted = false);

public readonly record struct BetId(Guid Value)
{
    public static BetId New() => new(Guid.NewGuid());
    public static BetId From(Guid guid) => new(guid);
    public static BetId Empty => new(Guid.Empty);

    public static implicit operator Guid(BetId id) => id.Value;
    public static explicit operator BetId(Guid guid) => new(guid);

    public override string ToString() => Value.ToString();
}