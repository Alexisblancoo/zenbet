namespace Zenbet.EventsMarkets.Infrastructure.Persistence.Configurations;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Zenbet.EventsMarkets.Domain.Aggregates;

public sealed class FightResultProposalConfiguration : IEntityTypeConfiguration<FightResultProposal>
{
    public void Configure(EntityTypeBuilder<FightResultProposal> builder)
    {
        builder.ToTable("fight_result_proposals", "events_markets");
        builder.HasKey(p => p.Id);
        builder.Property(p => p.Id).HasColumnName("id");
        builder.Property(p => p.EventId).HasColumnName("event_id").IsRequired();
        builder.Property(p => p.Status).HasColumnName("status").HasConversion<int>().IsRequired();
        builder.Property(p => p.WinnerCorner).HasColumnName("winner_corner").HasConversion<int?>();
        builder.Property(p => p.Method).HasColumnName("method").HasConversion<int?>();
        builder.Property(p => p.Round).HasColumnName("round");
        builder.Property(p => p.MethodCorroborated).HasColumnName("method_corroborated").IsRequired();
        builder.Property(p => p.Detail).HasColumnName("detail").HasMaxLength(1000).IsRequired();
        builder.Property(p => p.SourcesSummary).HasColumnName("sources_summary").HasMaxLength(2000).IsRequired();
        builder.Property(p => p.CreatedAt).HasColumnName("created_at").IsRequired();
        builder.Property(p => p.UpdatedAt).HasColumnName("updated_at").IsRequired();
        builder.Property(p => p.ReviewedBy).HasColumnName("reviewed_by").HasMaxLength(200);
        builder.Property(p => p.ReviewedAt).HasColumnName("reviewed_at");
        builder.Property(p => p.ReviewNote).HasColumnName("review_note").HasMaxLength(500);
        builder.Ignore(p => p.IsTerminal);

        // One suggestion per bout: the worker updates it in place.
        builder.HasIndex(p => p.EventId).IsUnique().HasDatabaseName("ux_fight_result_proposals_event_id");
        builder.HasIndex(p => p.Status).HasDatabaseName("ix_fight_result_proposals_status");
    }
}
