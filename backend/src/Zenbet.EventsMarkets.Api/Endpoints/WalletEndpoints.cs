using System.Security.Claims;
using MediatR;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Zenbet.EventsMarkets.Application.Commands.ApproveDeposit;
using Zenbet.EventsMarkets.Application.Commands.DepositFunds;
using Zenbet.EventsMarkets.Application.Commands.RejectDeposit;
using Zenbet.EventsMarkets.Application.Commands.RequestDeposit;
using Zenbet.EventsMarkets.Application.Queries.GetPendingDeposits;
using Zenbet.EventsMarkets.Application.Queries.GetWalletDashboard;
using Zenbet.EventsMarkets.Application.Queries.GetWalletTransactions;
using Zenbet.EventsMarkets.Application.Queries.ListPendingDeposits;
using Zenbet.EventsMarkets.Domain.Enums;
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

        // --------------------------------------------------------------------
        // Depósito con comprobante (flujo real): la solicitud queda PENDING y
        // administración la acredita o rechaza. El saldo no se mueve aquí.
        // --------------------------------------------------------------------
        group.MapPost("/deposito", async (
            [FromBody] RequestDepositRequest request,
            HttpRequest httpRequest,
            ClaimsPrincipal user,
            IMediator mediator,
            CancellationToken cancellationToken) =>
        {
            if (!TryReadWalletId(user, out var walletId))
            {
                return Results.Unauthorized();
            }

            var amount = request.ResolvedAmount;

            if (amount <= 0m)
            {
                return Results.Problem(
                    title: "Monto inválido",
                    detail: "El monto del depósito debe ser mayor a cero.",
                    statusCode: StatusCodes.Status422UnprocessableEntity);
            }

            if (amount > 10_000m)
            {
                return Results.Problem(
                    title: "Monto inválido",
                    detail: "El depósito máximo por solicitud es de Bs 10,000.00.",
                    statusCode: StatusCodes.Status422UnprocessableEntity);
            }

            var reference = request.ResolvedReference?.Trim() ?? string.Empty;
            if (reference.Length is < 4 or > 100)
            {
                return Results.Problem(
                    title: "Referencia inválida",
                    detail: "El número de comprobante es obligatorio (entre 4 y 100 caracteres).",
                    statusCode: StatusCodes.Status422UnprocessableEntity);
            }

            if (!TryMapDepositMethod(request.ResolvedMethod, out var method))
            {
                return Results.Problem(
                    title: "Método de depósito no soportado",
                    detail: "Usa 'qr_transfer' o 'usdt'.",
                    statusCode: StatusCodes.Status422UnprocessableEntity);
            }

            if (!TryReadIdempotencyKey(httpRequest, out var idempotencyKey))
            {
                return Results.Problem(
                    title: "Idempotency-Key requerido",
                    detail: "Falta un Idempotency-Key válido para procesar la solicitud.",
                    statusCode: StatusCodes.Status400BadRequest);
            }

            var result = await mediator.Send(
                new RequestDepositCommand(
                    WalletId.From(walletId),
                    new Money(amount),
                    method,
                    reference,
                    idempotencyKey),
                cancellationToken);

            if (!result.Success)
            {
                return Results.Problem(
                    title: "No se pudo registrar el depósito",
                    detail: result.ErrorMessage,
                    statusCode: StatusCodes.Status422UnprocessableEntity);
            }

            return Results.Ok(new
            {
                success = true,
                transactionId = result.TransactionId?.Value,
                reference = result.Reference,
                amount = result.Amount,
                method = DescribeDepositMethod(method),
                status = result.Status ?? "pending",
                createdAt = result.CreatedAt,
            });
        })
        .WithName("RequestDeposit")
        .Produces(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status422UnprocessableEntity);

        // Depósitos propios en revisión (vista del jugador).
        group.MapGet("/depositos/pendientes", async (
            ClaimsPrincipal user,
            IMediator mediator,
            CancellationToken cancellationToken) =>
        {
            if (!TryReadWalletId(user, out var walletId))
            {
                return Results.Unauthorized();
            }

            var deposits = await mediator.Send(
                new ListPendingDepositsQuery(WalletId.From(walletId)),
                cancellationToken);

            return Results.Ok(deposits);
        })
        .WithName("ListMyPendingDeposits")
        .Produces(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status401Unauthorized);

        // --------------------------------------------------------------------
        // Cola de administración: revisión y acreditación de depósitos.
        // --------------------------------------------------------------------
        static async Task<IResult> ListPendingDeposits(
            IMediator mediator,
            CancellationToken cancellationToken)
        {
            var deposits = await mediator.Send(new GetPendingDepositsQuery(), cancellationToken);
            return Results.Ok(deposits);
        }

        static async Task<IResult> ApproveDeposit(
            Guid id,
            ClaimsPrincipal user,
            IMediator mediator,
            CancellationToken cancellationToken)
        {
            var result = await mediator.Send(
                new ApproveDepositCommand(TransactionId.From(id)),
                cancellationToken);

            if (!result.Success)
            {
                var statusCode = result.Error switch
                {
                    ApproveDepositError.TransactionNotFound => StatusCodes.Status404NotFound,
                    ApproveDepositError.InvalidState => StatusCodes.Status409Conflict,
                    _ => StatusCodes.Status422UnprocessableEntity,
                };

                return Results.Problem(
                    title: "No se pudo aprobar el depósito.",
                    detail: result.ErrorMessage,
                    statusCode: statusCode);
            }

            return Results.Ok(new
            {
                success = true,
                transactionId = id,
                status = "approved",
                alreadyApproved = result.AlreadyApproved,
                newBalance = result.NewBalance,
                atRiskBalance = result.AtRiskBalance,
                approvedBy = user.Identity?.Name,
            });
        }

        static async Task<IResult> RejectDeposit(
            Guid id,
            [FromBody] RejectDepositRequest request,
            IMediator mediator,
            CancellationToken cancellationToken)
        {
            var result = await mediator.Send(
                new RejectDepositCommand(TransactionId.From(id), request.Reason),
                cancellationToken);

            if (!result.Success)
            {
                return Results.Problem(
                    title: "No se pudo rechazar el depósito.",
                    detail: result.ErrorMessage,
                    statusCode: StatusCodes.Status409Conflict);
            }

            return Results.Ok(new
            {
                success = true,
                transactionId = id,
                status = "rejected",
            });
        }

        var adminGroup = app.MapGroup("/api/v1/admin/depósitos")
            .WithTags("Wallet Admin")
            .RequireAuthorization(policy => policy.RequireRole("admin"));

        adminGroup.MapGet("/pendientes", ListPendingDeposits)
            .WithName("ListPendingDeposits")
            .Produces(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status403Forbidden);

        adminGroup.MapPost("/{id:guid}/aprobar", ApproveDeposit)
            .WithName("ApproveDeposit")
            .Produces(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status403Forbidden)
            .Produces(StatusCodes.Status404NotFound)
            .Produces(StatusCodes.Status409Conflict)
            .Produces(StatusCodes.Status422UnprocessableEntity);

        adminGroup.MapPost("/{id:guid}/rechazar", RejectDeposit)
            .WithName("RejectDeposit")
            .Produces(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status403Forbidden)
            .Produces(StatusCodes.Status409Conflict);

        // Compatibilidad con las rutas previas del panel de administración.
        var legacyAdminGroup = app.MapGroup("/api/v1/wallet/admin/depositos")
            .WithTags("Wallet Admin")
            .RequireAuthorization(policy => policy.RequireRole("admin"));

        legacyAdminGroup.MapGet("/pendientes", ListPendingDeposits)
            .WithName("ListPendingDepositsLegacy")
            .Produces(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status403Forbidden);

        legacyAdminGroup.MapPost("/{id:guid}/aprobar", ApproveDeposit)
            .WithName("ApproveDepositLegacy")
            .Produces(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status403Forbidden)
            .Produces(StatusCodes.Status404NotFound)
            .Produces(StatusCodes.Status409Conflict)
            .Produces(StatusCodes.Status422UnprocessableEntity);

        legacyAdminGroup.MapPost("/{id:guid}/rechazar", RejectDeposit)
            .WithName("RejectDepositLegacy")
            .Produces(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status403Forbidden)
            .Produces(StatusCodes.Status409Conflict);
    }

    internal static bool TryReadWalletId(ClaimsPrincipal user, out Guid walletId) =>
        Guid.TryParse(user.FindFirstValue("wallet_id"), out walletId) && walletId != Guid.Empty;

    /// <summary>Lee el Idempotency-Key (o X-Idempotency-Key) como GUID.</summary>
    internal static bool TryReadIdempotencyKey(HttpRequest httpRequest, out Guid idempotencyKey)
    {
        var header = httpRequest.Headers["X-Idempotency-Key"].ToString();
        if (string.IsNullOrWhiteSpace(header))
        {
            // Compatibilidad con clientes que usan el nombre estándar.
            header = httpRequest.Headers["Idempotency-Key"].ToString();
        }

        return Guid.TryParse(header, out idempotencyKey) && idempotencyKey != Guid.Empty;
    }

    /// <summary>
    /// Métodos del formulario de depósito: el canal BOB comparte QR y
    /// transferencia bancaria (enum Qr/Transfer) y el canal cripto viaja en USDT.
    /// </summary>
    internal static bool TryMapDepositMethod(string? raw, out PaymentMethod method)
    {
        switch ((raw ?? string.Empty).Trim().ToLowerInvariant())
        {
            case "qr_transfer" or "qr" or "transferencia" or "transfer":
                method = PaymentMethod.Qr;
                return true;
            case "usdt" or "crypto" or "cripto":
                method = PaymentMethod.Crypto;
                return true;
            default:
                method = default;
                return false;
        }
    }

    internal static string DescribeDepositMethod(PaymentMethod method) => method switch
    {
        PaymentMethod.Crypto => "usdt",
        _ => "qr_transfer",
    };
}

public sealed record DepositFundsRequest(decimal Amount, string? Method);

public sealed record RequestDepositRequest(
    decimal? Monto,
    string? Metodo,
    string? Referencia,
    decimal? Amount,
    string? Method,
    string? Reference)
{
    public decimal ResolvedAmount => Monto ?? Amount ?? 0m;

    public string? ResolvedMethod => Metodo ?? Method;

    public string? ResolvedReference => Referencia ?? Reference;
}

public sealed record RejectDepositRequest(string? Reason);
