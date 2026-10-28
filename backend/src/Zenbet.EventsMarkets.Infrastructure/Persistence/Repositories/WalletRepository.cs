namespace Zenbet.EventsMarkets.Infrastructure.Persistence.Repositories;

using Microsoft.EntityFrameworkCore;
using Zenbet.EventsMarkets.Domain.Aggregates;
using Zenbet.EventsMarkets.Domain.Repositories;
using Zenbet.EventsMarkets.Domain.ValueObjects;
using Zenbet.EventsMarkets.Infrastructure.Persistence;

public sealed class WalletRepository : IWalletRepository
{
    private readonly EventsMarketsDbContext _dbContext;

    public WalletRepository(EventsMarketsDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<Wallet?> GetByIdAsync(WalletId id, CancellationToken cancellationToken = default)
    {
        return await _dbContext.Wallets
            .AsNoTracking()
            .FirstOrDefaultAsync(w => w.Id == id, cancellationToken);
    }

    public async Task<Wallet?> GetByIdForUpdateAsync(WalletId id, CancellationToken cancellationToken = default)
    {
        var rows = await _dbContext.Wallets
            .FromSqlInterpolated($"SELECT * FROM events_markets.wallets WHERE id = {id.Value} FOR UPDATE")
            .AsTracking()
            .ToListAsync(cancellationToken);

        return rows.Count == 0 ? null : rows[0];
    }

    public async Task<Wallet?> GetByUserIdAsync(UserId userId, CancellationToken cancellationToken = default)
    {
        return await _dbContext.Wallets
            .AsNoTracking()
            .FirstOrDefaultAsync(w => w.UserId == userId, cancellationToken);
    }

    public async Task AddAsync(Wallet wallet, CancellationToken cancellationToken = default)
    {
        await _dbContext.Wallets.AddAsync(wallet, cancellationToken);
    }

    public async Task UpdateAsync(Wallet wallet, uint expectedVersion, CancellationToken cancellationToken = default)
    {
        _dbContext.Entry(wallet).Property(w => w.Version).OriginalValue = expectedVersion;
        _dbContext.Wallets.Update(wallet);
        await Task.CompletedTask;
    }

    public async Task<bool> ExistsAsync(WalletId id, CancellationToken cancellationToken = default)
    {
        return await _dbContext.Wallets
            .AsNoTracking()
            .AnyAsync(w => w.Id == id, cancellationToken);
    }

    public async Task<bool> ExistsByUserIdAsync(UserId userId, CancellationToken cancellationToken = default)
    {
        return await _dbContext.Wallets
            .AsNoTracking()
            .AnyAsync(w => w.UserId == userId, cancellationToken);
    }
}