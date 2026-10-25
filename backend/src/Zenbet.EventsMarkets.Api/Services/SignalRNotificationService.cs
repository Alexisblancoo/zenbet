namespace Zenbet.EventsMarkets.Api.Services;

using Microsoft.AspNetCore.SignalR;
using Zenbet.EventsMarkets.Api.Hubs;
using Zenbet.EventsMarkets.Application.Interfaces;
using Zenbet.EventsMarkets.Domain.ValueObjects;

public sealed class SignalRNotificationService : INotificationService
{
    private readonly IHubContext<OddsHub> _oddsHubContext;
    private readonly IHubContext<FightHub> _fightHubContext;

    public SignalRNotificationService(
        IHubContext<OddsHub> oddsHubContext,
        IHubContext<FightHub> fightHubContext)
    {
        _oddsHubContext = oddsHubContext;
        _fightHubContext = fightHubContext;
    }

    public async Task NotifyOddsUpdateAsync(MarketId marketId, object oddsUpdate, CancellationToken cancellationToken = default)
    {
        var groupName = $"market-{marketId}";
        await _oddsHubContext.Clients.Group(groupName).SendAsync("ReceiveOddsUpdate", new
        {
            marketId = marketId.Value,
            oddsUpdate,
            timestamp = DateTimeOffset.UtcNow
        }, cancellationToken);
    }

    public async Task NotifyMarketSettledAsync(MarketId marketId, object settlementData, CancellationToken cancellationToken = default)
    {
        var groupName = $"market-{marketId}";
        await _oddsHubContext.Clients.Group(groupName).SendAsync("ReceiveMarketSettled", new
        {
            marketId = marketId.Value,
            settlementData,
            timestamp = DateTimeOffset.UtcNow
        }, cancellationToken);
    }

    public async Task NotifyFightUpdateAsync(Guid eventId, object fightUpdate, CancellationToken cancellationToken = default)
    {
        await _fightHubContext.Clients
            .Group($"fight-{eventId}")
            .SendAsync("ReceiveFightUpdate", fightUpdate, cancellationToken);
    }

    public async Task NotifyFightClockAsync(Guid eventId, object fightClock, CancellationToken cancellationToken = default)
    {
        await _fightHubContext.Clients
            .Group($"fight-{eventId}")
            .SendAsync("ReceiveFightClock", fightClock, cancellationToken);
    }

    public async Task NotifyCardUpdateAsync(string cardKey, object cardUpdate, CancellationToken cancellationToken = default)
    {
        await _fightHubContext.Clients
            .Group($"card-{cardKey}")
            .SendAsync("ReceiveCardUpdate", cardUpdate, cancellationToken);
    }
}
