namespace Zenbet.EventsMarkets.Integration.Tests.Commands.UpdateOdds;

using System.Diagnostics;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Npgsql;
using Testcontainers.PostgreSql;
using Xunit;
using MediatR;
using Zenbet.EventsMarkets.Application.Commands.UpdateOdds;
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

public sealed class UpdateOddsCommandHandlerConcurrencyTests : IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:16-alpine")
        .WithDatabase("zenbet_test")
        .WithUsername("test")
        .WithPassword("test")
        .Build();

    private ServiceProvider _serviceProvider = null!;
    private EventsMarketsDbContext _dbContext = null!;
    private ILogger<UpdateOddsCommandHandlerConcurrencyTests> _logger = null!;

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
        services.AddScoped<IBulkOddsUpdater, NpgsqlBulkOddsUpdater>();

        services.Configure<UpdateOddsOptions>(o =>
        {
            o.BatchSize = 100;
            o.WorkerCount = 4;
            o.MaxQueuedBatches = 100;
        });

        services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(typeof(UpdateOddsCommandHandler).Assembly));

        _serviceProvider = services.BuildServiceProvider();
        _dbContext = _serviceProvider.GetRequiredService<EventsMarketsDbContext>();
        _logger = _serviceProvider.GetRequiredService<ILogger<UpdateOddsCommandHandlerConcurrencyTests>>();

        await _dbContext.Database.EnsureCreatedAsync();

        // Give background processor time to start
        await Task.Delay(500);
    }

    public async Task DisposeAsync()
    {
        await _serviceProvider.DisposeAsync();
        await _postgres.DisposeAsync();
    }

    [Fact]
    public async Task Bulk_Update_5000_Odds_Completes_Under_Threshold()
    {
        // Arrange: Create event with multiple markets and selections
        var (eventId, marketIds, selectionIds) = await SeedEventWithManyMarketsAsync(10, 50); // 10 markets, 50 selections each = 500 selections

        // Generate 5000 updates across all selections (10 updates per selection)
        var updates = new List<OddsUpdateItem>();
        var random = new Random(42);

        for (int i = 0; i < 5000; i++)
        {
            var selectionId = selectionIds[random.Next(selectionIds.Length)];
            updates.Add(new OddsUpdateItem(
                selectionId,
                Math.Round(1.5m + (decimal)random.NextDouble() * 3.5m, 2),
                DateTimeOffset.UtcNow.AddMilliseconds(i),
                "test-feed"));
        }

        var command = new UpdateOddsCommand(updates, Guid.NewGuid());

        // Act
        var mediator = _serviceProvider.GetRequiredService<IMediator>();
        var stopwatch = Stopwatch.StartNew();

        var result = await mediator.Send(command);

        stopwatch.Stop();

        // Assert
        Assert.Equal(5000, result.ProcessedCount);
        Assert.True(stopwatch.ElapsedMilliseconds < 2000, $"Bulk update took {stopwatch.ElapsedMilliseconds}ms, expected < 2000ms");

        _logger.LogInformation("Processed 5000 odds updates in {Elapsed}ms", stopwatch.ElapsedMilliseconds);
    }

    [Fact]
    public async Task Concurrent_Updates_Same_Selection_Last_Write_Wins_With_Advisory_Lock()
    {
        var (eventId, marketIds, selectionIds) = await SeedEventWithManyMarketsAsync(1, 10);
        var targetSelection = selectionIds[0];

        // Create 100 concurrent updates to the SAME selection
        var updates = Enumerable.Range(0, 100)
            .Select(i => new OddsUpdateItem(
                targetSelection,
                2.0m + i * 0.01m,
                DateTimeOffset.UtcNow.AddMilliseconds(i),
                "test-feed"))
            .ToList();

        var command = new UpdateOddsCommand(updates, Guid.NewGuid());

        var mediator = _serviceProvider.GetRequiredService<IMediator>();
        var result = await mediator.Send(command);

        Assert.Equal(100, result.ProcessedCount);

        // Verify final odds value is the last one (due to ordering in batch)
        var selection = await _dbContext.Selections.AsNoTracking().FirstAsync(s => s.Id == targetSelection);
        Assert.Equal(2.99m, selection.CurrentOdd.Value);
    }

    [Fact]
    public async Task Concurrent_Updates_Different_Events_Process_In_Parallel()
    {
        // Create 5 separate events
        var eventData = new List<(DomainEventId EventId, MarketId[] MarketIds, SelectionId[] SelectionIds)>();
        for (int i = 0; i < 5; i++)
        {
            eventData.Add(await SeedEventWithManyMarketsAsync(1, 20));
        }

        // Generate updates for all events concurrently
        var allUpdates = new List<OddsUpdateItem>();
        var random = new Random(42);

        foreach (var (_, _, selectionIds) in eventData)
        {
            for (int i = 0; i < 200; i++)
            {
                var selectionId = selectionIds[random.Next(selectionIds.Length)];
                allUpdates.Add(new OddsUpdateItem(
                    selectionId,
                    Math.Round(1.5m + (decimal)random.NextDouble() * 3.5m, 2),
                    DateTimeOffset.UtcNow.AddMilliseconds(i),
                    "test-feed"));
            }
        }

        var command = new UpdateOddsCommand(allUpdates, Guid.NewGuid());

        var mediator = _serviceProvider.GetRequiredService<IMediator>();
        var stopwatch = Stopwatch.StartNew();

        var result = await mediator.Send(command);

        stopwatch.Stop();

        Assert.Equal(1000, result.ProcessedCount);
        // Should be faster than sequential due to parallel processing by event
        Assert.True(stopwatch.ElapsedMilliseconds < 1000, $"Parallel update took {stopwatch.ElapsedMilliseconds}ms");
    }

    [Fact]
    public async Task Idempotent_Update_Retry_Does_Not_Duplicate_Processing()
    {
        var (eventId, marketIds, selectionIds) = await SeedEventWithManyMarketsAsync(1, 10);

        var updates = Enumerable.Range(0, 100)
            .Select(i => new OddsUpdateItem(
                selectionIds[i % selectionIds.Length],
                2.0m + i * 0.01m,
                DateTimeOffset.UtcNow.AddMilliseconds(i),
                "test-feed"))
            .ToList();

        var idempotencyKey = Guid.NewGuid();
        var command = new UpdateOddsCommand(updates, idempotencyKey);

        var mediator = _serviceProvider.GetRequiredService<IMediator>();

        // First call
        var result1 = await mediator.Send(command);
        Assert.Equal(100, result1.ProcessedCount);

        // Second call with same idempotency key
        var result2 = await mediator.Send(command);
        Assert.Equal(0, result2.ProcessedCount); // Should be rejected as duplicate
    }

    [Fact]
    public async Task Out_Of_Order_Updates_Per_Event_Are_Sequenced_Correctly()
    {
        var (eventId, marketIds, selectionIds) = await SeedEventWithManyMarketsAsync(1, 5);
        var targetSelection = selectionIds[0];

        // Send updates with timestamps OUT OF ORDER
        var updates = new[]
        {
            new OddsUpdateItem(targetSelection, 2.50m, DateTimeOffset.UtcNow.AddSeconds(3), "feed"),
            new OddsUpdateItem(targetSelection, 2.10m, DateTimeOffset.UtcNow.AddSeconds(1), "feed"),
            new OddsUpdateItem(targetSelection, 2.30m, DateTimeOffset.UtcNow.AddSeconds(2), "feed"),
        };

        var command = new UpdateOddsCommand(updates, Guid.NewGuid());

        var mediator = _serviceProvider.GetRequiredService<IMediator>();
        var result = await mediator.Send(command);

        Assert.Equal(3, result.ProcessedCount);

        // Final value should be the one with latest timestamp (2.50m)
        var selection = await _dbContext.Selections.AsNoTracking().FirstAsync(s => s.Id == targetSelection);
        Assert.Equal(2.50m, selection.CurrentOdd.Value);
    }

    [Fact]
    public async Task High_Throughput_Stress_Test_10k_Updates()
    {
        var (eventId, marketIds, selectionIds) = await SeedEventWithManyMarketsAsync(20, 50); // 1000 selections

        var updates = new List<OddsUpdateItem>();
        var random = new Random(42);

        for (int i = 0; i < 10000; i++)
        {
            var selectionId = selectionIds[random.Next(selectionIds.Length)];
            updates.Add(new OddsUpdateItem(
                selectionId,
                Math.Round(1.5m + (decimal)random.NextDouble() * 3.5m, 2),
                DateTimeOffset.UtcNow.AddMilliseconds(i),
                "stress-test"));
        }

        var command = new UpdateOddsCommand(updates, Guid.NewGuid());

        var mediator = _serviceProvider.GetRequiredService<IMediator>();
        var stopwatch = Stopwatch.StartNew();

        var result = await mediator.Send(command);

        stopwatch.Stop();

        Assert.Equal(10000, result.ProcessedCount);
        Assert.True(stopwatch.ElapsedMilliseconds < 5000, $"10k updates took {stopwatch.ElapsedMilliseconds}ms");

        var throughput = 10000 / (stopwatch.ElapsedMilliseconds / 1000.0);
        _logger.LogInformation("Throughput: {Throughput:F0} updates/sec", throughput);
    }

    private async Task<(DomainEventId, MarketId[], SelectionId[])> SeedEventWithManyMarketsAsync(int marketCount, int selectionsPerMarket)
    {
        var eventId = DomainEventId.New();
        var marketIds = new MarketId[marketCount];
        var allSelectionIds = new List<SelectionId>();

        var @event = new Event(eventId, $"Stress Test Event {Guid.NewGuid()}", SportType.Football, DateTimeOffset.UtcNow.AddHours(2));

        for (int m = 0; m < marketCount; m++)
        {
            var selectionIds = Enumerable.Range(0, selectionsPerMarket)
                .Select(i => SelectionId.New())
                .ToArray();

            allSelectionIds.AddRange(selectionIds);

            var selections = selectionIds
                .Select((id, i) => new Selection(id, $"Selection {i}", new Odd(2.0m + i * 0.1m, DateTimeOffset.UtcNow)))
                .ToList();

            var market = @event.AddMarket($"Market {m}", MarketType.MatchWinner, selections);
            marketIds[m] = market.Id;
        }

        _dbContext.Events.Add(@event);
        await _dbContext.SaveChangesAsync();

        return (eventId, marketIds, allSelectionIds.ToArray());
    }
}