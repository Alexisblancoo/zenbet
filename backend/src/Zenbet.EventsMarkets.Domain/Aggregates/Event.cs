namespace Zenbet.EventsMarkets.Domain.Aggregates;

using System.Diagnostics.CodeAnalysis;
using Zenbet.EventsMarkets.Domain.ValueObjects;
using Zenbet.EventsMarkets.Domain.Events;
using Zenbet.EventsMarkets.Domain.Enums;
using Zenbet.EventsMarkets.Domain.Exceptions;
using Zenbet.EventsMarkets.Domain.Common;

public sealed class Event : AggregateRoot<EventId>
{
    private readonly List<Market> _markets = new();

    private Event() { } // EF Core

    [SetsRequiredMembers]
    public Event(EventId id, string name, SportType sportType, DateTimeOffset startTime, string? competition = null)
        : base(id)
    {
        Name = name ?? throw new ArgumentNullException(nameof(name));
        SportType = sportType;
        StartTime = startTime;
        Competition = competition;
        Status = EventStatus.Scheduled;
        Version = 0; // Optimistic concurrency
    }

    public required string Name { get; init; }
    public required SportType SportType { get; init; }
    public required DateTimeOffset StartTime { get; init; }
    public string? Competition { get; init; }
    public EventStatus Status { get; private set; }
    public uint Version { get; private set; } // Optimistic concurrency token
    public IReadOnlyCollection<Market> Markets => _markets.AsReadOnly();

    public Market AddMarket(string name, MarketType type, IReadOnlyList<Selection> selections)
    {
        if (Status == EventStatus.Finished || Status == EventStatus.Cancelled || Status == EventStatus.Void)
            throw new InvalidOperationException($"Cannot add market to event in status {Status}");

        var market = new Market(MarketId.New(), Id, name, type, selections)
        {
            Name = name,
            Type = type
        };
        _markets.Add(market);

        // Re-emit domain events from market
        foreach (var domainEvent in market.DomainEvents)
            AddDomainEvent(domainEvent);

        market.ClearDomainEvents();
        return market;
    }

    public Market GetMarket(MarketId marketId)
        => _markets.FirstOrDefault(m => m.Id == marketId)
           ?? throw new MarketNotFoundException(marketId);

    public void UpdateStatus(EventStatus newStatus)
    {
        if (Status == newStatus) return;

        var oldStatus = Status;
        Status = newStatus;
        Version++; // Increment for optimistic concurrency

        AddDomainEvent(new EventStatusChangedDomainEvent(Id, oldStatus, newStatus, DateTimeOffset.UtcNow));
    }

    public void Start()
    {
        if (Status != EventStatus.Scheduled)
            throw new InvalidOperationException($"Cannot start event in status {Status}");

        UpdateStatus(EventStatus.Live);
    }

    public void Finish()
    {
        if (Status != EventStatus.Live)
            throw new InvalidOperationException($"Cannot finish event in status {Status}");

        UpdateStatus(EventStatus.Finished);
    }

    public void Cancel(string reason)
    {
        if (Status == EventStatus.Finished)
            throw new InvalidOperationException("Cannot cancel a finished event");

        UpdateStatus(EventStatus.Cancelled);
        AddDomainEvent(new EventCancelledDomainEvent(Id, reason, DateTimeOffset.UtcNow));
    }

    public void Void(string reason)
    {
        if (Status == EventStatus.Finished)
            throw new InvalidOperationException("Cannot void a finished event");

        UpdateStatus(EventStatus.Void);
        AddDomainEvent(new EventVoidedDomainEvent(Id, reason, DateTimeOffset.UtcNow));
    }
}