namespace Zenbet.EventsMarkets.Application.Interfaces;

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
    Task<bool> ExistsAsync(
        string key,
        string commandType,
        string payloadHash,
        CancellationToken cancellationToken = default);
    Task AddAsync(
        string key,
        string commandType,
        CancellationToken cancellationToken = default,
        string? payloadHash = null);
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
