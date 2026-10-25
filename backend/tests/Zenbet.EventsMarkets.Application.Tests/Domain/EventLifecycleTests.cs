namespace Zenbet.EventsMarkets.Application.Tests.Domain;

using Xunit;
using Zenbet.EventsMarkets.Application.Queries.GetEvents;
using Zenbet.EventsMarkets.Domain.Aggregates;
using Zenbet.EventsMarkets.Domain.Enums;
using Zenbet.EventsMarkets.Domain.Events;
using Zenbet.EventsMarkets.Domain.ValueObjects;

public sealed class EventLifecycleTests
{
    private static readonly DateTimeOffset Start = new(2026, 10, 25, 2, 0, 0, TimeSpan.Zero);

    [Theory]
    [InlineData(3, 60)]
    [InlineData(5, 75)]
    public void ScheduledEndTime_UsesSafetyWindowForRounds(int rounds, int expectedMinutes)
    {
        var @event = CreateEvent(rounds);

        Assert.Equal(Start.AddMinutes(expectedMinutes), @event.ScheduledEndTime);
    }

    [Fact]
    public void EffectiveStatus_FollowsClockAndClosesAtWindowEnd()
    {
        var @event = CreateEvent(5);

        Assert.Equal(EventStatus.Scheduled, @event.EffectiveStatus(Start.AddMinutes(-1)));
        Assert.Equal(EventStatus.Live, @event.EffectiveStatus(Start));
        Assert.Equal(EventStatus.Live, @event.EffectiveStatus(Start.AddMinutes(74)));
        Assert.Equal(EventStatus.Finished, @event.EffectiveStatus(Start.AddMinutes(75)));

        Assert.False(@event.IsExpired(Start.AddMinutes(74)));
        Assert.True(@event.IsBettingOpen(Start.AddMinutes(74)));
        Assert.True(@event.IsExpired(Start.AddMinutes(75)));
        Assert.False(@event.IsBettingOpen(Start.AddMinutes(75)));
    }

    [Fact]
    public void SuspendedEvent_ClosesBettingBeforeItsWindowEnds()
    {
        var @event = CreateEvent(3);
        @event.UpdateStatus(EventStatus.Suspended);

        Assert.False(@event.IsBettingOpen(Start.AddMinutes(10)));
        Assert.False(@event.IsExpired(Start.AddMinutes(10)));
        Assert.Equal(EventStatus.Suspended, @event.EffectiveStatus(Start.AddMinutes(10)));
        Assert.Equal(EventStatus.Finished, @event.EffectiveStatus(Start.AddMinutes(60)));
    }

    [Fact]
    public void Expire_IsIdempotentAndEmitsStatusOnlyOnce()
    {
        var @event = CreateEvent(3);
        @event.Start();
        @event.ClearDomainEvents();

        @event.Expire();
        @event.ClearDomainEvents();
        @event.Expire();

        Assert.Equal(EventStatus.Finished, @event.Status);
        Assert.Empty(@event.DomainEvents);
    }

    [Fact]
    public void RecordResult_ClosesSuspendedEventAndIsIdempotent()
    {
        var @event = CreateEvent(5);
        @event.UpdateStatus(EventStatus.Suspended);
        @event.ClearDomainEvents();

        var result = MmaResult.Create(
            FightCorner.Red,
            MmaVictoryMethod.Decision,
            5,
            Start.AddMinutes(20));

        @event.RecordResult(result);

        Assert.Equal(EventStatus.Finished, @event.Status);
        Assert.NotNull(@event.Result);
        Assert.Contains(@event.DomainEvents, item => item is MmaResultRecordedDomainEvent);
        Assert.Contains(@event.DomainEvents, item => item is EventStatusChangedDomainEvent);

        @event.ClearDomainEvents();
        @event.RecordResult(result);

        Assert.Equal(EventStatus.Finished, @event.Status);
        Assert.Empty(@event.DomainEvents);
    }

    [Fact]
    public void RealtimeMapper_ProjectsLiveClockAndCardCounts()
    {
        var @event = CreateEvent(5);
        var now = Start.AddMinutes(10);

        var update = FightRealtimeMapper.ToUpdate(@event, now);
        var clock = FightRealtimeMapper.ToClock(@event, now);

        Assert.Equal("live", update.Status);
        Assert.False(update.IsExpired);
        Assert.True(update.IsBettingOpen);
        Assert.Equal(3, clock.Round);
        Assert.Equal("5:00", clock.Clock);
        Assert.Equal(600, clock.ElapsedSeconds);

        @event.UpdateStatus(EventStatus.Finished);
        var card = FightRealtimeMapper.ToCardUpdate("2026-10-25", [@event], now);

        Assert.Equal("finished", card.Status);
        Assert.Equal(1, card.FinishedCount);
        Assert.False(card.IsBettingOpen);
    }

    private static Event CreateEvent(int rounds)
    {
        var division = WeightDivision.Lightweight;
        var red = Fighter.Create(
            "red-fighter",
            "Red Fighter",
            "MX",
            "México",
            "20-1-0",
            "1",
            division);
        var blue = Fighter.Create(
            "blue-fighter",
            "Blue Fighter",
            "US",
            "Estados Unidos",
            "19-2-0",
            "2",
            division);
        var bout = MmaBout.Create(
            red,
            blue,
            division,
            rounds,
            isTitleFight: false,
            billing: FightBilling.Main,
            billingOrder: 1,
            venue: "Arena",
            location: "Ciudad de México");

        return new Event(EventId.New(), "Red vs. Blue", SportType.MixedMartialArts, Start, "UFC Test", bout);
    }
}
