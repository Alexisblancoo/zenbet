using System.Security.Claims;
using MediatR;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Zenbet.EventsMarkets.Api.Authentication;
using Zenbet.EventsMarkets.Application.Commands.ResultProposals;
using Zenbet.EventsMarkets.Application.Commands.SettleUfcEvent;
using Zenbet.EventsMarkets.Application.Interfaces;
using Zenbet.EventsMarkets.Domain.Aggregates;
using Zenbet.EventsMarkets.Domain.Exceptions;

namespace Zenbet.EventsMarkets.Api.Endpoints;

/// <summary>
/// Result suggestions. The data feeds only PROPOSE; settlement happens when an admin confirms a verified proposal
/// (identity from the token, audited), through the same pipeline as a manual settlement.
/// </summary>
public static class AdminResultProposalsEndpoints
{
    public static void MapAdminResultProposalsEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/admin/result-proposals")
            .WithTags("Admin results")
            .RequireAuthorization(AdminAccess.PolicyName);

        group.MapGet("", async (string? status, int? take, IFightResultProposalRepository repository, CancellationToken ct) =>
        {
            ProposalStatus? filter = null;
            if (!string.IsNullOrWhiteSpace(status))
            {
                if (!Enum.TryParse<ProposalStatus>(status, ignoreCase: true, out var parsed) || !Enum.IsDefined(parsed))
                    return Results.ValidationProblem(new Dictionary<string, string[]> { ["status"] = ["Estado desconocido."] });
                filter = parsed;
            }
            return Results.Ok(await repository.ListAsync(filter, take ?? 50, ct));
        })
        .WithName("ListResultProposals")
        .Produces<IReadOnlyList<ResultProposalView>>(StatusCodes.Status200OK);

        group.MapPost("/{id:guid}/confirm", async (
            Guid id,
            ConfirmProposalRequest? request,
            ClaimsPrincipal user,
            HttpContext httpContext,
            ILogger<AdminAudit> auditLogger,
            IMediator mediator,
            CancellationToken ct) =>
        {
            AdminAccess.LogPrivilegedAction(auditLogger, user, httpContext, "confirm_result_proposal", id);
            try
            {
                var result = await mediator.Send(new ConfirmResultProposalCommand(
                    id, AdminAccess.ActorLabel(user), request?.AcknowledgeSingleSourceMethod ?? false, request?.Note), ct);
                return Results.Ok(result);
            }
            catch (KeyNotFoundException) { return Results.NotFound(); }
            catch (EventNotFoundException) { return Results.NotFound(); }
            catch (InvalidOperationException ex)
            {
                return Results.Problem(title: "No se pudo aplicar la propuesta", detail: ex.Message, statusCode: StatusCodes.Status422UnprocessableEntity);
            }
            catch (ArgumentException ex)
            {
                return Results.Problem(title: "Resultado inválido", detail: ex.Message, statusCode: StatusCodes.Status422UnprocessableEntity);
            }
        })
        .WithName("ConfirmResultProposal")
        .RequireRateLimiting("BettingPolicy")
        .Produces<SettleUfcEventResult>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status422UnprocessableEntity);

        group.MapPost("/{id:guid}/dismiss", async (
            Guid id,
            DismissProposalRequest? request,
            ClaimsPrincipal user,
            HttpContext httpContext,
            ILogger<AdminAudit> auditLogger,
            IMediator mediator,
            CancellationToken ct) =>
        {
            AdminAccess.LogPrivilegedAction(auditLogger, user, httpContext, "dismiss_result_proposal", id);
            try
            {
                await mediator.Send(new DismissResultProposalCommand(id, AdminAccess.ActorLabel(user), request?.Note ?? string.Empty), ct);
                return Results.NoContent();
            }
            catch (KeyNotFoundException) { return Results.NotFound(); }
            catch (Exception ex) when (ex is InvalidOperationException or ArgumentException)
            {
                return Results.Problem(title: "No se pudo descartar la propuesta", detail: ex.Message, statusCode: StatusCodes.Status422UnprocessableEntity);
            }
        })
        .WithName("DismissResultProposal")
        .Produces(StatusCodes.Status204NoContent)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status422UnprocessableEntity);
    }
}

public sealed record ConfirmProposalRequest(bool AcknowledgeSingleSourceMethod = false, string? Note = null);

public sealed record DismissProposalRequest(string? Note = null);
