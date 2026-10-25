namespace Zenbet.EventsMarkets.Domain.Aggregates;

using System.Diagnostics.CodeAnalysis;
using Zenbet.EventsMarkets.Domain.ValueObjects;
using Zenbet.EventsMarkets.Domain.Events;
using Zenbet.EventsMarkets.Domain.Enums;
using Zenbet.EventsMarkets.Domain.Exceptions;
using Zenbet.EventsMarkets.Domain.Common;

public sealed class Event : AggregateRoot<EventId>
{
    /// <summary>
    /// Ventana de seguridad para cerrar un combate sin resultado oficial. La
    /// UFC publica la hora de inicio de la cartelera, no la duración real de
    /// cada pelea; estos márgenes cubren walkouts, asaltos y decisiones sin
    /// dejar mercados abiertos indefinidamente.
    /// </summary>
    private static readonly TimeSpan FiveRoundWindow = TimeSpan.FromMinutes(75);
    private static readonly TimeSpan ThreeRoundWindow = TimeSpan.FromMinutes(60);

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

    /// <summary>
    /// Cierre estimado del combate. Es una ventana de seguridad, no la hora
    /// oficial de finalización: el resultado registrado por operaciones tiene
    /// prioridad y cierra el evento de inmediato.
    /// </summary>
    public DateTimeOffset ScheduledEndTime =>
        StartTime + (Bout is { ScheduledRounds: >= 5 } ? FiveRoundWindow : ThreeRoundWindow);

    /// <summary>
    /// Estado efectivo según el reloj. La persistencia sigue siendo la fuente
    /// de verdad; este cálculo evita que una API o una UI sin worker muestren
    /// mercados abiertos después de la ventana de seguridad.
    /// </summary>
    public EventStatus EffectiveStatus(DateTimeOffset now)
    {
        if (Status is EventStatus.Finished or EventStatus.Cancelled or EventStatus.Void)
            return Status;

        if (now >= ScheduledEndTime)
            return EventStatus.Finished;

        if (Status == EventStatus.Suspended)
            return EventStatus.Suspended;

        return now >= StartTime ? EventStatus.Live : EventStatus.Scheduled;
    }

    /// <summary>Un evento cerrado o fuera de su ventana ya no acepta apuestas.</summary>
    public bool IsExpired(DateTimeOffset now) =>
        Status is EventStatus.Finished or EventStatus.Cancelled or EventStatus.Void ||
        now >= ScheduledEndTime;

    /// <summary>Los mercados solo aceptan picks mientras el evento está abierto.</summary>
    public bool IsBettingOpen(DateTimeOffset now) =>
        (Status is EventStatus.Scheduled or EventStatus.Live) && !IsExpired(now);

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
            if (!Result.Matches(result.WinnerCorner, result.Method, result.Round))
            {
                throw new InvalidOperationException(
                    "El evento ya tiene un resultado oficial distinto. No se puede reescribir.");
            }

            // Reintento idempotente: si el resultado ya estaba guardado pero el
            // estado no llegó a cerrarse, completa la transición.
            if (Status is not EventStatus.Finished and not EventStatus.Cancelled and not EventStatus.Void)
                UpdateStatus(EventStatus.Finished);

            return;
        }

        Result = result;
        AddDomainEvent(new MmaResultRecordedDomainEvent(Id, result.RecordedAt));

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

    /// <summary>
    /// Cierra por vencimiento de la ventana de seguridad. Es idempotente para
    /// que el worker pueda reintentar tras un reinicio o una carrera con la
    /// ingesta del resultado oficial.
    /// </summary>
    public void Expire()
    {
        if (Status is EventStatus.Finished or EventStatus.Cancelled or EventStatus.Void)
            return;

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