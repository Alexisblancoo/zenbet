namespace Zenbet.EventsMarkets.Infrastructure.Providers.UfCalendar;

using System.Net.Http.Headers;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using Zenbet.EventsMarkets.Application.Interfaces;

/// <summary>
/// UFCalendar HTTP adapter (calendar + results). The free plan allows 1,000 requests/month and 10/min, so every
/// response is cached: the calendar for 6 h and each event for 2 min. NOT registered in DI yet: wiring and the
/// result-suggestion flow (feed proposes, admin confirms against a second source) are a separate reviewed change.
/// </summary>
public sealed class UfCalendarClient : IMmaDataProvider, IFightResultsProvider
{
    private static readonly TimeSpan CalendarTtl = TimeSpan.FromHours(6);
    private static readonly TimeSpan EventTtl = TimeSpan.FromMinutes(2);

    private readonly HttpClient _http;
    private readonly UfCalendarOptions _options;
    private readonly IMemoryCache _cache;

    public UfCalendarClient(HttpClient http, IOptions<UfCalendarOptions> options, IMemoryCache cache)
    {
        _http = http;
        _options = options.Value;
        _cache = cache;
    }

    public async Task<IReadOnlyList<MmaEventSnapshot>> GetUpcomingEventsAsync(CancellationToken cancellationToken = default)
    {
        var cached = await _cache.GetOrCreateAsync("ufcalendar:upcoming", async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = CalendarTtl;
            var list = UfCalendarParser.ParseEventList(
                await GetStringAsync($"events?org={Uri.EscapeDataString(_options.Organization)}", cancellationToken));
            var snapshots = new List<MmaEventSnapshot>();
            foreach (var ev in list.Where(e => !IsFinal(e.Status)))
            {
                var snapshot = UfCalendarParser.ParseEventSnapshot(await GetEventJsonAsync(ev.Slug, cancellationToken));
                if (snapshot.Fights.Count > 0) snapshots.Add(snapshot);
            }
            return (IReadOnlyList<MmaEventSnapshot>)snapshots;
        });
        return cached ?? Array.Empty<MmaEventSnapshot>();
    }

    public async Task<IReadOnlyList<FightResultSnapshot>> GetEventResultsAsync(string eventSlug, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(eventSlug) || eventSlug.Any(c => !(char.IsAsciiLetterOrDigit(c) || c == '-')))
            throw new ArgumentException("Invalid event slug.", nameof(eventSlug));
        return UfCalendarParser.ParseResults(await GetEventJsonAsync(eventSlug, cancellationToken));
    }

    private static bool IsFinal(string status) =>
        status.Equals("completed", StringComparison.OrdinalIgnoreCase) || status.Equals("cancelled", StringComparison.OrdinalIgnoreCase);

    private async Task<string> GetEventJsonAsync(string slug, CancellationToken ct) =>
        await _cache.GetOrCreateAsync($"ufcalendar:event:{slug}", async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = EventTtl;
            return await GetStringAsync($"events/{slug}", ct);
        }) ?? throw new InvalidDataException("UFCalendar returned no body.");

    private async Task<string> GetStringAsync(string relative, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(_options.ApiKey))
            throw new InvalidOperationException("UfCalendar:ApiKey is not configured (set UfCalendar__ApiKey).");
        var baseUri = new Uri(_options.BaseUrl.EndsWith('/') ? _options.BaseUrl : _options.BaseUrl + "/");
        if (baseUri.Scheme != Uri.UriSchemeHttps)
            throw new InvalidOperationException("UfCalendar:BaseUrl must be HTTPS (the API key travels in a header).");
        using var request = new HttpRequestMessage(HttpMethod.Get, new Uri(baseUri, relative));
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _options.ApiKey);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        using var response = await _http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, ct);
        response.EnsureSuccessStatusCode();
        // Read bytes as UTF-8 explicitly: the API omits a charset and accented names would otherwise be corrupted.
        var bytes = await response.Content.ReadAsByteArrayAsync(ct);
        return System.Text.Encoding.UTF8.GetString(bytes);
    }
}
