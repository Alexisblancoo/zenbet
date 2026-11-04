using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Zenbet.EventsMarkets.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSmartBonusLedger : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "active_bonus_completed_at",
                schema: "events_markets",
                table: "wallets",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "active_bonus_converted_amount",
                schema: "events_markets",
                table: "wallets",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "active_bonus_created_at",
                schema: "events_markets",
                table: "wallets",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "active_bonus_id",
                schema: "events_markets",
                table: "wallets",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "active_bonus_initial_amount",
                schema: "events_markets",
                table: "wallets",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "active_bonus_is_completed",
                schema: "events_markets",
                table: "wallets",
                type: "boolean",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "active_bonus_max_conversion",
                schema: "events_markets",
                table: "wallets",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "active_bonus_min_odds",
                schema: "events_markets",
                table: "wallets",
                type: "numeric(7,4)",
                precision: 7,
                scale: 4,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "active_bonus_wagered_amount",
                schema: "events_markets",
                table: "wallets",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "active_bonus_wagering_requirement",
                schema: "events_markets",
                table: "wallets",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "bonus_available",
                schema: "events_markets",
                table: "wallets",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "bonus_locked",
                schema: "events_markets",
                table: "wallets",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "real_available",
                schema: "events_markets",
                table: "wallets",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "real_locked",
                schema: "events_markets",
                table: "wallets",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "bonus_stake",
                schema: "events_markets",
                table: "transactions",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "real_stake",
                schema: "events_markets",
                table: "transactions",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.Sql("""
                UPDATE events_markets.wallets
                SET real_available = balance,
                    real_locked = at_risk_balance
                WHERE real_available = 0 AND bonus_available = 0 AND balance > 0;
                """);

            migrationBuilder.UpdateData(
                schema: "events_markets",
                table: "fighting_events",
                keyColumn: "id",
                keyValue: new Guid("20000000-0000-0000-0000-000000000008"),
                columns: new[] { "name", "slug" },
                values: new object[] { "UFC Fight Night: Suarez vs. Jandiroba", "ufc-fight-night-suarez-vs-jandiroba" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "active_bonus_completed_at",
                schema: "events_markets",
                table: "wallets");

            migrationBuilder.DropColumn(
                name: "active_bonus_converted_amount",
                schema: "events_markets",
                table: "wallets");

            migrationBuilder.DropColumn(
                name: "active_bonus_created_at",
                schema: "events_markets",
                table: "wallets");

            migrationBuilder.DropColumn(
                name: "active_bonus_id",
                schema: "events_markets",
                table: "wallets");

            migrationBuilder.DropColumn(
                name: "active_bonus_initial_amount",
                schema: "events_markets",
                table: "wallets");

            migrationBuilder.DropColumn(
                name: "active_bonus_is_completed",
                schema: "events_markets",
                table: "wallets");

            migrationBuilder.DropColumn(
                name: "active_bonus_max_conversion",
                schema: "events_markets",
                table: "wallets");

            migrationBuilder.DropColumn(
                name: "active_bonus_min_odds",
                schema: "events_markets",
                table: "wallets");

            migrationBuilder.DropColumn(
                name: "active_bonus_wagered_amount",
                schema: "events_markets",
                table: "wallets");

            migrationBuilder.DropColumn(
                name: "active_bonus_wagering_requirement",
                schema: "events_markets",
                table: "wallets");

            migrationBuilder.DropColumn(
                name: "bonus_available",
                schema: "events_markets",
                table: "wallets");

            migrationBuilder.DropColumn(
                name: "bonus_locked",
                schema: "events_markets",
                table: "wallets");

            migrationBuilder.DropColumn(
                name: "real_available",
                schema: "events_markets",
                table: "wallets");

            migrationBuilder.DropColumn(
                name: "real_locked",
                schema: "events_markets",
                table: "wallets");

            migrationBuilder.DropColumn(
                name: "bonus_stake",
                schema: "events_markets",
                table: "transactions");

            migrationBuilder.DropColumn(
                name: "real_stake",
                schema: "events_markets",
                table: "transactions");

            migrationBuilder.UpdateData(
                schema: "events_markets",
                table: "fighting_events",
                keyColumn: "id",
                keyValue: new Guid("20000000-0000-0000-0000-000000000008"),
                columns: new[] { "name", "slug" },
                values: new object[] { "UFC Fight Night: Bonfim vs. Brady", "ufc-fight-night-bonfim-vs-brady" });
        }
    }
}
