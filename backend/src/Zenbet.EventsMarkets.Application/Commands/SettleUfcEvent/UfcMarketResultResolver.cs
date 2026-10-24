namespace Zenbet.EventsMarkets.Application.Commands.SettleUfcEvent;

using Zenbet.EventsMarkets.Domain.Aggregates;
using Zenbet.EventsMarkets.Domain.Enums;

/// <summary>
/// Traduce el resultado oficial de un combate a la selección ganadora de cada
/// familia de mercados MMA. Es deliberadamente puro para poder probar las
/// reglas sin base de datos ni reloj.
/// </summary>
public static class UfcMarketResultResolver
{
    public static Selection? ResolveWinner(
        Market market,
        FightCorner winnerCorner,
        MmaVictoryMethod method,
        int finishRound)
    {
        ArgumentNullException.ThrowIfNull(market);

        var winnerCode = winnerCorner == FightCorner.Red ? "red" : "blue";

        return market.Type switch
        {
            MarketType.MmaMoneyline =>
                FindByCode(market, winnerCode),

            MarketType.MmaMethodOfVictory =>
                FindByCode(market, $"{winnerCode}_{MethodCode(method)}"),

            MarketType.MmaTotalRounds =>
                ResolveTotalRounds(market, finishRound),

            MarketType.MmaGoToDecision =>
                FindByCode(market, method == MmaVictoryMethod.Decision ? "yes" : "no"),

            _ => null,
        };
    }

    public static string MethodCode(MmaVictoryMethod method) => method switch
    {
        MmaVictoryMethod.Knockout => "ko",
        MmaVictoryMethod.Submission => "submission",
        MmaVictoryMethod.Decision => "decision",
        _ => throw new ArgumentOutOfRangeException(nameof(method), "Método de victoria no soportado."),
    };

    private static Selection? ResolveTotalRounds(Market market, int finishRound)
    {
        if (market.Line is null) return null;

        if (finishRound > market.Line.Value)
            return FindByCode(market, "over");

        if (finishRound < market.Line.Value)
            return FindByCode(market, "under");

        // Las líneas de asaltos se publican en .5, así que un empate exacto
        // solo puede ocurrir con datos inválidos.
        return null;
    }

    private static Selection? FindByCode(Market market, string code) =>
        market.Selections.FirstOrDefault(selection =>
            string.Equals(selection.Code, code, StringComparison.OrdinalIgnoreCase));
}
