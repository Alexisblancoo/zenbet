namespace Zenbet.EventsMarkets.Domain.Football;

public sealed class FootballTeam
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string ShortName { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string TeamCrestUrl { get; set; } = string.Empty;
    public string Country { get; set; } = string.Empty;
    public string CountryCode { get; set; } = string.Empty;
    public string? CyrillicName { get; set; }
}

