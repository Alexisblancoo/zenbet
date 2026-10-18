namespace Zenbet.EventsMarkets.Api.Services;

using Microsoft.AspNetCore.SignalR;
using Zenbet.EventsMarkets.Api.Hubs;
using Zenbet.EventsMarkets.Application.Interfaces;
using Zenbet.EventsMarkets.Domain.ValueObjects;

public sealed class SignalRNotificationService : INotificationService
{
    private readonly IHubContext<OddsHub> _hubContext;

    public SignalRNotificationService(IHubContext<OddsHub> hubContext)
    {
        _hubContext = hubContext;
    }

    public async Task NotifyOddsUpdateAsync(MarketId marketId, object oddsUpdate, CancellationToken cancellationToken = default)
    {
        var groupName = $"market-{marketId}";
        await _hubContext.Clients.Group(groupName).SendAsync("ReceiveOddsUpdate", new
        {
            marketId = marketId.Value,
            oddsUpdate,
            timestamp = DateTimeOffset.UtcNow
        }, cancellationToken);
    }

    public async Task NotifyMarketSettledAsync(MarketId marketId, object settlementData, CancellationToken cancellationToken = default)
    {
        var groupName = $"market-{marketId}";
        await _hubContext.Clients.Group(groupName).SendAsync("ReceiveMarketSettled", new
        {
            marketId = marketId.Value,
            settlementData,
            timestamp = DateTimeOffset.UtcNow
        }, cancellationToken);
    }
}