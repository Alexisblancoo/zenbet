namespace Zenbet.EventsMarkets.Application.Queries.GetEvents;

using MediatR;
using Zenbet.EventsMarkets.Application.DTOs;

public sealed record GetEventsQuery(
    string? Sport = null,
    string? Status = null,
    DateTimeOffset? From = null,
    DateTimeOffset? To = null,
    string? Competition = null,
    int Page = 1,
    int PageSize = 50) : IRequest<EventPageDto>;
