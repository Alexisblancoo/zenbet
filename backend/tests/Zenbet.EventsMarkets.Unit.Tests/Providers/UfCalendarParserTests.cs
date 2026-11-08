namespace Zenbet.EventsMarkets.Unit.Tests.Providers;

using FluentValidation;
using Xunit;
using Zenbet.EventsMarkets.Application.Interfaces;
using Zenbet.EventsMarkets.Infrastructure.Providers.UfCalendar;

public sealed class UfCalendarParserTests
{
    private static string Fixture(string name) =>
        File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Fixtures", "UfCalendar", name));

    [Fact]
    public void Event_list_is_parsed_and_includes_ufc_334()
    {
        var list = UfCalendarParser.ParseEventList(Fixture("events.json"));

        Assert.Contains(list, e => e.Slug == "ufc-2026-11-15" && e.StartsAt == DateTimeOffset.Parse("2026-11-14T22:00:00Z"));
        Assert.All(list, e => Assert.False(string.IsNullOrWhiteSpace(e.Slug)));
    }

    [Fact]
    public void Ufc_334_snapshot_has_the_card_without_cancelled_bouts_and_without_any_odds()
    {
        var ev = UfCalendarParser.ParseEventSnapshot(Fixture("event-ufc-334.json"));

        Assert.Equal("ufc-2026-11-15", ev.Slug);
        Assert.Equal("ufc", ev.PromotionSlug);
        Assert.Equal(13, ev.Fights.Count); // 15 on the card, 2 cancelled
        Assert.DoesNotContain(ev.Fights, f => f.Name.Contains("Susurkaev") || f.Name.Contains("Sadykhov"));
        Assert.Contains(ev.Fights, f => f.Name == "Ciryl Gane vs Josh Hokit" && f.Billing == "Main Card");
        Assert.All(ev.Fights, f => Assert.Empty(f.Markets)); // ZenBet prices its own markets
        Assert.All(ev.Fights, f => Assert.True(f.ScheduledRounds is 3 or 5));
        Assert.Equal(ev.Fights.Count, ev.Fights.Select(f => f.ExternalId).Distinct().Count());
    }

    [Fact]
    public void Calendar_snapshot_passes_the_existing_snapshot_validator()
    {
        var ev = UfCalendarParser.ParseEventSnapshot(Fixture("event-ufc-334.json"));

        new MmaEventSnapshotValidator().ValidateAndThrow(ev);
    }

    [Fact]
    public void Accented_names_survive_utf8_parsing()
    {
        var results = UfCalendarParser.ParseResults(Fixture("event-results-2026-11-07.json"));

        Assert.Contains(results, r => r.FighterBName == "Nina Milošević" || r.FighterAName == "Nina Milošević");
    }

    [Fact]
    public void Results_of_2026_11_07_carry_winner_method_and_round()
    {
        var results = UfCalendarParser.ParseResults(Fixture("event-results-2026-11-07.json"));

        var main = Assert.Single(results, r => r.FighterAName == "Waldo Cortes Acosta" && r.FighterBName == "Johnny Walker");
        Assert.Equal(FightOutcomeStatus.Completed, main.Status);
        Assert.Equal("Johnny Walker", main.WinnerName);
        Assert.Equal("ko_tko", main.MethodNormalized);
        Assert.Equal(3, main.Round);
        Assert.Equal(147, main.TimeSeconds);

        var suarez = Assert.Single(results, r => r.FighterAName == "Tatiana Suarez");
        Assert.Equal("Tatiana Suarez", suarez.WinnerName);
        Assert.Equal("decision_unanimous", suarez.MethodNormalized);
    }

    [Fact]
    public void Cancelled_bouts_have_no_winner_and_are_reported_as_cancelled()
    {
        var results = UfCalendarParser.ParseResults(Fixture("event-results-2026-11-07.json"));

        var cancelled = results.Where(r => r.Status == FightOutcomeStatus.Cancelled).ToList();
        Assert.Equal(4, cancelled.Count);
        Assert.All(cancelled, c => Assert.Null(c.WinnerName));
        Assert.Equal(18, results.Count);
        Assert.Equal(14, results.Count(r => r.Status == FightOutcomeStatus.Completed));
        Assert.All(results.Where(r => r.Status == FightOutcomeStatus.Completed), r => Assert.NotNull(r.WinnerName));
    }

    [Fact]
    public void Upcoming_bouts_are_scheduled_with_no_result()
    {
        var results = UfCalendarParser.ParseResults(Fixture("event-ufc-334.json"));

        Assert.Contains(results, r => r.Status == FightOutcomeStatus.Scheduled);
        Assert.All(results.Where(r => r.Status == FightOutcomeStatus.Scheduled), r =>
        {
            Assert.Null(r.WinnerName);
            Assert.Null(r.Method);
        });
    }

    [Fact]
    public void Winner_id_matching_neither_fighter_never_invents_a_winner()
    {
        const string json = """
        {"data":{"id":1,"slug":"x","title":"T","org":"ufc","starts_at":"2026-01-01T00:00:00Z","card":[
         {"id":9,"card_section":"main","status":"completed","scheduled_rounds":3,
          "fighter_a":{"id":1,"name":"A One"},"fighter_b":{"id":2,"name":"B Two"},
          "result":{"winner_fighter_id":999,"method":"Decision","method_normalized":"decision_unanimous","round":3,"time_seconds":300}}]}}
        """;

        var r = Assert.Single(UfCalendarParser.ParseResults(json));

        Assert.Null(r.WinnerName);
        Assert.Equal(FightOutcomeStatus.Completed, r.Status);
    }

    [Fact]
    public void Missing_required_event_fields_fail_loudly()
    {
        Assert.Throws<InvalidDataException>(() => UfCalendarParser.ParseEventSnapshot("""{"data":{"id":1}}"""));
    }
}

public sealed class FightMatcherTests
{
    private static readonly DateTimeOffset T = DateTimeOffset.Parse("2026-11-08T01:00:00Z");

    [Theory]
    [InlineData("Nina Milošević", "nina milosevic")]
    [InlineData("  Gabriel   Lorenço ", "gabriel lorenco")]
    [InlineData("Mantas Kondratavičius", "mantas kondratavicius")]
    [InlineData("Jose D'Souza-Smith", "jose d souza smith")]
    [InlineData(null, "")]
    public void Names_are_normalised_without_accents(string? input, string expected) =>
        Assert.Equal(expected, FightMatcher.NormalizeName(input));

    [Fact]
    public void Same_bout_matches_regardless_of_order_accents_and_case()
    {
        Assert.True(FightMatcher.IsSameBout("Priscila Cachoeira", "Nina Milošević", T, "NINA MILOSEVIC", "priscila cachoeira", T.AddHours(3)));
    }

    [Fact]
    public void Same_names_more_than_the_tolerance_apart_do_not_match()
    {
        Assert.False(FightMatcher.IsSameBout("A One", "B Two", T, "A One", "B Two", T.AddHours(13)));
        Assert.True(FightMatcher.IsSameBout("A One", "B Two", T, "A One", "B Two", T.AddHours(11.9)));
    }

    [Fact]
    public void Different_opponent_is_a_different_bout()
    {
        Assert.False(FightMatcher.IsSameBout("Austin Bashi", "Lucas Brennan", T, "Austin Bashi", "Carlos Calderon", T));
    }

    [Fact]
    public void Find_returns_null_when_ambiguous_or_absent()
    {
        FightResultSnapshot Make(string a, string b) => new("P", "e", $"{a}{b}", a, b, null, FightOutcomeStatus.Scheduled, null, null, null, null, T);
        var one = new[] { Make("A One", "B Two"), Make("C Three", "D Four") };
        var dup = new[] { Make("A One", "B Two"), Make("B Two", "A One") };

        Assert.NotNull(FightMatcher.Find(one, "b two", "a one", T));
        Assert.Null(FightMatcher.Find(dup, "A One", "B Two", T));
        Assert.Null(FightMatcher.Find(one, "X Y", "Z W", T));
    }

    [Fact]
    public void Real_results_pair_with_the_apisports_spelling_of_the_same_bouts()
    {
        var results = UfCalendarParser.ParseResults(File.ReadAllText(
            Path.Combine(AppContext.BaseDirectory, "Fixtures", "UfCalendar", "event-results-2026-11-07.json")));
        // Names as API-Sports spells them (order and accents differ).
        var hit = FightMatcher.Find(results, "Nina Milošević", "Priscila Cachoeira", T);
        var swapped = FightMatcher.Find(results, "Thomas Petersen", "Gabriel Lorenço", T);

        Assert.NotNull(hit);
        Assert.NotNull(swapped);
        Assert.Equal(FightOutcomeStatus.Completed, swapped!.Status);
    }
}
