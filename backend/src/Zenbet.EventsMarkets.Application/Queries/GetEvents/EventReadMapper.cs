namespace Zenbet.EventsMarkets.Application.Queries.GetEvents;

using Zenbet.EventsMarkets.Application.DTOs;
using Zenbet.EventsMarkets.Domain.Aggregates;
using Zenbet.EventsMarkets.Domain.Enums;
using Zenbet.EventsMarkets.Domain.ValueObjects;

internal static class EventReadMapper
{
    public static EventDto ToDto(Event @event)
    {
        return new EventDto(
            @event.Id.Value,
            @event.Name,
            SportLabel(@event.SportType),
            SportKey(@event.SportType),
            @event.Status.ToString().ToLowerInvariant(),
            @event.StartTime,
            @event.Competition,
            @event.Bout is null ? null : ToDto(@event.Bout),
            MapMarkets(@event),
            LastOddsUpdate(@event));
    }

    /// <summary>
    /// Proyección Head-to-Head. Devuelve null para eventos sin metadatos de
    /// combate; la capa HTTP lo traduce a 404.
    /// </summary>
    public static FighterComparisonDto? ToFighterComparisonDto(Event @event)
    {
        if (@event.Bout is null)
            return null;

        var bout = @event.Bout;
        var division = WeightDivisionCatalog.Get(bout.Division);

        return new FighterComparisonDto(
            @event.Id.Value,
            @event.Name,
            @event.Competition,
            @event.Status.ToString().ToLowerInvariant(),
            @event.StartTime,
            division.Slug,
            division.Label,
            bout.ScheduledRounds,
            bout.IsTitleFight,
            BillingKey(bout.Billing),
            BillingLabel(bout.Billing),
            bout.BillingOrder,
            bout.Venue,
            bout.Location,
            ToDto(bout.Red),
            ToDto(bout.Blue),
            MapMarkets(@event),
            LastOddsUpdate(@event));
    }

    private static IReadOnlyList<MarketDto> MapMarkets(Event @event) =>
        @event.Markets
            .OrderBy(market => market.DisplayOrder)
            .ThenBy(market => market.Name, StringComparer.Ordinal)
            .Select(ToDto)
            .ToList();

    private static DateTimeOffset? LastOddsUpdate(Event @event)
    {
        var lastOddsUpdate = @event.Markets
            .SelectMany(market => market.Selections)
            .Select(selection => selection.CurrentOdd.Timestamp)
            .DefaultIfEmpty()
            .Max();

        return lastOddsUpdate == default ? null : lastOddsUpdate;
    }

    private static MmaBoutDto ToDto(MmaBout bout)
    {
        var division = WeightDivisionCatalog.Get(bout.Division);

        return new MmaBoutDto(
            division.Slug,
            division.Label,
            division.LimitLbs,
            bout.ScheduledRounds,
            bout.IsTitleFight,
            BillingKey(bout.Billing),
            BillingLabel(bout.Billing),
            bout.BillingOrder,
            bout.Venue,
            bout.Location,
            ToDto(bout.Red),
            ToDto(bout.Blue),
            bout.Red.ImageUrl,
            bout.Blue.ImageUrl);
    }

    private static FighterDto ToDto(Fighter fighter)
    {
        var division = WeightDivisionCatalog.Get(fighter.Division);
        var record = fighter.GetRecordBreakdown();

        return new FighterDto(
            fighter.Id,
            fighter.Name,
            fighter.CountryCode,
            fighter.Country,
            fighter.Record,
            fighter.Rank,
            division.Slug,
            division.Label,
            fighter.ImageUrl,
            record.Wins,
            record.Losses,
            record.Draws,
            record.WinRate,
            fighter.ReachInches,
            StanceKey(fighter.Stance),
            fighter.TakedownDefensePercent,
            fighter.StrikingAccuracyPercent);
    }

    private static MarketDto ToDto(Market market)
    {
        var selections = market.Selections
            .OrderBy(selection => selection.DisplayOrder)
            .ThenBy(selection => selection.Name, StringComparer.Ordinal)
            .Select(ToDto)
            .ToList();

        return new MarketDto(
            market.Id.Value,
            market.Type.ToString(),
            MarketTypeKey(market.Type),
            market.Name,
            market.Line,
            market.DisplayOrder,
            market.Status.ToString().ToLowerInvariant(),
            selections.Select(selection => selection.Provider).FirstOrDefault(provider => provider is not null),
            selections.Select(selection => selection.UpdatedAt).Where(timestamp => timestamp.HasValue).Max(),
            ToSource(market),
            selections);
    }

    private static MarketSourceDto? ToSource(Market market)
    {
        if (market.Provenance is null)
            return null;

        return new MarketSourceDto(
            market.Provenance.Kind.ToString().ToLowerInvariant(),
            market.Provenance.Provider,
            market.Provenance.Url,
            market.Provenance.ObservedAt,
            market.Provenance.Note);
    }

    private static SelectionDto ToDto(Selection selection) =>
        new(
            selection.Id.Value,
            selection.Code,
            selection.Name,
            selection.CurrentOdd.Value,
            AmericanOdds.FromDecimal(selection.CurrentOdd.Value),
            selection.DisplayOrder,
            selection.SettlementResult.HasValue,
            selection.CurrentOdd.Provider,
            selection.CurrentOdd.Timestamp);

    private static string SportLabel(SportType sportType) => sportType switch
    {
        SportType.MixedMartialArts => "MMA",
        SportType.Football => "Fútbol",
        SportType.Tennis => "Tenis",
        SportType.Basketball => "Baloncesto",
        SportType.IceHockey => "Hockey sobre hielo",
        SportType.Baseball => "Béisbol",
        SportType.AmericanFootball => "Fútbol americano",
        SportType.Cricket => "Críquet",
        SportType.Esports => "eSports",
        _ => "Otros"
    };

    private static string SportKey(SportType sportType) => sportType switch
    {
        SportType.MixedMartialArts => "mma",
        _ => sportType.ToString().ToLowerInvariant()
    };

    private static string MarketTypeKey(MarketType type) => type switch
    {
        MarketType.MmaMoneyline => "moneyline",
        MarketType.MmaMethodOfVictory => "method_of_victory",
        MarketType.MmaTotalRounds => "total_rounds",
        MarketType.MmaGoToDecision => "go_to_decision",
        MarketType.MatchWinner => "match_winner",
        _ => "other"
    };

    private static string BillingKey(FightBilling billing) => billing switch
    {
        FightBilling.Main => "main",
        FightBilling.Prelims => "prelims",
        FightBilling.EarlyPrelims => "early_prelims",
        _ => "other"
    };

    private static string BillingLabel(FightBilling billing) => billing switch
    {
        FightBilling.Main => "Cartelera estelar",
        FightBilling.Prelims => "Preliminares",
        FightBilling.EarlyPrelims => "Preliminares tempranas",
        _ => "Otros combates"
    };

    private static string? StanceKey(FighterStance? stance) => stance switch
    {
        FighterStance.Orthodox => "orthodox",
        FighterStance.Southpaw => "southpaw",
        FighterStance.Switch => "switch",
        _ => null
    };
}
