namespace Zenbet.EventsMarkets.Infrastructure.Persistence.Interceptors;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Zenbet.EventsMarkets.Domain.Events;

public sealed class DomainEventsInterceptor : SaveChangesInterceptor
{
    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData,
        InterceptionResult<int> result,
        CancellationToken cancellationToken = default)
    {
        var dbContext = eventData.Context;
        if (dbContext is null) return base.SavingChangesAsync(eventData, result, cancellationToken);

        // Dispatch domain events before saving - they'll be captured by OutboxWriter
        // This is called from repositories after they call AddDomainEvent on aggregates
        // The actual outbox writing happens in the command handlers via IOutboxWriter

        return base.SavingChangesAsync(eventData, result, cancellationToken);
    }
}

public sealed class SoftDeleteInterceptor : SaveChangesInterceptor
{
    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData,
        InterceptionResult<int> result,
        CancellationToken cancellationToken = default)
    {
        var dbContext = eventData.Context;
        if (dbContext is null) return base.SavingChangesAsync(eventData, result, cancellationToken);

        // Convert deletes to soft deletes for entities implementing ISoftDeletable
        foreach (var entry in dbContext.ChangeTracker.Entries()
                     .Where(e => e.State == EntityState.Deleted &&
                                 e.Entity.GetType().GetInterface(nameof(ISoftDeletable)) != null))
        {
            entry.State = EntityState.Modified;
            entry.CurrentValues["DeletedAt"] = DateTimeOffset.UtcNow;
            entry.CurrentValues["IsDeleted"] = true;
        }

        return base.SavingChangesAsync(eventData, result, cancellationToken);
    }
}

public interface ISoftDeletable
{
    DateTimeOffset? DeletedAt { get; set; }
    bool IsDeleted { get; set; }
}