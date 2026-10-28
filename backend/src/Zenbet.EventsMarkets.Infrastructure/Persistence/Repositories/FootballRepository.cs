namespace Zenbet.EventsMarkets.Infrastructure.Persistence.Repositories;

using Microsoft.EntityFrameworkCore;
using Zenbet.EventsMarkets.Domain.Football;
using Zenbet.EventsMarkets.Domain.Repositories;

public sealed class FootballRepository : IFootballRepository
{
    private readonly EventsMarketsDbContext _dbContext;

    public FootballRepository(EventsMarketsDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<IReadOnlyList<FootballMatch>> ListMatchesAsync(
        string? status = null,
        string? leagueId = null,
        string? search = null,
        CancellationToken cancellationToken = default)
    {
        IQueryable<FootballMatch> query = _dbContext.FootballMatches
            .Include(m => m.League)
            .Include(m => m.HomeTeam)
            .Include(m => m.AwayTeam)
            .Include(m => m.Markets)
                .ThenInclude(m => m.Selections);

        if (!string.IsNullOrWhiteSpace(status) && !status.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            var normalizedStatus = status.Trim().ToLowerInvariant();
            query = query.Where(m => m.Status.ToLower() == normalizedStatus);
        }

        if (!string.IsNullOrWhiteSpace(leagueId) && !leagueId.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            var normalizedLeague = leagueId.Trim().ToLowerInvariant();
            query = query.Where(m => m.LeagueId.ToLower() == normalizedLeague);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLowerInvariant();
            query = query.Where(m =>
                (m.HomeTeam != null && m.HomeTeam.Name.ToLower().Contains(term)) ||
                (m.HomeTeam != null && m.HomeTeam.Code.ToLower().Contains(term)) ||
                (m.AwayTeam != null && m.AwayTeam.Name.ToLower().Contains(term)) ||
                (m.AwayTeam != null && m.AwayTeam.Code.ToLower().Contains(term)) ||
                (m.League != null && m.League.Name.ToLower().Contains(term)) ||
                (m.Stadium != null && m.Stadium.ToLower().Contains(term)) ||
                (m.City != null && m.City.ToLower().Contains(term)));
        }

        var matches = await query
            .OrderBy(m => m.Status == "live" ? 0 : 1)
            .ThenBy(m => m.KickoffTimeUtc)
            .ToListAsync(cancellationToken);

        return matches;
    }

    public async Task<FootballMatch?> GetMatchByIdAsync(
        string matchId,
        CancellationToken cancellationToken = default)
    {
        return await _dbContext.FootballMatches
            .Include(m => m.League)
            .Include(m => m.HomeTeam)
            .Include(m => m.AwayTeam)
            .Include(m => m.Markets)
                .ThenInclude(m => m.Selections)
            .FirstOrDefaultAsync(m => m.Id == matchId, cancellationToken);
    }

    public async Task<IReadOnlyList<FootballLeague>> ListLeaguesAsync(
        CancellationToken cancellationToken = default)
    {
        return await _dbContext.FootballLeagues
            .OrderBy(l => l.Name)
            .ToListAsync(cancellationToken);
    }

    public async Task<bool> HasAnyMatchesAsync(
        CancellationToken cancellationToken = default)
    {
        return await _dbContext.FootballMatches.AnyAsync(cancellationToken);
    }

    public async Task AddMatchesAsync(
        IEnumerable<FootballMatch> matches,
        CancellationToken cancellationToken = default)
    {
        await _dbContext.FootballMatches.AddRangeAsync(matches, cancellationToken);
        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task AddLeaguesAsync(
        IEnumerable<FootballLeague> leagues,
        CancellationToken cancellationToken = default)
    {
        await _dbContext.FootballLeagues.AddRangeAsync(leagues, cancellationToken);
        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task AddTeamsAsync(
        IEnumerable<FootballTeam> teams,
        CancellationToken cancellationToken = default)
    {
        await _dbContext.FootballTeams.AddRangeAsync(teams, cancellationToken);
        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task UpdateMatchScoreAndClockAsync(
        string matchId,
        int homeScore,
        int awayScore,
        int minute,
        string period,
        bool isRunning,
        CancellationToken cancellationToken = default)
    {
        var match = await _dbContext.FootballMatches.FirstOrDefaultAsync(m => m.Id == matchId, cancellationToken);
        if (match is null) return;

        match.HomeScore = homeScore;
        match.AwayScore = awayScore;
        match.CurrentMinute = minute;
        match.Period = period;
        match.IsRunning = isRunning;

        await _dbContext.SaveChangesAsync(cancellationToken);
    }
}

