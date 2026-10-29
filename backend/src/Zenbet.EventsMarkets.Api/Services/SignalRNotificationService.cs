namespace Zenbet.EventsMarkets.Api.Services;

using Microsoft.AspNetCore.SignalR;
using Zenbet.EventsMarkets.Api.Hubs;
using Zenbet.EventsMarkets.Application.Interfaces;
using Zenbet.EventsMarkets.Domain.ValueObjects;

public sealed class SignalRNotificationService : INotificationService
{
    private readonly IHubContext<OddsHub> _oddsHubContext;
    private readonly IHubContext<FightHub> _fightHubContext;
    private readonly IHubContext<WalletHub> _walletHubContext;
    private readonly IHubContext<FootballHub> _footballHubContext;

    public SignalRNotificationService(
        IHubContext<OddsHub> oddsHubContext,
        IHubContext<FightHub> fightHubContext,
        IHubContext<WalletHub> walletHubContext,
        IHubContext<FootballHub> footballHubContext)
    {
        _oddsHubContext = oddsHubContext;
        _fightHubContext = fightHubContext;
        _walletHubContext = walletHubContext;
        _footballHubContext = footballHubContext;
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

    public async Task NotifyWalletBalanceUpdatedAsync(
        Guid walletId,
        Guid userId,
        decimal amount,
        decimal newBalance,
        Guid transactionId,
        CancellationToken cancellationToken = default)
    {
        // Envío dirigido: el IUserIdProvider mapea la conexión al claim
        // wallet_id del token, así que solo el dueño recibe el empuje.
        await _walletHubContext.Clients.User(walletId.ToString()).SendAsync("SaldoActualizado", new
        {
            walletId,
            userId,
            amount,
            newBalance,
            transactionId,
            timestamp = DateTimeOffset.UtcNow
        }, cancellationToken);
    }

    public async Task NotifyBetOutcomeSettledAsync(
        Guid walletId,
        Guid userId,
        Guid betTransactionId,
        Guid marketId,
        string outcome,
        decimal payout,
        decimal newBalance,
        CancellationToken cancellationToken = default)
    {
        await _walletHubContext.Clients.User(walletId.ToString()).SendAsync("ApuestaLiquidada", new
        {
            walletId,
            userId,
            betTransactionId,
            marketId,
            outcome,
            payout,
            newBalance,
            timestamp = DateTimeOffset.UtcNow
        }, cancellationToken);
    }

    public async Task NotifyFootballScoreUpdateAsync(
        string matchId,
        int homeScore,
        int awayScore,
        int minute,
        string period,
        CancellationToken cancellationToken = default)
    {
        var payload = new
        {
            matchId,
            homeScore,
            awayScore,
            minute,
            period
        };

        await _footballHubContext.Clients.All.SendAsync("ReceiveMatchScoreUpdate", payload, cancellationToken);
        await _oddsHubContext.Clients.All.SendAsync("ReceiveMatchScoreUpdate", payload, cancellationToken);
    }

    public async Task NotifyFootballOddsUpdateAsync(
        string matchId,
        string marketId,
        string selectionId,
        decimal odds,
        string? trend,
        CancellationToken cancellationToken = default)
    {
        var payload = new
        {
            matchId,
            marketId,
            selectionId,
            odds,
            trend = trend ?? "unchanged"
        };

        await _footballHubContext.Clients.All.SendAsync("ReceiveFootballOddsUpdate", payload, cancellationToken);
        await _oddsHubContext.Clients.All.SendAsync("ReceiveFootballOddsUpdate", payload, cancellationToken);
    }
}
