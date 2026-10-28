using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Zenbet.EventsMarkets.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddWalletDepositAndPaymentMethod : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "at_risk_balance",
                schema: "events_markets",
                table: "wallets",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<int>(
                name: "payment_method",
                schema: "events_markets",
                table: "transactions",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "user_id",
                schema: "events_markets",
                table: "transactions",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.Sql(@"
                UPDATE events_markets.transactions AS t
                SET user_id = w.user_id
                FROM events_markets.wallets AS w
                WHERE t.wallet_id = w.id;
            ");

            migrationBuilder.CreateIndex(
                name: "ix_transactions_type_status_created_at",
                schema: "events_markets",
                table: "transactions",
                columns: new[] { "type", "status", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ix_transactions_user_id",
                schema: "events_markets",
                table: "transactions",
                column: "user_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_transactions_type_status_created_at",
                schema: "events_markets",
                table: "transactions");

            migrationBuilder.DropIndex(
                name: "ix_transactions_user_id",
                schema: "events_markets",
                table: "transactions");

            migrationBuilder.DropColumn(
                name: "at_risk_balance",
                schema: "events_markets",
                table: "wallets");

            migrationBuilder.DropColumn(
                name: "payment_method",
                schema: "events_markets",
                table: "transactions");

            migrationBuilder.DropColumn(
                name: "user_id",
                schema: "events_markets",
                table: "transactions");
        }
    }
}
