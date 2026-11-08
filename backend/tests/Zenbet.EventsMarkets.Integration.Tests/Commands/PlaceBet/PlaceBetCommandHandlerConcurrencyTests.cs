namespace Zenbet.EventsMarkets.Integration.Tests.Commands.PlaceBet;

using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Testcontainers.PostgreSql;
using Xunit;
using MediatR;
using Zenbet.EventsMarkets.Application.Commands.PlaceBet;
using Zenbet.EventsMarkets.Application.Commands.RequestDeposit;
using Zenbet.EventsMarkets.Application.Interfaces;
using Zenbet.EventsMarkets.Domain.Aggregates;
using Zenbet.EventsMarkets.Domain.Enums;
using Zenbet.EventsMarkets.Domain.Events;
using Zenbet.EventsMarkets.Domain.Exceptions;
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
        var (walletId, selectionId) = await SeedWalletAndSelectionAsync(5000m);
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
    public async Task Concurrent_PlaceBet_Across_Selections_In_Same_Market_Does_Not_Double_Spend()
    {
        var (walletId, selectionIds) = await SeedWalletAndSelectionsAsync(5000m);
        const int concurrency = 50;
        var commands = Enumerable.Range(0, concurrency)
            .Select(index => new PlaceBetCommand(
                walletId,
                selectionIds[index % selectionIds.Length],
                new Money(100m),
                $"cross-selection-{index}",
                Guid.NewGuid()))
            .ToArray();

        using var startGate = new ManualResetEventSlim(false);
        var tasks = commands.Select(command => Task.Run(async () =>
        {
            using var scope = _serviceProvider.CreateScope();
            var mediator = scope.ServiceProvider.GetRequiredService<IMediator>();
            startGate.Wait();
            return await mediator.Send(command);
        })).ToArray();

        startGate.Set();
        var results = await Task.WhenAll(tasks);

        Assert.All(results, result => Assert.True(result.Success, result.ErrorMessage));
        Assert.Equal(concurrency, await _dbContext.Transactions.CountAsync(
            transaction => transaction.WalletId == walletId &&
                transaction.Type == TransactionType.BetPlacement));
        Assert.Equal(concurrency, await _dbContext.OutboxMessages.CountAsync(
            message => message.Type == nameof(BetPlacedDomainEvent)));
        Assert.Equal(Money.Zero, (await _dbContext.Wallets.AsNoTracking()
            .SingleAsync(wallet => wallet.Id == walletId)).Balance);
    }

    [Fact]
    public async Task Concurrent_PlaceBet_Insufficient_Funds_Only_Valid_Bets_Succeed()
    {
        // Arrange: Wallet with 3000 balance, 50 bets of 100 = 5000 (only 30 should succeed)
        var (walletId, selectionId) = await SeedWalletAndSelectionAsync(3000m);
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

        await Assert.ThrowsAsync<IdempotencyConflictException>(async () =>
        {
            using var scope = _serviceProvider.CreateScope();
            var retryMediator = scope.ServiceProvider.GetRequiredService<IMediator>();
            await retryMediator.Send(command with { Amount = new Money(200m) });
        });
    }

    [Fact]
    public async Task Concurrent_PlaceBet_Same_Key_Creates_One_Transaction_And_One_Outbox_Message()
    {
        var (walletId, selectionId) = await SeedWalletAndSelectionAsync();
        var command = new PlaceBetCommand(
            walletId,
            selectionId,
            new Money(100m),
            "concurrent retry",
            Guid.NewGuid());

        const int retryCount = 32;
        using var startGate = new ManualResetEventSlim(false);
        var tasks = Enumerable.Range(0, retryCount)
            .Select(_ => Task.Run(async () =>
            {
                using var scope = _serviceProvider.CreateScope();
                var mediator = scope.ServiceProvider.GetRequiredService<IMediator>();
                startGate.Wait();
                return await mediator.Send(command);
            }))
            .ToArray();

        startGate.Set();
        var results = await Task.WhenAll(tasks);

        Assert.All(results, result => Assert.True(result.Success, result.ErrorMessage));
        Assert.Single(results.Select(result => result.TransactionId).Distinct());
        Assert.Equal(1, await _dbContext.Transactions.CountAsync(
            t => t.WalletId == walletId && t.Type == TransactionType.BetPlacement));
        Assert.Equal(1, await _dbContext.OutboxMessages.CountAsync(
            message => message.Type == nameof(BetPlacedDomainEvent)));

        var wallet = await _dbContext.Wallets.AsNoTracking().SingleAsync(w => w.Id == walletId);
        Assert.Equal(new Money(4900m), wallet.Balance);
    }

    [Fact]
    public async Task Concurrent_Deposit_Retry_Same_Key_Returns_One_Pending_Request()
    {
        var walletId = WalletId.New();
        var wallet = new Wallet(walletId, UserId.New());
        _dbContext.Wallets.Add(wallet);
        await _dbContext.SaveChangesAsync();
        _dbContext.ChangeTracker.Clear();

        var command = new RequestDepositCommand(
            walletId,
            new Money(250m),
            PaymentMethod.Qr,
            "receipt-12345",
            Guid.NewGuid());

        const int retryCount = 24;
        var startGate = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var tasks = Enumerable.Range(0, retryCount)
            .Select(async _ =>
            {
                using var scope = _serviceProvider.CreateScope();
                var mediator = scope.ServiceProvider.GetRequiredService<IMediator>();
                await startGate.Task;
                return await mediator.Send(command);
            })
            .ToArray();

        startGate.SetResult();
        var results = await Task.WhenAll(tasks);

        Assert.All(results, result => Assert.True(result.Success, result.ErrorMessage));
        Assert.Single(results.Select(result => result.TransactionId).Distinct());
        Assert.Equal(1, await _dbContext.Transactions.CountAsync(
            transaction => transaction.WalletId == walletId &&
                transaction.Type == TransactionType.Deposit &&
                transaction.Status == TransactionStatus.Pending));
        Assert.Equal(Money.Zero, (await _dbContext.Wallets.AsNoTracking()
            .SingleAsync(item => item.Id == walletId)).Balance);

        await Assert.ThrowsAsync<IdempotencyConflictException>(async () =>
        {
            using var scope = _serviceProvider.CreateScope();
            var retryMediator = scope.ServiceProvider.GetRequiredService<IMediator>();
            await retryMediator.Send(command with { Amount = new Money(300m) });
        });
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
        // El mensaje del dominio esta en espanol ("El monto de la apuesta debe ser positivo.").
        Assert.Contains("monto", result.ErrorMessage, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Negative_Amount_Is_Rejected_By_Money_ValueObject()
    {
        // `Money` es el límite real del modelo: un importe negativo no se puede
        // construir, así que ningún `PlaceBetCommand` puede llegar al handler
        // con esa cantidad. El test fija esa invariante de dominio.
        var exception = Assert.Throws<ArgumentException>(() => new Money(-10m));
        Assert.Equal("amount", exception.ParamName);
    }

    [Fact]
    public async Task Concurrent_PlaceBet_MultiUser_With_Dynamic_Odds_Shift_Enforces_Slippage_Tolerance()
    {
        // Arrange: Crear 20 billeteras con $5,000 c/u y un mercado con cuota inicial 2.50
        const int userCount = 20;
        var wallets = new List<WalletId>();
        var selectionIds = new[] { SelectionId.New(), SelectionId.New(), SelectionId.New() };
        var targetSelectionId = selectionIds[0];

        var eventId = DomainEventId.New();
        var @event = new Event(eventId, "UFC 300 Championship", SportType.MixedMartialArts, DateTimeOffset.UtcNow.AddHours(3));
        var selections = selectionIds
            .Select((id, i) => new Selection(id, i == 0 ? "Fighter A" : i == 1 ? "Draw" : "Fighter B", new Odd(2.50m, DateTimeOffset.UtcNow)))
            .ToList();
        @event.AddMarket("Moneyline", MarketType.MmaMoneyline, selections);
        _dbContext.Events.Add(@event);

        for (var i = 0; i < userCount; i++)
        {
            var wid = WalletId.New();
            var wallet = new Wallet(wid, UserId.New());
            wallet.Deposit(new Money(5000m), $"Seed wallet {i}");
            _dbContext.Wallets.Add(wallet);
            wallets.Add(wid);
        }

        await _dbContext.SaveChangesAsync();
        _dbContext.ChangeTracker.Clear();

        // Simular cambio dinámico de cuota en vivo (la cuota baja de 2.50 a 2.20)
        var selectionEntity = await _dbContext.Selections.SingleAsync(s => s.Id == targetSelectionId);
        selectionEntity.UpdateOdd(new Odd(2.20m, DateTimeOffset.UtcNow), DateTimeOffset.UtcNow);
        await _dbContext.SaveChangesAsync();
        _dbContext.ChangeTracker.Clear();

        // 10 usuarios con tolerancia estricta (2% -> cuota mínima aceptable = 2.45)
        // 10 usuarios con tolerancia flexible (20% -> cuota mínima aceptable = 2.00)
        var commands = new List<PlaceBetCommand>();
        for (var i = 0; i < userCount; i++)
        {
            var isStrict = i < 10;
            var maxSlippage = isStrict ? 2.0m : 20.0m;

            commands.Add(new PlaceBetCommand(
                wallets[i],
                targetSelectionId,
                new Money(100m),
                $"quickbet-concurrent-{i}",
                Guid.NewGuid(),
                ExpectedOdds: 2.50m,
                MaxSlippagePercent: maxSlippage
            ));
        }

        // Act: Disparar las 20 apuestas de forma concurrente
        using var startGate = new ManualResetEventSlim(false);
        var tasks = commands.Select(cmd => Task.Run(async () =>
        {
            using var scope = _serviceProvider.CreateScope();
            var mediator = scope.ServiceProvider.GetRequiredService<IMediator>();
            startGate.Wait();
            return await mediator.Send(cmd);
        })).ToArray();

        startGate.Set();
        var results = await Task.WhenAll(tasks);

        // Assert:
        // Los 10 estrictos deben ser rechazados con ODDS_CHANGED
        var strictResults = results.Take(10).ToList();
        Assert.All(strictResults, res =>
        {
            Assert.False(res.Success);
            Assert.Equal("ODDS_CHANGED", res.ErrorCode);
            Assert.Equal(2.20m, res.CurrentOdds);
        });

        // Los 10 flexibles deben haber tenido éxito
        var flexibleResults = results.Skip(10).ToList();
        Assert.All(flexibleResults, res =>
        {
            Assert.True(res.Success, res.ErrorMessage);
            Assert.NotNull(res.TransactionId);
        });

        // Invariante de Ledger: exactamente 10 transacciones creadas de tipo BetPlacement
        var totalTransactions = await _dbContext.Transactions.CountAsync(t => t.Type == TransactionType.BetPlacement);
        Assert.Equal(10, totalTransactions);

        // Invariante de Billeteras: Las 10 estrictas conservan $5,000; las 10 flexibles tienen $4,900
        var allWallets = await _dbContext.Wallets.AsNoTracking().Where(w => wallets.Contains(w.Id)).ToListAsync();
        var totalBalance = allWallets.Sum(w => w.Balance.Amount);
        var expectedTotalBalance = (10 * 5000m) + (10 * 4900m); // 99,000
        Assert.Equal(expectedTotalBalance, totalBalance);
    }

    private async Task<(WalletId, SelectionId)> SeedWalletAndSelectionAsync(decimal initialBalance = 5000m)
    {
        var (walletId, selectionIds) = await SeedWalletAndSelectionsAsync(initialBalance);
        return (walletId, selectionIds[0]);
    }

    private async Task<(WalletId WalletId, SelectionId[] SelectionIds)> SeedWalletAndSelectionsAsync(
        decimal initialBalance = 5000m)
    {
        var walletId = WalletId.New();
        var userId = UserId.New();
        var eventId = DomainEventId.New();
        var selectionIds = new[] { SelectionId.New(), SelectionId.New(), SelectionId.New() };

        var wallet = new Wallet(walletId, userId);
        wallet.Deposit(new Money(initialBalance), "Initial deposit for testing");

        var @event = new Event(eventId, "Test Match", SportType.Football, DateTimeOffset.UtcNow.AddHours(2));
        var selections = selectionIds
            .Select((id, i) => new Selection(id, i == 0 ? "Home" : i == 1 ? "Draw" : "Away", new Odd(2.0m + i * 0.5m, DateTimeOffset.UtcNow)))
            .ToList();

        var market = @event.AddMarket("Match Winner", MarketType.MatchWinner, selections);

        // Estos tests verifican que la billetera no se sobregira bajo concurrencia, no el
        // motor de riesgo (circuit breaker al 95% del limite, cubierto en Risk/). Con el
        // limite por defecto de 10,000 el mercado se suspendia tras ~38-48 apuestas y el
        // test media la suspension en lugar del saldo.
        market.ConfigureMaxLiabilityLimit(new Money(1_000_000m));

        _dbContext.Wallets.Add(wallet);
        _dbContext.Events.Add(@event);
        await _dbContext.SaveChangesAsync();
        _dbContext.ChangeTracker.Clear();

        return (walletId, selectionIds);
    }
}
