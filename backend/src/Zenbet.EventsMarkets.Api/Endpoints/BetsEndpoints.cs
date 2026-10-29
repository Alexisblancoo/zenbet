using System.Security.Claims;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Configuration;
using MediatR;
using FluentValidation;
using Zenbet.EventsMarkets.Application.Commands.PlaceBet;
using Zenbet.EventsMarkets.Application.Commands.SettleMarket;
using Zenbet.EventsMarkets.Application.Commands.UpdateOdds;
using Zenbet.EventsMarkets.Application.Queries.GetWalletBets;
using Zenbet.EventsMarkets.Domain.ValueObjects;
using Zenbet.EventsMarkets.Domain.Enums;

namespace Zenbet.EventsMarkets.Api.Endpoints;

public static class BetsEndpoints
{
    public static void MapBetsEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/bets")
            .WithTags("Bets")
            .RequireRateLimiting("BettingPolicy");

        // Historial de apuestas del jugador autenticado.
        group.MapGet("", async (
            ClaimsPrincipal user,
            IMediator mediator,
            CancellationToken cancellationToken) =>
        {
            if (!WalletEndpoints.TryReadWalletId(user, out var walletId))
            {
                return Results.Unauthorized();
            }

            var bets = await mediator.Send(
                new GetWalletBetsQuery(walletId),
                cancellationToken);

            return Results.Ok(bets);
        })
        .RequireAuthorization()
        .WithName("GetMyBets")
        .Produces(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status429TooManyRequests);

        group.MapPost("/place", PlaceBetAsync)
            .RequireAuthorization()
            .WithName("PlaceBet")
            .Produces<PlaceBetResponse>(StatusCodes.Status201Created)
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status401Unauthorized)
            .ProducesProblem(StatusCodes.Status403Forbidden)
            .ProducesProblem(StatusCodes.Status409Conflict)
            .ProducesProblem(StatusCodes.Status422UnprocessableEntity)
            .Produces(StatusCodes.Status429TooManyRequests);

        // Keep the original POST /api/v1/bets route as a compatibility alias.
        group.MapPost("", PlaceBetAsync)
            .RequireAuthorization()
            .WithName("PlaceBetLegacy")
            .Produces<PlaceBetResponse>(StatusCodes.Status201Created)
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status401Unauthorized)
            .ProducesProblem(StatusCodes.Status403Forbidden)
            .ProducesProblem(StatusCodes.Status409Conflict)
            .ProducesProblem(StatusCodes.Status422UnprocessableEntity)
            .Produces(StatusCodes.Status429TooManyRequests);

        // Settle a market (admin/internal)
        group.MapPost("/settle", async (
            [FromBody] SettleMarketRequest request,
            HttpRequest httpRequest,
            IConfiguration configuration,
            IMediator mediator,
            CancellationToken cancellationToken) =>
        {
            var configuredKey = configuration["Settlement:ApiKey"];
            if (string.IsNullOrWhiteSpace(configuredKey))
            {
                return Results.Problem(
                    title: "Liquidación no configurada",
                    detail: "Falta Settlement:ApiKey en la configuración del servidor.",
                    statusCode: StatusCodes.Status503ServiceUnavailable);
            }

            if (!EventsEndpoints.HasValidSettlementKey(httpRequest, configuredKey))
            {
                return Results.Problem(
                    title: "No autorizado",
                    detail: "El header X-Settlement-Key es obligatorio para liquidar un mercado.",
                    statusCode: StatusCodes.Status401Unauthorized);
            }

            var command = new SettleMarketCommand(
                MarketId.From(request.MarketId),
                SelectionId.From(request.WinnerSelectionId),
                request.Result,
                request.SettledBy,
                request.IdempotencyKey);

            var result = await mediator.Send(command, cancellationToken);

            return Results.Ok(new
            {
                marketId = result.MarketId.Value,
                winnerSelectionId = result.WinnerSelectionId.Value,
                result = result.Result.ToString(),
                settledAt = result.SettledAt
            });
        })
        .WithName("SettleMarket")
        .Produces(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status422UnprocessableEntity);

        // Update odds (internal/feed)
        group.MapPost("/odds", async (
            [FromBody] UpdateOddsRequest request,
            IMediator mediator,
            CancellationToken cancellationToken) =>
        {
            var updates = request.Updates.Select(u => new OddsUpdateItem(
                SelectionId.From(u.SelectionId),
                u.Value,
                u.Timestamp,
                u.Provider)).ToList();

            var command = new UpdateOddsCommand(updates, request.IdempotencyKey);

            var result = await mediator.Send(command, cancellationToken);

            return Results.Ok(new
            {
                processedCount = result.ProcessedCount,
                failedCount = result.FailedCount,
                failures = result.Failures.Select(f => new
                {
                    selectionId = f.SelectionId.Value,
                    error = f.Error
                })
            });
        })
        .WithName("UpdateOdds")
        .Produces(StatusCodes.Status200OK);
    }

    private static async Task<IResult> PlaceBetAsync(
        PlaceBetRequest request,
        [FromHeader(Name = "X-Idempotency-Key")] string? idempotencyKeyHeader,
        ClaimsPrincipal user,
        IMediator mediator,
        IValidator<PlaceBetRequest> validator,
        CancellationToken cancellationToken)
    {
        var validation = await validator.ValidateAsync(request, cancellationToken);
        if (!validation.IsValid)
        {
            var errors = validation.Errors
                .GroupBy(failure => failure.PropertyName)
                .ToDictionary(group => group.Key, group => group.Select(failure => failure.ErrorMessage).ToArray());
            return Results.ValidationProblem(errors);
        }

        if (!Guid.TryParse(idempotencyKeyHeader, out var idempotencyKey) ||
            idempotencyKey == Guid.Empty)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["X-Idempotency-Key"] = ["Envía una clave GUID válida en el header X-Idempotency-Key."]
            });
        }

        var authenticatedWalletId = user.FindFirstValue("wallet_id");
        if (!Guid.TryParse(authenticatedWalletId, out var walletId) || walletId != request.WalletId)
        {
            return Results.Problem(
                statusCode: StatusCodes.Status403Forbidden,
                title: "Billetera no autorizada",
                detail: "La billetera no pertenece a tu cuenta.");
        }

        var result = await mediator.Send(
            new PlaceBetCommand(
                WalletId.From(request.WalletId),
                SelectionId.From(request.SelectionId),
                new Money(request.Amount),
                request.Description!,
                idempotencyKey,
                request.PromoCode),
            cancellationToken);

        if (!result.Success)
        {
            return Results.Problem(
                statusCode: StatusCodes.Status422UnprocessableEntity,
                title: "No se pudo realizar la apuesta",
                detail: result.ErrorMessage);
        }

        return Results.Created($"/api/v1/bets/{result.BetId}", new PlaceBetResponse(
            true,
            result.BetId?.Value,
            result.TransactionId?.Value,
            result.NewBalance?.Amount,
            result.IdempotentReplay));
    }
}

// Request DTOs
public sealed record PlaceBetRequest(
    Guid WalletId,
    Guid SelectionId,
    decimal Amount,
    string Description,
    string? PromoCode = null);

public sealed record PlaceBetResponse(
    bool Success,
    Guid? BetId,
    Guid? TransactionId,
    decimal? NewBalance,
    bool IdempotentReplay);

public sealed record SettleMarketRequest(
    Guid MarketId,
    Guid WinnerSelectionId,
    SettlementResult Result,
    string SettledBy,
    Guid IdempotencyKey);

public sealed record UpdateOddsRequest(
    IReadOnlyList<OddsUpdateRequest> Updates,
    Guid IdempotencyKey);

public sealed record OddsUpdateRequest(
    Guid SelectionId,
    decimal Value,
    DateTimeOffset Timestamp,
    string Provider);
