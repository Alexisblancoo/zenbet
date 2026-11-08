namespace Zenbet.EventsMarkets.Api.Hubs;

using Microsoft.AspNetCore.SignalR;

/// <summary>
/// Hub de cuotas en tiempo real (SignalR).
/// Permite suscripciones granulares por viewport para mercados y eventos,
/// soportando subscripciones individuales y en lote (batch multiplexing)
/// para optimizar el tráfico de red bajo alta concurrencia.
/// </summary>
public sealed class OddsHub : Hub
{
    /// <summary>
    /// Tope por invocación en lote. El hub es anónimo y sin rate limit; una pantalla
    /// real muestra decenas de mercados, no miles.
    /// </summary>
    internal const int MaxBatchSize = 200;

    public async Task JoinMarketGroup(string marketId)
    {
        var id = Normalize(marketId);
        if (id is not null)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"market-{id}");
        }
    }

    public async Task LeaveMarketGroup(string marketId)
    {
        var id = Normalize(marketId);
        if (id is not null)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"market-{id}");
        }
    }

    public async Task JoinMarketGroups(IReadOnlyList<string> marketIds)
    {
        if (marketIds is null || marketIds.Count == 0) return;
        if (marketIds.Count > MaxBatchSize) throw new HubException($"Máximo {MaxBatchSize} mercados por solicitud.");

        foreach (var marketId in marketIds)
        {
            var id = Normalize(marketId);
            if (id is not null)
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, $"market-{id}");
            }
        }
    }

    public async Task LeaveMarketGroups(IReadOnlyList<string> marketIds)
    {
        if (marketIds is null || marketIds.Count == 0) return;
        if (marketIds.Count > MaxBatchSize) throw new HubException($"Máximo {MaxBatchSize} mercados por solicitud.");

        foreach (var marketId in marketIds)
        {
            var id = Normalize(marketId);
            if (id is not null)
            {
                await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"market-{id}");
            }
        }
    }

    public async Task JoinEventGroup(string eventId)
    {
        var id = Normalize(eventId);
        if (id is not null)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"event-{id}");
        }
    }

    public async Task LeaveEventGroup(string eventId)
    {
        var id = Normalize(eventId);
        if (id is not null)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"event-{id}");
        }
    }

    public async Task JoinEventGroups(IReadOnlyList<string> eventIds)
    {
        if (eventIds is null || eventIds.Count == 0) return;
        if (eventIds.Count > MaxBatchSize) throw new HubException($"Máximo {MaxBatchSize} eventos por solicitud.");

        foreach (var eventId in eventIds)
        {
            var id = Normalize(eventId);
            if (id is not null)
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, $"event-{id}");
            }
        }
    }

    public async Task LeaveEventGroups(IReadOnlyList<string> eventIds)
    {
        if (eventIds is null || eventIds.Count == 0) return;
        if (eventIds.Count > MaxBatchSize) throw new HubException($"Máximo {MaxBatchSize} eventos por solicitud.");

        foreach (var eventId in eventIds)
        {
            var id = Normalize(eventId);
            if (id is not null)
            {
                await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"event-{id}");
            }
        }
    }

    private static string? Normalize(string? value)
    {
        var trimmed = value?.Trim();
        return string.IsNullOrWhiteSpace(trimmed) ? null : trimmed;
    }
}
