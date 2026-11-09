namespace Zenbet.EventsMarkets.Infrastructure;

using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Zenbet.EventsMarkets.Application.Behaviors;
using Zenbet.EventsMarkets.Application.Interfaces;
using Zenbet.EventsMarkets.Domain.Repositories;
using Zenbet.EventsMarkets.Infrastructure.Concurrency;
using Zenbet.EventsMarkets.Infrastructure.Messaging;
using Zenbet.EventsMarkets.Infrastructure.Persistence;
using Zenbet.EventsMarkets.Infrastructure.Persistence.Outbox;
using Zenbet.EventsMarkets.Infrastructure.Persistence.Repositories;
using Zenbet.EventsMarkets.Infrastructure.Persistence.Seeding;
using Zenbet.EventsMarkets.Infrastructure.Persistence.Services;
using Zenbet.EventsMarkets.Infrastructure.Security;
using Zenbet.EventsMarkets.Infrastructure.Services;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("EventsMarkets");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException(
                "ConnectionStrings:EventsMarkets debe configurarse mediante variables de entorno.");
        }

        services.AddDbContext<EventsMarketsDbContext>(options =>
        {
            options.UseNpgsql(connectionString, npgsqlOptions =>
            {
                npgsqlOptions.MigrationsAssembly(typeof(EventsMarketsDbContext).Assembly.FullName);
                npgsqlOptions.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery);

                // PlaceBet y SettleMarket abren transacciones manuales mediante
                // IUnitOfWork. Una execution strategy con reintentos no permite
                // transacciones iniciadas por el usuario; mantenerla activa hacía
                // fallar SaveChanges con NpgsqlRetryingExecutionStrategy.
            });

            // Enable detailed errors in development
            if (Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") == "Development")
            {
                options.EnableDetailedErrors();
                options.EnableSensitiveDataLogging();
            }
        });

        // Repositories
        services.AddScoped<IEventRepository, EventRepository>();
        services.AddScoped<IPromotionRepository, PromotionRepository>();
        services.AddScoped<MmaEventSynchronizer>();
        services.AddScoped<IMarketRepository, MarketRepository>();
        services.AddScoped<ISelectionRepository, SelectionRepository>();
        services.AddScoped<IWalletRepository, WalletRepository>();
        services.AddScoped<ITransactionRepository, TransactionRepository>();
        services.AddScoped<IWalletReadRepository, WalletReadRepository>();
        services.AddScoped<IAdminDepositReadRepository, AdminDepositReadRepository>();
        services.AddScoped<IFootballRepository, FootballRepository>();

        // Outbox / Inbox
        services.AddScoped<IOutboxWriter, OutboxWriter>();
        services.AddScoped<IInboxWriter, InboxWriter>();

        // Unit of Work & Services
        services.AddScoped<IUnitOfWork, EfUnitOfWork>();
        services.AddScoped<IIdempotencyService, EfIdempotencyService>();
        services.AddScoped<ISettlementAuditService, EfSettlementAuditService>();
        services.AddScoped<IBulkOddsUpdater, NpgsqlBulkOddsUpdater>();

        // Authentication & player accounts
        services.Configure<AuthOptions>(configuration.GetSection(AuthOptions.SectionName));
        var signingKey = configuration[$"{AuthOptions.SectionName}:SigningKey"];
        if (string.IsNullOrWhiteSpace(signingKey) || signingKey.Length < 32)
        {
            throw new InvalidOperationException(
                "Auth:SigningKey debe estar configurado con al menos 32 caracteres.");
        }

        // Migraciones al arrancar, SIN depender de ningún seeder. Debe registrarse antes que cualquier otro
        // servicio en segundo plano: su StartAsync se espera completo y, si falla, la aplicación no arranca.
        services.Configure<DatabaseMigrationOptions>(configuration.GetSection(DatabaseMigrationOptions.SectionName));
        services.AddHostedService<DatabaseMigrationHostedService>();

        // El primer admin se aprovisiona solo desde configuración del servidor.
        services.Configure<AdminBootstrapOptions>(configuration.GetSection(AdminBootstrapOptions.SectionName));
        services.AddHostedService<AdminBootstrapSeeder>();

        services.AddSingleton<IPasswordHasher, Pbkdf2PasswordHasher>();
        services.AddSingleton<IAuthTokenService, HmacAuthTokenService>();
        services.AddScoped<IAuthService, AuthService>();

        // Risk Management
        services.AddScoped<IRiskManagementService, EfRiskManagementService>();

        // Cola en memoria por mercado: evita que las apuestas de un mercado caliente agoten el pool.
        services.Configure<MarketBetGateOptions>(configuration.GetSection(MarketBetGateOptions.SectionName));
        services.AddSingleton<IMarketBetGate, MarketBetGate>();

        // MediatR Pipeline Behaviors
        // Primero: rechaza apuestas sobre líneas de referencia (no ejecutables) antes de cualquier otro trabajo.
        services.Configure<BettingOptions>(configuration.GetSection(BettingOptions.SectionName));
        services.AddTransient(typeof(IPipelineBehavior<,>), typeof(ExecutableMarketBehavior<,>));
        services.AddTransient(typeof(IPipelineBehavior<,>), typeof(RiskValidationBehavior<,>));

        // Notification service (can be overridden by API layer for SignalR)
        services.AddScoped<INotificationService, NoOpNotificationService>();

        // Background services for outbox/inbox processing
        services.Configure<OutboxProcessorOptions>(configuration.GetSection("OutboxProcessor"));
        services.AddHostedService<OutboxProcessorBackgroundService>();
        services.AddHostedService<InboxProcessor>();
        services.AddHostedService<PayoutWorker>();

        services.Configure<MmaSyncOptions>(configuration.GetSection("MmaSync"));
        // AddHttpClient (en vez del HttpClient singleton anterior) + un resilience
        // handler estándar (retry con backoff, circuit breaker y timeout) para que
        // un proveedor de feed externo lento o caído no cuelgue el worker de sync
        // ni agote el pool de sockets.
        if (string.Equals(configuration["MmaSync:Provider"], "UfCalendar", StringComparison.OrdinalIgnoreCase))
        {
            // Real calendar from UFCalendar (registered below as a typed client). Cards arrive WITHOUT markets: ZenBet
            // prices its own, so nothing is bettable until an operator opens and prices the markets.
            services.AddTransient<IMmaDataProvider>(sp => sp.GetRequiredService<Providers.UfCalendar.UfCalendarClient>());
        }
        else
        {
            services.AddHttpClient<IMmaDataProvider, HttpMmaDataProvider>()
                .AddStandardResilienceHandler();
        }
        services.AddHostedService<EventSyncBackgroundService>();

        // Result suggestions: feeds PROPOSE, an admin confirms. Order matters: the first provider is the primary feed.
        services.AddMemoryCache();
        services.Configure<Providers.UfCalendar.UfCalendarOptions>(configuration.GetSection("UfCalendar"));
        services.Configure<Providers.ApiSports.ApiSportsOptions>(configuration.GetSection("ApiSports"));
        services.Configure<Providers.BigBalls.BigBallsOptions>(configuration.GetSection("BigBallsData"));
        services.Configure<ResultSuggestionOptions>(configuration.GetSection("ResultSuggestions"));
        services.AddHttpClient<Providers.UfCalendar.UfCalendarClient>().AddStandardResilienceHandler();
        services.AddHttpClient<Providers.ApiSports.ApiSportsClient>().AddStandardResilienceHandler();
        services.AddHttpClient<Providers.BigBalls.BigBallsClient>().AddStandardResilienceHandler();
        services.AddTransient<IFightResultsProvider>(sp => sp.GetRequiredService<Providers.UfCalendar.UfCalendarClient>());
        services.AddTransient<IFightResultsProvider>(sp => sp.GetRequiredService<Providers.ApiSports.ApiSportsClient>());
        services.AddTransient<IFightResultsProvider>(sp => sp.GetRequiredService<Providers.BigBalls.BigBallsClient>());
        services.AddScoped<IFightResultProposalRepository, FightResultProposalRepository>();
        services.AddHostedService<FightResultSuggestionWorker>();

        // Ciclo de vida de combates + reloj en vivo (SignalR FightHub).
        services.Configure<FightLiveUpdateOptions>(configuration.GetSection("FightLiveUpdates"));
        services.AddHostedService<FightLiveUpdateWorker>();

        // Idempotent UFC card seed, configurable per environment.
        services.Configure<UfcSeedOptions>(configuration.GetSection("Seeding:Ufc"));
        services.AddHostedService<UfcCardSeeder>();

        // Datos oficiales y ciclo de vida de Fútbol (SignalR FootballHub / OddsHub).
        // Los partidos de fútbol sembrados son DATOS DE DEMOSTRACIÓN (horarios relativos a la hora actual,
        // marcadores y cuotas fijos) y el worker "live" les avanza el minuto por reloj hasta el 90'. Con dinero
        // real eso es apostar sobre partidos inventados: solo se activan con Seeding:Football:Enabled=true.
        if (configuration.GetValue<bool>("Seeding:Football:Enabled"))
        {
            services.AddHostedService<FootballDataSeeder>();
            services.AddHostedService<FootballLiveWorker>();
        }

        return services;
    }
}
