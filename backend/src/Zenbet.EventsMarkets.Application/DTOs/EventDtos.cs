namespace Zenbet.EventsMarkets.Application.DTOs;

public sealed record EventPageDto(
    IReadOnlyList<EventDto> Items,
    int Total,
    int Page,
    int PageSize);

public sealed record EventDto(
    Guid Id,
    string Name,
    string Sport,
    string SportKey,
    string Status,
    DateTimeOffset StartTime,
    string? Competition,
    MmaBoutDto? Bout,
    IReadOnlyList<MarketDto> Markets,
    DateTimeOffset? OddsUpdatedAt);

public sealed record MmaBoutDto(
    string WeightDivision,
    string WeightDivisionLabel,
    int WeightLimitLbs,
    int ScheduledRounds,
    bool IsTitleFight,
    string Billing,
    string BillingLabel,
    int BillingOrder,
    string Venue,
    string Location,
    FighterDto Red,
    FighterDto Blue,
    string? Fighter1ImageUrl,
    string? Fighter2ImageUrl);

public sealed record FighterDto(
    string Id,
    string Name,
    string CountryCode,
    string Country,
    string Record,
    string? Rank,
    string Division,
    string DivisionLabel,
    string? ImageUrl);

public sealed record MarketDto(
    Guid Id,
    string Type,
    string TypeKey,
    string Name,
    decimal? Line,
    int DisplayOrder,
    string Status,
    string? Provider,
    DateTimeOffset? UpdatedAt,
    MarketSourceDto? Source,
    IReadOnlyList<SelectionDto> Selections);

public sealed record MarketSourceDto(
    string Kind,
    string Name,
    string? Url,
    DateTimeOffset ObservedAt,
    string? Note);

public sealed record SelectionDto(
    Guid Id,
    string? Code,
    string Name,
    decimal DecimalOdds,
    string AmericanOdds,
    int DisplayOrder,
    bool Settled,
    string? Provider,
    DateTimeOffset? UpdatedAt);
