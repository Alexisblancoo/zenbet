namespace Zenbet.EventsMarkets.Integration.Tests.Concurrency;

using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Testcontainers.PostgreSql;
using Xunit;
using Zenbet.EventsMarkets.Application.Commands.PlaceBet;
using Zenbet.EventsMarkets.Application.Interfaces;
using Zenbet.EventsMarkets.Domain.Aggregates;
using Zenbet.EventsMarkets.Domain.Enums;
using Zenbet.EventsMarkets.Domain.Repositories;
using Zenbet.EventsMarkets.Domain.ValueObjects;
using Zenbet.EventsMarkets.Infrastructure.Concurrency;
using Zenbet.EventsMarkets.Infrastructure.Persistence;
using Zenbet.EventsMarkets.Infrastructure.Persistence.Outbox;
using Zenbet.EventsMarkets.Infrastructure.Persistence.Repositories;
using Zenbet.EventsMarkets.Infrastructure.Persistence.Services;
using DomainEventId = Zenbet.EventsMarkets.Domain.ValueObjects.EventId;

/// <summary>
/// Reproduce el modo de fallo medido con k6: muchas apuestas al MISMO mercado esperando el advisory lock
/// con una conexión cada una agotaban el pool de PostgreSQL. Con un pool de solo 10 conexiones y 60
/// apuestas simultáneas, la cola en memoria por mercado debe dejarlas pasar todas sin errores.
/// </summary>
public sealed class HotMarketPoolTests : IAsyncLifetime
{
    private const int ConcurrentBets = 60;

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
        services.AddLogging(b => b.SetMinimumLevel(LogLevel.Warning));

        // Pool deliberadamente pequeño: sin cola por mercado, 60 apuestas bloqueadas por el lock lo agotarían.
        var connectionString = _postgres.GetConnectionString() + ";Maximum Pool Size=10;Timeout=30";
        services.AddDbContext<EventsMarketsDbContext>(options => options.UseNpgsql(connectionString));

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
        services.AddSingleton<IMarketBetGate>(new MarketBetGate(Options.Create(new MarketBetGateOptions
        {
            MaxQueuePerMarket = 500,
            MaxWaitMilliseconds = 60_000,
        })));

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
    public async Task Sixty_Concurrent_Bets_On_One_Market_Succeed_With_A_Ten_Connection_Pool()
    {
        var selectionId = SelectionId.New();
        var eventId = DomainEventId.New();
        var @event = new Event(eventId, "Hot market", SportType.Football, DateTimeOffset.UtcNow.AddHours(2));
        var selections = new List<Selection>
        {
            new(selectionId, "Home", new Odd(2.0m, DateTimeOffset.UtcNow)),
            new(SelectionId.New(), "Away", new Odd(2.0m, DateTimeOffset.UtcNow)),
        };
        var market = @event.AddMarket("Match Winner", MarketType.MatchWinner, selections);
        // Esta prueba mide el pool, no el motor de riesgo.
        market.ConfigureMaxLiabilityLimit(new Money(1_000_000m));
        _dbContext.Events.Add(@event);

        var walletIds = new List<WalletId>();
        for (var i = 0; i < ConcurrentBets; i++)
        {
            var wallet = new Wallet(WalletId.New(), UserId.New());
            wallet.Deposit(new Money(1000m), $"seed {i}");
            _dbContext.Wallets.Add(wallet);
            walletIds.Add(wallet.Id);
        }

        await _dbContext.SaveChangesAsync();
        _dbContext.ChangeTracker.Clear();

        var tasks = walletIds.Select((walletId, i) => Task.Run(async () =>
        {
            using var scope = _serviceProvider.CreateScope();
            var mediator = scope.ServiceProvider.GetRequiredService<IMediator>();
            return await mediator.Send(new PlaceBetCommand(
                walletId,
                selectionId,
                new Money(10m),
                $"hot-{i}",
                Guid.NewGuid()));
        })).ToArray();

        var results = await Task.WhenAll(tasks).WaitAsync(TimeSpan.FromMinutes(2));

        Assert.All(results, result => Assert.True(result.Success, result.ErrorMessage));
        var stored = await _dbContext.Transactions.CountAsync(t => t.Type == TransactionType.BetPlacement);
        Assert.Equal(ConcurrentBets, stored);
    }
}
