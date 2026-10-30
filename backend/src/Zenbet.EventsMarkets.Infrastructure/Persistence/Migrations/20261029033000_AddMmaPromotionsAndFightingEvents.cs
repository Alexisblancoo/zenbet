using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Zenbet.EventsMarkets.Infrastructure.Persistence;

#nullable disable

namespace Zenbet.EventsMarkets.Infrastructure.Persistence.Migrations;

public partial class AddMmaPromotionsAndFightingEvents : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "promotions",
            schema: "events_markets",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                slug = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                tier = table.Column<int>(type: "integer", nullable: false),
                country_code = table.Column<string>(type: "character varying(2)", maxLength: 2, nullable: false)
            },
            constraints: table => table.PrimaryKey("PK_promotions", x => x.id));

        migrationBuilder.CreateTable(
            name: "fighting_events",
            schema: "events_markets",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                name = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                slug = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                start_time = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                promotion_id = table.Column<Guid>(type: "uuid", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_fighting_events", x => x.id);
                table.ForeignKey("FK_fighting_events_promotions_promotion_id", x => x.promotion_id,
                    principalSchema: "events_markets", principalTable: "promotions", principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateIndex("ux_promotions_slug", "promotions", "slug", schema: "events_markets", unique: true);
        migrationBuilder.CreateIndex("ix_fighting_events_promotion_start_time", "fighting_events", new[] { "promotion_id", "start_time" }, schema: "events_markets");
        migrationBuilder.CreateIndex("ux_fighting_events_promotion_slug", "fighting_events", new[] { "promotion_id", "slug" }, schema: "events_markets", unique: true);

        migrationBuilder.InsertData(
            table: "promotions",
            schema: "events_markets",
            columns: new[] { "id", "country_code", "name", "slug", "tier" },
            columnTypes: new[] { "uuid", "character varying(2)", "character varying(120)", "character varying(120)", "integer" },
            values: new object[,] {
                { Guid.Parse("10000000-0000-0000-0000-000000000001"), "US", "UFC", "ufc", 1 },
                { Guid.Parse("10000000-0000-0000-0000-000000000002"), "GB", "Cage Warriors", "cage-warriors", 2 },
                { Guid.Parse("10000000-0000-0000-0000-000000000003"), "BR", "Jungle Fight", "jungle-fight", 3 },
                { Guid.Parse("10000000-0000-0000-0000-000000000004"), "BO", "ZenBet Regional Development Circuit", "zenbet-regional-development", 4 }
            });
        migrationBuilder.InsertData(
            table: "fighting_events",
            schema: "events_markets",
            columns: new[] { "id", "name", "promotion_id", "slug", "start_time" },
            columnTypes: new[] { "uuid", "character varying(160)", "uuid", "character varying(160)", "timestamp with time zone" },
            values: new object[,] {
                { Guid.Parse("20000000-0000-0000-0000-000000000001"), "UFC 334: Gane vs Hokit", Guid.Parse("10000000-0000-0000-0000-000000000001"), "ufc-334-gane-vs-hokit", new DateTimeOffset(2026, 11, 14, 22, 0, 0, TimeSpan.Zero) },
                { Guid.Parse("20000000-0000-0000-0000-000000000002"), "Cage Warriors Q4 Showcase", Guid.Parse("10000000-0000-0000-0000-000000000002"), "cage-warriors-q4-showcase", new DateTimeOffset(2026, 11, 21, 18, 0, 0, TimeSpan.Zero) },
                { Guid.Parse("20000000-0000-0000-0000-000000000003"), "Jungle Fight Q4 Showcase", Guid.Parse("10000000-0000-0000-0000-000000000003"), "jungle-fight-q4-showcase", new DateTimeOffset(2026, 12, 5, 20, 0, 0, TimeSpan.Zero) },
                { Guid.Parse("20000000-0000-0000-0000-000000000004"), "ZenBet Regional Amateur Showcase", Guid.Parse("10000000-0000-0000-0000-000000000004"), "zenbet-regional-amateur-showcase", new DateTimeOffset(2026, 12, 12, 18, 0, 0, TimeSpan.Zero) }
            });
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable("fighting_events", "events_markets");
        migrationBuilder.DropTable("promotions", "events_markets");
    }
}
