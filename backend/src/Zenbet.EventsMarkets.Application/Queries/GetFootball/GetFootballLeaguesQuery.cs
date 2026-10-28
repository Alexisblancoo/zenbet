namespace Zenbet.EventsMarkets.Application.Queries.GetFootball;

using MediatR;
using Zenbet.EventsMarkets.Application.DTOs;
using Zenbet.EventsMarkets.Domain.Repositories;

public record GetFootballLeaguesQuery() : IRequest<IReadOnlyList<FootballLeagueDto>>;

public sealed class GetFootballLeaguesQueryHandler : IRequestHandler<GetFootballLeaguesQuery, IReadOnlyList<FootballLeagueDto>>
{
    private readonly IFootballRepository _repository;

    public GetFootballLeaguesQueryHandler(IFootballRepository repository)
    {
        _repository = repository;
    }

    public async Task<IReadOnlyList<FootballLeagueDto>> Handle(
        GetFootballLeaguesQuery request,
        CancellationToken cancellationToken)
    {
        var leagues = await _repository.ListLeaguesAsync(cancellationToken);
        return leagues.Select(FootballReadMapper.ToDto).ToList();
    }
}

