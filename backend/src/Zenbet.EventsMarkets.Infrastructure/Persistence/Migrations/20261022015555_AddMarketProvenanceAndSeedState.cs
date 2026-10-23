using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Zenbet.EventsMarkets.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddMarketProvenanceAndSeedState : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<decimal>(
                name: "current_odds_value",
                schema: "events_markets",
                table: "selections",
                type: "numeric(7,4)",
                precision: 7,
                scale: 4,
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric(5,2)",
                oldPrecision: 5,
                oldScale: 2);

            migrationBuilder.AddColumn<int>(
                name: "source_kind",
                schema: "events_markets",
                table: "markets",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "source_note",
                schema: "events_markets",
                table: "markets",
                type: "character varying(240)",
                maxLength: 240,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "source_observed_at",
                schema: "events_markets",
                table: "markets",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "source_provider",
                schema: "events_markets",
                table: "markets",
                type: "character varying(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "source_url",
                schema: "events_markets",
                table: "markets",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ufc_seed_states",
                schema: "events_markets",
                columns: table => new
                {
                    key = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    version = table.Column<int>(type: "integer", nullable: false),
                    applied_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    source_observed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ufc_seed_states", x => x.key);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ufc_seed_states",
                schema: "events_markets");

            migrationBuilder.DropColumn(
                name: "source_kind",
                schema: "events_markets",
                table: "markets");

            migrationBuilder.DropColumn(
                name: "source_note",
                schema: "events_markets",
                table: "markets");

            migrationBuilder.DropColumn(
                name: "source_observed_at",
                schema: "events_markets",
                table: "markets");

            migrationBuilder.DropColumn(
                name: "source_provider",
                schema: "events_markets",
                table: "markets");

            migrationBuilder.DropColumn(
                name: "source_url",
                schema: "events_markets",
                table: "markets");

            migrationBuilder.AlterColumn<decimal>(
                name: "current_odds_value",
                schema: "events_markets",
                table: "selections",
                type: "numeric(5,2)",
                precision: 5,
                scale: 2,
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric(7,4)",
                oldPrecision: 7,
                oldScale: 4);
        }
    }
}
