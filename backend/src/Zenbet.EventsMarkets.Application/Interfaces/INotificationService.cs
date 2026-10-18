namespace Zenbet.EventsMarkets.Application.Interfaces;

using Zenbet.EventsMarkets.Domain.ValueObjects;

public interface INotificationService
{
    Task NotifyOddsUpdateAsync(MarketId marketId, object oddsUpdate, CancellationToken cancellationToken = default);
    Task NotifyMarketSettledAsync(MarketId marketId, object settlementData, CancellationToken cancellationToken = default);
}