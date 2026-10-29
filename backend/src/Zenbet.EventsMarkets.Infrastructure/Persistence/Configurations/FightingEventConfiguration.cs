namespace Zenbet.EventsMarkets.Infrastructure.Persistence.Configurations;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Zenbet.EventsMarkets.Domain.Aggregates;

public sealed class FightingEventConfiguration : IEntityTypeConfiguration<FightingEvent>
{
    public void Configure(EntityTypeBuilder<FightingEvent> builder)
    {
        builder.ToTable("fighting_events", "events_markets");
        builder.HasKey(item => item.Id);
        builder.Property(item => item.Id).HasColumnName("id");
        builder.Property(item => item.Name).HasColumnName("name").HasMaxLength(160).IsRequired();
        builder.Property(item => item.Slug).HasColumnName("slug").HasMaxLength(160).IsRequired();
        builder.Property(item => item.StartTime).HasColumnName("start_time").IsRequired();
        builder.Property(item => item.PromotionId).HasColumnName("promotion_id").IsRequired();
        builder.HasIndex(item => new { item.PromotionId, item.StartTime })
            .HasDatabaseName("ix_fighting_events_promotion_start_time");
        builder.HasIndex(item => new { item.PromotionId, item.Slug }).IsUnique()
            .HasDatabaseName("ux_fighting_events_promotion_slug");

        builder.HasData(
            new FightingEvent(Guid.Parse("20000000-0000-0000-0000-000000000001"), "UFC 334: Gane vs Hokit", "ufc-334-gane-vs-hokit", new DateTimeOffset(2026, 11, 14, 22, 0, 0, TimeSpan.Zero), Guid.Parse("10000000-0000-0000-0000-000000000001")),
            new FightingEvent(Guid.Parse("20000000-0000-0000-0000-000000000002"), "Cage Warriors Q4 Simulated Showcase", "cage-warriors-q4-showcase", new DateTimeOffset(2026, 11, 21, 18, 0, 0, TimeSpan.Zero), Guid.Parse("10000000-0000-0000-0000-000000000002")),
            new FightingEvent(Guid.Parse("20000000-0000-0000-0000-000000000003"), "Jungle Fight Q4 Simulated Showcase", "jungle-fight-q4-showcase", new DateTimeOffset(2026, 12, 5, 20, 0, 0, TimeSpan.Zero), Guid.Parse("10000000-0000-0000-0000-000000000003")),
            new FightingEvent(Guid.Parse("20000000-0000-0000-0000-000000000004"), "ZenBet Regional Amateur Showcase (simulated)", "zenbet-regional-amateur-showcase", new DateTimeOffset(2026, 12, 12, 18, 0, 0, TimeSpan.Zero), Guid.Parse("10000000-0000-0000-0000-000000000004")),
            new FightingEvent(Guid.Parse("20000000-0000-0000-0000-000000000005"), "PFL Q4 Simulated Championship Showcase", "pfl-q4-championship-showcase", new DateTimeOffset(2026, 11, 21, 22, 0, 0, TimeSpan.Zero), Guid.Parse("10000000-0000-0000-0000-000000000005")),
            new FightingEvent(Guid.Parse("20000000-0000-0000-0000-000000000006"), "ONE Friday Fights 177", "one-friday-fights-177", new DateTimeOffset(2026, 11, 6, 12, 30, 0, TimeSpan.Zero), Guid.Parse("10000000-0000-0000-0000-000000000006")),
            new FightingEvent(Guid.Parse("20000000-0000-0000-0000-000000000007"), "OKTAGON 100: Prague", "oktagon-100-prague", new DateTimeOffset(2026, 12, 29, 17, 0, 0, TimeSpan.Zero), Guid.Parse("10000000-0000-0000-0000-000000000007")),
            new FightingEvent(Guid.Parse("20000000-0000-0000-0000-000000000008"), "UFC Fight Night: Bonfim vs. Brady", "ufc-fight-night-bonfim-vs-brady", new DateTimeOffset(2026, 11, 7, 22, 0, 0, TimeSpan.Zero), Guid.Parse("10000000-0000-0000-0000-000000000001")));
    }
}
