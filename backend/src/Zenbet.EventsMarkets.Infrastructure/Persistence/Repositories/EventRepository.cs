namespace Zenbet.EventsMarkets.Infrastructure.Persistence.Repositories;

using Microsoft.EntityFrameworkCore;
using Zenbet.EventsMarkets.Domain.Aggregates;
using Zenbet.EventsMarkets.Domain.Repositories;
using Zenbet.EventsMarkets.Domain.ValueObjects;
using Zenbet.EventsMarkets.Domain.Enums;
using Zenbet.EventsMarkets.Infrastructure.Persistence;

public sealed class EventRepository : IEventRepository
{
    private readonly EventsMarketsDbContext _dbContext;

    public EventRepository(EventsMarketsDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<Event?> GetByIdAsync(EventId id, CancellationToken cancellationToken = default)
    {
        return await _dbContext.Events
            .AsNoTracking()
            .FirstOrDefaultAsync(e => e.Id == id, cancellationToken);
    }

    public async Task<Event?> GetByIdWithMarketsAsync(EventId id, CancellationToken cancellationToken = default)
    {
        return await _dbContext.Events
            .Include(e => e.Markets)
            .AsNoTracking()
            .FirstOrDefaultAsync(e => e.Id == id, cancellationToken);
    }

    public async Task AddAsync(Event @event, CancellationToken cancellationToken = default)
    {
        await _dbContext.Events.AddAsync(@event, cancellationToken);
    }

    public async Task UpdateAsync(Event @event, uint expectedVersion, CancellationToken cancellationToken = default)
    {
        _dbContext.Entry(@event).Property(e => e.Version).OriginalValue = expectedVersion;
        _dbContext.Events.Update(@event);
        await Task.CompletedTask;
    }

    public async Task<bool> ExistsAsync(EventId id, CancellationToken cancellationToken = default)
    {
        return await _dbContext.Events
            .AsNoTracking()
            .AnyAsync(e => e.Id == id, cancellationToken);
    }

    public async Task<IReadOnlyList<Event>> ListAsync(
        EventStatus? status = null,
        SportType? sportType = null,
        DateTimeOffset? fromDate = null,
        DateTimeOffset? toDate = null,
        int page = 1,
        int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        var query = _dbContext.Events.AsNoTracking();

        if (status.HasValue)
            query = query.Where(e => e.Status == status.Value);

        if (sportType.HasValue)
            query = query.Where(e => e.SportType == sportType.Value);

        if (fromDate.HasValue)
            query = query.Where(e => e.StartTime >= fromDate.Value);

        if (toDate.HasValue)
            query = query.Where(e => e.StartTime <= toDate.Value);

        return await query
            .OrderByDescending(e => e.StartTime)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);
    }
}