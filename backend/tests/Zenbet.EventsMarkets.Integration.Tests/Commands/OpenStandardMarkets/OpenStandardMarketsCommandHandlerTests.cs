namespace Zenbet.EventsMarkets.Integration.Tests.Commands.OpenStandardMarkets;

using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Testcontainers.PostgreSql;
using Xunit;
using Zenbet.EventsMarkets.Application.Commands.OpenStandardMarkets;
using Zenbet.EventsMarkets.Application.Commands.PriceMarket;
using Zenbet.EventsMarkets.Application.Interfaces;
using Zenbet.EventsMarkets.Application.Queries.GetEventById;
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

public sealed class OpenStandardMarketsCommandHandlerTests : IAsyncLifetime
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
        services.AddScoped<IOutboxWriter, OutboxWriter>();
        services.AddScoped<IUnitOfWork, EfUnitOfWork>();
        services.AddScoped<IIdempotencyService, EfIdempotencyService>();
        services.AddScoped<IPendingPricingReader, PendingPricingReader>();
        services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(typeof(OpenStandardMarketsCommandHandler).Assembly));

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
    public async Task Opened_Markets_Are_Hidden_From_The_Public_Until_Priced_Then_Visible_And_Executable()
    {
        var eventId = await SeedFightAsync(DateTimeOffset.UtcNow.AddDays(3));

        var opened = await SendAsync(new OpenStandardMarketsCommand(eventId, "qaadmin (test)"));

        Assert.Equal(4, opened.Created.Count);
        Assert.Empty(opened.AlreadyPresent);
        // Cada mercado guarda su propia procedencia Pending (regresión: una instancia owned compartida solo se guardaba en uno).
        var kinds = await _dbContext.Markets.AsNoTracking().Where(m => m.EventId == eventId)
            .Select(m => m.Provenance == null ? (OddsSourceKind?)null : m.Provenance.Kind).ToListAsync();
        Assert.Equal(4, kinds.Count);
        Assert.All(kinds, k => Assert.Equal(OddsSourceKind.Pending, k));

        // Público: el combate existe pero sin mercados → la UI muestra "Cuotas próximamente".
        var publicBefore = await SendAsync(new GetEventByIdQuery(eventId.Value));
        Assert.NotNull(publicBefore);
        Assert.Empty(publicBefore!.Markets);

        // Bandeja del trader: los cuatro mercados con sus selecciones.
        var pending = await ReadPendingAsync();
        Assert.Equal(4, pending.Count(p => p.EventId == eventId.Value));

        var moneyline = opened.Created.Single(m => m.Selections.Any(s => s.Code == "red"));
        var price = await SendAsync(new PriceMarketCommand(
            MarketId.From(moneyline.MarketId),
            6m,
            moneyline.Selections.Select((s, i) => new SelectionProbability(SelectionId.From(s.SelectionId), i == 0 ? 0.6m : 0.4m)).ToList(),
            "trader (test)",
            null,
            Guid.NewGuid()));
        Assert.False(price.IdempotentReplay);

        var stored = await _dbContext.Markets.AsNoTracking().Include(m => m.Selections).SingleAsync(m => m.Id == MarketId.From(moneyline.MarketId));
        Assert.True(stored.IsExecutable);
        Assert.False(stored.IsAwaitingPricing);

        var publicAfter = await SendAsync(new GetEventByIdQuery(eventId.Value));
        var visible = Assert.Single(publicAfter!.Markets);
        Assert.Equal(moneyline.MarketId, visible.Id);
        Assert.All(visible.Selections, s => Assert.True(s.DecimalOdds > 1.0m));
        Assert.Equal(3, (await ReadPendingAsync()).Count(p => p.EventId == eventId.Value));
    }

    [Fact]
    public async Task Opening_Twice_Creates_Nothing_New()
    {
        var eventId = await SeedFightAsync(DateTimeOffset.UtcNow.AddDays(3));

        await SendAsync(new OpenStandardMarketsCommand(eventId, "qa"));
        var again = await SendAsync(new OpenStandardMarketsCommand(eventId, "qa"));

        Assert.Empty(again.Created);
        Assert.Equal(4, again.AlreadyPresent.Count);
        Assert.Equal(4, await _dbContext.Markets.CountAsync(m => m.EventId == eventId));
    }

    [Fact]
    public async Task Concurrent_Openings_Never_Duplicate_Markets()
    {
        var eventId = await SeedFightAsync(DateTimeOffset.UtcNow.AddDays(3));

        await Task.WhenAll(Enumerable.Range(0, 8).Select(_ => Task.Run(() => SendAsync(new OpenStandardMarketsCommand(eventId, "qa")))));

        Assert.Equal(4, await _dbContext.Markets.CountAsync(m => m.EventId == eventId));
    }

    [Fact]
    public async Task A_Fight_That_Already_Started_Is_Rejected()
    {
        var eventId = await SeedFightAsync(DateTimeOffset.UtcNow.AddMinutes(-5));

        await Assert.ThrowsAsync<MarketOpeningRejectedException>(() => SendAsync(new OpenStandardMarketsCommand(eventId, "qa")));
        Assert.Equal(0, await _dbContext.Markets.CountAsync(m => m.EventId == eventId));
    }

    [Fact]
    public async Task Upcoming_Opens_Only_Future_Fights_Within_The_Horizon()
    {
        var soon = await SeedFightAsync(DateTimeOffset.UtcNow.AddDays(2));
        var far = await SeedFightAsync(DateTimeOffset.UtcNow.AddDays(40));

        var result = await SendAsync(new OpenStandardMarketsForUpcomingCommand(14, "qa"));

        Assert.Equal(1, result.EventsWithNewMarkets);
        Assert.Equal(4, result.MarketsCreated);
        Assert.Equal(4, await _dbContext.Markets.CountAsync(m => m.EventId == soon));
        Assert.Equal(0, await _dbContext.Markets.CountAsync(m => m.EventId == far));
    }

    private async Task<T> SendAsync<T>(IRequest<T> request)
    {
        using var scope = _serviceProvider.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<IMediator>().Send(request);
    }

    private async Task<IReadOnlyList<PendingPricingMarketView>> ReadPendingAsync()
    {
        using var scope = _serviceProvider.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<IPendingPricingReader>().ListAsync(500);
    }

    private async Task<DomainEventId> SeedFightAsync(DateTimeOffset start)
    {
        var division = WeightDivision.Lightweight;
        var suffix = Guid.NewGuid().ToString("N")[..6];
        var red = Fighter.Create($"red-{suffix}", $"Red {suffix}", "MX", "México", "N/D", null, division);
        var blue = Fighter.Create($"blue-{suffix}", $"Blue {suffix}", "BR", "Brasil", "N/D", null, division);
        var bout = MmaBout.Create(red, blue, division, 3, isTitleFight: false, FightBilling.Main, 1, "Arena", "Ciudad");
        var @event = new Event(DomainEventId.New(), $"Red {suffix} vs Blue {suffix}", SportType.MixedMartialArts, start, "UFC Test", bout);

        _dbContext.Events.Add(@event);
        await _dbContext.SaveChangesAsync();
        _dbContext.ChangeTracker.Clear();
        return @event.Id;
    }
}
