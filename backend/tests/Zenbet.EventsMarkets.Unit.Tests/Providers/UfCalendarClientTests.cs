namespace Zenbet.EventsMarkets.Unit.Tests.Providers;

using System.Net;
using System.Text;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using Xunit;
using Zenbet.EventsMarkets.Infrastructure.Providers.UfCalendar;

public sealed class UfCalendarClientTests
{
    private sealed class StubHandler(Func<HttpRequestMessage, HttpResponseMessage> respond) : HttpMessageHandler
    {
        public List<HttpRequestMessage> Requests { get; } = new();
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Requests.Add(request);
            return Task.FromResult(respond(request));
        }
    }

    private static string Fixture(string name) =>
        File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Fixtures", "UfCalendar", name));

    private static HttpResponseMessage Json(string body) =>
        new(HttpStatusCode.OK) { Content = new ByteArrayContent(Encoding.UTF8.GetBytes(body)) };

    private static UfCalendarClient Make(StubHandler handler, string? key = "test-key", string baseUrl = "https://api.example.test/v1/") =>
        new(new HttpClient(handler), Options.Create(new UfCalendarOptions { ApiKey = key, BaseUrl = baseUrl }),
            new MemoryCache(new MemoryCacheOptions()));

    [Fact]
    public async Task Results_request_uses_bearer_header_never_the_url_and_caches_the_response()
    {
        var handler = new StubHandler(_ => Json(Fixture("event-results-2026-11-07.json")));
        var client = Make(handler);

        var first = await client.GetEventResultsAsync("ufc-fight-night-2026-11-07");
        var second = await client.GetEventResultsAsync("ufc-fight-night-2026-11-07");

        Assert.Equal(18, first.Count);
        Assert.Equal(first.Count, second.Count);
        var request = Assert.Single(handler.Requests); // second call came from cache (quota: 1,000/month)
        Assert.Equal("Bearer", request.Headers.Authorization?.Scheme);
        Assert.Equal("test-key", request.Headers.Authorization?.Parameter);
        Assert.DoesNotContain("test-key", request.RequestUri!.ToString());
    }

    [Fact]
    public async Task Calendar_skips_finished_events_and_fetches_each_open_event_once()
    {
        var handler = new StubHandler(req => req.RequestUri!.AbsolutePath.EndsWith("/events")
            ? Json(Fixture("events.json"))
            : Json(Fixture("event-ufc-334.json")));
        var client = Make(handler);

        var events = await client.GetUpcomingEventsAsync();
        await client.GetUpcomingEventsAsync();

        Assert.NotEmpty(events);
        Assert.Equal(1, handler.Requests.Count(r => r.RequestUri!.AbsolutePath.EndsWith("/events")));
    }

    [Fact]
    public async Task Missing_key_or_plain_http_base_url_is_refused_before_any_request()
    {
        var noKey = new StubHandler(_ => Json("{}"));
        await Assert.ThrowsAsync<InvalidOperationException>(() => Make(noKey, key: null).GetEventResultsAsync("ufc-x"));
        var http = new StubHandler(_ => Json("{}"));
        await Assert.ThrowsAsync<InvalidOperationException>(() => Make(http, baseUrl: "http://api.example.test/v1/").GetEventResultsAsync("ufc-x"));
        Assert.Empty(noKey.Requests);
        Assert.Empty(http.Requests);
    }

    [Theory]
    [InlineData("../admin")]
    [InlineData("a/b")]
    [InlineData("")]
    public async Task Hostile_slugs_are_rejected(string slug)
    {
        var handler = new StubHandler(_ => Json("{}"));
        await Assert.ThrowsAsync<ArgumentException>(() => Make(handler).GetEventResultsAsync(slug));
        Assert.Empty(handler.Requests);
    }

    [Fact]
    public async Task Http_errors_surface_instead_of_returning_empty_data()
    {
        var handler = new StubHandler(_ => new HttpResponseMessage(HttpStatusCode.TooManyRequests));
        await Assert.ThrowsAsync<HttpRequestException>(() => Make(handler).GetEventResultsAsync("ufc-x"));
    }
}
