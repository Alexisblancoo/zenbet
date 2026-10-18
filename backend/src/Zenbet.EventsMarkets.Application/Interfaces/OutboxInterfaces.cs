namespace Zenbet.EventsMarkets.Application.Interfaces;

using Zenbet.EventsMarkets.Domain.Events;

public interface IOutboxWriter
{
    Task WriteAsync(DomainEvent domainEvent, CancellationToken cancellationToken = default);
}

public interface IInboxWriter
{
    Task WriteAsync(string source, string messageType, string payload, string? headers, CancellationToken cancellationToken = default);
}