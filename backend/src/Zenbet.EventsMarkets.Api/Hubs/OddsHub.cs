namespace Zenbet.EventsMarkets.Api.Hubs;

using Microsoft.AspNetCore.SignalR;
using Zenbet.EventsMarkets.Domain.ValueObjects;

public sealed class OddsHub : Hub
{
    public async Task JoinMarketGroup(string marketId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"market-{marketId}");
    }

    public async Task LeaveMarketGroup(string marketId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"market-{marketId}");
    }

    public async Task JoinEventGroup(string eventId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"event-{eventId}");
    }

    public async Task LeaveEventGroup(string eventId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"event-{eventId}");
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        // Clean up group memberships on disconnect
        await base.OnDisconnectedAsync(exception);
    }
}