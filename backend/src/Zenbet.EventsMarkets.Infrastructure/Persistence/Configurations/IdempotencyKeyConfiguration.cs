namespace Zenbet.EventsMarkets.Infrastructure.Persistence.Configurations;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Zenbet.EventsMarkets.Infrastructure.Persistence.Outbox;

public sealed class IdempotencyKeyConfiguration : IEntityTypeConfiguration<IdempotencyKey>
{
    public void Configure(EntityTypeBuilder<IdempotencyKey> builder)
    {
        builder.ToTable("idempotency_keys", "events_markets");

        builder.HasKey(k => k.Key);

        builder.Property(k => k.Key)
            .HasColumnName("key")
            .HasMaxLength(64)
            .IsRequired();

        builder.Property(k => k.CommandType)
            .HasColumnName("command_type")
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(k => k.PayloadHash)
            .HasColumnName("payload_hash")
            .HasMaxLength(64);

        builder.Property(k => k.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        builder.Property(k => k.ExpiresAt)
            .HasColumnName("expires_at")
            .IsRequired();

        builder.HasIndex(k => k.ExpiresAt).HasDatabaseName("ix_idempotency_expires_at");
    }
}
