namespace Zenbet.EventsMarkets.Domain.Football;

public sealed class FootballMarket
{
    public string Id { get; set; } = string.Empty;
    public string MatchId { get; set; } = string.Empty;
    public Guid MarketId { get; set; }
    public string TypeKey { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public decimal? Line { get; set; }
    public string Status { get; set; } = "open";
    public List<FootballSelection> Selections { get; set; } = new();
}

public sealed class FootballSelection
{
    public string Id { get; set; } = string.Empty;
    public string MarketId { get; set; } = string.Empty;
    public Guid SelectionId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public decimal DecimalOdds { get; set; }
    public string? AmericanOdds { get; set; }
    public decimal? Line { get; set; }
    public string Status { get; set; } = "active";
    public string? CyrillicLabel { get; set; }
}

