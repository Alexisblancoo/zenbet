namespace Zenbet.EventsMarkets.Domain.ValueObjects;

/// <summary>
/// Definición de un código promocional. El bono se calcula sobre las ganancias
/// netas de una apuesta ganadora (retorno menos stake), nunca sobre el stake.
/// </summary>
public sealed record PromoCodeDefinition(string Code, decimal BonusRate, string Description)
{
    public decimal CalculateBonus(decimal netWinnings)
    {
        if (netWinnings <= 0m) return 0m;

        return Math.Round(
            netWinnings * BonusRate,
            2,
            MidpointRounding.AwayFromZero);
    }
}

/// <summary>
/// Catálogo local de promociones. En producción esta lista vendría de una
/// tabla administrada por operaciones; el contrato del boleto ya está listo
/// para persistir el código aplicado en cada apuesta.
/// </summary>
public static class PromoCodeCatalog
{
    private static readonly IReadOnlyDictionary<string, PromoCodeDefinition> Codes =
        new Dictionary<string, PromoCodeDefinition>(StringComparer.OrdinalIgnoreCase)
        {
            ["SHIBUYA10"] = new(
                "SHIBUYA10",
                0.10m,
                "10% extra sobre las ganancias netas"),
        };

    public static IReadOnlyCollection<PromoCodeDefinition> All => Codes.Values.ToArray();

    public static bool TryResolve(string? rawCode, out PromoCodeDefinition? promoCode)
    {
        promoCode = null;

        var normalized = rawCode?.Trim();
        if (string.IsNullOrWhiteSpace(normalized)) return false;

        if (!Codes.TryGetValue(normalized, out var found)) return false;

        promoCode = found;
        return true;
    }

    public static PromoCodeDefinition? Resolve(string? rawCode) =>
        TryResolve(rawCode, out var promoCode) ? promoCode : null;
}
