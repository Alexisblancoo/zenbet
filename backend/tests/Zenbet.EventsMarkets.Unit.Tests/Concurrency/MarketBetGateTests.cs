namespace Zenbet.EventsMarkets.Unit.Tests.Concurrency;

using Microsoft.Extensions.Options;
using Xunit;
using Zenbet.EventsMarkets.Domain.Exceptions;
using Zenbet.EventsMarkets.Domain.ValueObjects;
using Zenbet.EventsMarkets.Infrastructure.Concurrency;

public sealed class MarketBetGateTests
{
    private static MarketBetGate CreateGate(int maxQueue = 150, int maxWaitMs = 4000) =>
        new(Options.Create(new MarketBetGateOptions
        {
            MaxQueuePerMarket = maxQueue,
            MaxWaitMilliseconds = maxWaitMs,
        }));

    [Fact]
    public async Task Same_Market_Is_Serialized_And_The_Next_Turn_Starts_After_Release()
    {
        var gate = CreateGate();
        var market = MarketId.New();

        var first = await gate.EnterAsync(market);
        var secondTask = gate.EnterAsync(market).AsTask();

        await Task.Delay(150);
        Assert.False(secondTask.IsCompleted);

        first.Dispose();
        var second = await secondTask.WaitAsync(TimeSpan.FromSeconds(5));
        second.Dispose();

        Assert.Equal(0, gate.ActiveMarketCount);
    }

    [Fact]
    public async Task Different_Markets_Do_Not_Block_Each_Other()
    {
        var gate = CreateGate();

        using var a = await gate.EnterAsync(MarketId.New());
        using var b = await gate.EnterAsync(MarketId.New()).AsTask().WaitAsync(TimeSpan.FromSeconds(1));

        Assert.Equal(2, gate.ActiveMarketCount);
    }

    [Fact]
    public async Task A_Full_Queue_Rejects_Immediately_Instead_Of_Accumulating()
    {
        var gate = CreateGate(maxQueue: 2);
        var market = MarketId.New();

        var running = await gate.EnterAsync(market);
        var waiting = gate.EnterAsync(market).AsTask();

        var rejected = await Assert.ThrowsAsync<ServiceBusyException>(
            () => gate.EnterAsync(market).AsTask().WaitAsync(TimeSpan.FromSeconds(1)));
        Assert.Equal("SERVICE_BUSY", rejected.Code);

        running.Dispose();
        (await waiting.WaitAsync(TimeSpan.FromSeconds(5))).Dispose();
        Assert.Equal(0, gate.ActiveMarketCount);
    }

    [Fact]
    public async Task A_Waiter_Past_The_Maximum_Wait_Gets_ServiceBusy_And_Frees_Its_Place()
    {
        var gate = CreateGate(maxWaitMs: 100);
        var market = MarketId.New();

        var running = await gate.EnterAsync(market);

        await Assert.ThrowsAsync<ServiceBusyException>(
            () => gate.EnterAsync(market).AsTask().WaitAsync(TimeSpan.FromSeconds(5)));

        // El que corre sigue contando; el que se rindió ya no.
        Assert.Equal(1, gate.ActiveMarketCount);
        running.Dispose();
        Assert.Equal(0, gate.ActiveMarketCount);
    }

    [Fact]
    public async Task A_Cancelled_Waiter_Frees_Its_Place_And_Does_Not_Block_The_Next()
    {
        var gate = CreateGate();
        var market = MarketId.New();
        using var cts = new CancellationTokenSource();

        var running = await gate.EnterAsync(market);
        var cancelled = gate.EnterAsync(market, cts.Token).AsTask();
        await Task.Delay(50);
        cts.Cancel();
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => cancelled);

        running.Dispose();
        using var next = await gate.EnterAsync(market).AsTask().WaitAsync(TimeSpan.FromSeconds(1));
        Assert.Equal(1, gate.ActiveMarketCount);
    }

    [Fact]
    public async Task Disposing_A_Turn_Twice_Does_Not_Release_Someone_Else_Early()
    {
        var gate = CreateGate();
        var market = MarketId.New();

        var first = await gate.EnterAsync(market);
        first.Dispose();

        var second = await gate.EnterAsync(market);
        first.Dispose();

        var third = gate.EnterAsync(market).AsTask();
        await Task.Delay(100);
        Assert.False(third.IsCompleted);

        second.Dispose();
        (await third.WaitAsync(TimeSpan.FromSeconds(5))).Dispose();
        Assert.Equal(0, gate.ActiveMarketCount);
    }

    [Fact]
    public async Task Under_Heavy_Contention_Only_One_Bet_Per_Market_Runs_At_A_Time()
    {
        var gate = CreateGate(maxQueue: 1000, maxWaitMs: 30_000);
        var market = MarketId.New();
        var running = 0;
        var maxRunning = 0;

        var tasks = Enumerable.Range(0, 300).Select(_ => Task.Run(async () =>
        {
            using var turn = await gate.EnterAsync(market);
            var now = Interlocked.Increment(ref running);
            InterlockedMax(ref maxRunning, now);
            await Task.Yield();
            Interlocked.Decrement(ref running);
        })).ToArray();

        await Task.WhenAll(tasks).WaitAsync(TimeSpan.FromSeconds(30));

        Assert.Equal(1, maxRunning);
        Assert.Equal(0, gate.ActiveMarketCount);
    }

    private static void InterlockedMax(ref int target, int value)
    {
        int current;
        while (value > (current = Volatile.Read(ref target)))
        {
            if (Interlocked.CompareExchange(ref target, value, current) == current)
            {
                return;
            }
        }
    }
}
