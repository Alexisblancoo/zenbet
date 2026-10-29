namespace Zenbet.EventsMarkets.Application.Queries.GetUpcomingEvents;

using MediatR;
using Zenbet.EventsMarkets.Application.DTOs;
using Zenbet.EventsMarkets.Application.Queries.GetEvents;
using Zenbet.EventsMarkets.Domain.Enums;
using Zenbet.EventsMarkets.Domain.Repositories;

public sealed class GetUpcomingEventsQueryHandler : IRequestHandler<GetUpcomingEventsQuery, UpcomingEventsDto>
{
    private readonly IPromotionRepository _promotionRepository;
    private readonly IEventRepository _eventRepository;

    public GetUpcomingEventsQueryHandler(IPromotionRepository promotionRepository, IEventRepository eventRepository)
    {
        _promotionRepository = promotionRepository;
        _eventRepository = eventRepository;
    }

    public async Task<UpcomingEventsDto> Handle(GetUpcomingEventsQuery request, CancellationToken cancellationToken)
    {
        var now = request.Now ?? DateTimeOffset.UtcNow;
        var endOfQ4 = new DateTimeOffset(2027, 1, 1, 0, 0, 0, TimeSpan.Zero);
        if (now >= endOfQ4)
            return new UpcomingEventsDto([], []);

        var cards = await _promotionRepository.ListUpcomingEventsAsync(now, endOfQ4, cancellationToken);
        var fights = await _eventRepository.ListWithDetailsAsync(
            status: null,
            sportType: SportType.MixedMartialArts,
            fromDate: now,
            toDate: endOfQ4,
            competition: null,
            page: 1,
            pageSize: 500,
            cancellationToken);

        var fightDtos = fights
            .Where(fight => fight.IsBettingOpen(now))
            .Select(fight => EventReadMapper.ToDto(fight, now))
            .Select(fight => fight with
            {
                Markets = fight.Markets
                    .Where(market => string.Equals(market.Status, "open", StringComparison.OrdinalIgnoreCase))
                    .ToList()
            })
            .ToList();

        var events = cards.Select(card =>
        {
            var cardKey = Normalize(card.Name);
            var eventFights = fightDtos
                .Where(fight => Normalize(fight.Competition ?? string.Empty) == cardKey)
                .OrderBy(fight => fight.StartTime)
                .ThenBy(fight => fight.Name, StringComparer.Ordinal)
                .ToList();

            var promotion = card.Promotion;
            return new UpcomingFightingEventDto(
                card.Id,
                card.Name,
                card.Slug,
                card.StartTime,
                new PromotionDto(promotion.Id, promotion.Name, promotion.Slug, promotion.Tier.ToString(), promotion.CountryCode),
                eventFights);
        }).ToList();

        return new UpcomingEventsDto(events, fightDtos);
    }

    private static string Normalize(string value) =>
        string.Concat(value.Where(char.IsLetterOrDigit)).ToUpperInvariant();
}
