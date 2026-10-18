namespace Zenbet.EventsMarkets.Application.Commands.PlaceBet;

using MediatR;
using Zenbet.EventsMarkets.Domain.ValueObjects;

public sealed record PlaceBetCommand(
    WalletId WalletId,
    SelectionId SelectionId,
    Money Amount,
    string Description,
    Guid IdempotencyKey) : IRequest<PlaceBetResult>;

public sealed record PlaceBetResult(
    bool Success,
    BetId? BetId,
    TransactionId? TransactionId,
    Money? NewBalance,
    string? ErrorMessage);

public readonly record struct BetId(Guid Value)
{
    public static BetId New() => new(Guid.NewGuid());
    public static BetId From(Guid guid) => new(guid);
    public static BetId Empty => new(Guid.Empty);

    public static implicit operator Guid(BetId id) => id.Value;
    public static explicit operator BetId(Guid guid) => new(guid);

    public override string ToString() => Value.ToString();
}