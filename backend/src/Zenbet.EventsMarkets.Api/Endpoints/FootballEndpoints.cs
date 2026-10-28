namespace Zenbet.EventsMarkets.Api.Endpoints;

using MediatR;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Zenbet.EventsMarkets.Application.DTOs;
using Zenbet.EventsMarkets.Application.Queries.GetFootball;
using Zenbet.EventsMarkets.Domain.Repositories;

public static class FootballEndpoints
{
    public static void MapFootballEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/football")
            .WithTags("Football");

        group.MapGet("/matches", async (
            string? status,
            string? league,
            string? competition,
            string? search,
            IMediator mediator,
            CancellationToken cancellationToken) =>
        {
            var targetLeague = league ?? competition;
            var matches = await mediator.Send(
                new GetFootballMatchesQuery(status, targetLeague, search),
                cancellationToken);

            return Results.Ok(new FootballMatchesResponseDto(matches, matches.Count));
        })
        .WithName("GetFootballMatchesList")
        .Produces<FootballMatchesResponseDto>(StatusCodes.Status200OK);

        group.MapGet("/matches/{matchId}", async (
            string matchId,
            IFootballRepository repository,
            CancellationToken cancellationToken) =>
        {
            var match = await repository.GetMatchByIdAsync(matchId, cancellationToken);
            if (match is null)
                return Results.NotFound(new { message = $"Partido {matchId} no encontrado." });

            return Results.Ok(FootballReadMapper.ToDto(match));
        })
        .WithName("GetFootballMatchById")
        .Produces<FootballMatchDto>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status404NotFound);

        group.MapGet("/live", async (
            string? league,
            string? competition,
            IMediator mediator,
            CancellationToken cancellationToken) =>
        {
            var targetLeague = league ?? competition;
            var matches = await mediator.Send(
                new GetFootballMatchesQuery("live", targetLeague, null),
                cancellationToken);

            return Results.Ok(new FootballMatchesResponseDto(matches, matches.Count));
        })
        .WithName("GetFootballLiveMatchesList")
        .Produces<FootballMatchesResponseDto>(StatusCodes.Status200OK);

        group.MapGet("/leagues", async (
            IMediator mediator,
            CancellationToken cancellationToken) =>
        {
            var leagues = await mediator.Send(
                new GetFootballLeaguesQuery(),
                cancellationToken);

            return Results.Ok(leagues);
        })
        .WithName("GetFootballLeaguesList")
        .Produces<IReadOnlyList<FootballLeagueDto>>(StatusCodes.Status200OK);
    }
}

