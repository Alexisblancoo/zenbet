namespace Zenbet.EventsMarkets.Application.Commands.UpdateOdds;

using System.Diagnostics;
using System.Threading.Channels;
using MediatR;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Zenbet.EventsMarkets.Application.Interfaces;
using Zenbet.EventsMarkets.Domain.Aggregates;
using Zenbet.EventsMarkets.Domain.Repositories;
using Zenbet.EventsMarkets.Domain.ValueObjects;
using Zenbet.EventsMarkets.Domain.Exceptions;
using DomainEventId = Zenbet.EventsMarkets.Domain.ValueObjects.EventId;

public sealed class UpdateOddsCommandHandler : IRequestHandler<UpdateOddsCommand, UpdateOddsResult>
{
    private readonly ISelectionRepository _selectionRepository;
    private readonly IMarketRepository _marketRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IOutboxWriter _outboxWriter;
    private readonly IBulkOddsUpdater _bulkOddsUpdater;
    private readonly IIdempotencyService _idempotencyService;
    private readonly ILogger<UpdateOddsCommandHandler> _logger;
    private readonly UpdateOddsOptions _options;
    private readonly Channel<OddsBatch> _batchChannel;
    private readonly Task _processorTask;

    public UpdateOddsCommandHandler(
        ISelectionRepository selectionRepository,
        IMarketRepository marketRepository,
        IUnitOfWork unitOfWork,
        IOutboxWriter outboxWriter,
        IBulkOddsUpdater bulkOddsUpdater,
        IIdempotencyService idempotencyService,
        ILogger<UpdateOddsCommandHandler> logger,
        IOptions<UpdateOddsOptions> options)
    {
        _selectionRepository = selectionRepository;
        _marketRepository = marketRepository;
        _unitOfWork = unitOfWork;
        _outboxWriter = outboxWriter;
        _bulkOddsUpdater = bulkOddsUpdater;
        _idempotencyService = idempotencyService;
        _logger = logger;
        _options = options.Value;

        _batchChannel = Channel.CreateBounded<OddsBatch>(new BoundedChannelOptions(_options.MaxQueuedBatches)
        {
            FullMode = BoundedChannelFullMode.Wait,
            SingleReader = true,
            SingleWriter = false
        });

        _processorTask = Task.Run(ProcessBatchesAsync);
    }

    public async Task<UpdateOddsResult> Handle(UpdateOddsCommand request, CancellationToken cancellationToken)
    {
        if (request.Updates.Count == 0)
            return new UpdateOddsResult(0, 0, Array.Empty<OddsUpdateFailure>());

        // Check idempotency
        var idempotencyExists = await _idempotencyService.ExistsAsync(request.IdempotencyKey.ToString(), cancellationToken);

        if (idempotencyExists)
        {
            _logger.LogDebug("Idempotent odds update request {Key} ignored", request.IdempotencyKey);
            return new UpdateOddsResult(0, 0, Array.Empty<OddsUpdateFailure>());
        }

        // Partition updates by EventId hash for parallel processing
        var batches = PartitionByEventIdHash(request.Updates, _options.BatchSize);

        var failures = new List<OddsUpdateFailure>();
        var processed = 0;

        foreach (var batch in batches)
        {
            await ProcessBatchInternalAsync(batch);
            processed += batch.Updates.Count;
        }

        // Record idempotency key
        await _idempotencyService.AddAsync(request.IdempotencyKey.ToString(), nameof(UpdateOddsCommand), cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return new UpdateOddsResult(processed, failures.Count, failures);
    }

    private IReadOnlyList<OddsBatch> PartitionByEventIdHash(IReadOnlyList<OddsUpdateItem> updates, int batchSize)
    {
        // In real implementation, we'd need to look up EventId from SelectionId
        // For now, we'll hash by SelectionId as proxy
        return updates
            .Select(u => new { Update = u, Hash = u.SelectionId.Value.GetHashCode() })
            .GroupBy(x => Math.Abs(x.Hash) % _options.WorkerCount)
            .SelectMany(g => g.Select(x => x.Update).Chunk(batchSize))
            .Select((chunk, i) => new OddsBatch(i, chunk.ToList()))
            .ToList();
    }

    private async Task<(int Processed, IReadOnlyList<OddsUpdateFailure> Failures)> EnqueueBatchAsync(
        OddsBatch batch, CancellationToken cancellationToken)
    {
        await _batchChannel.Writer.WriteAsync(batch, cancellationToken);
        return (batch.Updates.Count, Array.Empty<OddsUpdateFailure>());
    }

    private async Task ProcessBatchesAsync()
    {
        await foreach (var batch in _batchChannel.Reader.ReadAllAsync())
        {
            var stopwatch = Stopwatch.StartNew();
            try
            {
                await ProcessBatchInternalAsync(batch);
                _logger.LogDebug("Processed odds batch {BatchId} with {Count} updates in {Elapsed}ms",
                    batch.Id, batch.Updates.Count, stopwatch.ElapsedMilliseconds);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to process odds batch {BatchId}", batch.Id);
            }
        }
    }

    private async Task ProcessBatchInternalAsync(OddsBatch batch)
    {
        // Group by EventId for advisory locking
        var byEventId = batch.Updates
            .GroupBy(u => GetEventIdForSelection(u.SelectionId))
            .ToList();

        foreach (var group in byEventId)
        {
            var eventId = group.Key;
            var updates = group.ToList();

            var result = await _bulkOddsUpdater.BulkUpsertAsync(eventId, updates);

            // Write domain events to outbox
            foreach (var domainEvent in result.DomainEvents)
            {
                await _outboxWriter.WriteAsync(domainEvent);
            }

            await _unitOfWork.SaveChangesAsync();
        }
    }

    private DomainEventId GetEventIdForSelection(SelectionId selectionId)
    {
        // In real implementation, this would be a cached lookup or included in the command
        // For now, return a placeholder - the actual implementation would query the repository
        return DomainEventId.Empty;
    }

    private sealed record OddsBatch(int Id, IReadOnlyList<OddsUpdateItem> Updates);
}