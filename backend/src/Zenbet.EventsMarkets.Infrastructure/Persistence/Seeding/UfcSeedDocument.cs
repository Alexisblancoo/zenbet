namespace Zenbet.EventsMarkets.Infrastructure.Persistence.Seeding;

/// <summary>
/// Contrato de un snapshot UFC. La versión 4 añade las métricas técnicas de
/// ambos peleadores (alcance, guardia, defensa de derribos y precisión de
/// golpeo) a la ficha que ya incluía fotos y clave estable de cartelera. Cada
/// archivo describe una cartelera completa y se descubre automáticamente.
/// </summary>
internal sealed class UfcSeedDocument
{
    public int SchemaVersion { get; init; }
    public UfcSeedCard Card { get; init; } = new();
    public IReadOnlyList<UfcSeedSource> Sources { get; init; } = Array.Empty<UfcSeedSource>();
    public IReadOnlyList<UfcSeedBout> Bouts { get; init; } = Array.Empty<UfcSeedBout>();
}

internal sealed class UfcSeedSource
{
    public string Id { get; init; } = string.Empty;
    public string Kind { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string Url { get; init; } = string.Empty;
    public DateTimeOffset ObservedAt { get; init; }
    public string Note { get; init; } = string.Empty;
}

internal sealed class UfcSeedCard
{
    public string SeedKey { get; init; } = string.Empty;
    public string Competition { get; init; } = string.Empty;
    public string Title { get; init; } = string.Empty;
    public string Venue { get; init; } = string.Empty;
    public string Location { get; init; } = string.Empty;
    public string Date { get; init; } = string.Empty;
}

internal sealed class UfcSeedBout
{
    public string Id { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string Billing { get; init; } = string.Empty;
    public int Order { get; init; }
    public DateTimeOffset StartTime { get; init; }
    public string Division { get; init; } = string.Empty;
    public int Rounds { get; init; }
    public bool TitleFight { get; init; }
    public string SourceId { get; init; } = string.Empty;
    public string? Fighter1ImageUrl { get; init; }
    public string? Fighter2ImageUrl { get; init; }
    public UfcSeedFighter Red { get; init; } = new();
    public UfcSeedFighter Blue { get; init; } = new();
    public IReadOnlyList<UfcSeedMarket> Markets { get; init; } = Array.Empty<UfcSeedMarket>();
}

internal sealed class UfcSeedFighter
{
    public string Id { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string CountryCode { get; init; } = string.Empty;
    public string Country { get; init; } = string.Empty;
    public string Record { get; init; } = string.Empty;
    public string? Rank { get; init; }
    public string Division { get; init; } = string.Empty;
    public string? ImageUrl { get; init; }
    public int? ReachInches { get; init; }
    public string? Stance { get; init; }
    public decimal? TakedownDefensePercent { get; init; }
    public decimal? StrikingAccuracyPercent { get; init; }
}

internal sealed class UfcSeedMarket
{
    public string Type { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public int DisplayOrder { get; init; }
    public decimal? Line { get; init; }
    public string SourceId { get; init; } = string.Empty;
    public IReadOnlyList<UfcSeedSelection> Selections { get; init; } = Array.Empty<UfcSeedSelection>();
}

internal sealed class UfcSeedSelection
{
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public int DisplayOrder { get; init; }
    public decimal DecimalOdds { get; init; }
    public string AmericanOdds { get; init; } = string.Empty;
}
