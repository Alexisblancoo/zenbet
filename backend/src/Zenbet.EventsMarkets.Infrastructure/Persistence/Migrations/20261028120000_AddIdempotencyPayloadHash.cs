using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Zenbet.EventsMarkets.Infrastructure.Persistence;

#nullable disable

namespace Zenbet.EventsMarkets.Infrastructure.Persistence.Migrations;

[DbContext(typeof(EventsMarketsDbContext))]
[Migration("20261028120000_AddIdempotencyPayloadHash")]
public sealed class AddIdempotencyPayloadHash : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "payload_hash",
            schema: "events_markets",
            table: "idempotency_keys",
            type: "character varying(64)",
            maxLength: 64,
            nullable: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "payload_hash",
            schema: "events_markets",
            table: "idempotency_keys");
    }
}
