namespace Zenbet.EventsMarkets.Infrastructure.Persistence.Seeding;

using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Zenbet.EventsMarkets.Domain.Aggregates;
using Zenbet.EventsMarkets.Domain.Enums;
using Zenbet.EventsMarkets.Domain.ValueObjects;
using DomainEventId = Zenbet.EventsMarkets.Domain.ValueObjects.EventId;

/// <summary>
/// Carga idempotente de la cartelera UFC 333. El JSON es un recurso embebido y
/// se valida antes de tocar PostgreSQL: división compartida, estructura de
/// mercados, cuotas y overround.
/// </summary>
public sealed class UfcCardSeeder : IHostedService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly UfcSeedOptions _options;
    private readonly ILogger<UfcCardSeeder> _logger;

    public UfcCardSeeder(
        IServiceScopeFactory scopeFactory,
        IOptions<UfcSeedOptions> options,
        ILogger<UfcCardSeeder> logger)
    {
        _scopeFactory = scopeFactory;
        _options = options.Value;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        if (!_options.Enabled)
            return;

        await using var scope = _scopeFactory.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<EventsMarketsDbContext>();

        if (_options.ApplyMigrations)
            await dbContext.Database.MigrateAsync(cancellationToken);

        var document = LoadDocument();
        Validate(document);

        var alreadySeeded = await dbContext.Events.AnyAsync(
            @event => @event.SportType == SportType.MixedMartialArts &&
                      @event.Competition == document.Card.Competition,
            cancellationToken);

        if (alreadySeeded)
        {
            _logger.LogInformation(
                "UFC seed already present for {Competition}; skipping.",
                document.Card.Competition);
            return;
        }

        var events = BuildEvents(document);

        // SaveChanges abre su propia transacción y pasa por la execution
        // strategy con reintentos. Abrir una transacción manual aquí rompe
        // NpgsqlRetryingExecutionStrategy (EnableRetryOnFailure).
        await dbContext.Events.AddRangeAsync(events, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Seeded {Bouts} UFC bouts and {Markets} markets for {Competition} from {CapturedAt}.",
            events.Count,
            events.Sum(@event => @event.Markets.Count),
            document.Card.Competition,
            document.Source.CapturedAt);
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;

    private static UfcSeedDocument LoadDocument()
    {
        var assembly = typeof(UfcCardSeeder).Assembly;
        var resourceName = "Zenbet.EventsMarkets.Infrastructure.Persistence.Seeding.Data.ufc-333.json";
        using var stream = assembly.GetManifestResourceStream(resourceName)
            ?? throw new InvalidOperationException($"No se encontró el recurso embebido '{resourceName}'.");
        using var reader = new StreamReader(stream);
        var json = reader.ReadToEnd();

        return JsonSerializer.Deserialize<UfcSeedDocument>(json, JsonOptions)
            ?? throw new InvalidOperationException("El seed UFC no pudo deserializarse.");
    }

    private static void Validate(UfcSeedDocument document)
    {
        if (document.SchemaVersion != 1)
            throw new InvalidOperationException($"Versión de seed UFC no soportada: {document.SchemaVersion}.");

        if (document.Source.CapturedAt == default)
            throw new InvalidOperationException("El seed UFC necesita capturedAt.");

        if (document.Bouts.Count == 0)
            throw new InvalidOperationException("El seed UFC no contiene combates.");

        var boutIds = new HashSet<string>(StringComparer.Ordinal);
        foreach (var bout in document.Bouts)
        {
            if (string.IsNullOrWhiteSpace(bout.Id) || !boutIds.Add(bout.Id))
                throw new InvalidOperationException($"Bout duplicado o vacío: '{bout.Id}'.");

            if (bout.Red.Id == bout.Blue.Id)
                throw new InvalidOperationException($"El bout {bout.Id} repite peleador.");

            var division = WeightDivisionCatalog.Parse(bout.Division);
            var redDivision = WeightDivisionCatalog.Parse(bout.Red.Division);
            var blueDivision = WeightDivisionCatalog.Parse(bout.Blue.Division);

            if (redDivision.Division != division.Division || blueDivision.Division != division.Division)
                throw new InvalidOperationException(
                    $"El bout {bout.Id} no comparte división oficial: " +
                    $"{redDivision.Label} vs {blueDivision.Label} / {division.Label}.");

            if (bout.Rounds is not (3 or 5))
                throw new InvalidOperationException($"El bout {bout.Id} declara rounds inválidos.");

            if (ParseBilling(bout.Billing) is not { } billing)
                throw new InvalidOperationException($"El bout {bout.Id} declara billing inválido.");

            if (bout.Order < 1)
                throw new InvalidOperationException($"El bout {bout.Id} declara orden inválido.");

            var marketTypes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var market in bout.Markets)
            {
                if (!marketTypes.Add(market.Type))
                    throw new InvalidOperationException($"Mercado duplicado {bout.Id}/{market.Type}.");

                var type = ParseMarketType(market.Type)
                    ?? throw new InvalidOperationException($"Mercado MMA no soportado: {market.Type}.");

                var expectedSelectionCount = type switch
                {
                    MarketType.MmaMoneyline => 2,
                    MarketType.MmaMethodOfVictory => 6,
                    MarketType.MmaTotalRounds => 2,
                    MarketType.MmaGoToDecision => 2,
                    _ => throw new InvalidOperationException($"Mercado MMA no soportado: {market.Type}.")
                };

                if (market.Selections.Count != expectedSelectionCount)
                    throw new InvalidOperationException(
                        $"El mercado {bout.Id}/{market.Type} debe tener {expectedSelectionCount} selecciones.");

                if (string.IsNullOrWhiteSpace(market.Provider))
                    throw new InvalidOperationException($"El mercado {bout.Id}/{market.Type} no declara proveedor.");

                if (type == MarketType.MmaTotalRounds && market.Line is null)
                    throw new InvalidOperationException($"El mercado {bout.Id}/{market.Type} necesita línea.");

                var codes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                var impliedSum = 0m;
                foreach (var selection in market.Selections)
                {
                    if (string.IsNullOrWhiteSpace(selection.Code) || !codes.Add(selection.Code))
                        throw new InvalidOperationException(
                            $"Selección duplicada o vacía en {bout.Id}/{market.Type}.");

                    if (string.IsNullOrWhiteSpace(selection.Name))
                        throw new InvalidOperationException(
                            $"Selección sin nombre en {bout.Id}/{market.Type}/{selection.Code}.");

                    if (selection.DecimalOdds <= 1m)
                        throw new InvalidOperationException(
                            $"Cuota inválida en {bout.Id}/{market.Type}/{selection.Code}.");

                    var expectedAmerican = AmericanOdds.FromDecimal(selection.DecimalOdds);
                    if (!string.Equals(selection.AmericanOdds, expectedAmerican, StringComparison.Ordinal))
                        throw new InvalidOperationException(
                            $"Cuota americana inconsistente en {bout.Id}/{market.Type}/{selection.Code}: " +
                            $"'{selection.AmericanOdds}' vs '{expectedAmerican}'.");

                    impliedSum += 1m / selection.DecimalOdds;
                }

                var (min, max) = type switch
                {
                    MarketType.MmaMethodOfVictory => (1.02m, 1.20m),
                    _ => (0.98m, 1.12m)
                };

                if (impliedSum < min || impliedSum > max)
                    throw new InvalidOperationException(
                        $"Overround fuera de rango en {bout.Id}/{market.Type}: {impliedSum:F4}.");
            }
        }
    }

    private static IReadOnlyList<Event> BuildEvents(UfcSeedDocument document)
    {
        var events = new List<Event>(document.Bouts.Count);
        var capturedAt = document.Source.CapturedAt;

        foreach (var boutSeed in document.Bouts)
        {
            var division = WeightDivisionCatalog.Parse(boutSeed.Division);
            var red = Fighter.Create(
                boutSeed.Red.Id,
                boutSeed.Red.Name,
                boutSeed.Red.CountryCode,
                boutSeed.Red.Country,
                boutSeed.Red.Record,
                boutSeed.Red.Rank,
                WeightDivisionCatalog.Parse(boutSeed.Red.Division).Division);
            var blue = Fighter.Create(
                boutSeed.Blue.Id,
                boutSeed.Blue.Name,
                boutSeed.Blue.CountryCode,
                boutSeed.Blue.Country,
                boutSeed.Blue.Record,
                boutSeed.Blue.Rank,
                WeightDivisionCatalog.Parse(boutSeed.Blue.Division).Division);
            var billing = ParseBilling(boutSeed.Billing)
                ?? throw new InvalidOperationException($"Billing inválido: {boutSeed.Billing}.");
            var bout = MmaBout.Create(
                red,
                blue,
                division.Division,
                boutSeed.Rounds,
                boutSeed.TitleFight,
                billing,
                boutSeed.Order,
                document.Card.Venue,
                document.Card.Location);

            var @event = new Event(
                DomainEventId.From(SeedIds.For($"event:{boutSeed.Id}")),
                boutSeed.Name,
                SportType.MixedMartialArts,
                boutSeed.StartTime,
                document.Card.Competition,
                bout);

            foreach (var marketSeed in boutSeed.Markets)
            {
                var marketType = ParseMarketType(marketSeed.Type)
                    ?? throw new InvalidOperationException($"Mercado MMA no soportado: {marketSeed.Type}.");

                var selections = marketSeed.Selections
                    .Select((selection, index) => new Selection(
                        SelectionId.From(SeedIds.For($"selection:{boutSeed.Id}:{marketSeed.Type}:{selection.Code}")),
                        selection.Name,
                        new Odd(selection.DecimalOdds, capturedAt, marketSeed.Provider),
                        selection.Code,
                        selection.DisplayOrder > 0 ? selection.DisplayOrder : index + 1))
                    .ToList();

                @event.AddMarket(
                    MarketId.From(SeedIds.For($"market:{boutSeed.Id}:{marketSeed.Type}")),
                    marketSeed.Name,
                    marketType,
                    selections,
                    marketSeed.Line,
                    marketSeed.DisplayOrder);
            }

            events.Add(@event);
        }

        return events;
    }

    private static MarketType? ParseMarketType(string value) => value.Trim().ToLowerInvariant() switch
    {
        "moneyline" => MarketType.MmaMoneyline,
        "method_of_victory" => MarketType.MmaMethodOfVictory,
        "total_rounds" => MarketType.MmaTotalRounds,
        "go_to_decision" => MarketType.MmaGoToDecision,
        _ => null
    };

    private static FightBilling? ParseBilling(string value) => value.Trim().ToLowerInvariant() switch
    {
        "main" => FightBilling.Main,
        "prelims" => FightBilling.Prelims,
        "early" => FightBilling.EarlyPrelims,
        _ => null
    };
}
