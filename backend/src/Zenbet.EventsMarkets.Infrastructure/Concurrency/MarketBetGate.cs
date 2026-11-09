namespace Zenbet.EventsMarkets.Infrastructure.Concurrency;

using Microsoft.Extensions.Options;
using Zenbet.EventsMarkets.Application.Interfaces;
using Zenbet.EventsMarkets.Domain.Exceptions;
using Zenbet.EventsMarkets.Domain.ValueObjects;

public sealed class MarketBetGateOptions
{
    public const string SectionName = "MarketBetGate";

    /// <summary>Máximo de apuestas por mercado (la que corre + las que esperan) por instancia.</summary>
    public int MaxQueuePerMarket { get; set; } = 150;

    /// <summary>Espera máxima por el turno antes de rechazar con 503 reintentable.</summary>
    public int MaxWaitMilliseconds { get; set; } = 4000;
}

public sealed class MarketBetGate : IMarketBetGate
{
    private readonly MarketBetGateOptions _options;
    private readonly object _sync = new();
    private readonly Dictionary<Guid, Slot> _slots = new();

    public MarketBetGate(IOptions<MarketBetGateOptions> options)
    {
        _options = options.Value;
    }

    /// <summary>Mercados con al menos una apuesta corriendo o en cola (útil como métrica).</summary>
    public int ActiveMarketCount
    {
        get
        {
            lock (_sync)
            {
                return _slots.Count;
            }
        }
    }

    public async ValueTask<IDisposable> EnterAsync(MarketId marketId, CancellationToken cancellationToken = default)
    {
        var key = marketId.Value;
        Slot slot;

        lock (_sync)
        {
            if (!_slots.TryGetValue(key, out slot!))
            {
                slot = new Slot();
                _slots[key] = slot;
            }

            // Users cuenta la apuesta que corre más las que esperan. Se rechaza ANTES de contarla.
            if (slot.Users >= _options.MaxQueuePerMarket)
            {
                if (slot.Users == 0)
                {
                    _slots.Remove(key);
                }

                throw new ServiceBusyException(
                    "El mercado está recibiendo demasiadas apuestas a la vez. Inténtalo de nuevo en un instante.");
            }

            slot.Users++;
        }

        var entered = false;
        try
        {
            entered = await slot.Semaphore.WaitAsync(
                TimeSpan.FromMilliseconds(_options.MaxWaitMilliseconds),
                cancellationToken);
        }
        finally
        {
            if (!entered)
            {
                Leave(key, slot);
            }
        }

        if (!entered)
        {
            throw new ServiceBusyException(
                "El mercado está recibiendo demasiadas apuestas a la vez. Inténtalo de nuevo en un instante.");
        }

        return new Lease(this, key, slot);
    }

    private void Leave(Guid key, Slot slot)
    {
        lock (_sync)
        {
            if (--slot.Users == 0)
            {
                _slots.Remove(key);
            }
        }
    }

    private sealed class Slot
    {
        public SemaphoreSlim Semaphore { get; } = new(1, 1);

        public int Users;
    }

    private sealed class Lease : IDisposable
    {
        private readonly MarketBetGate _gate;
        private readonly Guid _key;
        private readonly Slot _slot;
        private int _disposed;

        public Lease(MarketBetGate gate, Guid key, Slot slot)
        {
            _gate = gate;
            _key = key;
            _slot = slot;
        }

        public void Dispose()
        {
            if (Interlocked.Exchange(ref _disposed, 1) == 1)
            {
                return;
            }

            _slot.Semaphore.Release();
            _gate.Leave(_key, _slot);
        }
    }
}
