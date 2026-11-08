namespace Zenbet.EventsMarkets.Infrastructure.Providers.UfCalendar;

public sealed class UfCalendarOptions
{
    public const string ProviderName = "UFCalendar";

    public string BaseUrl { get; set; } = "https://api.ufcalendar.com/v1/";

    /// <summary>Secret. Supply only via environment (UfCalendar__ApiKey); never commit it.</summary>
    public string? ApiKey { get; set; }

    /// <summary>Organization filter for the events list.</summary>
    public string Organization { get; set; } = "ufc";

    /// <summary>The free plan gives 1,000 requests/month: the calendar costs 1 + one request per open event.</summary>
    public int CalendarCacheMinutes { get; set; } = 720;
}
