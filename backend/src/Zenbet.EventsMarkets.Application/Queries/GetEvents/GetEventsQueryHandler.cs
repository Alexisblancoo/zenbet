namespace Zenbet.EventsMarkets.Application.Queries.GetEvents;

using MediatR;
using Zenbet.EventsMarkets.Application.DTOs;
using Zenbet.EventsMarkets.Domain.Enums;
using Zenbet.EventsMarkets.Domain.Repositories;

public sealed class GetEventsQueryHandler : IRequestHandler<GetEventsQuery, EventPageDto>
{
    private const int MaxPageSize = 100;
    private readonly IEventRepository _eventRepository;

    public GetEventsQueryHandler(IEventRepository eventRepository)
    {
        _eventRepository = eventRepository;
    }

    public async Task<EventPageDto> Handle(GetEventsQuery request, CancellationToken cancellationToken)
    {
        var page = Math.Max(1, request.Page);
        var pageSize = Math.Clamp(request.PageSize, 1, MaxPageSize);
        var sport = ParseSport(request.Sport);
        var status = ParseStatus(request.Status);

        var total = await _eventRepository.CountAsync(
            status,
            sport,
            request.From,
            request.To,
            request.Competition,
            cancellationToken);

        var events = await _eventRepository.ListWithDetailsAsync(
            status,
            sport,
            request.From,
            request.To,
            request.Competition,
            page,
            pageSize,
            cancellationToken);

        var items = events
            .OrderByDescending(@event => @event.StartTime)
            .ThenBy(@event => @event.Bout?.BillingOrder ?? int.MaxValue)
            .ThenBy(@event => @event.Name, StringComparer.Ordinal)
            .Select(EventReadMapper.ToDto)
            .ToList();

        return new EventPageDto(items, total, page, pageSize);
    }

    private static SportType? ParseSport(string? value)
    {
        if (string.IsNullOrWhiteSpace(value) || value.Equals("all", StringComparison.OrdinalIgnoreCase))
            return null;

        var normalized = value.Trim().ToLowerInvariant();
        if (normalized is "mma" or "ufc" or "mixedmartialarts")
            return SportType.MixedMartialArts;

        if (Enum.TryParse<SportType>(normalized, ignoreCase: true, out var sport))
            return sport;

        throw new ArgumentException($"Deporte no soportado: '{value}'.", nameof(value));
    }

    private static EventStatus? ParseStatus(string? value)
    {
        if (string.IsNullOrWhiteSpace(value) || value.Equals("all", StringComparison.OrdinalIgnoreCase))
            return null;

        if (Enum.TryParse<EventStatus>(value.Trim(), ignoreCase: true, out var status))
            return status;

        throw new ArgumentException($"Estado de evento no válido: '{value}'.", nameof(value));
    }
}
