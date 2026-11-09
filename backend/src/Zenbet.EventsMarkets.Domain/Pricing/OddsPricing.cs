namespace Zenbet.EventsMarkets.Domain.Pricing;

using Zenbet.EventsMarkets.Domain.Exceptions;
using Zenbet.EventsMarkets.Domain.ValueObjects;

/// <summary>Probabilidad "justa" (sin margen) que el trader asigna a una selección.</summary>
public readonly record struct SelectionProbability(SelectionId SelectionId, decimal FairProbability);

public sealed record PricedSelection(SelectionId SelectionId, decimal FairProbability, decimal DecimalOdds);

/// <param name="OverroundPercent">Suma de probabilidades implícitas menos 1, en %. Es el margen real de la casa.</param>
public sealed record MarketPricing(IReadOnlyList<PricedSelection> Selections, decimal OverroundPercent);

/// <summary>
/// Convierte probabilidades justas en cuotas con margen de casa. Función pura y determinista.
///
/// Garantías (cada una cubierta por tests):
/// - El margen efectivo NUNCA queda por debajo del mínimo: una suma de probabilidades implícitas menor
///   que 1 es un arbitraje seguro para el jugador (gana apostando a todas las selecciones).
/// - Las cuotas se redondean siempre HACIA ABAJO a 2 decimales (a favor de la casa), nunca hacia arriba.
/// - Entradas absurdas (probabilidades que no suman 1, márgenes fuera de rango) se rechazan en vez de
///   "corregirse" en silencio.
/// </summary>
public static class OddsPricing
{
    public const decimal MinMarginPercent = 2m;
    public const decimal MaxMarginPercent = 20m;
    public const decimal MinDecimalOdds = 1.01m;
    public const decimal MaxDecimalOdds = 1000m;
    public const decimal MinProbability = 0.001m;
    public const decimal ProbabilityTolerance = 0.005m;

    public static MarketPricing Price(IReadOnlyList<SelectionProbability> inputs, decimal marginPercent)
    {
        if (inputs is null || inputs.Count < 2)
            throw new InvalidPricingException("Un mercado necesita al menos dos selecciones.");

        if (inputs.Select(i => i.SelectionId).Distinct().Count() != inputs.Count)
            throw new InvalidPricingException("Hay selecciones repetidas.");

        if (marginPercent < MinMarginPercent || marginPercent > MaxMarginPercent)
            throw new InvalidPricingException(
                $"El margen debe estar entre {MinMarginPercent}% y {MaxMarginPercent}% (recibido {marginPercent}%).");

        foreach (var input in inputs)
        {
            if (input.FairProbability < MinProbability || input.FairProbability >= 1m)
                throw new InvalidPricingException(
                    $"La probabilidad de cada selección debe estar entre {MinProbability} y 1 (excluido).");
        }

        var sum = inputs.Sum(i => i.FairProbability);
        if (Math.Abs(sum - 1m) > ProbabilityTolerance)
            throw new InvalidPricingException(
                $"Las probabilidades deben sumar 1 (tolerancia {ProbabilityTolerance}); suman {sum}.");

        var factor = 1m + (marginPercent / 100m);
        var priced = new List<PricedSelection>(inputs.Count);

        foreach (var input in inputs)
        {
            var normalized = input.FairProbability / sum;
            var raw = 1m / (normalized * factor);
            var rounded = decimal.Floor(raw * 100m) / 100m;
            var odds = Math.Clamp(rounded, MinDecimalOdds, MaxDecimalOdds);
            priced.Add(new PricedSelection(input.SelectionId, input.FairProbability, odds));
        }

        var overround = priced.Sum(p => 1m / p.DecimalOdds) - 1m;
        var overroundPercent = decimal.Round(overround * 100m, 2, MidpointRounding.ToEven);

        // El único modo de que el margen efectivo quede por debajo del pedido es que la cuota de un favorito
        // extremo se haya subido hasta el mínimo (1.01). No se entrega menos margen del pedido en silencio.
        if (overroundPercent + 0.01m < marginPercent)
            throw new InvalidPricingException(
                $"No se puede aplicar el margen pedido ({marginPercent}%): la cuota del favorito caería por debajo " +
                $"de {MinDecimalOdds} y el margen efectivo sería {overroundPercent}%. " +
                "Usa un margen menor o probabilidades menos extremas.");

        if (overround * 100m < MinMarginPercent)
            throw new InvalidPricingException(
                $"El margen efectivo ({overroundPercent}%) queda por debajo del mínimo ({MinMarginPercent}%): " +
                "las probabilidades son demasiado extremas para cotizar este mercado.");

        return new MarketPricing(priced, overroundPercent);
    }
}
