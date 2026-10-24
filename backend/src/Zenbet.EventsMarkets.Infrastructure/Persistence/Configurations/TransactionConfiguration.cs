namespace Zenbet.EventsMarkets.Infrastructure.Persistence.Configurations;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Zenbet.EventsMarkets.Domain.Aggregates;
using Zenbet.EventsMarkets.Domain.ValueObjects;
using Zenbet.EventsMarkets.Domain.Enums;

public sealed class TransactionConfiguration : IEntityTypeConfiguration<Transaction>
{
    public void Configure(EntityTypeBuilder<Transaction> builder)
    {
        builder.ToTable("transactions", "events_markets");

        builder.HasKey(t => t.Id);

        builder.Property(t => t.Id)
            .HasConversion(
                id => id.Value,
                guid => TransactionId.From(guid))
            .HasColumnName("id")
            .IsRequired();

        builder.Property<WalletId>("WalletId")
            .HasConversion(
                id => id.Value,
                guid => WalletId.From(guid))
            .HasColumnName("wallet_id")
            .IsRequired();

        builder.Property(t => t.Type)
            .HasColumnName("type")
            .HasConversion<int>()
            .IsRequired();

        builder.Property(t => t.Amount)
            .HasConversion(
                money => money.Amount,
                amount => new Money(amount))
            .HasColumnName("amount")
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(t => t.BalanceAfter)
            .HasConversion(
                money => money.Amount,
                amount => new Money(amount))
            .HasColumnName("balance_after")
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(t => t.Description)
            .HasColumnName("description")
            .HasMaxLength(500);

        builder.Property(t => t.ReferenceId)
            .HasColumnName("reference_id")
            .HasMaxLength(100);

        builder.Property<SelectionId?>("SelectionId")
            .HasConversion(
                id => id.HasValue ? id.Value.Value : (Guid?)null,
                guid => guid.HasValue ? SelectionId.From(guid.Value) : (SelectionId?)null)
            .HasColumnName("selection_id");

        builder.Property(t => t.AcceptedOdds)
            .HasColumnName("accepted_odds")
            .HasPrecision(7, 4);

        builder.Property(t => t.PromoCode)
            .HasColumnName("promo_code")
            .HasMaxLength(40);

        builder.Property(t => t.BetStatus)
            .HasColumnName("bet_status")
            .HasConversion<int>();

        builder.Property(t => t.Status)
            .HasColumnName("status")
            .HasConversion<int>()
            .HasDefaultValue(TransactionStatus.Pending)
            .IsRequired();

        builder.Property(t => t.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        builder.Property(t => t.CompletedAt)
            .HasColumnName("completed_at");

        builder.Property(t => t.FailureReason)
            .HasColumnName("failure_reason")
            .HasMaxLength(500);

        builder.HasIndex("WalletId").HasDatabaseName("ix_transactions_wallet_id");
        builder.HasIndex(t => t.Status).HasDatabaseName("ix_transactions_status");
        builder.HasIndex(t => t.CreatedAt).HasDatabaseName("ix_transactions_created_at");
        builder.HasIndex("WalletId", "CreatedAt").HasDatabaseName("ix_transactions_wallet_id_created_at");
        builder.HasIndex(t => t.ReferenceId).HasDatabaseName("ix_transactions_reference_id");
        builder.HasIndex("SelectionId").HasDatabaseName("ix_transactions_selection_id");
        builder.HasIndex(t => new { t.Type, t.BetStatus })
            .HasDatabaseName("ix_transactions_type_bet_status");
    }
}