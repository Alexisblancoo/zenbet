namespace Zenbet.EventsMarkets.Infrastructure.Providers.UfCalendar;

using System.Globalization;
using System.Text.Json;
using Zenbet.EventsMarkets.Application.Interfaces;

/// <summary>Pure, offline-testable translation of UFCalendar payloads. No I/O, no clock.</summary>
public static class UfCalendarParser
{
    private const string Provider = UfCalendarOptions.ProviderName;
    private const string Unknown = "N/D";

    public sealed record EventSummary(string Slug, string Status, DateTimeOffset StartsAt);

    /// <summary>Parses GET /events. Entries without a slug or a start date are dropped.</summary>
    public static IReadOnlyList<EventSummary> ParseEventList(string json)
    {
        using var doc = JsonDocument.Parse(json);
        var items = Data(doc.RootElement);
        var result = new List<EventSummary>();
        if (items.ValueKind != JsonValueKind.Array) return result;
        foreach (var e in items.EnumerateArray())
        {
            var slug = Str(e, "slug");
            var starts = Date(e, "starts_at");
            if (slug is null || starts is null) continue;
            result.Add(new EventSummary(slug, Str(e, "status") ?? "", starts.Value));
        }
        return result;
    }

    /// <summary>Parses GET /events/{slug} into the calendar snapshot. Cancelled bouts and bouts without a valid 3/5 round count are omitted. Markets are always empty: ZenBet prices its own markets.</summary>
    public static MmaEventSnapshot ParseEventSnapshot(string json)
    {
        using var doc = JsonDocument.Parse(json);
        var e = Data(doc.RootElement);
        var (eventId, slug, title, org, starts) = Header(e);
        var venue = e.TryGetProperty("venue", out var v) && v.ValueKind == JsonValueKind.Object ? v : default;
        var venueName = Str(venue, "name") ?? Unknown;
        var location = string.Join(", ", new[] { Str(venue, "city"), Str(venue, "region"), Str(venue, "country") }
            .Where(s => !string.IsNullOrWhiteSpace(s)));
        if (location.Length == 0) location = Unknown;

        var fights = new List<MmaFightSnapshot>();
        foreach (var bout in Card(e))
        {
            if (string.Equals(Str(bout, "status"), "cancelled", StringComparison.OrdinalIgnoreCase)) continue;
            var rounds = bout.TryGetProperty("scheduled_rounds", out var r) && r.ValueKind == JsonValueKind.Number ? r.GetInt32() : 0;
            if (rounds is not (3 or 5)) continue;
            var a = Fighter(bout, "fighter_a");
            var b = Fighter(bout, "fighter_b");
            if (a is null || b is null) continue;
            var section = Str(bout, "card_section") ?? "main";
            var fightStart = SectionStart(e, section) ?? starts;
            // Our catalog is keyed by slug; a bout in a division we do not model (catchweight, openweight...) is skipped
            // instead of failing the whole card.
            var division = Str(bout, "division_slug");
            if (division is null || !Zenbet.EventsMarkets.Domain.ValueObjects.WeightDivisionCatalog.TryParse(division, out _)) continue;
            fights.Add(new MmaFightSnapshot(
                ExternalId: $"{Provider.ToLowerInvariant()}:{Long(bout, "id")}",
                Name: $"{a.Name} vs {b.Name}",
                StartTime: fightStart,
                Competition: title,
                Division: division,
                ScheduledRounds: rounds,
                IsTitleFight: Bool(bout, "is_title"),
                Billing: BillingLabel(section),
                BillingOrder: Math.Max(1, (int)Long(bout, "ordering")),
                Venue: venueName,
                Location: location,
                Red: a with { Division = division },
                Blue: b with { Division = division },
                Markets: Array.Empty<MmaMarketSnapshot>()));
        }

        return new MmaEventSnapshot($"{Provider.ToLowerInvariant()}:{eventId}", org, title, slug, starts, fights);
    }

    /// <summary>Parses GET /events/{slug} into per-bout outcomes (all statuses, including cancelled and not yet fought).</summary>
    public static IReadOnlyList<FightResultSnapshot> ParseResults(string json)
    {
        using var doc = JsonDocument.Parse(json);
        var e = Data(doc.RootElement);
        var (eventId, _, _, _, starts) = Header(e);
        var list = new List<FightResultSnapshot>();
        foreach (var bout in Card(e))
        {
            var a = Fighter(bout, "fighter_a");
            var b = Fighter(bout, "fighter_b");
            if (a is null || b is null) continue;
            var status = Str(bout, "status")?.ToLowerInvariant() switch
            {
                "completed" => FightOutcomeStatus.Completed,
                "cancelled" => FightOutcomeStatus.Cancelled,
                "announced" or "scheduled" or "confirmed" => FightOutcomeStatus.Scheduled,
                _ => FightOutcomeStatus.Unknown,
            };
            string? winner = null, method = null, normalized = null;
            int? round = null, seconds = null;
            if (bout.TryGetProperty("result", out var res) && res.ValueKind == JsonValueKind.Object)
            {
                var winnerId = res.TryGetProperty("winner_fighter_id", out var w) && w.ValueKind == JsonValueKind.Number ? w.GetInt64() : (long?)null;
                if (winnerId is not null)
                {
                    if (winnerId == FighterId(bout, "fighter_a")) winner = a.Name;
                    else if (winnerId == FighterId(bout, "fighter_b")) winner = b.Name;
                }
                method = Str(res, "method");
                normalized = Str(res, "method_normalized");
                round = res.TryGetProperty("round", out var rd) && rd.ValueKind == JsonValueKind.Number ? rd.GetInt32() : null;
                seconds = res.TryGetProperty("time_seconds", out var ts) && ts.ValueKind == JsonValueKind.Number ? ts.GetInt32() : null;
            }
            var fightStart = SectionStart(e, Str(bout, "card_section") ?? "main") ?? starts;
            list.Add(new FightResultSnapshot(Provider, $"{Provider.ToLowerInvariant()}:{eventId}",
                $"{Provider.ToLowerInvariant()}:{Long(bout, "id")}", a.Name, b.Name, winner, status, method, normalized, round, seconds, fightStart));
        }
        return list;
    }

    private static (long Id, string Slug, string Title, string Org, DateTimeOffset Starts) Header(JsonElement e)
    {
        var slug = Str(e, "slug") ?? throw new InvalidDataException("UFCalendar event without slug.");
        var title = Str(e, "title") ?? throw new InvalidDataException("UFCalendar event without title.");
        var starts = Date(e, "starts_at") ?? throw new InvalidDataException("UFCalendar event without starts_at.");
        return (Long(e, "id"), slug, title, Str(e, "org") ?? "ufc", starts);
    }

    private static IEnumerable<JsonElement> Card(JsonElement e) =>
        e.TryGetProperty("card", out var c) && c.ValueKind == JsonValueKind.Array ? c.EnumerateArray() : Enumerable.Empty<JsonElement>();

    private static MmaFighterSnapshot? Fighter(JsonElement bout, string prop)
    {
        if (!bout.TryGetProperty(prop, out var f) || f.ValueKind != JsonValueKind.Object) return null;
        var name = Str(f, "name");
        if (name is null) return null;
        var code = Str(f, "country_code");
        return new MmaFighterSnapshot(
            ExternalId: $"{Provider.ToLowerInvariant()}:{Long(f, "id")}",
            Name: name,
            CountryCode: code is { Length: 2 } ? code.ToUpperInvariant() : "ZZ",
            Country: Str(f, "nationality") ?? Unknown,
            Record: Unknown,
            Division: Unknown);
    }

    private static long? FighterId(JsonElement bout, string prop) =>
        bout.TryGetProperty(prop, out var f) && f.TryGetProperty("id", out var id) && id.ValueKind == JsonValueKind.Number ? id.GetInt64() : null;

    private static DateTimeOffset? SectionStart(JsonElement e, string section) => section switch
    {
        "main" => Date(e, "main_card_at"),
        "prelims" => Date(e, "prelims_at"),
        "early_prelims" => Date(e, "early_prelims_at") ?? Date(e, "prelims_at"),
        _ => null,
    };

    /// <summary>Values of the FightBilling enum (the synchronizer parses them by name).</summary>
    private static string BillingLabel(string section) => section switch
    {
        "main" => "Main",
        "prelims" => "Prelims",
        "early_prelims" => "EarlyPrelims",
        _ => "Prelims",
    };

    private static JsonElement Data(JsonElement root) =>
        root.ValueKind == JsonValueKind.Object && root.TryGetProperty("data", out var d) ? d : root;

    private static string? Str(JsonElement e, string prop) =>
        e.ValueKind == JsonValueKind.Object && e.TryGetProperty(prop, out var p) && p.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(p.GetString())
            ? p.GetString() : null;

    private static long Long(JsonElement e, string prop) =>
        e.TryGetProperty(prop, out var p) && p.ValueKind == JsonValueKind.Number ? p.GetInt64() : 0;

    private static bool Bool(JsonElement e, string prop) =>
        e.TryGetProperty(prop, out var p) && p.ValueKind == JsonValueKind.True;

    private static DateTimeOffset? Date(JsonElement e, string prop) =>
        Str(e, prop) is { } s && DateTimeOffset.TryParse(s, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var d) ? d : null;
}
