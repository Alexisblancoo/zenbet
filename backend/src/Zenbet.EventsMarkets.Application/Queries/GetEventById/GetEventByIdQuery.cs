namespace Zenbet.EventsMarkets.Application.Queries.GetEventById;

using MediatR;
using Zenbet.EventsMarkets.Application.DTOs;

public sealed record GetEventByIdQuery(Guid EventId) : IRequest<EventDto?>;
