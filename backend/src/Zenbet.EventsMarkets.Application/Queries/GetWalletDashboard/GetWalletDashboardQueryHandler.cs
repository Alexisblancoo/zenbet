namespace Zenbet.EventsMarkets.Application.Queries.GetWalletDashboard;

using MediatR;
using Zenbet.EventsMarkets.Application.DTOs;
using Zenbet.EventsMarkets.Application.Interfaces;

public sealed class GetWalletDashboardQueryHandler
    : IRequestHandler<GetWalletDashboardQuery, WalletDashboardDto?>
{
    private readonly IWalletReadRepository _walletReadRepository;

    public GetWalletDashboardQueryHandler(IWalletReadRepository walletReadRepository)
    {
        _walletReadRepository = walletReadRepository;
    }

    public async Task<WalletDashboardDto?> Handle(
        GetWalletDashboardQuery request,
        CancellationToken cancellationToken)
    {
        var balances = await _walletReadRepository.GetBalancesAsync(request.WalletId, cancellationToken);
        if (balances is null) return null;

        // Las consultas comparten el DbContext scoped: se ejecutan en serie.
        var bets = await _walletReadRepository.ListBetsAsync(request.WalletId, cancellationToken);
        var transactions = await _walletReadRepository.ListTransactionsAsync(
            request.WalletId,
            cancellationToken);

        return new WalletDashboardDto(
            "USD",
            balances.Balance,
            balances.AtRiskBalance,
            bets,
            transactions,
            DateTimeOffset.UtcNow);
    }
}
