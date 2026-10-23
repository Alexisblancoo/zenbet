namespace Zenbet.EventsMarkets.Infrastructure.Persistence.Configurations;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Zenbet.EventsMarkets.Domain.Aggregates;

public sealed class UserAccountConfiguration : IEntityTypeConfiguration<UserAccount>
{
    public void Configure(EntityTypeBuilder<UserAccount> builder)
    {
        builder.ToTable("user_accounts", "events_markets");

        builder.HasKey(account => account.Id);

        builder.Property(account => account.Id)
            .HasColumnName("id")
            .IsRequired();

        builder.Property(account => account.Username)
            .HasColumnName("username")
            .HasMaxLength(24)
            .IsRequired();

        builder.Property(account => account.NormalizedUsername)
            .HasColumnName("normalized_username")
            .HasMaxLength(24)
            .IsRequired();

        builder.Property(account => account.Email)
            .HasColumnName("email")
            .HasMaxLength(320)
            .IsRequired();

        builder.Property(account => account.NormalizedEmail)
            .HasColumnName("normalized_email")
            .HasMaxLength(320)
            .IsRequired();

        builder.Property(account => account.PasswordHash)
            .HasColumnName("password_hash")
            .HasMaxLength(512)
            .IsRequired();

        builder.Property(account => account.Role)
            .HasColumnName("role")
            .HasMaxLength(32)
            .IsRequired();

        builder.Property(account => account.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        builder.Property(account => account.TermsAcceptedAt)
            .HasColumnName("terms_accepted_at")
            .IsRequired();

        builder.HasIndex(account => account.NormalizedUsername)
            .IsUnique()
            .HasDatabaseName("ux_user_accounts_normalized_username");

        builder.HasIndex(account => account.NormalizedEmail)
            .IsUnique()
            .HasDatabaseName("ux_user_accounts_normalized_email");
    }
}
