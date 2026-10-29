namespace Zenbet.EventsMarkets.Infrastructure.Persistence.Services;

using Microsoft.EntityFrameworkCore;
using Zenbet.EventsMarkets.Application.Interfaces;
using Zenbet.EventsMarkets.Domain.ValueObjects;
using Zenbet.EventsMarkets.Domain.Enums;
using Zenbet.EventsMarkets.Domain.Exceptions;
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
        // The transaction-scoped lock is released by commit or rollback.
        // Interpolated SQL is parameterized by EF Core.
        await _dbContext.Database.ExecuteSqlAsync(
            $"SELECT pg_advisory_xact_lock({lockKey});",
            cancellationToken);
        return true;
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

    public async Task<bool> ExistsAsync(
        string key,
        string commandType,
        string payloadHash,
        CancellationToken cancellationToken = default)
    {
        var existing = await _dbContext.IdempotencyKeys
            .AsNoTracking()
            .SingleOrDefaultAsync(k => k.Key == key, cancellationToken);

        if (existing is null)
        {
            return false;
        }

        if (!string.Equals(existing.CommandType, commandType, StringComparison.Ordinal) ||
            existing.PayloadHash is null ||
            !string.Equals(existing.PayloadHash, payloadHash, StringComparison.OrdinalIgnoreCase))
        {
            throw new IdempotencyConflictException();
        }

        return true;
    }

    public async Task AddAsync(
        string key,
        string commandType,
        CancellationToken cancellationToken = default,
        string? payloadHash = null)
    {
        _dbContext.IdempotencyKeys.Add(new IdempotencyKey
        {
            Key = key,
            CommandType = commandType,
            PayloadHash = payloadHash,
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
