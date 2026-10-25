namespace Zenbet.EventsMarkets.Api.Hubs;

using Microsoft.AspNetCore.SignalR;

/// <summary>
/// Canal público de estado de combates. Separado de <see cref="OddsHub"/>
/// para que la cartelera reciba reloj, cierre de mercados y resultado sin
/// mezclarlo con el flujo de cuotas por mercado.
/// </summary>
public sealed class FightHub : Hub
{
    public async Task JoinEventGroup(string eventId)
    {
        var id = Normalize(eventId);
        if (id is null) return;

        await Groups.AddToGroupAsync(Context.ConnectionId, $"fight-{id}");
    }

    public async Task LeaveEventGroup(string eventId)
    {
        var id = Normalize(eventId);
        if (id is null) return;

        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"fight-{id}");
    }

    public async Task JoinCardGroup(string cardKey)
    {
        var key = Normalize(cardKey);
        if (key is null) return;

        await Groups.AddToGroupAsync(Context.ConnectionId, $"card-{key}");
    }

    public async Task LeaveCardGroup(string cardKey)
    {
        var key = Normalize(cardKey);
        if (key is null) return;

        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"card-{key}");
    }

    private static string? Normalize(string? value)
    {
        var trimmed = value?.Trim();
        return string.IsNullOrWhiteSpace(trimmed) ? null : trimmed;
    }
}
