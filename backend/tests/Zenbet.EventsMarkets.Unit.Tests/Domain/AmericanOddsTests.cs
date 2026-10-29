namespace Zenbet.EventsMarkets.Unit.Tests.Domain;

using Xunit;
using Zenbet.EventsMarkets.Domain.ValueObjects;

public sealed class AmericanOddsTests
{
    [Theory]
    [InlineData(-111, 1.9009)]
    [InlineData(-109, 1.9174)]
    [InlineData(+435, 5.3500)]
    [InlineData(+1605, 17.0500)]
    [InlineData(+100, 2.0000)]
    public void ToDecimal_PreservesFourDecimalPrecision(int american, decimal expected)
    {
        Assert.Equal(expected, AmericanOdds.ToDecimal(american));
    }

    [Theory]
    [InlineData(1.9009, "-111")]
    [InlineData(1.9174, "-109")]
    [InlineData(5.3500, "+435")]
    [InlineData(17.0500, "+1605")]
    [InlineData(2.0000, "+100")]
    public void FromDecimal_ReturnsPublishedAmericanOdd(decimal decimalOdd, string expected)
    {
        Assert.Equal(expected, AmericanOdds.FromDecimal(decimalOdd));
    }

    [Theory]
    [InlineData("+435", 435)]
    [InlineData("-111", -111)]
    [InlineData("  -109  ", -109)]
    public void TryParse_AcceptsSignedAmericanOdds(string value, int expected)
    {
        Assert.True(AmericanOdds.TryParse(value, out var american));
        Assert.Equal(expected, american);
    }

    [Fact]
    public void Odd_RoundsToFourDecimals()
    {
        var odd = new Odd(1.23456m, DateTimeOffset.UtcNow);

        Assert.Equal(1.2346m, odd.Value);
    }
}
