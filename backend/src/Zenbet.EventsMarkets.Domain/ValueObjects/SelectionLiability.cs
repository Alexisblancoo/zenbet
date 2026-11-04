namespace Zenbet.EventsMarkets.Domain.ValueObjects;

/// <summary>
/// Value Object inmutable que representa el acumulador de exposición financiera (Liability)
/// de una selección dentro de un mercado deportivo.
/// </summary>
public readonly record struct SelectionLiability
{
    public SelectionId SelectionId { get; init; }
    public Money TotalStaked { get; init; }
    public Money PotentialPayout { get; init; }
    public int ActiveBetCount { get; init; }

    public SelectionLiability(
        SelectionId selectionId,
        Money totalStaked,
        Money potentialPayout,
        int activeBetCount = 0)
    {
        if (activeBetCount < 0)
            throw new ArgumentOutOfRangeException(nameof(activeBetCount), "El conteo de apuestas activas no puede ser negativo.");

        SelectionId = selectionId;
        TotalStaked = totalStaked;
        PotentialPayout = potentialPayout;
        ActiveBetCount = activeBetCount;
    }

    /// <summary>
    /// Exposición neta de la casa en esta selección (<c>PotentialPayout - TotalStaked</c>).
    /// </summary>
    public Money NetProfitLiability =>
        PotentialPayout >= TotalStaked
            ? PotentialPayout - TotalStaked
            : Money.Zero;

    public static SelectionLiability Empty(SelectionId selectionId) =>
        new(selectionId, Money.Zero, Money.Zero, 0);

    public SelectionLiability AccumulateBet(Money stake, decimal acceptedOdds)
    {
        if (stake <= Money.Zero)
            throw new ArgumentOutOfRangeException(nameof(stake), "El stake debe ser positivo.");

        if (acceptedOdds <= 1m)
            throw new ArgumentOutOfRangeException(nameof(acceptedOdds), "La cuota debe ser mayor a 1.00.");

        var payoutLiability = new Money(decimal.Round(stake.Amount * acceptedOdds, 2, MidpointRounding.ToEven));
        return new SelectionLiability(
            SelectionId,
            TotalStaked + stake,
            PotentialPayout + payoutLiability,
            ActiveBetCount + 1);
    }
}

