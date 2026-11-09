namespace Zenbet.EventsMarkets.Domain.Pricing;

using Zenbet.EventsMarkets.Domain.Aggregates;
using Zenbet.EventsMarkets.Domain.Enums;
using Zenbet.EventsMarkets.Domain.ValueObjects;

/// <summary>
/// Plantilla de los mercados estándar de un combate de MMA. Los códigos de selección son el contrato con la
/// liquidación (<c>UfcMarketResultResolver</c>): red/blue, {corner}_{ko|submission|decision}, over/under, yes/no.
/// Los mercados nacen SIN cotizar (procedencia <see cref="OddsSourceKind.Pending"/>): no se publican ni admiten
/// apuestas hasta que el trader los cotice con PriceMarket. La cuota 1.0 es solo un marcador interno.
/// </summary>
public static class StandardMmaMarkets
{
    public const string PendingProvider = "ZenBet Trading (pendiente de cotizar)";

    public static readonly IReadOnlyList<MarketType> Types =
    [
        MarketType.MmaMoneyline,
        MarketType.MmaMethodOfVictory,
        MarketType.MmaTotalRounds,
        MarketType.MmaGoToDecision,
    ];

    /// <summary>Línea por defecto de total de asaltos: rondas programadas − 0.5 (2.5 en 3 asaltos, 4.5 en 5).</summary>
    public static decimal DefaultTotalRoundsLine(int scheduledRounds) => scheduledRounds - 0.5m;

    /// <summary>Crea los mercados estándar que aún no existen. Los tipos de <paramref name="existing"/> se respetan tal cual.</summary>
    public static IReadOnlyList<Market> BuildMissing(
        EventId eventId,
        MmaBout bout,
        IReadOnlySet<MarketType> existing,
        string openedBy,
        DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(bout);
        if (bout.ScheduledRounds is not (3 or 5))
            throw new ArgumentException("Un combate debe tener 3 o 5 asaltos programados.", nameof(bout));

        var red = bout.Red.Name;
        var blue = bout.Blue.Name;
        var placeholder = new Odd(1.0m, now, PendingProvider);
        // Una instancia POR mercado: MarketProvenance es un owned type de EF Core y no se puede compartir entre
        // entidades (si se comparte, solo el primer mercado guarda la procedencia y los demás quedan sin ella).
        MarketProvenance Provenance() => new(
            PendingProvider,
            OddsSourceKind.Pending,
            url: null,
            observedAt: now,
            note: $"Abierto por {openedBy}; sin cuotas hasta que el trader lo cotice.");

        Selection Sel(string code, string name, int order) => new(SelectionId.New(), name, placeholder, code, order);

        var markets = new List<Market>(Types.Count);

        if (!existing.Contains(MarketType.MmaMoneyline))
        {
            markets.Add(new Market(MarketId.New(), eventId, "Ganador", MarketType.MmaMoneyline,
                [Sel("red", red, 1), Sel("blue", blue, 2)], displayOrder: 1, provenance: Provenance()));
        }

        if (!existing.Contains(MarketType.MmaMethodOfVictory))
        {
            markets.Add(new Market(MarketId.New(), eventId, "Método de victoria", MarketType.MmaMethodOfVictory,
            [
                Sel("red_ko", $"{red} por KO/TKO", 1),
                Sel("red_submission", $"{red} por sumisión", 2),
                Sel("red_decision", $"{red} por decisión", 3),
                Sel("blue_ko", $"{blue} por KO/TKO", 4),
                Sel("blue_submission", $"{blue} por sumisión", 5),
                Sel("blue_decision", $"{blue} por decisión", 6),
            ], displayOrder: 2, provenance: Provenance()));
        }

        if (!existing.Contains(MarketType.MmaTotalRounds))
        {
            var line = DefaultTotalRoundsLine(bout.ScheduledRounds);
            var label = line.ToString("0.0", System.Globalization.CultureInfo.InvariantCulture);
            markets.Add(new Market(MarketId.New(), eventId, "Total de asaltos", MarketType.MmaTotalRounds,
                [Sel("over", $"Más de {label} asaltos", 1), Sel("under", $"Menos de {label} asaltos", 2)],
                line: line, displayOrder: 3, provenance: Provenance()));
        }

        if (!existing.Contains(MarketType.MmaGoToDecision))
        {
            markets.Add(new Market(MarketId.New(), eventId, "¿Llega a decisión?", MarketType.MmaGoToDecision,
                [Sel("yes", "Sí, llega a decisión", 1), Sel("no", "No, no llega a decisión", 2)],
                displayOrder: 4, provenance: Provenance()));
        }

        return markets;
    }
}
