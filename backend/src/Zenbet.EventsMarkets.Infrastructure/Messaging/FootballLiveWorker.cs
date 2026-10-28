namespace Zenbet.EventsMarkets.Infrastructure.Messaging;

using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Zenbet.EventsMarkets.Application.Interfaces;
using Zenbet.EventsMarkets.Infrastructure.Persistence;

public sealed class FootballLiveWorker : BackgroundService
{
    private static readonly TimeSpan TickInterval = TimeSpan.FromSeconds(15);
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<FootballLiveWorker> _logger;

    public FootballLiveWorker(
        IServiceScopeFactory scopeFactory,
        ILogger<FootballLiveWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Football live worker started (tick interval: {IntervalSeconds}s)", TickInterval.TotalSeconds);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await TickAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during football live tick update");
            }

            try
            {
                await Task.Delay(TickInterval, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
    }

    private async Task TickAsync(CancellationToken cancellationToken)
    {
        await using var scope = _scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<EventsMarketsDbContext>();
        var notifications = scope.ServiceProvider.GetRequiredService<INotificationService>();

        var liveMatches = await db.FootballMatches
            .Where(m => m.Status == "live")
            .ToListAsync(cancellationToken);

        if (liveMatches.Count == 0) return;

        foreach (var match in liveMatches)
        {
            if (match.IsRunning)
            {
                match.CurrentMinute = (match.CurrentMinute ?? 0) + 1;

                if (match.CurrentMinute == 45)
                {
                    match.Period = "half_time";
                }
                else if (match.CurrentMinute > 45 && match.CurrentMinute < 90)
                {
                    match.Period = "second_half";
                }
                else if (match.CurrentMinute >= 90)
                {
                    match.Period = "full_time";
                    match.Status = "finished";
                    match.IsRunning = false;
                }

                await notifications.NotifyFootballScoreUpdateAsync(
                    match.Id,
                    match.HomeScore,
                    match.AwayScore,
                    match.CurrentMinute.Value,
                    match.Period ?? "second_half",
                    cancellationToken);
            }
        }

        await db.SaveChangesAsync(cancellationToken);
    }
}

