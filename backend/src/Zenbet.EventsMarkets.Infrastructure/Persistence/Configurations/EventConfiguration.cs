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