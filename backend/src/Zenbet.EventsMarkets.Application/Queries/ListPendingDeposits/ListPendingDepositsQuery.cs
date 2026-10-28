namespace Zenbet.EventsMarkets.Application.Queries.ListPendingDeposits;

using MediatR;
using Zenbet.EventsMarkets.Domain.ValueObjects;

public sealed record ListPendingDepositsQuery(WalletId? WalletId)
    : IRequest<IReadOnlyList<MyPendingDepositDto>>;

public sealed record MyPendingDepositDto(
    Guid TransactionId,
    Guid WalletId,
    Guid UserId,
    decimal Amount,
    string Method,
    string Reference,
    DateTimeOffset CreatedAt);
