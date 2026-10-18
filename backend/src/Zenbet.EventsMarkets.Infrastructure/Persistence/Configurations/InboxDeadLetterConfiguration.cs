namespace Zenbet.EventsMarkets.Infrastructure.Persistence.Configurations;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Zenbet.EventsMarkets.Infrastructure.Persistence.Outbox;

public sealed class InboxMessageConfiguration : IEntityTypeConfiguration<InboxMessage>
{
    public void Configure(EntityTypeBuilder<InboxMessage> builder)
    {
        builder.ToTable("inbox_messages", "events_markets");

        builder.HasKey(i => i.Id);

        builder.Property(i => i.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(i => i.Source)
            .HasColumnName("source")
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(i => i.MessageType)
            .HasColumnName("message_type")
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(i => i.Payload)
            .HasColumnName("payload")
            .HasColumnType("jsonb")
            .IsRequired();

        builder.Property(i => i.Headers)
            .HasColumnName("headers")
            .HasColumnType("jsonb");

        builder.Property(i => i.ReceivedAt)
            .HasColumnName("received_at")
            .IsRequired();

        builder.Property(i => i.ProcessedAt)
            .HasColumnName("processed_at");

        builder.Property(i => i.RetryCount)
            .HasColumnName("retry_count")
            .HasDefaultValue(0)
            .IsRequired();

        builder.Property(i => i.LastError)
            .HasColumnName("last_error")
            .HasMaxLength(2000);

        builder.HasIndex(i => i.ProcessedAt).HasDatabaseName("ix_inbox_processed_at");
        builder.HasIndex(i => new { i.ProcessedAt, i.RetryCount }).HasDatabaseName("ix_inbox_unprocessed");
        builder.HasIndex(i => i.Source).HasDatabaseName("ix_inbox_source");
    }
}

public sealed class DeadLetterConfiguration : IEntityTypeConfiguration<DeadLetterEntry>
{
    public void Configure(EntityTypeBuilder<DeadLetterEntry> builder)
    {
        builder.ToTable("dead_letters", "events_markets");

        builder.HasKey(d => d.Id);

        builder.Property(d => d.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(d => d.OriginalTable)
            .HasColumnName("original_table")
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(d => d.OriginalId)
            .HasColumnName("original_id")
            .IsRequired();

        builder.Property(d => d.Payload)
            .HasColumnName("payload")
            .HasColumnType("jsonb")
            .IsRequired();

        builder.Property(d => d.Error)
            .HasColumnName("error")
            .HasMaxLength(4000)
            .IsRequired();

        builder.Property(d => d.FailedAt)
            .HasColumnName("failed_at")
            .IsRequired();

        builder.Property(d => d.RetryCount)
            .HasColumnName("retry_count")
            .IsRequired();

        builder.HasIndex(d => d.FailedAt).HasDatabaseName("ix_dead_letters_failed_at");
        builder.HasIndex(d => d.OriginalTable).HasDatabaseName("ix_dead_letters_original_table");
    }
}