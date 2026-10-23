namespace Zenbet.EventsMarkets.Infrastructure.Persistence.Configurations;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Zenbet.EventsMarkets.Domain.Aggregates;
using Zenbet.EventsMarkets.Domain.ValueObjects;
using Zenbet.EventsMarkets.Domain.Enums;

public sealed class SelectionConfiguration : IEntityTypeConfiguration<Selection>
{
    public void Configure(EntityTypeBuilder<Selection> builder)
    {
        builder.ToTable("selections", "events_markets");

        builder.HasKey(s => s.Id);

        builder.Property(s => s.Id)
            .HasConversion(
                id => id.Value,
                guid => SelectionId.From(guid))
            .HasColumnName("id")
            .IsRequired();

        builder.Property<MarketId>("MarketId")
            .HasConversion(
                id => id.Value,
                guid => MarketId.From(guid))
            .HasColumnName("market_id")
            .IsRequired();

        builder.Property(s => s.Name)
            .HasColumnName("name")
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(s => s.Code)
            .HasColumnName("code")
            .HasMaxLength(40);

        builder.Property(s => s.DisplayOrder)
            .HasColumnName("display_order")
            .HasDefaultValue(0)
            .IsRequired();

        builder.ComplexProperty(s => s.CurrentOdd, odd =>
        {
            odd.Property(o => o.Value)
                .HasColumnName("current_odds_value")
                .HasPrecision(7, 4)
                .IsRequired();

            odd.Property(o => o.Timestamp)
                .HasColumnName("current_odds_timestamp")
                .IsRequired();

            odd.Property(o => o.Provider)
                .HasColumnName("current_odds_provider")
                .HasMaxLength(50)
                .IsRequired();
        });

        builder.Property(s => s.SettlementResult)
            .HasColumnName("settlement_result")
            .HasConversion<int>();

        builder.HasIndex("MarketId").HasDatabaseName("ix_selections_market_id");
        builder.HasIndex(s => s.SettlementResult).HasDatabaseName("ix_selections_settlement_result");
    }
}
