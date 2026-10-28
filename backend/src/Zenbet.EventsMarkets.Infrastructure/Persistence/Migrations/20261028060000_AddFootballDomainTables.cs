using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Zenbet.EventsMarkets.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddFootballDomainTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "football_leagues",
                schema: "events_markets",
                columns: table => new
                {
                    id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    short_name = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    country = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    country_code = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    season = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    matchday = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    league_logo_url = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    cyrillic_name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_football_leagues", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "football_teams",
                schema: "events_markets",
                columns: table => new
                {
                    id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    short_name = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    code = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    team_crest_url = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    country = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    country_code = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    cyrillic_name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_football_teams", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "football_matches",
                schema: "events_markets",
                columns: table => new
                {
                    id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    event_id = table.Column<Guid>(type: "uuid", nullable: false),
                    league_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    home_team_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    away_team_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    kickoff_time_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    home_score = table.Column<int>(type: "integer", nullable: false),
                    away_score = table.Column<int>(type: "integer", nullable: false),
                    current_minute = table.Column<int>(type: "integer", nullable: true),
                    period = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    is_running = table.Column<bool>(type: "boolean", nullable: false),
                    stadium = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    city = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    referee = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_football_matches", x => x.id);
                    table.ForeignKey(
                        name: "fk_football_matches_football_leagues_league_id",
                        column: x => x.league_id,
                        principalSchema: "events_markets",
                        principalTable: "football_leagues",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_football_matches_football_teams_away_team_id",
                        column: x => x.away_team_id,
                        principalSchema: "events_markets",
                        principalTable: "football_teams",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_football_matches_football_teams_home_team_id",
                        column: x => x.home_team_id,
                        principalSchema: "events_markets",
                        principalTable: "football_teams",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "football_markets",
                schema: "events_markets",
                columns: table => new
                {
                    id = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    match_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    market_id = table.Column<Guid>(type: "uuid", nullable: false),
                    type_key = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    line = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: true),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_football_markets", x => x.id);
                    table.ForeignKey(
                        name: "fk_football_markets_football_matches_match_id",
                        column: x => x.match_id,
                        principalSchema: "events_markets",
                        principalTable: "football_matches",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "football_selections",
                schema: "events_markets",
                columns: table => new
                {
                    id = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    market_id = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    selection_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    code = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    decimal_odds = table.Column<decimal>(type: "numeric(6,3)", precision: 6, scale: 3, nullable: false),
                    american_odds = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    line = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: true),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    cyrillic_label = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_football_selections", x => x.id);
                    table.ForeignKey(
                        name: "fk_football_selections_football_markets_market_id",
                        column: x => x.market_id,
                        principalSchema: "events_markets",
                        principalTable: "football_markets",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_football_matches_away_team_id",
                schema: "events_markets",
                table: "football_matches",
                column: "away_team_id");

            migrationBuilder.CreateIndex(
                name: "ix_football_matches_home_team_id",
                schema: "events_markets",
                table: "football_matches",
                column: "home_team_id");

            migrationBuilder.CreateIndex(
                name: "ix_football_matches_league_id",
                schema: "events_markets",
                table: "football_matches",
                column: "league_id");

            migrationBuilder.CreateIndex(
                name: "ix_football_markets_match_id",
                schema: "events_markets",
                table: "football_markets",
                column: "match_id");

            migrationBuilder.CreateIndex(
                name: "ix_football_selections_market_id",
                schema: "events_markets",
                table: "football_selections",
                column: "market_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "football_selections",
                schema: "events_markets");

            migrationBuilder.DropTable(
                name: "football_markets",
                schema: "events_markets");

            migrationBuilder.DropTable(
                name: "football_matches",
                schema: "events_markets");

            migrationBuilder.DropTable(
                name: "football_teams",
                schema: "events_markets");

            migrationBuilder.DropTable(
                name: "football_leagues",
                schema: "events_markets");
        }
    }
}

