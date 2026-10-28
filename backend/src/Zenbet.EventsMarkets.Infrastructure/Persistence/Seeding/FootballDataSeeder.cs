namespace Zenbet.EventsMarkets.Infrastructure.Persistence.Seeding;

using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Zenbet.EventsMarkets.Domain.Aggregates;
using Zenbet.EventsMarkets.Domain.Enums;
using Zenbet.EventsMarkets.Domain.Football;
using Zenbet.EventsMarkets.Domain.ValueObjects;
using DomainEventId = Zenbet.EventsMarkets.Domain.ValueObjects.EventId;

public sealed class FootballDataSeeder : IHostedService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<FootballDataSeeder> _logger;

    public FootballDataSeeder(
        IServiceScopeFactory scopeFactory,
        ILogger<FootballDataSeeder> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        await using var scope = _scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<EventsMarketsDbContext>();

        try
        {
            if (await db.FootballMatches.AnyAsync(cancellationToken))
            {
                _logger.LogInformation("Partidos de fútbol ya inicializados en la base de datos.");
                return;
            }

            _logger.LogInformation("Poblando ligas, equipos y partidos oficiales de fútbol en PostgreSQL...");

            // 1. Ligas Oficiales
            var ucl = new FootballLeague
            {
                Id = "ucl",
                Name = "UEFA Champions League",
                ShortName = "UCL",
                Country = "Europa",
                CountryCode = "EU",
                Season = "2026/27",
                Matchday = "Fase de Liga",
                LeagueLogoUrl = "https://upload.wikimedia.org/wikipedia/en/b/bf/UEFA_Champions_League_logo_2.svg",
                CyrillicName = "ЛИГА ЧЕМПИОНОВ"
            };

            var premier = new FootballLeague
            {
                Id = "premier",
                Name = "Premier League",
                ShortName = "Premier",
                Country = "Inglaterra",
                CountryCode = "GB",
                Season = "2026/27",
                Matchday = "Jornada 10",
                LeagueLogoUrl = "https://upload.wikimedia.org/wikipedia/en/f/f2/Premier_League_Logo.svg",
                CyrillicName = "АПЛ"
            };

            var laliga = new FootballLeague
            {
                Id = "laliga",
                Name = "LaLiga EA Sports",
                ShortName = "LaLiga",
                Country = "España",
                CountryCode = "ES",
                Season = "2026/27",
                Matchday = "Jornada 11",
                LeagueLogoUrl = "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0f/LaLiga_EA_Sports_2023_Vertical_Logo.svg/1200px-LaLiga_EA_Sports_2023_Vertical_Logo.svg.png",
                CyrillicName = "ЛА ЛИГА"
            };

            var bolivia = new FootballLeague
            {
                Id = "bolivia",
                Name = "División Profesional",
                ShortName = "Liga Tigo",
                Country = "Bolivia",
                CountryCode = "BO",
                Season = "2026",
                Matchday = "Torneo Clausura - Fecha 18",
                LeagueLogoUrl = "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Logo_Divisi%C3%B3n_Profesional_del_F%C3%BAtbol_Boliviano.png/800px-Logo_Divisi%C3%B3n_Profesional_del_F%C3%BAtbol_Boliviano.png",
                CyrillicName = "ПРИМЕРА БОЛИВИИ"
            };

            await db.FootballLeagues.AddRangeAsync(new[] { ucl, premier, laliga, bolivia }, cancellationToken);

            // 2. Equipos Oficiales con Escudos de Alta Calidad
            var teams = new List<FootballTeam>
            {
                // UCL / LaLiga / Premier
                new() { Id = "rma", Name = "Real Madrid", ShortName = "Real Madrid", Code = "RMA", TeamCrestUrl = "https://crests.football-data.org/86.svg", Country = "España", CountryCode = "ES", CyrillicName = "РЕАЛ МАДРИД" },
                new() { Id = "mci", Name = "Manchester City", ShortName = "Man City", Code = "MCI", TeamCrestUrl = "https://crests.football-data.org/65.svg", Country = "Inglaterra", CountryCode = "GB", CyrillicName = "МАН СИТИ" },
                new() { Id = "bay", Name = "Bayern Múnich", ShortName = "Bayern", Code = "BAY", TeamCrestUrl = "https://crests.football-data.org/5.svg", Country = "Alemania", CountryCode = "DE", CyrillicName = "БАВАРИЯ" },
                new() { Id = "psg", Name = "Paris Saint-Germain", ShortName = "PSG", Code = "PSG", TeamCrestUrl = "https://crests.football-data.org/524.svg", Country = "Francia", CountryCode = "FR", CyrillicName = "ПСЖ" },
                new() { Id = "liv", Name = "Liverpool FC", ShortName = "Liverpool", Code = "LIV", TeamCrestUrl = "https://crests.football-data.org/64.svg", Country = "Inglaterra", CountryCode = "GB", CyrillicName = "ЛИВЕРПУЛЬ" },
                new() { Id = "ars", Name = "Arsenal FC", ShortName = "Arsenal", Code = "ARS", TeamCrestUrl = "https://crests.football-data.org/57.svg", Country = "Inglaterra", CountryCode = "GB", CyrillicName = "АРСЕНАЛ" },
                new() { Id = "mun", Name = "Manchester United", ShortName = "Man United", Code = "MUN", TeamCrestUrl = "https://crests.football-data.org/66.svg", Country = "Inglaterra", CountryCode = "GB", CyrillicName = "МАН ЮНАЙТЕД" },
                new() { Id = "che", Name = "Chelsea FC", ShortName = "Chelsea", Code = "CHE", TeamCrestUrl = "https://crests.football-data.org/61.svg", Country = "Inglaterra", CountryCode = "GB", CyrillicName = "ЧЕЛСИ" },
                new() { Id = "fcb", Name = "FC Barcelona", ShortName = "Barcelona", Code = "FCB", TeamCrestUrl = "https://crests.football-data.org/81.svg", Country = "España", CountryCode = "ES", CyrillicName = "БАРСЕЛОНА" },
                new() { Id = "atm", Name = "Atlético de Madrid", ShortName = "Atlético", Code = "ATM", TeamCrestUrl = "https://crests.football-data.org/78.svg", Country = "España", CountryCode = "ES", CyrillicName = "АТЛЕТИКО" },
                new() { Id = "ath", Name = "Athletic Club", ShortName = "Athletic", Code = "ATH", TeamCrestUrl = "https://crests.football-data.org/77.svg", Country = "España", CountryCode = "ES", CyrillicName = "АТЛЕТИК" },
                new() { Id = "rso", Name = "Real Sociedad", ShortName = "Real Sociedad", Code = "RSO", TeamCrestUrl = "https://crests.football-data.org/92.svg", Country = "España", CountryCode = "ES", CyrillicName = "РЕАЛ СОСЬЕДАД" },

                // Bolivia
                new() { Id = "bol", Name = "Club Bolívar", ShortName = "Bolívar", Code = "BOL", TeamCrestUrl = "https://upload.wikimedia.org/wikipedia/commons/9/90/Club_Bol%C3%ADvar_logo.svg", Country = "Bolivia", CountryCode = "BO", CyrillicName = "БОЛИВАР" },
                new() { Id = "str", Name = "The Strongest", ShortName = "The Strongest", Code = "STR", TeamCrestUrl = "https://upload.wikimedia.org/wikipedia/commons/e/ec/Escudo_The_Strongest.png", Country = "Bolivia", CountryCode = "BO", CyrillicName = "ЗЕ СТРОНГЕСТ" },
                new() { Id = "wil", Name = "Jorge Wilstermann", ShortName = "Wilstermann", Code = "WIL", TeamCrestUrl = "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Escudo_Wilstermann.png/600px-Escudo_Wilstermann.png", Country = "Bolivia", CountryCode = "BO", CyrillicName = "ВИЛЬСТЕРМАНН" },
                new() { Id = "alw", Name = "Always Ready", ShortName = "Always Ready", Code = "ALW", TeamCrestUrl = "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Escudo_Club_Always_Ready.png/600px-Escudo_Club_Always_Ready.png", Country = "Bolivia", CountryCode = "BO", CyrillicName = "ОЛВЕЙС РЕДИ" }
            };

            await db.FootballTeams.AddRangeAsync(teams, cancellationToken);
            await db.SaveChangesAsync(cancellationToken);

            // 3. Partidos Reales con Mercados y Cuotas Oficiales
            var now = DateTimeOffset.UtcNow;

            var matchSeeds = new[]
            {
                new MatchSeedDef(
                    Id: "ftb_ucl_rma_mci",
                    LeagueId: "ucl",
                    HomeTeamId: "rma",
                    AwayTeamId: "mci",
                    Kickoff: now.AddMinutes(-67),
                    Status: "live",
                    HomeScore: 2,
                    AwayScore: 1,
                    Minute: 67,
                    Period: "second_half",
                    IsRunning: true,
                    Stadium: "Estadio Santiago Bernabéu",
                    City: "Madrid",
                    Referee: "Szymon Marciniak",
                    HomeOdds: 1.95m,
                    DrawOdds: 3.60m,
                    AwayOdds: 3.80m,
                    OverOdds: 1.75m,
                    UnderOdds: 2.05m,
                    TotalLine: 3.5m,
                    BttsYesOdds: 1.45m,
                    BttsNoOdds: 2.65m
                ),
                new MatchSeedDef(
                    Id: "ftb_bol_bol_str",
                    LeagueId: "bolivia",
                    HomeTeamId: "bol",
                    AwayTeamId: "str",
                    Kickoff: now.AddMinutes(-38),
                    Status: "live",
                    HomeScore: 1,
                    AwayScore: 0,
                    Minute: 38,
                    Period: "first_half",
                    IsRunning: true,
                    Stadium: "Estadio Olímpico Hernando Siles",
                    City: "La Paz",
                    Referee: "Gery Vargas",
                    HomeOdds: 1.85m,
                    DrawOdds: 3.50m,
                    AwayOdds: 4.10m,
                    OverOdds: 1.68m,
                    UnderOdds: 2.12m,
                    TotalLine: 2.5m,
                    BttsYesOdds: 1.65m,
                    BttsNoOdds: 2.15m
                ),
                new MatchSeedDef(
                    Id: "ftb_ucl_bay_psg",
                    LeagueId: "ucl",
                    HomeTeamId: "bay",
                    AwayTeamId: "psg",
                    Kickoff: now.AddHours(28),
                    Status: "upcoming",
                    HomeScore: 0,
                    AwayScore: 0,
                    Minute: null,
                    Period: "pre_match",
                    IsRunning: false,
                    Stadium: "Allianz Arena",
                    City: "Múnich",
                    Referee: "Clément Turpin",
                    HomeOdds: 2.10m,
                    DrawOdds: 3.75m,
                    AwayOdds: 3.20m,
                    OverOdds: 1.55m,
                    UnderOdds: 2.35m,
                    TotalLine: 2.5m,
                    BttsYesOdds: 1.50m,
                    BttsNoOdds: 2.50m
                ),
                new MatchSeedDef(
                    Id: "ftb_epl_liv_ars",
                    LeagueId: "premier",
                    HomeTeamId: "liv",
                    AwayTeamId: "ars",
                    Kickoff: now.AddDays(3).AddHours(4),
                    Status: "upcoming",
                    HomeScore: 0,
                    AwayScore: 0,
                    Minute: null,
                    Period: "pre_match",
                    IsRunning: false,
                    Stadium: "Anfield",
                    City: "Liverpool",
                    Referee: "Michael Oliver",
                    HomeOdds: 2.25m,
                    DrawOdds: 3.50m,
                    AwayOdds: 3.10m,
                    OverOdds: 1.65m,
                    UnderOdds: 2.20m,
                    TotalLine: 2.5m,
                    BttsYesOdds: 1.58m,
                    BttsNoOdds: 2.30m
                ),
                new MatchSeedDef(
                    Id: "ftb_epl_mun_che",
                    LeagueId: "premier",
                    HomeTeamId: "mun",
                    AwayTeamId: "che",
                    Kickoff: now.AddDays(4).AddHours(2),
                    Status: "upcoming",
                    HomeScore: 0,
                    AwayScore: 0,
                    Minute: null,
                    Period: "pre_match",
                    IsRunning: false,
                    Stadium: "Old Trafford",
                    City: "Manchester",
                    Referee: "Anthony Taylor",
                    HomeOdds: 2.55m,
                    DrawOdds: 3.45m,
                    AwayOdds: 2.70m,
                    OverOdds: 1.72m,
                    UnderOdds: 2.10m,
                    TotalLine: 2.5m,
                    BttsYesOdds: 1.62m,
                    BttsNoOdds: 2.22m
                ),
                new MatchSeedDef(
                    Id: "ftb_laliga_fcb_atm",
                    LeagueId: "laliga",
                    HomeTeamId: "fcb",
                    AwayTeamId: "atm",
                    Kickoff: now.AddDays(4).AddHours(8),
                    Status: "upcoming",
                    HomeScore: 0,
                    AwayScore: 0,
                    Minute: null,
                    Period: "pre_match",
                    IsRunning: false,
                    Stadium: "Spotify Camp Nou",
                    City: "Barcelona",
                    Referee: "Jesús Gil Manzano",
                    HomeOdds: 1.92m,
                    DrawOdds: 3.65m,
                    AwayOdds: 3.90m,
                    OverOdds: 1.70m,
                    UnderOdds: 2.15m,
                    TotalLine: 2.5m,
                    BttsYesOdds: 1.65m,
                    BttsNoOdds: 2.18m
                ),
                new MatchSeedDef(
                    Id: "ftb_laliga_ath_rso",
                    LeagueId: "laliga",
                    HomeTeamId: "ath",
                    AwayTeamId: "rso",
                    Kickoff: now.AddDays(3).AddHours(5),
                    Status: "upcoming",
                    HomeScore: 0,
                    AwayScore: 0,
                    Minute: null,
                    Period: "pre_match",
                    IsRunning: false,
                    Stadium: "San Mamés",
                    City: "Bilbao",
                    Referee: "Mateu Lahoz",
                    HomeOdds: 2.30m,
                    DrawOdds: 3.20m,
                    AwayOdds: 3.25m,
                    OverOdds: 2.05m,
                    UnderOdds: 1.75m,
                    TotalLine: 2.5m,
                    BttsYesOdds: 1.85m,
                    BttsNoOdds: 1.90m
                ),
                new MatchSeedDef(
                    Id: "ftb_bol_wil_alw",
                    LeagueId: "bolivia",
                    HomeTeamId: "wil",
                    AwayTeamId: "alw",
                    Kickoff: now.AddDays(4).AddHours(6),
                    Status: "upcoming",
                    HomeScore: 0,
                    AwayScore: 0,
                    Minute: null,
                    Period: "pre_match",
                    IsRunning: false,
                    Stadium: "Estadio Félix Capriles",
                    City: "Cochabamba",
                    Referee: "Ivo Méndez",
                    HomeOdds: 2.15m,
                    DrawOdds: 3.40m,
                    AwayOdds: 3.20m,
                    OverOdds: 1.80m,
                    UnderOdds: 1.95m,
                    TotalLine: 2.5m,
                    BttsYesOdds: 1.70m,
                    BttsNoOdds: 2.05m
                )
            };

            foreach (var seed in matchSeeds)
            {
                var home = teams.First(t => t.Id == seed.HomeTeamId);
                var away = teams.First(t => t.Id == seed.AwayTeamId);
                var eventGuid = GenerateDeterministicGuid($"evt_{seed.Id}");

                // A. Crear Evento Core en events_markets.events para interoperar con BetSlip y liquidaciones
                var domainEvent = new Event(
                    DomainEventId.From(eventGuid),
                    $"{home.Name} vs {away.Name}",
                    SportType.Football,
                    seed.Kickoff,
                    seed.LeagueId.ToUpperInvariant()
                );

                // B. Mercados y Selecciones
                var mkt1x2Guid = GenerateDeterministicGuid($"mkt_1x2_{seed.Id}");
                var selHomeGuid = GenerateDeterministicGuid($"sel_1_{seed.Id}");
                var selDrawGuid = GenerateDeterministicGuid($"sel_x_{seed.Id}");
                var selAwayGuid = GenerateDeterministicGuid($"sel_2_{seed.Id}");

                var selections1x2 = new List<Selection>
                {
                    new(SelectionId.From(selHomeGuid), home.Name, new Odd(seed.HomeOdds, now), "1", 0),
                    new(SelectionId.From(selDrawGuid), "Empate", new Odd(seed.DrawOdds, now), "X", 1),
                    new(SelectionId.From(selAwayGuid), away.Name, new Odd(seed.AwayOdds, now), "2", 2)
                };
                domainEvent.AddMarket(MarketId.From(mkt1x2Guid), "Resultado Final (1X2)", MarketType.MatchWinner, selections1x2);

                var mktTotalGuid = GenerateDeterministicGuid($"mkt_tot_{seed.Id}");
                var selOverGuid = GenerateDeterministicGuid($"sel_over_{seed.Id}");
                var selUnderGuid = GenerateDeterministicGuid($"sel_under_{seed.Id}");
                var selectionsTotal = new List<Selection>
                {
                    new(SelectionId.From(selOverGuid), $"Más de {seed.TotalLine}", new Odd(seed.OverOdds, now), "over", 0),
                    new(SelectionId.From(selUnderGuid), $"Menos de {seed.TotalLine}", new Odd(seed.UnderOdds, now), "under", 1)
                };
                domainEvent.AddMarket(MarketId.From(mktTotalGuid), $"Total de Goles ({seed.TotalLine})", MarketType.TotalGoals, selectionsTotal, line: seed.TotalLine);

                var mktBttsGuid = GenerateDeterministicGuid($"mkt_btts_{seed.Id}");
                var selBttsYesGuid = GenerateDeterministicGuid($"sel_btts_yes_{seed.Id}");
                var selBttsNoGuid = GenerateDeterministicGuid($"sel_btts_no_{seed.Id}");
                var selectionsBtts = new List<Selection>
                {
                    new(SelectionId.From(selBttsYesGuid), "Ambos Anotan - Sí", new Odd(seed.BttsYesOdds, now), "btts_yes", 0),
                    new(SelectionId.From(selBttsNoGuid), "Ambos Anotan - No", new Odd(seed.BttsNoOdds, now), "btts_no", 1)
                };
                domainEvent.AddMarket(MarketId.From(mktBttsGuid), "Ambos Equipos Anotan", MarketType.BothTeamsToScore, selectionsBtts);

                await db.Events.AddAsync(domainEvent, cancellationToken);

                // C. Entidades Especializadas de Fútbol
                var footballMatch = new FootballMatch
                {
                    Id = seed.Id,
                    EventId = eventGuid,
                    LeagueId = seed.LeagueId,
                    HomeTeamId = seed.HomeTeamId,
                    AwayTeamId = seed.AwayTeamId,
                    KickoffTimeUtc = seed.Kickoff,
                    Status = seed.Status,
                    HomeScore = seed.HomeScore,
                    AwayScore = seed.AwayScore,
                    CurrentMinute = seed.Minute,
                    Period = seed.Period,
                    IsRunning = seed.IsRunning,
                    Stadium = seed.Stadium,
                    City = seed.City,
                    Referee = seed.Referee,
                    Markets = new List<FootballMarket>
                    {
                        new()
                        {
                            Id = $"mkt_1x2_{seed.Id}",
                            MatchId = seed.Id,
                            MarketId = mkt1x2Guid,
                            TypeKey = "match_result_1x2",
                            Name = "Resultado Final (1X2)",
                            Line = null,
                            Status = "open",
                            Selections = new List<FootballSelection>
                            {
                                new()
                                {
                                    Id = selHomeGuid.ToString(),
                                    MarketId = $"mkt_1x2_{seed.Id}",
                                    SelectionId = selHomeGuid,
                                    Name = home.Name,
                                    Code = "1",
                                    DecimalOdds = seed.HomeOdds,
                                    AmericanOdds = FormatAmericanOdds(seed.HomeOdds),
                                    Line = null,
                                    Status = "active",
                                    CyrillicLabel = "П1"
                                },
                                new()
                                {
                                    Id = selDrawGuid.ToString(),
                                    MarketId = $"mkt_1x2_{seed.Id}",
                                    SelectionId = selDrawGuid,
                                    Name = "Empate",
                                    Code = "X",
                                    DecimalOdds = seed.DrawOdds,
                                    AmericanOdds = FormatAmericanOdds(seed.DrawOdds),
                                    Line = null,
                                    Status = "active",
                                    CyrillicLabel = "X"
                                },
                                new()
                                {
                                    Id = selAwayGuid.ToString(),
                                    MarketId = $"mkt_1x2_{seed.Id}",
                                    SelectionId = selAwayGuid,
                                    Name = away.Name,
                                    Code = "2",
                                    DecimalOdds = seed.AwayOdds,
                                    AmericanOdds = FormatAmericanOdds(seed.AwayOdds),
                                    Line = null,
                                    Status = "active",
                                    CyrillicLabel = "П2"
                                }
                            }
                        },
                        new()
                        {
                            Id = $"mkt_tot_{seed.Id}",
                            MatchId = seed.Id,
                            MarketId = mktTotalGuid,
                            TypeKey = "total_goals",
                            Name = $"Total de Goles ({seed.TotalLine})",
                            Line = seed.TotalLine,
                            Status = "open",
                            Selections = new List<FootballSelection>
                            {
                                new()
                                {
                                    Id = selOverGuid.ToString(),
                                    MarketId = $"mkt_tot_{seed.Id}",
                                    SelectionId = selOverGuid,
                                    Name = $"Más de {seed.TotalLine}",
                                    Code = "over",
                                    DecimalOdds = seed.OverOdds,
                                    AmericanOdds = FormatAmericanOdds(seed.OverOdds),
                                    Line = seed.TotalLine,
                                    Status = "active",
                                    CyrillicLabel = $"Б {seed.TotalLine}"
                                },
                                new()
                                {
                                    Id = selUnderGuid.ToString(),
                                    MarketId = $"mkt_tot_{seed.Id}",
                                    SelectionId = selUnderGuid,
                                    Name = $"Menos de {seed.TotalLine}",
                                    Code = "under",
                                    DecimalOdds = seed.UnderOdds,
                                    AmericanOdds = FormatAmericanOdds(seed.UnderOdds),
                                    Line = seed.TotalLine,
                                    Status = "active",
                                    CyrillicLabel = $"М {seed.TotalLine}"
                                }
                            }
                        },
                        new()
                        {
                            Id = $"mkt_btts_{seed.Id}",
                            MatchId = seed.Id,
                            MarketId = mktBttsGuid,
                            TypeKey = "both_teams_to_score",
                            Name = "Ambos Equipos Anotan",
                            Line = null,
                            Status = "open",
                            Selections = new List<FootballSelection>
                            {
                                new()
                                {
                                    Id = selBttsYesGuid.ToString(),
                                    MarketId = $"mkt_btts_{seed.Id}",
                                    SelectionId = selBttsYesGuid,
                                    Name = "Sí",
                                    Code = "btts_yes",
                                    DecimalOdds = seed.BttsYesOdds,
                                    AmericanOdds = FormatAmericanOdds(seed.BttsYesOdds),
                                    Line = null,
                                    Status = "active",
                                    CyrillicLabel = "ДА"
                                },
                                new()
                                {
                                    Id = selBttsNoGuid.ToString(),
                                    MarketId = $"mkt_btts_{seed.Id}",
                                    SelectionId = selBttsNoGuid,
                                    Name = "No",
                                    Code = "btts_no",
                                    DecimalOdds = seed.BttsNoOdds,
                                    AmericanOdds = FormatAmericanOdds(seed.BttsNoOdds),
                                    Line = null,
                                    Status = "active",
                                    CyrillicLabel = "НЕТ"
                                }
                            }
                        }
                    }
                };

                await db.FootballMatches.AddAsync(footballMatch, cancellationToken);
            }

            await db.SaveChangesAsync(cancellationToken);
            _logger.LogInformation("Población inicial de fútbol completada exitosamente.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error durante la población de datos de fútbol.");
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;

    private static Guid GenerateDeterministicGuid(string input)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(input));
        var guidBytes = new byte[16];
        Array.Copy(hash, guidBytes, 16);
        return new Guid(guidBytes);
    }

    private static string FormatAmericanOdds(decimal decimalOdds)
    {
        if (decimalOdds >= 2.0m)
        {
            var american = (int)Math.Round((decimalOdds - 1m) * 100m);
            return $"+{american}";
        }
        else
        {
            var american = (int)Math.Round(-100m / (decimalOdds - 1m));
            return american.ToString();
        }
    }

    private record MatchSeedDef(
        string Id,
        string LeagueId,
        string HomeTeamId,
        string AwayTeamId,
        DateTimeOffset Kickoff,
        string Status,
        int HomeScore,
        int AwayScore,
        int? Minute,
        string Period,
        bool IsRunning,
        string Stadium,
        string City,
        string Referee,
        decimal HomeOdds,
        decimal DrawOdds,
        decimal AwayOdds,
        decimal OverOdds,
        decimal UnderOdds,
        decimal TotalLine,
        decimal BttsYesOdds,
        decimal BttsNoOdds
    );
}

