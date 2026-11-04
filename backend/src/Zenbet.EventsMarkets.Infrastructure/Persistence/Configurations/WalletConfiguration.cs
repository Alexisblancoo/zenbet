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

        builder.Property(w => w.RealAvailable)
            .HasConversion(
                money => money.Amount,
                amount => Money.Signed(amount))
            .HasColumnName("real_available")
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(w => w.BonusAvailable)
            .HasConversion(
                money => money.Amount,
                amount => new Money(amount))
            .HasColumnName("bonus_available")
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(w => w.RealLocked)
            .HasConversion(
                money => money.Amount,
                amount => new Money(amount))
            .HasColumnName("real_locked")
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(w => w.BonusLocked)
            .HasConversion(
                money => money.Amount,
                amount => new Money(amount))
            .HasColumnName("bonus_locked")
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(w => w.Balance)
            .HasConversion(
                money => money.Amount,
                amount => Money.Signed(amount))
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

        builder.OwnsOne(w => w.ActiveBonus, bonus =>
        {
            bonus.Property(b => b.Id)
                .HasConversion(
                    id => id.Value,
                    guid => BonusId.From(guid))
                .HasColumnName("active_bonus_id");

            bonus.Property(b => b.InitialAmount)
                .HasConversion(
                    money => money.Amount,
                    amount => new Money(amount))
                .HasColumnName("active_bonus_initial_amount")
                .HasPrecision(18, 2);

            bonus.Property(b => b.WageringRequirement)
                .HasConversion(
                    money => money.Amount,
                    amount => new Money(amount))
                .HasColumnName("active_bonus_wagering_requirement")
                .HasPrecision(18, 2);

            bonus.Property(b => b.WageredAmount)
                .HasConversion(
                    money => money.Amount,
                    amount => new Money(amount))
                .HasColumnName("active_bonus_wagered_amount")
                .HasPrecision(18, 2);

            bonus.Property(b => b.MinOdds)
                .HasColumnName("active_bonus_min_odds")
                .HasPrecision(7, 4);

            bonus.Property(b => b.MaxConversion)
                .HasConversion(
                    money => money.Amount,
                    amount => new Money(amount))
                .HasColumnName("active_bonus_max_conversion")
                .HasPrecision(18, 2);

            bonus.Property(b => b.ConvertedAmount)
                .HasConversion(
                    money => money.Amount,
                    amount => new Money(amount))
                .HasColumnName("active_bonus_converted_amount")
                .HasPrecision(18, 2);

            bonus.Property(b => b.ForfeitedAmount)
                .HasConversion(
                    money => money.Amount,
                    amount => new Money(amount))
                .HasColumnName("active_bonus_forfeited_amount")
                .HasPrecision(18, 2);

            bonus.Property(b => b.IsCompleted)
                .HasColumnName("active_bonus_is_completed");

            bonus.Property(b => b.CreatedAt)
                .HasColumnName("active_bonus_created_at");

            bonus.Property(b => b.CompletedAt)
                .HasColumnName("active_bonus_completed_at");

            bonus.Ignore(b => b.IsRolloverMet);
            bonus.Ignore(b => b.ProgressPercentage);
        });

        builder.Navigation(w => w.ActiveBonus)
            .IsRequired(false);

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