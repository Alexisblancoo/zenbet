namespace Zenbet.EventsMarkets.Infrastructure.Persistence.Configurations;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Zenbet.EventsMarkets.Domain.Football;

public sealed class FootballTeamConfiguration : IEntityTypeConfiguration<FootballTeam>
{
    public void Configure(EntityTypeBuilder<FootballTeam> builder)
    {
        builder.ToTable("football_teams", "events_markets");

        builder.HasKey(t => t.Id);

        builder.Property(t => t.Id)
            .HasColumnName("id")
            .HasMaxLength(64)
            .IsRequired();

        builder.Property(t => t.Name)
            .HasColumnName("name")
            .HasMaxLength(150)
            .IsRequired();

        builder.Property(t => t.ShortName)
            .HasColumnName("short_name")
            .HasMaxLength(80)
            .IsRequired();

        builder.Property(t => t.Code)
            .HasColumnName("code")
            .HasMaxLength(10)
            .IsRequired();

        builder.Property(t => t.TeamCrestUrl)
            .HasColumnName("team_crest_url")
            .HasMaxLength(512)
            .IsRequired();

        builder.Property(t => t.Country)
            .HasColumnName("country")
            .HasMaxLength(80)
            .IsRequired();

        builder.Property(t => t.CountryCode)
            .HasColumnName("country_code")
            .HasMaxLength(10)
            .IsRequired();

        builder.Property(t => t.CyrillicName)
            .HasColumnName("cyrillic_name")
            .HasMaxLength(150);
    }
}
