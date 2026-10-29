namespace Zenbet.EventsMarkets.Infrastructure;

using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Zenbet.EventsMarkets.Application.Behaviors;
using Zenbet.EventsMarkets.Application.Interfaces;
using Zenbet.EventsMarkets.Domain.Repositories;
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

        services.AddSingleton<IPasswordHasher, Pbkdf2PasswordHasher>();
        services.AddSingleton<IAuthTokenService, HmacAuthTokenService>();
        services.AddScoped<IAuthService, AuthService>();

        // Risk Management
        services.AddScoped<IRiskManagementService, EfRiskManagementService>();

        // MediatR Pipeline Behaviors
        services.AddTransient(typeof(IPipelineBehavior<,>), typeof(RiskValidationBehavior<,>));

        // Notification service (can be overridden by API layer for SignalR)
        services.AddScoped<INotificationService, NoOpNotificationService>();

        // Background services for outbox/inbox processing
        services.Configure<OutboxProcessorOptions>(configuration.GetSection("OutboxProcessor"));
        services.AddHostedService<OutboxProcessorBackgroundService>();
        services.AddHostedService<InboxProcessor>();
        services.AddHostedService<PayoutWorker>();

        services.Configure<MmaSyncOptions>(configuration.GetSection("MmaSync"));
        services.AddSingleton<HttpClient>();
        services.AddTransient<IMmaDataProvider, HttpMmaDataProvider>();
        services.AddHostedService<EventSyncBackgroundService>();

        // Ciclo de vida de combates + reloj en vivo (SignalR FightHub).
        services.Configure<FightLiveUpdateOptions>(configuration.GetSection("FightLiveUpdates"));
        services.AddHostedService<FightLiveUpdateWorker>();

        // Idempotent UFC card seed, configurable per environment.
        services.Configure<UfcSeedOptions>(configuration.GetSection("Seeding:Ufc"));
        services.AddHostedService<UfcCardSeeder>();

        // Datos oficiales y ciclo de vida de Fútbol (SignalR FootballHub / OddsHub).
        services.AddHostedService<FootballDataSeeder>();
        services.AddHostedService<FootballLiveWorker>();

        return services;
    }
}
