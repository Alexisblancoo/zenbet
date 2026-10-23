using MediatR;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Zenbet.EventsMarkets.Application.DTOs;
using Zenbet.EventsMarkets.Application.Queries.GetFighterComparison;

namespace Zenbet.EventsMarkets.Api.Endpoints;

public static class FightersEndpoints
{
    public static void MapFightersEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/fighters")
            .WithTags("Fighters");

        group.MapGet("/compare", async (
            Guid? eventId,
            IMediator mediator,
            CancellationToken cancellationToken) =>
        {
            if (eventId is null || eventId == Guid.Empty)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["eventId"] = ["El evento es obligatorio para comparar las dos esquinas."]
                });
            }

            var result = await mediator.Send(
                new GetFighterComparisonQuery(eventId.Value),
                cancellationToken);

            return result is null ? Results.NotFound() : Results.Ok(result);
        })
        .WithName("CompareFighters")
        .Produces<FighterComparisonDto>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status429TooManyRequests);
    }
}
