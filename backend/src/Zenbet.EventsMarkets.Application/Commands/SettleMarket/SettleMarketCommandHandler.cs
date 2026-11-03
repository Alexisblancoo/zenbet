namespace Zenbet.EventsMarkets.Application.Commands.SettleMarket;

using MediatR;
using Microsoft.Extensions.Logging;
using Zenbet.EventsMarkets.Application.Common;
using Zenbet.EventsMarkets.Application.Interfaces;
using Zenbet.EventsMarkets.Domain.Aggregates;
using Zenbet.EventsMarkets.Domain.Enums;
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
    private readonly IWalletRepository? _walletRepository;
    private readonly ITransactionRepository? _transactionRepository;

    public SettleMarketCommandHandler(
        IMarketRepository marketRepository,
        IUnitOfWork unitOfWork,
        IOutboxWriter outboxWriter,
        IIdempotencyService idempotencyService,
        ISettlementAuditService settlementAuditService,
        ILogger<SettleMarketCommandHandler> logger,
        IWalletRepository? walletRepository = null,
        ITransactionRepository? transactionRepository = null)
    {
        _marketRepository = marketRepository;
        _unitOfWork = unitOfWork;
        _outboxWriter = outboxWriter;
        _idempotencyService = idempotencyService;
        _settlementAuditService = settlementAuditService;
        _logger = logger;
        _walletRepository = walletRepository;
        _transactionRepository = transactionRepository;
    }

    public async Task<SettleMarketResult> Handle(SettleMarketCommand request, CancellationToken cancellationToken)
    {
        var idempotencyKey = request.IdempotencyKey.ToString();
        var payloadHash = IdempotencyPayloadHasher.Compute(new
        {
            marketId = request.MarketId.Value,
            winnerSelectionId = request.WinnerSelectionId.Value,
            request.Result,
            request.SettledBy,
        });

        // 1. Check idempotency first - fast path without loading aggregate
        var idempotencyExists = await _idempotencyService.ExistsAsync(
            idempotencyKey,
            nameof(SettleMarketCommand),
            payloadHash,
            cancellationToken);

        if (idempotencyExists)
        {
            _logger.LogInformation("Idempotent settlement request detected for key {Key}, returning existing result",
                request.IdempotencyKey);

            var cached = await _settlementAuditService.GetByIdempotencyKeyAsync(idempotencyKey, cancellationToken);

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
            var idempotencyLockKey = BitConverter.ToInt64(request.IdempotencyKey.ToByteArray(), 0);
            await _unitOfWork.TryAcquireAdvisoryLockAsync(idempotencyLockKey, cancellationToken);

            var lockKey = BitConverter.ToInt64(request.MarketId.Value.ToByteArray(), 0);
            var lockAcquired = await _unitOfWork.TryAcquireAdvisoryLockAsync(lockKey, cancellationToken);
            if (!lockAcquired)
            {
                throw new InvalidOperationException($"Market {request.MarketId} is already being settled");
            }

            // Re-check idempotency under lock
            if (await _idempotencyService.ExistsAsync(
                    idempotencyKey,
                    nameof(SettleMarketCommand),
                    payloadHash,
                    cancellationToken))
            {
                var cached = await _settlementAuditService.GetByIdempotencyKeyAsync(idempotencyKey, cancellationToken);
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

            // 6b. Liquidación Proporcional de Apuestas (Bono Inteligente):
            // Si los repositorios de billetera y transacciones están disponibles,
            // liquida las apuestas pendientes del mercado aplicando pago proporcional
            // (RealStake / BonusStake) y desbloqueando los saldos comprometidos.
            if (_walletRepository is not null && _transactionRepository is not null)
            {
                await SettlePendingBetsProportionallyAsync(marketToSettle, cancellationToken);
            }

            // 7. Record idempotency key
            await _idempotencyService.AddAsync(
                idempotencyKey,
                nameof(SettleMarketCommand),
                cancellationToken,
                payloadHash);

            // 8. Audit log for settlement
            await _settlementAuditService.AddAsync(new SettlementAuditRecord(
                Guid.NewGuid(),
                request.MarketId,
                request.WinnerSelectionId,
                request.Result,
                request.SettledBy,
                DateTimeOffset.UtcNow,
                idempotencyKey), cancellationToken);

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

    private async Task SettlePendingBetsProportionallyAsync(Market market, CancellationToken cancellationToken)
    {
        var pendingBets = await _transactionRepository!.GetPendingBetsByMarketIdAsync(market.Id, cancellationToken);
        if (pendingBets.Count == 0)
            return;

        var selectionsById = market.Selections.ToDictionary(s => s.Id);

        foreach (var walletGroup in pendingBets.GroupBy(b => b.WalletId))
        {
            var walletLockKey = BitConverter.ToInt64(walletGroup.Key.Value.ToByteArray(), 0);
            await _unitOfWork.TryAcquireAdvisoryLockAsync(walletLockKey, cancellationToken);

            var wallet = await _walletRepository!.GetByIdAsync(walletGroup.Key, cancellationToken);
            if (wallet is null)
                continue;

            var expectedVersion = wallet.Version;
            var walletChanged = false;

            foreach (var bet in walletGroup)
            {
                if (bet.BetStatus != BetStatus.Pending || bet.SelectionId is null)
                    continue;

                if (!selectionsById.TryGetValue(bet.SelectionId.Value, out var selection))
                    continue;

                var selectionResult = ResolveSelectionResult(market, selection);
                if (selectionResult is null)
                    continue;

                var outcome = selectionResult.Value switch
                {
                    SettlementResult.Won => BetStatus.Won,
                    SettlementResult.Lost => BetStatus.Lost,
                    SettlementResult.Void or SettlementResult.Push => BetStatus.Void,
                    _ => BetStatus.Pending,
                };

                if (outcome == BetStatus.Pending)
                    continue;

                var acceptedOdds = bet.AcceptedOdds ?? selection.CurrentOdd.Value;
                var stake = bet.Amount.Amount;
                var payout = outcome switch
                {
                    BetStatus.Won => Math.Round(stake * acceptedOdds, 2, MidpointRounding.AwayFromZero),
                    BetStatus.Void => Math.Round(stake, 2, MidpointRounding.AwayFromZero),
                    _ => 0m,
                };

                var reference = $"payout-market-{market.Id.Value}-bet-{bet.Id.Value}";

                if (outcome is BetStatus.Won or BetStatus.Void)
                {
                    var description = outcome == BetStatus.Void
                        ? $"Reembolso por apuesta anulada · {bet.Id.Value}"
                        : $"Pago de apuesta ganadora · {bet.Id.Value}";

                    var settlementTx = wallet.SettleBet(
                        bet,
                        new Money(payout),
                        selectionResult.Value,
                        description,
                        reference);

                    settlementTx.Complete();
                    await _transactionRepository.AddAsync(settlementTx, cancellationToken);
                    walletChanged = true;
                }
                else if (outcome == BetStatus.Lost)
                {
                    wallet.ReleaseLockedStake(bet);
                    walletChanged = true;
                }

                var promoCode = PromoCodeCatalog.Resolve(bet.PromoCode);
                var bonus = outcome == BetStatus.Won && promoCode is not null
                    ? promoCode.CalculateBonus(payout - stake)
                    : 0m;

                if (bonus > 0m)
                {
                    var bonusTx = wallet.AddBonus(
                        new Money(bonus),
                        $"Bono promocional {bet.PromoCode} · apuesta {bet.Id.Value}",
                        $"promo-{bet.Id.Value}");

                    bonusTx.Complete();
                    await _transactionRepository.AddAsync(bonusTx, cancellationToken);
                    walletChanged = true;
                }

                bet.SettleBet(outcome);
                await _transactionRepository.UpdateAsync(bet, cancellationToken);

                await _outboxWriter.WriteAsync(new BetOutcomeSettledDomainEvent(
                    wallet.Id,
                    wallet.UserId,
                    bet.Id,
                    market.Id,
                    outcome,
                    new Money(payout),
                    wallet.Balance,
                    DateTimeOffset.UtcNow), cancellationToken);
            }

            if (walletChanged)
            {
                await _walletRepository.UpdateAsync(wallet, expectedVersion, cancellationToken);

                foreach (var domainEvent in wallet.DomainEvents)
                {
                    await _outboxWriter.WriteAsync(domainEvent, cancellationToken);
                }

                wallet.ClearDomainEvents();
            }
        }
    }

    private static SettlementResult? ResolveSelectionResult(Market market, Selection selection)
    {
        if (market.MarketSettlementResult is SettlementResult.Void or SettlementResult.Push)
            return market.MarketSettlementResult;

        if (selection.SettlementResult is not null)
            return selection.SettlementResult;

        if (market.WinnerSelectionId is null)
            return null;

        return market.WinnerSelectionId == selection.Id
            ? SettlementResult.Won
            : SettlementResult.Lost;
    }
}
