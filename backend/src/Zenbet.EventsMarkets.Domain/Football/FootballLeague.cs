namespace Zenbet.EventsMarkets.Domain.Football;

public sealed class FootballLeague
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string ShortName { get; set; } = string.Empty;
    public string Country { get; set; } = string.Empty;
    public string CountryCode { get; set; } = string.Empty;
    public string Season { get; set; } = "2026/27";
    public string Matchday { get; set; } = string.Empty;
    public string? LeagueLogoUrl { get; set; }
    public string? CyrillicName { get; set; }
}

