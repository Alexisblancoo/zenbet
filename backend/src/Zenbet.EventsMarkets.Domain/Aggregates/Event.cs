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
    public Event(
        EventId id,
        string name,
        SportType sportType,
        DateTimeOffset startTime,
        string? competition = null,
        MmaBout? bout = null)
        : base(id)
    {
        Name = name ?? throw new ArgumentNullException(nameof(name));

        if (bout is not null && sportType != SportType.MixedMartialArts)
            throw new ArgumentException("Solo los eventos de MMA pueden tener metadatos de combate.", nameof(bout));

        SportType = sportType;
        StartTime = startTime;
        Competition = competition;
        Bout = bout;
        Status = EventStatus.Scheduled;
        Version = 0; // Optimistic concurrency
    }

    public required string Name { get; init; }
    public required SportType SportType { get; init; }
    public required DateTimeOffset StartTime { get; init; }
    public string? Competition { get; init; }
    public MmaBout? Bout { get; private set; }

    /// <summary>Resultado oficial del combate, una vez registrado por operaciones.</summary>
    public MmaResult? Result { get; private set; }

    public EventStatus Status { get; private set; }
    public uint Version { get; private set; } // Optimistic concurrency token
    public IReadOnlyCollection<Market> Markets => _markets.AsReadOnly();

    public Market AddMarket(string name, MarketType type, IReadOnlyList<Selection> selections)
        => AddMarket(MarketId.New(), name, type, selections);

    public Market AddMarket(
        MarketId id,
        string name,
        MarketType type,
        IReadOnlyList<Selection> selections,
        decimal? line = null,
        int displayOrder = 0,
        MarketProvenance? provenance = null)
    {
        if (Status == EventStatus.Finished || Status == EventStatus.Cancelled || Status == EventStatus.Void)
            throw new InvalidOperationException($"Cannot add market to event in status {Status}");

        var market = new Market(id, Id, name, type, selections, line, displayOrder, provenance);
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

    /// <summary>
    /// Registra el resultado oficial y cierra el evento. Un segundo resultado
    /// idéntico es idempotente; uno distinto se rechaza para no reescribir una
    /// liquidación ya ejecutada.
    /// </summary>
    public void RecordResult(MmaResult result)
    {
        ArgumentNullException.ThrowIfNull(result);

        if (SportType != SportType.MixedMartialArts || Bout is null)
            throw new InvalidOperationException("Solo un combate de MMA puede registrar un resultado.");

        if (Status is EventStatus.Cancelled or EventStatus.Void)
            throw new InvalidOperationException($"No se puede registrar un resultado para un evento {Status}.");

        if (result.Round > Bout.ScheduledRounds)
            throw new ArgumentOutOfRangeException(
                nameof(result),
                $"El resultado declara el asalto {result.Round}, pero el combate es a {Bout.ScheduledRounds}.");

        if (result.Method == MmaVictoryMethod.Decision && result.Round != Bout.ScheduledRounds)
            throw new ArgumentException(
                "Una decisión debe registrarse en el último asalto programado.",
                nameof(result));

        if (Result is not null)
        {
            if (Result.Matches(result.WinnerCorner, result.Method, result.Round)) return;

            throw new InvalidOperationException(
                "El evento ya tiene un resultado oficial distinto. No se puede reescribir.");
        }

        Result = result;

        if (Status is not EventStatus.Finished and not EventStatus.Cancelled and not EventStatus.Void)
            UpdateStatus(EventStatus.Finished);
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