namespace Zenbet.EventsMarkets.Infrastructure.Messaging;

using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Zenbet.EventsMarkets.Application.Interfaces;
using Zenbet.EventsMarkets.Application.Queries.GetEvents;
using Zenbet.EventsMarkets.Domain.Events;
using Zenbet.EventsMarkets.Domain.Enums;
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
                await ProcessDomainEventForNotifications(message, dbContext, notificationService, cancellationToken);

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

    private async Task ProcessDomainEventForNotifications(
        OutboxMessage message,
        EventsMarketsDbContext dbContext,
        INotificationService notificationService,
        CancellationToken cancellationToken)
    {
        try
        {
            switch (message.Type)
            {
                case nameof(OddsChangedDomainEvent):
                    var oddsEvent = JsonSerializer.Deserialize<OddsChangedDomainEvent>(message.Payload, JsonOptions);
                    if (oddsEvent != null)
                    {
                        // Contrato plano para el cliente: IDs como string y cuota
                        // como número. Serializar los structs completos rompía
                        // el parser de la UI ({ value, timestamp, provider }).
                        var oddsUpdate = new
                        {
                            selectionId = oddsEvent.SelectionId.Value,
                            newOdd = oddsEvent.NewOdd.Value,
                            marketId = oddsEvent.MarketId.Value,
                            timestamp = oddsEvent.NewOdd.Timestamp,
                            occurredAt = oddsEvent.Timestamp
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

                case nameof(EventStatusChangedDomainEvent):
                    var statusEvent = JsonSerializer.Deserialize<EventStatusChangedDomainEvent>(message.Payload, JsonOptions);
                    if (statusEvent != null)
                    {
                        await NotifyFightEventAsync(
                            statusEvent.EventId,
                            dbContext,
                            notificationService,
                            cancellationToken);
                    }
                    break;

                case nameof(MmaResultRecordedDomainEvent):
                    var resultEvent = JsonSerializer.Deserialize<MmaResultRecordedDomainEvent>(message.Payload, JsonOptions);
                    if (resultEvent != null)
                    {
                        await NotifyFightEventAsync(
                            resultEvent.EventId,
                            dbContext,
                            notificationService,
                            cancellationToken);
                    }
                    break;

                case nameof(WalletDepositedDomainEvent):
                    var depositEvent = JsonSerializer.Deserialize<WalletDepositedDomainEvent>(message.Payload, JsonOptions);
                    if (depositEvent != null)
                    {
                        // Empuje en tiempo real del nuevo saldo al dueño de la
                        // billetera (depósito aprobado por administración).
                        await notificationService.NotifyWalletBalanceUpdatedAsync(
                            depositEvent.WalletId.Value,
                            depositEvent.UserId.Value,
                            depositEvent.Amount.Amount,
                            depositEvent.NewBalance.Amount,
                            depositEvent.TransactionId.Value,
                            cancellationToken);
                    }
                    break;
            }
        }
        catch (JsonException ex)
        {
            // Un payload corrupto no se arregla reintentando; se marca como
            // procesado para no bloquear el resto de la cola.
            _logger.LogWarning(ex, "Failed to deserialize outbox message {MessageId} of type {Type}", message.Id, message.Type);
        }
    }

    private async Task NotifyFightEventAsync(
        Zenbet.EventsMarkets.Domain.ValueObjects.EventId eventId,
        EventsMarketsDbContext dbContext,
        INotificationService notificationService,
        CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        var @event = await dbContext.Events
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == eventId, cancellationToken);

        if (@event is null)
            return;

        await notificationService.NotifyFightUpdateAsync(
            eventId.Value,
            FightRealtimeMapper.ToUpdate(@event, now),
            cancellationToken);

        var cardKey = FightRealtimeMapper.CardKey(@event);
        var cardStart = new DateTimeOffset(@event.StartTime.UtcDateTime.Date, TimeSpan.Zero);
        var cardEnd = cardStart.AddDays(1);

        var cardEvents = await dbContext.Events
            .AsNoTracking()
            .Where(item =>
                item.SportType == SportType.MixedMartialArts &&
                item.StartTime >= cardStart &&
                item.StartTime < cardEnd)
            .ToListAsync(cancellationToken);

        await notificationService.NotifyCardUpdateAsync(
            cardKey,
            FightRealtimeMapper.ToCardUpdate(cardKey, cardEvents, now),
            cancellationToken);
    }
}

public sealed class OutboxProcessorOptions
{
    public int BatchSize { get; set; } = 100;
    public TimeSpan PollInterval { get; set; } = TimeSpan.FromSeconds(5);
    public int MaxRetries { get; set; } = 10;
}