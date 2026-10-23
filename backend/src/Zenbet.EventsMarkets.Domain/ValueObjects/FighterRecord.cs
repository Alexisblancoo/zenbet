namespace Zenbet.EventsMarkets.Domain.ValueObjects;

/// <summary>
/// Desglose de un récord de MMA en el formato editorial W-L-D. El seed guarda
/// el récord como texto; este value object lo interpreta sin inventar cifras:
/// si el formato no es reconocible devuelve un récord vacío.
/// </summary>
public readonly record struct FighterRecord(int Wins, int Losses, int Draws)
{
    public int TotalFights => Wins + Losses + Draws;

    /// <summary>Porcentaje de victorias sobre el total de combates (0-100).</summary>
    public decimal WinRate =>
        TotalFights == 0
            ? 0m
            : Math.Round(Wins * 100m / TotalFights, 1, MidpointRounding.AwayFromZero);

    public static FighterRecord Parse(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return default;

        var parts = value.Trim().Split('-', StringSplitOptions.TrimEntries);
        if (parts.Length is < 2 or > 3)
            return default;

        if (!int.TryParse(parts[0], out var wins) || wins < 0 ||
            !int.TryParse(parts[1], out var losses) || losses < 0)
        {
            return default;
        }

        var draws = 0;
        if (parts.Length == 3 && (!int.TryParse(parts[2], out draws) || draws < 0))
            return default;

        return new FighterRecord(wins, losses, draws);
    }

    public override string ToString() => $"{Wins}-{Losses}-{Draws}";
}
