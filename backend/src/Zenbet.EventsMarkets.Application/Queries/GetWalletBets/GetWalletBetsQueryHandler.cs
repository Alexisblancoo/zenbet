namespace Zenbet.EventsMarkets.Application.Queries.GetWalletBets;

using MediatR;
using Zenbet.EventsMarkets.Application.DTOs;
using Zenbet.EventsMarkets.Application.Interfaces;

public sealed class GetWalletBetsQueryHandler
    : IRequestHandler<GetWalletBetsQuery, IReadOnlyList<WalletBetDto>>
{
    private readonly IWalletReadRepository _walletReadRepository;

    public GetWalletBetsQueryHandler(IWalletReadRepository walletReadRepository)
    {
        _walletReadRepository = walletReadRepository;
    }

    public Task<IReadOnlyList<WalletBetDto>> Handle(
        GetWalletBetsQuery request,
        CancellationToken cancellationToken) =>
        _walletReadRepository.ListBetsAsync(request.WalletId, cancellationToken);
}
