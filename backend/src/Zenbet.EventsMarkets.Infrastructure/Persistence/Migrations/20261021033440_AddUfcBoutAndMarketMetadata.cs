using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Zenbet.EventsMarkets.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddUfcBoutAndMarketMetadata : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "code",
                schema: "events_markets",
                table: "selections",
                type: "character varying(40)",
                maxLength: 40,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "display_order",
                schema: "events_markets",
                table: "selections",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "display_order",
                schema: "events_markets",
                table: "markets",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<decimal>(
                name: "line",
                schema: "events_markets",
                table: "markets",
                type: "numeric(4,1)",
                precision: 4,
                scale: 1,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "billing",
                schema: "events_markets",
                table: "events",
                type: "character varying(24)",
                maxLength: 24,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "billing_order",
                schema: "events_markets",
                table: "events",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "blue_country",
                schema: "events_markets",
                table: "events",
                type: "character varying(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "blue_country_code",
                schema: "events_markets",
                table: "events",
                type: "character varying(8)",
                maxLength: 8,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "blue_division",
                schema: "events_markets",
                table: "events",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "blue_fighter_id",
                schema: "events_markets",
                table: "events",
                type: "character varying(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "blue_fighter_name",
                schema: "events_markets",
                table: "events",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "blue_rank",
                schema: "events_markets",
                table: "events",
                type: "character varying(8)",
                maxLength: 8,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "blue_record",
                schema: "events_markets",
                table: "events",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_title_fight",
                schema: "events_markets",
                table: "events",
                type: "boolean",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "location",
                schema: "events_markets",
                table: "events",
                type: "character varying(160)",
                maxLength: 160,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "red_country",
                schema: "events_markets",
                table: "events",
                type: "character varying(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "red_country_code",
                schema: "events_markets",
                table: "events",
                type: "character varying(8)",
                maxLength: 8,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "red_division",
                schema: "events_markets",
                table: "events",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "red_fighter_id",
                schema: "events_markets",
                table: "events",
                type: "character varying(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "red_fighter_name",
                schema: "events_markets",
                table: "events",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "red_rank",
                schema: "events_markets",
                table: "events",
                type: "character varying(8)",
                maxLength: 8,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "red_record",
                schema: "events_markets",
                table: "events",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "scheduled_rounds",
                schema: "events_markets",
                table: "events",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "venue",
                schema: "events_markets",
                table: "events",
                type: "character varying(160)",
                maxLength: 160,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "weight_division",
                schema: "events_markets",
                table: "events",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "code",
                schema: "events_markets",
                table: "selections");

            migrationBuilder.DropColumn(
                name: "display_order",
                schema: "events_markets",
                table: "selections");

            migrationBuilder.DropColumn(
                name: "display_order",
                schema: "events_markets",
                table: "markets");

            migrationBuilder.DropColumn(
                name: "line",
                schema: "events_markets",
                table: "markets");

            migrationBuilder.DropColumn(
                name: "billing",
                schema: "events_markets",
                table: "events");

            migrationBuilder.DropColumn(
                name: "billing_order",
                schema: "events_markets",
                table: "events");

            migrationBuilder.DropColumn(
                name: "blue_country",
                schema: "events_markets",
                table: "events");

            migrationBuilder.DropColumn(
                name: "blue_country_code",
                schema: "events_markets",
                table: "events");

            migrationBuilder.DropColumn(
                name: "blue_division",
                schema: "events_markets",
                table: "events");

            migrationBuilder.DropColumn(
                name: "blue_fighter_id",
                schema: "events_markets",
                table: "events");

            migrationBuilder.DropColumn(
                name: "blue_fighter_name",
                schema: "events_markets",
                table: "events");

            migrationBuilder.DropColumn(
                name: "blue_rank",
                schema: "events_markets",
                table: "events");

            migrationBuilder.DropColumn(
                name: "blue_record",
                schema: "events_markets",
                table: "events");

            migrationBuilder.DropColumn(
                name: "is_title_fight",
                schema: "events_markets",
                table: "events");

            migrationBuilder.DropColumn(
                name: "location",
                schema: "events_markets",
                table: "events");

            migrationBuilder.DropColumn(
                name: "red_country",
                schema: "events_markets",
                table: "events");

            migrationBuilder.DropColumn(
                name: "red_country_code",
                schema: "events_markets",
                table: "events");

            migrationBuilder.DropColumn(
                name: "red_division",
                schema: "events_markets",
                table: "events");

            migrationBuilder.DropColumn(
                name: "red_fighter_id",
                schema: "events_markets",
                table: "events");

            migrationBuilder.DropColumn(
                name: "red_fighter_name",
                schema: "events_markets",
                table: "events");

            migrationBuilder.DropColumn(
                name: "red_rank",
                schema: "events_markets",
                table: "events");

            migrationBuilder.DropColumn(
                name: "red_record",
                schema: "events_markets",
                table: "events");

            migrationBuilder.DropColumn(
                name: "scheduled_rounds",
                schema: "events_markets",
                table: "events");

            migrationBuilder.DropColumn(
                name: "venue",
                schema: "events_markets",
                table: "events");

            migrationBuilder.DropColumn(
                name: "weight_division",
                schema: "events_markets",
                table: "events");
        }
    }
}
