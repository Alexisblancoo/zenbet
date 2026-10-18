namespace Zenbet.EventsMarkets.Infrastructure.Messaging;

using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

public sealed class PayoutWorkerOptions
{
    public int BatchSize { get; set; } = 100;
    public TimeSpan PollInterval { get; set; } = TimeSpan.FromSeconds(5);
    public int MaxRetries { get; set; } = 3;
}