namespace Zenbet.EventsMarkets.Application.Commands.UpdateOdds;

public sealed class UpdateOddsOptions
{
    public int BatchSize { get; set; } = 500;
    public int WorkerCount { get; set; } = Environment.ProcessorCount;
    public int MaxQueuedBatches { get; set; } = 1000;
    public TimeSpan BatchTimeout { get; set; } = TimeSpan.FromSeconds(5);
}