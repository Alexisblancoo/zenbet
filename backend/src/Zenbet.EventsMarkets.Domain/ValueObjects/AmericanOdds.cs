namespace Zenbet.EventsMarkets.Domain.ValueObjects;

using System.Globalization;

/// <summary>
/// Conversión determinista entre cuota decimal y cuota americana. La cuota
/// decimal es la fuente de verdad; la americana se deriva para presentación.
/// </summary>
public static class AmericanOdds
{
    public static string FromDecimal(decimal decimalOdd)
    {
        if (decimalOdd <= 1m)
            throw new ArgumentOutOfRangeException(nameof(decimalOdd), "La cuota decimal debe ser mayor que 1.");

        var american = decimalOdd >= 2m
            ? Math.Round((decimalOdd - 1m) * 100m, 0, MidpointRounding.AwayFromZero)
            : -Math.Round(100m / (decimalOdd - 1m), 0, MidpointRounding.AwayFromZero);

        return american > 0m
            ? $"+{american.ToString("0", CultureInfo.InvariantCulture)}"
            : american.ToString("0", CultureInfo.InvariantCulture);
    }

    public static decimal ToDecimal(int american)
    {
        if (american == 0)
            throw new ArgumentOutOfRangeException(nameof(american), "La cuota americana no puede ser 0.");

        var value = american > 0
            ? 1m + (american / 100m)
            : 1m + (100m / Math.Abs(american));

        return Math.Round(value, 2, MidpointRounding.AwayFromZero);
    }
}
