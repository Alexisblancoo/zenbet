namespace Zenbet.EventsMarkets.Api.Endpoints;

using MediatR;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Zenbet.EventsMarkets.Application.DTOs;
using Zenbet.EventsMarkets.Application.Queries.GetUpcomingEvents;

public static class UpcomingEventsEndpoints
{
    public static void MapUpcomingEventsEndpoint(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/v1/events/upcoming", async (
                IMediator mediator,
                CancellationToken cancellationToken) =>
            {
                var result = await mediator.Send(new GetUpcomingEventsQuery(), cancellationToken);
                return Results.Ok(result);
            })
            .WithTags("Events")
            .WithName("GetUpcomingEvents")
            .Produces<UpcomingEventsDto>(StatusCodes.Status200OK);
    }
}
