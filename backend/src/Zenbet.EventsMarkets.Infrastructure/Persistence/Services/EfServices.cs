namespace Zenbet.EventsMarkets.Infrastructure.Persistence.Services;

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
