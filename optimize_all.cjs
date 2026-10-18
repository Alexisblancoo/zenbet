const fs = require('fs');
const path = require('path');

const basePath = path.join(__dirname, 'backend');

// 1. NpgsqlBulkOddsUpdater.cs with blazing-fast UNNEST
const updaterPath = path.join(basePath, 'src', 'Zenbet.EventsMarkets.Infrastructure', 'Persistence', 'Services', 'NpgsqlBulkOddsUpdater.cs');
const updaterContent = `namespace Zenbet.EventsMarkets.Infrastructure.Persistence.Services;

using System.Data;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using NpgsqlTypes;
using Npgsql.EntityFrameworkCore.PostgreSQL;
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

        var lockKey = eventId.Value.GetHashCode();
        var lockAcquired = await connection.ExecuteScalarAsync<bool>(
            "SELECT pg_try_advisory_lock($1)", lockKey);

        if (!lockAcquired)
        {
            throw new InvalidOperationException($"Could not acquire advisory lock for event {eventId}");
        }

        try
        {
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
                    RETURNING s.id, s.current_odds_value as old_value, t.odds_value as new_value, t.odds_timestamp, t.odds_provider,
                              (SELECT m.id FROM events_markets.markets m WHERE m.id = s.market_id) as market_id
                )
                SELECT * FROM updated;
            ";

            var domainEvents = new List<OddsChangedDomainEvent>();

            await using var cmd = new NpgsqlCommand(mergeSql, connection);
            cmd.Parameters.AddWithValue(ids);
            cmd.Parameters.AddWithValue(values);
            cmd.Parameters.AddWithValue(timestamps);
            cmd.Parameters.AddWithValue(providers);

            await using var reader = await cmd.ExecuteReaderAsync();

            while (await reader.ReadAsync())
            {
                var selectionId = SelectionId.From(reader.GetGuid(0));
                var marketId = MarketId.From(reader.GetGuid(5));
                var oldOdd = new Odd(reader.GetDecimal(1), reader.GetDateTime(3), reader.GetString(4));
                var newOdd = new Odd(reader.GetDecimal(2), reader.GetDateTime(3), reader.GetString(4));

                domainEvents.Add(new OddsChangedDomainEvent(marketId, selectionId, oldOdd, newOdd, reader.GetDateTime(3)));
            }

            return new BulkOddsUpdateResult(domainEvents.Count, domainEvents);
        }
        finally
        {
            await using var unlockCmd = new NpgsqlCommand("SELECT pg_advisory_unlock($1)", connection);
            unlockCmd.Parameters.AddWithValue(lockKey);
            await unlockCmd.ExecuteNonQueryAsync();
        }
    }
}

public static class NpgsqlConnectionExtensions
{
    public static async Task ExecuteAsync(this NpgsqlConnection connection, string sql, params object[] parameters)
    {
        await using var cmd = new NpgsqlCommand(sql, connection);
        foreach (var param in parameters)
        {
            cmd.Parameters.AddWithValue(param);
        }
        await cmd.ExecuteNonQueryAsync();
    }

    public static async Task<T> ExecuteScalarAsync<T>(this NpgsqlConnection connection, string sql, params object[] parameters)
    {
        await using var cmd = new NpgsqlCommand(sql, connection);
        foreach (var param in parameters)
        {
            cmd.Parameters.AddWithValue(param);
        }
        var result = await cmd.ExecuteScalarAsync();
        if (result is null or DBNull)
            return default!;
        return (T)Convert.ChangeType(result, typeof(T));
    }
}
`;
fs.writeFileSync(updaterPath, updaterContent, 'utf8');
console.log('Updated NpgsqlBulkOddsUpdater.cs with UNNEST');

// 2. MarketRepository.cs
const marketRepoPath = path.join(basePath, 'src', 'Zenbet.EventsMarkets.Infrastructure', 'Persistence', 'Repositories', 'MarketRepository.cs');
let marketRepoContent = fs.readFileSync(marketRepoPath, 'utf8');

marketRepoContent = marketRepoContent.replace(
    `    public async Task UpdateAsync(Market market, CancellationToken cancellationToken = default)
    {
        _dbContext.Markets.Update(market);
        await Task.CompletedTask;
    }`,
    `    public async Task UpdateAsync(Market market, CancellationToken cancellationToken = default)
    {
        var tracked = _dbContext.Markets.Local.FirstOrDefault(m => m.Id == market.Id);
        if (tracked != null && !ReferenceEquals(tracked, market))
        {
            _dbContext.Entry(tracked).State = EntityState.Detached;
        }
        _dbContext.Markets.Update(market);
        await Task.CompletedTask;
    }`
);
fs.writeFileSync(marketRepoPath, marketRepoContent, 'utf8');
console.log('Updated MarketRepository.cs with detached check');

// 3. SettleMarketCommandHandler.cs with advisory lock
const settleHandlerPath = path.join(basePath, 'src', 'Zenbet.EventsMarkets.Application', 'Commands', 'SettleMarket', 'SettleMarketCommandHandler.cs');
let settleHandlerContent = fs.readFileSync(settleHandlerPath, 'utf8');

const oldSettleCore = `        // 2. Load aggregate with selections (for domain validation)
        var marketToSettle = await _marketRepository.GetByIdWithSelectionsAsync(request.MarketId, cancellationToken)
            ?? throw new MarketNotFoundException(request.MarketId);

        // 3. Execute domain logic - this validates and emits domain events
        marketToSettle.Settle(request.WinnerSelectionId, request.Result, request.SettledBy);

        // 4. Persist everything in single transaction: aggregate + outbox + idempotency key + audit
        await _unitOfWork.BeginTransactionAsync(cancellationToken);

        try
        {
            // Save aggregate changes (selections settlement status)
            await _marketRepository.UpdateAsync(marketToSettle, cancellationToken);

            // Write domain events to outbox (atomic with aggregate changes)
            foreach (var domainEvent in marketToSettle.DomainEvents)
            {
                await _outboxWriter.WriteAsync(domainEvent, cancellationToken);
            }

            // Record idempotency key
            await _idempotencyService.AddAsync(request.IdempotencyKey.ToString(), nameof(SettleMarketCommand), cancellationToken);

            // Audit log for settlement (immutable record)
            await _settlementAuditService.AddAsync(new SettlementAuditRecord(
                Guid.NewGuid(),
                request.MarketId,
                request.WinnerSelectionId,
                request.Result,
                request.SettledBy,
                DateTimeOffset.UtcNow,
                request.IdempotencyKey.ToString()), cancellationToken);

            await _unitOfWork.CommitAsync(cancellationToken);

            marketToSettle.ClearDomainEvents();

            _logger.LogInformation("Market {MarketId} settled successfully with winner {WinnerSelectionId}, result {Result}",
                request.MarketId, request.WinnerSelectionId, request.Result);

            return new SettleMarketResult(
                request.MarketId,
                request.WinnerSelectionId,
                request.Result,
                DateTimeOffset.UtcNow);
        }
        catch (Exception)
        {
            await _unitOfWork.RollbackAsync(cancellationToken);
            throw;
        }`;

const newSettleCore = `        // 2. Acquire atomic advisory lock on MarketId for settlement
        var connectionString = ((Microsoft.EntityFrameworkCore.DbContext)_unitOfWork).Database.GetConnectionString()
            ?? throw new InvalidOperationException("Connection string not found");
        await using var lockConn = new Npgsql.NpgsqlConnection(connectionString);
        await lockConn.OpenAsync(cancellationToken);

        var lockKey = request.MarketId.Value.GetHashCode();
        await using var lockCmd = new Npgsql.NpgsqlCommand("SELECT pg_try_advisory_lock($1)", lockConn);
        lockCmd.Parameters.AddWithValue(lockKey);
        var lockAcquired = (bool)(await lockCmd.ExecuteScalarAsync(cancellationToken) ?? false);

        if (!lockAcquired)
        {
            throw new InvalidOperationException($"Market {request.MarketId} is already being settled");
        }

        try
        {
            // Re-check idempotency under lock
            if (await _idempotencyService.ExistsAsync(request.IdempotencyKey.ToString(), cancellationToken))
            {
                var cached = await _settlementAuditService.GetByIdempotencyKeyAsync(request.IdempotencyKey.ToString(), cancellationToken);
                if (cached is not null)
                {
                    return new SettleMarketResult(cached.MarketId, cached.WinnerSelectionId, cached.Result, cached.SettledAt);
                }
            }

            var marketToSettle = await _marketRepository.GetByIdWithSelectionsAsync(request.MarketId, cancellationToken)
                ?? throw new MarketNotFoundException(request.MarketId);

            marketToSettle.Settle(request.WinnerSelectionId, request.Result, request.SettledBy);

            await _unitOfWork.BeginTransactionAsync(cancellationToken);

            try
            {
                await _marketRepository.UpdateAsync(marketToSettle, cancellationToken);

                foreach (var domainEvent in marketToSettle.DomainEvents)
                {
                    await _outboxWriter.WriteAsync(domainEvent, cancellationToken);
                }

                await _idempotencyService.AddAsync(request.IdempotencyKey.ToString(), nameof(SettleMarketCommand), cancellationToken);

                await _settlementAuditService.AddAsync(new SettlementAuditRecord(
                    Guid.NewGuid(),
                    request.MarketId,
                    request.WinnerSelectionId,
                    request.Result,
                    request.SettledBy,
                    DateTimeOffset.UtcNow,
                    request.IdempotencyKey.ToString()), cancellationToken);

                await _unitOfWork.CommitAsync(cancellationToken);

                marketToSettle.ClearDomainEvents();

                _logger.LogInformation("Market {MarketId} settled successfully with winner {WinnerSelectionId}, result {Result}",
                    request.MarketId, request.WinnerSelectionId, request.Result);

                return new SettleMarketResult(
                    request.MarketId,
                    request.WinnerSelectionId,
                    request.Result,
                    DateTimeOffset.UtcNow);
            }
            catch (Exception)
            {
                await _unitOfWork.RollbackAsync(cancellationToken);
                throw;
            }
        }
        finally
        {
            await using var unlockCmd = new Npgsql.NpgsqlCommand("SELECT pg_advisory_unlock($1)", lockConn);
            unlockCmd.Parameters.AddWithValue(lockKey);
            await unlockCmd.ExecuteNonQueryAsync();
        }`;

if (settleHandlerContent.includes(oldSettleCore)) {
    settleHandlerContent = settleHandlerContent.replace(oldSettleCore, newSettleCore);
    fs.writeFileSync(settleHandlerPath, settleHandlerContent, 'utf8');
    console.log('Updated SettleMarketCommandHandler.cs with advisory lock');
} else {
    console.error('oldSettleCore not matched in SettleMarketCommandHandler.cs');
}

// 4. Clear ChangeTracker in SeedEventWithMarketAsync
const settleTestPath = path.join(basePath, 'tests', 'Zenbet.EventsMarkets.Application.Tests', 'Commands', 'SettleMarket', 'SettleMarketCommandHandlerConcurrencyTests.cs');
let settleTestContent = fs.readFileSync(settleTestPath, 'utf8');

settleTestContent = settleTestContent.replace(
    `        _dbContext.Events.Add(@event);
        await _dbContext.SaveChangesAsync();

        return (eventId, market.Id, selectionIds);`,
    `        _dbContext.Events.Add(@event);
        await _dbContext.SaveChangesAsync();
        _dbContext.ChangeTracker.Clear();

        return (eventId, market.Id, selectionIds);`
);
fs.writeFileSync(settleTestPath, settleTestContent, 'utf8');
console.log('Updated SettleMarketCommandHandlerConcurrencyTests.cs with ChangeTracker.Clear()');
