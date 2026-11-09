namespace Zenbet.EventsMarkets.Application.Interfaces;

using Zenbet.EventsMarkets.Domain.ValueObjects;

/// <summary>
/// Cola en memoria por mercado. Serializa dentro del proceso las apuestas de un mismo mercado ANTES de
/// abrir la transacción: quien espera lo hace como una tarea barata y no retiene una conexión del
/// pool de PostgreSQL. Sin esto, N apuestas al mismo mercado ocupan N conexiones esperando el lock
/// y agotan el pool para todo el sitio.
/// </summary>
public interface IMarketBetGate
{
    /// <summary>
    /// Espera el turno del mercado. Libera el turno al desechar el resultado.
    /// </summary>
    /// <exception cref="Zenbet.EventsMarkets.Domain.Exceptions.ServiceBusyException">
    /// La cola del mercado está llena o la espera superó el máximo: se rechaza rápido en vez de acumular.
    /// </exception>
    ValueTask<IDisposable> EnterAsync(MarketId marketId, CancellationToken cancellationToken = default);
}
