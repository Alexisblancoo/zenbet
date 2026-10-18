namespace Zenbet.EventsMarkets.Domain.Aggregates;

using System.Diagnostics.CodeAnalysis;
using Zenbet.EventsMarkets.Domain.ValueObjects;
using Zenbet.EventsMarkets.Domain.Events;
using Zenbet.EventsMarkets.Domain.Enums;
using Zenbet.EventsMarkets.Domain.Exceptions;
using Zenbet.EventsMarkets.Domain.Common;

public sealed class Market : AggregateRoot<MarketId>
{
    private readonly List<Selection> _selections = new();
    private MarketStatus _status;
    private SettlementResult? _settlementResultValue;
    private SelectionId? _winnerSelectionId;

    private Market() { } // EF Core

    [SetsRequiredMembers]
    public Market(MarketId id, EventId eventId, string name, MarketType type, IReadOnlyList<Selection> selections)
        : base(id)
    {
        EventId = eventId;
        Name = name ?? throw new ArgumentNullException(nameof(name));
        Type = type;
        _status = MarketStatus.Open;
        _selections.AddRange(selections ?? throw new ArgumentNullException(nameof(selections)));

        AddDomainEvent(new MarketCreatedDomainEvent(Id, EventId, Name, Type));
    }

    public EventId EventId { get; private set; }
    public required string Name { get; init; }
    public required MarketType Type { get; init; }
    public MarketStatus Status => _status;
    public SettlementResult? MarketSettlementResult => _settlementResultValue;
    public SelectionId? WinnerSelectionId => _winnerSelectionId;
    public IReadOnlyCollection<Selection> Selections => _selections.AsReadOnly();

    public void UpdateSelectionOdds(SelectionId selectionId, Odd newOdd, DateTimeOffset timestamp)
    {
        if (_status != MarketStatus.Open)
            throw new InvalidOperationException($"Cannot update odds for market in status {_status}");

        var selection = _selections.FirstOrDefault(s => s.Id == selectionId)
            ?? throw new SelectionNotFoundException(selectionId);

        var oldOdd = selection.CurrentOdd;
        selection.UpdateOdd(newOdd, timestamp);

        AddDomainEvent(new OddsChangedDomainEvent(Id, selectionId, oldOdd, newOdd, timestamp));
    }

    public void Suspend(string reason)
    {
        if (_status != MarketStatus.Open)
            throw new InvalidOperationException($"Cannot suspend market in status {_status}");

        _status = MarketStatus.Suspended;
        AddDomainEvent(new MarketSuspendedDomainEvent(Id, reason));
    }

    public void Resume()
    {
        if (_status != MarketStatus.Suspended)
            throw new InvalidOperationException($"Cannot resume market in status {_status}");

        _status = MarketStatus.Open;
        AddDomainEvent(new MarketResumedDomainEvent(Id));
    }

    public void Settle(SelectionId winnerSelectionId, SettlementResult result, string? settledBy = null)
    {
        if (_status == MarketStatus.Settled)
            throw new MarketAlreadySettledException(Id);

        if (_status == MarketStatus.Void)
            throw new InvalidOperationException("Cannot settle a voided market");

        if (!_selections.Any(s => s.Id == winnerSelectionId))
            throw new SelectionNotFoundException(winnerSelectionId);

        _status = MarketStatus.Settled;
        _settlementResultValue = result;
        _winnerSelectionId = winnerSelectionId;

        foreach (var selection in _selections)
        {
            var selectionResult = selection.Id == winnerSelectionId ? SettlementResult.Won : SettlementResult.Lost;
            selection.Settle(selectionResult);
        }

        AddDomainEvent(new MarketSettledDomainEvent(Id, EventId, winnerSelectionId, result, settledBy, DateTimeOffset.UtcNow));
    }

    public void Void(string reason, string? voidedBy = null)
    {
        if (_status == MarketStatus.Settled)
            throw new InvalidOperationException("Cannot void a settled market");

        _status = MarketStatus.Void;
        _settlementResultValue = SettlementResult.Void;

        foreach (var selection in _selections)
        {
            selection.Settle(SettlementResult.Void);
        }

        AddDomainEvent(new MarketVoidedDomainEvent(Id, EventId, reason, voidedBy, DateTimeOffset.UtcNow));
    }
}

public sealed class Selection : Entity<SelectionId>
{
    private Selection() { } // EF Core

    [SetsRequiredMembers]
    public Selection(SelectionId id, string name, Odd initialOdd)
        : base(id)
    {
        Name = name ?? throw new ArgumentNullException(nameof(name));
        CurrentOdd = initialOdd;
        SettlementResult = null;
    }

    public required string Name { get; init; }
    public Odd CurrentOdd { get; private set; }
    public SettlementResult? SettlementResult { get; private set; }

    public void UpdateOdd(Odd newOdd, DateTimeOffset timestamp)
    {
        CurrentOdd = newOdd with { Timestamp = timestamp };
    }

    public void Settle(SettlementResult result)
    {
        SettlementResult = result;
    }
}