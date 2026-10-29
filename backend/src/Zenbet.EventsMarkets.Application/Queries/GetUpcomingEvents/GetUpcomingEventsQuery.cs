namespace Zenbet.EventsMarkets.Application.Queries.GetUpcomingEvents;

using MediatR;
using Zenbet.EventsMarkets.Application.DTOs;

public sealed record GetUpcomingEventsQuery(DateTimeOffset? Now = null) : IRequest<UpcomingEventsDto>;
