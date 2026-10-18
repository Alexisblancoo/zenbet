namespace Zenbet.EventsMarkets.Infrastructure.Persistence.Services;

using System.Data;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using NpgsqlTypes;
using Zenbet.EventsMarkets.Application.Commands.UpdateOdds;
using Zenbet.EventsMarkets.Application.Interfaces;
using Zenbet.EventsMarkets.Domain.Events;
using Zenbet.EventsMarkets.Domain.ValueObjects;
using Zenbet.EventsMarkets.Infrastructure.Persistence;

public sealed class NpgsqlBulkOddsUpdater : IBulkOddsUpdater
{
    private readonly EventsMarketsDbContext _dbContext;

    public NpgsqlBulkOddsUpdater(EventsMarketsDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<BulkOddsUpdateResult> BulkUpsertAsync(EventId eventId, IReadOnlyList<OddsUpdateItem> updates)
    {
        if (updates.Count == 0)
            return new BulkOddsUpdateResult(0, Array.Empty<OddsChangedDomainEvent>());

        var connectionString = _dbContext.Database.GetConnectionString()
            ?? throw new InvalidOperationException("Connection string not found");
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync();

        await using var transaction = await connection.BeginTransactionAsync();

        if (eventId != EventId.Empty)
        {
            var lockKey = BitConverter.ToInt64(eventId.Value.ToByteArray(), 0);
            await using var lockCmd = new NpgsqlCommand("SELECT pg_advisory_xact_lock($1)", connection, transaction);
            lockCmd.Parameters.AddWithValue(lockKey);
            await lockCmd.ExecuteNonQueryAsync();
        }

        var ids = updates.Select(u => u.SelectionId.Value).ToArray();
        var values = updates.Select(u => u.Value).ToArray();
        var timestamps = updates.Select(u => u.Timestamp).ToArray();
        var providers = updates.Select(u => u.Provider).ToArray();

        var mergeSql = @"
            WITH raw_data AS (
                SELECT * FROM UNNEST($1::uuid[], $2::numeric[], $3::timestamptz[], $4::text[])
                AS t(selection_id, odds_value, odds_timestamp, odds_provider)
            ),
            latest_odds AS (
                SELECT DISTINCT ON (selection_id)
                    selection_id, odds_value, odds_timestamp, odds_provider
                FROM raw_data
                ORDER BY selection_id, odds_timestamp DESC
            ),
            updated AS (
                UPDATE events_markets.selections s
                SET 
                    current_odds_value = t.odds_value,
                    current_odds_timestamp = t.odds_timestamp,
                    current_odds_provider = t.odds_provider
                FROM latest_odds t
                WHERE s.id = t.selection_id
                  AND (s.current_odds_timestamp IS NULL OR t.odds_timestamp >= s.current_odds_timestamp)
                RETURNING s.id, s.current_odds_value as old_value, t.odds_value as new_value, t.odds_timestamp, t.odds_provider, s.market_id
            )
            SELECT * FROM updated;
        ";

        var domainEvents = new List<OddsChangedDomainEvent>();

        await using var cmd = new NpgsqlCommand(mergeSql, connection, transaction);
        cmd.Parameters.AddWithValue(ids);
        cmd.Parameters.AddWithValue(values);
        cmd.Parameters.AddWithValue(timestamps);
        cmd.Parameters.AddWithValue(providers);

        await using (var reader = await cmd.ExecuteReaderAsync())
        {
            while (await reader.ReadAsync())
            {
                var selectionId = SelectionId.From(reader.GetGuid(0));
                var marketId = MarketId.From(reader.GetGuid(5));
                var oldOdd = new Odd(reader.GetDecimal(1), reader.GetDateTime(3), reader.GetString(4));
                var newOdd = new Odd(reader.GetDecimal(2), reader.GetDateTime(3), reader.GetString(4));

                domainEvents.Add(new OddsChangedDomainEvent(marketId, selectionId, oldOdd, newOdd, reader.GetDateTime(3)));
            }
        }

        await transaction.CommitAsync();

        return new BulkOddsUpdateResult(domainEvents.Count, domainEvents);
    }
}
