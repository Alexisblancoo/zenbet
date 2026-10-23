namespace Zenbet.EventsMarkets.Infrastructure.Persistence.Configurations;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Zenbet.EventsMarkets.Domain.Aggregates;
using Zenbet.EventsMarkets.Domain.ValueObjects;
using Zenbet.EventsMarkets.Domain.Enums;

public sealed class MarketConfiguration : IEntityTypeConfiguration<Market>
{
    public void Configure(EntityTypeBuilder<Market> builder)
    {
        builder.ToTable("markets", "events_markets");

        builder.HasKey(m => m.Id);

        builder.Property(m => m.Id)
            .HasConversion(
                id => id.Value,
                guid => MarketId.From(guid))
            .HasColumnName("id")
            .IsRequired();

        builder.Property(m => m.EventId)
            .HasConversion(
                id => id.Value,
                guid => EventId.From(guid))
            .HasColumnName("event_id")
            .IsRequired();

        builder.Property(m => m.Name)
            .HasColumnName("name")
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(m => m.Type)
            .HasColumnName("type")
            .HasConversion<int>()
            .IsRequired();

        builder.Property(m => m.Status)
            .HasColumnName("status")
            .HasConversion<int>()
            .HasDefaultValue(MarketStatus.Open)
            .IsRequired();

        builder.Property(m => m.Line)
            .HasColumnName("line")
            .HasPrecision(4, 1);

        builder.Property(m => m.DisplayOrder)
            .HasColumnName("display_order")
            .HasDefaultValue(0)
            .IsRequired();

        builder.OwnsOne(m => m.Provenance, provenance =>
        {
            provenance.Property(p => p.Provider)
                .HasColumnName("source_provider")
                .HasMaxLength(80);

            provenance.Property(p => p.Kind)
                .HasColumnName("source_kind")
                .HasConversion<int>();

            provenance.Property(p => p.Url)
                .HasColumnName("source_url")
                .HasMaxLength(500);

            provenance.Property(p => p.ObservedAt)
                .HasColumnName("source_observed_at");

            provenance.Property(p => p.Note)
                .HasColumnName("source_note")
                .HasMaxLength(240);
        });

        builder.Navigation(m => m.Provenance)
            .IsRequired(false);

        builder.Property(m => m.MarketSettlementResult)
            .HasField("_settlementResultValue")
            .HasColumnName("settlement_result")
            .HasConversion<int>();

        builder.Property(m => m.WinnerSelectionId)
            .HasConversion(
                id => id.HasValue ? id.Value.Value : (Guid?)null,
                guid => guid.HasValue ? SelectionId.From(guid.Value) : (SelectionId?)null)
            .HasColumnName("winner_selection_id");

        builder.HasOne<Event>()
            .WithMany(e => e.Markets)
            .HasForeignKey(m => m.EventId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(m => m.Selections)
            .WithOne()
            .HasForeignKey("MarketId")
            .OnDelete(DeleteBehavior.Cascade);

        builder.Navigation(m => m.Selections)
            .UsePropertyAccessMode(PropertyAccessMode.Field);

        builder.HasIndex(m => m.EventId).HasDatabaseName("ix_markets_event_id");
        builder.HasIndex(m => m.Status).HasDatabaseName("ix_markets_status");
        builder.HasIndex(m => new { m.EventId, m.Status }).HasDatabaseName("ix_markets_event_id_status");

        builder.Ignore(m => m.DomainEvents);
    }
}
