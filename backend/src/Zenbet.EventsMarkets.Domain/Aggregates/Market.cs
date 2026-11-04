namespace Zenbet.EventsMarkets.Domain.Aggregates;

using System.Diagnostics.CodeAnalysis;
using Zenbet.EventsMarkets.Domain.ValueObjects;
using Zenbet.EventsMarkets.Domain.Events;
using Zenbet.EventsMarkets.Domain.Enums;
using Zenbet.EventsMarkets.Domain.Exceptions;
using Zenbet.EventsMarkets.Domain.Common;

public sealed class Market : AggregateRoot<MarketId>
{
    public const decimal RiskSuspensionThresholdRatio = 0.95m;
    private static readonly Money DefaultMaxLiabilityLimit = new(10000m);

    private readonly List<Selection> _selections = new();
    private MarketStatus _status;
    private SettlementResult? _settlementResultValue;
    private SelectionId? _winnerSelectionId;

    private Market() { } // EF Core

    [SetsRequiredMembers]
    public Market(
        MarketId id,
        EventId eventId,
        string name,
        MarketType type,
        IReadOnlyList<Selection> selections,
        decimal? line = null,
        int displayOrder = 0,
        MarketProvenance? provenance = null,
        Money? maxLiabilityLimit = null)
        : base(id)
    {
        EventId = eventId;
        Name = name ?? throw new ArgumentNullException(nameof(name));
        Type = type;
        Line = line;
        DisplayOrder = displayOrder;
        Provenance = provenance;
        MaxLiabilityLimit = maxLiabilityLimit is { Amount: > 0m } ? maxLiabilityLimit.Value : DefaultMaxLiabilityLimit;
        IsSuspendedByRisk = false;
        _status = MarketStatus.Open;
        _selections.AddRange(selections ?? throw new ArgumentNullException(nameof(selections)));

        AddDomainEvent(new MarketCreatedDomainEvent(Id, EventId, Name, Type));
    }

    public EventId EventId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public required MarketType Type { get; init; }
    public decimal? Line { get; private set; }
    public int DisplayOrder { get; private set; }
    public MarketProvenance? Provenance { get; private set; }
    public Money MaxLiabilityLimit { get; private set; }
    public bool IsSuspendedByRisk { get; private set; }
    public MarketStatus Status => _status;
    public SettlementResult? MarketSettlementResult => _settlementResultValue;
    public SelectionId? WinnerSelectionId => _winnerSelectionId;
    public IReadOnlyCollection<Selection> Selections => _selections.AsReadOnly();

    /// <summary>
    /// Exposición agregada actual del mercado (suma de <see cref="Selection.CurrentLiability"/>).
    /// </summary>
    public Money CurrentMarketLiability =>
        _selections.Aggregate(Money.Zero, static (acc, selection) => acc + selection.CurrentLiability);

    /// <summary>
    /// Porcentaje de utilización del límite de riesgo (<c>0.00</c> a <c>100.00</c>).
    /// </summary>
    public decimal LiabilityUtilizationPercentage =>
        MaxLiabilityLimit.Amount <= 0m
            ? 0m
            : decimal.Round((CurrentMarketLiability.Amount / MaxLiabilityLimit.Amount) * 100m, 2, MidpointRounding.ToEven);

    public void ConfigureMaxLiabilityLimit(Money maxLiabilityLimit)
    {
        if (maxLiabilityLimit <= Money.Zero)
            throw new InvalidTransactionAmountException("MaxLiabilityLimit debe ser mayor a cero.");

        MaxLiabilityLimit = maxLiabilityLimit;
    }

    /// <summary>
    /// Regla pura del Motor de Riesgo y Exposición (Circuit Breaker):
    /// Evalúa si el retorno potencial de la nueva apuesta supera <see cref="MaxLiabilityLimit"/>.
    /// <list type="bullet">
    /// <item><description>Si supera el 100% del límite, lanza <see cref="MaxMarketExposureExceededException"/> (subclase de <see cref="RiskLimitExceededException"/>).</description></item>
    /// <item><description>Si es válido, actualiza atómicamente el acumulador <see cref="SelectionLiability"/> de la selección.</description></item>
    /// <item><description>Si la exposición acumulada alcanza o supera el 95% (<see cref="RiskSuspensionThresholdRatio"/>), suspende automáticamente el mercado y emite <see cref="MarketSuspendedByRiskDomainEvent"/>.</description></item>
    /// </list>
    /// </summary>
    public SelectionLiability RegisterBetExposure(
        SelectionId selectionId,
        Money stake,
        decimal acceptedOdds,
        Money? maxLiabilityLimitOverride = null)
    {
        if (stake <= Money.Zero)
            throw new InvalidTransactionAmountException("El monto de la apuesta debe ser positivo.");

        if (acceptedOdds <= 1m)
            throw new InvalidTransactionAmountException("La cuota aceptada debe ser mayor a 1.00.");

        var selection = _selections.FirstOrDefault(s => s.Id == selectionId)
            ?? throw new SelectionNotFoundException(selectionId);

        var effectiveLimit = maxLiabilityLimitOverride is { Amount: > 0m }
            ? maxLiabilityLimitOverride.Value
            : (MaxLiabilityLimit > Money.Zero ? MaxLiabilityLimit : DefaultMaxLiabilityLimit);

        if (MaxLiabilityLimit <= Money.Zero || (maxLiabilityLimitOverride is { Amount: > 0m } && MaxLiabilityLimit != effectiveLimit))
        {
            MaxLiabilityLimit = effectiveLimit;
        }

        var potentialPayout = new Money(decimal.Round(stake.Amount * acceptedOdds, 2, MidpointRounding.ToEven));
        var currentExposure = CurrentMarketLiability;
        var projectedExposure = currentExposure + potentialPayout;

        if (projectedExposure > effectiveLimit)
        {
            throw new MaxMarketExposureExceededException(
                Id,
                currentExposure,
                potentialPayout,
                effectiveLimit);
        }

        var updatedLiability = selection.RegisterExposure(stake, acceptedOdds);

        var thresholdAmount = decimal.Round(effectiveLimit.Amount * RiskSuspensionThresholdRatio, 2, MidpointRounding.ToEven);
        if (projectedExposure.Amount >= thresholdAmount && _status == MarketStatus.Open)
        {
            IsSuspendedByRisk = true;
            _status = MarketStatus.Suspended;

            var utilizationPercent = decimal.Round((projectedExposure.Amount / effectiveLimit.Amount) * 100m, 2, MidpointRounding.ToEven);

            AddDomainEvent(new MarketSuspendedByRiskDomainEvent(
                Id,
                EventId,
                selectionId,
                projectedExposure,
                effectiveLimit,
                utilizationPercent,
                DateTimeOffset.UtcNow));

            AddDomainEvent(new MarketSuspendedDomainEvent(
                Id,
                $"Circuit Breaker: Exposición de riesgo alcanzó el {utilizationPercent:F2}% ({projectedExposure}/{effectiveLimit})."));
        }

        return updatedLiability;
    }

    public void UpdatePresentation(string name, decimal? line, int displayOrder)
    {
        if (_status is MarketStatus.Settled or MarketStatus.Void)
            throw new InvalidOperationException($"Cannot update presentation for market in status {_status}.");

        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("El mercado necesita un nombre.", nameof(name));

        if (line is < 0m)
            throw new ArgumentOutOfRangeException(nameof(line), "La línea no puede ser negativa.");

        var normalizedName = name.Trim();
        var changed = !string.Equals(Name, normalizedName, StringComparison.Ordinal) ||
            Line != line || DisplayOrder != displayOrder;
        Name = normalizedName;
        Line = line;
        DisplayOrder = displayOrder;
        if (changed)
            AddDomainEvent(new MarketPresentationUpdatedDomainEvent(Id, EventId, Name, DateTimeOffset.UtcNow));
    }

    public void SetProvenance(MarketProvenance provenance)
    {
        Provenance = provenance ?? throw new ArgumentNullException(nameof(provenance));
    }

    public void AddSelection(Selection selection)
    {
        ArgumentNullException.ThrowIfNull(selection);

        if (_status is MarketStatus.Settled or MarketStatus.Void)
            throw new InvalidOperationException($"Cannot add a selection to market in status {_status}.");

        if (_selections.Any(existing => existing.Id == selection.Id))
            throw new InvalidOperationException($"La selección {selection.Id.Value} ya existe en el mercado.");

        _selections.Add(selection);
    }

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

        IsSuspendedByRisk = false;
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

    /// <summary>
    /// Re-liquida un mercado previamente cerrado o anulado ante una corrección oficial
    /// (ej. fallo de VAR, descalificación post-combate o rectificación del feed oficial).
    /// </summary>
    public void Resettle(
        SelectionId newWinnerSelectionId,
        SettlementResult newResult,
        string reason,
        string? resettledBy = null)
    {
        if (_status is not MarketStatus.Settled and not MarketStatus.Void)
            throw new InvalidOperationException($"Solo un mercado liquidado o anulado puede re-liquidarse (estado actual: {_status}).");

        if (string.IsNullOrWhiteSpace(reason))
            throw new ArgumentException("Se requiere un motivo oficial de auditoría para re-liquidar el mercado.", nameof(reason));

        if (!_selections.Any(s => s.Id == newWinnerSelectionId))
            throw new SelectionNotFoundException(newWinnerSelectionId);

        var previousWinnerId = _winnerSelectionId;
        _status = newResult is SettlementResult.Void ? MarketStatus.Void : MarketStatus.Settled;
        _settlementResultValue = newResult;
        _winnerSelectionId = newWinnerSelectionId;

        foreach (var selection in _selections)
        {
            var selectionResult = newResult is SettlementResult.Void or SettlementResult.Push
                ? newResult
                : (selection.Id == newWinnerSelectionId ? SettlementResult.Won : SettlementResult.Lost);

            selection.Settle(selectionResult);
        }

        AddDomainEvent(new MarketResettledDomainEvent(
            Id,
            EventId,
            previousWinnerId,
            newWinnerSelectionId,
            newResult,
            reason.Trim(),
            resettledBy,
            DateTimeOffset.UtcNow));
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
    public Selection(SelectionId id, string name, Odd initialOdd, string? code = null, int displayOrder = 0)
        : base(id)
    {
        Name = name ?? throw new ArgumentNullException(nameof(name));
        Code = code;
        DisplayOrder = displayOrder;
        CurrentOdd = initialOdd;
        TotalStaked = Money.Zero;
        CurrentLiability = Money.Zero;
        ActiveBetCount = 0;
        SettlementResult = null;
    }

    public string Name { get; private set; } = string.Empty;
    public string? Code { get; private set; }
    public int DisplayOrder { get; private set; }
    public Odd CurrentOdd { get; private set; }
    public Money TotalStaked { get; private set; }
    public Money CurrentLiability { get; private set; }
    public int ActiveBetCount { get; private set; }
    public SettlementResult? SettlementResult { get; private set; }

    public SelectionLiability Liability =>
        new(Id, TotalStaked, CurrentLiability, ActiveBetCount);

    public SelectionLiability RegisterExposure(Money stake, decimal acceptedOdds)
    {
        var updated = Liability.AccumulateBet(stake, acceptedOdds);
        TotalStaked = updated.TotalStaked;
        CurrentLiability = updated.PotentialPayout;
        ActiveBetCount = updated.ActiveBetCount;
        return updated;
    }

    public void UpdateMetadata(string name, string? code, int displayOrder)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("La selección necesita un nombre.", nameof(name));

        Name = name.Trim();
        Code = string.IsNullOrWhiteSpace(code) ? null : code.Trim();
        DisplayOrder = displayOrder;
    }

    public void UpdateOdd(Odd newOdd, DateTimeOffset timestamp)
    {
        CurrentOdd = newOdd with { Timestamp = timestamp };
    }

    public void UpdateOdds(Odd newOdd)
    {
        CurrentOdd = newOdd;
    }

    public void UpdateOdds(Odd newOdd, DateTimeOffset timestamp)
    {
        CurrentOdd = newOdd with { Timestamp = timestamp };
    }

    public void Settle(SettlementResult result)
    {
        SettlementResult = result;
    }
}
