namespace Zenbet.EventsMarkets.Application.Commands.ResettleMarket;

using MediatR;
using Microsoft.Extensions.Logging;
using Zenbet.EventsMarkets.Application.Common;
using Zenbet.EventsMarkets.Application.Interfaces;
using Zenbet.EventsMarkets.Domain.Aggregates;
using Zenbet.EventsMarkets.Domain.Enums;
using Zenbet.EventsMarkets.Domain.Events;
using Zenbet.EventsMarkets.Domain.Exceptions;
using Zenbet.EventsMarkets.Domain.Repositories;
using Zenbet.EventsMarkets.Domain.ValueObjects;

/// <summary>
/// Handler transaccional del Motor de Re-liquidación y Clawbacks (VAR Resettlement Engine).
/// Ejecuta la reversión contable de pagos previos (<see cref="TransactionType.Clawback"/>),
/// permite que <c>RealAvailable</c> caiga en deuda negativa si el usuario retiró fondos,
/// revierte conversiones indebidas de <see cref="ActiveBonus"/> y re-liquida todas las apuestas
/// del mercado bajo locks transaccionales determinísticos (<c>pg_advisory_xact_lock</c>).
/// </summary>
public sealed class ResettleMarketCommandHandler : IRequestHandler<ResettleMarketCommand, ResettleMarketResult>
{
    private readonly IMarketRepository _marketRepository;
    private readonly IWalletRepository _walletRepository;
    private readonly ITransactionRepository _transactionRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IOutboxWriter _outboxWriter;
    private readonly IIdempotencyService _idempotencyService;
    private readonly ISettlementAuditService _settlementAuditService;
    private readonly ILogger<ResettleMarketCommandHandler> _logger;

    public ResettleMarketCommandHandler(
        IMarketRepository marketRepository,
        IWalletRepository walletRepository,
        ITransactionRepository transactionRepository,
        IUnitOfWork unitOfWork,
        IOutboxWriter outboxWriter,
        IIdempotencyService idempotencyService,
        ISettlementAuditService settlementAuditService,
        ILogger<ResettleMarketCommandHandler> logger)
    {
        _marketRepository = marketRepository;
        _walletRepository = walletRepository;
        _transactionRepository = transactionRepository;
        _unitOfWork = unitOfWork;
        _outboxWriter = outboxWriter;
        _idempotencyService = idempotencyService;
        _settlementAuditService = settlementAuditService;
        _logger = logger;
    }

    public async Task<ResettleMarketResult> Handle(ResettleMarketCommand request, CancellationToken cancellationToken)
    {
        var idempotencyKey = request.IdempotencyKey.ToString();
        var payloadHash = IdempotencyPayloadHasher.Compute(new
        {
            marketId = request.MarketId.Value,
            newWinnerSelectionId = request.NewWinnerSelectionId.Value,
            request.NewResult,
            request.Reason,
            request.ResettledBy,
        });

        if (await _idempotencyService.ExistsAsync(
                idempotencyKey,
                nameof(ResettleMarketCommand),
                payloadHash,
                cancellationToken))
        {
            var cached = await _settlementAuditService.GetByIdempotencyKeyAsync(idempotencyKey, cancellationToken);
            if (cached is not null)
            {
                return new ResettleMarketResult(
                    cached.MarketId,
                    cached.WinnerSelectionId,
                    cached.Result,
                    0,
                    0,
                    0,
                    cached.SettledAt);
            }
        }

        await _unitOfWork.BeginTransactionAsync(cancellationToken);

        try
        {
            // 1. Adquirir Advisory Locks de Idempotencia y de Mercado
            var idempotencyLockKey = BitConverter.ToInt64(request.IdempotencyKey.ToByteArray(), 0);
            await _unitOfWork.TryAcquireAdvisoryLockAsync(idempotencyLockKey, cancellationToken);

            var marketLockKey = BitConverter.ToInt64(request.MarketId.Value.ToByteArray(), 0);
            if (!await _unitOfWork.TryAcquireAdvisoryLockAsync(marketLockKey, cancellationToken))
            {
                throw new InvalidOperationException($"Market {request.MarketId} is already undergoing settlement or resettlement.");
            }

            if (await _idempotencyService.ExistsAsync(
                    idempotencyKey,
                    nameof(ResettleMarketCommand),
                    payloadHash,
                    cancellationToken))
            {
                var cached = await _settlementAuditService.GetByIdempotencyKeyAsync(idempotencyKey, cancellationToken);
                await _unitOfWork.CommitAsync(cancellationToken);

                return new ResettleMarketResult(
                    request.MarketId,
                    request.NewWinnerSelectionId,
                    request.NewResult,
                    0,
                    0,
                    0,
                    cached?.SettledAt ?? DateTimeOffset.UtcNow);
            }

            // 2. Cargar el mercado y aplicar la transición de dominio Resettle
            var market = await _marketRepository.GetByIdWithSelectionsAsync(request.MarketId, cancellationToken)
                ?? throw new MarketNotFoundException(request.MarketId);

            market.Resettle(
                request.NewWinnerSelectionId,
                request.NewResult,
                request.Reason,
                request.ResettledBy);

            await _marketRepository.UpdateAsync(market, cancellationToken);

            foreach (var domainEvent in market.DomainEvents)
            {
                await _outboxWriter.WriteAsync(domainEvent, cancellationToken);
            }

            // 3. Ejecutar Clawbacks de liquidaciones previas y Re-liquidar con el nuevo resultado
            var (clawbacksExecuted, betsResettled, walletsInDebt) =
                await ExecuteClawbacksAndResettleBetsAsync(market, request.Reason, cancellationToken);

            // 4. Registrar Idempotencia y Auditoría
            var resettledAt = DateTimeOffset.UtcNow;

            await _idempotencyService.AddAsync(
                idempotencyKey,
                nameof(ResettleMarketCommand),
                cancellationToken,
                payloadHash);

            await _settlementAuditService.AddAsync(new SettlementAuditRecord(
                Guid.NewGuid(),
                request.MarketId,
                request.NewWinnerSelectionId,
                request.NewResult,
                $"{request.ResettledBy} (VAR_RESETTLE: {request.Reason})",
                resettledAt,
                idempotencyKey), cancellationToken);

            await _unitOfWork.CommitAsync(cancellationToken);
            market.ClearDomainEvents();

            _logger.LogInformation(
                "Market {MarketId} resettled (VAR): NewWinner={NewWinner}, Result={NewResult}, Clawbacks={Clawbacks}, BetsResettled={BetsResettled}, WalletsInDebt={WalletsInDebt}",
                request.MarketId,
                request.NewWinnerSelectionId,
                request.NewResult,
                clawbacksExecuted,
                betsResettled,
                walletsInDebt);

            return new ResettleMarketResult(
                request.MarketId,
                request.NewWinnerSelectionId,
                request.NewResult,
                clawbacksExecuted,
                betsResettled,
                walletsInDebt,
                resettledAt);
        }
        catch
        {
            await _unitOfWork.RollbackAsync(cancellationToken);
            throw;
        }
    }

    private async Task<(int ClawbacksExecuted, int BetsResettled, int WalletsInDebt)> ExecuteClawbacksAndResettleBetsAsync(
        Market market,
        string reason,
        CancellationToken cancellationToken)
    {
        var allMarketBets = await _transactionRepository.GetBetsByMarketIdAsync(market.Id, cancellationToken);
        if (allMarketBets.Count == 0)
            return (0, 0, 0);

        var priorSettlements = await _transactionRepository.GetSettlementsByMarketIdAsync(market.Id, cancellationToken);
        var selectionsById = market.Selections.ToDictionary(s => s.Id);

        var clawbacksExecuted = 0;
        var betsResettled = 0;
        var walletsInDebt = 0;

        // Ordenar por WalletId.Value para adquirir pg_advisory_xact_lock en orden canónico sin deadlocks
        foreach (var walletGroup in allMarketBets
                     .GroupBy(b => b.WalletId)
                     .OrderBy(g => g.Key.Value))
        {
            var walletLockKey = BitConverter.ToInt64(walletGroup.Key.Value.ToByteArray(), 0);
            await _unitOfWork.TryAcquireAdvisoryLockAsync(walletLockKey, cancellationToken);

            var wallet = await _walletRepository.GetByIdForUpdateAsync(walletGroup.Key, cancellationToken);
            if (wallet is null)
                continue;

            var expectedVersion = wallet.Version;
            var walletChanged = false;

            var walletPriorSettlements = priorSettlements
                .Where(s => s.WalletId == wallet.Id && s.Status != TransactionStatus.ClawedBack)
                .ToList();

            foreach (var bet in walletGroup)
            {
                if (bet.SelectionId is null || !selectionsById.TryGetValue(bet.SelectionId.Value, out var selection))
                    continue;

                // A. Localizar liquidación previa de esta apuesta (por puntero ReferenceTransactionId o ReferenceId)
                var priorSettlement = walletPriorSettlements.FirstOrDefault(s =>
                    s.ReferenceTransactionId == bet.Id ||
                    (s.ReferenceId is not null &&
                     s.ReferenceId.EndsWith(bet.Id.Value.ToString(), StringComparison.OrdinalIgnoreCase)));

                if (priorSettlement is not null)
                {
                    var clawbackTx = wallet.ClawbackSettlement(
                        priorSettlement,
                        bet,
                        reason,
                        revertBonusWager: true);

                    await _transactionRepository.UpdateAsync(priorSettlement, cancellationToken);
                    await _transactionRepository.AddAsync(clawbackTx, cancellationToken);
                    clawbacksExecuted++;
                    walletChanged = true;
                }
                else if (bet.BetStatus.HasValue && bet.BetStatus.Value != BetStatus.Pending)
                {
                    // Apuesta previamente marcada como Lost (sin transacción BetSettlement):
                    // se reabre para evaluarla frente al nuevo resultado oficial.
                    bet.ReopenForResettlement();
                }

                // B. Evaluar y aplicar el nuevo resultado oficial de la selección
                var newSelectionResult = ResolveSelectionResult(market, selection);
                if (newSelectionResult is null)
                    continue;

                var newOutcome = newSelectionResult.Value switch
                {
                    SettlementResult.Won => BetStatus.Won,
                    SettlementResult.Lost => BetStatus.Lost,
                    SettlementResult.Void or SettlementResult.Push => BetStatus.Void,
                    _ => BetStatus.Pending,
                };

                if (newOutcome == BetStatus.Pending)
                    continue;

                var acceptedOdds = bet.AcceptedOdds ?? selection.CurrentOdd.Value;
                var stake = bet.Amount.Amount;
                var newPayout = newOutcome switch
                {
                    BetStatus.Won => Math.Round(stake * acceptedOdds, 2, MidpointRounding.AwayFromZero),
                    BetStatus.Void => Math.Round(stake, 2, MidpointRounding.AwayFromZero),
                    _ => 0m,
                };

                if (newOutcome is BetStatus.Won or BetStatus.Void)
                {
                    var description = newOutcome == BetStatus.Void
                        ? $"Reembolso por re-liquidación VAR ({reason}) · {bet.Id.Value}"
                        : $"Pago por re-liquidación VAR ({reason}) · {bet.Id.Value}";

                    var reference = $"payout-market-{market.Id.Value}-bet-{bet.Id.Value}-resettle-{Guid.NewGuid():N}";

                    var resettledTx = wallet.SettleBet(
                        bet,
                        new Money(newPayout),
                        newSelectionResult.Value,
                        description,
                        reference);

                    resettledTx.Complete();
                    await _transactionRepository.AddAsync(resettledTx, cancellationToken);
                    walletChanged = true;
                }
                else if (newOutcome == BetStatus.Lost)
                {
                    wallet.ReleaseLockedStake(bet);
                    walletChanged = true;
                }

                bet.SettleBet(newOutcome);
                await _transactionRepository.UpdateAsync(bet, cancellationToken);
                betsResettled++;

                await _outboxWriter.WriteAsync(new BetOutcomeSettledDomainEvent(
                    wallet.Id,
                    wallet.UserId,
                    bet.Id,
                    market.Id,
                    newOutcome,
                    new Money(newPayout),
                    wallet.Balance,
                    DateTimeOffset.UtcNow), cancellationToken);
            }

            if (walletChanged)
            {
                if (wallet.RealAvailable.IsNegative)
                {
                    walletsInDebt++;
                }

                await _walletRepository.UpdateAsync(wallet, expectedVersion, cancellationToken);

                foreach (var domainEvent in wallet.DomainEvents)
                {
                    await _outboxWriter.WriteAsync(domainEvent, cancellationToken);
                }

                wallet.ClearDomainEvents();
            }
        }

        return (clawbacksExecuted, betsResettled, walletsInDebt);
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

