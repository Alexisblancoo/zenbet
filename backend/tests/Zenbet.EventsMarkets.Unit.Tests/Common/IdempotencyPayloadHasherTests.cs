namespace Zenbet.EventsMarkets.Unit.Tests.Common;

using Zenbet.EventsMarkets.Application.Common;
using Xunit;

public sealed class IdempotencyPayloadHasherTests
{
    [Fact]
    public void Compute_ReturnsSameHashForEquivalentPayload()
    {
        var first = IdempotencyPayloadHasher.Compute(new { amount = 125.50m, selectionId = "selection-a" });
        var retry = IdempotencyPayloadHasher.Compute(new { amount = 125.50m, selectionId = "selection-a" });

        Assert.Equal(first, retry);
        Assert.Equal(64, first.Length);
    }

    [Fact]
    public void Compute_ReturnsDifferentHashWhenPayloadChanges()
    {
        var original = IdempotencyPayloadHasher.Compute(new { amount = 125.50m, selectionId = "selection-a" });
        var altered = IdempotencyPayloadHasher.Compute(new { amount = 125.50m, selectionId = "selection-b" });

        Assert.NotEqual(original, altered);
    }
}
