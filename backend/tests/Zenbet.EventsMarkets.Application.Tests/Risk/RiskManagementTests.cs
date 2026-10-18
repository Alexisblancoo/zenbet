namespace Zenbet.EventsMarkets.Application.Tests.Risk;

using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Npgsql;
using Testcontainers.PostgreSql;
using Xunit;
using MediatR;
using Zenbet.EventsMarkets.Application.Behaviors;
using Zenbet.EventsMarkets.Application.Commands.PlaceBet;
using Zenbet.EventsMarkets.Application.Interfaces;
using Zenbet.EventsMarkets.Domain.Aggregates;
using Zenbet.EventsMarkets.Domain.Events;
using Zenbet.EventsMarkets.Domain.Enums;
using Zenbet.EventsMarkets.Domain.Repositories;
using Zenbet.EventsMarkets.Domain.ValueObjects;
using Zenbet.EventsMarkets.Infrastructure.Messaging;
using Zenbet.EventsMarkets.Infrastructure.Persistence;
using Zenbet.EventsMarkets.Infrastructure.Persistence.Outbox;
using Zenbet.EventsMarkets.Infrastructure.Persistence.Repositories;
using Zenbet.EventsMarkets.Infrastructure.Persistence.Services;
using DomainEventId = Zenbet.EventsMarkets.Domain.ValueObjects.EventId;

public sealed class RiskManagementTests : IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder()
        .WithImage("postgres:16-alpine")
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
        services.AddScoped<INotificationService, NoOpNotificationService>();
        services.AddScoped<IRiskManagementService, EfRiskManagementService>();

        services.Configure<RiskLimitsOptions>(o =>
        {
            o.MaxUserBetLimit = new Money(1000m);
            o.MaxMarketExposureLimit = new Money(10000m);
        });

        services.AddMediatR(cfg => 
        {
            cfg.RegisterServicesFromAssembly(typeof(PlaceBetCommandHandler).Assembly);
            cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(RiskValidationBehavior<,>));
        });

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
    public async Task PlaceBet_Exceeds_MaxUserBetLimit_Returns_Failure()
    {
        // Arrange
        var (walletId, selectionId) = await SeedWalletAndSelectionAsync();
        var excessAmount = new Money(1500m); // Exceeds 1000 limit

        var command = new PlaceBetCommand(
            walletId,
            selectionId,
            excessAmount,
            "test bet over limit",
            Guid.NewGuid());

        var mediator = _serviceProvider.GetRequiredService<IMediator>();

        // Act
        var result = await mediator.Send(command);

        // Assert
        Assert.False(result.Success);
        Assert.Contains("exceeds maximum allowed bet per user", result.ErrorMessage);
    }

    [Fact]
    public async Task PlaceBet_Within_MaxUserBetLimit_Succeeds()
    {
        // Arrange
        var (walletId, selectionId) = await SeedWalletAndSelectionAsync();
        var validAmount = new Money(500m); // Within 1000 limit

        var command = new PlaceBetCommand(
            walletId,
            selectionId,
            validAmount,
            "test bet within limit",
            Guid.NewGuid());

        var mediator = _serviceProvider.GetRequiredService<IMediator>();

        // Act
        var result = await mediator.Send(command);

        // Assert
        Assert.True(result.Success);
        Assert.NotNull(result.TransactionId);
    }

    [Fact]
    public async Task PlaceBet_Exceeds_MaxMarketExposure_Returns_Failure()
    {
        // Arrange: Create market with 10000 exposure limit
        // Place bets totaling 9000, then try to place another that would exceed 10000
        var (walletIds, selectionIds, marketId) = await SeedMarketWithBetsAsync();
        var winningSelectionId = selectionIds[0];
        var winningOdd = new Odd(2.0m, DateTimeOffset.UtcNow);
        await UpdateSelectionOddAsync(winningSelectionId, winningOdd);

        // Place 5 bets of 1000 each (total 10000 exposure at odd 2.0 = 20000, but wait...
        // Actually exposure = bet_amount * odd, so 5 * 1000 * 2.0 = 10000
        // Let's use odd 1.0 to make exposure = bet amount
        var testOdd = new Odd(1.0m, DateTimeOffset.UtcNow);
        await UpdateSelectionOddAsync(winningSelectionId, testOdd);

        // Place 9 bets of 1000 each = 9000 exposure
        for (int i = 0; i < 9; i++)
        {
            var betCommand = new PlaceBetCommand(
                walletIds[i],
                winningSelectionId,
                new Money(1000m),
                "exposure test",
                Guid.NewGuid());
            await _serviceProvider.GetRequiredService<IMediator>().Send(betCommand);
        }

        // Now try to place a 2000 bet (would exceed 10000 limit)
        var excessCommand = new PlaceBetCommand(
            walletIds[9],
            winningSelectionId,
            new Money(2000m),
            "exposure test exceed",
            Guid.NewGuid());

        var mediator = _serviceProvider.GetRequiredService<IMediator>();

        // Act
        var result = await mediator.Send(excessCommand);

        // Assert
        Assert.False(result.Success);
        Assert.Contains("exposure limit would be exceeded", result.ErrorMessage);
    }

    [Fact]
    public async Task PlaceBet_At_MaxMarketExposure_Limit_Succeeds()
    {
        // Arrange: Current exposure is 9000, limit is 10000
        var (walletIds, selectionIds, marketId) = await SeedMarketWithBetsAsync();
        var winningSelectionId = selectionIds[0];
        var testOdd = new Odd(1.0m, DateTimeOffset.UtcNow);
        await UpdateSelectionOddAsync(winningSelectionId, testOdd);

        // Place 9 bets of 1000 each = 9000 exposure
        for (int i = 0; i < 9; i++)
        {
            var betCommand = new PlaceBetCommand(
                walletIds[i],
                winningSelectionId,
                new Money(1000m),
                "exposure test at limit",
                Guid.NewGuid());
            await _serviceProvider.GetRequiredService<IMediator>().Send(betCommand);
        }

        // Now place exactly 1000 to reach limit
        var limitCommand = new PlaceBetCommand(
            walletIds[9],
            winningSelectionId,
            new Money(1000m),
            "exposure test at limit",
            Guid.NewGuid());

        var mediator = _serviceProvider.GetRequiredService<IMediator>();

        // Act
        var result = await mediator.Send(limitCommand);

        // Assert
        Assert.True(result.Success);
    }

    private async Task<(WalletId, SelectionId)> SeedWalletAndSelectionAsync()
    {
        var walletId = WalletId.New();
        var userId = UserId.New();
        var eventId = DomainEventId.New();
        var selectionIds = new[] { SelectionId.New(), SelectionId.New(), SelectionId.New() };

        var wallet = new Wallet(walletId, userId);
        wallet.Deposit(new Money(10000m), "Initial deposit for testing");

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

    private async Task<(WalletId[] walletIds, SelectionId[] selectionIds, MarketId marketId)> SeedMarketWithBetsAsync()
    {
        var walletIds = Enumerable.Range(0, 10).Select(_ => WalletId.New()).ToArray();
        var userIds = Enumerable.Range(0, 10).Select(_ => UserId.New()).ToArray();
        var eventId = DomainEventId.New();
        var selectionIds = new[] { SelectionId.New(), SelectionId.New(), SelectionId.New() };
        var marketId = MarketId.New();

        var wallets = new List<Wallet>();
        for (int i = 0; i < 10; i++)
        {
            var wallet = new Wallet(walletIds[i], userIds[i]);
            wallet.Deposit(new Money(50000m), "Initial deposit");
            wallets.Add(wallet);
        }

        var @event = new Event(eventId, "Test Match", SportType.Football, DateTimeOffset.UtcNow.AddHours(2));
        var selections = selectionIds
            .Select((id, i) => new Selection(id, i == 0 ? "Home" : i == 1 ? "Draw" : "Away", new Odd(1.0m, DateTimeOffset.UtcNow)))
            .ToList();

        var market = new Market(marketId, eventId, "Match Winner", MarketType.MatchWinner, selections);
        @event.AddMarket("Match Winner", MarketType.MatchWinner, selections);

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
}