namespace Zenbet.EventsMarkets.Infrastructure.Persistence.Configurations;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Zenbet.EventsMarkets.Infrastructure.Persistence.Outbox;

public sealed class OutboxMessageConfiguration : IEntityTypeConfiguration<OutboxMessage>
{
    public void Configure(EntityTypeBuilder<OutboxMessage> builder)
    {
        builder.ToTable("outbox_messages", "events_markets");

        builder.HasKey(o => o.Id);

        builder.Property(o => o.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(o => o.Type)
            .HasColumnName("type")
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(o => o.Payload)
            .HasColumnName("payload")
            .HasColumnType("jsonb")
            .IsRequired();

        builder.Property(o => o.CorrelationId)
            .HasColumnName("correlation_id")
            .IsRequired();

        builder.Property(o => o.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        builder.Property(o => o.ProcessedAt)
            .HasColumnName("processed_at");

        builder.Property(o => o.RetryCount)
            .HasColumnName("retry_count")
            .HasDefaultValue(0)
            .IsRequired();

        builder.Property(o => o.LastError)
            .HasColumnName("last_error")
            .HasMaxLength(2000);

        builder.HasIndex(o => o.ProcessedAt).HasDatabaseName("ix_outbox_processed_at");
        builder.HasIndex(o => new { o.ProcessedAt, o.RetryCount }).HasDatabaseName("ix_outbox_unprocessed");
        builder.HasIndex(o => o.CorrelationId).HasDatabaseName("ix_outbox_correlation_id");
    }
}