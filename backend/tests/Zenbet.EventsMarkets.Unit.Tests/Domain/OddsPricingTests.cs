namespace Zenbet.EventsMarkets.Unit.Tests.Domain;

using Xunit;
using Zenbet.EventsMarkets.Domain.Exceptions;
using Zenbet.EventsMarkets.Domain.Pricing;
using Zenbet.EventsMarkets.Domain.ValueObjects;

public sealed class OddsPricingTests
{
    private static SelectionProbability P(decimal probability) => new(SelectionId.New(), probability);

    [Fact]
    public void Two_Way_Market_Prices_With_The_Requested_Margin_Rounding_Down()
    {
        var pricing = OddsPricing.Price(new[] { P(0.55m), P(0.45m) }, 5m);

        // 1 / (0.55 * 1.05) = 1.7316  -> 1.73      1 / (0.45 * 1.05) = 2.1164 -> 2.11
        Assert.Equal(new[] { 1.73m, 2.11m }, pricing.Selections.Select(s => s.DecimalOdds).ToArray());
        // 1/1.73 + 1/2.11 - 1 = 5.1969% -> 5.20%: nunca por debajo del 5% pedido.
        Assert.Equal(5.20m, pricing.OverroundPercent);
    }

    [Fact]
    public void Odds_Are_Never_Rounded_Up_In_The_Players_Favour()
    {
        var pricing = OddsPricing.Price(new[] { P(0.5m), P(0.5m) }, 4m);

        // 1 / (0.5 * 1.04) = 1.9230... -> 1.92 (nunca 1.93)
        Assert.All(pricing.Selections, s => Assert.Equal(1.92m, s.DecimalOdds));
    }

    [Theory]
    [InlineData(1.001)]
    [InlineData(0.996)]
    [InlineData(1.0049)]
    public void Probabilities_Within_The_Tolerance_Are_Accepted_And_Normalized(double sum)
    {
        var half = (decimal)sum / 2m;

        var pricing = OddsPricing.Price(new[] { P(half), P(half) }, 5m);

        Assert.True(pricing.OverroundPercent >= 5m);
    }

    [Theory]
    [InlineData(1.006)]
    [InlineData(0.99)]
    [InlineData(1.2)]
    public void Probabilities_That_Do_Not_Sum_To_One_Are_Rejected(double sum)
    {
        var half = (decimal)sum / 2m;

        Assert.Throws<InvalidPricingException>(() => OddsPricing.Price(new[] { P(half), P(half) }, 5m));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(1.99)]
    [InlineData(20.01)]
    [InlineData(-5)]
    [InlineData(50)]
    public void A_Margin_Outside_The_Allowed_Range_Is_Rejected(double margin)
    {
        // Un margen negativo o casi cero regalaría un arbitraje seguro al jugador.
        Assert.Throws<InvalidPricingException>(() => OddsPricing.Price(new[] { P(0.5m), P(0.5m) }, (decimal)margin));
    }

    [Fact]
    public void A_Market_With_Fewer_Than_Two_Selections_Is_Rejected()
    {
        Assert.Throws<InvalidPricingException>(() => OddsPricing.Price(new[] { P(0.999m) }, 5m));
        Assert.Throws<InvalidPricingException>(() => OddsPricing.Price(Array.Empty<SelectionProbability>(), 5m));
    }

    [Fact]
    public void Repeated_Selections_Are_Rejected()
    {
        var id = SelectionId.New();

        Assert.Throws<InvalidPricingException>(() => OddsPricing.Price(
            new[] { new SelectionProbability(id, 0.5m), new SelectionProbability(id, 0.5m) },
            5m));
    }

    [Theory]
    [InlineData(0.0)]
    [InlineData(0.0005)]
    [InlineData(1.0)]
    [InlineData(-0.2)]
    public void A_Probability_Outside_The_Open_Range_Is_Rejected(double probability)
    {
        var p = (decimal)probability;

        Assert.Throws<InvalidPricingException>(() => OddsPricing.Price(new[] { P(p), P(1m - p) }, 5m));
    }

    [Fact]
    public void An_Extreme_Favourite_That_Would_Leave_Less_Than_The_Minimum_Margin_Is_Rejected()
    {
        // 0.995 / 0.005 con 2% de margen: la cuota del favorito se sube al mínimo 1.01 y el margen real
        // queda negativo (arbitraje). Debe rechazarse en lugar de publicarse.
        var ex = Assert.Throws<InvalidPricingException>(() => OddsPricing.Price(new[] { P(0.995m), P(0.005m) }, 2m));

        Assert.Equal("INVALID_PRICING", ex.Code);
    }

    [Fact]
    public void Longshots_Never_Exceed_The_Maximum_Odds()
    {
        // Con la probabilidad minima (0.001) y el margen minimo (2%) la cuota maxima posible es 980.39.
        var pricing = OddsPricing.Price(new[] { P(0.001m), P(0.499m), P(0.5m) }, 2m);

        Assert.Equal(980.39m, pricing.Selections[0].DecimalOdds);
        Assert.All(pricing.Selections, s => Assert.InRange(s.DecimalOdds, OddsPricing.MinDecimalOdds, OddsPricing.MaxDecimalOdds));
    }

    [Fact]
    public void A_Requested_Margin_That_Cannot_Be_Honoured_Is_Rejected_Instead_Of_Silently_Reduced()
    {
        // 87/13 con 17% de margen: la cuota del favorito caeria por debajo de 1.00 y se subiria al minimo 1.01,
        // dejando un margen efectivo de ~13.8%. Debe rechazarse en lugar de entregar menos margen en silencio.
        var ex = Assert.Throws<InvalidPricingException>(() => OddsPricing.Price(new[] { P(0.873745m), P(0.126255m) }, 17.02m));

        Assert.Contains("margen", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Property_The_Effective_Margin_Is_Never_Below_The_Requested_One_For_Random_Markets()
    {
        var random = new Random(20261108);
        var accepted = 0;
        var rejected = 0;

        for (var iteration = 0; iteration < 3000; iteration++)
        {
            var count = random.Next(2, 9);
            var margin = Math.Round((decimal)(random.NextDouble() * 18 + 2), 2);

            var weights = Enumerable.Range(0, count).Select(_ => 0.05 + random.NextDouble()).ToArray();
            var total = weights.Sum();
            var probabilities = weights.Select(w => decimal.Round((decimal)(w / total), 6)).ToArray();
            var inputs = probabilities.Select(P).ToArray();

            MarketPricing pricing;
            try
            {
                pricing = OddsPricing.Price(inputs, margin);
            }
            catch (InvalidPricingException)
            {
                // Margen inalcanzable para un favorito extremo: rechazar es correcto (nunca se entrega menos margen).
                rejected++;
                continue;
            }

            accepted++;

            // El margen efectivo nunca es menor que el pedido (el redondeo siempre favorece a la casa).
            Assert.True(
                pricing.OverroundPercent >= margin - 0.01m,
                $"margin {margin} overround {pricing.OverroundPercent} probabilities {string.Join(",", probabilities)}");

            // Y ninguna cuota supera el valor justo con margen (nunca se redondea a favor del jugador).
            var sum = probabilities.Sum();
            foreach (var priced in pricing.Selections)
            {
                var ceiling = 1m / ((priced.FairProbability / sum) * (1m + margin / 100m));
                Assert.True(priced.DecimalOdds <= ceiling, $"odds {priced.DecimalOdds} > ceiling {ceiling}");
                Assert.True(priced.DecimalOdds >= OddsPricing.MinDecimalOdds);
            }

            // Garantía absoluta: apostar a todas las selecciones nunca deja beneficio seguro al jugador.
            Assert.True(pricing.Selections.Sum(s => 1m / s.DecimalOdds) > 1m);
        }

        // La propiedad debe haberse ejercitado de verdad: la gran mayoria de mercados aleatorios son cotizables.
        Assert.True(accepted > 2000, $"solo {accepted} aceptados y {rejected} rechazados");
    }
}
