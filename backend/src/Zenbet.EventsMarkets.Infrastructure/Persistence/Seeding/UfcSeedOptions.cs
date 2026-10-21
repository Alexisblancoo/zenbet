namespace Zenbet.EventsMarkets.Infrastructure.Persistence.Seeding;

public sealed class UfcSeedOptions
{
    public bool Enabled { get; set; }
    public bool ApplyMigrations { get; set; } = true;
    public string ResourceName { get; set; } =
        "Zenbet.EventsMarkets.Infrastructure.Persistence.Seeding.Data.ufc-333.json";
}
