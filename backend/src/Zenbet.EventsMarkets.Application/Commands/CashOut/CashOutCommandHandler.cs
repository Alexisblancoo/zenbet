namespace Zenbet.EventsMarkets.Application.Commands.CashOut;

using MediatR;
using Microsoft.Extensions.Logging;
using Zenbet.EventsMarkets.Application.Common;
using Zenbet.EventsMarkets.Application.Interfaces;
using Zenbet.EventsMarkets.Domain.Aggregates;
using Zenbet.EventsMarkets.Domain.Enums;
using Zenbet.EventsMarkets.Domain.Exceptions;
using Zenbet.EventsMarkets.Domain.Repositories;
using Zenbet.EventsMarkets.Domain.ValueObjects;

/// <summary>
/// Dynamic Cashout Engine: liquida anticipadamente una apuesta pendiente.
///
/// Reglas de negocio:
/// <list type="bullet">
/// <item><description>Toda la operación se serializa con <c>pg_advisory_xact_lock</c> sobre el <c>WalletId</c>.</description></item>
/// <item><description>Valor = (Cuota Actual / Cuota Inicial) * Stake * <see cref="RetentionMargin"/>.</description></item>
/// <item><description>Un mercado suspendido por riesgo rechaza el Cash Out de inmediato.</description></item>
/// <item><description>Se libera el stake de <c>RealLocked</c> / <c>BonusLocked</c> y se acredita el valor en <c>RealAvailable</c>.</description></item>
/// <item><description>El ledger registra un movimiento <c>CashOut</c> y el boleto queda en <c>CashedOut</c>.</description></item>
/// </list>
/// </summary>
public sealed class CashOutCommandHandler : IRequestHandler<CashOutCommand, CashOutResult>
{
    /// <summary>Margen de retención de la casa aplicado al valor teórico del Cash Out.</summary>
    public const decimal RetentionMargin = CashOutPricing.DefaultRetentionMargin;

    private readonly IWalletRepository _walletRepository;
    private readonly ITransactionRepository _transactionRepository;
    private readonly ISelectionRepository _selectionRepository;
    private readonly IMarketRepository _marketRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IOutboxWriter _outboxWriter;
    private readonly IIdempotencyService _idempotencyService;
    private readonly ILogger<CashOutCommandHandler> _logger;

    public CashOutCommandHandler(
        IWalletRepository walletRepository,
        ITransactionRepository transactionRepository,
        ISelectionRepository selectionRepository,
        IMarketRepository marketRepository,
        IUnitOfWork unitOfWork,
        IOutboxWriter outboxWriter,
        IIdempotencyService idempotencyService,
        ILogger<CashOutCommandHandler> logger)
    {
        _walletRepository = walletRepository;
        _transactionRepository = transactionRepository;
        _selectionRepository = selectionRepository;
        _marketRepository = marketRepository;
        _unitOfWork = unitOfWork;
        _outboxWriter = outboxWriter;
        _idempotencyService = idempotencyService;
        _logger = logger;
    }

    public async Task<CashOutResult> Handle(CashOutCommand request, CancellationToken cancellationToken)
    {
        var idempotencyKey = request.IdempotencyKey.ToString();
        var payloadHash = IdempotencyPayloadHasher.Compute(new
        {
            walletId = request.WalletId.Value,
            betId = request.BetId.Value,
        });

        // 1. Fast path: una solicitud ya confirmada no vuelve a tocar la billetera.
        var replayed = await TryGetReplayAsync(request, idempotencyKey, payloadHash, cancellationToken);
        if (replayed is not null)
        {
            _logger.LogInformation(
                "Idempotent cash out request detected for key {Key}, returning existing result",
                request.IdempotencyKey);
            return replayed;
        }

        // 2. Transacción + advisory lock del WalletId.
        await _unitOfWork.BeginTransactionAsync(cancellationToken);

        try
        {
            // Serializa la propia clave de idempotencia antes de tocar el agregado.
            var idempotencyLockKey = BitConverter.ToInt64(request.IdempotencyKey.ToByteArray(), 0);
            await _unitOfWork.TryAcquireAdvisoryLockAsync(idempotencyLockKey, cancellationToken);

            // pg_advisory_xact_lock sobre el WalletId: cualquier otro Cash Out o
            // liquidación de la misma billetera espera a que esta termine.
            var walletLockKey = BitConverter.ToInt64(request.WalletId.Value.ToByteArray(), 0);
            var lockAcquired = await _unitOfWork.TryAcquireAdvisoryLockAsync(walletLockKey, cancellationToken);
            if (!lockAcquired)
            {
                throw new InvalidOperationException(
                    $"Cash out for wallet {request.WalletId} is already being processed");
            }

            // 3. Re-check de idempotencia bajo el lock.
            replayed = await TryGetReplayAsync(request, idempotencyKey, payloadHash, cancellationToken);
            if (replayed is not null)
            {
                await _unitOfWork.CommitAsync(cancellationToken);
                return replayed;
            }

            // 4. Cargar el boleto con bloqueo de fila.
            var bet = await _transactionRepository.GetByIdForUpdateAsync(request.BetId, cancellationToken)
                ?? throw new TransactionNotFoundException(request.BetId);

            if (bet.WalletId != request.WalletId)
            {
                return await FailAsync(
                    "La apuesta no pertenece a la billetera indicada.",
                    "BET_WALLET_MISMATCH",
                    cancellationToken);
            }

            if (bet.Type != TransactionType.BetPlacement || bet.BetStatus != BetStatus.Pending)
            {
                return await FailAsync(
                    "La apuesta ya no está pendiente de liquidación.",
                    "BET_NOT_PENDING",
                    cancellationToken);
            }

            if (bet.SelectionId is null)
            {
                return await FailAsync(
                    "La apuesta no tiene una selección asociada.",
                    "BET_WITHOUT_SELECTION",
                    cancellationToken);
            }

            var initialOdds = bet.AcceptedOdds ?? 0m;
            if (initialOdds <= 1m)
            {
                return await FailAsync(
                    "La apuesta no tiene una cuota inicial válida.",
                    "INVALID_INITIAL_ODDS",
                    cancellationToken);
            }

            // 5. Resolver selección y mercado para conocer la cuota actual y el
            // estado de riesgo.
            var selection = await _selectionRepository.GetByIdAsync(bet.SelectionId.Value, cancellationToken)
                ?? throw new SelectionNotFoundException(bet.SelectionId.Value);

            var market = await _marketRepository.GetBySelectionIdAsync(bet.SelectionId.Value, cancellationToken);
            if (market is null)
            {
                return await FailAsync(
                    "El mercado de la apuesta ya no está disponible.",
                    "MARKET_NOT_FOUND",
                    cancellationToken);
            }

            if (market.IsSuspendedByRisk)
            {
                await _unitOfWork.RollbackAsync(cancellationToken);
                _logger.LogWarning(
                    "Cash out rejected for wallet {WalletId}: market {MarketId} is suspended by risk",
                    request.WalletId, market.Id);

                return new CashOutResult(
                    false,
                    null,
                    null,
                    null,
                    "El Cash Out no está disponible: el mercado está suspendido por riesgo.",
                    "MARKET_SUSPENDED_BY_RISK",
                    InitialOdds: initialOdds);
            }

            if (market.Status != MarketStatus.Open)
            {
                return await FailAsync(
                    $"El Cash Out no está disponible: el mercado está en estado {market.Status}.",
                    "MARKET_NOT_OPEN",
                    cancellationToken,
                    initialOdds);
            }

            var currentOdds = selection.CurrentOdd.Value;

            // 6. Fórmula del Cash Out: (Cuota Actual / Cuota Inicial) * Stake * Margen.
            var cashOutAmount = CashOutPricing.Calculate(
                bet.Amount,
                initialOdds,
                currentOdds,
                RetentionMargin);

            if (cashOutAmount <= Money.Zero)
            {
                return await FailAsync(
                    "El valor de Cash Out calculado no es válido.",
                    "INVALID_CASH_OUT_AMOUNT",
                    cancellationToken,
                    initialOdds,
                    currentOdds);
            }

            // 7. Cargar y mutar la billetera. La versión se captura antes de la
            // mutación para que EF la use como token de concurrencia.
            var wallet = await _walletRepository.GetByIdAsync(request.WalletId, cancellationToken)
                ?? throw new WalletNotFoundException(request.WalletId);

            var expectedVersion = wallet.Version;
            var cashOutTransaction = wallet.CashOut(
                bet,
                cashOutAmount,
                market.Id,
                initialOdds,
                currentOdds,
                RetentionMargin,
                referenceId: idempotencyKey);

            // 8. Persistir boleto cerrado, movimiento de ledger y billetera.
            await _transactionRepository.UpdateAsync(bet, cancellationToken);
            await _transactionRepository.AddAsync(cashOutTransaction, cancellationToken);
            await _walletRepository.UpdateAsync(wallet, expectedVersion, cancellationToken);

            foreach (var domainEvent in wallet.DomainEvents)
            {
                await _outboxWriter.WriteAsync(domainEvent, cancellationToken);
            }

            // 9. Registrar idempotencia y confirmar atómicamente.
            await _idempotencyService.AddAsync(
                idempotencyKey,
                nameof(CashOutCommand),
                cancellationToken,
                payloadHash);

            await _unitOfWork.CommitAsync(cancellationToken);
            wallet.ClearDomainEvents();

            _logger.LogInformation(
                "Cash out completed for wallet {WalletId}, bet {BetId}: stake {Stake}, odds {InitialOdds}->{CurrentOdds}, amount {Amount}",
                request.WalletId, request.BetId, bet.Amount, initialOdds, currentOdds, cashOutAmount);

            return new CashOutResult(
                true,
                cashOutTransaction.Id,
                cashOutAmount,
                wallet.Balance,
                null,
                NewRealAvailable: wallet.RealAvailable,
                InitialOdds: initialOdds,
                CurrentOdds: currentOdds,
                RetentionMargin: RetentionMargin);
        }
        catch (TransactionNotFoundException)
        {
            await _unitOfWork.RollbackAsync(cancellationToken);
            throw;
        }
        catch (WalletNotFoundException)
        {
            await _unitOfWork.RollbackAsync(cancellationToken);
            throw;
        }
        catch (SelectionNotFoundException)
        {
            await _unitOfWork.RollbackAsync(cancellationToken);
            throw;
        }
        catch (InvalidTransactionAmountException ex)
        {
            await _unitOfWork.RollbackAsync(cancellationToken);
            _logger.LogWarning(ex, "Invalid cash out amount for wallet {WalletId}", request.WalletId);
            return new CashOutResult(false, null, null, null, ex.Message, "INVALID_CASH_OUT_AMOUNT");
        }
        catch (Exception ex)
        {
            await _unitOfWork.RollbackAsync(cancellationToken);
            _logger.LogError(ex, "Error processing cash out for wallet {WalletId}", request.WalletId);
            throw;
        }
    }

    private async Task<CashOutResult?> TryGetReplayAsync(
        CashOutCommand request,
        string idempotencyKey,
        string payloadHash,
        CancellationToken cancellationToken)
    {
        if (!await _idempotencyService.ExistsAsync(
                idempotencyKey,
                nameof(CashOutCommand),
                payloadHash,
                cancellationToken))
        {
            return null;
        }

        var existing = await _transactionRepository.GetAnyByReferenceIdAsync(
            request.WalletId,
            idempotencyKey,
            cancellationToken);

        if (existing is null || existing.Type != TransactionType.CashOut)
        {
            return null;
        }

        return new CashOutResult(
            true,
            existing.Id,
            existing.Amount,
            existing.BalanceAfter,
            null,
            IdempotentReplay: true);
    }

    private async Task<CashOutResult> FailAsync(
        string message,
        string errorCode,
        CancellationToken cancellationToken,
        decimal? initialOdds = null,
        decimal? currentOdds = null)
    {
        await _unitOfWork.RollbackAsync(cancellationToken);
        return new CashOutResult(
            false,
            null,
            null,
            null,
            message,
            errorCode,
            InitialOdds: initialOdds,
            CurrentOdds: currentOdds);
    }
}
