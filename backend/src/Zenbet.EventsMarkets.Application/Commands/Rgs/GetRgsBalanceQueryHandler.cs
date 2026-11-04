namespace Zenbet.EventsMarkets.Application.Commands.Rgs;

using MediatR;
using Zenbet.EventsMarkets.Domain.Repositories;

public sealed class GetRgsBalanceQueryHandler : IRequestHandler<GetRgsBalanceQuery, RgsWalletResult>
{
    private readonly IWalletRepository _walletRepository;

    public GetRgsBalanceQueryHandler(IWalletRepository walletRepository)
    {
        _walletRepository = walletRepository;
    }

    public async Task<RgsWalletResult> Handle(GetRgsBalanceQuery request, CancellationToken cancellationToken)
    {
        var wallet = await _walletRepository.GetByIdAsync(request.WalletId, cancellationToken);
        if (wallet is null)
        {
            return new RgsWalletResult(
                Success: false,
                WalletId: request.WalletId,
                TotalBalance: 0m,
                RealAvailable: 0m,
                BonusAvailable: 0m,
                RealComponent: 0m,
                BonusComponent: 0m,
                PlatformTransactionId: null,
                ProviderTransactionId: string.Empty,
                ErrorCode: "WALLET_NOT_FOUND",
                ErrorMessage: $"La billetera {request.WalletId} no existe.");
        }

        var totalAvailable = wallet.RealAvailable.Amount + wallet.BonusAvailable.Amount;

        return new RgsWalletResult(
            Success: true,
            WalletId: wallet.Id,
            TotalBalance: totalAvailable,
            RealAvailable: wallet.RealAvailable.Amount,
            BonusAvailable: wallet.BonusAvailable.Amount,
            RealComponent: 0m,
            BonusComponent: 0m,
            PlatformTransactionId: null,
            ProviderTransactionId: string.Empty);
    }
}

