namespace Zenbet.EventsMarkets.Infrastructure.Messaging;

using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Zenbet.EventsMarkets.Application.Interfaces;
using Zenbet.EventsMarkets.Domain.Aggregates;
using Zenbet.EventsMarkets.Domain.Enums;
using Zenbet.EventsMarkets.Infrastructure.Persistence;

public sealed class ResultSuggestionOptions
{
    /// <summary>Off by default: the feeds consume limited API quota and need keys.</summary>
    public bool Enabled { get; set; }
    public TimeSpan PollInterval { get; set; } = TimeSpan.FromMinutes(10);
}

/// <summary>
/// Looks for the official outcome of bouts whose safety window has ended and records what the feeds SUGGEST.
/// It never settles: an admin must confirm a verified proposal.
/// </summary>
public sealed class FightResultSuggestionWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopes;
    private readonly ResultSuggestionOptions _options;
    private readonly ILogger<FightResultSuggestionWorker> _logger;

    public FightResultSuggestionWorker(IServiceScopeFactory scopes, IOptions<ResultSuggestionOptions> options,
        ILogger<FightResultSuggestionWorker> logger)
    {
        _scopes = scopes;
        _options = options.Value;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_options.Enabled)
        {
            _logger.LogInformation("ResultSuggestions disabled; no result proposals will be generated.");
            return;
        }

        var interval = _options.PollInterval < TimeSpan.FromMinutes(1) ? TimeSpan.FromMinutes(1) : _options.PollInterval;
        using var timer = new PeriodicTimer(interval);
        do
        {
            try
            {
                await RunOnceAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Result suggestion cycle failed.");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    public async Task<int> RunOnceAsync(CancellationToken ct)
    {
        using var scope = _scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<EventsMarketsDbContext>();
        var proposals = scope.ServiceProvider.GetRequiredService<IFightResultProposalRepository>();
        var providers = scope.ServiceProvider.GetServices<IFightResultsProvider>().ToList();
        if (providers.Count < 2)
        {
            _logger.LogWarning("Result suggestions need at least two providers (primary + a second source); found {Count}.", providers.Count);
            return 0;
        }

        var now = DateTimeOffset.UtcNow;
        var open = (await db.Events.AsNoTracking()
                .Where(e => e.SportType == SportType.MixedMartialArts &&
                            (e.Status == EventStatus.Scheduled || e.Status == EventStatus.Live || e.Status == EventStatus.Suspended) &&
                            e.StartTime <= now)
                .ToListAsync(ct))
            .Where(e => e.Bout is not null && e.IsExpired(now))
            .ToList();
        if (open.Count == 0) return 0;

        var existing = await proposals.GetByEventIdsAsync(open.Select(e => e.Id.Value).ToList(), ct);
        var todo = open
            .Where(e => !existing.TryGetValue(e.Id.Value, out var p) || p.Status is ProposalStatus.Pending or ProposalStatus.Conflict)
            .ToList();
        if (todo.Count == 0) return 0;

        // One query per provider and day, never per bout (quota).
        var feed = new Dictionary<(string Provider, DateTime Day), IReadOnlyList<FightResultSnapshot>?>();
        foreach (var day in todo.Select(e => e.StartTime.UtcDateTime.Date).Distinct())
        {
            var at = new DateTimeOffset(day, TimeSpan.Zero).AddHours(12);
            foreach (var provider in providers)
            {
                try
                {
                    feed[(provider.ProviderName, day)] = await provider.GetResultsAroundAsync(at, ct);
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    // Type and message only (never the request): credentials travel in headers and are not part of either.
                    _logger.LogWarning("Provider {Provider} unavailable for {Day:yyyy-MM-dd}: {Error}: {Message}", provider.ProviderName, day, ex.GetType().Name, ex.Message);
                    feed[(provider.ProviderName, day)] = null;
                }
            }
        }

        var changed = 0;
        foreach (var ev in todo)
        {
            var day = ev.StartTime.UtcDateTime.Date;
            var observations = providers.Select(p => new ProviderObservation(p.ProviderName, feed[(p.ProviderName, day)])).ToList();
            var outcome = ResultReconciler.Reconcile(ev.Bout!.Red.Name, ev.Bout.Blue.Name, ev.StartTime, ev.Bout.ScheduledRounds, observations);

            if (!existing.TryGetValue(ev.Id.Value, out var proposal))
            {
                proposal = new FightResultProposal(ev.Id.Value, now);
                proposals.Add(proposal);
            }
            if (proposal.Update(outcome.Status, outcome.WinnerCorner, outcome.Method, outcome.Round,
                    outcome.MethodCorroborated, outcome.Detail, outcome.SourcesSummary, now))
            {
                changed++;
                _logger.LogInformation("RESULT_PROPOSAL event={EventId} status={Status} corroborated={Corroborated}",
                    ev.Id.Value, outcome.Status, outcome.MethodCorroborated);
            }
        }
        if (changed > 0) await proposals.SaveChangesAsync(ct);
        return changed;
    }
}
