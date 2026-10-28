namespace Zenbet.EventsMarkets.Infrastructure.Persistence.Configurations;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Zenbet.EventsMarkets.Domain.Football;

public sealed class FootballMatchConfiguration : IEntityTypeConfiguration<FootballMatch>
{
    public void Configure(EntityTypeBuilder<FootballMatch> builder)
    {
        builder.ToTable("football_matches", "events_markets");

        builder.HasKey(m => m.Id);

        builder.Property(m => m.Id)
            .HasColumnName("id")
            .HasMaxLength(64)
            .IsRequired();

        builder.Property(m => m.EventId)
            .HasColumnName("event_id")
            .IsRequired();

        builder.Property(m => m.LeagueId)
            .HasColumnName("league_id")
            .HasMaxLength(64)
            .IsRequired();

        builder.Property(m => m.HomeTeamId)
            .HasColumnName("home_team_id")
            .HasMaxLength(64)
            .IsRequired();

        builder.Property(m => m.AwayTeamId)
            .HasColumnName("away_team_id")
            .HasMaxLength(64)
            .IsRequired();

        builder.Property(m => m.KickoffTimeUtc)
            .HasColumnName("kickoff_time_utc")
            .IsRequired();

        builder.Property(m => m.Status)
            .HasColumnName("status")
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(m => m.HomeScore)
            .HasColumnName("home_score")
            .IsRequired();

        builder.Property(m => m.AwayScore)
            .HasColumnName("away_score")
            .IsRequired();

        builder.Property(m => m.CurrentMinute)
            .HasColumnName("current_minute");

        builder.Property(m => m.Period)
            .HasColumnName("period")
            .HasMaxLength(30);

        builder.Property(m => m.IsRunning)
            .HasColumnName("is_running")
            .IsRequired();

        builder.Property(m => m.Stadium)
            .HasColumnName("stadium")
            .HasMaxLength(150);

        builder.Property(m => m.City)
            .HasColumnName("city")
            .HasMaxLength(100);

        builder.Property(m => m.Referee)
            .HasColumnName("referee")
            .HasMaxLength(100);

        builder.Property(m => m.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        builder.HasOne(m => m.League)
            .WithMany()
            .HasForeignKey(m => m.LeagueId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(m => m.HomeTeam)
            .WithMany()
            .HasForeignKey(m => m.HomeTeamId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(m => m.AwayTeam)
            .WithMany()
            .HasForeignKey(m => m.AwayTeamId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(m => m.Markets)
            .WithOne()
            .HasForeignKey(m => m.MatchId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
