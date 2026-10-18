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
}