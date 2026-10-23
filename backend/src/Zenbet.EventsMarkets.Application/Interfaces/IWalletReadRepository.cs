namespace Zenbet.EventsMarkets.Application.Interfaces;

using Zenbet.EventsMarkets.Application.DTOs;

/// <summary>
/// Puerto de lectura del historial de billetera. Las consultas se resuelven en
/// infraestructura con proyecciones y no alteran el agregado <c>Wallet</c>.
/// </summary>
public interface IWalletReadRepository
{
    Task<decimal?> GetBalanceAsync(Guid walletId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<WalletBetDto>> ListBetsAsync(
        Guid walletId,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<WalletTransactionDto>> ListTransactionsAsync(
        Guid walletId,
        CancellationToken cancellationToken = default);
}
