namespace Zenbet.EventsMarkets.Infrastructure.Persistence.Repositories;

using Microsoft.EntityFrameworkCore;
using Zenbet.EventsMarkets.Domain.Aggregates;
using Zenbet.EventsMarkets.Domain.Enums;
using Zenbet.EventsMarkets.Domain.Repositories;
using Zenbet.EventsMarkets.Infrastructure.Persistence;

public sealed class PromotionRepository : IPromotionRepository
{
    private readonly EventsMarketsDbContext _dbContext;

    public PromotionRepository(EventsMarketsDbContext dbContext) => _dbContext = dbContext;

    public async Task<IReadOnlyList<Promotion>> ListAsync(
        PromotionTier? tier,
        CancellationToken cancellationToken = default)
    {
        var query = _dbContext.Promotions.AsNoTracking();
        if (tier.HasValue)
            query = query.Where(promotion => promotion.Tier == tier.Value);

        return await query
            .OrderBy(promotion => promotion.Tier)
            .ThenBy(promotion => promotion.Name)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<FightingEvent>> ListUpcomingEventsAsync(
        DateTimeOffset from,
        DateTimeOffset to,
        CancellationToken cancellationToken = default) =>
        await _dbContext.FightingEvents
            .AsNoTracking()
            .Include(fightingEvent => fightingEvent.Promotion)
            .Where(fightingEvent => fightingEvent.StartTime >= from && fightingEvent.StartTime < to)
            .OrderBy(fightingEvent => fightingEvent.StartTime)
            .ThenBy(fightingEvent => fightingEvent.Name)
            .ToListAsync(cancellationToken);
}
