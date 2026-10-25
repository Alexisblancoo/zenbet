namespace Zenbet.EventsMarkets.Domain.Repositories;

using Zenbet.EventsMarkets.Domain.Aggregates;
using Zenbet.EventsMarkets.Domain.ValueObjects;
using Zenbet.EventsMarkets.Domain.Enums;

public interface IEventRepository
{
    Task<Event?> GetByIdAsync(EventId id, CancellationToken cancellationToken = default);
    Task<Event?> GetByIdWithMarketsAsync(EventId id, CancellationToken cancellationToken = default);
    Task<Event?> GetByIdWithDetailsAsync(EventId id, CancellationToken cancellationToken = default);
    Task AddAsync(Event @event, CancellationToken cancellationToken = default);
    Task UpdateAsync(Event @event, uint expectedVersion, CancellationToken cancellationToken = default);
    Task<bool> ExistsAsync(EventId id, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Event>> ListAsync(
        EventStatus? status = null,
        SportType? sportType = null,
        DateTimeOffset? fromDate = null,
        DateTimeOffset? toDate = null,
        int page = 1,
        int pageSize = 50,
        CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Event>> ListWithDetailsAsync(
        EventStatus? status,
        SportType? sportType,
        DateTimeOffset? fromDate,
        DateTimeOffset? toDate,
        string? competition,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Event>> ListForLiveWindowAsync(
        DateTimeOffset fromDate,
        DateTimeOffset toDate,
        int limit = 200,
        CancellationToken cancellationToken = default);
    Task<int> CountAsync(
        EventStatus? status,
        SportType? sportType,
        DateTimeOffset? fromDate,
        DateTimeOffset? toDate,
        string? competition,
        CancellationToken cancellationToken = default);
}

public interface IMarketRepository
{
    Task<Market?> GetByIdAsync(MarketId id, CancellationToken cancellationToken = default);
    Task<Market?> GetByIdWithSelectionsAsync(MarketId id, CancellationToken cancellationToken = default);
    Task<Market?> GetBySelectionIdAsync(SelectionId selectionId, CancellationToken cancellationToken = default);
    Task AddAsync(Market market, CancellationToken cancellationToken = default);
    Task UpdateAsync(Market market, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Market>> GetByEventIdAsync(EventId eventId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Market>> GetOpenMarketsByEventIdAsync(EventId eventId, CancellationToken cancellationToken = default);
}

public interface ISelectionRepository
{
    Task<Selection?> GetByIdAsync(SelectionId id, CancellationToken cancellationToken = default);
    Task AddAsync(Selection selection, CancellationToken cancellationToken = default);
    Task UpdateAsync(Selection selection, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Selection>> GetByMarketIdAsync(MarketId marketId, CancellationToken cancellationToken = default);
    Task BulkUpdateOddsAsync(IReadOnlyList<(SelectionId Id, Odd NewOdd)> updates, CancellationToken cancellationToken = default);
}

public interface IWalletRepository
{
    Task<Wallet?> GetByIdAsync(WalletId id, CancellationToken cancellationToken = default);
    Task<Wallet?> GetByUserIdAsync(UserId userId, CancellationToken cancellationToken = default);
    Task AddAsync(Wallet wallet, CancellationToken cancellationToken = default);
    Task UpdateAsync(Wallet wallet, uint expectedVersion, CancellationToken cancellationToken = default);
    Task<bool> ExistsAsync(WalletId id, CancellationToken cancellationToken = default);
    Task<bool> ExistsByUserIdAsync(UserId userId, CancellationToken cancellationToken = default);
}

public interface ITransactionRepository
{
    Task<Transaction?> GetByIdAsync(TransactionId id, CancellationToken cancellationToken = default);
    Task<Transaction?> GetByReferenceIdAsync(
        WalletId walletId,
        string referenceId,
        CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Transaction>> GetByWalletIdAsync(WalletId walletId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Transaction>> GetByWalletIdAsync(WalletId walletId, DateTimeOffset fromDate, DateTimeOffset toDate, CancellationToken cancellationToken = default);
    Task AddAsync(Transaction transaction, CancellationToken cancellationToken = default);
    Task UpdateAsync(Transaction transaction, CancellationToken cancellationToken = default);
}