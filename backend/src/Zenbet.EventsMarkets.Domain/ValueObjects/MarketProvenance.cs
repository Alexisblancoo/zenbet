namespace Zenbet.EventsMarkets.Domain.ValueObjects;

using Zenbet.EventsMarkets.Domain.Enums;

/// <summary>
/// Procedencia de las cuotas de un mercado. La cuota publicada no es suficiente
/// sin saber quién la publicó, cuándo se capturó y dónde puede verificarse.
/// </summary>
public sealed class MarketProvenance
{
    private MarketProvenance() { } // EF Core

    public MarketProvenance(
        string provider,
        OddsSourceKind kind,
        string? url,
        DateTimeOffset observedAt,
        string? note = null)
    {
        if (string.IsNullOrWhiteSpace(provider))
            throw new ArgumentException("La procedencia necesita un proveedor.", nameof(provider));

        if (observedAt == default)
            throw new ArgumentException("La procedencia necesita un timestamp de observación.", nameof(observedAt));

        var isPublished = kind is OddsSourceKind.Bookmaker
            or OddsSourceKind.Aggregator
            or OddsSourceKind.Exchange;

        if (isPublished && string.IsNullOrWhiteSpace(url))
            throw new ArgumentException("Una cuota publicada necesita URL de verificación.", nameof(url));

        Provider = provider.Trim();
        Kind = kind;
        Url = string.IsNullOrWhiteSpace(url) ? null : url.Trim();
        ObservedAt = observedAt;
        Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
    }

    public string Provider { get; private set; } = string.Empty;
    public OddsSourceKind Kind { get; private set; }
    public string? Url { get; private set; }
    public DateTimeOffset ObservedAt { get; private set; }
    public string? Note { get; private set; }

    public bool IsPublished => Kind is OddsSourceKind.Bookmaker
        or OddsSourceKind.Aggregator
        or OddsSourceKind.Exchange;
}
