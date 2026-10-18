namespace Zenbet.EventsMarkets.Application.Commands.SettleMarket;

using MediatR;
using Microsoft.Extensions.Logging;
using Zenbet.EventsMarkets.Application.Interfaces;
using Zenbet.EventsMarkets.Domain.Aggregates;
using Zenbet.EventsMarkets.Domain.Events;
using Zenbet.EventsMarkets.Domain.Repositories;
using Zenbet.EventsMarkets.Domain.ValueObjects;
using Zenbet.EventsMarkets.Domain.Exceptions;

public sealed class SettleMarketCommandHandler : IRequestHandler<SettleMarketCommand, SettleMarketResult>
{
    private readonly IMarketRepository _marketRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IOutboxWriter _outboxWriter;
    private readonly IIdempotencyService _idempotencyService;
    private readonly ISettlementAuditService _settlementAuditService;
    private readonly ILogger<SettleMarketCommandHandler> _logger;

    public SettleMarketCommandHandler(
        IMarketRepository marketRepository,
        IUnitOfWork unitOfWork,
        IOutboxWriter outboxWriter,
        IIdempotencyService idempotencyService,
        ISettlementAuditService settlementAuditService,
        ILogger<SettleMarketCommandHandler> logger)
    {
        _marketRepository = marketRepository;
        _unitOfWork = unitOfWork;
        _outboxWriter = outboxWriter;
        _idempotencyService = idempotencyService;
        _settlementAuditService = settlementAuditService;
        _logger = logger;
    }

    public async Task<SettleMarketResult> Handle(SettleMarketCommand request, CancellationToken cancellationToken)
    {
        // 1. Check idempotency first - fast path without loading aggregate
        var idempotencyExists = await _idempotencyService.ExistsAsync(request.IdempotencyKey.ToString(), cancellationToken);

        if (idempotencyExists)
        {
            _logger.LogInformation("Idempotent settlement request detected for key {Key}, returning existing result",
                request.IdempotencyKey);

            var cached = await _settlementAuditService.GetByIdempotencyKeyAsync(request.IdempotencyKey.ToString(), cancellationToken);

            if (cached is not null)
            {
                return new SettleMarketResult(
                    cached.MarketId,
                    cached.WinnerSelectionId,
                    cached.Result,
                    cached.SettledAt);
            }

            var market = await _marketRepository.GetByIdWithSelectionsAsync(request.MarketId, cancellationToken)
                ?? throw new MarketNotFoundException(request.MarketId);

            return new SettleMarketResult(
                market.Id,
                market.WinnerSelectionId!.Value,
                market.MarketSettlementResult!.Value,
                market.DomainEvents.OfType<MarketSettledDomainEvent>().FirstOrDefault()?.SettledAt ?? DateTimeOffset.UtcNow);
        }

        // 2. Start transaction and acquire advisory lock on MarketId
        await _unitOfWork.BeginTransactionAsync(cancellationToken);

        try
        {
            var lockKey = BitConverter.ToInt64(request.MarketId.Value.ToByteArray(), 0);
            var lockAcquired = await _unitOfWork.TryAcquireAdvisoryLockAsync(lockKey, cancellationToken);
            if (!lockAcquired)
            {
                throw new InvalidOperationException($"Market {request.MarketId} is already being settled");
            }

            // Re-check idempotency under lock
            if (await _idempotencyService.ExistsAsync(request.IdempotencyKey.ToString(), cancellationToken))
            {
                var cached = await _settlementAuditService.GetByIdempotencyKeyAsync(request.IdempotencyKey.ToString(), cancellationToken);
                if (cached is not null)
                {
                    await _unitOfWork.CommitAsync(cancellationToken);
                    return new SettleMarketResult(cached.MarketId, cached.WinnerSelectionId, cached.Result, cached.SettledAt);
                }
            }

            // 3. Load aggregate with selections
            var marketToSettle = await _marketRepository.GetByIdWithSelectionsAsync(request.MarketId, cancellationToken)
                ?? throw new MarketNotFoundException(request.MarketId);

            // 4. Execute domain logic - validates status is Open, etc.
            marketToSettle.Settle(request.WinnerSelectionId, request.Result, request.SettledBy);

            // 5. Persist aggregate changes
            await _marketRepository.UpdateAsync(marketToSettle, cancellationToken);

            // 6. Write domain events to outbox
            foreach (var domainEvent in marketToSettle.DomainEvents)
            {
                await _outboxWriter.WriteAsync(domainEvent, cancellationToken);
            }

            // 7. Record idempotency key
            await _idempotencyService.AddAsync(request.IdempotencyKey.ToString(), nameof(SettleMarketCommand), cancellationToken);

            // 8. Audit log for settlement
            await _settlementAuditService.AddAsync(new SettlementAuditRecord(
                Guid.NewGuid(),
                request.MarketId,
                request.WinnerSelectionId,
                request.Result,
                request.SettledBy,
                DateTimeOffset.UtcNow,
                request.IdempotencyKey.ToString()), cancellationToken);

            await _unitOfWork.CommitAsync(cancellationToken);

            marketToSettle.ClearDomainEvents();

            _logger.LogInformation("Market {MarketId} settled successfully with winner {WinnerSelectionId}, result {Result}",
                request.MarketId, request.WinnerSelectionId, request.Result);

            return new SettleMarketResult(
                request.MarketId,
                request.WinnerSelectionId,
                request.Result,
                DateTimeOffset.UtcNow);
        }
        catch
        {
            await _unitOfWork.RollbackAsync(cancellationToken);
            throw;
        }
    }
}
