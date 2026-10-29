namespace Zenbet.EventsMarkets.Infrastructure.Messaging;

using Zenbet.EventsMarkets.Application.Interfaces;
using Zenbet.EventsMarkets.Domain.ValueObjects;

public sealed class NoOpNotificationService : INotificationService
{
    public Task NotifyOddsUpdateAsync(MarketId marketId, object oddsUpdate, CancellationToken cancellationToken = default)
    {
        return Task.CompletedTask;
    }

    public Task NotifyMarketSettledAsync(MarketId marketId, object settlementData, CancellationToken cancellationToken = default)
    {
        return Task.CompletedTask;
    }

    public Task NotifyFightUpdateAsync(Guid eventId, object fightUpdate, CancellationToken cancellationToken = default)
    {
        return Task.CompletedTask;
    }

    public Task NotifyFightClockAsync(Guid eventId, object fightClock, CancellationToken cancellationToken = default)
    {
        return Task.CompletedTask;
    }

    public Task NotifyCardUpdateAsync(string cardKey, object cardUpdate, CancellationToken cancellationToken = default)
    {
        return Task.CompletedTask;
    }

    public Task NotifyWalletBalanceUpdatedAsync(
        Guid walletId,
        Guid userId,
        decimal amount,
        decimal newBalance,
        Guid transactionId,
        CancellationToken cancellationToken = default)
    {
        return Task.CompletedTask;
    }

    public Task NotifyBetOutcomeSettledAsync(
        Guid walletId,
        Guid userId,
        Guid betTransactionId,
        Guid marketId,
        string outcome,
        decimal payout,
        decimal newBalance,
        CancellationToken cancellationToken = default) => Task.CompletedTask;

    public Task NotifyFootballScoreUpdateAsync(
        string matchId,
        int homeScore,
        int awayScore,
        int minute,
        string period,
        CancellationToken cancellationToken = default)
    {
        return Task.CompletedTask;
    }

    public Task NotifyFootballOddsUpdateAsync(
        string matchId,
        string marketId,
        string selectionId,
        decimal odds,
        string? trend,
        CancellationToken cancellationToken = default)
    {
        return Task.CompletedTask;
    }
}
