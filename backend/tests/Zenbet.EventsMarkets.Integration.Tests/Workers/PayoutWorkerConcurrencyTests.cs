namespace Zenbet.EventsMarkets.Integration.Tests.Workers;

using System.Diagnostics;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Npgsql;
using Testcontainers.PostgreSql;
using Xunit;
using MediatR;
using Zenbet.EventsMarkets.Application.Commands.PlaceBet;
using Zenbet.EventsMarkets.Application.Commands.SettleMarket;
using Zenbet.EventsMarkets.Application.Interfaces;
using Zenbet.EventsMarkets.Domain.Aggregates;
using Zenbet.EventsMarkets.Domain.Events;
using Zenbet.EventsMarkets.Domain.Enums;
using Zenbet.EventsMarkets.Domain.Exceptions;
using Zenbet.EventsMarkets.Domain.Repositories;
using Zenbet.EventsMarkets.Domain.ValueObjects;
using Zenbet.EventsMarkets.Infrastructure.Messaging;
using Zenbet.EventsMarkets.Infrastructure.Persistence;
using Zenbet.EventsMarkets.Infrastructure.Persistence.Outbox;
using Zenbet.EventsMarkets.Infrastructure.Persistence.Repositories;
using Zenbet.EventsMarkets.Infrastructure.Persistence.Services;
using DomainEventId = Zenbet.EventsMarkets.Domain.ValueObjects.EventId;

public sealed class PayoutWorkerConcurrencyTests : IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:16-alpine")
        .WithDatabase("zenbet_test")
        .WithUsername("test")
        .WithPassword("test")
        .Build();

    private ServiceProvider _serviceProvider = null!;
    private EventsMarketsDbContext _dbContext = null!;
    private readonly List<IHostedService> _hostedServices = new();

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
        services.AddScoped<INotificationService, NoOpNotificationService>();

        services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(typeof(PlaceBetCommandHandler).Assembly));

        // Register PayoutWorker as hosted service
        services.AddHostedService<PayoutWorker>();
        services.Configure<PayoutWorkerOptions>(o =>
        {
            o.BatchSize = 10;
            o.PollInterval = TimeSpan.FromMilliseconds(100);
            o.MaxRetries = 3;
        });

        _serviceProvider = services.BuildServiceProvider();
        _dbContext = _serviceProvider.GetRequiredService<EventsMarketsDbContext>();

        await _dbContext.Database.EnsureCreatedAsync();

        // `BuildServiceProvider` no arranca los hosted services: hay que
        // iniciarlos explícitamente para que PayoutWorker procese la cola.
        _hostedServices.AddRange(_serviceProvider.GetServices<IHostedService>());
        foreach (var hostedService in _hostedServices)
        {
            await hostedService.StartAsync(CancellationToken.None);
        }
    }

    public async Task DisposeAsync()
    {
        foreach (var hostedService in _hostedServices)
        {
            try
            {
                await hostedService.StopAsync(CancellationToken.None);
            }
            catch (OperationCanceledException)
            {
                // El worker se detiene al cancelar su token de ejecución.
            }
        }

        await _serviceProvider.DisposeAsync();
        await _postgres.DisposeAsync();
    }

    [Fact]
    public async Task PayoutWorker_Processes_100_Winning_Bets_Correctly()
    {
        // Arrange: Create market with 100 bets on winning selection
        var (walletIds, selectionIds, marketId) = await SeedMarketWith100BetsAsync();
        var winnerSelectionId = selectionIds[0]; // Home team wins
        var winningOdd = new Odd(2.5m, DateTimeOffset.UtcNow);

        // Update selection odd to winning odd
        await UpdateSelectionOddAsync(winnerSelectionId, winningOdd);

        // Place 100 bets of 100 each on winning selection (total 10000)
        await PlaceBetsAsync(walletIds, winnerSelectionId, new Money(100m));

        // Record initial balances
        var initialBalances = new Dictionary<WalletId, Money>();
        foreach (var walletId in walletIds)
        {
            var wallet = await _dbContext.Wallets.AsNoTracking().FirstAsync(w => w.Id == walletId);
            initialBalances[walletId] = wallet.Balance;
        }

        // Act: Settle market (this triggers payout via outbox -> payout worker)
        var mediator = _serviceProvider.GetRequiredService<IMediator>();
        var settleCommand = new SettleMarketCommand(
            marketId,
            winnerSelectionId,
            SettlementResult.Won,
            "test-settler",
            Guid.NewGuid());

        var settleResult = await mediator.Send(settleCommand);
        Assert.NotNull(settleResult);

        // Wait for payout worker to process (poll for completion)
        await WaitForPayoutsToCompleteAsync(walletIds.Length, TimeSpan.FromSeconds(30));

        // Assert: Each wallet should have received payout = bet_amount * odd = 100 * 2.5 = 250
        foreach (var walletId in walletIds)
        {
            var wallet = await _dbContext.Wallets.AsNoTracking().FirstAsync(w => w.Id == walletId);
            var expectedBalance = initialBalances[walletId] + new Money(250m); // 100 * 2.5
            Assert.Equal(expectedBalance, wallet.Balance);
        }

        // Verify payout transactions created
        var payoutTxCount = await _dbContext.Transactions
            .CountAsync(t => t.Type == TransactionType.BetSettlement && t.Status == TransactionStatus.Completed);
        Assert.Equal(walletIds.Length, payoutTxCount);

        // Verify outbox events for payouts
        var payoutOutboxCount = await _dbContext.OutboxMessages
            .CountAsync(o => o.Type == nameof(BetSettledDomainEvent));
        Assert.Equal(walletIds.Length, payoutOutboxCount);
    }

    [Fact]
    public async Task PayoutWorker_Idempotent_Processing_Does_Not_Double_Pay()
    {
        // Arrange: Single bet, settle market twice (simulating duplicate event)
        var (walletIds, selectionIds, marketId) = await SeedMarketWith100BetsAsync();
        var winnerSelectionId = selectionIds[0];
        var winningOdd = new Odd(3.0m, DateTimeOffset.UtcNow);

        await UpdateSelectionOddAsync(winnerSelectionId, winningOdd);
        await PlaceBetsAsync(walletIds.Take(1), winnerSelectionId, new Money(100m));

        var walletId = walletIds[0];
        var initialBalance = (await _dbContext.Wallets.AsNoTracking().FirstAsync(w => w.Id == walletId)).Balance;

        var mediator = _serviceProvider.GetRequiredService<IMediator>();

        // First settlement
        var settleCommand1 = new SettleMarketCommand(
            marketId,
            winnerSelectionId,
            SettlementResult.Won,
            "test-settler",
            Guid.NewGuid());

        await mediator.Send(settleCommand1);
        await WaitForPayoutsToCompleteAsync(1, TimeSpan.FromSeconds(10));

        var balanceAfterFirst = (await _dbContext.Wallets.AsNoTracking().FirstAsync(w => w.Id == walletId)).Balance;

        // Segundo intento con una clave nueva: el mercado ya está liquidado,
        // por lo que el dominio rechaza la operación en lugar de pagar dos veces.
        var settleCommand2 = new SettleMarketCommand(
            marketId,
            winnerSelectionId,
            SettlementResult.Won,
            "test-settler",
            Guid.NewGuid());

        await Assert.ThrowsAsync<MarketAlreadySettledException>(() => mediator.Send(settleCommand2));

        // El worker no debe encontrar apuestas pendientes nuevas.
        await Task.Delay(1000);

        var balanceAfterSecond = (await _dbContext.Wallets.AsNoTracking().FirstAsync(w => w.Id == walletId)).Balance;

        // Balance should not change after second settlement
        Assert.Equal(balanceAfterFirst, balanceAfterSecond);
        Assert.Equal(1, await _dbContext.Transactions.CountAsync(t =>
            t.WalletId == walletId && t.Type == TransactionType.BetSettlement));
    }

    private async Task<(WalletId[] walletIds, SelectionId[] selectionIds, MarketId marketId)> SeedMarketWith100BetsAsync()
    {
        var userIds = Enumerable.Range(0, 100).Select(_ => UserId.New()).ToArray();
        var walletIds = Enumerable.Range(0, 100).Select(_ => WalletId.New()).ToArray();
        var eventId = DomainEventId.New();
        var selectionIds = new[] { SelectionId.New(), SelectionId.New(), SelectionId.New() };
        var marketId = MarketId.New();

        var wallets = new List<Wallet>();
        for (int i = 0; i < 100; i++)
        {
            var wallet = new Wallet(walletIds[i], userIds[i]);
            wallet.Deposit(new Money(10000m), "Initial deposit");
            wallets.Add(wallet);
        }

        var @event = new Event(eventId, "Test Match", SportType.Football, DateTimeOffset.UtcNow.AddHours(2));
        var selections = selectionIds
            .Select((id, i) => new Selection(id, i == 0 ? "Home" : i == 1 ? "Draw" : "Away", new Odd(2.0m + i * 0.5m, DateTimeOffset.UtcNow)))
            .ToList();

        // Se persiste el mercado con el id conocido: el worker de pagos y el
        // comando de liquidación resuelven el agregado por ese id.
        var market = @event.AddMarket(marketId, "Match Winner", MarketType.MatchWinner, selections);

        _dbContext.Wallets.AddRange(wallets);
        _dbContext.Events.Add(@event);
        await _dbContext.SaveChangesAsync();
        _dbContext.ChangeTracker.Clear();

        return (walletIds, selectionIds, marketId);
    }

    private async Task UpdateSelectionOddAsync(SelectionId selectionId, Odd odd)
    {
        var selection = await _dbContext.Selections.FirstAsync(s => s.Id == selectionId);
        selection.UpdateOdd(odd, DateTimeOffset.UtcNow);
        await _dbContext.SaveChangesAsync();
    }

    private async Task PlaceBetsAsync(IEnumerable<WalletId> walletIds, SelectionId selectionId, Money amount)
    {
        var mediator = _serviceProvider.GetRequiredService<IMediator>();

        foreach (var walletId in walletIds)
        {
            var result = await mediator.Send(new PlaceBetCommand(
                walletId,
                selectionId,
                amount,
                "test bet",
                Guid.NewGuid()));

            Assert.True(result.Success, result.ErrorMessage);
        }
    }

    private async Task WaitForPayoutsToCompleteAsync(int expectedCount, TimeSpan timeout)
    {
        var stopwatch = Stopwatch.StartNew();
        while (stopwatch.Elapsed < timeout)
        {
            var payoutCount = await _dbContext.Transactions
                .CountAsync(t => t.Type == TransactionType.BetSettlement && t.Status == TransactionStatus.Completed);
            
            if (payoutCount >= expectedCount)
                return;

            await Task.Delay(500);
        }
        
        // Final check
        var finalCount = await _dbContext.Transactions
            .CountAsync(t => t.Type == TransactionType.BetSettlement && t.Status == TransactionStatus.Completed);
        Assert.True(finalCount >= expectedCount, $"Timeout waiting for payouts. Expected {expectedCount}, got {finalCount}");
    }
}