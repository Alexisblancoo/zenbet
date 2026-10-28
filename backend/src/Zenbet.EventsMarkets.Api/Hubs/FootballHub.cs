namespace Zenbet.EventsMarkets.Api.Hubs;

using Microsoft.AspNetCore.SignalR;

/// <summary>
/// Canal público en tiempo real para eventos de fútbol (marcadores y cuotas en directo).
/// </summary>
public sealed class FootballHub : Hub
{
    public async Task JoinMatchGroup(string matchId)
    {
        var id = matchId?.Trim();
        if (!string.IsNullOrWhiteSpace(id))
            await Groups.AddToGroupAsync(Context.ConnectionId, $"match-{id}");
    }

    public async Task LeaveMatchGroup(string matchId)
    {
        var id = matchId?.Trim();
        if (!string.IsNullOrWhiteSpace(id))
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"match-{id}");
    }

    public async Task JoinLeagueGroup(string leagueId)
    {
        var id = leagueId?.Trim();
        if (!string.IsNullOrWhiteSpace(id))
            await Groups.AddToGroupAsync(Context.ConnectionId, $"league-{id}");
    }

    public async Task LeaveLeagueGroup(string leagueId)
    {
        var id = leagueId?.Trim();
        if (!string.IsNullOrWhiteSpace(id))
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"league-{id}");
    }
}

