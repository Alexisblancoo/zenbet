namespace Zenbet.EventsMarkets.Application.Interfaces;

using Zenbet.EventsMarkets.Application.Commands.UpdateOdds;
using Zenbet.EventsMarkets.Domain.Events;
using Zenbet.EventsMarkets.Domain.ValueObjects;

public sealed record BulkOddsUpdateResult(
    int UpdatedCount,
    IReadOnlyList<OddsChangedDomainEvent> DomainEvents);

public interface IBulkOddsUpdater
{
    Task<BulkOddsUpdateResult> BulkUpsertAsync(EventId eventId, IReadOnlyList<OddsUpdateItem> updates);
}