namespace Zenbet.EventsMarkets.Application.Queries.GetEvents;

using System.Globalization;
using Zenbet.EventsMarkets.Application.DTOs;
using Zenbet.EventsMarkets.Domain.Aggregates;
using Zenbet.EventsMarkets.Domain.Enums;
using Zenbet.EventsMarkets.Domain.ValueObjects;

/// <summary>
/// Proyecciones de tiempo real compartidas por los endpoints y el outbox. La
/// UI recibe estado, resultado y reloj ya calculados para no depender del reloj
/// del navegador ni de inferir asaltos.
/// </summary>
public static class FightRealtimeMapper
{
    public static FightUpdateDto ToUpdate(Event @event, DateTimeOffset now)
    {
        var status = @event.EffectiveStatus(now);

        return new FightUpdateDto(
            @event.Id.Value,
            StatusKey(status),
            @event.IsExpired(now),
            @event.IsBettingOpen(now),
            @event.StartTime,
            @event.ScheduledEndTime,
            ToResult(@event),
            now);
    }

    public static FightClockDto ToClock(Event @event, DateTimeOffset now)
    {
        var status = @event.EffectiveStatus(now);
        var isLive = status == EventStatus.Live;
        var elapsedSeconds = Math.Max(0, (int)(now - @event.StartTime).TotalSeconds);
        var scheduledRounds = @event.Bout?.ScheduledRounds ?? 3;

        int? round = null;
        string? clock = null;

        if (isLive)
        {
            var elapsedInFight = Math.Min(elapsedSeconds, scheduledRounds * 300);
            round = Math.Min(scheduledRounds, elapsedInFight / 300 + 1);
            var elapsedInRound = elapsedInFight % 300;
            var remaining = elapsedInFight >= scheduledRounds * 300 ? 0 : 300 - elapsedInRound;
            clock = $"{remaining / 60}:{remaining % 60:00}";
        }

        return new FightClockDto(
            @event.Id.Value,
            StatusKey(status),
            round,
            clock,
            elapsedSeconds,
            @event.StartTime,
            @event.ScheduledEndTime,
            now);
    }

    public static FightCardUpdateDto ToCardUpdate(
        string cardKey,
        IReadOnlyCollection<Event> events,
        DateTimeOffset now)
    {
        var total = events.Count;
        var live = events.Count(@event => @event.EffectiveStatus(now) == EventStatus.Live);
        var suspended = events.Count(@event => @event.EffectiveStatus(now) == EventStatus.Suspended);
        var finished = events.Count(@event =>
        {
            var status = @event.EffectiveStatus(now);
            return status is EventStatus.Finished or EventStatus.Cancelled or EventStatus.Void;
        });

        var statusKey = total > 0 && finished == total
            ? "finished"
            : live > 0
                ? "live"
                : suspended > 0
                    ? "suspended"
                    : "scheduled";

        return new FightCardUpdateDto(
            cardKey,
            statusKey,
            total,
            live,
            finished,
            events.Any(@event => @event.IsBettingOpen(now)),
            now);
    }

    public static MmaResultDto? ToResult(Event @event)
    {
        if (@event.Result is null)
            return null;

        var result = @event.Result;
        var winnerName = result.WinnerCorner switch
        {
            FightCorner.Red => @event.Bout?.Red.Name,
            FightCorner.Blue => @event.Bout?.Blue.Name,
            _ => null
        };

        return new MmaResultDto(
            result.WinnerCode,
            winnerName ?? result.WinnerCode,
            result.MethodCode,
            MethodLabel(result.Method),
            result.Round,
            result.RecordedAt);
    }

    public static string CardKey(Event @event) =>
        @event.StartTime.UtcDateTime.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

    public static string StatusKey(EventStatus status) =>
        status.ToString().ToLowerInvariant();

    private static string MethodLabel(MmaVictoryMethod method) => method switch
    {
        MmaVictoryMethod.Knockout => "KO/TKO",
        MmaVictoryMethod.Submission => "Sumisión",
        MmaVictoryMethod.Decision => "Decisión",
        _ => method.ToString()
    };
}
