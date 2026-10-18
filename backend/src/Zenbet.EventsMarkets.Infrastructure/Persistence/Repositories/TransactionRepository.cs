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