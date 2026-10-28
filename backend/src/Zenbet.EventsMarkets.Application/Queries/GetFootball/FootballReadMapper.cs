namespace Zenbet.EventsMarkets.Application.Queries.GetFootball;

using Zenbet.EventsMarkets.Application.DTOs;
using Zenbet.EventsMarkets.Domain.Football;

public static class FootballReadMapper
{
    public static FootballMatchDto ToDto(FootballMatch match)
    {
        var isLive = match.Status.Equals("live", StringComparison.OrdinalIgnoreCase);
        var isFinished = match.Status.Equals("finished", StringComparison.OrdinalIgnoreCase);

        var homeTeamDto = match.HomeTeam is not null
            ? new FootballTeamDto(
                match.HomeTeam.Id,
                match.HomeTeam.Name,
                match.HomeTeam.ShortName,
                match.HomeTeam.Code,
                match.HomeTeam.TeamCrestUrl,
                match.HomeTeam.Country,
                match.HomeTeam.CountryCode,
                match.HomeTeam.CyrillicName)
            : new FootballTeamDto(match.HomeTeamId, "Local", "LOC", "LOC", "", "", "", null);

        var awayTeamDto = match.AwayTeam is not null
            ? new FootballTeamDto(
                match.AwayTeam.Id,
                match.AwayTeam.Name,
                match.AwayTeam.ShortName,
                match.AwayTeam.Code,
                match.AwayTeam.TeamCrestUrl,
                match.AwayTeam.Country,
                match.AwayTeam.CountryCode,
                match.AwayTeam.CyrillicName)
            : new FootballTeamDto(match.AwayTeamId, "Visitante", "VIS", "VIS", "", "", "", null);

        var leagueDto = match.League is not null
            ? new FootballLeagueDto(
                match.League.Id,
                match.League.Name,
                match.League.ShortName,
                match.League.Country,
                match.League.CountryCode,
                match.League.Season,
                match.League.Matchday,
                match.League.CyrillicName,
                match.League.LeagueLogoUrl)
            : new FootballLeagueDto(match.LeagueId, "Fútbol", "FTB", "Global", "GL", "2026/27", "", null, null);

        var clockDto = isLive && match.CurrentMinute.HasValue
            ? new FootballClockDto(
                match.CurrentMinute.Value,
                null,
                match.Period ?? "first_half",
                match.IsRunning,
                $"{match.CurrentMinute.Value}'",
                match.CurrentMinute.Value > 45 ? "2-Й ТАЙМ" : "1-Й ТАЙМ")
            : null;

        var marketsDto = match.Markets.Select(m =>
        {
            var is1x2 = m.TypeKey == "match_result_1x2";
            return new FootballMarketDto(
                m.Id,
                m.MatchId,
                m.TypeKey,
                m.Name,
                m.Line,
                m.Status,
                m.Selections.Select(s => new FootballSelectionDto(
                    s.Id,
                    s.MarketId,
                    s.Name,
                    s.Code,
                    s.DecimalOdds,
                    s.AmericanOdds,
                    s.Line,
                    s.Status,
                    s.CyrillicLabel
                )).ToList(),
                new FootballCyrillicMetaDto(
                    is1x2 ? "ИСХОД 1X2" : "ЛИНИЯ",
                    is1x2 ? "ОСНОВНОЕ ВРЕМЯ" : null,
                    "КОЭФ",
                    isLive ? "ПРЯМОЙ ЭФИР" : "ЛИНИЯ"
                )
            );
        }).ToList();

        return new FootballMatchDto(
            match.Id,
            $"{homeTeamDto.Name} vs {awayTeamDto.Name}",
            homeTeamDto,
            awayTeamDto,
            leagueDto,
            match.KickoffTimeUtc.ToString("o"),
            match.Status,
            new FootballScoreDto(match.HomeScore, match.AwayScore),
            clockDto,
            marketsDto,
            IsBettingOpen: !isFinished,
            IsExpired: isFinished,
            match.Stadium,
            match.City,
            match.Referee
        );
    }

    public static FootballLeagueDto ToDto(FootballLeague league) =>
        new(
            league.Id,
            league.Name,
            league.ShortName,
            league.Country,
            league.CountryCode,
            league.Season,
            league.Matchday,
            league.CyrillicName,
            league.LeagueLogoUrl
        );
}

