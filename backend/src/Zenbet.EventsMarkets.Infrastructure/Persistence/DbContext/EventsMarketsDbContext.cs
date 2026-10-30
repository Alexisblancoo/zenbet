namespace Zenbet.EventsMarkets.Infrastructure.Persistence;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Zenbet.EventsMarkets.Domain.Aggregates;
using Zenbet.EventsMarkets.Domain.Football;
using Zenbet.EventsMarkets.Domain.ValueObjects;
using Zenbet.EventsMarkets.Domain.Enums;
using Zenbet.EventsMarkets.Infrastructure.Persistence.Configurations;
using Zenbet.EventsMarkets.Infrastructure.Persistence.Outbox;
using Zenbet.EventsMarkets.Infrastructure.Persistence.Interceptors;
using Zenbet.EventsMarkets.Infrastructure.Persistence.Seeding;

public sealed class EventsMarketsDbContext : DbContext
{
    public DbSet<Event> Events { get; set; } = null!;
    public DbSet<Promotion> Promotions { get; set; } = null!;
    public DbSet<FightingEvent> FightingEvents { get; set; } = null!;
    public DbSet<Market> Markets { get; set; } = null!;
    public DbSet<Selection> Selections { get; set; } = null!;
    public DbSet<Wallet> Wallets { get; set; } = null!;
    public DbSet<Transaction> Transactions { get; set; } = null!;
    public DbSet<UserAccount> UserAccounts { get; set; } = null!;
    public DbSet<OutboxMessage> OutboxMessages { get; set; } = null!;
    public DbSet<IdempotencyKey> IdempotencyKeys { get; set; } = null!;
    public DbSet<SettlementAuditEntry> SettlementAudit { get; set; } = null!;
    public DbSet<InboxMessage> InboxMessages { get; set; } = null!;
    public DbSet<DeadLetterEntry> DeadLetters { get; set; } = null!;
    public DbSet<UfcSeedState> UfcSeedStates { get; set; } = null!;
    public DbSet<FootballLeague> FootballLeagues { get; set; } = null!;
    public DbSet<FootballTeam> FootballTeams { get; set; } = null!;
    public DbSet<FootballMatch> FootballMatches { get; set; } = null!;
    public DbSet<FootballMarket> FootballMarkets { get; set; } = null!;
    public DbSet<FootballSelection> FootballSelections { get; set; } = null!;

    public EventsMarketsDbContext(DbContextOptions<EventsMarketsDbContext> options)
        : base(options) { }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Promotion>(entity =>
        {
            entity.ToTable("promotions", "events_markets");
        });

        modelBuilder.ApplyConfiguration(new EventConfiguration());
        modelBuilder.ApplyConfiguration(new PromotionConfiguration());
        modelBuilder.ApplyConfiguration(new FightingEventConfiguration());
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
        modelBuilder.ApplyConfiguration(new FootballLeagueConfiguration());
        modelBuilder.ApplyConfiguration(new FootballTeamConfiguration());
        modelBuilder.ApplyConfiguration(new FootballMatchConfiguration());
        modelBuilder.ApplyConfiguration(new FootballMarketConfiguration());
        modelBuilder.ApplyConfiguration(new FootballSelectionConfiguration());

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
