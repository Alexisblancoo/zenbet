namespace Zenbet.EventsMarkets.Infrastructure.Messaging;

public sealed class MmaSyncOptions
{
    public bool Enabled { get; set; }
    public string? FeedUrl { get; set; }
    public TimeSpan PollInterval { get; set; } = TimeSpan.FromMinutes(1);
}
