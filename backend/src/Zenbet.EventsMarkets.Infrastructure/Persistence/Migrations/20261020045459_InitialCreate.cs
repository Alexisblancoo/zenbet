using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Zenbet.EventsMarkets.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "events_markets");

            migrationBuilder.CreateTable(
                name: "dead_letters",
                schema: "events_markets",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    original_table = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    original_id = table.Column<Guid>(type: "uuid", nullable: false),
                    payload = table.Column<string>(type: "jsonb", nullable: false),
                    error = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    failed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    retry_count = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_dead_letters", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "events",
                schema: "events_markets",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    sport_type = table.Column<int>(type: "integer", nullable: false),
                    start_time = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    competition = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    status = table.Column<int>(type: "integer", nullable: false, defaultValue: 1),
                    version = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_events", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "idempotency_keys",
                schema: "events_markets",
                columns: table => new
                {
                    key = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    command_type = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    expires_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_idempotency_keys", x => x.key);
                });

            migrationBuilder.CreateTable(
                name: "inbox_messages",
                schema: "events_markets",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    source = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    message_type = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    payload = table.Column<string>(type: "jsonb", nullable: false),
                    headers = table.Column<string>(type: "jsonb", nullable: true),
                    received_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    processed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    retry_count = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    last_error = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_inbox_messages", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "outbox_messages",
                schema: "events_markets",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    type = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    payload = table.Column<string>(type: "jsonb", nullable: false),
                    correlation_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    processed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    retry_count = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    last_error = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_outbox_messages", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "settlement_audit",
                schema: "events_markets",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    market_id = table.Column<Guid>(type: "uuid", nullable: false),
                    winner_selection_id = table.Column<Guid>(type: "uuid", nullable: false),
                    result = table.Column<int>(type: "integer", nullable: false),
                    settled_by = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    settled_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    idempotency_key = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_settlement_audit", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "wallets",
                schema: "events_markets",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    balance = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    version = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_wallets", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "markets",
                schema: "events_markets",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    event_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    type = table.Column<int>(type: "integer", nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false, defaultValue: 1),
                    settlement_result = table.Column<int>(type: "integer", nullable: true),
                    winner_selection_id = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_markets", x => x.id);
                    table.ForeignKey(
                        name: "FK_markets_events_event_id",
                        column: x => x.event_id,
                        principalSchema: "events_markets",
                        principalTable: "events",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "transactions",
                schema: "events_markets",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    wallet_id = table.Column<Guid>(type: "uuid", nullable: false),
                    type = table.Column<int>(type: "integer", nullable: false),
                    amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    balance_after = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    reference_id = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    selection_id = table.Column<Guid>(type: "uuid", nullable: true),
                    status = table.Column<int>(type: "integer", nullable: false, defaultValue: 1),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    completed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    failure_reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_transactions", x => x.id);
                    table.ForeignKey(
                        name: "FK_transactions_wallets_wallet_id",
                        column: x => x.wallet_id,
                        principalSchema: "events_markets",
                        principalTable: "wallets",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "selections",
                schema: "events_markets",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    settlement_result = table.Column<int>(type: "integer", nullable: true),
                    market_id = table.Column<Guid>(type: "uuid", nullable: false),
                    current_odds_provider = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    current_odds_timestamp = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    current_odds_value = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_selections", x => x.id);
                    table.ForeignKey(
                        name: "FK_selections_markets_market_id",
                        column: x => x.market_id,
                        principalSchema: "events_markets",
                        principalTable: "markets",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_dead_letters_failed_at",
                schema: "events_markets",
                table: "dead_letters",
                column: "failed_at");

            migrationBuilder.CreateIndex(
                name: "ix_dead_letters_original_table",
                schema: "events_markets",
                table: "dead_letters",
                column: "original_table");

            migrationBuilder.CreateIndex(
                name: "ix_events_sport_type",
                schema: "events_markets",
                table: "events",
                column: "sport_type");

            migrationBuilder.CreateIndex(
                name: "ix_events_start_time",
                schema: "events_markets",
                table: "events",
                column: "start_time");

            migrationBuilder.CreateIndex(
                name: "ix_events_status",
                schema: "events_markets",
                table: "events",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "ix_events_status_start_time",
                schema: "events_markets",
                table: "events",
                columns: new[] { "status", "start_time" });

            migrationBuilder.CreateIndex(
                name: "ix_idempotency_expires_at",
                schema: "events_markets",
                table: "idempotency_keys",
                column: "expires_at");

            migrationBuilder.CreateIndex(
                name: "ix_inbox_processed_at",
                schema: "events_markets",
                table: "inbox_messages",
                column: "processed_at");

            migrationBuilder.CreateIndex(
                name: "ix_inbox_source",
                schema: "events_markets",
                table: "inbox_messages",
                column: "source");

            migrationBuilder.CreateIndex(
                name: "ix_inbox_unprocessed",
                schema: "events_markets",
                table: "inbox_messages",
                columns: new[] { "processed_at", "retry_count" });

            migrationBuilder.CreateIndex(
                name: "ix_markets_event_id",
                schema: "events_markets",
                table: "markets",
                column: "event_id");

            migrationBuilder.CreateIndex(
                name: "ix_markets_event_id_status",
                schema: "events_markets",
                table: "markets",
                columns: new[] { "event_id", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_markets_status",
                schema: "events_markets",
                table: "markets",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "ix_outbox_correlation_id",
                schema: "events_markets",
                table: "outbox_messages",
                column: "correlation_id");

            migrationBuilder.CreateIndex(
                name: "ix_outbox_processed_at",
                schema: "events_markets",
                table: "outbox_messages",
                column: "processed_at");

            migrationBuilder.CreateIndex(
                name: "ix_outbox_unprocessed",
                schema: "events_markets",
                table: "outbox_messages",
                columns: new[] { "processed_at", "retry_count" });

            migrationBuilder.CreateIndex(
                name: "ix_selections_market_id",
                schema: "events_markets",
                table: "selections",
                column: "market_id");

            migrationBuilder.CreateIndex(
                name: "ix_selections_settlement_result",
                schema: "events_markets",
                table: "selections",
                column: "settlement_result");

            migrationBuilder.CreateIndex(
                name: "ix_settlement_audit_idempotency_key",
                schema: "events_markets",
                table: "settlement_audit",
                column: "idempotency_key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_settlement_audit_market_id",
                schema: "events_markets",
                table: "settlement_audit",
                column: "market_id");

            migrationBuilder.CreateIndex(
                name: "ix_settlement_audit_settled_at",
                schema: "events_markets",
                table: "settlement_audit",
                column: "settled_at");

            migrationBuilder.CreateIndex(
                name: "ix_transactions_created_at",
                schema: "events_markets",
                table: "transactions",
                column: "created_at");

            migrationBuilder.CreateIndex(
                name: "ix_transactions_reference_id",
                schema: "events_markets",
                table: "transactions",
                column: "reference_id");

            migrationBuilder.CreateIndex(
                name: "ix_transactions_selection_id",
                schema: "events_markets",
                table: "transactions",
                column: "selection_id");

            migrationBuilder.CreateIndex(
                name: "ix_transactions_status",
                schema: "events_markets",
                table: "transactions",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "ix_transactions_wallet_id",
                schema: "events_markets",
                table: "transactions",
                column: "wallet_id");

            migrationBuilder.CreateIndex(
                name: "ix_transactions_wallet_id_created_at",
                schema: "events_markets",
                table: "transactions",
                columns: new[] { "wallet_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ix_wallets_user_id",
                schema: "events_markets",
                table: "wallets",
                column: "user_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_wallets_version",
                schema: "events_markets",
                table: "wallets",
                column: "version");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "dead_letters",
                schema: "events_markets");

            migrationBuilder.DropTable(
                name: "idempotency_keys",
                schema: "events_markets");

            migrationBuilder.DropTable(
                name: "inbox_messages",
                schema: "events_markets");

            migrationBuilder.DropTable(
                name: "outbox_messages",
                schema: "events_markets");

            migrationBuilder.DropTable(
                name: "selections",
                schema: "events_markets");

            migrationBuilder.DropTable(
                name: "settlement_audit",
                schema: "events_markets");

            migrationBuilder.DropTable(
                name: "transactions",
                schema: "events_markets");

            migrationBuilder.DropTable(
                name: "markets",
                schema: "events_markets");

            migrationBuilder.DropTable(
                name: "wallets",
                schema: "events_markets");

            migrationBuilder.DropTable(
                name: "events",
                schema: "events_markets");
        }
    }
}
