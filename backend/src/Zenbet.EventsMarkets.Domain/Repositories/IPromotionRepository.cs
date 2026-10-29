namespace Zenbet.EventsMarkets.Domain.Repositories;

using Zenbet.EventsMarkets.Domain.Aggregates;
using Zenbet.EventsMarkets.Domain.Enums;

public interface IPromotionRepository
{
    Task<IReadOnlyList<Promotion>> ListAsync(PromotionTier? tier, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<FightingEvent>> ListUpcomingEventsAsync(
        DateTimeOffset from,
        DateTimeOffset to,
        CancellationToken cancellationToken = default);
}
