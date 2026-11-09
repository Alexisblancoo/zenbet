namespace Zenbet.EventsMarkets.Application.Interfaces;

using Zenbet.EventsMarkets.Domain.Aggregates;
using Zenbet.EventsMarkets.Domain.Enums;

/// <summary>Everything one provider listed around the bout date (null = the provider could not be queried).</summary>
public sealed record ProviderObservation(string Provider, IReadOnlyList<FightResultSnapshot>? Candidates);

public sealed record ResultReconciliation(
    ProposalStatus Status,
    FightCorner? WinnerCorner,
    MmaVictoryMethod? Method,
    int? Round,
    bool MethodCorroborated,
    string Detail,
    string SourcesSummary);

/// <summary>
/// Pure decision rule: the FIRST observation is the primary feed; the rest are independent second sources.
/// A result is Verified only when the primary and at least one other source agree on the winner, and no source
/// contradicts the winner or the method. The method/round come from the primary feed and are flagged when no
/// other source corroborates them. Nothing here settles; it only classifies.
/// </summary>
public static class ResultReconciler
{
    /// <summary>Generous on purpose: providers publish the card start, prelims start or main-card start.</summary>
    public static readonly TimeSpan MatchTolerance = TimeSpan.FromHours(24);

    public static ResultReconciliation Reconcile(string redName, string blueName, DateTimeOffset start,
        int scheduledRounds, IReadOnlyList<ProviderObservation> observations)
    {
        var matched = observations
            .Select(o => (o.Provider, Snap: o.Candidates is null ? null : FightMatcher.Find(o.Candidates, redName, blueName, start, MatchTolerance)))
            .ToList();
        var summary = string.Join("; ", matched.Select(m => m.Snap is null
            ? $"{m.Provider}: sin datos"
            : $"{m.Provider}: {m.Snap.Status}{(m.Snap.WinnerName is null ? "" : $", gana {m.Snap.WinnerName}")}{(m.Snap.MethodNormalized is null ? "" : $", {m.Snap.MethodNormalized}")}"));

        if (matched.Count == 0 || matched[0].Snap is not { } primary)
            return Make(ProposalStatus.Pending, null, null, null, false, "El proveedor principal no lista este combate.", summary);

        if (primary.Status == FightOutcomeStatus.Cancelled)
        {
            var others = matched.Skip(1).Where(m => m.Snap is { Status: FightOutcomeStatus.Cancelled }).Select(m => m.Provider).ToList();
            return Make(ProposalStatus.CancelledSuggested, null, null, null, others.Count > 0,
                others.Count > 0 ? "Cancelado según el proveedor principal y otro más." : "Cancelado según el proveedor principal; falta confirmarlo.", summary);
        }

        if (primary.Status != FightOutcomeStatus.Completed)
            return Make(ProposalStatus.Pending, null, null, null, false, "El combate aún no figura como finalizado.", summary);

        var corner = CornerOf(primary.WinnerName, redName, blueName);
        if (corner is null)
            return Make(ProposalStatus.Conflict, null, null, null, false, "El ganador informado no coincide con ninguno de los dos peleadores (¿empate o sin decisión?). Requiere revisión manual.", summary);

        var method = MapMethod(primary.MethodNormalized ?? primary.Method);
        if (method is null)
            return Make(ProposalStatus.Conflict, corner, null, null, false, "Método no liquidable automáticamente (empate, descalificación o sin resultado). Requiere revisión manual.", summary);

        var agreeing = new List<string>();
        var corroborated = false;
        foreach (var (provider, snap) in matched.Skip(1))
        {
            if (snap is null || snap.Status != FightOutcomeStatus.Completed) continue;
            if (snap.WinnerName is not null)
            {
                var other = CornerOf(snap.WinnerName, redName, blueName);
                if (other != corner)
                    return Make(ProposalStatus.Conflict, corner, method, null, false, $"Las fuentes discrepan en el ganador ({provider}).", summary);
                agreeing.Add(provider);
            }
            var otherMethod = MapMethod(snap.MethodNormalized ?? snap.Method);
            if (otherMethod is not null)
            {
                if (otherMethod != method)
                    return Make(ProposalStatus.Conflict, corner, method, null, false, $"Las fuentes discrepan en el método ({provider}).", summary);
                corroborated = true;
            }
        }

        var round = primary.Round ?? (method == MmaVictoryMethod.Decision ? scheduledRounds : null);
        if (round is null or < 1)
            return Make(ProposalStatus.Conflict, corner, method, null, false, "El round no está informado. Requiere revisión manual.", summary);

        // The settlement rules need the result to fit the bout we sell. A mismatch means our schedule (or the feed) is wrong.
        if (round > scheduledRounds)
            return Make(ProposalStatus.Conflict, corner, method, round, false,
                $"El round del resultado ({round}) supera los rounds programados de nuestro combate ({scheduledRounds}). Revisa la programación.", summary);
        if (method == MmaVictoryMethod.Decision && round != scheduledRounds)
            return Make(ProposalStatus.Conflict, corner, method, round, false,
                $"Decisión en el round {round} pero nuestro combate está programado a {scheduledRounds} rounds. Revisa la programación.", summary);

        return agreeing.Count == 0
            ? Make(ProposalStatus.Pending, corner, method, round, false, "Falta una segunda fuente independiente que confirme el ganador.", summary)
            : Make(ProposalStatus.Verified, corner, method, round, corroborated,
                corroborated ? "Ganador y método confirmados por más de una fuente." : "Ganador confirmado por más de una fuente; método y round de una sola fuente.", summary);
    }

    public static FightCorner? CornerOf(string? winnerName, string redName, string blueName)
    {
        var w = FightMatcher.NormalizeName(winnerName);
        if (w.Length == 0) return null;
        var isRed = w == FightMatcher.NormalizeName(redName);
        var isBlue = w == FightMatcher.NormalizeName(blueName);
        return isRed == isBlue ? null : isRed ? FightCorner.Red : FightCorner.Blue;
    }

    public static MmaVictoryMethod? MapMethod(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var m = raw.ToLowerInvariant();
        if (m.Contains("draw") || m.Contains("no_contest") || m.Contains("no contest") || m.Contains("dq") || m.Contains("disqual")) return null;
        if (m.Contains("decision")) return MmaVictoryMethod.Decision;
        if (m.Contains("submission")) return MmaVictoryMethod.Submission;
        if (m.Contains("ko") || m.Contains("tko") || m.Contains("knockout")) return MmaVictoryMethod.Knockout;
        return null;
    }

    private static ResultReconciliation Make(ProposalStatus status, FightCorner? corner, MmaVictoryMethod? method, int? round,
        bool corroborated, string detail, string summary) => new(status, corner, method, round, corroborated, detail, summary);
}
