using System.Security.Claims;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using MediatR;
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

        // Place a bet
        group.MapPost("", async (
            [FromBody] PlaceBetRequest request,
            ClaimsPrincipal user,
            IMediator mediator,
            CancellationToken cancellationToken) =>
        {
            var authenticatedWalletId = user.FindFirstValue("wallet_id");
            if (!Guid.TryParse(authenticatedWalletId, out var walletId) ||
                walletId != request.WalletId)
            {
                return Results.Problem(
                    statusCode: StatusCodes.Status403Forbidden,
                    title: "Billetera no autorizada",
                    detail: "La billetera no pertenece a tu cuenta.");
            }

            var command = new PlaceBetCommand(
                WalletId.From(request.WalletId),
                SelectionId.From(request.SelectionId),
                new Money(request.Amount),
                request.Description,
                request.IdempotencyKey);

            var result = await mediator.Send(command, cancellationToken);

            if (!result.Success)
            {
                return Results.UnprocessableEntity(new
                {
                    success = false,
                    error = result.ErrorMessage
                });
            }

            return Results.Created($"/api/v1/bets/{result.BetId}", new
            {
                success = true,
                betId = result.BetId?.Value,
                transactionId = result.TransactionId?.Value,
                newBalance = result.NewBalance?.Amount
            });
        })
        .RequireAuthorization()
        .WithName("PlaceBet")
        .Produces(StatusCodes.Status201Created)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status422UnprocessableEntity)
        .Produces(StatusCodes.Status429TooManyRequests);

        // Settle a market (admin/internal)
        group.MapPost("/settle", async (
            [FromBody] SettleMarketRequest request,
            IMediator mediator,
            CancellationToken cancellationToken) =>
        {
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
}

// Request DTOs
public sealed record PlaceBetRequest(
    Guid WalletId,
    Guid SelectionId,
    decimal Amount,
    string Description,
    Guid IdempotencyKey);

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