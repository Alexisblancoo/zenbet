namespace Zenbet.EventsMarkets.Infrastructure.Providers.ApiSports;

using System.Globalization;
using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using Zenbet.EventsMarkets.Application.Interfaces;

public sealed class ApiSportsOptions
{
    public const string ProviderName = "API-Sports";
    public string BaseUrl { get; set; } = "https://v1.mma.api-sports.io/";

    /// <summary>Secret. Supply only via environment (ApiSports__ApiKey).</summary>
    public string? ApiKey { get; set; }
}

/// <summary>Pure parser. API-Sports MMA gives winner and status only: no method, no round.</summary>
public static class ApiSportsParser
{
    /// <summary>
    /// API-Sports serves some names double-encoded ("LorenÃ§o" for "Lorenço"). Re-reading the text as Windows-1252
    /// bytes and decoding them as strict UTF-8 undoes it; text that is not a valid round trip is returned untouched.
    /// </summary>
    public static string RepairMojibake(string value)
    {
        if (value.All(c => c < 0x80)) return value;
        try
        {
            System.Text.Encoding.RegisterProvider(System.Text.CodePagesEncodingProvider.Instance);
            var cp1252 = System.Text.Encoding.GetEncoding(1252, System.Text.EncoderFallback.ExceptionFallback, System.Text.DecoderFallback.ExceptionFallback);
            var bytes = cp1252.GetBytes(value);
            return new System.Text.UTF8Encoding(false, true).GetString(bytes);
        }
        catch (Exception ex) when (ex is System.Text.EncoderFallbackException or System.Text.DecoderFallbackException or ArgumentException)
        {
            return value;
        }
    }

    public static IReadOnlyList<FightResultSnapshot> ParseFights(string json)
    {
        using var doc = JsonDocument.Parse(json);
        var list = new List<FightResultSnapshot>();
        if (!doc.RootElement.TryGetProperty("response", out var response) || response.ValueKind != JsonValueKind.Array) return list;
        foreach (var f in response.EnumerateArray())
        {
            if (!f.TryGetProperty("fighters", out var fighters)) continue;
            var first = Fighter(fighters, "first");
            var second = Fighter(fighters, "second");
            if (first is null || second is null) continue;
            if (!f.TryGetProperty("date", out var d) || d.ValueKind != JsonValueKind.String ||
                !DateTimeOffset.TryParse(d.GetString(), CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var start)) continue;
            var statusText = f.TryGetProperty("status", out var st) && st.TryGetProperty("long", out var l) ? l.GetString() : null;
            var status = statusText?.ToLowerInvariant() switch
            {
                "finished" => FightOutcomeStatus.Completed,
                "cancelled" or "canceled" => FightOutcomeStatus.Cancelled,
                "not started" or "scheduled" => FightOutcomeStatus.Scheduled,
                _ => FightOutcomeStatus.Unknown,
            };
            var winner = first.Value.Winner ? first.Value.Name : second.Value.Winner ? second.Value.Name : null;
            var id = f.TryGetProperty("id", out var idEl) && idEl.ValueKind == JsonValueKind.Number ? idEl.GetInt64() : 0;
            list.Add(new FightResultSnapshot(ApiSportsOptions.ProviderName, "", $"api-sports:{id}", first.Value.Name, second.Value.Name,
                status == FightOutcomeStatus.Completed ? winner : null, status, null, null, null, null, start));
        }
        return list;
    }

    private static (string Name, bool Winner)? Fighter(JsonElement fighters, string prop)
    {
        if (!fighters.TryGetProperty(prop, out var f) || f.ValueKind != JsonValueKind.Object) return null;
        var name = f.TryGetProperty("name", out var n) && n.ValueKind == JsonValueKind.String ? n.GetString() : null;
        if (string.IsNullOrWhiteSpace(name)) return null;
        return (RepairMojibake(name), f.TryGetProperty("winner", out var w) && w.ValueKind == JsonValueKind.True);
    }
}

public sealed class ApiSportsClient : IFightResultsProvider
{
    private static readonly TimeSpan Ttl = TimeSpan.FromMinutes(30); // free plan: 100 requests/day
    private readonly HttpClient _http;
    private readonly ApiSportsOptions _options;
    private readonly IMemoryCache _cache;

    public ApiSportsClient(HttpClient http, IOptions<ApiSportsOptions> options, IMemoryCache cache)
    {
        _http = http;
        _options = options.Value;
        _cache = cache;
    }

    public string ProviderName => ApiSportsOptions.ProviderName;

    public async Task<IReadOnlyList<FightResultSnapshot>> GetResultsAroundAsync(DateTimeOffset at, CancellationToken cancellationToken = default)
    {
        var results = new List<FightResultSnapshot>();
        // A card is listed under different UTC days (prelims vs main card), so look at both neighbours.
        foreach (var offset in new[] { -1, 0, 1 })
        {
            var day = at.UtcDateTime.Date.AddDays(offset).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
            var json = await _cache.GetOrCreateAsync($"apisports:fights:{day}", async entry =>
            {
                entry.AbsoluteExpirationRelativeToNow = Ttl;
                return await GetAsync($"fights?date={day}", cancellationToken);
            }) ?? throw new InvalidDataException("API-Sports returned no body.");
            results.AddRange(ApiSportsParser.ParseFights(json));
        }
        return results;
    }

    private async Task<string> GetAsync(string relative, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(_options.ApiKey))
            throw new InvalidOperationException("ApiSports:ApiKey is not configured (set ApiSports__ApiKey).");
        var baseUri = new Uri(_options.BaseUrl.EndsWith('/') ? _options.BaseUrl : _options.BaseUrl + "/");
        if (baseUri.Scheme != Uri.UriSchemeHttps)
            throw new InvalidOperationException("ApiSports:BaseUrl must be HTTPS (the API key travels in a header).");
        using var request = new HttpRequestMessage(HttpMethod.Get, new Uri(baseUri, relative));
        request.Headers.Add("x-apisports-key", _options.ApiKey);
        using var response = await _http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, ct);
        response.EnsureSuccessStatusCode();
        return System.Text.Encoding.UTF8.GetString(await response.Content.ReadAsByteArrayAsync(ct));
    }
}
