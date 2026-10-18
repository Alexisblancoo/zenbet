const fs = require('fs');
const path = require('path');

const basePath = path.join(__dirname, 'backend');

// 1. UnitOfWorkInterfaces.cs
const uowPath = path.join(basePath, 'src', 'Zenbet.EventsMarkets.Application', 'Interfaces', 'UnitOfWorkInterfaces.cs');
const uowContent = `namespace Zenbet.EventsMarkets.Application.Interfaces;

using Zenbet.EventsMarkets.Domain.ValueObjects;
using Zenbet.EventsMarkets.Domain.Enums;

public interface IUnitOfWork : IDisposable
{
    Task BeginTransactionAsync(CancellationToken cancellationToken = default);
    Task CommitAsync(CancellationToken cancellationToken = default);
    Task RollbackAsync(CancellationToken cancellationToken = default);
    Task SaveChangesAsync(CancellationToken cancellationToken = default);
    Task<bool> TryAcquireAdvisoryLockAsync(long lockKey, CancellationToken cancellationToken = default);
}

public interface IIdempotencyService
{
    Task<bool> ExistsAsync(string key, CancellationToken cancellationToken = default);
    Task AddAsync(string key, string commandType, CancellationToken cancellationToken = default);
}

public interface ISettlementAuditService
{
    Task<SettlementAuditRecord?> GetByIdempotencyKeyAsync(string key, CancellationToken cancellationToken = default);
    Task AddAsync(SettlementAuditRecord record, CancellationToken cancellationToken = default);
}

public sealed record SettlementAuditRecord(
    Guid Id,
    MarketId MarketId,
    SelectionId WinnerSelectionId,
    SettlementResult Result,
    string SettledBy,
    DateTimeOffset SettledAt,
    string IdempotencyKey);
`;
fs.writeFileSync(uowPath, uowContent, 'utf8');
console.log('1. Updated UnitOfWorkInterfaces.cs');

// 2. EfServices.cs
const efServicesPath = path.join(basePath, 'src', 'Zenbet.EventsMarkets.Infrastructure', 'Persistence', 'Services', 'EfServices.cs');
const efServicesContent = `namespace Zenbet.EventsMarkets.Infrastructure.Persistence.Services;

using System.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Zenbet.EventsMarkets.Application.Interfaces;
using Zenbet.EventsMarkets.Domain.ValueObjects;
using Zenbet.EventsMarkets.Domain.Enums;
using Zenbet.EventsMarkets.Infrastructure.Persistence;
using Zenbet.EventsMarkets.Infrastructure.Persistence.Outbox;

public sealed class EfUnitOfWork : IUnitOfWork
{
    private readonly EventsMarketsDbContext _dbContext;

    public EfUnitOfWork(EventsMarketsDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task BeginTransactionAsync(CancellationToken cancellationToken = default)
    {
        await _dbContext.Database.BeginTransactionAsync(cancellationToken);
    }

    public async Task CommitAsync(CancellationToken cancellationToken = default)
    {
        await _dbContext.Database.CommitTransactionAsync(cancellationToken);
        _dbContext.ChangeTracker.Clear();
    }

    public async Task RollbackAsync(CancellationToken cancellationToken = default)
    {
        await _dbContext.Database.RollbackTransactionAsync(cancellationToken);
        _dbContext.ChangeTracker.Clear();
    }

    public async Task SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        await _dbContext.SaveChangesAsync(cancellationToken);
        _dbContext.ChangeTracker.Clear();
    }

    public async Task<bool> TryAcquireAdvisoryLockAsync(long lockKey, CancellationToken cancellationToken = default)
    {
        var connection = _dbContext.Database.GetDbConnection();
        if (connection.State != ConnectionState.Open)
        {
            await connection.OpenAsync(cancellationToken);
        }

        await using var cmd = connection.CreateCommand();
        cmd.Transaction = _dbContext.Database.CurrentTransaction?.GetDbTransaction();
        cmd.CommandText = "SELECT pg_try_advisory_xact_lock(@key)";
        var param = cmd.CreateParameter();
        param.ParameterName = "@key";
        param.Value = lockKey;
        cmd.Parameters.Add(param);

        var result = await cmd.ExecuteScalarAsync(cancellationToken);
        return result is true || (result is bool b && b);
    }

    public void Dispose()
    {
        _dbContext.Dispose();
    }
}

public sealed class EfIdempotencyService : IIdempotencyService
{
    private readonly EventsMarketsDbContext _dbContext;

    public EfIdempotencyService(EventsMarketsDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<bool> ExistsAsync(string key, CancellationToken cancellationToken = default)
    {
        return await _dbContext.IdempotencyKeys
            .AnyAsync(k => k.Key == key, cancellationToken);
    }

    public async Task AddAsync(string key, string commandType, CancellationToken cancellationToken = default)
    {
        _dbContext.IdempotencyKeys.Add(new IdempotencyKey
        {
            Key = key,
            CommandType = commandType,
            CreatedAt = DateTimeOffset.UtcNow,
            ExpiresAt = DateTimeOffset.UtcNow.AddDays(7)
        });
        await _dbContext.SaveChangesAsync(cancellationToken);
    }
}

public sealed class EfSettlementAuditService : ISettlementAuditService
{
    private readonly EventsMarketsDbContext _dbContext;

    public EfSettlementAuditService(EventsMarketsDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<SettlementAuditRecord?> GetByIdempotencyKeyAsync(string key, CancellationToken cancellationToken = default)
    {
        return await _dbContext.SettlementAudit
            .Where(a => a.IdempotencyKey == key)
            .Select(a => new SettlementAuditRecord(
                a.Id,
                a.MarketId,
                a.WinnerSelectionId,
                a.Result,
                a.SettledBy,
                a.SettledAt,
                a.IdempotencyKey))
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task AddAsync(SettlementAuditRecord record, CancellationToken cancellationToken = default)
    {
        _dbContext.SettlementAudit.Add(new SettlementAuditEntry
        {
            Id = record.Id,
            MarketId = record.MarketId,
            WinnerSelectionId = record.WinnerSelectionId,
            Result = record.Result,
            SettledBy = record.SettledBy,
            SettledAt = record.SettledAt,
            IdempotencyKey = record.IdempotencyKey
        });
        await _dbContext.SaveChangesAsync(cancellationToken);
    }
}
`;
fs.writeFileSync(efServicesPath, efServicesContent, 'utf8');
console.log('2. Updated EfServices.cs');

// 3. SettleMarketCommandHandler.cs
const settleHandlerPath = path.join(basePath, 'src', 'Zenbet.EventsMarkets.Application', 'Commands', 'SettleMarket', 'SettleMarketCommandHandler.cs');
const settleHandlerContent = `namespace Zenbet.EventsMarkets.Application.Commands.SettleMarket;

using MediatR;
using Microsoft.Extensions.Logging;
using Zenbet.EventsMarkets.Application.Interfaces;
using Zenbet.EventsMarkets.Domain.Aggregates;
using Zenbet.EventsMarkets.Domain.Events;
using Zenbet.EventsMarkets.Domain.Repositories;
using Zenbet.EventsMarkets.Domain.ValueObjects;
using Zenbet.EventsMarkets.Domain.Exceptions;

public sealed class SettleMarketCommandHandler : IRequestHandler<SettleMarketCommand, SettleMarketResult>
{
    private readonly IMarketRepository _marketRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IOutboxWriter _outboxWriter;
    private readonly IIdempotencyService _idempotencyService;
    private readonly ISettlementAuditService _settlementAuditService;
    private readonly ILogger<SettleMarketCommandHandler> _logger;

    public SettleMarketCommandHandler(
        IMarketRepository marketRepository,
        IUnitOfWork unitOfWork,
        IOutboxWriter outboxWriter,
        IIdempotencyService idempotencyService,
        ISettlementAuditService settlementAuditService,
        ILogger<SettleMarketCommandHandler> logger)
    {
        _marketRepository = marketRepository;
        _unitOfWork = unitOfWork;
        _outboxWriter = outboxWriter;
        _idempotencyService = idempotencyService;
        _settlementAuditService = settlementAuditService;
        _logger = logger;
    }

    public async Task<SettleMarketResult> Handle(SettleMarketCommand request, CancellationToken cancellationToken)
    {
        // 1. Check idempotency first - fast path without loading aggregate
        var idempotencyExists = await _idempotencyService.ExistsAsync(request.IdempotencyKey.ToString(), cancellationToken);

        if (idempotencyExists)
        {
            _logger.LogInformation("Idempotent settlement request detected for key {Key}, returning existing result",
                request.IdempotencyKey);

            var cached = await _settlementAuditService.GetByIdempotencyKeyAsync(request.IdempotencyKey.ToString(), cancellationToken);

            if (cached is not null)
            {
                return new SettleMarketResult(
                    cached.MarketId,
                    cached.WinnerSelectionId,
                    cached.Result,
                    cached.SettledAt);
            }

            var market = await _marketRepository.GetByIdWithSelectionsAsync(request.MarketId, cancellationToken)
                ?? throw new MarketNotFoundException(request.MarketId);

            return new SettleMarketResult(
                market.Id,
                market.WinnerSelectionId!.Value,
                market.MarketSettlementResult!.Value,
                market.DomainEvents.OfType<MarketSettledDomainEvent>().FirstOrDefault()?.SettledAt ?? DateTimeOffset.UtcNow);
        }

        // 2. Start transaction and acquire advisory lock on MarketId
        await _unitOfWork.BeginTransactionAsync(cancellationToken);

        try
        {
            var lockKey = BitConverter.ToInt64(request.MarketId.Value.ToByteArray(), 0);
            var lockAcquired = await _unitOfWork.TryAcquireAdvisoryLockAsync(lockKey, cancellationToken);
            if (!lockAcquired)
            {
                throw new InvalidOperationException($"Market {request.MarketId} is already being settled");
            }

            // Re-check idempotency under lock
            if (await _idempotencyService.ExistsAsync(request.IdempotencyKey.ToString(), cancellationToken))
            {
                var cached = await _settlementAuditService.GetByIdempotencyKeyAsync(request.IdempotencyKey.ToString(), cancellationToken);
                if (cached is not null)
                {
                    await _unitOfWork.CommitAsync(cancellationToken);
                    return new SettleMarketResult(cached.MarketId, cached.WinnerSelectionId, cached.Result, cached.SettledAt);
                }
            }

            // 3. Load aggregate with selections
            var marketToSettle = await _marketRepository.GetByIdWithSelectionsAsync(request.MarketId, cancellationToken)
                ?? throw new MarketNotFoundException(request.MarketId);

            // 4. Execute domain logic - validates status is Open, etc.
            marketToSettle.Settle(request.WinnerSelectionId, request.Result, request.SettledBy);

            // 5. Persist aggregate changes
            await _marketRepository.UpdateAsync(marketToSettle, cancellationToken);

            // 6. Write domain events to outbox
            foreach (var domainEvent in marketToSettle.DomainEvents)
            {
                await _outboxWriter.WriteAsync(domainEvent, cancellationToken);
            }

            // 7. Record idempotency key
            await _idempotencyService.AddAsync(request.IdempotencyKey.ToString(), nameof(SettleMarketCommand), cancellationToken);

            // 8. Audit log for settlement
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
        catch
        {
            await _unitOfWork.RollbackAsync(cancellationToken);
            throw;
        }
    }
}
`;
fs.writeFileSync(settleHandlerPath, settleHandlerContent, 'utf8');
console.log('3. Updated SettleMarketCommandHandler.cs');

// 4. MarketRepository.cs
const marketRepoPath = path.join(basePath, 'src', 'Zenbet.EventsMarkets.Infrastructure', 'Persistence', 'Repositories', 'MarketRepository.cs');
const marketRepoContent = `namespace Zenbet.EventsMarkets.Infrastructure.Persistence.Repositories;

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
`;
fs.writeFileSync(marketRepoPath, marketRepoContent, 'utf8');
console.log('4. Updated MarketRepository.cs');

// 5. NpgsqlBulkOddsUpdater.cs
const updaterPath = path.join(basePath, 'src', 'Zenbet.EventsMarkets.Infrastructure', 'Persistence', 'Services', 'NpgsqlBulkOddsUpdater.cs');
const updaterContent = `namespace Zenbet.EventsMarkets.Infrastructure.Persistence.Services;

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
`;
fs.writeFileSync(updaterPath, updaterContent, 'utf8');
console.log('5. Updated NpgsqlBulkOddsUpdater.cs');

// 6. SettleMarketCommandHandlerConcurrencyTests.cs
const settleTestPath = path.join(basePath, 'tests', 'Zenbet.EventsMarkets.Application.Tests', 'Commands', 'SettleMarket', 'SettleMarketCommandHandlerConcurrencyTests.cs');
let settleTestContent = fs.readFileSync(settleTestPath, 'utf8');

if (!settleTestContent.includes('_dbContext.ChangeTracker.Clear();')) {
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
    console.log('6. Updated SettleMarketCommandHandlerConcurrencyTests.cs');
} else {
    console.log('6. SettleMarketCommandHandlerConcurrencyTests.cs already has ChangeTracker.Clear()');
}

console.log('ALL FIXES APPLIED SUCCESSFULLY!');
