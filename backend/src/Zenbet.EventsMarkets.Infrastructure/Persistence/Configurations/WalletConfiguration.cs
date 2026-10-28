namespace Zenbet.EventsMarkets.Infrastructure.Persistence.Configurations;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Zenbet.EventsMarkets.Domain.Aggregates;
using Zenbet.EventsMarkets.Domain.ValueObjects;
using Zenbet.EventsMarkets.Domain.Enums;

public sealed class WalletConfiguration : IEntityTypeConfiguration<Wallet>
{
    public void Configure(EntityTypeBuilder<Wallet> builder)
    {
        builder.ToTable("wallets", "events_markets");

        builder.HasKey(w => w.Id);

        builder.Property(w => w.Id)
            .HasConversion(
                id => id.Value,
                guid => WalletId.From(guid))
            .HasColumnName("id")
            .IsRequired();

        builder.Property(w => w.UserId)
            .HasConversion(
                id => id.Value,
                guid => UserId.From(guid))
            .HasColumnName("user_id")
            .IsRequired();

        builder.Property(w => w.Balance)
            .HasConversion(
                money => money.Amount,
                amount => new Money(amount))
            .HasColumnName("balance")
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(w => w.AtRiskBalance)
            .HasConversion(
                money => money.Amount,
                amount => new Money(amount))
            .HasColumnName("at_risk_balance")
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(w => w.Version)
            .HasColumnName("version")
            .IsRequired()
            .IsConcurrencyToken();

        builder.HasMany(w => w.Transactions)
            .WithOne()
            .HasForeignKey("WalletId")
            .OnDelete(DeleteBehavior.Cascade);

        builder.Navigation(w => w.Transactions)
            .UsePropertyAccessMode(PropertyAccessMode.Field);

        builder.HasIndex(w => w.UserId).IsUnique().HasDatabaseName("ix_wallets_user_id");
        builder.HasIndex(w => w.Version).HasDatabaseName("ix_wallets_version");

        builder.Ignore(w => w.DomainEvents);
    }
}