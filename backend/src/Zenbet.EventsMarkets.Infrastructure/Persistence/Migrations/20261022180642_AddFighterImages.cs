using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Zenbet.EventsMarkets.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddFighterImages : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "blue_image_url",
                schema: "events_markets",
                table: "events",
                type: "character varying(512)",
                maxLength: 512,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "red_image_url",
                schema: "events_markets",
                table: "events",
                type: "character varying(512)",
                maxLength: 512,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "blue_image_url",
                schema: "events_markets",
                table: "events");

            migrationBuilder.DropColumn(
                name: "red_image_url",
                schema: "events_markets",
                table: "events");
        }
    }
}
