namespace Zenbet.EventsMarkets.Application.Tests.Commands.SettleMarket;

using System.Diagnostics;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Npgsql;
using Testcontainers.PostgreSql;
using Xunit;
using MediatR;
using Zenbet.EventsMarkets.Application.Commands.SettleMarket;
using Zenbet.EventsMarkets.Application.Interfaces;
using Zenbet.EventsMarkets.Domain.Aggregates;
using Zenbet.EventsMarkets.Domain.Enums;
using Zenbet.EventsMarkets.Domain.Repositories;
using Zenbet.EventsMarkets.Domain.ValueObjects;
using Zenbet.EventsMarkets.Infrastructure.Persistence;
using Zenbet.EventsMarkets.Infrastructure.Persistence.Repositories;
using Zenbet.EventsMarkets.Infrastructure.Persistence.Outbox;
using Zenbet.EventsMarkets.Infrastructure.Persistence.Services;
using DomainEventId = Zenbet.EventsMarkets.Domain.ValueObjects.EventId;

public sealed class SettleMarketCommandHandlerConcurrencyTests : IAsyncLifetime
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
        services.AddScoped<IOutboxWriter, OutboxWriter>();
        services.AddScoped<IInboxWriter, InboxWriter>();
        services.AddScoped<IUnitOfWork, EfUnitOfWork>();
        services.AddScoped<IIdempotencyService, EfIdempotencyService>();
        services.AddScoped<ISettlementAuditService, EfSettlementAuditService>();

        services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(typeof(SettleMarketCommandHandler).Assembly));

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
    public async Task Concurrent_Settlement_Only_One_Succeeds_With_Atomic_Update()
    {
        // Arrange: Create event with market and selections
        var (eventId, marketId, selectionIds) = await SeedEventWithMarketAsync();

        var winnerId = selectionIds[0];
        var idempotencyKey1 = Guid.NewGuid();
        var idempotencyKey2 = Guid.NewGuid();

        var command1 = new SettleMarketCommand(marketId, winnerId, SettlementResult.Won, "system", idempotencyKey1);
        var command2 = new SettleMarketCommand(marketId, winnerId, SettlementResult.Won, "system", idempotencyKey2);

        // Act: Fire both concurrently with isolated scopes
        var task1 = Task.Run(async () =>
        {
            using var scope = _serviceProvider.CreateScope();
            var mediator = scope.ServiceProvider.GetRequiredService<IMediator>();
            try { return await mediator.Send(command1); } catch { return null; }
        });
        var task2 = Task.Run(async () =>
        {
            using var scope = _serviceProvider.CreateScope();
            var mediator = scope.ServiceProvider.GetRequiredService<IMediator>();
            try { return await mediator.Send(command2); } catch { return null; }
        });

        var results = await Task.WhenAll(task1, task2);

        // Assert: Exactly one succeeds, other gets concurrency exception or idempotent result
        var successCount = results.Count(r => r != null);
        Assert.Equal(1, successCount);

        // Verify market is settled in DB
        var market = await _dbContext.Markets.AsNoTracking().FirstAsync(m => m.Id == marketId);
        Assert.Equal(MarketStatus.Settled, market.Status);
        Assert.Equal(winnerId, market.WinnerSelectionId);
    }

    [Fact]
    public async Task Concurrent_Settlement_Different_Winners_First_Wins()
    {
        var (eventId, marketId, selectionIds) = await SeedEventWithMarketAsync();

        var command1 = new SettleMarketCommand(marketId, selectionIds[0], SettlementResult.Won, "system", Guid.NewGuid());
        var command2 = new SettleMarketCommand(marketId, selectionIds[1], SettlementResult.Won, "system", Guid.NewGuid());

        var task1 = Task.Run(async () =>
        {
            using var scope = _serviceProvider.CreateScope();
            var mediator = scope.ServiceProvider.GetRequiredService<IMediator>();
            try { return await mediator.Send(command1); } catch { return null; }
        });
        var task2 = Task.Run(async () =>
        {
            using var scope = _serviceProvider.CreateScope();
            var mediator = scope.ServiceProvider.GetRequiredService<IMediator>();
            try { return await mediator.Send(command2); } catch { return null; }
        });

        var results = await Task.WhenAll(task1, task2);

        var successCount = results.Count(r => r != null);
        Assert.Equal(1, successCount);

        // Verify the winner is one of the two (whichever got the lock first)
        var market = await _dbContext.Markets.AsNoTracking().FirstAsync(m => m.Id == marketId);
        Assert.Contains(market.WinnerSelectionId!.Value, new[] { selectionIds[0].Value, selectionIds[1].Value });
    }

    [Fact]
    public async Task Idempotent_Retry_Returns_Cached_Result_Without_Domain_Execution()
    {
        var (eventId, marketId, selectionIds) = await SeedEventWithMarketAsync();

        var idempotencyKey = Guid.NewGuid();
        var command = new SettleMarketCommand(marketId, selectionIds[0], SettlementResult.Won, "system", idempotencyKey);

        var mediator = _serviceProvider.GetRequiredService<IMediator>();

        // First call
        var result1 = await mediator.Send(command);
        Assert.NotNull(result1);

        // Second call with same idempotency key
        var result2 = await mediator.Send(command);
        Assert.NotNull(result2);
        Assert.Equal(result1.MarketId, result2.MarketId);
        Assert.Equal(result1.WinnerSelectionId, result2.WinnerSelectionId);

        // Verify only one audit entry exists
        var auditCount = await _dbContext.SettlementAudit.CountAsync(a => a.IdempotencyKey == idempotencyKey.ToString());
        Assert.Equal(1, auditCount);
    }

    [Fact]
    public async Task High_Concurrency_Settlement_100_Parallel_Requests_Exactly_One_Succeeds()
    {
        var (eventId, marketId, selectionIds) = await SeedEventWithMarketAsync();

        const int concurrency = 100;
        var commands = Enumerable.Range(0, concurrency)
            .Select(i => new SettleMarketCommand(marketId, selectionIds[0], SettlementResult.Won, "system", Guid.NewGuid()))
            .ToArray();

        var tasks = commands.Select(c => Task.Run(async () =>
        {
            using var scope = _serviceProvider.CreateScope();
            var mediator = scope.ServiceProvider.GetRequiredService<IMediator>();
            try { return await mediator.Send(c); } catch { return null; }
        })).ToArray();
        var results = await Task.WhenAll(tasks);

        var successCount = results.Count(r => r != null);
        Assert.Equal(1, successCount);

        var market = await _dbContext.Markets.AsNoTracking().FirstAsync(m => m.Id == marketId);
        Assert.Equal(MarketStatus.Settled, market.Status);
    }

    [Fact]
    public async Task Settlement_After_Void_Throws_InvalidOperation()
    {
        var (eventId, marketId, selectionIds) = await SeedEventWithMarketAsync();

        // First void the market
        var market = await _dbContext.Markets.Include(m => m.Selections).FirstAsync(m => m.Id == marketId);
        market.Void("Test void", "system");
        await _dbContext.SaveChangesAsync();

        var mediator = _serviceProvider.GetRequiredService<IMediator>();
        var command = new SettleMarketCommand(marketId, selectionIds[0], SettlementResult.Won, "system", Guid.NewGuid());

        await Assert.ThrowsAsync<InvalidOperationException>(() => mediator.Send(command));
    }

    private async Task<(DomainEventId, MarketId, SelectionId[])> SeedEventWithMarketAsync()
    {
        var eventId = DomainEventId.New();
        var selectionIds = new[] { SelectionId.New(), SelectionId.New(), SelectionId.New() };

        var @event = new Event(eventId, "Test Match", SportType.Football, DateTimeOffset.UtcNow.AddHours(2));
        var selections = selectionIds
            .Select((id, i) => new Selection(id, i == 0 ? "Home" : i == 1 ? "Draw" : "Away", new Odd(2.0m + i * 0.5m, DateTimeOffset.UtcNow)))
            .ToList();

        var market = @event.AddMarket("Match Winner", MarketType.MatchWinner, selections);

        _dbContext.Events.Add(@event);
        await _dbContext.SaveChangesAsync();
        _dbContext.ChangeTracker.Clear();

        return (eventId, market.Id, selectionIds);
    }
}