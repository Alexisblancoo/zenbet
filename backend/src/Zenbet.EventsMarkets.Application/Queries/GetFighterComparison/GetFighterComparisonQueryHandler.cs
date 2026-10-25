namespace Zenbet.EventsMarkets.Application.Queries.GetFighterComparison;

using MediatR;
using Zenbet.EventsMarkets.Application.DTOs;
using Zenbet.EventsMarkets.Application.Queries.GetEvents;
using Zenbet.EventsMarkets.Domain.Repositories;
using Zenbet.EventsMarkets.Domain.ValueObjects;

public sealed class GetFighterComparisonQueryHandler
    : IRequestHandler<GetFighterComparisonQuery, FighterComparisonDto?>
{
    private readonly IEventRepository _eventRepository;

    public GetFighterComparisonQueryHandler(IEventRepository eventRepository)
    {
        _eventRepository = eventRepository;
    }

    public async Task<FighterComparisonDto?> Handle(
        GetFighterComparisonQuery request,
        CancellationToken cancellationToken)
    {
        var @event = await _eventRepository.GetByIdWithDetailsAsync(
            EventId.From(request.EventId),
            cancellationToken);

        return @event is null ? null : EventReadMapper.ToFighterComparisonDto(@event, DateTimeOffset.UtcNow);
    }
}
