namespace Zenbet.EventsMarkets.Infrastructure.Messaging;

public sealed class MmaSyncOptions
{
    public bool Enabled { get; set; }
    public string? FeedUrl { get; set; }

    /// <summary>"Http" (generic JSON feed at FeedUrl, default) or "UfCalendar" (real calendar; needs UfCalendar__ApiKey).</summary>
    public string Provider { get; set; } = "Http";

    public bool UsesUfCalendar => string.Equals(Provider, "UfCalendar", StringComparison.OrdinalIgnoreCase);
    public TimeSpan PollInterval { get; set; } = TimeSpan.FromMinutes(1);
}
