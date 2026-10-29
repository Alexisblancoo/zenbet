namespace Zenbet.EventsMarkets.Infrastructure.Messaging;

using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Zenbet.EventsMarkets.Application.Interfaces;
using Zenbet.EventsMarkets.Infrastructure.Persistence.Seeding;

public sealed class EventSyncBackgroundService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<EventSyncBackgroundService> _logger;
    private readonly MmaSyncOptions _options;

    public EventSyncBackgroundService(
        IServiceScopeFactory scopeFactory,
        ILogger<EventSyncBackgroundService> logger,
        IOptions<MmaSyncOptions> options)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
        _options = options.Value;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_options.Enabled)
        {
            _logger.LogInformation("MMA event synchronization is disabled.");
            return;
        }

        if (!Uri.TryCreate(_options.FeedUrl, UriKind.Absolute, out _))
        {
            _logger.LogError("MMA event synchronization is enabled but MmaSync:FeedUrl is not a valid absolute URI.");
            return;
        }

        _logger.LogInformation("MMA event synchronization worker started.");
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var scope = _scopeFactory.CreateAsyncScope();
                var provider = scope.ServiceProvider.GetRequiredService<IMmaDataProvider>();
                var synchronizer = scope.ServiceProvider.GetRequiredService<MmaEventSynchronizer>();
                var events = await provider.GetUpcomingEventsAsync(stoppingToken);
                var result = await synchronizer.SynchronizeAsync(events, stoppingToken);
                _logger.LogInformation(
                    "MMA provider synchronization completed: {Cards} cards, {Fights} fights, {Changes} changes.",
                    events.Count,
                    events.Sum(item => item.Fights.Count),
                    result.Changes);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {
                _logger.LogError(exception, "MMA event synchronization cycle failed.");
            }

            try
            {
                await Task.Delay(_options.PollInterval <= TimeSpan.Zero ? TimeSpan.FromMinutes(1) : _options.PollInterval,
                    stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
        }

        _logger.LogInformation("MMA event synchronization worker stopped.");
    }
}
