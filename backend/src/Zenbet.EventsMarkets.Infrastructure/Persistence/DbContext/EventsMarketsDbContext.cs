namespace Zenbet.EventsMarkets.Infrastructure.Persistence;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Zenbet.EventsMarkets.Domain.Aggregates;
using Zenbet.EventsMarkets.Domain.ValueObjects;
using Zenbet.EventsMarkets.Domain.Enums;
using Zenbet.EventsMarkets.Infrastructure.Persistence.Configurations;
using Zenbet.EventsMarkets.Infrastructure.Persistence.Outbox;
using Zenbet.EventsMarkets.Infrastructure.Persistence.Interceptors;
using Zenbet.EventsMarkets.Infrastructure.Persistence.Seeding;

public sealed class EventsMarketsDbContext : DbContext
{
    public DbSet<Event> Events => Set<Event>();
    public DbSet<Market> Markets => Set<Market>();
    public DbSet<Selection> Selections => Set<Selection>();
    public DbSet<Wallet> Wallets => Set<Wallet>();
    public DbSet<Transaction> Transactions => Set<Transaction>();
    public DbSet<UserAccount> UserAccounts => Set<UserAccount>();
    public DbSet<OutboxMessage> OutboxMessages => Set<OutboxMessage>();
    public DbSet<IdempotencyKey> IdempotencyKeys => Set<IdempotencyKey>();
    public DbSet<SettlementAuditEntry> SettlementAudit => Set<SettlementAuditEntry>();
    public DbSet<InboxMessage> InboxMessages => Set<InboxMessage>();
    public DbSet<DeadLetterEntry> DeadLetters => Set<DeadLetterEntry>();
    public DbSet<UfcSeedState> UfcSeedStates => Set<UfcSeedState>();

    public EventsMarketsDbContext(DbContextOptions<EventsMarketsDbContext> options)
        : base(options) { }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfiguration(new EventConfiguration());
        modelBuilder.ApplyConfiguration(new MarketConfiguration());
        modelBuilder.ApplyConfiguration(new SelectionConfiguration());
        modelBuilder.ApplyConfiguration(new WalletConfiguration());
        modelBuilder.ApplyConfiguration(new TransactionConfiguration());
        modelBuilder.ApplyConfiguration(new UserAccountConfiguration());
        modelBuilder.ApplyConfiguration(new OutboxMessageConfiguration());
        modelBuilder.ApplyConfiguration(new IdempotencyKeyConfiguration());
        modelBuilder.ApplyConfiguration(new SettlementAuditConfiguration());
        modelBuilder.ApplyConfiguration(new InboxMessageConfiguration());
        modelBuilder.ApplyConfiguration(new DeadLetterConfiguration());
        modelBuilder.ApplyConfiguration(new UfcSeedStateConfiguration());

        base.OnModelCreating(modelBuilder);
    }

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        optionsBuilder.AddInterceptors(new DomainEventsInterceptor());
    }

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        // Update Version for optimistic concurrency on Events
        foreach (var entry in ChangeTracker.Entries<Event>()
                     .Where(e => e.State == EntityState.Modified))
        {
            entry.Property(e => e.Version).CurrentValue++;
        }

        // Update Version for optimistic concurrency on Wallets
        foreach (var entry in ChangeTracker.Entries<Wallet>()
                     .Where(e => e.State == EntityState.Modified))
        {
            entry.Property(e => e.Version).CurrentValue++;
        }

        return await base.SaveChangesAsync(cancellationToken);
    }
}