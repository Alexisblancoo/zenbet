namespace Zenbet.EventsMarkets.Integration.Tests.Commands.PriceMarket;

using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Testcontainers.PostgreSql;
using Xunit;
using Zenbet.EventsMarkets.Application.Commands.PriceMarket;
using Zenbet.EventsMarkets.Application.Interfaces;
using Zenbet.EventsMarkets.Domain.Aggregates;
using Zenbet.EventsMarkets.Domain.Enums;
using Zenbet.EventsMarkets.Domain.Exceptions;
using Zenbet.EventsMarkets.Domain.Pricing;
using Zenbet.EventsMarkets.Domain.Repositories;
using Zenbet.EventsMarkets.Domain.ValueObjects;
using Zenbet.EventsMarkets.Infrastructure.Persistence;
using Zenbet.EventsMarkets.Infrastructure.Persistence.Outbox;
using Zenbet.EventsMarkets.Infrastructure.Persistence.Repositories;
using Zenbet.EventsMarkets.Infrastructure.Persistence.Services;
using DomainEventId = Zenbet.EventsMarkets.Domain.ValueObjects.EventId;

public sealed class PriceMarketCommandHandlerTests : IAsyncLifetime
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
        services.AddLogging(b => b.SetMinimumLevel(LogLevel.Warning));
        services.AddDbContext<EventsMarketsDbContext>(options => options.UseNpgsql(_postgres.GetConnectionString()));
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
        services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(typeof(PriceMarketCommandHandler).Assembly));

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
    public async Task Pricing_A_Reference_Market_Applies_Odds_Marks_It_As_Operator_And_Emits_Events()
    {
        var (marketId, selectionIds) = await SeedReferenceMarketAsync();
        var outboxBefore = await _dbContext.OutboxMessages.CountAsync();

        var result = await SendAsync(new PriceMarketCommand(
            marketId,
            6m,
            Probabilities(selectionIds, 0.5m, 0.3m, 0.2m),
            "qaadmin (test)",
            "cartelera de prueba",
            Guid.NewGuid()));

        Assert.False(result.IdempotentReplay);
        Assert.True(result.OverroundPercent >= 6m);

        _dbContext.ChangeTracker.Clear();
        var market = await _dbContext.Markets.Include(m => m.Selections).SingleAsync(m => m.Id == marketId);

        Assert.Equal(OddsSourceKind.Operator, market.Provenance!.Kind);
        Assert.True(market.IsExecutable);
        Assert.Contains("qaadmin (test)", market.Provenance.Note);

        foreach (var priced in result.Selections)
        {
            var stored = market.Selections.Single(s => s.Id == priced.SelectionId);
            Assert.Equal(priced.DecimalOdds, stored.CurrentOdd.Value);
        }

        // Una cuota por selección llega a los clientes en vivo a través del outbox.
        Assert.Equal(outboxBefore + 3, await _dbContext.OutboxMessages.CountAsync());
    }

    [Fact]
    public async Task Repeating_The_Same_Command_Is_An_Idempotent_Replay_That_Changes_Nothing()
    {
        var (marketId, selectionIds) = await SeedReferenceMarketAsync();
        var command = new PriceMarketCommand(marketId, 5m, Probabilities(selectionIds, 0.5m, 0.3m, 0.2m), "qa", null, Guid.NewGuid());

        await SendAsync(command);
        var outboxAfterFirst = await _dbContext.OutboxMessages.CountAsync();
        var replay = await SendAsync(command);

        Assert.True(replay.IdempotentReplay);
        Assert.Equal(outboxAfterFirst, await _dbContext.OutboxMessages.CountAsync());
    }

    [Fact]
    public async Task Invalid_Probabilities_Are_Rejected_And_The_Market_Is_Left_Untouched()
    {
        var (marketId, selectionIds) = await SeedReferenceMarketAsync();

        await Assert.ThrowsAsync<InvalidPricingException>(() => SendAsync(new PriceMarketCommand(
            marketId, 5m, Probabilities(selectionIds, 0.6m, 0.4m, 0.2m), "qa", null, Guid.NewGuid())));

        await AssertMarketUntouchedAsync(marketId);
    }

    [Fact]
    public async Task A_Partial_Quote_Is_Rejected_And_The_Market_Is_Left_Untouched()
    {
        var (marketId, selectionIds) = await SeedReferenceMarketAsync();
        var partial = new[]
        {
            new SelectionProbability(selectionIds[0], 0.6m),
            new SelectionProbability(selectionIds[1], 0.4m),
        };

        await Assert.ThrowsAsync<InvalidPricingException>(() => SendAsync(
            new PriceMarketCommand(marketId, 5m, partial, "qa", null, Guid.NewGuid())));

        await AssertMarketUntouchedAsync(marketId);
    }

    [Fact]
    public async Task Pricing_A_Market_That_Does_Not_Exist_Fails_With_Market_Not_Found()
    {
        var (_, selectionIds) = await SeedReferenceMarketAsync();

        await Assert.ThrowsAsync<MarketNotFoundException>(() => SendAsync(new PriceMarketCommand(
            MarketId.New(), 5m, Probabilities(selectionIds, 0.5m, 0.3m, 0.2m), "qa", null, Guid.NewGuid())));
    }

    private async Task AssertMarketUntouchedAsync(MarketId marketId)
    {
        _dbContext.ChangeTracker.Clear();
        var market = await _dbContext.Markets.Include(m => m.Selections).SingleAsync(m => m.Id == marketId);

        Assert.Equal(OddsSourceKind.Model, market.Provenance!.Kind);
        Assert.False(market.IsExecutable);
        Assert.All(market.Selections, s => Assert.Equal(2.0m, s.CurrentOdd.Value));
    }

    private async Task<PriceMarketResult> SendAsync(PriceMarketCommand command)
    {
        using var scope = _serviceProvider.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<IMediator>().Send(command);
    }

    private static IReadOnlyList<SelectionProbability> Probabilities(IReadOnlyList<SelectionId> ids, params decimal[] values) =>
        ids.Select((id, i) => new SelectionProbability(id, values[i])).ToList();

    private async Task<(MarketId MarketId, IReadOnlyList<SelectionId> SelectionIds)> SeedReferenceMarketAsync()
    {
        var now = DateTimeOffset.UtcNow;
        var selectionIds = new[] { SelectionId.New(), SelectionId.New(), SelectionId.New() };
        var selections = selectionIds
            .Select((id, i) => new Selection(id, $"Opcion {i}", new Odd(2.0m, now)))
            .ToList();

        var @event = new Event(DomainEventId.New(), "Pricing test", SportType.MixedMartialArts, now.AddHours(5));
        var marketId = MarketId.New();
        @event.AddMarket(
            marketId,
            "Ganador",
            MarketType.MatchWinner,
            selections,
            line: null,
            displayOrder: 0,
            provenance: new MarketProvenance("ZenBet Reference", OddsSourceKind.Model, null, now, "linea de referencia"));

        _dbContext.Events.Add(@event);
        await _dbContext.SaveChangesAsync();
        _dbContext.ChangeTracker.Clear();

        return (marketId, selectionIds);
    }
}
