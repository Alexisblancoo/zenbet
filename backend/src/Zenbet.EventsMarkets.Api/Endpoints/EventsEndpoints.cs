using MediatR;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Zenbet.EventsMarkets.Application.DTOs;
using Zenbet.EventsMarkets.Application.Queries.GetEventById;
using Zenbet.EventsMarkets.Application.Queries.GetEvents;

namespace Zenbet.EventsMarkets.Api.Endpoints;

public static class EventsEndpoints
{
    public static void MapEventsEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/events")
            .WithTags("Events");

        group.MapGet("", async (
            string? sport,
            string? status,
            DateTimeOffset? from,
            DateTimeOffset? to,
            string? competition,
            int? page,
            int? pageSize,
            IMediator mediator,
            CancellationToken cancellationToken) =>
        {
            var result = await mediator.Send(
                new GetEventsQuery(
                    sport,
                    status,
                    from,
                    to,
                    competition,
                    page ?? 1,
                    pageSize ?? 50),
                cancellationToken);

            return Results.Ok(result);
        })
        .WithName("GetEvents")
        .Produces<EventPageDto>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status429TooManyRequests);

        group.MapGet("/{eventId:guid}", async (
            Guid eventId,
            IMediator mediator,
            CancellationToken cancellationToken) =>
        {
            var result = await mediator.Send(new GetEventByIdQuery(eventId), cancellationToken);
            return result is null ? Results.NotFound() : Results.Ok(result);
        })
        .WithName("GetEventById")
        .Produces<EventDto>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status429TooManyRequests);
    }
}
