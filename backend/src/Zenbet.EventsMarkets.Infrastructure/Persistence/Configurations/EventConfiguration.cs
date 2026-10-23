namespace Zenbet.EventsMarkets.Infrastructure.Persistence.Configurations;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Zenbet.EventsMarkets.Domain.Aggregates;
using Zenbet.EventsMarkets.Domain.ValueObjects;
using Zenbet.EventsMarkets.Domain.Enums;

public sealed class EventConfiguration : IEntityTypeConfiguration<Event>
{
    public void Configure(EntityTypeBuilder<Event> builder)
    {
        builder.ToTable("events", "events_markets");

        builder.HasKey(e => e.Id);

        builder.Property(e => e.Id)
            .HasConversion(
                id => id.Value,
                guid => EventId.From(guid))
            .HasColumnName("id")
            .IsRequired();

        builder.Property(e => e.Name)
            .HasColumnName("name")
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(e => e.SportType)
            .HasColumnName("sport_type")
            .HasConversion<int>()
            .IsRequired();

        builder.Property(e => e.StartTime)
            .HasColumnName("start_time")
            .IsRequired();

        builder.Property(e => e.Competition)
            .HasColumnName("competition")
            .HasMaxLength(200);

        builder.Property(e => e.Status)
            .HasColumnName("status")
            .HasConversion<int>()
            .HasDefaultValue(EventStatus.Scheduled)
            .IsRequired();

        builder.OwnsOne(e => e.Bout, bout =>
        {
            bout.Property(b => b.Division)
                .HasColumnName("weight_division")
                .HasConversion<string>()
                .HasMaxLength(32);

            bout.Property(b => b.ScheduledRounds)
                .HasColumnName("scheduled_rounds");

            bout.Property(b => b.IsTitleFight)
                .HasColumnName("is_title_fight");

            bout.Property(b => b.Billing)
                .HasColumnName("billing")
                .HasConversion<string>()
                .HasMaxLength(24);

            bout.Property(b => b.BillingOrder)
                .HasColumnName("billing_order");

            bout.Property(b => b.Venue)
                .HasColumnName("venue")
                .HasMaxLength(160);

            bout.Property(b => b.Location)
                .HasColumnName("location")
                .HasMaxLength(160);

            bout.OwnsOne(b => b.Red, red =>
            {
                red.Property(f => f.Id).HasColumnName("red_fighter_id").HasMaxLength(80);
                red.Property(f => f.Name).HasColumnName("red_fighter_name").HasMaxLength(120);
                red.Property(f => f.CountryCode).HasColumnName("red_country_code").HasMaxLength(8);
                red.Property(f => f.Country).HasColumnName("red_country").HasMaxLength(80);
                red.Property(f => f.Record).HasColumnName("red_record").HasMaxLength(20);
                red.Property(f => f.Rank).HasColumnName("red_rank").HasMaxLength(8);
                red.Property(f => f.ImageUrl).HasColumnName("red_image_url").HasMaxLength(512);
                red.Property(f => f.Division)
                    .HasColumnName("red_division")
                    .HasConversion<string>()
                    .HasMaxLength(32);
            });

            bout.OwnsOne(b => b.Blue, blue =>
            {
                blue.Property(f => f.Id).HasColumnName("blue_fighter_id").HasMaxLength(80);
                blue.Property(f => f.Name).HasColumnName("blue_fighter_name").HasMaxLength(120);
                blue.Property(f => f.CountryCode).HasColumnName("blue_country_code").HasMaxLength(8);
                blue.Property(f => f.Country).HasColumnName("blue_country").HasMaxLength(80);
                blue.Property(f => f.Record).HasColumnName("blue_record").HasMaxLength(20);
                blue.Property(f => f.Rank).HasColumnName("blue_rank").HasMaxLength(8);
                blue.Property(f => f.ImageUrl).HasColumnName("blue_image_url").HasMaxLength(512);
                blue.Property(f => f.Division)
                    .HasColumnName("blue_division")
                    .HasConversion<string>()
                    .HasMaxLength(32);
            });
        });

        builder.Property(e => e.Version)
            .HasColumnName("version")
            .IsRequired()
            .IsConcurrencyToken(); // Optimistic concurrency

        builder.HasIndex(e => e.StartTime).HasDatabaseName("ix_events_start_time");
        builder.HasIndex(e => e.Status).HasDatabaseName("ix_events_status");
        builder.HasIndex(e => e.SportType).HasDatabaseName("ix_events_sport_type");
        builder.HasIndex(e => new { e.Status, e.StartTime }).HasDatabaseName("ix_events_status_start_time");

        // Ignore domain events collection
        builder.Ignore(e => e.DomainEvents);
    }
}