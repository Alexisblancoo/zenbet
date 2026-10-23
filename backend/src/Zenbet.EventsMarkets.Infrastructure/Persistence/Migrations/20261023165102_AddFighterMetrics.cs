using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Zenbet.EventsMarkets.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddFighterMetrics : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "blue_reach_inches",
                schema: "events_markets",
                table: "events",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "blue_stance",
                schema: "events_markets",
                table: "events",
                type: "character varying(16)",
                maxLength: 16,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "blue_striking_accuracy_percent",
                schema: "events_markets",
                table: "events",
                type: "numeric(5,2)",
                precision: 5,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "blue_takedown_defense_percent",
                schema: "events_markets",
                table: "events",
                type: "numeric(5,2)",
                precision: 5,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "red_reach_inches",
                schema: "events_markets",
                table: "events",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "red_stance",
                schema: "events_markets",
                table: "events",
                type: "character varying(16)",
                maxLength: 16,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "red_striking_accuracy_percent",
                schema: "events_markets",
                table: "events",
                type: "numeric(5,2)",
                precision: 5,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "red_takedown_defense_percent",
                schema: "events_markets",
                table: "events",
                type: "numeric(5,2)",
                precision: 5,
                scale: 2,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "blue_reach_inches",
                schema: "events_markets",
                table: "events");

            migrationBuilder.DropColumn(
                name: "blue_stance",
                schema: "events_markets",
                table: "events");

            migrationBuilder.DropColumn(
                name: "blue_striking_accuracy_percent",
                schema: "events_markets",
                table: "events");

            migrationBuilder.DropColumn(
                name: "blue_takedown_defense_percent",
                schema: "events_markets",
                table: "events");

            migrationBuilder.DropColumn(
                name: "red_reach_inches",
                schema: "events_markets",
                table: "events");

            migrationBuilder.DropColumn(
                name: "red_stance",
                schema: "events_markets",
                table: "events");

            migrationBuilder.DropColumn(
                name: "red_striking_accuracy_percent",
                schema: "events_markets",
                table: "events");

            migrationBuilder.DropColumn(
                name: "red_takedown_defense_percent",
                schema: "events_markets",
                table: "events");
        }
    }
}
