namespace Zenbet.EventsMarkets.Infrastructure.Persistence.Configurations;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Zenbet.EventsMarkets.Domain.Aggregates;

public sealed class PromotionConfiguration : IEntityTypeConfiguration<Promotion>
{
    public void Configure(EntityTypeBuilder<Promotion> builder)
    {
        builder.ToTable("promotions", "events_markets");
        builder.HasKey(item => item.Id);
        builder.Property(item => item.Id).HasColumnName("id");
        builder.Property(item => item.Name).HasColumnName("name").HasMaxLength(120).IsRequired();
        builder.Property(item => item.Slug).HasColumnName("slug").HasMaxLength(120).IsRequired();
        builder.Property(item => item.Tier).HasColumnName("tier").HasConversion<int>().IsRequired();
        builder.Property(item => item.CountryCode).HasColumnName("country_code").HasMaxLength(2).IsRequired();
        builder.HasIndex(item => item.Slug).IsUnique().HasDatabaseName("ux_promotions_slug");
        builder.HasMany(item => item.Events)
            .WithOne(item => item.Promotion)
            .HasForeignKey(item => item.PromotionId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.Navigation(item => item.Events).HasField("_events").UsePropertyAccessMode(PropertyAccessMode.Field);

        builder.HasData(
            new Promotion(Guid.Parse("10000000-0000-0000-0000-000000000001"), "UFC", "ufc", Domain.Enums.PromotionTier.Global, "US"),
            new Promotion(Guid.Parse("10000000-0000-0000-0000-000000000002"), "Cage Warriors", "cage-warriors", Domain.Enums.PromotionTier.Regional, "GB"),
            new Promotion(Guid.Parse("10000000-0000-0000-0000-000000000003"), "Jungle Fight", "jungle-fight", Domain.Enums.PromotionTier.Niche, "BR"),
            new Promotion(Guid.Parse("10000000-0000-0000-0000-000000000004"), "ZenBet Regional Development Circuit", "zenbet-regional-development", Domain.Enums.PromotionTier.AmateurOrDevelopmental, "BO"),
            new Promotion(Guid.Parse("10000000-0000-0000-0000-000000000005"), "Professional Fighters League", "pfl", Domain.Enums.PromotionTier.Global, "US"),
            new Promotion(Guid.Parse("10000000-0000-0000-0000-000000000006"), "ONE Championship", "one-championship", Domain.Enums.PromotionTier.Global, "SG"),
            new Promotion(Guid.Parse("10000000-0000-0000-0000-000000000007"), "OKTAGON MMA", "oktagon-mma", Domain.Enums.PromotionTier.Regional, "CZ"));
    }
}
