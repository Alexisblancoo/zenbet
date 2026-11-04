namespace Zenbet.EventsMarkets.Application.Commands.PlaceBet;

using System.Security.Cryptography;
using MediatR;
using Microsoft.Extensions.Logging;
using Zenbet.EventsMarkets.Application.Common;
using Zenbet.EventsMarkets.Application.Interfaces;
using Zenbet.EventsMarkets.Domain.Aggregates;
using Zenbet.EventsMarkets.Domain.Enums;
using Zenbet.EventsMarkets.Domain.Repositories;
using Zenbet.EventsMarkets.Domain.ValueObjects;
using Zenbet.EventsMarkets.Domain.Exceptions;

public sealed class PlaceBetCommandHandler : IRequestHandler<PlaceBetCommand, PlaceBetResult>
{
    private readonly IWalletRepository _walletRepository;
    private readonly ISelectionRepository _selectionRepository;
    private readonly IMarketRepository _marketRepository;
    private readonly IEventRepository _eventRepository;
    private readonly ITransactionRepository _transactionRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IOutboxWriter _outboxWriter;
    private readonly IIdempotencyService _idempotencyService;
    private readonly ILogger<PlaceBetCommandHandler> _logger;
    private readonly IRiskManagementService? _riskManagementService;

    public PlaceBetCommandHandler(
        IWalletRepository walletRepository,
        ISelectionRepository selectionRepository,
        IMarketRepository marketRepository,
        IEventRepository eventRepository,
        ITransactionRepository transactionRepository,
        IUnitOfWork unitOfWork,
        IOutboxWriter outboxWriter,
        IIdempotencyService idempotencyService,
        ILogger<PlaceBetCommandHandler> logger,
        IRiskManagementService? riskManagementService = null)
    {
        _walletRepository = walletRepository;
        _selectionRepository = selectionRepository;
        _marketRepository = marketRepository;
        _eventRepository = eventRepository;
        _transactionRepository = transactionRepository;
        _unitOfWork = unitOfWork;
        _outboxWriter = outboxWriter;
        _idempotencyService = idempotencyService;
        _logger = logger;
        _riskManagementService = riskManagementService;
    }

    public async Task<PlaceBetResult> Handle(PlaceBetCommand request, CancellationToken cancellationToken)
    {
        var payloadHash = IdempotencyPayloadHasher.Compute(new
        {
            walletId = request.WalletId.Value,
            selectionId = request.SelectionId.Value,
            amount = request.Amount.Amount,
            request.Description,
            request.PromoCode,
            request.ExpectedOdds,
            request.MaxSlippagePercent,
            request.MinAcceptedOdds,
        });

        PromoCodeDefinition? promoCode = null;
        if (!string.IsNullOrWhiteSpace(request.PromoCode) &&
            !PromoCodeCatalog.TryResolve(request.PromoCode, out promoCode))
        {
            return new PlaceBetResult(
                false,
                null,
                null,
                null,
                "El código promocional no es válido o ya expiró.");
        }

        // 1. Check idempotency first - fast path without loading aggregate
        var idempotencyKey = request.IdempotencyKey.ToString();
        var idempotencyExists = await _idempotencyService.ExistsAsync(
            idempotencyKey,
            nameof(PlaceBetCommand),
            payloadHash,
            cancellationToken);

        if (idempotencyExists)
        {
            _logger.LogInformation("Idempotent place bet request detected for key {Key}, returning existing result",
                request.IdempotencyKey);

            var existing = await _transactionRepository.GetByReferenceIdAsync(
                request.WalletId,
                request.IdempotencyKey.ToString(),
                cancellationToken);

            if (existing is not null)
            {
                return new PlaceBetResult(
                    true,
                    new BetId(existing.Id.Value),
                    existing.Id,
                    null,
                    "Idempotent request - bet already placed",
                    IdempotentReplay: true);
            }

            _logger.LogWarning(
                "Idempotency key {Key} exists without a matching bet transaction",
                request.IdempotencyKey);

            return new PlaceBetResult(
                true,
                BetId.Empty,
                TransactionId.Empty,
                null,
                "Idempotent request - bet already placed",
                IdempotentReplay: true);
        }

        // 2. Start transaction and acquire advisory lock on UserId + SelectionId
        await _unitOfWork.BeginTransactionAsync(cancellationToken);

        try
        {
            // Serialize the key globally before the wallet/selection lock. A
            // reused key aimed at another wallet must still observe the first
            // committed payload before it can create a second transaction.
            var idempotencyLockKey = BitConverter.ToInt64(request.IdempotencyKey.ToByteArray(), 0);
            await _unitOfWork.TryAcquireAdvisoryLockAsync(idempotencyLockKey, cancellationToken);

            // Advisory lock key: hash of UserId + SelectionId to prevent over-spending
            // We need to get the wallet first to get UserId, but we can use a composite key
            var lockKey = ComputeAdvisoryLockKey(request.WalletId, request.SelectionId);
            var lockAcquired = await _unitOfWork.TryAcquireAdvisoryLockAsync(lockKey, cancellationToken);
            if (!lockAcquired)
            {
                throw new InvalidOperationException($"Bet placement for wallet {request.WalletId} and selection {request.SelectionId} is already being processed");
            }

            // Re-check idempotency under lock
            if (await _idempotencyService.ExistsAsync(
                    idempotencyKey,
                    nameof(PlaceBetCommand),
                    payloadHash,
                    cancellationToken))
            {
                var existing = await _transactionRepository.GetByReferenceIdAsync(
                    request.WalletId,
                    request.IdempotencyKey.ToString(),
                    cancellationToken);

                await _unitOfWork.CommitAsync(cancellationToken);

                return new PlaceBetResult(
                    true,
                    existing is null ? BetId.Empty : new BetId(existing.Id.Value),
                    existing?.Id ?? TransactionId.Empty,
                    null,
                    "Idempotent request - bet already placed",
                    IdempotentReplay: true);
            }

            // 3. Load wallet and selection. La cuota aceptada se fija en el
            // servidor: el pago no puede depender de una cuota que el cliente
            // envíe después.
            var wallet = await _walletRepository.GetByIdAsync(request.WalletId, cancellationToken)
                ?? throw new WalletNotFoundException(request.WalletId);

            var selection = await _selectionRepository.GetByIdAsync(request.SelectionId, cancellationToken)
                ?? throw new SelectionNotFoundException(request.SelectionId);

            var market = await _marketRepository.GetBySelectionIdAsync(
                request.SelectionId,
                cancellationToken);
            var @event = market is null
                ? null
                : await _eventRepository.GetByIdAsync(market.EventId, cancellationToken);

            if (market is null ||
                market.Status != MarketStatus.Open ||
                @event is null ||
                !@event.IsBettingOpen(DateTimeOffset.UtcNow) ||
                selection.SettlementResult is not null)
            {
                await _unitOfWork.RollbackAsync(cancellationToken);
                return new PlaceBetResult(
                    false,
                    null,
                    null,
                    null,
                    "El mercado ya no está abierto para apuestas.");
            }

            // Serialize bets from the same user into the same market, even if
            // they target different selections. The xact lock remains held
            // through wallet/transaction/outbox persistence.
            var userMarketLockKey = ComputeUserMarketAdvisoryLockKey(wallet.UserId, market.Id);
            await _unitOfWork.TryAcquireAdvisoryLockAsync(userMarketLockKey, cancellationToken);

            // Serialize bets across all users on the same market to guarantee
            // atomic aggregate risk exposure evaluation and transaction persistence.
            var marketLockKey = ComputeMarketAdvisoryLockKey(market.Id);
            await _unitOfWork.TryAcquireAdvisoryLockAsync(marketLockKey, cancellationToken);

            // The initial reads may have happened while another transaction
            // owned this user-market lock. Refresh the values used for the
            // balance/version check after entering the serialized section.
            wallet = await _walletRepository.GetByIdAsync(request.WalletId, cancellationToken)
                ?? throw new WalletNotFoundException(request.WalletId);
            selection = await _selectionRepository.GetByIdAsync(request.SelectionId, cancellationToken)
                ?? throw new SelectionNotFoundException(request.SelectionId);
            market = await _marketRepository.GetByIdWithSelectionsAsync(market.Id, cancellationToken)
                ?? await _marketRepository.GetBySelectionIdAsync(request.SelectionId, cancellationToken);
            @event = market is null
                ? null
                : await _eventRepository.GetByIdAsync(market.EventId, cancellationToken);

            if (market is null ||
                market.Status != MarketStatus.Open ||
                @event is null ||
                !@event.IsBettingOpen(DateTimeOffset.UtcNow) ||
                selection.SettlementResult is not null)
            {
                await _unitOfWork.RollbackAsync(cancellationToken);
                return new PlaceBetResult(
                    false,
                    null,
                    null,
                    null,
                    "El mercado ya no está abierto para apuestas.");
            }

            var currentOdds = selection.CurrentOdd.Value;

            // Validación de tolerancia al deslizamiento de cuotas (Anti-Slippage)
            if (request.ExpectedOdds.HasValue || request.MinAcceptedOdds.HasValue)
            {
                var minAllowedOdds = request.MinAcceptedOdds ??
                    (request.ExpectedOdds.HasValue && request.MaxSlippagePercent.HasValue
                        ? Math.Round(request.ExpectedOdds.Value * (1m - (request.MaxSlippagePercent.Value / 100m)), 4)
                        : request.ExpectedOdds);

                if (minAllowedOdds.HasValue && currentOdds < minAllowedOdds.Value)
                {
                    await _unitOfWork.RollbackAsync(cancellationToken);
                    _logger.LogWarning(
                        "Slippage excedido para billetera {WalletId}, selección {SelectionId}. Solicitada: {Expected}, Actual: {Current}, Mínima: {MinAllowed}",
                        request.WalletId, request.SelectionId, request.ExpectedOdds, currentOdds, minAllowedOdds);

                    return new PlaceBetResult(
                        false,
                        null,
                        null,
                        null,
                        $"La cuota actual ({currentOdds:F2}) es inferior a la cuota mínima aceptada ({minAllowedOdds.Value:F2}). Acepta el cambio para continuar.",
                        ErrorCode: "ODDS_CHANGED",
                        CurrentOdds: currentOdds,
                        ExpectedOdds: request.ExpectedOdds);
                }
            }

            // Validación atómica de riesgo financiero bajo AdvisoryLock
            if (_riskManagementService is not null)
            {
                var riskResult = await _riskManagementService.ValidatePlaceBetAsync(
                    request.WalletId,
                    request.SelectionId,
                    request.Amount,
                    cancellationToken);

                if (!riskResult.IsValid)
                {
                    await _unitOfWork.RollbackAsync(cancellationToken);
                    _logger.LogWarning(
                        "Límite de riesgo excedido bajo lock para billetera {WalletId}, mercado {MarketId}: {ErrorMessage}",
                        request.WalletId, market.Id, riskResult.ErrorMessage);

                    var errorCode = riskResult.ViolationType switch
                    {
                        RiskViolationType.MaxMarketExposureExceeded => "EXPOSURE_LIMIT_EXCEEDED",
                        RiskViolationType.MaxUserBetLimitExceeded => "USER_LIMIT_EXCEEDED",
                        _ => "RISK_VALIDATION_FAILED"
                    };

                    return new PlaceBetResult(
                        false,
                        null,
                        null,
                        null,
                        riskResult.ErrorMessage ?? "Límite de riesgo financiero excedido.",
                        ErrorCode: errorCode);
                }
            }

            // 3b. Actualización atómica de acumuladores de exposición (SelectionLiability)
            // y Circuit Breaker del 95% bajo el pg_advisory_xact_lock del MarketId.
            if (market.Selections.Any(s => s.Id == request.SelectionId))
            {
                market.RegisterBetExposure(
                    request.SelectionId,
                    request.Amount,
                    currentOdds);
            }

            // 4. Execute domain logic - PlaceBet validates balance, applies Real-First
            // consumption (RealAvailable -> BonusAvailable) and updates ActiveBonus rollover.
            // La versión debe capturarse antes de mutar el agregado: PlaceBet la
            // incrementa y EF la usa como token de concurrencia.
            var wasRolloverCompletedBefore = wallet.ActiveBonus?.IsCompleted ?? false;
            var expectedVersion = wallet.Version;
            var transaction = wallet.PlaceBet(
                request.Amount,
                request.SelectionId,
                request.Description,
                request.IdempotencyKey.ToString(),
                selection.CurrentOdd.Value,
                promoCode?.Code);
            var rolloverJustCompleted = !wasRolloverCompletedBefore && (wallet.ActiveBonus?.IsCompleted ?? false);

            // 5. Persist wallet and market liability changes
            await _walletRepository.UpdateAsync(wallet, expectedVersion, cancellationToken);
            if (market.Selections.Count > 0)
            {
                await _marketRepository.UpdateAsync(market, cancellationToken);
            }

            // 6. Save transaction
            await _transactionRepository.AddAsync(transaction, cancellationToken);

            // 7. Write domain events to outbox (including MarketSuspendedByRiskDomainEvent if triggered)
            foreach (var domainEvent in wallet.DomainEvents)
            {
                await _outboxWriter.WriteAsync(domainEvent, cancellationToken);
            }

            foreach (var marketDomainEvent in market.DomainEvents)
            {
                await _outboxWriter.WriteAsync(marketDomainEvent, cancellationToken);
            }

            // 8. Record idempotency key
            await _idempotencyService.AddAsync(
                idempotencyKey,
                nameof(PlaceBetCommand),
                cancellationToken,
                payloadHash);

            await _unitOfWork.CommitAsync(cancellationToken);

            wallet.ClearDomainEvents();
            market.ClearDomainEvents();

            _logger.LogInformation(
                "Bet placed successfully for wallet {WalletId}, selection {SelectionId}, amount {Amount} (RealStake={RealStake}, BonusStake={BonusStake})",
                request.WalletId, request.SelectionId, request.Amount, transaction.RealStake, transaction.BonusStake);

            // La transacción ES la apuesta en este modelo. Devolver su id como
            // betId hace que el ticket del recibo coincida con el historial de
            // la billetera en lugar de exponer un identificador efímero.
            return new PlaceBetResult(
                true,
                new BetId(transaction.Id.Value),
                transaction.Id,
                wallet.Balance,
                null,
                RealStake: transaction.RealStake,
                BonusStake: transaction.BonusStake,
                RealAvailable: wallet.RealAvailable,
                BonusAvailable: wallet.BonusAvailable,
                RolloverCompleted: rolloverJustCompleted);
        }
        catch (InsufficientFundsException ex)
        {
            await _unitOfWork.RollbackAsync(cancellationToken);
            _logger.LogWarning(ex, "Insufficient funds for wallet {WalletId}", request.WalletId);
            return new PlaceBetResult(
                false,
                null,
                null,
                null,
                ex.Message);
        }
        catch (InvalidTransactionAmountException ex)
        {
            await _unitOfWork.RollbackAsync(cancellationToken);
            _logger.LogWarning(ex, "Invalid bet amount for wallet {WalletId}", request.WalletId);
            return new PlaceBetResult(
                false,
                null,
                null,
                null,
                ex.Message);
        }
        catch (SelectionNotFoundException ex)
        {
            await _unitOfWork.RollbackAsync(cancellationToken);
            _logger.LogWarning(ex, "Selection {SelectionId} not found while placing bet", request.SelectionId);
            return new PlaceBetResult(
                false,
                null,
                null,
                null,
                "La selección ya no está disponible.");
        }
        catch (OddsChangedException ex)
        {
            await _unitOfWork.RollbackAsync(cancellationToken);
            _logger.LogWarning(ex, "Slippage tolerance exceeded for wallet {WalletId}", request.WalletId);
            return new PlaceBetResult(
                false,
                null,
                null,
                null,
                ex.Message,
                ErrorCode: ex.Code,
                CurrentOdds: ex.CurrentOdds,
                ExpectedOdds: ex.RequestedOdds);
        }
        catch (MaxMarketExposureExceededException ex)
        {
            await _unitOfWork.RollbackAsync(cancellationToken);
            _logger.LogWarning(ex, "Max market exposure exceeded for market {MarketId}", ex.MarketId);
            return new PlaceBetResult(
                false,
                null,
                null,
                null,
                ex.Message,
                ErrorCode: "EXPOSURE_LIMIT_EXCEEDED");
        }
        catch (MaxUserBetLimitExceededException ex)
        {
            await _unitOfWork.RollbackAsync(cancellationToken);
            _logger.LogWarning(ex, "Max user bet limit exceeded for wallet {WalletId}", ex.WalletId);
            return new PlaceBetResult(
                false,
                null,
                null,
                null,
                ex.Message,
                ErrorCode: "USER_LIMIT_EXCEEDED");
        }
        catch (RiskLimitExceededException ex)
        {
            await _unitOfWork.RollbackAsync(cancellationToken);
            _logger.LogWarning(ex, "Risk liability limit exceeded for wallet {WalletId}", request.WalletId);
            return new PlaceBetResult(
                false,
                null,
                null,
                null,
                ex.Message,
                ErrorCode: "EXPOSURE_LIMIT_EXCEEDED");
        }
        catch (Exception ex)
        {
            await _unitOfWork.RollbackAsync(cancellationToken);
            _logger.LogError(ex, "Error placing bet for wallet {WalletId}", request.WalletId);
            throw;
        }
    }

    private static long ComputeAdvisoryLockKey(WalletId walletId, SelectionId selectionId)
    {
        // Combine hash of walletId and selectionId for unique lock per wallet+selection
        // Using XOR of first 8 bytes of each Guid
        var walletBytes = walletId.Value.ToByteArray();
        var selectionBytes = selectionId.Value.ToByteArray();

        var walletHash = BitConverter.ToInt64(walletBytes, 0);
        var selectionHash = BitConverter.ToInt64(selectionBytes, 0);

        return walletHash ^ selectionHash;
    }

    private static long ComputeUserMarketAdvisoryLockKey(UserId userId, MarketId marketId)
    {
        var identifiers = userId.Value.ToByteArray()
            .Concat(marketId.Value.ToByteArray())
            .ToArray();
        var hash = SHA256.HashData(identifiers);
        return BitConverter.ToInt64(hash, 0);
    }

    private static long ComputeMarketAdvisoryLockKey(MarketId marketId)
    {
        var hash = SHA256.HashData(marketId.Value.ToByteArray());
        return BitConverter.ToInt64(hash, 0);
    }
}
