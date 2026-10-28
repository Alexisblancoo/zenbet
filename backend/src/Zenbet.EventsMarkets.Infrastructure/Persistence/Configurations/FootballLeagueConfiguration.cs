namespace Zenbet.EventsMarkets.Infrastructure.Persistence.Configurations;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Zenbet.EventsMarkets.Domain.Football;

public sealed class FootballLeagueConfiguration : IEntityTypeConfiguration<FootballLeague>
{
    public void Configure(EntityTypeBuilder<FootballLeague> builder)
    {
        builder.ToTable("football_leagues", "events_markets");

        builder.HasKey(l => l.Id);

        builder.Property(l => l.Id)
            .HasColumnName("id")
            .HasMaxLength(64)
            .IsRequired();

        builder.Property(l => l.Name)
            .HasColumnName("name")
            .HasMaxLength(150)
            .IsRequired();

        builder.Property(l => l.ShortName)
            .HasColumnName("short_name")
            .HasMaxLength(64)
            .IsRequired();

        builder.Property(l => l.Country)
            .HasColumnName("country")
            .HasMaxLength(80)
            .IsRequired();

        builder.Property(l => l.CountryCode)
            .HasColumnName("country_code")
            .HasMaxLength(10)
            .IsRequired();

        builder.Property(l => l.Season)
            .HasColumnName("season")
            .HasMaxLength(32)
            .IsRequired();

        builder.Property(l => l.Matchday)
            .HasColumnName("matchday")
            .HasMaxLength(64);

        builder.Property(l => l.LeagueLogoUrl)
            .HasColumnName("league_logo_url")
            .HasMaxLength(512);

        builder.Property(l => l.CyrillicName)
            .HasColumnName("cyrillic_name")
            .HasMaxLength(150);
    }
}
