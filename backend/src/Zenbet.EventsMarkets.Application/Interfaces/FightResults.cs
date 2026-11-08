namespace Zenbet.EventsMarkets.Application.Interfaces;

using System.Globalization;
using System.Text;

public enum FightOutcomeStatus
{
    Unknown = 0,
    Scheduled = 1,
    Completed = 2,
    Cancelled = 3,
}

/// <summary>
/// Provider-neutral fight outcome. A snapshot only ever PROPOSES a result: settlement must be confirmed by an admin against a
/// second official source and never executed from a single feed.
/// </summary>
public sealed record FightResultSnapshot(
    string Provider,
    string ExternalEventId,
    string ExternalFightId,
    string FighterAName,
    string FighterBName,
    string? WinnerName,
    FightOutcomeStatus Status,
    string? Method,
    string? MethodNormalized,
    int? Round,
    int? TimeSeconds,
    DateTimeOffset EventStart);

public interface IFightResultsProvider
{
    /// <summary>Fight statuses and (when finished) results of one event, identified by the provider's event slug.</summary>
    Task<IReadOnlyList<FightResultSnapshot>> GetEventResultsAsync(string eventSlug, CancellationToken cancellationToken = default);
}

/// <summary>Pairs the same bout across providers: accent-insensitive names, order-insensitive, start within a tolerance.</summary>
public static class FightMatcher
{
    public static readonly TimeSpan DefaultTolerance = TimeSpan.FromHours(12);

    public static string NormalizeName(string? name)
    {
        if (string.IsNullOrWhiteSpace(name)) return string.Empty;
        var decomposed = name.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(decomposed.Length);
        var lastWasSpace = true;
        foreach (var ch in decomposed)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(ch) == UnicodeCategory.NonSpacingMark) continue;
            if (char.IsLetter(ch))
            {
                sb.Append(char.ToLowerInvariant(ch));
                lastWasSpace = false;
            }
            else if (!lastWasSpace)
            {
                sb.Append(' ');
                lastWasSpace = true;
            }
        }
        return sb.ToString().Trim();
    }

    /// <summary>Order-insensitive key for a pair of fighters.</summary>
    public static string PairKey(string fighterA, string fighterB)
    {
        var a = NormalizeName(fighterA);
        var b = NormalizeName(fighterB);
        return string.CompareOrdinal(a, b) <= 0 ? $"{a}|{b}" : $"{b}|{a}";
    }

    public static bool IsSameBout(string aName1, string bName1, DateTimeOffset start1,
        string aName2, string bName2, DateTimeOffset start2, TimeSpan? tolerance = null)
    {
        var limit = tolerance ?? DefaultTolerance;
        if ((start1 - start2).Duration() > limit) return false;
        return PairKey(aName1, bName1) == PairKey(aName2, bName2);
    }

    /// <summary>Finds the candidate matching the bout, or null. Returns null when more than one candidate matches (ambiguous).</summary>
    public static FightResultSnapshot? Find(IEnumerable<FightResultSnapshot> candidates, string fighterA, string fighterB,
        DateTimeOffset start, TimeSpan? tolerance = null)
    {
        var hits = candidates
            .Where(c => IsSameBout(fighterA, fighterB, start, c.FighterAName, c.FighterBName, c.EventStart, tolerance))
            .Take(2)
            .ToList();
        return hits.Count == 1 ? hits[0] : null;
    }
}
