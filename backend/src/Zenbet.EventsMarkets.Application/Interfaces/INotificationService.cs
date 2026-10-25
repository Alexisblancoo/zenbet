namespace Zenbet.EventsMarkets.Application.Interfaces;

using Zenbet.EventsMarkets.Domain.ValueObjects;

public interface INotificationService
{
    Task NotifyOddsUpdateAsync(MarketId marketId, object oddsUpdate, CancellationToken cancellationToken = default);
    Task NotifyMarketSettledAsync(MarketId marketId, object settlementData, CancellationToken cancellationToken = default);
    Task NotifyFightUpdateAsync(Guid eventId, object fightUpdate, CancellationToken cancellationToken = default);
    Task NotifyFightClockAsync(Guid eventId, object fightClock, CancellationToken cancellationToken = default);
    Task NotifyCardUpdateAsync(string cardKey, object cardUpdate, CancellationToken cancellationToken = default);
}