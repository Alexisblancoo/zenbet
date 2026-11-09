using System.Security.Claims;
using MediatR;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Zenbet.EventsMarkets.Api.Authentication;
using Zenbet.EventsMarkets.Application.Commands.PriceMarket;
using Zenbet.EventsMarkets.Domain.Pricing;
using Zenbet.EventsMarkets.Domain.ValueObjects;

namespace Zenbet.EventsMarkets.Api.Endpoints;

/// <summary>
/// Trading propio: el operador fija las cuotas de un mercado dando probabilidades justas y un margen. Solo admin.
/// </summary>
public static class AdminMarketsEndpoints
{
    public static void MapAdminMarketsEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/admin/markets")
            .WithTags("Admin")
            .RequireAuthorization(AdminAccess.PolicyName)
            .RequireRateLimiting("BettingPolicy");

        group.MapPost("/{marketId:guid}/pricing", async (
            Guid marketId,
            [FromBody] PriceMarketRequest request,
            ClaimsPrincipal user,
            HttpContext httpContext,
            ILogger<AdminAudit> auditLogger,
            IMediator mediator,
            CancellationToken cancellationToken) =>
        {
            if (request.Selections is null || request.Selections.Count == 0 || request.IdempotencyKey == Guid.Empty)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["request"] = ["Envía selections (todas las del mercado) y un idempotencyKey GUID."],
                });
            }

            AdminAccess.LogPrivilegedAction(auditLogger, user, httpContext, "price_market", marketId);

            var command = new PriceMarketCommand(
                MarketId.From(marketId),
                request.MarginPercent,
                request.Selections
                    .Select(s => new SelectionProbability(SelectionId.From(s.SelectionId), s.FairProbability))
                    .ToList(),
                AdminAccess.ActorLabel(user),
                request.Note,
                request.IdempotencyKey);

            var result = await mediator.Send(command, cancellationToken);

            return Results.Ok(new
            {
                marketId = result.MarketId.Value,
                overroundPercent = result.OverroundPercent,
                idempotentReplay = result.IdempotentReplay,
                selections = result.Selections.Select(s => new
                {
                    selectionId = s.SelectionId.Value,
                    fairProbability = s.FairProbability,
                    decimalOdds = s.DecimalOdds,
                }),
            });
        })
        .WithName("PriceMarket")
        .Produces(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status422UnprocessableEntity);
    }
}

public sealed record PriceMarketRequest(
    decimal MarginPercent,
    IReadOnlyList<PriceSelectionRequest> Selections,
    string? Note,
    Guid IdempotencyKey);

public sealed record PriceSelectionRequest(Guid SelectionId, decimal FairProbability);
