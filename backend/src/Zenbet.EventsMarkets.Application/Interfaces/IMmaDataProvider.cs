namespace Zenbet.EventsMarkets.Application.Interfaces;

public interface IMmaDataProvider
{
    Task<IReadOnlyList<MmaEventSnapshot>> GetUpcomingEventsAsync(CancellationToken cancellationToken = default);
}

/// <summary>Provider-neutral snapshot. External IDs are mapped deterministically to persisted IDs.</summary>
public sealed record MmaEventSnapshot(
    string ExternalId,
    string PromotionSlug,
    string Name,
    string Slug,
    DateTimeOffset StartTime,
    IReadOnlyList<MmaFightSnapshot> Fights);

public sealed record MmaFightSnapshot(
    string ExternalId,
    string Name,
    DateTimeOffset StartTime,
    string Competition,
    string Division,
    int ScheduledRounds,
    bool IsTitleFight,
    string Billing,
    int BillingOrder,
    string Venue,
    string Location,
    MmaFighterSnapshot Red,
    MmaFighterSnapshot Blue,
    IReadOnlyList<MmaMarketSnapshot> Markets);

public sealed record MmaFighterSnapshot(
    string ExternalId,
    string Name,
    string CountryCode,
    string Country,
    string Record,
    string Division,
    string? Rank = null,
    string? ImageUrl = null,
    int? ReachInches = null,
    string? Stance = null,
    decimal? TakedownDefensePercent = null,
    decimal? StrikingAccuracyPercent = null);

public sealed record MmaMarketSnapshot(
    string ExternalId,
    string Name,
    string Type,
    int DisplayOrder,
    decimal? Line,
    string Provider,
    string? SourceUrl,
    DateTimeOffset ObservedAt,
    IReadOnlyList<MmaSelectionSnapshot> Selections);

public sealed record MmaSelectionSnapshot(
    string ExternalId,
    string Code,
    string Name,
    decimal DecimalOdds,
    int DisplayOrder);
