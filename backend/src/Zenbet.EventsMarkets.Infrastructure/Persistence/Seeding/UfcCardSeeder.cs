namespace Zenbet.EventsMarkets.Infrastructure.Persistence.Seeding;

using System.Reflection;
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
/// Carga los snapshots embebidos de las carteleras UFC. Cada archivo JSON es
/// una cartelera independiente y se valida antes de tocar PostgreSQL:
/// división compartida, estructura de mercados, fuentes, cuotas
/// americanas/decimales, overround y URLs de imagen.
///
/// La carga es un upsert por IDs deterministas. Si la versión de una cartelera
/// ya está aplicada no se reescriben cuotas vivas; para refrescar un snapshot
/// se usa <see cref="UfcSeedOptions.ForceRefresh"/>.
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

        var assembly = typeof(UfcCardSeeder).Assembly;
        var resourceNames = ResolveResourceNames(assembly);
        var documents = new List<(string ResourceName, UfcSeedDocument Document,
            IReadOnlyDictionary<string, UfcSeedSource> Sources)>();

        var seedKeys = new HashSet<string>(StringComparer.Ordinal);
        var boutIds = new HashSet<string>(StringComparer.Ordinal);
        foreach (var resourceName in resourceNames)
        {
            var document = LoadDocument(assembly, resourceName);
            var sources = Validate(document);

            if (!seedKeys.Add(document.Card.SeedKey))
                throw new InvalidOperationException(
                    $"La clave de cartelera '{document.Card.SeedKey}' está repetida en los snapshots UFC.");

            foreach (var bout in document.Bouts)
            {
                if (!boutIds.Add(bout.Id))
                    throw new InvalidOperationException(
                        $"El combate '{bout.Id}' está repetido entre carteleras UFC.");
            }

            documents.Add((resourceName, document, sources));
        }

        foreach (var (resourceName, document, sources) in documents)
        {
            await ApplyDocumentAsync(
                dbContext,
                document,
                sources,
                resourceName,
                cancellationToken);

            // Cada cartelera se guarda en su propia transacción para que un
            // fallo de una no revierta las anteriores ya verificadas.
            await dbContext.SaveChangesAsync(cancellationToken);
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;

    private async Task ApplyDocumentAsync(
        EventsMarketsDbContext dbContext,
        UfcSeedDocument document,
        IReadOnlyDictionary<string, UfcSeedSource> sources,
        string resourceName,
        CancellationToken cancellationToken)
    {
        var state = await dbContext.UfcSeedStates
            .FirstOrDefaultAsync(item => item.Key == document.Card.SeedKey, cancellationToken);

        if (!_options.ForceRefresh && state is not null && state.Version >= document.SchemaVersion)
        {
            _logger.LogInformation(
                "UFC seed {Version} already applied for {Competition}; skipping {Resource}.",
                state.Version,
                document.Card.Competition,
                resourceName);
            return;
        }

        var existingEvents = await dbContext.Events
            .Include(@event => @event.Markets)
            .ThenInclude(market => market.Selections)
            .Where(@event => @event.SportType == SportType.MixedMartialArts &&
                             @event.Competition == document.Card.Competition)
            .ToListAsync(cancellationToken);

        var eventsById = existingEvents.ToDictionary(@event => @event.Id.Value);
        var addedBouts = 0;
        var updatedBouts = 0;
        var addedMarkets = 0;
        var updatedMarkets = 0;
        var addedSelections = 0;
        var updatedSelections = 0;

        foreach (var boutSeed in document.Bouts)
        {
            var eventId = DomainEventId.From(SeedIds.For($"event:{boutSeed.Id}"));
            if (!eventsById.TryGetValue(eventId.Value, out var @event))
            {
                @event = BuildEvent(boutSeed, document, sources, out var marketCount, out var selectionCount);
                dbContext.Events.Add(@event);
                eventsById[eventId.Value] = @event;
                addedBouts++;
                addedMarkets += marketCount;
                addedSelections += selectionCount;
                continue;
            }

            UpsertEvent(
                @event,
                boutSeed,
                sources,
                ref addedMarkets,
                ref updatedMarkets,
                ref addedSelections,
                ref updatedSelections);
            updatedBouts++;
        }

        var observedAt = document.Sources
            .Select(source => source.ObservedAt)
            .DefaultIfEmpty(DateTimeOffset.UtcNow)
            .Max();

        if (state is null)
        {
            dbContext.UfcSeedStates.Add(new UfcSeedState
            {
                Key = document.Card.SeedKey,
                Version = document.SchemaVersion,
                AppliedAt = DateTimeOffset.UtcNow,
                SourceObservedAt = observedAt
            });
        }
        else
        {
            state.Version = document.SchemaVersion;
            state.AppliedAt = DateTimeOffset.UtcNow;
            state.SourceObservedAt = observedAt;
        }

        _logger.LogInformation(
            "UFC seed {Version} applied for {Competition} from {Resource}: {AddedBouts} added bouts, " +
            "{UpdatedBouts} updated bouts, {AddedMarkets} added markets, " +
            "{UpdatedMarkets} updated markets, {AddedSelections} added selections, " +
            "{UpdatedSelections} updated selections, snapshot {ObservedAt}.",
            document.SchemaVersion,
            document.Card.Competition,
            resourceName,
            addedBouts,
            updatedBouts,
            addedMarkets,
            updatedMarkets,
            addedSelections,
            updatedSelections,
            observedAt);
    }

    private IReadOnlyList<string> ResolveResourceNames(Assembly assembly)
    {
        var configured = _options.Resources
            .Where(resource => !string.IsNullOrWhiteSpace(resource))
            .Select(resource => resource.Trim())
            .Distinct(StringComparer.Ordinal)
            .ToList();

        if (configured.Count > 0)
            return configured;

        var discovered = assembly.GetManifestResourceNames()
            .Where(name =>
                name.StartsWith(_options.ResourcePrefix, StringComparison.Ordinal) &&
                name.EndsWith(".json", StringComparison.OrdinalIgnoreCase))
            .OrderBy(name => name, StringComparer.Ordinal)
            .ToList();

        if (discovered.Count == 0)
            throw new InvalidOperationException(
                $"No se encontraron snapshots UFC embebidos bajo '{_options.ResourcePrefix}'.");

        return discovered;
    }

    private static UfcSeedDocument LoadDocument(Assembly assembly, string resourceName)
    {
        using var stream = assembly.GetManifestResourceStream(resourceName)
            ?? throw new InvalidOperationException($"No se encontró el recurso embebido '{resourceName}'.");
        using var reader = new StreamReader(stream);
        var json = reader.ReadToEnd();

        return JsonSerializer.Deserialize<UfcSeedDocument>(json, JsonOptions)
            ?? throw new InvalidOperationException($"El seed UFC '{resourceName}' no pudo deserializarse.");
    }

    private static IReadOnlyDictionary<string, UfcSeedSource> Validate(UfcSeedDocument document)
    {
        if (document.SchemaVersion != 4)
            throw new InvalidOperationException($"Versión de seed UFC no soportada: {document.SchemaVersion}.");

        if (string.IsNullOrWhiteSpace(document.Card.SeedKey) ||
            document.Card.SeedKey.Any(character =>
                !char.IsLetterOrDigit(character) && character is not '-' and not '_'))
        {
            throw new InvalidOperationException(
                $"La cartelera '{document.Card.Competition}' necesita una seedKey estable.");
        }

        if (document.Bouts.Count == 0)
            throw new InvalidOperationException(
                $"El seed UFC '{document.Card.SeedKey}' no contiene combates.");

        var sources = new Dictionary<string, UfcSeedSource>(StringComparer.Ordinal);
        foreach (var source in document.Sources)
        {
            if (string.IsNullOrWhiteSpace(source.Id) || !sources.TryAdd(source.Id, source))
                throw new InvalidOperationException($"Fuente duplicada o vacía: '{source.Id}'.");

            if (string.IsNullOrWhiteSpace(source.Name))
                throw new InvalidOperationException($"La fuente '{source.Id}' no declara nombre.");

            if (source.ObservedAt == default)
                throw new InvalidOperationException($"La fuente '{source.Id}' no declara observedAt.");

            var kind = ParseSourceKind(source.Kind)
                ?? throw new InvalidOperationException($"Tipo de fuente no soportado: '{source.Kind}'.");

            if (kind is OddsSourceKind.Bookmaker or OddsSourceKind.Aggregator or OddsSourceKind.Exchange &&
                string.IsNullOrWhiteSpace(source.Url))
                throw new InvalidOperationException($"La fuente publicada '{source.Id}' necesita URL.");
        }

        var boutIds = new HashSet<string>(StringComparer.Ordinal);
        foreach (var bout in document.Bouts)
        {
            if (string.IsNullOrWhiteSpace(bout.Id) || !boutIds.Add(bout.Id))
                throw new InvalidOperationException($"Bout duplicado o vacío: '{bout.Id}'.");

            if (bout.Red.Id == bout.Blue.Id)
                throw new InvalidOperationException($"El bout {bout.Id} repite peleador.");

            ValidateImageUrl(bout.Id, "red", bout.Fighter1ImageUrl ?? bout.Red.ImageUrl);
            ValidateImageUrl(bout.Id, "blue", bout.Fighter2ImageUrl ?? bout.Blue.ImageUrl);
            ValidateFighterMetrics(bout.Id, "red", bout.Red);
            ValidateFighterMetrics(bout.Id, "blue", bout.Blue);

            var division = WeightDivisionCatalog.Parse(bout.Division);
            var redDivision = WeightDivisionCatalog.Parse(bout.Red.Division);
            var blueDivision = WeightDivisionCatalog.Parse(bout.Blue.Division);

            if (redDivision.Division != division.Division || blueDivision.Division != division.Division)
                throw new InvalidOperationException(
                    $"El bout {bout.Id} no comparte división oficial: " +
                    $"{redDivision.Label} vs {blueDivision.Label} / {division.Label}.");

            if (bout.Rounds is not (3 or 5))
                throw new InvalidOperationException($"El bout {bout.Id} declara rounds inválidos.");

            if (ParseBilling(bout.Billing) is null)
                throw new InvalidOperationException($"El bout {bout.Id} declara billing inválido.");

            if (bout.Order < 1)
                throw new InvalidOperationException($"El bout {bout.Id} declara orden inválido.");

            if (string.IsNullOrWhiteSpace(bout.SourceId) || !sources.ContainsKey(bout.SourceId))
                throw new InvalidOperationException($"El bout {bout.Id} no declara una fuente válida.");

            var marketTypes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var market in bout.Markets)
            {
                if (!marketTypes.Add(market.Type))
                    throw new InvalidOperationException($"Mercado duplicado {bout.Id}/{market.Type}.");

                var type = ParseMarketType(market.Type)
                    ?? throw new InvalidOperationException($"Mercado MMA no soportado: {market.Type}.");

                var sourceId = string.IsNullOrWhiteSpace(market.SourceId) ? bout.SourceId : market.SourceId;
                if (!sources.ContainsKey(sourceId))
                    throw new InvalidOperationException(
                        $"El mercado {bout.Id}/{market.Type} referencia una fuente inexistente: '{sourceId}'.");

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

                if (type == MarketType.MmaTotalRounds &&
                    (market.Line is null || market.Line <= 0.5m || market.Line >= bout.Rounds))
                    throw new InvalidOperationException(
                        $"El mercado {bout.Id}/{market.Type} necesita una línea válida para {bout.Rounds} asaltos.");

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

                    if (!AmericanOdds.TryParse(selection.AmericanOdds, out var american))
                        throw new InvalidOperationException(
                            $"Cuota americana inválida en {bout.Id}/{market.Type}/{selection.Code}.");

                    var expectedDecimal = AmericanOdds.ToDecimal(american);
                    if (Math.Abs(selection.DecimalOdds - expectedDecimal) > 0.00005m)
                        throw new InvalidOperationException(
                            $"Cuota decimal inconsistente en {bout.Id}/{market.Type}/{selection.Code}: " +
                            $"{selection.DecimalOdds} vs {expectedDecimal}.");

                    var expectedAmerican = AmericanOdds.FromDecimal(selection.DecimalOdds);
                    if (!string.Equals(selection.AmericanOdds.Trim(), expectedAmerican, StringComparison.Ordinal))
                        throw new InvalidOperationException(
                            $"Cuota americana inconsistente en {bout.Id}/{market.Type}/{selection.Code}: " +
                            $"'{selection.AmericanOdds}' vs '{expectedAmerican}'.");

                    impliedSum += 1m / selection.DecimalOdds;
                }

                var (min, max) = type switch
                {
                    MarketType.MmaMethodOfVictory => (1.02m, 1.25m),
                    _ => (0.98m, 1.12m)
                };

                if (impliedSum < min || impliedSum > max)
                    throw new InvalidOperationException(
                        $"Overround fuera de rango en {bout.Id}/{market.Type}: {impliedSum:F4}.");
            }
        }

        return sources;
    }

    private static void ValidateImageUrl(string boutId, string corner, string? imageUrl)
    {
        if (string.IsNullOrWhiteSpace(imageUrl))
            return;

        if (imageUrl.Length > 512 ||
            !Uri.TryCreate(imageUrl, UriKind.Absolute, out var uri) ||
            (uri.Scheme != Uri.UriSchemeHttps && uri.Scheme != Uri.UriSchemeHttp))
        {
            throw new InvalidOperationException(
                $"La imagen {corner} del bout {boutId} no es una URL HTTP(S) absoluta válida.");
        }
    }

    private static void ValidateFighterMetrics(string boutId, string corner, UfcSeedFighter fighter)
    {
        if (fighter.ReachInches is < 50 or > 90)
            throw new InvalidOperationException(
                $"El alcance {corner} del bout {boutId} debe estar entre 50 y 90 pulgadas.");

        if (!string.IsNullOrWhiteSpace(fighter.Stance) && ParseStance(fighter.Stance) is null)
            throw new InvalidOperationException(
                $"La guardia {corner} del bout {boutId} no es válida: '{fighter.Stance}'.");

        if (fighter.TakedownDefensePercent is < 0 or > 100)
            throw new InvalidOperationException(
                $"La defensa de derribos {corner} del bout {boutId} debe estar entre 0 y 100.");

        if (fighter.StrikingAccuracyPercent is < 0 or > 100)
            throw new InvalidOperationException(
                $"La precisión de golpeo {corner} del bout {boutId} debe estar entre 0 y 100.");
    }

    private static Fighter BuildFighter(UfcSeedFighter seed, string? imageUrl) =>
        Fighter.Create(
            seed.Id,
            seed.Name,
            seed.CountryCode,
            seed.Country,
            seed.Record,
            seed.Rank,
            WeightDivisionCatalog.Parse(seed.Division).Division,
            imageUrl,
            seed.ReachInches,
            ParseStance(seed.Stance),
            seed.TakedownDefensePercent,
            seed.StrikingAccuracyPercent);

    private static Event BuildEvent(
        UfcSeedBout boutSeed,
        UfcSeedDocument document,
        IReadOnlyDictionary<string, UfcSeedSource> sources,
        out int marketCount,
        out int selectionCount)
    {
        var division = WeightDivisionCatalog.Parse(boutSeed.Division);
        var red = BuildFighter(boutSeed.Red, boutSeed.Fighter1ImageUrl ?? boutSeed.Red.ImageUrl);
        var blue = BuildFighter(boutSeed.Blue, boutSeed.Fighter2ImageUrl ?? boutSeed.Blue.ImageUrl);
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

        marketCount = 0;
        selectionCount = 0;
        foreach (var marketSeed in boutSeed.Markets)
        {
            var marketType = ParseMarketType(marketSeed.Type)
                ?? throw new InvalidOperationException($"Mercado MMA no soportado: {marketSeed.Type}.");
            var source = ResolveSource(boutSeed, marketSeed, sources);
            var selections = BuildSelections(boutSeed, marketSeed, source);

            @event.AddMarket(
                MarketId.From(SeedIds.For($"market:{boutSeed.Id}:{marketSeed.Type}")),
                marketSeed.Name,
                marketType,
                selections,
                marketSeed.Line,
                marketSeed.DisplayOrder,
                BuildProvenance(source));

            marketCount++;
            selectionCount += selections.Count;
        }

        return @event;
    }

    private static void UpsertEvent(
        Event @event,
        UfcSeedBout boutSeed,
        IReadOnlyDictionary<string, UfcSeedSource> sources,
        ref int addedMarkets,
        ref int updatedMarkets,
        ref int addedSelections,
        ref int updatedSelections)
    {
        @event.Bout?.UpdateFighterImages(
            boutSeed.Fighter1ImageUrl ?? boutSeed.Red.ImageUrl,
            boutSeed.Fighter2ImageUrl ?? boutSeed.Blue.ImageUrl);
        @event.Bout?.UpdateFighterMetrics(
            boutSeed.Red.ReachInches,
            ParseStance(boutSeed.Red.Stance),
            boutSeed.Red.TakedownDefensePercent,
            boutSeed.Red.StrikingAccuracyPercent,
            boutSeed.Blue.ReachInches,
            ParseStance(boutSeed.Blue.Stance),
            boutSeed.Blue.TakedownDefensePercent,
            boutSeed.Blue.StrikingAccuracyPercent);

        var seedMarketIds = new HashSet<Guid>();
        foreach (var marketSeed in boutSeed.Markets)
        {
            var marketId = MarketId.From(SeedIds.For($"market:{boutSeed.Id}:{marketSeed.Type}"));
            seedMarketIds.Add(marketId.Value);

            var source = ResolveSource(boutSeed, marketSeed, sources);
            var provenance = BuildProvenance(source);
            var market = @event.Markets.FirstOrDefault(item => item.Id.Value == marketId.Value);

            if (market is null)
            {
                var marketType = ParseMarketType(marketSeed.Type)
                    ?? throw new InvalidOperationException($"Mercado MMA no soportado: {marketSeed.Type}.");
                var selections = BuildSelections(boutSeed, marketSeed, source);
                @event.AddMarket(
                    marketId,
                    marketSeed.Name,
                    marketType,
                    selections,
                    marketSeed.Line,
                    marketSeed.DisplayOrder,
                    provenance);
                addedMarkets++;
                addedSelections += selections.Count;
                continue;
            }

            market.UpdatePresentation(marketSeed.Name, marketSeed.Line, marketSeed.DisplayOrder);
            market.SetProvenance(provenance);
            updatedMarkets++;

            foreach (var (selectionSeed, index) in marketSeed.Selections.Select((value, index) => (value, index)))
            {
                var selectionId = SelectionId.From(
                    SeedIds.For($"selection:{boutSeed.Id}:{marketSeed.Type}:{selectionSeed.Code}"));
                var selection = market.Selections.FirstOrDefault(item => item.Id.Value == selectionId.Value);
                var displayOrder = selectionSeed.DisplayOrder > 0 ? selectionSeed.DisplayOrder : index + 1;

                if (selection is null)
                {
                    market.AddSelection(new Selection(
                        selectionId,
                        selectionSeed.Name,
                        BuildOdd(selectionSeed, source),
                        selectionSeed.Code,
                        displayOrder));
                    addedSelections++;
                    continue;
                }

                selection.UpdateMetadata(selectionSeed.Name, selectionSeed.Code, displayOrder);
                selection.UpdateOdd(BuildOdd(selectionSeed, source), source.ObservedAt);
                updatedSelections++;
            }
        }

        foreach (var market in @event.Markets)
        {
            if (market.Status == MarketStatus.Open && !seedMarketIds.Contains(market.Id.Value))
                market.Void("Mercado retirado del snapshot UFC.");
        }
    }

    private static IReadOnlyList<Selection> BuildSelections(
        UfcSeedBout boutSeed,
        UfcSeedMarket marketSeed,
        UfcSeedSource source)
    {
        return marketSeed.Selections
            .Select((selection, index) => new Selection(
                SelectionId.From(
                    SeedIds.For($"selection:{boutSeed.Id}:{marketSeed.Type}:{selection.Code}")),
                selection.Name,
                BuildOdd(selection, source),
                selection.Code,
                selection.DisplayOrder > 0 ? selection.DisplayOrder : index + 1))
            .ToList();
    }

    private static Odd BuildOdd(UfcSeedSelection selection, UfcSeedSource source)
        => new(selection.DecimalOdds, source.ObservedAt, source.Name);

    private static UfcSeedSource ResolveSource(
        UfcSeedBout boutSeed,
        UfcSeedMarket marketSeed,
        IReadOnlyDictionary<string, UfcSeedSource> sources)
    {
        var sourceId = string.IsNullOrWhiteSpace(marketSeed.SourceId)
            ? boutSeed.SourceId
            : marketSeed.SourceId;

        return sources.TryGetValue(sourceId, out var source)
            ? source
            : throw new InvalidOperationException(
                $"El mercado {boutSeed.Id}/{marketSeed.Type} no encuentra la fuente '{sourceId}'.");
    }

    private static MarketProvenance BuildProvenance(UfcSeedSource source)
    {
        var kind = ParseSourceKind(source.Kind)
            ?? throw new InvalidOperationException($"Tipo de fuente no soportado: '{source.Kind}'.");

        return new MarketProvenance(
            source.Name,
            kind,
            source.Url,
            source.ObservedAt,
            source.Note);
    }

    private static MarketType? ParseMarketType(string value) => value.Trim().ToLowerInvariant() switch
    {
        "moneyline" => MarketType.MmaMoneyline,
        "method_of_victory" => MarketType.MmaMethodOfVictory,
        "total_rounds" => MarketType.MmaTotalRounds,
        "go_to_decision" => MarketType.MmaGoToDecision,
        _ => null
    };

    private static OddsSourceKind? ParseSourceKind(string value) => value.Trim().ToLowerInvariant() switch
    {
        "bookmaker" => OddsSourceKind.Bookmaker,
        "aggregator" => OddsSourceKind.Aggregator,
        "exchange" => OddsSourceKind.Exchange,
        "model" => OddsSourceKind.Model,
        "unknown" => OddsSourceKind.Unknown,
        _ => null
    };

    private static FightBilling? ParseBilling(string value) => value.Trim().ToLowerInvariant() switch
    {
        "main" => FightBilling.Main,
        "prelims" => FightBilling.Prelims,
        "early" => FightBilling.EarlyPrelims,
        _ => null
    };

    private static FighterStance? ParseStance(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;

        return value.Trim().ToLowerInvariant() switch
        {
            "orthodox" => FighterStance.Orthodox,
            "southpaw" => FighterStance.Southpaw,
            "switch" => FighterStance.Switch,
            _ => null
        };
    }
}
