namespace Zenbet.EventsMarkets.Infrastructure.Persistence.Repositories;

using Microsoft.EntityFrameworkCore;
using Zenbet.EventsMarkets.Domain.Aggregates;
using Zenbet.EventsMarkets.Domain.Repositories;
using Zenbet.EventsMarkets.Domain.ValueObjects;
using Zenbet.EventsMarkets.Infrastructure.Persistence;

public sealed class TransactionRepository : ITransactionRepository
{
    private readonly EventsMarketsDbContext _dbContext;

    public TransactionRepository(EventsMarketsDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<Transaction?> GetByIdAsync(TransactionId id, CancellationToken cancellationToken = default)
    {
        return await _dbContext.Transactions
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == id, cancellationToken);
    }

    public async Task<Transaction?> GetByIdForUpdateAsync(TransactionId id, CancellationToken cancellationToken = default)
    {
        var rows = await _dbContext.Transactions
            .FromSqlInterpolated($"SELECT * FROM events_markets.transactions WHERE id = {id.Value} FOR UPDATE")
            .AsTracking()
            .ToListAsync(cancellationToken);

        return rows.Count == 0 ? null : rows[0];
    }

    public async Task<Transaction?> GetByReferenceIdAsync(
        WalletId walletId,
        string referenceId,
        CancellationToken cancellationToken = default)
    {
        return await _dbContext.Transactions
            .AsNoTracking()
            .FirstOrDefaultAsync(
                transaction => transaction.WalletId == walletId
                    && transaction.ReferenceId == referenceId
                    && transaction.Type == Zenbet.EventsMarkets.Domain.Enums.TransactionType.BetPlacement,
                cancellationToken);
    }

    public async Task<IReadOnlyList<Transaction>> GetByWalletIdAsync(WalletId walletId, CancellationToken cancellationToken = default)
    {
        return await _dbContext.Transactions
            .AsNoTracking()
            .Where(t => t.WalletId == walletId)
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<Transaction>> GetByWalletIdAsync(WalletId walletId, DateTimeOffset fromDate, DateTimeOffset toDate, CancellationToken cancellationToken = default)
    {
        return await _dbContext.Transactions
            .AsNoTracking()
            .Where(t => t.WalletId == walletId && t.CreatedAt >= fromDate && t.CreatedAt <= toDate)
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync(cancellationToken);
    }

    public async Task AddAsync(Transaction transaction, CancellationToken cancellationToken = default)
    {
        await _dbContext.Transactions.AddAsync(transaction, cancellationToken);
    }

    public async Task UpdateAsync(Transaction transaction, CancellationToken cancellationToken = default)
    {
        _dbContext.Transactions.Update(transaction);
        await Task.CompletedTask;
    }
}