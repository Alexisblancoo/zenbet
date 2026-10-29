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
        AddDomainEvent(new EventCreatedDomainEvent(Id, Name, SportType, StartTime, Competition));
    }

    public string Name { get; private set; } = string.Empty;
    public SportType SportType { get; private set; }
    public DateTimeOffset StartTime { get; private set; }
    public string? Competition { get; private set; }
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

    /// <summary>Applies a provider snapshot while preserving settlement state.</summary>
    public bool SynchronizeFromProvider(string name, DateTimeOffset startTime, string? competition, MmaBout? bout)
    {
        if (Status is EventStatus.Finished or EventStatus.Cancelled or EventStatus.Void)
            return false;
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("An event name is required.", nameof(name));
        if (SportType != SportType.MixedMartialArts)
            throw new InvalidOperationException("Only MMA events can be synchronized from an MMA provider.");

        var normalizedCompetition = string.IsNullOrWhiteSpace(competition) ? null : competition.Trim();
        var boutChanged = bout is not null && (Bout is null ||
            FighterChanged(Bout.Red, bout.Red) ||
            FighterChanged(Bout.Blue, bout.Blue) ||
            Bout.Division != bout.Division ||
            Bout.ScheduledRounds != bout.ScheduledRounds ||
            Bout.IsTitleFight != bout.IsTitleFight ||
            Bout.Billing != bout.Billing ||
            Bout.BillingOrder != bout.BillingOrder ||
            !string.Equals(Bout.Venue, bout.Venue, StringComparison.Ordinal) ||
            !string.Equals(Bout.Location, bout.Location, StringComparison.Ordinal));
        var changed = !string.Equals(Name, name.Trim(), StringComparison.Ordinal) ||
            StartTime != startTime ||
            !string.Equals(Competition, normalizedCompetition, StringComparison.Ordinal) ||
            boutChanged;

        Name = name.Trim();
        StartTime = startTime;
        Competition = normalizedCompetition;
        if (boutChanged)
            Bout = bout;

        if (changed)
            AddDomainEvent(new EventSyncedDomainEvent(Id, Name, StartTime, Competition, DateTimeOffset.UtcNow));
        return changed;
    }

    private static bool FighterChanged(Fighter current, Fighter incoming) =>
        !string.Equals(current.Id, incoming.Id, StringComparison.Ordinal) ||
        !string.Equals(current.Name, incoming.Name, StringComparison.Ordinal) ||
        !string.Equals(current.CountryCode, incoming.CountryCode, StringComparison.Ordinal) ||
        !string.Equals(current.Country, incoming.Country, StringComparison.Ordinal) ||
        !string.Equals(current.Record, incoming.Record, StringComparison.Ordinal) ||
        !string.Equals(current.Rank, incoming.Rank, StringComparison.Ordinal) ||
        current.Division != incoming.Division ||
        !string.Equals(current.ImageUrl, incoming.ImageUrl, StringComparison.Ordinal) ||
        current.ReachInches != incoming.ReachInches ||
        current.Stance != incoming.Stance ||
        current.TakedownDefensePercent != incoming.TakedownDefensePercent ||
        current.StrikingAccuracyPercent != incoming.StrikingAccuracyPercent;

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
