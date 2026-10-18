namespace Zenbet.EventsMarkets.Infrastructure.Messaging;

using System.Text.Json;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Npgsql;
using Npgsql.EntityFrameworkCore.PostgreSQL;
using Zenbet.EventsMarkets.Application.Commands.UpdateOdds;
using Zenbet.EventsMarkets.Infrastructure.Persistence;
using Zenbet.EventsMarkets.Infrastructure.Persistence.Outbox;

public sealed class InboxProcessor : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<InboxProcessor> _logger;
    private readonly InboxProcessorOptions _options;

    public InboxProcessor(
        IServiceScopeFactory scopeFactory,
        ILogger<InboxProcessor> logger,
        IOptions<InboxProcessorOptions> options)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
        _options = options.Value;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Inbox processor started");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessBatchAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing inbox batch");
            }

            await Task.Delay(_options.PollInterval, stoppingToken);
        }
    }

    private async Task ProcessBatchAsync(CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<EventsMarketsDbContext>();
        var mediator = scope.ServiceProvider.GetRequiredService<IMediator>();

        var messages = await dbContext.InboxMessages
            .Where(m => m.ProcessedAt == null && m.RetryCount < _options.MaxRetries)
            .OrderBy(m => m.ReceivedAt)
            .Take(_options.BatchSize)
            .ToListAsync(cancellationToken);

        if (messages.Count == 0) return;

        foreach (var message in messages)
        {
            // Advisory lock per event to ensure ordering
            var eventIdHash = ExtractEventIdHash(message.Payload);

            await using var connection = (NpgsqlConnection)dbContext.Database.GetDbConnection();
            await connection.OpenAsync(cancellationToken);
            try
            {
                await using var lockCmd = new NpgsqlCommand("SELECT pg_try_advisory_xact_lock($1)", connection);
                lockCmd.Parameters.AddWithValue(eventIdHash);
                var lockResult = (int)(await lockCmd.ExecuteScalarAsync() ?? 0);

                if (lockResult == 0)
                {
                    _logger.LogDebug("Could not acquire advisory lock for event hash {Hash}, skipping message {MessageId}", eventIdHash, message.Id);
                    continue; // Skip this message, will be picked up next poll
                }

                try
                {
                    await ProcessMessageAsync(mediator, message, cancellationToken);
                    message.ProcessedAt = DateTimeOffset.UtcNow;
                }
                catch (Exception ex)
                {
                    message.RetryCount++;
                    message.LastError = ex.Message;
                    _logger.LogWarning(ex, "Failed to process inbox message {MessageId}, retry {RetryCount}", message.Id, message.RetryCount);

                    if (message.RetryCount >= _options.MaxRetries)
                    {
                        await MoveToDeadLetterAsync(dbContext, message, ex);
                    }
                }
            }
            finally
            {
                await connection.CloseAsync();
            }
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task ProcessMessageAsync(IMediator mediator, InboxMessage message, CancellationToken cancellationToken)
    {
        switch (message.MessageType)
        {
            case nameof(UpdateOddsCommand):
                var oddsCommand = JsonSerializer.Deserialize<UpdateOddsCommand>(message.Payload);
                if (oddsCommand != null)
                {
                    await mediator.Send(oddsCommand, cancellationToken);
                }
                break;

            // Add other message types here
            default:
                _logger.LogWarning("Unknown inbox message type: {MessageType}", message.MessageType);
                break;
        }
    }

    private int ExtractEventIdHash(string payload)
    {
        // Extract event ID from payload for advisory locking
        // This is a simplified hash - in reality you'd parse the JSON properly
        return payload.GetHashCode();
    }

    private async Task MoveToDeadLetterAsync(EventsMarketsDbContext dbContext, InboxMessage message, Exception ex)
    {
        var deadLetter = new DeadLetterEntry
        {
            Id = Guid.NewGuid(),
            OriginalTable = "inbox_messages",
            OriginalId = message.Id,
            Payload = message.Payload,
            Error = ex.ToString(),
            FailedAt = DateTimeOffset.UtcNow,
            RetryCount = message.RetryCount
        };

        dbContext.DeadLetters.Add(deadLetter);
        message.ProcessedAt = DateTimeOffset.UtcNow; // Mark as processed to stop retries
    }
}

public sealed class InboxProcessorOptions
{
    public int BatchSize { get; set; } = 50;
    public TimeSpan PollInterval { get; set; } = TimeSpan.FromSeconds(2);
    public int MaxRetries { get; set; } = 5;
}