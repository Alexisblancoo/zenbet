using System.Security.Claims;
using MediatR;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Zenbet.EventsMarkets.Application.Commands.DepositFunds;
using Zenbet.EventsMarkets.Application.Queries.GetWalletDashboard;
using Zenbet.EventsMarkets.Application.Queries.GetWalletTransactions;
using Zenbet.EventsMarkets.Domain.ValueObjects;

namespace Zenbet.EventsMarkets.Api.Endpoints;

/// <summary>
/// Consultas y recargas de la billetera del jugador autenticado. El wallet id
/// viaja en el token firmado; nunca se acepta desde query string ni desde el body.
/// </summary>
public static class WalletEndpoints
{
    public static void MapWalletEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/wallet")
            .WithTags("Wallet")
            .RequireAuthorization();

        group.MapGet("", async (
            ClaimsPrincipal user,
            IMediator mediator,
            CancellationToken cancellationToken) =>
        {
            if (!TryReadWalletId(user, out var walletId))
            {
                return Results.Unauthorized();
            }

            var dashboard = await mediator.Send(
                new GetWalletDashboardQuery(walletId),
                cancellationToken);

            return dashboard is null
                ? Results.NotFound(new
                {
                    success = false,
                    error = "La billetera de tu sesión no está disponible.",
                })
                : Results.Ok(dashboard);
        })
        .WithName("GetWalletDashboard")
        .Produces(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status404NotFound);

        group.MapGet("/transactions", async (
            ClaimsPrincipal user,
            IMediator mediator,
            CancellationToken cancellationToken) =>
        {
            if (!TryReadWalletId(user, out var walletId))
            {
                return Results.Unauthorized();
            }

            var transactions = await mediator.Send(
                new GetWalletTransactionsQuery(walletId),
                cancellationToken);

            return Results.Ok(transactions);
        })
        .WithName("GetWalletTransactions")
        .Produces(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status401Unauthorized);

        group.MapPost("/deposit", async (
            [FromBody] DepositFundsRequest request,
            HttpRequest httpRequest,
            ClaimsPrincipal user,
            IMediator mediator,
            CancellationToken cancellationToken) =>
        {
            if (!TryReadWalletId(user, out var walletId))
            {
                return Results.Unauthorized();
            }

            if (request.Amount <= 0m)
            {
                return Results.UnprocessableEntity(new
                {
                    success = false,
                    error = "El monto de la recarga debe ser mayor a cero.",
                });
            }

            if (request.Amount > 10_000m)
            {
                return Results.UnprocessableEntity(new
                {
                    success = false,
                    error = "La recarga máxima por movimiento es de $10,000.00.",
                });
            }

            var idempotencyHeader = httpRequest.Headers["X-Idempotency-Key"].ToString();
            if (string.IsNullOrWhiteSpace(idempotencyHeader))
            {
                // Compatibilidad con clientes que usan el nombre estándar.
                idempotencyHeader = httpRequest.Headers["Idempotency-Key"].ToString();
            }

            if (!Guid.TryParse(idempotencyHeader, out var idempotencyKey))
            {
                return Results.BadRequest(new
                {
                    success = false,
                    error = "Falta un Idempotency-Key válido para procesar la recarga.",
                });
            }

            var paymentMethod = string.IsNullOrWhiteSpace(request.Method)
                ? "wallet"
                : request.Method.Trim();

            var result = await mediator.Send(
                new DepositFundsCommand(
                    WalletId.From(walletId),
                    new Money(request.Amount),
                    paymentMethod,
                    idempotencyKey),
                cancellationToken);

            if (!result.Success)
            {
                return Results.UnprocessableEntity(new
                {
                    success = false,
                    error = result.ErrorMessage,
                });
            }

            return Results.Ok(new
            {
                success = true,
                transactionId = result.TransactionId?.Value,
                newBalance = result.NewBalance?.Amount,
            });
        })
        .WithName("DepositFunds")
        .Produces(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status422UnprocessableEntity);
    }

    internal static bool TryReadWalletId(ClaimsPrincipal user, out Guid walletId) =>
        Guid.TryParse(user.FindFirstValue("wallet_id"), out walletId) && walletId != Guid.Empty;
}

public sealed record DepositFundsRequest(decimal Amount, string? Method);
