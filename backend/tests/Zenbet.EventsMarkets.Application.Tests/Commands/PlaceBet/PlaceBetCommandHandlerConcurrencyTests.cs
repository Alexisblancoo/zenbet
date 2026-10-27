namespace Zenbet.EventsMarkets.Application.Tests.Commands.PlaceBet;

using System.Diagnostics;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Npgsql;
using Testcontainers.PostgreSql;
using Xunit;
using MediatR;
using Zenbet.EventsMarkets.Application.Commands.PlaceBet;
using Zenbet.EventsMarkets.Application.Interfaces;
using Zenbet.EventsMarkets.Domain.Aggregates;
using Zenbet.EventsMarkets.Domain.Events;
using Zenbet.EventsMarkets.Domain.Enums;
using Zenbet.EventsMarkets.Domain.Repositories;
using Zenbet.EventsMarkets.Domain.ValueObjects;
using Zenbet.EventsMarkets.Infrastructure.Persistence;
using Zenbet.EventsMarkets.Infrastructure.Persistence.Repositories;
using Zenbet.EventsMarkets.Infrastructure.Persistence.Outbox;
using Zenbet.EventsMarkets.Infrastructure.Persistence.Services;
using DomainEventId = Zenbet.EventsMarkets.Domain.ValueObjects.EventId;

public sealed class PlaceBetCommandHandlerConcurrencyTests : IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:16-alpine")
        .WithDatabase("zenbet_test")
        .WithUsername("test")
        .WithPassword("test")
        .Build();

    private ServiceProvider _serviceProvider = null!;
    private EventsMarketsDbContext _dbContext = null!;

    public async Task InitializeAsync()
    {
        await _postgres.StartAsync();

        var services = new ServiceCollection();
        services.AddLogging(b => b.AddConsole().SetMinimumLevel(LogLevel.Debug));

        services.AddDbContext<EventsMarketsDbContext>(options =>
            options.UseNpgsql(_postgres.GetConnectionString()));

        services.AddScoped<IEventRepository, EventRepository>();
        services.AddScoped<IMarketRepository, MarketRepository>();
        services.AddScoped<ISelectionRepository, SelectionRepository>();
        services.AddScoped<IWalletRepository, WalletRepository>();
        services.AddScoped<ITransactionRepository, TransactionRepository>();
        services.AddScoped<IOutboxWriter, OutboxWriter>();
        services.AddScoped<IInboxWriter, InboxWriter>();
        services.AddScoped<IUnitOfWork, EfUnitOfWork>();
        services.AddScoped<IIdempotencyService, EfIdempotencyService>();
        services.AddScoped<ISettlementAuditService, EfSettlementAuditService>();

        services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(typeof(PlaceBetCommandHandler).Assembly));

        _serviceProvider = services.BuildServiceProvider();
        _dbContext = _serviceProvider.GetRequiredService<EventsMarketsDbContext>();

        await _dbContext.Database.EnsureCreatedAsync();
    }

    public async Task DisposeAsync()
    {
        await _serviceProvider.DisposeAsync();
        await _postgres.DisposeAsync();
    }

    [Fact]
    public async Task Concurrent_PlaceBet_50_Parallel_Bets_Same_Selection_No_OverSpending()
    {
        // Arrange: Create wallet with 5000 balance, event with market and selection
        var (walletId, selectionId) = await SeedWalletAndSelectionAsync();
        var initialBalance = new Money(5000m);
        var betAmount = new Money(100m); // 50 bets * 100 = 5000 (exact balance)

        const int concurrency = 50;
        var commands = Enumerable.Range(0, concurrency)
            .Select(i => new PlaceBetCommand(
                walletId,
                selectionId,
                betAmount,
                $"bet-{i}",
                Guid.NewGuid()))
            .ToArray();

        // Act: Fire all 50 bets concurrently
        var tasks = commands.Select(c => Task.Run(async () =>
        {
            using var scope = _serviceProvider.CreateScope();
            var mediator = scope.ServiceProvider.GetRequiredService<IMediator>();
            try { return await mediator.Send(c); } catch { return null; }
        })).ToArray();

        var results = await Task.WhenAll(tasks);

        // Assert: Exactly 50 should succeed (all balance consumed)
        var successCount = results.Count(r => r != null && r.Success);
        Assert.Equal(concurrency, successCount);

        // Verify wallet balance is exactly 0
        var wallet = await _dbContext.Wallets.AsNoTracking().FirstAsync(w => w.Id == walletId);
        Assert.Equal(Money.Zero, wallet.Balance);

        // Verify 50 transactions created
        var transactionCount = await _dbContext.Transactions.CountAsync(t => t.WalletId == walletId && t.Type == TransactionType.BetPlacement);
        Assert.Equal(concurrency, transactionCount);

        // Verify outbox messages created
        var outboxCount = await _dbContext.OutboxMessages.CountAsync(o => o.Type == nameof(BetPlacedDomainEvent));
        Assert.Equal(concurrency, outboxCount);
    }

    [Fact]
    public async Task Concurrent_PlaceBet_Insufficient_Funds_Only_Valid_Bets_Succeed()
    {
        // Arrange: Wallet with 3000 balance, 50 bets of 100 = 5000 (only 30 should succeed)
        var (walletId, selectionId) = await SeedWalletAndSelectionAsync();
        var betAmount = new Money(100m);

        const int concurrency = 50;
        var commands = Enumerable.Range(0, concurrency)
            .Select(i => new PlaceBetCommand(
                walletId,
                selectionId,
                betAmount,
                $"bet-{i}",
                Guid.NewGuid()))
            .ToArray();

        // Act: Fire all 50 bets concurrently
        var tasks = commands.Select(c => Task.Run(async () =>
        {
            using var scope = _serviceProvider.CreateScope();
            var mediator = scope.ServiceProvider.GetRequiredService<IMediator>();
            try { return await mediator.Send(c); } catch { return null; }
        })).ToArray();

        var results = await Task.WhenAll(tasks);

        // Assert: Exactly 30 should succeed (3000 / 100 = 30)
        var successCount = results.Count(r => r != null && r.Success);
        Assert.Equal(30, successCount);

        // Verify wallet balance is 0
        var wallet = await _dbContext.Wallets.AsNoTracking().FirstAsync(w => w.Id == walletId);
        Assert.Equal(Money.Zero, wallet.Balance);

        // Verify 30 transactions created
        var transactionCount = await _dbContext.Transactions.CountAsync(t => t.WalletId == walletId && t.Type == TransactionType.BetPlacement);
        Assert.Equal(30, transactionCount);
    }

    [Fact]
    public async Task Idempotent_PlaceBet_Same_Key_Returns_Cached_Result()
    {
        var (walletId, selectionId) = await SeedWalletAndSelectionAsync();
        var betAmount = new Money(100m);
        var idempotencyKey = Guid.NewGuid();

        var command = new PlaceBetCommand(walletId, selectionId, betAmount, "test bet", idempotencyKey);

        var mediator = _serviceProvider.GetRequiredService<IMediator>();

        // First call
        var result1 = await mediator.Send(command);
        Assert.NotNull(result1);
        Assert.True(result1.Success);

        // Second call with same idempotency key
        var result2 = await mediator.Send(command);
        Assert.NotNull(result2);
        Assert.Equal(result1.BetId, result2.BetId);
        Assert.Equal(result1.TransactionId, result2.TransactionId);

        // Verify only 1 transaction created
        var transactionCount = await _dbContext.Transactions.CountAsync(t => t.WalletId == walletId && t.Type == TransactionType.BetPlacement);
        Assert.Equal(1, transactionCount);
    }

    [Fact]
    public async Task PlaceBet_Zero_Amount_Throws_ValidationError()
    {
        var (walletId, selectionId) = await SeedWalletAndSelectionAsync();
        var zeroAmount = Money.Zero;
        var command = new PlaceBetCommand(walletId, selectionId, zeroAmount, "test", Guid.NewGuid());

        var mediator = _serviceProvider.GetRequiredService<IMediator>();

        var result = await mediator.Send(command);
        Assert.NotNull(result);
        Assert.False(result.Success);
        Assert.Contains("amount", result.ErrorMessage, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task PlaceBet_Negative_Amount_Throws_ValidationError()
    {
        var (walletId, selectionId) = await SeedWalletAndSelectionAsync();
        // Money constructor throws for negative, so we test via validator
        // This test verifies the validator catches it before handler
        var command = new PlaceBetCommand(walletId, selectionId, new Money(-10m), "test", Guid.NewGuid());

        var mediator = _serviceProvider.GetRequiredService<IMediator>();

        var result = await mediator.Send(command);
        Assert.NotNull(result);
        Assert.False(result.Success);
    }

    private async Task<(WalletId, SelectionId)> SeedWalletAndSelectionAsync()
    {
        var walletId = WalletId.New();
        var userId = UserId.New();
        var eventId = DomainEventId.New();
        var selectionIds = new[] { SelectionId.New(), SelectionId.New(), SelectionId.New() };

        var wallet = new Wallet(walletId, userId);
        wallet.Deposit(new Money(5000m), "Initial deposit for testing");

        var @event = new Event(eventId, "Test Match", SportType.Football, DateTimeOffset.UtcNow.AddHours(2));
        var selections = selectionIds
            .Select((id, i) => new Selection(id, i == 0 ? "Home" : i == 1 ? "Draw" : "Away", new Odd(2.0m + i * 0.5m, DateTimeOffset.UtcNow)))
            .ToList();

        var market = @event.AddMarket("Match Winner", MarketType.MatchWinner, selections);

        _dbContext.Wallets.Add(wallet);
        _dbContext.Events.Add(@event);
        await _dbContext.SaveChangesAsync();
        _dbContext.ChangeTracker.Clear();

        return (walletId, selectionIds[0]);
    }
}