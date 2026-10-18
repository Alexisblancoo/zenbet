namespace Zenbet.EventsMarkets.Infrastructure.Persistence.Configurations;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Zenbet.EventsMarkets.Domain.ValueObjects;
using Zenbet.EventsMarkets.Domain.Enums;
using Zenbet.EventsMarkets.Infrastructure.Persistence.Outbox;

public sealed class SettlementAuditConfiguration : IEntityTypeConfiguration<SettlementAuditEntry>
{
    public void Configure(EntityTypeBuilder<SettlementAuditEntry> builder)
    {
        builder.ToTable("settlement_audit", "events_markets");

        builder.HasKey(a => a.Id);

        builder.Property(a => a.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(a => a.MarketId)
            .HasConversion(
                id => id.Value,
                guid => MarketId.From(guid))
            .HasColumnName("market_id")
            .IsRequired();

        builder.Property(a => a.WinnerSelectionId)
            .HasConversion(
                id => id.Value,
                guid => SelectionId.From(guid))
            .HasColumnName("winner_selection_id")
            .IsRequired();

        builder.Property(a => a.Result)
            .HasColumnName("result")
            .HasConversion<int>()
            .IsRequired();

        builder.Property(a => a.SettledBy)
            .HasColumnName("settled_by")
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(a => a.SettledAt)
            .HasColumnName("settled_at")
            .IsRequired();

        builder.Property(a => a.IdempotencyKey)
            .HasColumnName("idempotency_key")
            .HasMaxLength(64)
            .IsRequired();

        builder.HasIndex(a => a.MarketId).HasDatabaseName("ix_settlement_audit_market_id");
        builder.HasIndex(a => a.IdempotencyKey).IsUnique().HasDatabaseName("ix_settlement_audit_idempotency_key");
        builder.HasIndex(a => a.SettledAt).HasDatabaseName("ix_settlement_audit_settled_at");
    }
}