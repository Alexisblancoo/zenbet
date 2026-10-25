namespace Zenbet.EventsMarkets.Infrastructure.Messaging;

using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Zenbet.EventsMarkets.Application.Interfaces;
using Zenbet.EventsMarkets.Application.Queries.GetEvents;
using Zenbet.EventsMarkets.Domain.Aggregates;
using Zenbet.EventsMarkets.Domain.Enums;
using Zenbet.EventsMarkets.Domain.Repositories;

/// <summary>
/// Mantiene el ciclo de vida de los combates y publica el reloj en vivo.
///
/// El worker persiste las transiciones Scheduled → Live → Finished para que
/// los filtros de la API y las apuestas usen la misma fuente de verdad. Además
/// emite un latido periódico por el <c>FightHub</c>; así la UI no necesita
/// sondear ni inferir asaltos desde el reloj del navegador.
/// </summary>
public sealed class FightLiveUpdateWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly FightLiveUpdateOptions _options;
    private readonly ILogger<FightLiveUpdateWorker> _logger;
    private readonly Dictionary<string, string> _lastCardSignature = new(StringComparer.Ordinal);

    public FightLiveUpdateWorker(
        IServiceScopeFactory scopeFactory,
        IOptions<FightLiveUpdateOptions> options,
        ILogger<FightLiveUpdateWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _options = options.Value;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation(
            "Fight live update worker started (interval {IntervalSeconds}s)",
            _options.Interval.TotalSeconds);

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
                _logger.LogError(ex, "Error updating live fight state");
            }

            try
            {
                await Task.Delay(_options.Interval, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
    }

    private async Task TickAsync(CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var repository = scope.ServiceProvider.GetRequiredService<IEventRepository>();
        var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();
        var outboxWriter = scope.ServiceProvider.GetRequiredService<IOutboxWriter>();
        var notifications = scope.ServiceProvider.GetRequiredService<INotificationService>();

        var now = DateTimeOffset.UtcNow;
        var events = await repository.ListForLiveWindowAsync(
            now.AddHours(-_options.LookbackHours),
            now.AddMinutes(_options.LookaheadMinutes),
            _options.BatchLimit,
            cancellationToken);

        if (events.Count == 0)
            return;

        var changed = new List<Event>();

        foreach (var @event in events)
        {
            var expectedVersion = @event.Version;

            if (@event.Status == EventStatus.Scheduled &&
                now >= @event.StartTime &&
                now < @event.ScheduledEndTime)
            {
                @event.Start();
            }
            else if ((@event.Status is EventStatus.Scheduled or EventStatus.Live or EventStatus.Suspended) &&
                     now >= @event.ScheduledEndTime)
            {
                @event.Expire();
            }

            if (@event.Version == expectedVersion)
                continue;

            await repository.UpdateAsync(@event, expectedVersion, cancellationToken);

            foreach (var domainEvent in @event.DomainEvents)
            {
                await outboxWriter.WriteAsync(domainEvent, cancellationToken);
            }

            changed.Add(@event);
        }

        if (changed.Count > 0)
        {
            try
            {
                await unitOfWork.SaveChangesAsync(cancellationToken);
                foreach (var @event in changed)
                {
                    @event.ClearDomainEvents();
                }
            }
            catch (Exception ex)
            {
                // La siguiente vuelta recarga el estado. No se debe tumbar el
                // worker por una carrera con la ingesta del resultado oficial,
                // ni publicar relojes/carteleras basados en cambios sin guardar.
                _logger.LogWarning(ex, "Could not persist fight lifecycle transitions");
                return;
            }
        }

        foreach (var @event in events)
        {
            if (@event.EffectiveStatus(now) != EventStatus.Live)
                continue;

            await notifications.NotifyFightClockAsync(
                @event.Id.Value,
                FightRealtimeMapper.ToClock(@event, now),
                cancellationToken);
        }

        await NotifyCardChangesAsync(events, repository, notifications, now, cancellationToken);
    }

    private async Task NotifyCardChangesAsync(
        IReadOnlyList<Event> events,
        IEventRepository repository,
        INotificationService notifications,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        foreach (var group in events.GroupBy(FightRealtimeMapper.CardKey, StringComparer.Ordinal))
        {
            var windowEvents = group.ToList();
            var windowUpdate = FightRealtimeMapper.ToCardUpdate(group.Key, windowEvents, now);
            var signature =
                $"{windowUpdate.Status}|{windowUpdate.LiveCount}|{windowUpdate.FinishedCount}|{windowUpdate.IsBettingOpen}";

            if (_lastCardSignature.TryGetValue(group.Key, out var previous) && previous == signature)
                continue;

            _lastCardSignature[group.Key] = signature;

            // El agregado debe incluir toda la cartelera, no solo los combates
            // dentro de la ventana del worker; de lo contrario una pelea
            // preliminar podría marcar como "finalizada" una cartelera que aún
            // tiene estelares programadas.
            var cardStart = new DateTimeOffset(
                windowEvents[0].StartTime.UtcDateTime.Date,
                TimeSpan.Zero);
            var cardEnd = cardStart.AddDays(1);
            var cardEvents = await repository.ListAsync(
                status: null,
                sportType: SportType.MixedMartialArts,
                fromDate: cardStart,
                toDate: cardEnd.AddTicks(-1),
                page: 1,
                pageSize: 500,
                cancellationToken: cancellationToken);

            var update = FightRealtimeMapper.ToCardUpdate(group.Key, cardEvents, now);
            await notifications.NotifyCardUpdateAsync(group.Key, update, cancellationToken);
        }
    }
}

public sealed class FightLiveUpdateOptions
{
    public TimeSpan Interval { get; set; } = TimeSpan.FromSeconds(5);
    public int LookbackHours { get; set; } = 8;
    public int LookaheadMinutes { get; set; } = 5;
    public int BatchLimit { get; set; } = 300;
}
