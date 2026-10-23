using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Zenbet.EventsMarkets.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddUserAccounts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "user_accounts",
                schema: "events_markets",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    username = table.Column<string>(type: "character varying(24)", maxLength: 24, nullable: false),
                    normalized_username = table.Column<string>(type: "character varying(24)", maxLength: 24, nullable: false),
                    email = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                    normalized_email = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                    password_hash = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    role = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    terms_accepted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_accounts", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ux_user_accounts_normalized_email",
                schema: "events_markets",
                table: "user_accounts",
                column: "normalized_email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ux_user_accounts_normalized_username",
                schema: "events_markets",
                table: "user_accounts",
                column: "normalized_username",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "user_accounts",
                schema: "events_markets");
        }
    }
}
