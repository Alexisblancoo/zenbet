namespace Zenbet.EventsMarkets.Application.Commands.Rgs;

using MediatR;
using Microsoft.Extensions.Logging;
using Zenbet.EventsMarkets.Application.Common;
using Zenbet.EventsMarkets.Application.Interfaces;
using Zenbet.EventsMarkets.Domain.Enums;
using Zenbet.EventsMarkets.Domain.Exceptions;
using Zenbet.EventsMarkets.Domain.Repositories;
using Zenbet.EventsMarkets.Domain.ValueObjects;

public sealed class ProcessRgsBetCommandHandler : IRequestHandler<ProcessRgsBetCommand, RgsWalletResult>
{
    private readonly IWalletRepository _walletRepository;
    private readonly ITransactionRepository _transactionRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IOutboxWriter _outboxWriter;
    private readonly IIdempotencyService _idempotencyService;
    private readonly ILogger<ProcessRgsBetCommandHandler> _logger;

    public ProcessRgsBetCommandHandler(
        IWalletRepository walletRepository,
        ITransactionRepository transactionRepository,
        IUnitOfWork unitOfWork,
        IOutboxWriter outboxWriter,
        IIdempotencyService idempotencyService,
        ILogger<ProcessRgsBetCommandHandler> logger)
    {
        _walletRepository = walletRepository;
        _transactionRepository = transactionRepository;
        _unitOfWork = unitOfWork;
        _outboxWriter = outboxWriter;
        _idempotencyService = idempotencyService;
        _logger = logger;
    }

    public async Task<RgsWalletResult> Handle(ProcessRgsBetCommand request, CancellationToken cancellationToken)
    {
        if (request.Amount <= Money.Zero)
        {
            return new RgsWalletResult(
                false, request.WalletId, 0m, 0m, 0m, 0m, 0m, null, request.ProviderTransactionId,
                ErrorCode: "INVALID_AMOUNT",
                ErrorMessage: "El monto de la apuesta RGS debe ser mayor a cero.");
        }

        var normalizedTxId = request.ProviderTransactionId.Trim();
        var idempotencyKey = $"RGS:BET:{request.ProviderId}:{normalizedTxId}";
        var payloadHash = IdempotencyPayloadHasher.Compute(new
        {
            walletId = request.WalletId.Value,
            amount = request.Amount.Amount,
            providerTransactionId = normalizedTxId,
            gameId = request.GameId,
            roundId = request.RoundId,
        });

        await _unitOfWork.BeginTransactionAsync(cancellationToken);

        try
        {
            // 1. Lock transaccional determinístico por ProviderTransactionId y por WalletId
            var txLockKey = RgsAdvisoryLockKey.ForProviderTransaction(request.WalletId, normalizedTxId);
            await _unitOfWork.TryAcquireAdvisoryLockAsync(txLockKey, cancellationToken);

            var walletLockKey = RgsAdvisoryLockKey.ForWallet(request.WalletId);
            await _unitOfWork.TryAcquireAdvisoryLockAsync(walletLockKey, cancellationToken);

            var wallet = await _walletRepository.GetByIdForUpdateAsync(request.WalletId, cancellationToken)
                ?? throw new WalletNotFoundException(request.WalletId);

            // 2. Verificar si existe una transacción previa o una lápida (Tombstone) de Rollback
            var existingTx = await _transactionRepository.GetAnyByReferenceIdAsync(
                request.WalletId,
                normalizedTxId,
                cancellationToken);

            if (existingTx is not null)
            {
                await _unitOfWork.CommitAsync(cancellationToken);

                // Si existe un Tombstone (rollback llegó antes que el bet por timeout del proveedor),
                // rechazamos el cobro tardío sin afectar el saldo.
                if (existingTx.Type == TransactionType.BetCancellation ||
                    existingTx.Status == TransactionStatus.Cancelled)
                {
                    _logger.LogWarning(
                        "RGS Bet {ProviderTxId} intercepted by Tombstone on wallet {WalletId}",
                        normalizedTxId, request.WalletId);

                    return new RgsWalletResult(
                        Success: false,
                        WalletId: wallet.Id,
                        TotalBalance: wallet.RealAvailable.Amount + wallet.BonusAvailable.Amount,
                        RealAvailable: wallet.RealAvailable.Amount,
                        BonusAvailable: wallet.BonusAvailable.Amount,
                        RealComponent: 0m,
                        BonusComponent: 0m,
                        PlatformTransactionId: existingTx.Id.Value.ToString(),
                        ProviderTransactionId: normalizedTxId,
                        IdempotentReplay: true,
                        ErrorCode: "BET_ALREADY_ROLLED_BACK",
                        ErrorMessage: "La apuesta fue anulada previamente mediante Tombstone Rollback.");
                }

                // Idempotencia estricta: devolver exactamente el resultado de éxito previo sin doble cobro
                return new RgsWalletResult(
                    Success: true,
                    WalletId: wallet.Id,
                    TotalBalance: wallet.RealAvailable.Amount + wallet.BonusAvailable.Amount,
                    RealAvailable: wallet.RealAvailable.Amount,
                    BonusAvailable: wallet.BonusAvailable.Amount,
                    RealComponent: existingTx.RealStake.Amount,
                    BonusComponent: existingTx.BonusStake.Amount,
                    PlatformTransactionId: existingTx.Id.Value.ToString(),
                    ProviderTransactionId: normalizedTxId,
                    IdempotentReplay: true);
            }

            // 3. Ejecutar consumo Real-First e incremento de Rollover en el dominio
            var expectedVersion = wallet.Version;
            var betTransaction = wallet.PlaceRgsBet(
                request.Amount,
                normalizedTxId,
                request.GameId,
                request.RoundId);

            await _walletRepository.UpdateAsync(wallet, expectedVersion, cancellationToken);
            await _transactionRepository.AddAsync(betTransaction, cancellationToken);

            foreach (var domainEvent in wallet.DomainEvents)
            {
                await _outboxWriter.WriteAsync(domainEvent, cancellationToken);
            }

            await _idempotencyService.AddAsync(
                idempotencyKey,
                nameof(ProcessRgsBetCommand),
                cancellationToken,
                payloadHash);

            await _unitOfWork.CommitAsync(cancellationToken);
            wallet.ClearDomainEvents();

            _logger.LogInformation(
                "RGS Bet processed: Wallet={WalletId}, ProviderTx={ProviderTxId}, Amount={Amount} (Real={RealStake}, Bonus={BonusStake})",
                wallet.Id, normalizedTxId, request.Amount, betTransaction.RealStake, betTransaction.BonusStake);

            return new RgsWalletResult(
                Success: true,
                WalletId: wallet.Id,
                TotalBalance: wallet.RealAvailable.Amount + wallet.BonusAvailable.Amount,
                RealAvailable: wallet.RealAvailable.Amount,
                BonusAvailable: wallet.BonusAvailable.Amount,
                RealComponent: betTransaction.RealStake.Amount,
                BonusComponent: betTransaction.BonusStake.Amount,
                PlatformTransactionId: betTransaction.Id.Value.ToString(),
                ProviderTransactionId: normalizedTxId);
        }
        catch (InsufficientFundsException ex)
        {
            await _unitOfWork.RollbackAsync(cancellationToken);
            var currentWallet = await _walletRepository.GetByIdAsync(request.WalletId, cancellationToken);
            var realAvail = currentWallet?.RealAvailable.Amount ?? 0m;
            var bonusAvail = currentWallet?.BonusAvailable.Amount ?? 0m;

            return new RgsWalletResult(
                Success: false,
                WalletId: request.WalletId,
                TotalBalance: realAvail + bonusAvail,
                RealAvailable: realAvail,
                BonusAvailable: bonusAvail,
                RealComponent: 0m,
                BonusComponent: 0m,
                PlatformTransactionId: null,
                ProviderTransactionId: normalizedTxId,
                ErrorCode: "INSUFFICIENT_FUNDS",
                ErrorMessage: ex.Message);
        }
        catch (WalletNotFoundException ex)
        {
            await _unitOfWork.RollbackAsync(cancellationToken);
            return new RgsWalletResult(
                false, request.WalletId, 0m, 0m, 0m, 0m, 0m, null, normalizedTxId,
                ErrorCode: "WALLET_NOT_FOUND",
                ErrorMessage: ex.Message);
        }
        catch (Exception ex)
        {
            await _unitOfWork.RollbackAsync(cancellationToken);
            _logger.LogError(ex, "Error processing RGS Bet {ProviderTxId} for wallet {WalletId}", normalizedTxId, request.WalletId);
            throw;
        }
    }
}

