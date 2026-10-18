namespace Zenbet.EventsMarkets.Infrastructure.Persistence.Repositories;

using Microsoft.EntityFrameworkCore;
using Npgsql;
using Npgsql.EntityFrameworkCore.PostgreSQL;
using Zenbet.EventsMarkets.Domain.Aggregates;
using Zenbet.EventsMarkets.Domain.Repositories;
using Zenbet.EventsMarkets.Domain.ValueObjects;
using Zenbet.EventsMarkets.Infrastructure.Persistence;

public sealed class SelectionRepository : ISelectionRepository
{
    private readonly EventsMarketsDbContext _dbContext;

    public SelectionRepository(EventsMarketsDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<Selection?> GetByIdAsync(SelectionId id, CancellationToken cancellationToken = default)
    {
        return await _dbContext.Selections
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == id, cancellationToken);
    }

    public async Task AddAsync(Selection selection, CancellationToken cancellationToken = default)
    {
        await _dbContext.Selections.AddAsync(selection, cancellationToken);
    }

    public async Task UpdateAsync(Selection selection, CancellationToken cancellationToken = default)
    {
        _dbContext.Selections.Update(selection);
        await Task.CompletedTask;
    }

    public async Task<IReadOnlyList<Selection>> GetByMarketIdAsync(MarketId marketId, CancellationToken cancellationToken = default)
    {
        return await _dbContext.Selections
            .AsNoTracking()
            .Where(s => EF.Property<MarketId>(s, "MarketId") == marketId)
            .ToListAsync(cancellationToken);
    }

    public async Task BulkUpdateOddsAsync(IReadOnlyList<(SelectionId Id, Odd NewOdd)> updates, CancellationToken cancellationToken = default)
    {
        if (updates.Count == 0) return;

        // Use raw SQL with COPY for maximum performance
        var connection = (NpgsqlConnection)_dbContext.Database.GetDbConnection();
        await connection.OpenAsync(cancellationToken);

        try
        {
            await using var binaryCopy = connection.BeginBinaryImport(
                @"COPY events_markets.selections (id, current_odds_value, current_odds_timestamp, current_odds_provider) 
                  FROM STDIN (FORMAT BINARY)");

            foreach (var (id, odd) in updates)
            {
                await binaryCopy.StartRowAsync(cancellationToken);
                await binaryCopy.WriteAsync(id.Value, cancellationToken);
                await binaryCopy.WriteAsync(odd.Value, cancellationToken);
                await binaryCopy.WriteAsync(odd.Timestamp, cancellationToken);
                await binaryCopy.WriteAsync(odd.Provider, cancellationToken);
            }

            await binaryCopy.CompleteAsync(cancellationToken);
        }
        finally
        {
            await connection.CloseAsync();
        }

        // Now merge from temp table (this is handled by the handler using a staging table)
        // The actual MERGE/UPDATE FROM is done in the command handler
    }
}