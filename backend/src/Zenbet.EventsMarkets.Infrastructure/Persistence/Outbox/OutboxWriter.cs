namespace Zenbet.EventsMarkets.Infrastructure.Persistence.Outbox;

using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Zenbet.EventsMarkets.Application.Interfaces;
using Zenbet.EventsMarkets.Domain.Events;
using Zenbet.EventsMarkets.Infrastructure.Persistence;

public sealed class OutboxWriter : IOutboxWriter
{
    private readonly EventsMarketsDbContext _dbContext;
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false
    };

    public OutboxWriter(EventsMarketsDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task WriteAsync(DomainEvent domainEvent, CancellationToken cancellationToken = default)
    {
        var payload = JsonSerializer.Serialize(domainEvent, domainEvent.GetType(), JsonOptions);

        var outboxMessage = new OutboxMessage
        {
            Id = Guid.NewGuid(),
            Type = domainEvent.GetType().Name,
            Payload = payload,
            CorrelationId = domainEvent.CorrelationId,
            CreatedAt = domainEvent.OccurredAt,
            RetryCount = 0
        };

        await _dbContext.OutboxMessages.AddAsync(outboxMessage, cancellationToken);
    }
}

public sealed class InboxWriter : IInboxWriter
{
    private readonly EventsMarketsDbContext _dbContext;

    public InboxWriter(EventsMarketsDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task WriteAsync(string source, string messageType, string payload, string? headers, CancellationToken cancellationToken = default)
    {
        var inboxMessage = new InboxMessage
        {
            Id = Guid.NewGuid(),
            Source = source,
            MessageType = messageType,
            Payload = payload,
            Headers = headers,
            ReceivedAt = DateTimeOffset.UtcNow,
            RetryCount = 0
        };

        await _dbContext.InboxMessages.AddAsync(inboxMessage, cancellationToken);
    }
}