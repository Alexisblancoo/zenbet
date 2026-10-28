namespace Zenbet.EventsMarkets.Domain.Repositories;

using Zenbet.EventsMarkets.Domain.Football;

public interface IFootballRepository
{
    Task<IReadOnlyList<FootballMatch>> ListMatchesAsync(
        string? status = null,
        string? leagueId = null,
        string? search = null,
        CancellationToken cancellationToken = default);

    Task<FootballMatch?> GetMatchByIdAsync(
        string matchId,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<FootballLeague>> ListLeaguesAsync(
        CancellationToken cancellationToken = default);

    Task<bool> HasAnyMatchesAsync(
        CancellationToken cancellationToken = default);

    Task AddMatchesAsync(
        IEnumerable<FootballMatch> matches,
        CancellationToken cancellationToken = default);

    Task AddLeaguesAsync(
        IEnumerable<FootballLeague> leagues,
        CancellationToken cancellationToken = default);

    Task AddTeamsAsync(
        IEnumerable<FootballTeam> teams,
        CancellationToken cancellationToken = default);

    Task UpdateMatchScoreAndClockAsync(
        string matchId,
        int homeScore,
        int awayScore,
        int minute,
        string period,
        bool isRunning,
        CancellationToken cancellationToken = default);
}

