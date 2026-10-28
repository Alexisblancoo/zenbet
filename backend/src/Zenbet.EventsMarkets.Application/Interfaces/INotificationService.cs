namespace Zenbet.EventsMarkets.Application.Interfaces;

using Zenbet.EventsMarkets.Domain.ValueObjects;

public interface INotificationService
{
    Task NotifyOddsUpdateAsync(MarketId marketId, object oddsUpdate, CancellationToken cancellationToken = default);
    Task NotifyMarketSettledAsync(MarketId marketId, object settlementData, CancellationToken cancellationToken = default);
    Task NotifyFightUpdateAsync(Guid eventId, object fightUpdate, CancellationToken cancellationToken = default);
    Task NotifyFightClockAsync(Guid eventId, object fightClock, CancellationToken cancellationToken = default);
    Task NotifyCardUpdateAsync(string cardKey, object cardUpdate, CancellationToken cancellationToken = default);

    /// <summary>
    /// Empuja el nuevo saldo al jugador dueño de la billetera por el canal
    /// privado de wallet (evento <c>SaldoActualizado</c> del hub
    /// <c>/wallet-hub</c>). Lo consumen depósitos acreditados, retiros y
    /// liquidaciones que muevan saldo.
    /// </summary>
    Task NotifyWalletBalanceUpdatedAsync(
        Guid walletId,
        Guid userId,
        decimal amount,
        decimal newBalance,
        Guid transactionId,
        CancellationToken cancellationToken = default);

    Task NotifyFootballScoreUpdateAsync(
        string matchId,
        int homeScore,
        int awayScore,
        int minute,
        string period,
        CancellationToken cancellationToken = default);

    Task NotifyFootballOddsUpdateAsync(
        string matchId,
        string marketId,
        string selectionId,
        decimal odds,
        string? trend,
        CancellationToken cancellationToken = default);
}