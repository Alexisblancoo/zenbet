namespace Zenbet.EventsMarkets.Application.Queries.GetWalletTransactions;

using MediatR;
using Zenbet.EventsMarkets.Application.DTOs;
using Zenbet.EventsMarkets.Application.Interfaces;

public sealed class GetWalletTransactionsQueryHandler
    : IRequestHandler<GetWalletTransactionsQuery, IReadOnlyList<WalletTransactionDto>>
{
    private readonly IWalletReadRepository _walletReadRepository;

    public GetWalletTransactionsQueryHandler(IWalletReadRepository walletReadRepository)
    {
        _walletReadRepository = walletReadRepository;
    }

    public Task<IReadOnlyList<WalletTransactionDto>> Handle(
        GetWalletTransactionsQuery request,
        CancellationToken cancellationToken) =>
        _walletReadRepository.ListTransactionsAsync(request.WalletId, cancellationToken);
}
