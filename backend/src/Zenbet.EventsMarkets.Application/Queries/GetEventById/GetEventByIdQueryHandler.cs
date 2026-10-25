namespace Zenbet.EventsMarkets.Application.Queries.GetEventById;

using MediatR;
using Zenbet.EventsMarkets.Application.DTOs;
using Zenbet.EventsMarkets.Application.Queries.GetEvents;
using Zenbet.EventsMarkets.Domain.Repositories;
using Zenbet.EventsMarkets.Domain.ValueObjects;

public sealed class GetEventByIdQueryHandler : IRequestHandler<GetEventByIdQuery, EventDto?>
{
    private readonly IEventRepository _eventRepository;

    public GetEventByIdQueryHandler(IEventRepository eventRepository)
    {
        _eventRepository = eventRepository;
    }

    public async Task<EventDto?> Handle(GetEventByIdQuery request, CancellationToken cancellationToken)
    {
        var @event = await _eventRepository.GetByIdWithDetailsAsync(
            EventId.From(request.EventId),
            cancellationToken);

        return @event is null ? null : EventReadMapper.ToDto(@event, DateTimeOffset.UtcNow);
    }
}
