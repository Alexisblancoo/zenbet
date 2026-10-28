namespace Zenbet.EventsMarkets.Infrastructure.Persistence.Configurations;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Zenbet.EventsMarkets.Domain.Football;

public sealed class FootballSelectionConfiguration : IEntityTypeConfiguration<FootballSelection>
{
    public void Configure(EntityTypeBuilder<FootballSelection> builder)
    {
        builder.ToTable("football_selections", "events_markets");

        builder.HasKey(s => s.Id);

        builder.Property(s => s.Id)
            .HasColumnName("id")
            .HasMaxLength(80)
            .IsRequired();

        builder.Property(s => s.MarketId)
            .HasColumnName("market_id")
            .HasMaxLength(80)
            .IsRequired();

        builder.Property(s => s.SelectionId)
            .HasColumnName("selection_id")
            .IsRequired();

        builder.Property(s => s.Name)
            .HasColumnName("name")
            .HasMaxLength(150)
            .IsRequired();

        builder.Property(s => s.Code)
            .HasColumnName("code")
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(s => s.DecimalOdds)
            .HasColumnName("decimal_odds")
            .HasPrecision(6, 3)
            .IsRequired();

        builder.Property(s => s.AmericanOdds)
            .HasColumnName("american_odds")
            .HasMaxLength(10);

        builder.Property(s => s.Line)
            .HasColumnName("line")
            .HasPrecision(5, 2);

        builder.Property(s => s.Status)
            .HasColumnName("status")
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(s => s.CyrillicLabel)
            .HasColumnName("cyrillic_label")
            .HasMaxLength(40);
    }
}
