namespace Zenbet.EventsMarkets.Domain.Football;

public sealed class FootballMatch
{
    public string Id { get; set; } = string.Empty;
    public Guid EventId { get; set; }
    public string LeagueId { get; set; } = string.Empty;
    public FootballLeague? League { get; set; }
    public string HomeTeamId { get; set; } = string.Empty;
    public FootballTeam? HomeTeam { get; set; }
    public string AwayTeamId { get; set; } = string.Empty;
    public FootballTeam? AwayTeam { get; set; }
    public DateTimeOffset KickoffTimeUtc { get; set; }
    public string Status { get; set; } = "upcoming"; // "upcoming", "live", "finished"
    public int HomeScore { get; set; }
    public int AwayScore { get; set; }
    public int? CurrentMinute { get; set; }
    public string? Period { get; set; } // "pre_match", "first_half", "half_time", "second_half", "full_time"
    public bool IsRunning { get; set; }
    public string? Stadium { get; set; }
    public string? City { get; set; }
    public string? Referee { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public List<FootballMarket> Markets { get; set; } = new();
}

