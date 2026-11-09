namespace Zenbet.EventsMarkets.Application.Interfaces;

/// <summary>Bandeja del trader: mercados abiertos que todavía no tienen cuotas (procedencia Pending).</summary>
public interface IPendingPricingReader
{
    Task<IReadOnlyList<PendingPricingMarketView>> ListAsync(int take, CancellationToken cancellationToken = default);
}

public sealed record PendingPricingMarketView(
    Guid EventId,
    string EventName,
    DateTimeOffset StartTime,
    Guid MarketId,
    string Type,
    string Name,
    decimal? Line,
    IReadOnlyList<PendingPricingSelectionView> Selections);

public sealed record PendingPricingSelectionView(Guid SelectionId, string? Code, string Name);
