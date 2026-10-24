namespace Zenbet.EventsMarkets.Infrastructure.Persistence.Repositories;

using Microsoft.EntityFrameworkCore;
using Zenbet.EventsMarkets.Domain.Aggregates;
using Zenbet.EventsMarkets.Domain.Repositories;
using Zenbet.EventsMarkets.Domain.ValueObjects;
using Zenbet.EventsMarkets.Domain.Enums;
using Zenbet.EventsMarkets.Infrastructure.Persistence;

public sealed class MarketRepository : IMarketRepository
{
    private readonly EventsMarketsDbContext _dbContext;

    public MarketRepository(EventsMarketsDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<Market?> GetByIdAsync(MarketId id, CancellationToken cancellationToken = default)
    {
        return await _dbContext.Markets
            .AsNoTracking()
            .FirstOrDefaultAsync(m => m.Id == id, cancellationToken);
    }

    public async Task<Market?> GetByIdWithSelectionsAsync(MarketId id, CancellationToken cancellationToken = default)
    {
        return await _dbContext.Markets
            .Include(m => m.Selections)
            .FirstOrDefaultAsync(m => m.Id == id, cancellationToken);
    }

    public async Task<Market?> GetBySelectionIdAsync(
        SelectionId selectionId,
        CancellationToken cancellationToken = default)
    {
        var marketId = await _dbContext.Selections
            .AsNoTracking()
            .Where(selection => selection.Id == selectionId)
            .Select(selection => EF.Property<MarketId>(selection, "MarketId"))
            .FirstOrDefaultAsync(cancellationToken);

        if (marketId == default) return null;

        return await _dbContext.Markets
            .AsNoTracking()
            .FirstOrDefaultAsync(market => market.Id == marketId, cancellationToken);
    }

    public async Task AddAsync(Market market, CancellationToken cancellationToken = default)
    {
        await _dbContext.Markets.AddAsync(market, cancellationToken);
    }

    public async Task UpdateAsync(Market market, CancellationToken cancellationToken = default)
    {
        var tracked = _dbContext.Markets.Local.FirstOrDefault(m => m.Id == market.Id);
        if (tracked != null)
        {
            if (ReferenceEquals(tracked, market))
            {
                await Task.CompletedTask;
                return;
            }
            _dbContext.Entry(tracked).State = EntityState.Detached;
        }

        foreach (var selection in market.Selections)
        {
            var trackedSel = _dbContext.Selections.Local.FirstOrDefault(s => s.Id == selection.Id);
            if (trackedSel != null && !ReferenceEquals(trackedSel, selection))
            {
                _dbContext.Entry(trackedSel).State = EntityState.Detached;
            }
        }

        _dbContext.Markets.Update(market);
        await Task.CompletedTask;
    }

    public async Task<IReadOnlyList<Market>> GetByEventIdAsync(EventId eventId, CancellationToken cancellationToken = default)
    {
        return await _dbContext.Markets
            .AsNoTracking()
            .Where(m => m.EventId == eventId)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<Market>> GetOpenMarketsByEventIdAsync(EventId eventId, CancellationToken cancellationToken = default)
    {
        return await _dbContext.Markets
            .AsNoTracking()
            .Where(m => m.EventId == eventId && m.Status == MarketStatus.Open)
            .ToListAsync(cancellationToken);
    }
}
