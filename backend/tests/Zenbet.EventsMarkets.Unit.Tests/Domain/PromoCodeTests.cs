namespace Zenbet.EventsMarkets.Unit.Tests.Domain;

using Xunit;
using Zenbet.EventsMarkets.Domain.ValueObjects;

public sealed class PromoCodeTests
{
    [Fact]
    public void Shibuya10_CalculatesBonusOnNetWinnings()
    {
        Assert.True(PromoCodeCatalog.TryResolve(" shibuya10 ", out var promo));
        Assert.NotNull(promo);

        var bonus = promo!.CalculateBonus(90m);

        Assert.Equal(9m, bonus);
    }

    [Fact]
    public void UnknownCode_IsRejected()
    {
        Assert.False(PromoCodeCatalog.TryResolve("NO-EXISTE", out var promo));
        Assert.Null(promo);
    }

    [Fact]
    public void LosingBet_HasNoPromoBonus()
    {
        Assert.True(PromoCodeCatalog.TryResolve("SHIBUYA10", out var promo));

        Assert.Equal(0m, promo!.CalculateBonus(-10m));
    }
}
