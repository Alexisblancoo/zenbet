namespace Zenbet.EventsMarkets.Infrastructure.Persistence.Seeding;

public sealed class UfcSeedOptions
{
    public bool Enabled { get; set; }
    public bool ApplyMigrations { get; set; } = true;
    public bool ForceRefresh { get; set; }

    /// <summary>
    /// Recursos explícitos. Si está vacío, el seeder descubre todos los
    /// snapshots JSON embebidos bajo <see cref="ResourcePrefix"/>. Esto permite
    /// añadir nuevas carteleras sin cambiar código ni configuración.
    /// </summary>
    public string[] Resources { get; set; } = Array.Empty<string>();

    public string ResourcePrefix { get; set; } =
        "Zenbet.EventsMarkets.Infrastructure.Persistence.Seeding.Data.";
}
