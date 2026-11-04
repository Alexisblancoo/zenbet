using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Zenbet.EventsMarkets.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddRgsAndRiskEngine : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "active_bonus_forfeited_amount",
                schema: "events_markets",
                table: "wallets",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "reference_transaction_id",
                schema: "events_markets",
                table: "transactions",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "active_bet_count",
                schema: "events_markets",
                table: "selections",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<decimal>(
                name: "current_liability",
                schema: "events_markets",
                table: "selections",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "total_staked",
                schema: "events_markets",
                table: "selections",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<bool>(
                name: "is_suspended_by_risk",
                schema: "events_markets",
                table: "markets",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<decimal>(
                name: "max_liability_limit",
                schema: "events_markets",
                table: "markets",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 10000m);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "active_bonus_forfeited_amount",
                schema: "events_markets",
                table: "wallets");

            migrationBuilder.DropColumn(
                name: "reference_transaction_id",
                schema: "events_markets",
                table: "transactions");

            migrationBuilder.DropColumn(
                name: "active_bet_count",
                schema: "events_markets",
                table: "selections");

            migrationBuilder.DropColumn(
                name: "current_liability",
                schema: "events_markets",
                table: "selections");

            migrationBuilder.DropColumn(
                name: "total_staked",
                schema: "events_markets",
                table: "selections");

            migrationBuilder.DropColumn(
                name: "is_suspended_by_risk",
                schema: "events_markets",
                table: "markets");

            migrationBuilder.DropColumn(
                name: "max_liability_limit",
                schema: "events_markets",
                table: "markets");
        }
    }
}
