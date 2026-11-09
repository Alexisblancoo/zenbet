namespace Zenbet.EventsMarkets.Infrastructure.Persistence.Repositories;

using Microsoft.EntityFrameworkCore;
using Zenbet.EventsMarkets.Application.Interfaces;
using Zenbet.EventsMarkets.Domain.Enums;

public sealed class PendingPricingReader : IPendingPricingReader
{
    private readonly EventsMarketsDbContext _db;

    public PendingPricingReader(EventsMarketsDbContext db) => _db = db;

    public async Task<IReadOnlyList<PendingPricingMarketView>> ListAsync(int take, CancellationToken cancellationToken = default)
    {
        var now = DateTimeOffset.UtcNow;
        var rows = await (
                from market in _db.Markets.AsNoTracking().Include(m => m.Selections)
                join ev in _db.Events.AsNoTracking() on market.EventId equals ev.Id
                where market.Provenance != null
                      && market.Provenance.Kind == OddsSourceKind.Pending
                      && market.Status == MarketStatus.Open
                      && ev.StartTime > now
                orderby ev.StartTime, ev.Name, market.DisplayOrder
                select new { market, ev.Id, ev.Name, ev.StartTime })
            .Take(Math.Clamp(take, 1, 500))
            .ToListAsync(cancellationToken);

        return rows
            .Select(r => new PendingPricingMarketView(
                r.Id.Value,
                r.Name,
                r.StartTime,
                r.market.Id.Value,
                r.market.Type.ToString(),
                r.market.Name,
                r.market.Line,
                r.market.Selections.OrderBy(s => s.DisplayOrder)
                    .Select(s => new PendingPricingSelectionView(s.Id.Value, s.Code, s.Name)).ToList()))
            .ToList();
    }
}
