using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Zenbet.EventsMarkets.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Phase9SettlementAndPromos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "accepted_odds",
                schema: "events_markets",
                table: "transactions",
                type: "numeric(7,4)",
                precision: 7,
                scale: 4,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "bet_status",
                schema: "events_markets",
                table: "transactions",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "promo_code",
                schema: "events_markets",
                table: "transactions",
                type: "character varying(40)",
                maxLength: 40,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "result_method",
                schema: "events_markets",
                table: "events",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "result_recorded_at",
                schema: "events_markets",
                table: "events",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "result_round",
                schema: "events_markets",
                table: "events",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "result_winner_corner",
                schema: "events_markets",
                table: "events",
                type: "integer",
                nullable: true);

            // Las apuestas creadas antes de Phase 9 no tenían ciclo de vida
            // deportivo. Se congela la cuota vigente y se deriva el estado del
            // resultado ya publicado en la selección. Las que siguen abiertas
            // quedan Pending para que el worker las pague cuando el mercado
            // cierre; las ya resueltas no se vuelven a pagar.
            migrationBuilder.Sql(
                """
                WITH backfill AS (
                    SELECT
                        t.id,
                        s.current_odds_value AS accepted_odds,
                        CASE
                            -- Void y Push anulan el mercado completo.
                            WHEN m.settlement_result IN (3, 4) THEN 4
                            WHEN s.settlement_result = 2 THEN 3
                            WHEN s.settlement_result = 1 THEN 2
                            WHEN s.settlement_result IN (3, 4) THEN 4
                            ELSE 1
                        END AS outcome,
                        EXISTS (
                            SELECT 1
                            FROM events_markets.transactions AS st
                            WHERE st.wallet_id = t.wallet_id
                              AND st.type = 4
                              AND st.reference_id LIKE 'payout-market-%-bet-' || t.id::text
                        ) AS already_paid
                    FROM events_markets.transactions AS t
                    JOIN events_markets.selections AS s
                        ON s.id = t.selection_id
                    JOIN events_markets.markets AS m
                        ON m.id = s.market_id
                    WHERE t.type = 3
                      AND t.bet_status IS NULL
                )
                UPDATE events_markets.transactions AS t
                SET accepted_odds = b.accepted_odds,
                    bet_status = CASE
                        -- Una derrota no mueve saldo: se cierra de inmediato.
                        WHEN b.outcome = 3 THEN 3
                        -- Ganada, anulada o push: solo se cierra si el worker
                        -- anterior ya dejó su liquidación. Si no, queda Pending
                        -- para que el nuevo worker pague o reembolse.
                        WHEN b.outcome IN (2, 4) AND b.already_paid THEN b.outcome
                        ELSE 1
                    END,
                    status = CASE
                        WHEN b.outcome = 3 THEN 2
                        WHEN b.outcome IN (2, 4) AND b.already_paid THEN 2
                        ELSE t.status
                    END,
                    completed_at = CASE
                        WHEN b.outcome = 3
                            THEN COALESCE(t.completed_at, now())
                        WHEN b.outcome IN (2, 4) AND b.already_paid
                            THEN COALESCE(t.completed_at, now())
                        ELSE t.completed_at
                    END
                FROM backfill AS b
                WHERE t.id = b.id;
                """);

            migrationBuilder.CreateIndex(
                name: "ix_transactions_type_bet_status",
                schema: "events_markets",
                table: "transactions",
                columns: new[] { "type", "bet_status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_transactions_type_bet_status",
                schema: "events_markets",
                table: "transactions");

            migrationBuilder.DropColumn(
                name: "accepted_odds",
                schema: "events_markets",
                table: "transactions");

            migrationBuilder.DropColumn(
                name: "bet_status",
                schema: "events_markets",
                table: "transactions");

            migrationBuilder.DropColumn(
                name: "promo_code",
                schema: "events_markets",
                table: "transactions");

            migrationBuilder.DropColumn(
                name: "result_method",
                schema: "events_markets",
                table: "events");

            migrationBuilder.DropColumn(
                name: "result_recorded_at",
                schema: "events_markets",
                table: "events");

            migrationBuilder.DropColumn(
                name: "result_round",
                schema: "events_markets",
                table: "events");

            migrationBuilder.DropColumn(
                name: "result_winner_corner",
                schema: "events_markets",
                table: "events");
        }
    }
}
