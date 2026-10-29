namespace Zenbet.EventsMarkets.Infrastructure.Messaging;

using System.Net.Http.Json;
using Microsoft.Extensions.Options;
using Zenbet.EventsMarkets.Application.Interfaces;

/// <summary>HTTP adapter for a configured MMA provider feed.</summary>
public sealed class HttpMmaDataProvider : IMmaDataProvider
{
    private readonly HttpClient _httpClient;
    private readonly MmaSyncOptions _options;

    public HttpMmaDataProvider(HttpClient httpClient, IOptions<MmaSyncOptions> options)
    {
        _httpClient = httpClient;
        _options = options.Value;
    }

    public async Task<IReadOnlyList<MmaEventSnapshot>> GetUpcomingEventsAsync(CancellationToken cancellationToken = default)
    {
        if (!Uri.TryCreate(_options.FeedUrl, UriKind.Absolute, out var feedUri) ||
            (feedUri.Scheme != Uri.UriSchemeHttps && feedUri.Scheme != Uri.UriSchemeHttp))
        {
            throw new InvalidOperationException("MmaSync:FeedUrl must be an absolute HTTP(S) URL.");
        }

        var snapshots = await _httpClient.GetFromJsonAsync<MmaEventSnapshot[]>(feedUri, cancellationToken);
        return snapshots ?? throw new InvalidDataException("The MMA provider returned an empty response body.");
    }
}
