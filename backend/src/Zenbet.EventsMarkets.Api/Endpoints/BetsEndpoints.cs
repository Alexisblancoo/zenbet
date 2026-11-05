using System.Security.Claims;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Configuration;
using MediatR;
using FluentValidation;
using Zenbet.EventsMarkets.Application.Commands.CashOut;
using Zenbet.EventsMarkets.Application.Commands.PlaceBet;
using Zenbet.EventsMarkets.Application.Commands.SettleMarket;
using Zenbet.EventsMarkets.Application.Commands.ResettleMarket;
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

        // Liquidación anticipada del boleto del jugador autenticado.
        group.MapPost("/{betId:guid}/cashout", async (
            Guid betId,
            HttpRequest httpRequest,
            ClaimsPrincipal user,
            IMediator mediator,
            CancellationToken cancellationToken) =>
        {
            if (!WalletEndpoints.TryReadWalletId(user, out var walletId))
            {
                return Results.Unauthorized();
            }

            if (betId == Guid.Empty)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["betId"] = ["El identificador de la apuesta es obligatorio."]
                });
            }

            if (!WalletEndpoints.TryReadIdempotencyKey(httpRequest, out var idempotencyKey))
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["Idempotency-Key"] = ["Envía una clave GUID válida en el header Idempotency-Key."]
                });
            }

            var result = await mediator.Send(
                new CashOutCommand(
                    WalletId.From(walletId),
                    TransactionId.From(betId),
                    idempotencyKey),
                cancellationToken);

            if (!result.Success)
            {
                var statusCode = result.ErrorCode switch
                {
                    "MARKET_SUSPENDED_BY_RISK" => StatusCodes.Status409Conflict,
                    "MARKET_NOT_OPEN" => StatusCodes.Status409Conflict,
                    "MARKET_NOT_FOUND" => StatusCodes.Status409Conflict,
                    "BET_NOT_PENDING" => StatusCodes.Status409Conflict,
                    "BET_WALLET_MISMATCH" => StatusCodes.Status403Forbidden,
                    _ => StatusCodes.Status400BadRequest,
                };

                return Results.Problem(
                    statusCode: statusCode,
                    title: statusCode == StatusCodes.Status409Conflict
                        ? "Cash Out no disponible"
                        : "Cash Out rechazado",
                    detail: result.ErrorMessage,
                    type: "https://zenbet.com/errors/cashout-rejected",
                    extensions: new Dictionary<string, object?>
                    {
                        ["code"] = result.ErrorCode,
                        ["betId"] = betId,
                        ["initialOdds"] = result.InitialOdds,
                        ["currentOdds"] = result.CurrentOdds,
                        ["retentionMargin"] = result.RetentionMargin
                    });
            }

            return Results.Ok(new CashOutResponse(
                true,
                betId,
                result.TransactionId?.Value,
                result.CashOutAmount?.Amount,
                result.NewBalance?.Amount,
                result.NewRealAvailable?.Amount,
                result.InitialOdds,
                result.CurrentOdds,
                result.RetentionMargin,
                result.IdempotentReplay));
        })
        .RequireAuthorization()
        .WithName("CashOutBet")
        .Produces<CashOutResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status409Conflict)
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

        // Resettle a market (admin/internal VAR clawback engine)
        group.MapPost("/resettle", async (
            [FromBody] ResettleMarketRequest request,
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
                    detail: "El header X-Settlement-Key es obligatorio para re-liquidar un mercado.",
                    statusCode: StatusCodes.Status401Unauthorized);
            }

            var command = new ResettleMarketCommand(
                MarketId.From(request.MarketId),
                SelectionId.From(request.NewWinnerSelectionId),
                request.NewResult,
                request.Reason,
                request.ResettledBy,
                request.IdempotencyKey);

            var result = await mediator.Send(command, cancellationToken);

            return Results.Ok(new
            {
                marketId = result.MarketId.Value,
                newWinnerSelectionId = result.NewWinnerSelectionId.Value,
                newResult = result.NewResult.ToString(),
                clawbacksExecuted = result.ClawbacksExecuted,
                betsResettled = result.BetsResettled,
                walletsInNegativeDebt = result.WalletsInNegativeDebt,
                resettledAt = result.ResettledAt
            });
        })
        .WithName("ResettleMarket")
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
                request.PromoCode,
                request.ExpectedOdds,
                request.MaxSlippagePercent,
                request.MinAcceptedOdds),
            cancellationToken);

        if (!result.Success)
        {
            if (result.ErrorCode is "ODDS_CHANGED" or "SLIPPAGE_EXCEEDED")
            {
                return Results.Problem(
                    statusCode: StatusCodes.Status422UnprocessableEntity,
                    title: "Cuota desactualizada",
                    detail: result.ErrorMessage,
                    type: "https://zenbet.com/errors/odds-changed",
                    extensions: new Dictionary<string, object?>
                    {
                        ["code"] = result.ErrorCode,
                        ["currentOdds"] = result.CurrentOdds,
                        ["expectedOdds"] = result.ExpectedOdds
                    });
            }

            if (result.ErrorCode is "EXPOSURE_LIMIT_EXCEEDED")
            {
                return Results.Problem(
                    statusCode: StatusCodes.Status422UnprocessableEntity,
                    title: "Límite de riesgo excedido",
                    detail: result.ErrorMessage,
                    type: "https://zenbet.com/errors/exposure-limit-exceeded",
                    extensions: new Dictionary<string, object?>
                    {
                        ["code"] = result.ErrorCode
                    });
            }

            if (result.ErrorCode is "USER_LIMIT_EXCEEDED")
            {
                return Results.Problem(
                    statusCode: StatusCodes.Status422UnprocessableEntity,
                    title: "Límite de usuario excedido",
                    detail: result.ErrorMessage,
                    type: "https://zenbet.com/errors/user-limit-exceeded",
                    extensions: new Dictionary<string, object?>
                    {
                        ["code"] = result.ErrorCode
                    });
            }

            return Results.Problem(
                statusCode: StatusCodes.Status422UnprocessableEntity,
                title: "No se pudo realizar la apuesta",
                detail: result.ErrorMessage,
                extensions: result.ErrorCode is not null
                    ? new Dictionary<string, object?> { ["code"] = result.ErrorCode }
                    : null);
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
    string? PromoCode = null,
    decimal? ExpectedOdds = null,
    decimal? MaxSlippagePercent = null,
    decimal? MinAcceptedOdds = null);

public sealed record PlaceBetResponse(
    bool Success,
    Guid? BetId,
    Guid? TransactionId,
    decimal? NewBalance,
    bool IdempotentReplay);

public sealed record CashOutResponse(
    bool Success,
    Guid BetId,
    Guid? TransactionId,
    decimal? CashOutAmount,
    decimal? NewBalance,
    decimal? NewRealAvailable,
    decimal? InitialOdds,
    decimal? CurrentOdds,
    decimal? RetentionMargin,
    bool IdempotentReplay);

public sealed record SettleMarketRequest(
    Guid MarketId,
    Guid WinnerSelectionId,
    SettlementResult Result,
    string SettledBy,
    Guid IdempotencyKey);

public sealed record ResettleMarketRequest(
    Guid MarketId,
    Guid NewWinnerSelectionId,
    SettlementResult NewResult,
    string Reason,
    string ResettledBy,
    Guid IdempotencyKey);

public sealed record UpdateOddsRequest(
    IReadOnlyList<OddsUpdateRequest> Updates,
    Guid IdempotencyKey);

public sealed record OddsUpdateRequest(
    Guid SelectionId,
    decimal Value,
    DateTimeOffset Timestamp,
    string Provider);
