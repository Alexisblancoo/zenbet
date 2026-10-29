namespace Zenbet.EventsMarkets.Api.Endpoints;

using MediatR;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Zenbet.EventsMarkets.Application.DTOs;
using Zenbet.EventsMarkets.Application.Queries.GetPromotions;
using Zenbet.EventsMarkets.Domain.Enums;

public static class PromotionsEndpoints
{
    public static void MapPromotionsEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/v1/promotions", async (
                PromotionTier? tier,
                IMediator mediator,
                CancellationToken cancellationToken) =>
            {
                var promotions = await mediator.Send(new GetPromotionsQuery(tier), cancellationToken);
                return Results.Ok(promotions);
            })
            .WithTags("Promotions")
            .WithName("ListPromotions")
            .Produces<IReadOnlyList<PromotionDto>>(StatusCodes.Status200OK)
            .ProducesProblem(StatusCodes.Status400BadRequest);
    }
}
