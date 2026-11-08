namespace Zenbet.EventsMarkets.Infrastructure.Persistence;

using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

public sealed class DatabaseMigrationOptions
{
    public const string SectionName = "Database";

    /// <summary>
    /// Aplica las migraciones de EF al arrancar. Independiente de cualquier seeder: antes el esquema
    /// solo se creaba si además se activaba la siembra de datos demo de UFC.
    /// </summary>
    public bool MigrateOnStartup { get; set; }
}

/// <summary>
/// Migra la base de datos ANTES de que arranque cualquier otro servicio en segundo plano: se registra
/// primero y su StartAsync se espera completo. Si la migración falla, la aplicación no arranca.
/// </summary>
public sealed class DatabaseMigrationHostedService : IHostedService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IOptions<DatabaseMigrationOptions> _options;
    private readonly ILogger<DatabaseMigrationHostedService> _logger;

    public DatabaseMigrationHostedService(
        IServiceScopeFactory scopeFactory,
        IOptions<DatabaseMigrationOptions> options,
        ILogger<DatabaseMigrationHostedService> logger)
    {
        _scopeFactory = scopeFactory;
        _options = options;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        if (!_options.Value.MigrateOnStartup)
        {
            _logger.LogInformation(
                "Migraciones al arrancar desactivadas (Database:MigrateOnStartup=false): el esquema debe aplicarse por otra vía.");
            return;
        }

        await using var scope = _scopeFactory.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<EventsMarketsDbContext>();
        await dbContext.Database.MigrateAsync(cancellationToken);
        _logger.LogInformation("Migraciones de base de datos aplicadas.");
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
