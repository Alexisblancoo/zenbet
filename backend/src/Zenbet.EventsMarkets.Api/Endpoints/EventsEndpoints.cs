using System.Security.Cryptography;
using System.Text;
using MediatR;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Zenbet.EventsMarkets.Application.Commands.SettleUfcEvent;
using Zenbet.EventsMarkets.Application.Commands.SettleFight;
using Zenbet.EventsMarkets.Application.DTOs;
using Zenbet.EventsMarkets.Application.Queries.GetEventById;
using Zenbet.EventsMarkets.Application.Queries.GetEvents;
using Zenbet.EventsMarkets.Domain.Enums;
using Zenbet.EventsMarkets.Domain.Exceptions;
using Zenbet.EventsMarkets.Domain.ValueObjects;

namespace Zenbet.EventsMarkets.Api.Endpoints;

public static class EventsEndpoints
{
    public static void MapEventsEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/events")
            .WithTags("Events");

        group.MapGet("", async (
            string? sport,
            string? status,
            DateTimeOffset? from,
            DateTimeOffset? to,
            string? competition,
            int? page,
            int? pageSize,
            IMediator mediator,
            CancellationToken cancellationToken) =>
        {
            var result = await mediator.Send(
                new GetEventsQuery(
                    sport,
                    status,
                    from,
                    to,
                    competition,
                    page ?? 1,
                    pageSize ?? 50),
                cancellationToken);

            return Results.Ok(result);
        })
        .WithName("GetEvents")
        .Produces<EventPageDto>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status429TooManyRequests);

        // Alias oficial para consumo de carteleras de MMA
        app.MapGet("/api/v1/mma/events", async (
            string? status,
            DateTimeOffset? from,
            DateTimeOffset? to,
            string? competition,
            int? page,
            int? pageSize,
            IMediator mediator,
            CancellationToken cancellationToken) =>
        {
            var result = await mediator.Send(
                new GetEventsQuery(
                    "mma",
                    status,
                    from,
                    to,
                    competition,
                    page ?? 1,
                    pageSize ?? 50),
                cancellationToken);

            return Results.Ok(result);
        })
        .WithTags("Events")
        .WithName("GetMmaEvents")
        .Produces<EventPageDto>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status429TooManyRequests);

        group.MapGet("/{eventId:guid}", async (
            Guid eventId,
            IMediator mediator,
            CancellationToken cancellationToken) =>
        {
            var result = await mediator.Send(new GetEventByIdQuery(eventId), cancellationToken);
            return result is null ? Results.NotFound() : Results.Ok(result);
        })
        .WithName("GetEventById")
        .Produces<EventDto>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status429TooManyRequests);

        // Ingesta interna del resultado oficial de un combate UFC. El header
        // X-Settlement-Key evita que un jugador pueda liquidar su propia
        // apuesta; el resultado queda persistido y los mercados se liquidan de
        // forma determinista. El PayoutWorker paga después en segundo plano.
        group.MapPost("/{eventId:guid}/result", async (
            Guid eventId,
            UfcSettlementRequest request,
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

            if (!HasValidSettlementKey(httpRequest, configuredKey))
            {
                return Results.Problem(
                    title: "No autorizado",
                    detail: "El header X-Settlement-Key es obligatorio para liquidar un evento.",
                    statusCode: StatusCodes.Status401Unauthorized);
            }

            if (!TryParseCorner(request.WinnerCorner, out var winnerCorner))
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["winnerCorner"] = ["Usa 'red' o 'blue'."],
                });
            }

            if (!TryParseVictoryMethod(request.Method, out var method))
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["method"] = ["Usa 'ko', 'submission' o 'decision'."],
                });
            }

            try
            {
                var result = await mediator.Send(
                    new SettleFightCommand(
                        Zenbet.EventsMarkets.Domain.ValueObjects.EventId.From(eventId),
                        winnerCorner,
                        method,
                        request.Round,
                        string.IsNullOrWhiteSpace(request.SettledBy)
                            ? "ufc-result-feed"
                            : request.SettledBy.Trim(),
                        request.IdempotencyKey),
                    cancellationToken);

                return Results.Ok(result);
            }
            catch (EventNotFoundException)
            {
                return Results.NotFound();
            }
            catch (InvalidOperationException ex)
            {
                return Results.Problem(
                    title: "No se pudo liquidar el evento",
                    detail: ex.Message,
                    statusCode: StatusCodes.Status422UnprocessableEntity);
            }
            catch (ArgumentOutOfRangeException ex)
            {
                return Results.Problem(
                    title: "Resultado inválido",
                    detail: ex.Message,
                    statusCode: StatusCodes.Status422UnprocessableEntity);
            }
            catch (ArgumentException ex)
            {
                return Results.Problem(
                    title: "Resultado inválido",
                    detail: ex.Message,
                    statusCode: StatusCodes.Status422UnprocessableEntity);
            }
        })
        .WithName("SettleUfcEvent")
        .RequireRateLimiting("BettingPolicy")
        .Produces<SettleUfcEventResult>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status422UnprocessableEntity)
        .Produces(StatusCodes.Status429TooManyRequests);
    }

    internal static bool HasValidSettlementKey(HttpRequest request, string configuredKey)
    {
        var provided = request.Headers["X-Settlement-Key"].ToString();
        if (string.IsNullOrWhiteSpace(provided)) return false;

        var expectedBytes = Encoding.UTF8.GetBytes(configuredKey);
        var providedBytes = Encoding.UTF8.GetBytes(provided);

        return expectedBytes.Length == providedBytes.Length &&
            CryptographicOperations.FixedTimeEquals(expectedBytes, providedBytes);
    }

    private static bool TryParseCorner(string? value, out FightCorner corner)
    {
        switch (value?.Trim().ToLowerInvariant())
        {
            case "red":
                corner = FightCorner.Red;
                return true;
            case "blue":
                corner = FightCorner.Blue;
                return true;
            default:
                corner = default;
                return false;
        }
    }

    private static bool TryParseVictoryMethod(string? value, out MmaVictoryMethod method)
    {
        switch (value?.Trim().ToLowerInvariant())
        {
            case "ko":
            case "tko":
            case "knockout":
                method = MmaVictoryMethod.Knockout;
                return true;
            case "submission":
            case "sub":
                method = MmaVictoryMethod.Submission;
                return true;
            case "decision":
            case "points":
                method = MmaVictoryMethod.Decision;
                return true;
            default:
                method = default;
                return false;
        }
    }
}

public sealed record UfcSettlementRequest(
    string WinnerCorner,
    string Method,
    int Round,
    string? SettledBy = null,
    Guid? IdempotencyKey = null);
