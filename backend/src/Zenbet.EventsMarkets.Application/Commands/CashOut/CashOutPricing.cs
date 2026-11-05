namespace Zenbet.EventsMarkets.Application.Commands.CashOut;

using Zenbet.EventsMarkets.Domain.Exceptions;
using Zenbet.EventsMarkets.Domain.ValueObjects;

/// <summary>
/// Regla de precio del Dynamic Cashout Engine.
///
/// <para>
/// Valor bruto = (Cuota Actual / Cuota Inicial) * Stake * Margen de Retención.
/// El margen representa lo que retiene la casa antes de acreditar el saldo real.
/// </para>
/// </summary>
public static class CashOutPricing
{
    /// <summary>Margen de retención por defecto de la casa (90%).</summary>
    public const decimal DefaultRetentionMargin = 0.90m;

    /// <summary>
    /// Calcula el importe de Cash Out redondeado a centavos (alejado de cero,
    /// que es el criterio contable del ledger).
    /// </summary>
    /// <exception cref="InvalidTransactionAmountException">
    /// Si el stake no es positivo, las cuotas están fuera de rango o el margen
    /// no está en el intervalo (0, 1].
    /// </exception>
    public static Money Calculate(
        Money stake,
        decimal initialOdds,
        decimal currentOdds,
        decimal retentionMargin = DefaultRetentionMargin)
    {
        if (stake <= Money.Zero)
            throw new InvalidTransactionAmountException("Cash out stake must be positive");

        if (initialOdds <= 1m)
            throw new InvalidTransactionAmountException("Initial odds must be greater than 1");

        if (currentOdds < 1m)
            throw new InvalidTransactionAmountException("Current odds must be at least 1");

        if (retentionMargin is <= 0m or > 1m)
            throw new InvalidTransactionAmountException("Retention margin must be between 0 and 1");

        var value = Math.Round(
            (currentOdds / initialOdds) * stake.Amount * retentionMargin,
            2,
            MidpointRounding.AwayFromZero);

        return new Money(value);
    }
}
