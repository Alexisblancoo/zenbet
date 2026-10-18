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
using Zenbet.EventsMarkets.Infrastructure.Persistence.Services;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("EventsMarkets")
            ?? throw new InvalidOperationException("Connection string 'EventsMarkets' not found");

        services.AddDbContext<EventsMarketsDbContext>(options =>
        {
            options.UseNpgsql(connectionString, npgsqlOptions =>
            {
                npgsqlOptions.MigrationsAssembly(typeof(EventsMarketsDbContext).Assembly.FullName);
                npgsqlOptions.EnableRetryOnFailure(3, TimeSpan.FromSeconds(5), null);
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
        services.AddScoped<IMarketRepository, MarketRepository>();
        services.AddScoped<ISelectionRepository, SelectionRepository>();
        services.AddScoped<IWalletRepository, WalletRepository>();
        services.AddScoped<ITransactionRepository, TransactionRepository>();

        // Outbox / Inbox
        services.AddScoped<IOutboxWriter, OutboxWriter>();
        services.AddScoped<IInboxWriter, InboxWriter>();

        // Unit of Work & Services
        services.AddScoped<IUnitOfWork, EfUnitOfWork>();
        services.AddScoped<IIdempotencyService, EfIdempotencyService>();
        services.AddScoped<ISettlementAuditService, EfSettlementAuditService>();
        services.AddScoped<IBulkOddsUpdater, NpgsqlBulkOddsUpdater>();

        // Risk Management
        services.AddScoped<IRiskManagementService, EfRiskManagementService>();

        // MediatR Pipeline Behaviors
        services.AddTransient(typeof(IPipelineBehavior<,>), typeof(RiskValidationBehavior<,>));

        // Notification service (can be overridden by API layer for SignalR)
        services.AddScoped<INotificationService, NoOpNotificationService>();

        // Background services for outbox/inbox processing
        services.AddHostedService<OutboxProcessor>();
        services.AddHostedService<InboxProcessor>();
        services.AddHostedService<PayoutWorker>();

        return services;
    }
}