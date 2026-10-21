namespace Zenbet.EventsMarkets.Infrastructure.Persistence.Seeding;

using System.Text.Json.Serialization;

internal sealed class UfcSeedDocument
{
    public int SchemaVersion { get; init; }
    public UfcSeedSource Source { get; init; } = new();
    public UfcSeedCard Card { get; init; } = new();
    public IReadOnlyList<UfcSeedBout> Bouts { get; init; } = Array.Empty<UfcSeedBout>();
}

internal sealed class UfcSeedSource
{
    public string Promotion { get; init; } = string.Empty;
    public string EventUrl { get; init; } = string.Empty;
    public string OddsUrl { get; init; } = string.Empty;
    public string OddsSource { get; init; } = string.Empty;
    public DateTimeOffset CapturedAt { get; init; }
    public string Note { get; init; } = string.Empty;
}

internal sealed class UfcSeedCard
{
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
}

internal sealed class UfcSeedMarket
{
    public string Type { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public int DisplayOrder { get; init; }
    public decimal? Line { get; init; }
    public string Provider { get; init; } = string.Empty;
    public IReadOnlyList<UfcSeedSelection> Selections { get; init; } = Array.Empty<UfcSeedSelection>();
}

internal sealed class UfcSeedSelection
{
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public int DisplayOrder { get; init; }
    public decimal DecimalOdds { get; init; }
    public string AmericanOdds { get; init; } = string.Empty;

    [JsonIgnore]
    public decimal ModelProbabilityPct { get; init; }
}
