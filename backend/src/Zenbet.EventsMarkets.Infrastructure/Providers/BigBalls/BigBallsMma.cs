namespace Zenbet.EventsMarkets.Infrastructure.Providers.BigBalls;

using System.Globalization;
using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using Zenbet.EventsMarkets.Application.Interfaces;

public sealed class BigBallsOptions
{
    public const string ProviderName = "BigBallsData";
    public string BaseUrl { get; set; } = "https://api.bigballsdata.com/v1/";

    /// <summary>Secret. Supply only via environment (BigBallsData__ApiKey).</summary>
    public string? ApiKey { get; set; }
}

/// <summary>Pure parser. Big Balls reports winner and method only for decisions; finishes (KO/submission) carry no winner.</summary>
public static class BigBallsParser
{
    public static IReadOnlyList<FightResultSnapshot> ParseMatches(string json)
    {
        using var doc = JsonDocument.Parse(json);
        var list = new List<FightResultSnapshot>();
        if (!doc.RootElement.TryGetProperty("data", out var data) || data.ValueKind != JsonValueKind.Array) return list;
        foreach (var m in data.EnumerateArray())
        {
            var home = Name(m, "home");
            var away = Name(m, "away");
            if (home is null || away is null) continue;
            if (!m.TryGetProperty("kickoff_utc", out var k) || k.ValueKind != JsonValueKind.String ||
                !DateTimeOffset.TryParse(k.GetString(), CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var start)) continue;
            var status = (m.TryGetProperty("status", out var s) ? s.GetString() : null)?.ToLowerInvariant() switch
            {
                "finished" => FightOutcomeStatus.Completed,
                "cancelled" or "canceled" => FightOutcomeStatus.Cancelled,
                "scheduled" or "upcoming" or "not_started" => FightOutcomeStatus.Scheduled,
                _ => FightOutcomeStatus.Unknown,
            };
            string? winner = null, method = null;
            if (status == FightOutcomeStatus.Completed && m.TryGetProperty("decision", out var dec) && dec.ValueKind == JsonValueKind.Object)
            {
                var w = dec.TryGetProperty("winner", out var we) && we.ValueKind == JsonValueKind.String ? we.GetString() : null;
                winner = w switch { "home" => home, "away" => away, _ => null };
                method = dec.TryGetProperty("method", out var me) && me.ValueKind == JsonValueKind.String ? me.GetString() : null;
            }
            var id = m.TryGetProperty("id", out var idEl) && idEl.ValueKind == JsonValueKind.String ? idEl.GetString() : "";
            list.Add(new FightResultSnapshot(BigBallsOptions.ProviderName, "", $"bigballs:{id}", home, away, winner, status, method, method, null, null, start));
        }
        return list;
    }

    private static string? Name(JsonElement m, string side) =>
        m.TryGetProperty(side, out var t) && t.TryGetProperty("name", out var n) && n.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(n.GetString())
            ? n.GetString() : null;
}

public sealed class BigBallsClient : IFightResultsProvider
{
    private static readonly TimeSpan Ttl = TimeSpan.FromMinutes(30);
    private readonly HttpClient _http;
    private readonly BigBallsOptions _options;
    private readonly IMemoryCache _cache;

    public BigBallsClient(HttpClient http, IOptions<BigBallsOptions> options, IMemoryCache cache)
    {
        _http = http;
        _options = options.Value;
        _cache = cache;
    }

    public string ProviderName => BigBallsOptions.ProviderName;

    public async Task<IReadOnlyList<FightResultSnapshot>> GetResultsAroundAsync(DateTimeOffset at, CancellationToken cancellationToken = default)
    {
        var results = new List<FightResultSnapshot>();
        foreach (var offset in new[] { -1, 0, 1 })
        {
            var day = at.UtcDateTime.Date.AddDays(offset).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
            var json = await _cache.GetOrCreateAsync($"bigballs:mma:{day}", async entry =>
            {
                entry.AbsoluteExpirationRelativeToNow = Ttl;
                return await GetAsync($"matches?sport=mma&league=UFC&date={day}&limit=50", cancellationToken);
            }) ?? throw new InvalidDataException("Big Balls returned no body.");
            results.AddRange(BigBallsParser.ParseMatches(json));
        }
        return results;
    }

    private async Task<string> GetAsync(string relative, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(_options.ApiKey))
            throw new InvalidOperationException("BigBallsData:ApiKey is not configured (set BigBallsData__ApiKey).");
        var baseUri = new Uri(_options.BaseUrl.EndsWith('/') ? _options.BaseUrl : _options.BaseUrl + "/");
        if (baseUri.Scheme != Uri.UriSchemeHttps)
            throw new InvalidOperationException("BigBallsData:BaseUrl must be HTTPS (the API key travels in a header).");
        using var request = new HttpRequestMessage(HttpMethod.Get, new Uri(baseUri, relative));
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _options.ApiKey);
        using var response = await _http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, ct);
        response.EnsureSuccessStatusCode();
        return System.Text.Encoding.UTF8.GetString(await response.Content.ReadAsByteArrayAsync(ct));
    }
}
