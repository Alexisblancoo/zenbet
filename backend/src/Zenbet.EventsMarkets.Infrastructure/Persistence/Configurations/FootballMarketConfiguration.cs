namespace Zenbet.EventsMarkets.Infrastructure.Persistence.Configurations;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Zenbet.EventsMarkets.Domain.Football;

public sealed class FootballMarketConfiguration : IEntityTypeConfiguration<FootballMarket>
{
    public void Configure(EntityTypeBuilder<FootballMarket> builder)
    {
        builder.ToTable("football_markets", "events_markets");

        builder.HasKey(m => m.Id);

        builder.Property(m => m.Id)
            .HasColumnName("id")
            .HasMaxLength(80)
            .IsRequired();

        builder.Property(m => m.MatchId)
            .HasColumnName("match_id")
            .HasMaxLength(64)
            .IsRequired();

        builder.Property(m => m.MarketId)
            .HasColumnName("market_id")
            .IsRequired();

        builder.Property(m => m.TypeKey)
            .HasColumnName("type_key")
            .HasMaxLength(40)
            .IsRequired();

        builder.Property(m => m.Name)
            .HasColumnName("name")
            .HasMaxLength(150)
            .IsRequired();

        builder.Property(m => m.Line)
            .HasColumnName("line")
            .HasPrecision(5, 2);

        builder.Property(m => m.Status)
            .HasColumnName("status")
            .HasMaxLength(20)
            .IsRequired();

        builder.HasMany(m => m.Selections)
            .WithOne()
            .HasForeignKey(s => s.MarketId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
