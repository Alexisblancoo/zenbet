namespace Zenbet.EventsMarkets.Domain.Aggregates;

public sealed class FightingEvent
{
    private FightingEvent() { } // EF Core

    public FightingEvent(Guid id, string name, string slug, DateTimeOffset startTime, Guid promotionId)
    {
        if (id == Guid.Empty)
            throw new ArgumentException("Event ID cannot be empty.", nameof(id));
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        ArgumentException.ThrowIfNullOrWhiteSpace(slug);
        if (promotionId == Guid.Empty)
            throw new ArgumentException("Promotion ID cannot be empty.", nameof(promotionId));

        Id = id;
        Name = name.Trim();
        Slug = slug.Trim().ToLowerInvariant();
        StartTime = startTime;
        PromotionId = promotionId;
    }

    public Guid Id { get; private set; }
    public string Name { get; private set; } = null!;
    public string Slug { get; private set; } = null!;
    public DateTimeOffset StartTime { get; private set; }
    public Guid PromotionId { get; private set; }
    public Promotion Promotion { get; private set; } = null!;

    public bool Synchronize(string name, string slug, DateTimeOffset startTime)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        ArgumentException.ThrowIfNullOrWhiteSpace(slug);
        var normalizedSlug = slug.Trim().ToLowerInvariant();
        var changed = !string.Equals(Name, name.Trim(), StringComparison.Ordinal) ||
            !string.Equals(Slug, normalizedSlug, StringComparison.Ordinal) ||
            StartTime != startTime;
        Name = name.Trim();
        Slug = normalizedSlug;
        StartTime = startTime;
        return changed;
    }
}
