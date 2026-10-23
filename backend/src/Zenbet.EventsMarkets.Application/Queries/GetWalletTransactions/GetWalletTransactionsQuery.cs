namespace Zenbet.EventsMarkets.Application.Queries.GetWalletTransactions;

using MediatR;
using Zenbet.EventsMarkets.Application.DTOs;

public sealed record GetWalletTransactionsQuery(Guid WalletId)
    : IRequest<IReadOnlyList<WalletTransactionDto>>;
