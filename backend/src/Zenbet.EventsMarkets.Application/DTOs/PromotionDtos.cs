namespace Zenbet.EventsMarkets.Application.DTOs;

public sealed record PromotionDto(
    Guid Id,
    string Name,
    string Slug,
    string Tier,
    string CountryCode);

public sealed record UpcomingFightingEventDto(
    Guid Id,
    string Name,
    string Slug,
    DateTimeOffset StartTime,
    PromotionDto Promotion,
    IReadOnlyList<EventDto> Fights);

public sealed record UpcomingEventsDto(
    IReadOnlyList<UpcomingFightingEventDto> Events,
    IReadOnlyList<EventDto> Fights);
