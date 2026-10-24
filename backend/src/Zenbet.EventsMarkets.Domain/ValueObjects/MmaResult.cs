namespace Zenbet.EventsMarkets.Domain.ValueObjects;

using Zenbet.EventsMarkets.Domain.Enums;

/// <summary>
/// Resultado oficial de un combate de MMA. Se guarda junto al evento para que
/// la liquidación de mercados sea reproducible y auditable, no un efecto
/// efímero de una petición HTTP.
/// </summary>
public sealed class MmaResult
{
    private MmaResult() { } // EF Core

    private MmaResult(
        FightCorner winnerCorner,
        MmaVictoryMethod method,
        int round,
        DateTimeOffset recordedAt)
    {
        WinnerCorner = winnerCorner;
        Method = method;
        Round = round;
        RecordedAt = recordedAt;
    }

    public FightCorner WinnerCorner { get; private set; }
    public MmaVictoryMethod Method { get; private set; }
    public int Round { get; private set; }
    public DateTimeOffset RecordedAt { get; private set; }

    /// <summary>Código estable usado por las selecciones de los mercados.</summary>
    public string WinnerCode => WinnerCorner == FightCorner.Red ? "red" : "blue";

    /// <summary>Código del método de victoria usado por el mercado.</summary>
    public string MethodCode => Method switch
    {
        MmaVictoryMethod.Knockout => "ko",
        MmaVictoryMethod.Submission => "submission",
        MmaVictoryMethod.Decision => "decision",
        _ => throw new InvalidOperationException($"Método de victoria no soportado: {Method}."),
    };

    public static MmaResult Create(
        FightCorner winnerCorner,
        MmaVictoryMethod method,
        int round,
        DateTimeOffset recordedAt)
    {
        if (!Enum.IsDefined(winnerCorner))
            throw new ArgumentOutOfRangeException(nameof(winnerCorner), "La esquina ganadora no es válida.");

        if (!Enum.IsDefined(method))
            throw new ArgumentOutOfRangeException(nameof(method), "El método de victoria no es válido.");

        if (round < 1)
            throw new ArgumentOutOfRangeException(nameof(round), "El asalto de finalización debe ser positivo.");

        if (recordedAt == default)
            throw new ArgumentOutOfRangeException(nameof(recordedAt), "El resultado necesita fecha de registro.");

        return new MmaResult(winnerCorner, method, round, recordedAt);
    }

    public bool Matches(FightCorner winnerCorner, MmaVictoryMethod method, int round) =>
        WinnerCorner == winnerCorner && Method == method && Round == round;
}
