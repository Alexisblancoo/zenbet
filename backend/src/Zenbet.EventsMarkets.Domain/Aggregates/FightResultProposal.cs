namespace Zenbet.EventsMarkets.Domain.Aggregates;

using Zenbet.EventsMarkets.Domain.Enums;

public enum ProposalStatus
{
    /// <summary>Only one source reported; waiting for an independent one.</summary>
    Pending = 1,
    /// <summary>Two independent sources agree on the winner. An admin may apply it.</summary>
    Verified = 2,
    /// <summary>Sources disagree or the outcome is not one we can settle automatically. Needs a human.</summary>
    Conflict = 3,
    /// <summary>The feed reports the bout as cancelled. Never settled; an admin voids it.</summary>
    CancelledSuggested = 4,
    Applied = 5,
    Dismissed = 6,
}

/// <summary>
/// What the data feeds SUGGEST for a bout. It never settles anything by itself: only an admin confirming a
/// <see cref="ProposalStatus.Verified"/> proposal triggers the existing settlement pipeline.
/// </summary>
public sealed class FightResultProposal
{
    private FightResultProposal() { } // EF Core

    public FightResultProposal(Guid eventId, DateTimeOffset now)
    {
        if (eventId == Guid.Empty) throw new ArgumentException("Event ID cannot be empty.", nameof(eventId));
        Id = Guid.NewGuid();
        EventId = eventId;
        Status = ProposalStatus.Pending;
        Detail = "Sin datos todavía.";
        SourcesSummary = string.Empty;
        CreatedAt = now;
        UpdatedAt = now;
    }

    public Guid Id { get; private set; }
    public Guid EventId { get; private set; }
    public ProposalStatus Status { get; private set; }
    public FightCorner? WinnerCorner { get; private set; }
    public MmaVictoryMethod? Method { get; private set; }
    public int? Round { get; private set; }
    /// <summary>True when a second source also reported the method category. When false the method/round are single-source.</summary>
    public bool MethodCorroborated { get; private set; }
    public string Detail { get; private set; } = string.Empty;
    public string SourcesSummary { get; private set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public string? ReviewedBy { get; private set; }
    public DateTimeOffset? ReviewedAt { get; private set; }
    public string? ReviewNote { get; private set; }

    public bool IsTerminal => Status is ProposalStatus.Applied or ProposalStatus.Dismissed;

    /// <summary>Refreshes the suggestion from new feed data. Ignored once an admin has applied or dismissed it.</summary>
    public bool Update(ProposalStatus status, FightCorner? corner, MmaVictoryMethod? method, int? round,
        bool methodCorroborated, string detail, string sourcesSummary, DateTimeOffset now)
    {
        if (IsTerminal) return false;
        if (status is ProposalStatus.Applied or ProposalStatus.Dismissed)
            throw new ArgumentException("Applied/Dismissed are set only by an admin action.", nameof(status));
        var changed = Status != status || WinnerCorner != corner || Method != method || Round != round ||
                      MethodCorroborated != methodCorroborated || Detail != detail || SourcesSummary != sourcesSummary;
        Status = status;
        WinnerCorner = corner;
        Method = method;
        Round = round;
        MethodCorroborated = methodCorroborated;
        Detail = Truncate(detail, 1000);
        SourcesSummary = Truncate(sourcesSummary, 2000);
        if (changed) UpdatedAt = now;
        return changed;
    }

    public void MarkApplied(string admin, string? note, DateTimeOffset now)
    {
        if (Status != ProposalStatus.Verified)
            throw new InvalidOperationException("Only a verified proposal can be applied.");
        Close(ProposalStatus.Applied, admin, note, now);
    }

    public void Dismiss(string admin, string note, DateTimeOffset now)
    {
        if (IsTerminal) throw new InvalidOperationException("The proposal is already closed.");
        if (string.IsNullOrWhiteSpace(note)) throw new ArgumentException("A reason is required.", nameof(note));
        Close(ProposalStatus.Dismissed, admin, note, now);
    }

    private void Close(ProposalStatus status, string admin, string? note, DateTimeOffset now)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(admin);
        Status = status;
        ReviewedBy = admin;
        ReviewedAt = now;
        ReviewNote = Truncate(note, 500);
        UpdatedAt = now;
    }

    private static string Truncate(string? value, int max) =>
        string.IsNullOrEmpty(value) ? string.Empty : value.Length <= max ? value : value[..max];
}
