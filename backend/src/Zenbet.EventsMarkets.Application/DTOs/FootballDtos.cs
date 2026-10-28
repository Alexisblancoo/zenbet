namespace Zenbet.EventsMarkets.Application.DTOs;

public record FootballTeamDto(
    string Id,
    string Name,
    string ShortName,
    string Code,
    string LogoUrl,
    string Country,
    string CountryCode,
    string? CyrillicName
);

public record FootballLeagueDto(
    string Id,
    string Name,
    string ShortName,
    string Country,
    string CountryCode,
    string Season,
    string Matchday,
    string? CyrillicName,
    string? LogoUrl
);

public record FootballClockDto(
    int Minute,
    int? AddedMinutes,
    string Period,
    bool IsRunning,
    string Label,
    string? CyrillicPeriodLabel
);

public record FootballScoreDto(
    int Home,
    int Away
);

public record FootballSelectionDto(
    string Id,
    string MarketId,
    string Name,
    string Code,
    decimal DecimalOdds,
    string? AmericanOdds,
    decimal? Line,
    string Status,
    string? CyrillicLabel
);

public record FootballCyrillicMetaDto(
    string CyrillicTag,
    string? CyrillicHint,
    string CoeffBadge,
    string LineBadge
);

public record FootballMarketDto(
    string Id,
    string MatchId,
    string TypeKey,
    string Name,
    decimal? Line,
    string Status,
    IReadOnlyList<FootballSelectionDto> Selections,
    FootballCyrillicMetaDto? CyrillicMeta
);

public record FootballMatchDto(
    string Id,
    string Name,
    FootballTeamDto HomeTeam,
    FootballTeamDto AwayTeam,
    FootballLeagueDto League,
    string StartTimeUTC,
    string Status,
    FootballScoreDto Scores,
    FootballClockDto? Clock,
    IReadOnlyList<FootballMarketDto> Markets,
    bool IsBettingOpen,
    bool IsExpired,
    string? Stadium,
    string? City,
    string? Referee
);

public record FootballMatchesResponseDto(
    IReadOnlyList<FootballMatchDto> Items,
    int Total
);

