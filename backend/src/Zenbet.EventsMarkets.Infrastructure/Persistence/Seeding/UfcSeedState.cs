namespace Zenbet.EventsMarkets.Infrastructure.Persistence.Seeding;

/// <summary>
/// Estado de la última aplicación del snapshot UFC. Evita reescribir cuotas
/// vivas en cada arranque y permite refrescar el seed de forma explícita.
/// </summary>
public sealed class UfcSeedState
{
    public string Key { get; set; } = string.Empty;
    public int Version { get; set; }
    public DateTimeOffset AppliedAt { get; set; }
    public DateTimeOffset SourceObservedAt { get; set; }
}
