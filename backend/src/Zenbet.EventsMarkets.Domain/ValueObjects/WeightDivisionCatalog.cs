namespace Zenbet.EventsMarkets.Domain.ValueObjects;

using Zenbet.EventsMarkets.Domain.Enums;

/// <summary>
/// Catálogo de divisiones oficiales de UFC. El slug es el identificador estable
/// que viaja en JSON y PostgreSQL; la etiqueta es solo presentación.
/// </summary>
public sealed record WeightDivisionInfo(
    WeightDivision Division,
    string Slug,
    string Label,
    int LimitLbs);

public static class WeightDivisionCatalog
{
    private static readonly IReadOnlyDictionary<WeightDivision, WeightDivisionInfo> ByDivision =
        new WeightDivisionInfo[]
        {
            new(WeightDivision.Flyweight, "flyweight", "Peso Mosca", 125),
            new(WeightDivision.Bantamweight, "bantamweight", "Peso Gallo", 135),
            new(WeightDivision.Featherweight, "featherweight", "Peso Pluma", 145),
            new(WeightDivision.Lightweight, "lightweight", "Peso Ligero", 155),
            new(WeightDivision.Welterweight, "welterweight", "Peso Wélter", 170),
            new(WeightDivision.Middleweight, "middleweight", "Peso Medio", 185),
            new(WeightDivision.LightHeavyweight, "light-heavyweight", "Peso Semipesado", 205),
            new(WeightDivision.Heavyweight, "heavyweight", "Peso Pesado", 265),
            new(WeightDivision.WomensStrawweight, "womens-strawweight", "Peso Paja Femenino", 115),
            new(WeightDivision.WomensFlyweight, "womens-flyweight", "Peso Mosca Femenino", 125),
            new(WeightDivision.WomensBantamweight, "womens-bantamweight", "Peso Gallo Femenino", 135)
        }.ToDictionary(info => info.Division);

    private static readonly IReadOnlyDictionary<string, WeightDivisionInfo> BySlug =
        ByDivision.Values.ToDictionary(info => info.Slug, StringComparer.OrdinalIgnoreCase);

    public static IReadOnlyCollection<WeightDivisionInfo> All => ByDivision.Values.ToArray();

    public static WeightDivisionInfo Get(WeightDivision division) =>
        ByDivision.TryGetValue(division, out var info)
            ? info
            : throw new ArgumentOutOfRangeException(nameof(division), division, "División de peso no reconocida.");

    public static bool TryParse(string? slug, out WeightDivisionInfo info)
    {
        if (!string.IsNullOrWhiteSpace(slug) && BySlug.TryGetValue(slug.Trim(), out var found))
        {
            info = found;
            return true;
        }

        info = null!;
        return false;
    }

    public static WeightDivisionInfo Parse(string? slug) =>
        TryParse(slug, out var info)
            ? info
            : throw new ArgumentException($"División de peso no reconocida: '{slug}'.", nameof(slug));
}
