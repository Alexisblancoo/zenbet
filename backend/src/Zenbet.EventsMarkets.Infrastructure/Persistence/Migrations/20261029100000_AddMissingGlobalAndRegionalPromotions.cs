using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Zenbet.EventsMarkets.Infrastructure.Persistence;

#nullable disable

namespace Zenbet.EventsMarkets.Infrastructure.Persistence.Migrations;

public partial class AddMissingGlobalAndRegionalPromotions : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        // These legacy UFC seed cards were outside the requested Q4 seed window.
        // Keep their existing bout and market IDs, but reschedule them as demo data.
        migrationBuilder.Sql("""
            UPDATE events_markets.events
            SET competition = 'UFC Q4 Simulated Showcase', start_time = start_time + INTERVAL '28 days'
            WHERE competition = 'UFC 333' AND start_time >= TIMESTAMPTZ '2026-10-24 00:00:00+00'
                AND start_time < TIMESTAMPTZ '2026-10-25 00:00:00+00';
            UPDATE events_markets.events
            SET competition = 'UFC December Simulated Showcase', start_time = start_time + INTERVAL '35 days'
            WHERE competition = 'UFC Fight Night: Moicano vs. Nolan' AND start_time >= TIMESTAMPTZ '2026-10-31 00:00:00+00'
                AND start_time < TIMESTAMPTZ '2026-11-01 00:00:00+00';
            """);
        // Normalize the previous seed rows for databases that already applied the first promotion migration.
        migrationBuilder.UpdateData(table: "fighting_events", keyColumn: "id",
            keyValue: Guid.Parse("20000000-0000-0000-0000-000000000001"),
            column: "name", value: "UFC 334: Gane vs Hokit", schema: "events_markets");
        migrationBuilder.UpdateData(table: "fighting_events", keyColumn: "id",
            keyValue: Guid.Parse("20000000-0000-0000-0000-000000000001"),
            column: "slug", value: "ufc-334-gane-vs-hokit", schema: "events_markets");
        migrationBuilder.UpdateData(table: "fighting_events", keyColumn: "id",
            keyValue: Guid.Parse("20000000-0000-0000-0000-000000000001"),
            column: "start_time", value: new DateTimeOffset(2026, 11, 14, 22, 0, 0, TimeSpan.Zero), schema: "events_markets");

        migrationBuilder.UpdateData(table: "fighting_events", keyColumn: "id",
            keyValue: Guid.Parse("20000000-0000-0000-0000-000000000002"),
            column: "name", value: "Cage Warriors Q4 Simulated Showcase", schema: "events_markets");
        migrationBuilder.UpdateData(table: "fighting_events", keyColumn: "id",
            keyValue: Guid.Parse("20000000-0000-0000-0000-000000000002"),
            column: "slug", value: "cage-warriors-q4-showcase", schema: "events_markets");
        migrationBuilder.UpdateData(table: "fighting_events", keyColumn: "id",
            keyValue: Guid.Parse("20000000-0000-0000-0000-000000000002"),
            column: "start_time", value: new DateTimeOffset(2026, 11, 21, 18, 0, 0, TimeSpan.Zero), schema: "events_markets");

        migrationBuilder.UpdateData(table: "fighting_events", keyColumn: "id",
            keyValue: Guid.Parse("20000000-0000-0000-0000-000000000003"),
            column: "name", value: "Jungle Fight Q4 Simulated Showcase", schema: "events_markets");
        migrationBuilder.UpdateData(table: "fighting_events", keyColumn: "id",
            keyValue: Guid.Parse("20000000-0000-0000-0000-000000000003"),
            column: "slug", value: "jungle-fight-q4-showcase", schema: "events_markets");
        migrationBuilder.UpdateData(table: "fighting_events", keyColumn: "id",
            keyValue: Guid.Parse("20000000-0000-0000-0000-000000000003"),
            column: "start_time", value: new DateTimeOffset(2026, 12, 5, 20, 0, 0, TimeSpan.Zero), schema: "events_markets");

        migrationBuilder.UpdateData(table: "fighting_events", keyColumn: "id",
            keyValue: Guid.Parse("20000000-0000-0000-0000-000000000004"),
            column: "name", value: "ZenBet Regional Amateur Showcase (simulated)", schema: "events_markets");

        migrationBuilder.InsertData(
            table: "promotions",
            schema: "events_markets",
            columns: ["id", "country_code", "name", "slug", "tier"],
            columnTypes: ["uuid", "character varying(2)", "character varying(120)", "character varying(120)", "integer"],
            values: new object[,]
            {
                { Guid.Parse("10000000-0000-0000-0000-000000000005"), "US", "Professional Fighters League", "pfl", 1 },
                { Guid.Parse("10000000-0000-0000-0000-000000000006"), "SG", "ONE Championship", "one-championship", 1 },
                { Guid.Parse("10000000-0000-0000-0000-000000000007"), "CZ", "OKTAGON MMA", "oktagon-mma", 2 }
            });
        migrationBuilder.InsertData(
            table: "fighting_events",
            schema: "events_markets",
            columns: ["id", "name", "promotion_id", "slug", "start_time"],
            columnTypes: ["uuid", "character varying(160)", "uuid", "character varying(160)", "timestamp with time zone"],
            values: new object[,]
            {
                { Guid.Parse("20000000-0000-0000-0000-000000000005"), "PFL Q4 Simulated Championship Showcase", Guid.Parse("10000000-0000-0000-0000-000000000005"), "pfl-q4-championship-showcase", new DateTimeOffset(2026, 11, 21, 22, 0, 0, TimeSpan.Zero) },
                { Guid.Parse("20000000-0000-0000-0000-000000000006"), "ONE Friday Fights 177", Guid.Parse("10000000-0000-0000-0000-000000000006"), "one-friday-fights-177", new DateTimeOffset(2026, 11, 6, 12, 30, 0, TimeSpan.Zero) },
                { Guid.Parse("20000000-0000-0000-0000-000000000007"), "OKTAGON 100: Prague", Guid.Parse("10000000-0000-0000-0000-000000000007"), "oktagon-100-prague", new DateTimeOffset(2026, 12, 29, 17, 0, 0, TimeSpan.Zero) },
                { Guid.Parse("20000000-0000-0000-0000-000000000008"), "UFC Fight Night: Bonfim vs. Brady", Guid.Parse("10000000-0000-0000-0000-000000000001"), "ufc-fight-night-bonfim-vs-brady", new DateTimeOffset(2026, 11, 7, 22, 0, 0, TimeSpan.Zero) }
            });
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            UPDATE events_markets.events
            SET competition = 'UFC 333', start_time = start_time - INTERVAL '28 days'
            WHERE competition = 'UFC Q4 Simulated Showcase' AND start_time >= TIMESTAMPTZ '2026-11-21 00:00:00+00'
                AND start_time < TIMESTAMPTZ '2026-11-22 00:00:00+00';
            UPDATE events_markets.events
            SET competition = 'UFC Fight Night: Moicano vs. Nolan', start_time = start_time - INTERVAL '35 days'
            WHERE competition = 'UFC December Simulated Showcase' AND start_time >= TIMESTAMPTZ '2026-12-05 00:00:00+00'
                AND start_time < TIMESTAMPTZ '2026-12-06 00:00:00+00';
            """);
        migrationBuilder.UpdateData(table: "fighting_events", keyColumn: "id",
            keyValue: Guid.Parse("20000000-0000-0000-0000-000000000002"),
            column: "name", value: "Cage Warriors Q4 Showcase", schema: "events_markets");
        migrationBuilder.UpdateData(table: "fighting_events", keyColumn: "id",
            keyValue: Guid.Parse("20000000-0000-0000-0000-000000000003"),
            column: "name", value: "Jungle Fight Q4 Showcase", schema: "events_markets");
        migrationBuilder.UpdateData(table: "fighting_events", keyColumn: "id",
            keyValue: Guid.Parse("20000000-0000-0000-0000-000000000004"),
            column: "name", value: "ZenBet Regional Amateur Showcase", schema: "events_markets");
        migrationBuilder.DeleteData(table: "fighting_events", keyColumn: "id", keyValue: Guid.Parse("20000000-0000-0000-0000-000000000005"), schema: "events_markets");
        migrationBuilder.DeleteData(table: "fighting_events", keyColumn: "id", keyValue: Guid.Parse("20000000-0000-0000-0000-000000000006"), schema: "events_markets");
        migrationBuilder.DeleteData(table: "fighting_events", keyColumn: "id", keyValue: Guid.Parse("20000000-0000-0000-0000-000000000007"), schema: "events_markets");
        migrationBuilder.DeleteData(table: "fighting_events", keyColumn: "id", keyValue: Guid.Parse("20000000-0000-0000-0000-000000000008"), schema: "events_markets");
        migrationBuilder.DeleteData(table: "promotions", keyColumn: "id", keyValue: Guid.Parse("10000000-0000-0000-0000-000000000005"), schema: "events_markets");
        migrationBuilder.DeleteData(table: "promotions", keyColumn: "id", keyValue: Guid.Parse("10000000-0000-0000-0000-000000000006"), schema: "events_markets");
        migrationBuilder.DeleteData(table: "promotions", keyColumn: "id", keyValue: Guid.Parse("10000000-0000-0000-0000-000000000007"), schema: "events_markets");
    }
}
