namespace Zenbet.EventsMarkets.Unit.Tests.Application;

using Microsoft.Extensions.Logging.Abstractions;
using Xunit;
using Zenbet.EventsMarkets.Application.Commands.CashOut;
using Zenbet.EventsMarkets.Application.Interfaces;
using Zenbet.EventsMarkets.Domain.Aggregates;
using Zenbet.EventsMarkets.Domain.Enums;
using Zenbet.EventsMarkets.Domain.Events;
using Zenbet.EventsMarkets.Domain.Repositories;
using Zenbet.EventsMarkets.Domain.ValueObjects;

public sealed class CashOutCommandHandlerTests
{
    private static readonly DateTimeOffset Now = new(2026, 11, 5, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task Handle_Rejects_Immediately_When_The_Market_Is_Suspended_By_Risk()
    {
        var scenario = CreateScenario(suspendedByRisk: true);
        var idempotency = new FakeIdempotencyService();
        var unitOfWork = new FakeUnitOfWork();
        var transactions = new FakeTransactionRepository(scenario.Bet);
        var outbox = new FakeOutboxWriter();

        var handler = CreateHandler(scenario, transactions, unitOfWork, idempotency, outbox);

        var result = await handler.Handle(
            new CashOutCommand(scenario.Wallet.Id, scenario.Bet.Id, Guid.NewGuid()),
            CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal("MARKET_SUSPENDED_BY_RISK", result.ErrorCode);
        Assert.Equal(1, unitOfWork.RollbackCount);
        Assert.Equal(0, unitOfWork.CommitCount);

        // Nada se movió en la billetera ni en el ledger.
        Assert.Equal(new Money(100m), scenario.Wallet.AtRiskBalance);
        Assert.Equal(Money.Zero, scenario.Wallet.RealAvailable);
        Assert.Equal(BetStatus.Pending, scenario.Bet.BetStatus);
        Assert.Empty(transactions.Added);
        Assert.Empty(outbox.Events);
        Assert.Empty(idempotency.Added);
    }

    [Fact]
    public async Task Handle_Acquires_The_Wallet_Advisory_Lock_And_Settles_The_Bet()
    {
        var scenario = CreateScenario(suspendedByRisk: false);
        var idempotency = new FakeIdempotencyService();
        var unitOfWork = new FakeUnitOfWork();
        var transactions = new FakeTransactionRepository(scenario.Bet);
        var outbox = new FakeOutboxWriter();

        var handler = CreateHandler(scenario, transactions, unitOfWork, idempotency, outbox);

        var result = await handler.Handle(
            new CashOutCommand(scenario.Wallet.Id, scenario.Bet.Id, Guid.NewGuid()),
            CancellationToken.None);

        // (3.00 / 2.00) * 100 * 0.90 = 135.00
        var expectedWalletLock = BitConverter.ToInt64(scenario.Wallet.Id.Value.ToByteArray(), 0);
        Assert.Contains(expectedWalletLock, unitOfWork.LockKeys);
        Assert.True(result.Success);
        Assert.Equal(new Money(135m), result.CashOutAmount);
        Assert.Equal(new Money(135m), result.NewRealAvailable);
        Assert.Equal(2.00m, result.InitialOdds);
        Assert.Equal(3.00m, result.CurrentOdds);
        Assert.Equal(0.90m, result.RetentionMargin);

        Assert.Equal(Money.Zero, scenario.Wallet.RealLocked);
        Assert.Equal(new Money(135m), scenario.Wallet.RealAvailable);
        Assert.Equal(BetStatus.CashedOut, scenario.Bet.BetStatus);

        var ledgerEntry = Assert.Single(transactions.Added);
        Assert.Equal(TransactionType.CashOut, ledgerEntry.Type);
        Assert.Equal(TransactionStatus.Completed, ledgerEntry.Status);
        Assert.Equal(BetStatus.CashedOut, ledgerEntry.BetStatus);
        Assert.Equal(new Money(135m), ledgerEntry.Amount);

        Assert.Single(idempotency.Added);
        Assert.Equal(1, unitOfWork.CommitCount);
        Assert.Equal(0, unitOfWork.RollbackCount);
        Assert.Contains(outbox.Events, domainEvent => domainEvent is BetCashedOutDomainEvent);
    }

    private static CashOutCommandHandler CreateHandler(
        Scenario scenario,
        FakeTransactionRepository transactions,
        FakeUnitOfWork unitOfWork,
        FakeIdempotencyService idempotency,
        FakeOutboxWriter outbox)
    {
        return new CashOutCommandHandler(
            new FakeWalletRepository(scenario.Wallet),
            transactions,
            new FakeSelectionRepository(scenario.Selection),
            new FakeMarketRepository(scenario.Market),
            unitOfWork,
            outbox,
            idempotency,
            NullLogger<CashOutCommandHandler>.Instance);
    }

    private static Scenario CreateScenario(bool suspendedByRisk)
    {
        var wallet = new Wallet(WalletId.New(), UserId.New());
        wallet.Deposit(new Money(100m), "Depósito inicial");

        var selection = new Selection(
            SelectionId.New(),
            "Fighter A",
            new Odd(3.00m, Now));
        var market = new Market(
            MarketId.New(),
            EventId.New(),
            "Main Event Winner",
            MarketType.Moneyline,
            new[] { selection },
            maxLiabilityLimit: new Money(1000m));

        if (suspendedByRisk)
        {
            // 475 * 2.00 = 950 = 95% del límite -> dispara el Circuit Breaker.
            market.RegisterBetExposure(selection.Id, new Money(475m), 2.00m);
        }

        var bet = wallet.PlaceBet(
            amount: new Money(100m),
            selectionId: selection.Id,
            description: "Apuesta a liquidar anticipadamente",
            acceptedOdds: 2.00m);

        wallet.ClearDomainEvents();
        market.ClearDomainEvents();

        return new Scenario(wallet, bet, selection, market);
    }

    private sealed record Scenario(
        Wallet Wallet,
        Transaction Bet,
        Selection Selection,
        Market Market);

    private sealed class FakeWalletRepository : IWalletRepository
    {
        private readonly Wallet _wallet;

        public FakeWalletRepository(Wallet wallet) => _wallet = wallet;

        public Task<Wallet?> GetByIdAsync(WalletId id, CancellationToken cancellationToken = default)
            => Task.FromResult<Wallet?>(_wallet);

        public Task<Wallet?> GetByIdForUpdateAsync(WalletId id, CancellationToken cancellationToken = default)
            => Task.FromResult<Wallet?>(_wallet);

        public Task<Wallet?> GetByUserIdAsync(UserId userId, CancellationToken cancellationToken = default)
            => Task.FromResult<Wallet?>(null);

        public Task AddAsync(Wallet wallet, CancellationToken cancellationToken = default)
            => Task.CompletedTask;

        public Task UpdateAsync(Wallet wallet, uint expectedVersion, CancellationToken cancellationToken = default)
            => Task.CompletedTask;

        public Task<bool> ExistsAsync(WalletId id, CancellationToken cancellationToken = default)
            => Task.FromResult(true);

        public Task<bool> ExistsByUserIdAsync(UserId userId, CancellationToken cancellationToken = default)
            => Task.FromResult(false);
    }

    private sealed class FakeTransactionRepository : ITransactionRepository
    {
        private readonly Transaction _bet;

        public FakeTransactionRepository(Transaction bet) => _bet = bet;

        public List<Transaction> Added { get; } = new();

        public Task<Transaction?> GetByIdAsync(TransactionId id, CancellationToken cancellationToken = default)
            => Task.FromResult<Transaction?>(_bet);

        public Task<Transaction?> GetByIdForUpdateAsync(TransactionId id, CancellationToken cancellationToken = default)
            => Task.FromResult<Transaction?>(_bet);

        public Task<Transaction?> GetByReferenceIdAsync(
            WalletId walletId,
            string referenceId,
            CancellationToken cancellationToken = default)
            => Task.FromResult<Transaction?>(null);

        public Task<Transaction?> GetAnyByReferenceIdAsync(
            WalletId walletId,
            string referenceId,
            CancellationToken cancellationToken = default)
            => Task.FromResult<Transaction?>(null);

        public Task<Transaction?> GetLatestRgsBetByRoundIdAsync(
            WalletId walletId,
            string roundId,
            CancellationToken cancellationToken = default)
            => Task.FromResult<Transaction?>(null);

        public Task<Transaction?> GetDepositByReferenceAsync(
            WalletId walletId,
            string referenceId,
            CancellationToken cancellationToken = default)
            => Task.FromResult<Transaction?>(null);

        public Task<IReadOnlyList<Transaction>> GetByWalletIdAsync(
            WalletId walletId,
            CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Transaction>>([]);

        public Task<IReadOnlyList<Transaction>> GetByWalletIdAsync(
            WalletId walletId,
            DateTimeOffset fromDate,
            DateTimeOffset toDate,
            CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Transaction>>([]);

        public Task<IReadOnlyList<Transaction>> ListPendingDepositTransactionsAsync(
            WalletId? walletId,
            int limit = 100,
            CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Transaction>>([]);

        public Task<IReadOnlyList<Transaction>> GetPendingBetsByMarketIdAsync(
            MarketId marketId,
            CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Transaction>>([]);

        public Task<IReadOnlyList<Transaction>> GetBetsByMarketIdAsync(
            MarketId marketId,
            CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Transaction>>([]);

        public Task<IReadOnlyList<Transaction>> GetSettlementsByMarketIdAsync(
            MarketId marketId,
            CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Transaction>>([]);

        public Task AddAsync(Transaction transaction, CancellationToken cancellationToken = default)
        {
            Added.Add(transaction);
            return Task.CompletedTask;
        }

        public Task UpdateAsync(Transaction transaction, CancellationToken cancellationToken = default)
            => Task.CompletedTask;
    }

    private sealed class FakeSelectionRepository : ISelectionRepository
    {
        private readonly Selection _selection;

        public FakeSelectionRepository(Selection selection) => _selection = selection;

        public Task<Selection?> GetByIdAsync(SelectionId id, CancellationToken cancellationToken = default)
            => Task.FromResult<Selection?>(_selection);

        public Task AddAsync(Selection selection, CancellationToken cancellationToken = default)
            => Task.CompletedTask;

        public Task UpdateAsync(Selection selection, CancellationToken cancellationToken = default)
            => Task.CompletedTask;

        public Task<IReadOnlyList<Selection>> GetByMarketIdAsync(
            MarketId marketId,
            CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Selection>>([_selection]);

        public Task BulkUpdateOddsAsync(
            IReadOnlyList<(SelectionId Id, Odd NewOdd)> updates,
            CancellationToken cancellationToken = default)
            => Task.CompletedTask;
    }

    private sealed class FakeMarketRepository : IMarketRepository
    {
        private readonly Market _market;

        public FakeMarketRepository(Market market) => _market = market;

        public Task<Market?> GetByIdAsync(MarketId id, CancellationToken cancellationToken = default)
            => Task.FromResult<Market?>(_market);

        public Task<Market?> GetByIdWithSelectionsAsync(MarketId id, CancellationToken cancellationToken = default)
            => Task.FromResult<Market?>(_market);

        public Task<Market?> GetBySelectionIdAsync(SelectionId selectionId, CancellationToken cancellationToken = default)
            => Task.FromResult<Market?>(_market);

        public Task AddAsync(Market market, CancellationToken cancellationToken = default)
            => Task.CompletedTask;

        public Task UpdateAsync(Market market, CancellationToken cancellationToken = default)
            => Task.CompletedTask;

        public Task<IReadOnlyList<Market>> GetByEventIdAsync(EventId eventId, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Market>>([_market]);

        public Task<IReadOnlyList<Market>> GetOpenMarketsByEventIdAsync(
            EventId eventId,
            CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Market>>([]);
    }

    private sealed class FakeUnitOfWork : IUnitOfWork
    {
        public int BeginCount { get; private set; }
        public int CommitCount { get; private set; }
        public int RollbackCount { get; private set; }
        public List<long> LockKeys { get; } = new();

        public Task BeginTransactionAsync(CancellationToken cancellationToken = default)
        {
            BeginCount++;
            return Task.CompletedTask;
        }

        public Task CommitAsync(CancellationToken cancellationToken = default)
        {
            CommitCount++;
            return Task.CompletedTask;
        }

        public Task RollbackAsync(CancellationToken cancellationToken = default)
        {
            RollbackCount++;
            return Task.CompletedTask;
        }

        public Task SaveChangesAsync(CancellationToken cancellationToken = default)
            => Task.CompletedTask;

        public Task<bool> TryAcquireAdvisoryLockAsync(long lockKey, CancellationToken cancellationToken = default)
        {
            LockKeys.Add(lockKey);
            return Task.FromResult(true);
        }

        public void Dispose()
        {
        }
    }

    private sealed class FakeIdempotencyService : IIdempotencyService
    {
        public List<(string Key, string Command, string? PayloadHash)> Added { get; } = new();

        public Task<bool> ExistsAsync(string key, CancellationToken cancellationToken = default)
            => Task.FromResult(false);

        public Task<bool> ExistsAsync(
            string key,
            string commandType,
            string payloadHash,
            CancellationToken cancellationToken = default)
            => Task.FromResult(false);

        public Task AddAsync(
            string key,
            string commandType,
            CancellationToken cancellationToken = default,
            string? payloadHash = null)
        {
            Added.Add((key, commandType, payloadHash));
            return Task.CompletedTask;
        }
    }

    private sealed class FakeOutboxWriter : IOutboxWriter
    {
        public List<DomainEvent> Events { get; } = new();

        public Task WriteAsync(DomainEvent domainEvent, CancellationToken cancellationToken = default)
        {
            Events.Add(domainEvent);
            return Task.CompletedTask;
        }
    }
}
