namespace Zenbet.EventsMarkets.Application.Tests.Domain;

using Xunit;
using Zenbet.EventsMarkets.Application.Commands.SettleUfcEvent;
using Zenbet.EventsMarkets.Domain.Aggregates;
using Zenbet.EventsMarkets.Domain.Enums;
using Zenbet.EventsMarkets.Domain.ValueObjects;

public sealed class UfcMarketResultResolverTests
{
    [Fact]
    public void Moneyline_ReturnsSelectionForWinnerCorner()
    {
        var market = BuildMarket(
            MarketType.MmaMoneyline,
            ("red", "Volkanovski"),
            ("blue", "Evloev"));

        var winner = UfcMarketResultResolver.ResolveWinner(
            market,
            FightCorner.Blue,
            MmaVictoryMethod.Decision,
            5);

        Assert.NotNull(winner);
        Assert.Equal("blue", winner!.Code);
    }

    [Fact]
    public void MethodOfVictory_UsesCornerAndMethodCode()
    {
        var market = BuildMarket(
            MarketType.MmaMethodOfVictory,
            ("red_ko", "Rojo KO"),
            ("red_submission", "Rojo sumisión"),
            ("red_decision", "Rojo decisión"),
            ("blue_ko", "Azul KO"),
            ("blue_submission", "Azul sumisión"),
            ("blue_decision", "Azul decisión"));

        var winner = UfcMarketResultResolver.ResolveWinner(
            market,
            FightCorner.Red,
            MmaVictoryMethod.Submission,
            2);

        Assert.NotNull(winner);
        Assert.Equal("red_submission", winner!.Code);
    }

    [Theory]
    [InlineData(2, "under")]
    [InlineData(5, "over")]
    public void TotalRounds_ComparesFinishRoundWithLine(int finishRound, string expectedCode)
    {
        var market = BuildMarketWithLine(
            MarketType.MmaTotalRounds,
            [("over", "Más de 4.5"), ("under", "Menos de 4.5")],
            4.5m);

        var winner = UfcMarketResultResolver.ResolveWinner(
            market,
            FightCorner.Red,
            MmaVictoryMethod.Knockout,
            finishRound);

        Assert.NotNull(winner);
        Assert.Equal(expectedCode, winner!.Code);
    }

    [Theory]
    [InlineData(MmaVictoryMethod.Decision, "yes")]
    [InlineData(MmaVictoryMethod.Knockout, "no")]
    public void GoToDecision_ReflectsVictoryMethod(
        MmaVictoryMethod method,
        string expectedCode)
    {
        var market = BuildMarket(
            MarketType.MmaGoToDecision,
            ("yes", "Sí"),
            ("no", "No"));

        var winner = UfcMarketResultResolver.ResolveWinner(
            market,
            FightCorner.Red,
            method,
            5);

        Assert.NotNull(winner);
        Assert.Equal(expectedCode, winner!.Code);
    }

    [Fact]
    public void UnsupportedMarket_ReturnsNull()
    {
        var market = BuildMarket(
            MarketType.Other,
            ("red", "Rojo"));

        var winner = UfcMarketResultResolver.ResolveWinner(
            market,
            FightCorner.Red,
            MmaVictoryMethod.Decision,
            5);

        Assert.Null(winner);
    }

    private static Market BuildMarket(
        MarketType type,
        params (string Code, string Name)[] selections)
    {
        return BuildMarketWithLine(type, selections, null);
    }

    private static Market BuildMarketWithLine(
        MarketType type,
        (string Code, string Name)[] selections,
        decimal? line)
    {
        var marketId = MarketId.New();
        var eventId = EventId.New();
        var builtSelections = selections
            .Select((selection, index) => new Selection(
                SelectionId.New(),
                selection.Name,
                new Odd(1.9m, DateTimeOffset.UtcNow),
                selection.Code,
                index))
            .ToList();

        return new Market(
            marketId,
            eventId,
            "Test market",
            type,
            builtSelections,
            line);
    }
}
