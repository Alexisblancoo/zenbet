namespace Zenbet.EventsMarkets.Infrastructure.Messaging;

using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Zenbet.EventsMarkets.Application.Interfaces;
using Zenbet.EventsMarkets.Application.Queries.GetEvents;
using Zenbet.EventsMarkets.Domain.Enums;
using Zenbet.EventsMarkets.Domain.Events;
using Zenbet.EventsMarkets.Domain.ValueObjects;
using Zenbet.EventsMarkets.Infrastructure.Persistence;
using Zenbet.EventsMarkets.Infrastructure.Persistence.Outbox;

public sealed class OutboxProcessorBackgroundService : BackgroundService
{
    private const int MaxBatchSize = 50;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<OutboxProcessorBackgroundService> _logger;
    private readonly OutboxProcessorOptions _options;

    public OutboxProcessorBackgroundService(
        IServiceScopeFactory scopeFactory,
        ILogger<OutboxProcessorBackgroundService> logger,
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
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {
                _logger.LogError(exception, "Outbox polling cycle failed");
            }

            try
            {
                await Task.Delay(_options.PollInterval, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
        }

        _logger.LogInformation("Outbox processor stopped");
    }

    private async Task ProcessBatchAsync(CancellationToken cancellationToken)
    {
        var batchSize = Math.Clamp(_options.BatchSize, 1, MaxBatchSize);
        var attemptedMessageIds = new List<Guid>(batchSize);

        // Lock and dispatch one message per short transaction. SKIP LOCKED
        // lets multiple app instances share the queue without duplicate claims.
        for (var index = 0; index < batchSize; index++)
        {
            var processedMessageId = await ProcessNextMessageAsync(attemptedMessageIds, cancellationToken);
            if (processedMessageId is null)
            {
                return;
            }

            attemptedMessageIds.Add(processedMessageId.Value);
        }
    }

    private async Task<Guid?> ProcessNextMessageAsync(
        IReadOnlyCollection<Guid> attemptedMessageIds,
        CancellationToken cancellationToken)
    {
        await using var scope = _scopeFactory.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<EventsMarketsDbContext>();
        var notificationService = scope.ServiceProvider.GetRequiredService<INotificationService>();
        await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);

        var pendingMessages = await dbContext.OutboxMessages
            .FromSqlInterpolated($"""
                SELECT *
                FROM events_markets.outbox_messages
                WHERE processed_at IS NULL AND retry_count < {_options.MaxRetries}
                  AND id <> ALL ({attemptedMessageIds.ToArray()})
                ORDER BY created_at ASC, id ASC
                LIMIT 1
                FOR UPDATE SKIP LOCKED
                """)
            .AsTracking()
            .ToListAsync(cancellationToken);

        if (pendingMessages.Count == 0)
        {
            await transaction.CommitAsync(cancellationToken);
            return null;
        }

        var message = pendingMessages[0];
        try
        {
            await DispatchAsync(message, dbContext, notificationService, cancellationToken);
            message.ProcessedAt = DateTimeOffset.UtcNow;
            message.Error = null;

            _logger.LogDebug(
                "Processed outbox message {MessageId} of type {Type}",
                message.Id,
                message.Type);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception exception)
        {
            message.RetryCount++;
            message.Error = Truncate(exception.ToString(), 2000);

            _logger.LogWarning(
                exception,
                "Failed to process outbox message {MessageId}; retry {RetryCount} of {MaxRetries}",
                message.Id,
                message.RetryCount,
                _options.MaxRetries);
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return message.Id;
    }

    private async Task DispatchAsync(
        OutboxMessage message,
        EventsMarketsDbContext dbContext,
        INotificationService notificationService,
        CancellationToken cancellationToken)
    {
        switch (message.Type)
        {
            case nameof(OddsChangedDomainEvent):
            {
                var domainEvent = DeserializeRequired<OddsChangedDomainEvent>(message);
                var update = new
                {
                    selectionId = domainEvent.SelectionId.Value,
                    newOdd = domainEvent.NewOdd.Value,
                    marketId = domainEvent.MarketId.Value,
                    timestamp = domainEvent.NewOdd.Timestamp,
                    occurredAt = domainEvent.Timestamp,
                };
                await notificationService.NotifyOddsUpdateAsync(
                    domainEvent.MarketId,
                    update,
                    cancellationToken);
                break;
            }
            case nameof(MarketSettledDomainEvent):
            {
                var domainEvent = DeserializeRequired<MarketSettledDomainEvent>(message);
                var update = new
                {
                    domainEvent.WinnerSelectionId,
                    domainEvent.Result,
                    domainEvent.SettledAt,
                };
                await notificationService.NotifyMarketSettledAsync(
                    domainEvent.MarketId,
                    update,
                    cancellationToken);
                break;
            }
            case nameof(MarketPresentationUpdatedDomainEvent):
            {
                var domainEvent = DeserializeRequired<MarketPresentationUpdatedDomainEvent>(message);
                await NotifyFightEventAsync(domainEvent.EventId, dbContext, notificationService, cancellationToken);
                break;
            }
            case nameof(EventStatusChangedDomainEvent):
            {
                var domainEvent = DeserializeRequired<EventStatusChangedDomainEvent>(message);
                await NotifyFightEventAsync(domainEvent.EventId, dbContext, notificationService, cancellationToken);
                break;
            }
            case nameof(MmaResultRecordedDomainEvent):
            {
                var domainEvent = DeserializeRequired<MmaResultRecordedDomainEvent>(message);
                await NotifyFightEventAsync(domainEvent.EventId, dbContext, notificationService, cancellationToken);
                break;
            }
            case nameof(WalletDepositedDomainEvent):
            {
                var domainEvent = DeserializeRequired<WalletDepositedDomainEvent>(message);
                await NotifyWalletBalanceAsync(
                    domainEvent.WalletId.Value,
                    domainEvent.UserId.Value,
                    domainEvent.Amount.Amount,
                    domainEvent.NewBalance.Amount,
                    domainEvent.TransactionId.Value,
                    notificationService,
                    cancellationToken);
                break;
            }
            case nameof(WalletWithdrawnDomainEvent):
            {
                var domainEvent = DeserializeRequired<WalletWithdrawnDomainEvent>(message);
                await NotifyWalletBalanceAsync(
                    domainEvent.WalletId.Value,
                    domainEvent.UserId.Value,
                    domainEvent.Amount.Amount,
                    domainEvent.NewBalance.Amount,
                    domainEvent.TransactionId.Value,
                    notificationService,
                    cancellationToken);
                break;
            }
            case nameof(BetPlacedDomainEvent):
            {
                var domainEvent = DeserializeRequired<BetPlacedDomainEvent>(message);
                await NotifyWalletBalanceAsync(
                    domainEvent.WalletId.Value,
                    domainEvent.UserId.Value,
                    domainEvent.Amount.Amount,
                    domainEvent.NewBalance.Amount,
                    domainEvent.TransactionId.Value,
                    notificationService,
                    cancellationToken);
                break;
            }
            case nameof(BetSettledDomainEvent):
            {
                var domainEvent = DeserializeRequired<BetSettledDomainEvent>(message);
                await NotifyWalletBalanceAsync(
                    domainEvent.WalletId.Value,
                    domainEvent.UserId.Value,
                    domainEvent.Amount.Amount,
                    domainEvent.NewBalance.Amount,
                    domainEvent.TransactionId.Value,
                    notificationService,
                    cancellationToken);
                break;
            }
            case nameof(BetOutcomeSettledDomainEvent):
            {
                var domainEvent = DeserializeRequired<BetOutcomeSettledDomainEvent>(message);
                await notificationService.NotifyBetOutcomeSettledAsync(
                    domainEvent.WalletId.Value,
                    domainEvent.UserId.Value,
                    domainEvent.BetTransactionId.Value,
                    domainEvent.MarketId.Value,
                    domainEvent.Outcome.ToString().ToLowerInvariant(),
                    domainEvent.Payout.Amount,
                    domainEvent.NewBalance.Amount,
                    cancellationToken);
                break;
            }
            case nameof(BetCancelledDomainEvent):
            {
                var domainEvent = DeserializeRequired<BetCancelledDomainEvent>(message);
                await NotifyWalletBalanceAsync(
                    domainEvent.WalletId.Value,
                    domainEvent.UserId.Value,
                    domainEvent.Amount.Amount,
                    domainEvent.NewBalance.Amount,
                    domainEvent.TransactionId.Value,
                    notificationService,
                    cancellationToken);
                break;
            }
            case nameof(BonusAddedDomainEvent):
            {
                var domainEvent = DeserializeRequired<BonusAddedDomainEvent>(message);
                await NotifyWalletBalanceAsync(
                    domainEvent.WalletId.Value,
                    domainEvent.UserId.Value,
                    domainEvent.Amount.Amount,
                    domainEvent.NewBalance.Amount,
                    domainEvent.TransactionId.Value,
                    notificationService,
                    cancellationToken);
                break;
            }
            case nameof(WalletAdjustedDomainEvent):
            {
                var domainEvent = DeserializeRequired<WalletAdjustedDomainEvent>(message);
                await NotifyWalletBalanceAsync(
                    domainEvent.WalletId.Value,
                    domainEvent.UserId.Value,
                    domainEvent.Amount.Amount,
                    domainEvent.NewBalance.Amount,
                    domainEvent.TransactionId.Value,
                    notificationService,
                    cancellationToken);
                break;
            }

            case nameof(EventCreatedDomainEvent):
            {
                var domainEvent = DeserializeRequired<EventCreatedDomainEvent>(message);
                await NotifyFightEventAsync(domainEvent.EventId, dbContext, notificationService, cancellationToken);
                break;
            }
            case nameof(EventSyncedDomainEvent):
            {
                var domainEvent = DeserializeRequired<EventSyncedDomainEvent>(message);
                await NotifyFightEventAsync(domainEvent.EventId, dbContext, notificationService, cancellationToken);
                break;
            }
            case nameof(EventCancelledDomainEvent):
                _ = DeserializeRequired<EventCancelledDomainEvent>(message);
                break;
            case nameof(EventVoidedDomainEvent):
                _ = DeserializeRequired<EventVoidedDomainEvent>(message);
                break;
            case nameof(MarketCreatedDomainEvent):
                _ = DeserializeRequired<MarketCreatedDomainEvent>(message);
                break;
            case nameof(MarketSuspendedDomainEvent):
                _ = DeserializeRequired<MarketSuspendedDomainEvent>(message);
                break;
            case nameof(MarketResumedDomainEvent):
                _ = DeserializeRequired<MarketResumedDomainEvent>(message);
                break;
            case nameof(MarketVoidedDomainEvent):
                _ = DeserializeRequired<MarketVoidedDomainEvent>(message);
                break;
            case nameof(WalletCreatedDomainEvent):
                _ = DeserializeRequired<WalletCreatedDomainEvent>(message);
                break;
            default:
                throw new NotSupportedException($"Outbox event type '{message.Type}' has no registered dispatcher.");
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
        {
            throw new InvalidOperationException($"Event {eventId} referenced by an outbox message was not found.");
        }

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

    private static Task NotifyWalletBalanceAsync(
        Guid walletId,
        Guid userId,
        decimal amount,
        decimal newBalance,
        Guid transactionId,
        INotificationService notificationService,
        CancellationToken cancellationToken) =>
        notificationService.NotifyWalletBalanceUpdatedAsync(
            walletId,
            userId,
            amount,
            newBalance,
            transactionId,
            cancellationToken);

    private static TEvent DeserializeRequired<TEvent>(OutboxMessage message)
        where TEvent : DomainEvent =>
        JsonSerializer.Deserialize<TEvent>(message.Payload, JsonOptions)
        ?? throw new JsonException($"Payload for outbox message {message.Id} was empty.");

    private static string Truncate(string value, int maxLength) =>
        value.Length <= maxLength ? value : value[..maxLength];
}

public sealed class OutboxProcessorOptions
{
    public int BatchSize { get; set; } = 50;
    public TimeSpan PollInterval { get; set; } = TimeSpan.FromSeconds(5);
    public int MaxRetries { get; set; } = 10;
}
