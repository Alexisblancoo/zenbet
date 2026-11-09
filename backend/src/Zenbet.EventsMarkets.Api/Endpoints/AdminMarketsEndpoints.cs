using System.Security.Claims;
using MediatR;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Zenbet.EventsMarkets.Api.Authentication;
using Zenbet.EventsMarkets.Application.Commands.OpenStandardMarkets;
using Zenbet.EventsMarkets.Application.Commands.PriceMarket;
using Zenbet.EventsMarkets.Application.Interfaces;
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

        // Bandeja del trader: mercados abiertos sin cuotas, con los IDs de selección que PriceMarket necesita.
        group.MapGet("/pending-pricing", async (int? take, IPendingPricingReader reader, CancellationToken cancellationToken) =>
            Results.Ok(await reader.ListAsync(take ?? 100, cancellationToken)))
        .WithName("ListMarketsPendingPricing")
        .Produces<IReadOnlyList<PendingPricingMarketView>>(StatusCodes.Status200OK);

        // Abre (sin cuotas) los mercados estándar de un combate. Idempotente: los tipos ya presentes no se tocan.
        group.MapPost("/standard/events/{eventId:guid}", async (
            Guid eventId,
            ClaimsPrincipal user,
            HttpContext httpContext,
            ILogger<AdminAudit> auditLogger,
            IMediator mediator,
            CancellationToken cancellationToken) =>
        {
            AdminAccess.LogPrivilegedAction(auditLogger, user, httpContext, "open_standard_markets", eventId);
            var result = await mediator.Send(
                new OpenStandardMarketsCommand(Zenbet.EventsMarkets.Domain.ValueObjects.EventId.From(eventId), AdminAccess.ActorLabel(user)), cancellationToken);
            return Results.Ok(result);
        })
        .WithName("OpenStandardMarkets")
        .Produces<OpenStandardMarketsResult>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status422UnprocessableEntity);

        // Lo mismo para todos los combates de MMA programados en los próximos N días (1..60, por defecto 14).
        group.MapPost("/standard/upcoming", async (
            int? days,
            ClaimsPrincipal user,
            HttpContext httpContext,
            ILogger<AdminAudit> auditLogger,
            IMediator mediator,
            CancellationToken cancellationToken) =>
        {
            AdminAccess.LogPrivilegedAction(auditLogger, user, httpContext, "open_standard_markets_upcoming", $"days={days ?? 14}");
            var result = await mediator.Send(
                new OpenStandardMarketsForUpcomingCommand(days ?? 14, AdminAccess.ActorLabel(user)), cancellationToken);
            return Results.Ok(result);
        })
        .WithName("OpenStandardMarketsForUpcoming")
        .Produces<OpenStandardMarketsForUpcomingResult>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status422UnprocessableEntity);
    }
}

public sealed record PriceMarketRequest(
    decimal MarginPercent,
    IReadOnlyList<PriceSelectionRequest> Selections,
    string? Note,
    Guid IdempotencyKey);

public sealed record PriceSelectionRequest(Guid SelectionId, decimal FairProbability);
