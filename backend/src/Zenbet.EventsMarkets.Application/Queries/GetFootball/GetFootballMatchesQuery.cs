namespace Zenbet.EventsMarkets.Application.Queries.GetFootball;

using MediatR;
using Zenbet.EventsMarkets.Application.DTOs;
using Zenbet.EventsMarkets.Domain.Repositories;

public record GetFootballMatchesQuery(
    string? Status,
    string? LeagueId,
    string? Search
) : IRequest<IReadOnlyList<FootballMatchDto>>;

public sealed class GetFootballMatchesQueryHandler : IRequestHandler<GetFootballMatchesQuery, IReadOnlyList<FootballMatchDto>>
{
    private readonly IFootballRepository _repository;

    public GetFootballMatchesQueryHandler(IFootballRepository repository)
    {
        _repository = repository;
    }

    public async Task<IReadOnlyList<FootballMatchDto>> Handle(
        GetFootballMatchesQuery request,
        CancellationToken cancellationToken)
    {
        var matches = await _repository.ListMatchesAsync(
            request.Status,
            request.LeagueId,
            request.Search,
            cancellationToken);

        return matches.Select(FootballReadMapper.ToDto).ToList();
    }
}

