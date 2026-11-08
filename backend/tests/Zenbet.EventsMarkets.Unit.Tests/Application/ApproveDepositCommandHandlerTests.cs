namespace Zenbet.EventsMarkets.Unit.Tests.Application;

using Microsoft.Extensions.Logging.Abstractions;
using Xunit;
using Zenbet.EventsMarkets.Application.Commands.ApproveDeposit;
using Zenbet.EventsMarkets.Application.Interfaces;
using Zenbet.EventsMarkets.Domain.Aggregates;
using Zenbet.EventsMarkets.Domain.Enums;
using Zenbet.EventsMarkets.Domain.Events;
using Zenbet.EventsMarkets.Domain.Repositories;
using Zenbet.EventsMarkets.Domain.ValueObjects;

public sealed class ApproveDepositCommandHandlerTests
{
    [Fact]
    public async Task Handle_Blocks_An_Admin_From_Approving_Their_Own_Deposit()
    {
        var (wallet, deposit) = CreatePendingDeposit();
        var unitOfWork = new FakeUnitOfWork();
        var outbox = new FakeOutboxWriter();
        var handler = CreateHandler(wallet, deposit, unitOfWork, outbox);

        var result = await handler.Handle(
            new ApproveDepositCommand(deposit.Id, wallet.UserId.Value),
            CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(ApproveDepositError.SelfApprovalForbidden, result.Error);
        Assert.Equal(1, unitOfWork.RollbackCount);
        Assert.Equal(0, unitOfWork.CommitCount);

        // El saldo no se movió y el depósito sigue pendiente.
        Assert.Equal(Money.Zero, wallet.RealAvailable);
        Assert.Equal(TransactionStatus.Pending, deposit.Status);
        Assert.Empty(outbox.Events);
    }

    [Fact]
    public async Task Handle_Credits_The_Deposit_When_A_Different_Admin_Approves()
    {
        var (wallet, deposit) = CreatePendingDeposit();
        var unitOfWork = new FakeUnitOfWork();
        var outbox = new FakeOutboxWriter();
        var handler = CreateHandler(wallet, deposit, unitOfWork, outbox);
        var otherAdminId = Guid.NewGuid();

        var result = await handler.Handle(
            new ApproveDepositCommand(deposit.Id, otherAdminId),
            CancellationToken.None);

        Assert.True(result.Success);
        Assert.Equal(ApproveDepositError.None, result.Error);
        Assert.Equal(1, unitOfWork.CommitCount);
        Assert.Equal(new Money(100m), wallet.RealAvailable);
        Assert.Equal(TransactionStatus.Approved, deposit.Status);
        Assert.NotEmpty(outbox.Events);
    }

    private static ApproveDepositCommandHandler CreateHandler(
        Wallet wallet,
        Transaction deposit,
        FakeUnitOfWork unitOfWork,
        FakeOutboxWriter outbox) =>
        new(
            new FakeTransactionRepository(deposit),
            new FakeWalletRepository(wallet),
            unitOfWork,
            outbox,
            NullLogger<ApproveDepositCommandHandler>.Instance);

    private static (Wallet Wallet, Transaction Deposit) CreatePendingDeposit()
    {
        var userId = UserId.From(Guid.NewGuid());
        var wallet = new Wallet(WalletId.New(), userId);
        var deposit = Transaction.CreatePendingDeposit(
            wallet.Id,
            userId,
            new Money(100m),
            PaymentMethod.Qr,
            "REF-APPROVAL-TEST",
            wallet.Balance);

        return (wallet, deposit);
    }

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
        private readonly Transaction _transaction;

        public FakeTransactionRepository(Transaction transaction) => _transaction = transaction;

        public Task<Transaction?> GetByIdAsync(TransactionId id, CancellationToken cancellationToken = default)
            => Task.FromResult<Transaction?>(_transaction);

        public Task<Transaction?> GetByIdForUpdateAsync(TransactionId id, CancellationToken cancellationToken = default)
            => Task.FromResult<Transaction?>(_transaction);

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
            => Task.CompletedTask;

        public Task UpdateAsync(Transaction transaction, CancellationToken cancellationToken = default)
            => Task.CompletedTask;
    }

    private sealed class FakeUnitOfWork : IUnitOfWork
    {
        public int CommitCount { get; private set; }
        public int RollbackCount { get; private set; }

        public Task BeginTransactionAsync(CancellationToken cancellationToken = default)
            => Task.CompletedTask;

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
            => Task.FromResult(true);

        public void Dispose()
        {
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
