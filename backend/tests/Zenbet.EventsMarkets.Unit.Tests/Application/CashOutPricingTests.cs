namespace Zenbet.EventsMarkets.Unit.Tests.Application;

using Xunit;
using Zenbet.EventsMarkets.Application.Commands.CashOut;
using Zenbet.EventsMarkets.Domain.Exceptions;
using Zenbet.EventsMarkets.Domain.ValueObjects;

public sealed class CashOutPricingTests
{
    [Fact]
    public void Calculate_Uses_Current_Over_Initial_Odds_Ratio_And_Retention_Margin()
    {
        // (3.00 / 2.00) * 100 * 0.90 = 135.00
        var amount = CashOutPricing.Calculate(
            stake: new Money(100m),
            initialOdds: 2.00m,
            currentOdds: 3.00m);

        Assert.Equal(new Money(135m), amount);
    }

    [Fact]
    public void Calculate_Reduces_The_Value_When_Current_Odds_Drop()
    {
        // (1.50 / 2.00) * 100 * 0.90 = 67.50
        var amount = CashOutPricing.Calculate(
            stake: new Money(100m),
            initialOdds: 2.00m,
            currentOdds: 1.50m);

        Assert.Equal(new Money(67.50m), amount);
    }

    [Fact]
    public void Calculate_Rounds_Half_Away_From_Zero_To_Cents()
    {
        // (1.34 / 1.20) * 1 * 0.90 = 1.005 -> 1.01
        var amount = CashOutPricing.Calculate(
            stake: new Money(1m),
            initialOdds: 1.20m,
            currentOdds: 1.34m);

        Assert.Equal(new Money(1.01m), amount);
    }

    [Fact]
    public void Default_Retention_Margin_Is_Ninety_Percent()
    {
        Assert.Equal(0.90m, CashOutPricing.DefaultRetentionMargin);
    }

    [Theory]
    [InlineData(0, 2.00, 1.50, 0.90)]
    [InlineData(-1, 2.00, 1.50, 0.90)]
    [InlineData(100, 1.00, 1.50, 0.90)]
    [InlineData(100, 2.00, 0.50, 0.90)]
    [InlineData(100, 2.00, 1.50, 0)]
    [InlineData(100, 2.00, 1.50, 1.01)]
    public void Calculate_Rejects_Invalid_Inputs(
        decimal stake,
        decimal initialOdds,
        decimal currentOdds,
        decimal retentionMargin)
    {
        Assert.Throws<InvalidTransactionAmountException>(() => CashOutPricing.Calculate(
            Money.Signed(stake),
            initialOdds,
            currentOdds,
            retentionMargin));
    }
}
