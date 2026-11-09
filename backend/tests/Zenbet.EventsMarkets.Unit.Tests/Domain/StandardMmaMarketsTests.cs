namespace Zenbet.EventsMarkets.Unit.Tests.Domain;

using Xunit;
using Zenbet.EventsMarkets.Application.Commands.SettleUfcEvent;
using Zenbet.EventsMarkets.Domain.Aggregates;
using Zenbet.EventsMarkets.Domain.Enums;
using Zenbet.EventsMarkets.Domain.Pricing;
using Zenbet.EventsMarkets.Domain.ValueObjects;

public sealed class StandardMmaMarketsTests
{
    private static readonly DateTimeOffset Now = new(2026, 11, 9, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public void Opens_the_four_standard_markets_unpriced_unbettable_and_hidden()
    {
        var markets = StandardMmaMarkets.BuildMissing(EventId.New(), Bout(3), new HashSet<MarketType>(), "qa", Now);

        Assert.Equal(StandardMmaMarkets.Types, markets.Select(m => m.Type));
        Assert.All(markets, m =>
        {
            Assert.Equal(MarketStatus.Open, m.Status);
            Assert.True(m.IsAwaitingPricing);
            Assert.False(m.IsExecutable); // ninguna apuesta antes de PriceMarket
            Assert.Equal(OddsSourceKind.Pending, m.Provenance!.Kind);
        });
        Assert.Equal(12, markets.Sum(m => m.Selections.Count));
        Assert.Equal(new[] { "red", "blue" }, markets[0].Selections.Select(s => s.Code));
        Assert.Equal("Red Fighter", markets[0].Selections.Single(s => s.Code == "red").Name);
        Assert.Equal(2.5m, markets.Single(m => m.Type == MarketType.MmaTotalRounds).Line);
    }

    [Fact]
    public void Five_round_fights_get_a_4_5_rounds_line()
    {
        var markets = StandardMmaMarkets.BuildMissing(EventId.New(), Bout(5), new HashSet<MarketType>(), "qa", Now);

        var total = markets.Single(m => m.Type == MarketType.MmaTotalRounds);
        Assert.Equal(4.5m, total.Line);
        Assert.Contains(total.Selections, s => s.Name == "Más de 4.5 asaltos");
    }

    [Fact]
    public void Existing_market_types_are_not_duplicated()
    {
        var existing = new HashSet<MarketType> { MarketType.MmaMoneyline, MarketType.MmaGoToDecision };

        var markets = StandardMmaMarkets.BuildMissing(EventId.New(), Bout(3), existing, "qa", Now);

        Assert.Equal(new[] { MarketType.MmaMethodOfVictory, MarketType.MmaTotalRounds }, markets.Select(m => m.Type));
    }

    /// <summary>
    /// Contrato con la liquidación: TODO resultado posible de un combate debe resolver exactamente una selección en cada
    /// mercado abierto. Si un código no casa con UfcMarketResultResolver, liquidar fallaría con dinero en juego.
    /// </summary>
    [Theory]
    [InlineData(3)]
    [InlineData(5)]
    public void Every_possible_result_resolves_a_winner_in_every_market(int rounds)
    {
        var markets = StandardMmaMarkets.BuildMissing(EventId.New(), Bout(rounds), new HashSet<MarketType>(), "qa", Now);

        foreach (var corner in new[] { FightCorner.Red, FightCorner.Blue })
        foreach (var method in new[] { MmaVictoryMethod.Knockout, MmaVictoryMethod.Submission, MmaVictoryMethod.Decision })
        for (var round = 1; round <= rounds; round++)
        {
            if (method == MmaVictoryMethod.Decision && round != rounds) continue; // una decisión solo existe en el último asalto

            foreach (var market in markets)
            {
                var winner = UfcMarketResultResolver.ResolveWinner(market, corner, method, round);
                Assert.NotNull(winner);
            }

            var c = corner == FightCorner.Red ? "red" : "blue";
            Assert.Equal(c, UfcMarketResultResolver.ResolveWinner(markets[0], corner, method, round)!.Code);
            Assert.Equal($"{c}_{UfcMarketResultResolver.MethodCode(method)}",
                UfcMarketResultResolver.ResolveWinner(markets[1], corner, method, round)!.Code);
            Assert.Equal(round == rounds ? "over" : "under",
                UfcMarketResultResolver.ResolveWinner(markets[2], corner, method, round)!.Code);
            Assert.Equal(method == MmaVictoryMethod.Decision ? "yes" : "no",
                UfcMarketResultResolver.ResolveWinner(markets[3], corner, method, round)!.Code);
        }
    }

    [Fact]
    public void Pricing_turns_a_pending_market_into_an_operator_market()
    {
        var market = StandardMmaMarkets.BuildMissing(EventId.New(), Bout(3), new HashSet<MarketType>(), "qa", Now)[0];

        market.SetProvenance(new MarketProvenance("ZenBet Trading", OddsSourceKind.Operator, null, Now));

        Assert.False(market.IsAwaitingPricing);
        Assert.True(market.IsExecutable);
    }

    [Fact]
    public void Replacing_a_fighter_voids_unpriced_markets_and_suspends_priced_ones()
    {
        var @event = new Event(EventId.New(), "Red vs Blue", SportType.MixedMartialArts, Now.AddDays(3), "UFC Test", Bout(3));
        var pending = AddStandard(@event, MarketType.MmaMoneyline);
        var priced = AddStandard(@event, MarketType.MmaGoToDecision);
        priced.SetProvenance(new MarketProvenance("ZenBet Trading", OddsSourceKind.Operator, null, Now));

        @event.SynchronizeFromProvider("Red vs Other", Now.AddDays(3), "UFC Test", Bout(3, blueId: "other-fighter", blueName: "Other Fighter"));

        Assert.Equal(MarketStatus.Void, pending.Status);
        Assert.Equal(MarketStatus.Suspended, priced.Status);
    }

    [Fact]
    public void Changing_the_scheduled_rounds_also_counts_as_a_different_fight()
    {
        var @event = new Event(EventId.New(), "Red vs Blue", SportType.MixedMartialArts, Now.AddDays(3), "UFC Test", Bout(3));
        var pending = AddStandard(@event, MarketType.MmaTotalRounds);

        @event.SynchronizeFromProvider("Red vs Blue", Now.AddDays(3), "UFC Test", Bout(5));

        Assert.Equal(MarketStatus.Void, pending.Status);
    }

    [Fact]
    public void A_spelling_fix_of_the_same_fighter_does_not_touch_markets()
    {
        var @event = new Event(EventId.New(), "Red vs Blue", SportType.MixedMartialArts, Now.AddDays(3), "UFC Test", Bout(3));
        var pending = AddStandard(@event, MarketType.MmaMoneyline);

        @event.SynchronizeFromProvider("Red vs Blue", Now.AddDays(3), "UFC Test", Bout(3, blueName: "Blüe Fighter"));

        Assert.Equal(MarketStatus.Open, pending.Status);
    }

    private static Market AddStandard(Event @event, MarketType type)
    {
        var template = StandardMmaMarkets.BuildMissing(@event.Id, @event.Bout!, StandardMmaMarkets.Types.Where(t => t != type).ToHashSet(), "qa", Now).Single();
        return @event.AddMarket(template.Id, template.Name, template.Type, template.Selections.ToList(), template.Line, template.DisplayOrder, template.Provenance);
    }

    private static MmaBout Bout(int rounds, string blueId = "blue-fighter", string blueName = "Blue Fighter")
    {
        var division = WeightDivision.Lightweight;
        var red = Fighter.Create("red-fighter", "Red Fighter", "MX", "México", "N/D", null, division);
        var blue = Fighter.Create(blueId, blueName, "US", "Estados Unidos", "N/D", null, division);
        return MmaBout.Create(red, blue, division, rounds, isTitleFight: false, FightBilling.Main, 1, "Arena", "Ciudad");
    }
}
