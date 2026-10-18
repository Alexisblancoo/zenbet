namespace Zenbet.EventsMarkets.Infrastructure.Messaging;

using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Zenbet.EventsMarkets.Application.Interfaces;
using Zenbet.EventsMarkets.Domain.Events;
using Zenbet.EventsMarkets.Domain.ValueObjects;
using Zenbet.EventsMarkets.Infrastructure.Persistence;
using Zenbet.EventsMarkets.Infrastructure.Persistence.Outbox;

public sealed class OutboxProcessor : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<OutboxProcessor> _logger;
    private readonly OutboxProcessorOptions _options;
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false
    };

    public OutboxProcessor(
        IServiceScopeFactory scopeFactory,
        ILogger<OutboxProcessor> logger,
        IOptions<OutboxProcessorOptions> options)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
        _options = options.Value;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Outbox processor started");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessBatchAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing outbox batch");
            }

            await Task.Delay(_options.PollInterval, stoppingToken);
        }
    }

    private async Task ProcessBatchAsync(CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<EventsMarketsDbContext>();
        var notificationService = scope.ServiceProvider.GetRequiredService<INotificationService>();

        var messages = await dbContext.OutboxMessages
            .Where(m => m.ProcessedAt == null && m.RetryCount < _options.MaxRetries)
            .OrderBy(m => m.CreatedAt)
            .Take(_options.BatchSize)
            .ToListAsync(cancellationToken);

        if (messages.Count == 0) return;

        foreach (var message in messages)
        {
            try
            {
                // Process specific domain events for real-time notifications
                await ProcessDomainEventForNotifications(message, notificationService, cancellationToken);

                message.ProcessedAt = DateTimeOffset.UtcNow;
                _logger.LogDebug("Published outbox message {MessageId} of type {Type}", message.Id, message.Type);
            }
            catch (Exception ex)
            {
                message.RetryCount++;
                message.LastError = ex.Message;
                _logger.LogWarning(ex, "Failed to publish outbox message {MessageId}, retry {RetryCount}", message.Id, message.RetryCount);
            }
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task ProcessDomainEventForNotifications(OutboxMessage message, INotificationService notificationService, CancellationToken cancellationToken)
    {
        try
        {
            switch (message.Type)
            {
                case nameof(OddsChangedDomainEvent):
                    var oddsEvent = JsonSerializer.Deserialize<OddsChangedDomainEvent>(message.Payload, JsonOptions);
                    if (oddsEvent != null)
                    {
                        var oddsUpdate = new
                        {
                            oddsEvent.SelectionId,
                            oddsEvent.NewOdd,
                            oddsEvent.Timestamp
                        };
                        await notificationService.NotifyOddsUpdateAsync(oddsEvent.MarketId, oddsUpdate, cancellationToken);
                    }
                    break;

                case nameof(MarketSettledDomainEvent):
                    var settlementEvent = JsonSerializer.Deserialize<MarketSettledDomainEvent>(message.Payload, JsonOptions);
                    if (settlementEvent != null)
                    {
                        var settlementData = new
                        {
                            settlementEvent.WinnerSelectionId,
                            settlementEvent.Result,
                            settlementEvent.SettledAt
                        };
                        await notificationService.NotifyMarketSettledAsync(settlementEvent.MarketId, settlementData, cancellationToken);
                    }
                    break;
            }
        }
        catch (JsonException ex)
        {
            _logger.LogWarning(ex, "Failed to deserialize outbox message {MessageId} of type {Type}", message.Id, message.Type);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing domain event for notifications: {MessageId}", message.Id);
        }
    }
}

public sealed class OutboxProcessorOptions
{
    public int BatchSize { get; set; } = 100;
    public TimeSpan PollInterval { get; set; } = TimeSpan.FromSeconds(5);
    public int MaxRetries { get; set; } = 10;
}