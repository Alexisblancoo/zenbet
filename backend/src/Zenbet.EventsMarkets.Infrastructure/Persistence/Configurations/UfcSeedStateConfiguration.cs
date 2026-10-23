namespace Zenbet.EventsMarkets.Infrastructure.Persistence.Configurations;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Zenbet.EventsMarkets.Infrastructure.Persistence.Seeding;

public sealed class UfcSeedStateConfiguration : IEntityTypeConfiguration<UfcSeedState>
{
    public void Configure(EntityTypeBuilder<UfcSeedState> builder)
    {
        builder.ToTable("ufc_seed_states", "events_markets");

        builder.HasKey(state => state.Key);

        builder.Property(state => state.Key)
            .HasColumnName("key")
            .HasMaxLength(80)
            .IsRequired();

        builder.Property(state => state.Version)
            .HasColumnName("version")
            .IsRequired();

        builder.Property(state => state.AppliedAt)
            .HasColumnName("applied_at")
            .IsRequired();

        builder.Property(state => state.SourceObservedAt)
            .HasColumnName("source_observed_at")
            .IsRequired();
    }
}
