namespace Zenbet.EventsMarkets.Application.Tests.Domain;

using Xunit;
using Zenbet.EventsMarkets.Domain.Enums;
using Zenbet.EventsMarkets.Domain.ValueObjects;

public sealed class FighterMetricsTests
{
    [Theory]
    [InlineData("28-4-0", 28, 4, 0, 87.5)]
    [InlineData("20-0", 20, 0, 0, 100)]
    [InlineData("15-3-1", 15, 3, 1, 78.9)]
    [InlineData("sin-récord", 0, 0, 0, 0)]
    public void Parse_InterpretsEditorialRecord(
        string record,
        int wins,
        int losses,
        int draws,
        decimal winRate)
    {
        var parsed = FighterRecord.Parse(record);

        Assert.Equal(wins, parsed.Wins);
        Assert.Equal(losses, parsed.Losses);
        Assert.Equal(draws, parsed.Draws);
        Assert.Equal(winRate, parsed.WinRate);
    }

    [Fact]
    public void Fighter_Create_StoresTechnicalMetrics()
    {
        var fighter = Fighter.Create(
            "alexander-volkanovski",
            "Alexander Volkanovski",
            "AU",
            "Australia",
            "28-4-0",
            "C",
            WeightDivision.Featherweight,
            reachInches: 71,
            stance: FighterStance.Orthodox,
            takedownDefensePercent: 73.4m,
            strikingAccuracyPercent: 57.2m);

        Assert.Equal(71, fighter.ReachInches);
        Assert.Equal(FighterStance.Orthodox, fighter.Stance);
        Assert.Equal(73.4m, fighter.TakedownDefensePercent);
        Assert.Equal(57.2m, fighter.StrikingAccuracyPercent);
        Assert.Equal(87.5m, fighter.GetRecordBreakdown().WinRate);
    }

    [Fact]
    public void Fighter_UpdateMetrics_ReplacesPreviousValues()
    {
        var fighter = Fighter.Create(
            "movsar-evloev",
            "Movsar Evloev",
            "RU",
            "Rusia",
            "20-0-0",
            "#1",
            WeightDivision.Featherweight);

        fighter.UpdateMetrics(70, FighterStance.Orthodox, 79.1m, 50.4m);

        Assert.Equal(70, fighter.ReachInches);
        Assert.Equal(79.1m, fighter.TakedownDefensePercent);
        Assert.Equal(50.4m, fighter.StrikingAccuracyPercent);
    }

    [Theory]
    [InlineData(49)]
    [InlineData(91)]
    public void Fighter_Create_RejectsReachOutsideHumanRange(int reachInches)
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => Fighter.Create(
            "fighter",
            "Fighter",
            "MX",
            "México",
            "1-0-0",
            null,
            WeightDivision.Featherweight,
            reachInches: reachInches));
    }
}
