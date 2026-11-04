namespace Zenbet.EventsMarkets.Application.Commands.Rgs;

using MediatR;
using Microsoft.Extensions.Logging;
using Zenbet.EventsMarkets.Application.Common;
using Zenbet.EventsMarkets.Application.Interfaces;
using Zenbet.EventsMarkets.Domain.Enums;
using Zenbet.EventsMarkets.Domain.Exceptions;
using Zenbet.EventsMarkets.Domain.Repositories;

public sealed class ProcessRgsRollbackCommandHandler : IRequestHandler<ProcessRgsRollbackCommand, RgsWalletResult>
{
    private readonly IWalletRepository _walletRepository;
    private readonly ITransactionRepository _transactionRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IOutboxWriter _outboxWriter;
    private readonly IIdempotencyService _idempotencyService;
    private readonly ILogger<ProcessRgsRollbackCommandHandler> _logger;

    public ProcessRgsRollbackCommandHandler(
        IWalletRepository walletRepository,
        ITransactionRepository transactionRepository,
        IUnitOfWork unitOfWork,
        IOutboxWriter outboxWriter,
        IIdempotencyService idempotencyService,
        ILogger<ProcessRgsRollbackCommandHandler> logger)
    {
        _walletRepository = walletRepository;
        _transactionRepository = transactionRepository;
        _unitOfWork = unitOfWork;
        _outboxWriter = outboxWriter;
        _idempotencyService = idempotencyService;
        _logger = logger;
    }

    public async Task<RgsWalletResult> Handle(ProcessRgsRollbackCommand request, CancellationToken cancellationToken)
    {
        var normalizedTxId = request.ProviderTransactionId.Trim();
        var rollbackReferenceId = $"ROLLBACK:{normalizedTxId}";
        var idempotencyKey = $"RGS:ROLLBACK:{request.ProviderId}:{normalizedTxId}";
        var payloadHash = IdempotencyPayloadHasher.Compute(new
        {
            walletId = request.WalletId.Value,
            providerTransactionId = normalizedTxId,
            gameId = request.GameId,
            roundId = request.RoundId,
        });

        await _unitOfWork.BeginTransactionAsync(cancellationToken);

        try
        {
            var txLockKey = RgsAdvisoryLockKey.ForProviderTransaction(request.WalletId, normalizedTxId);
            await _unitOfWork.TryAcquireAdvisoryLockAsync(txLockKey, cancellationToken);

            var walletLockKey = RgsAdvisoryLockKey.ForWallet(request.WalletId);
            await _unitOfWork.TryAcquireAdvisoryLockAsync(walletLockKey, cancellationToken);

            var wallet = await _walletRepository.GetByIdForUpdateAsync(request.WalletId, cancellationToken)
                ?? throw new WalletNotFoundException(request.WalletId);

            // 1. Verificar si el rollback o el Tombstone ya fue ejecutado previamente
            var existingRollback = await _transactionRepository.GetAnyByReferenceIdAsync(
                request.WalletId,
                rollbackReferenceId,
                cancellationToken);

            if (existingRollback is not null)
            {
                await _unitOfWork.CommitAsync(cancellationToken);

                return new RgsWalletResult(
                    Success: true,
                    WalletId: wallet.Id,
                    TotalBalance: wallet.RealAvailable.Amount + wallet.BonusAvailable.Amount,
                    RealAvailable: wallet.RealAvailable.Amount,
                    BonusAvailable: wallet.BonusAvailable.Amount,
                    RealComponent: existingRollback.RealStake.Amount,
                    BonusComponent: existingRollback.BonusStake.Amount,
                    PlatformTransactionId: existingRollback.Id.Value.ToString(),
                    ProviderTransactionId: normalizedTxId,
                    IdempotentReplay: true);
            }

            var existingTx = await _transactionRepository.GetAnyByReferenceIdAsync(
                request.WalletId,
                normalizedTxId,
                cancellationToken);

            if (existingTx is not null && existingTx.Type == TransactionType.BetCancellation)
            {
                // Ya existe un Tombstone para este ProviderTransactionId
                await _unitOfWork.CommitAsync(cancellationToken);

                return new RgsWalletResult(
                    Success: true,
                    WalletId: wallet.Id,
                    TotalBalance: wallet.RealAvailable.Amount + wallet.BonusAvailable.Amount,
                    RealAvailable: wallet.RealAvailable.Amount,
                    BonusAvailable: wallet.BonusAvailable.Amount,
                    RealComponent: 0m,
                    BonusComponent: 0m,
                    PlatformTransactionId: existingTx.Id.Value.ToString(),
                    ProviderTransactionId: normalizedTxId,
                    IdempotentReplay: true,
                    TombstoneCreated: true);
            }

            // 2. Ejecutar Rollback o insertar Tombstone si la apuesta original nunca llegó
            var expectedVersion = wallet.Version;
            var isTombstone = existingTx is null;
            var rollbackTx = wallet.RollbackRgsBet(
                normalizedTxId,
                existingTx,
                request.RoundId);

            if (existingTx is not null)
            {
                await _transactionRepository.UpdateAsync(existingTx, cancellationToken);
            }

            await _walletRepository.UpdateAsync(wallet, expectedVersion, cancellationToken);
            await _transactionRepository.AddAsync(rollbackTx, cancellationToken);

            foreach (var domainEvent in wallet.DomainEvents)
            {
                await _outboxWriter.WriteAsync(domainEvent, cancellationToken);
            }

            await _idempotencyService.AddAsync(
                idempotencyKey,
                nameof(ProcessRgsRollbackCommand),
                cancellationToken,
                payloadHash);

            await _unitOfWork.CommitAsync(cancellationToken);
            wallet.ClearDomainEvents();

            _logger.LogInformation(
                "RGS Rollback processed (Tombstone={IsTombstone}): Wallet={WalletId}, ProviderTx={ProviderTxId}",
                isTombstone, wallet.Id, normalizedTxId);

            return new RgsWalletResult(
                Success: true,
                WalletId: wallet.Id,
                TotalBalance: wallet.RealAvailable.Amount + wallet.BonusAvailable.Amount,
                RealAvailable: wallet.RealAvailable.Amount,
                BonusAvailable: wallet.BonusAvailable.Amount,
                RealComponent: rollbackTx.RealStake.Amount,
                BonusComponent: rollbackTx.BonusStake.Amount,
                PlatformTransactionId: rollbackTx.Id.Value.ToString(),
                ProviderTransactionId: normalizedTxId,
                TombstoneCreated: isTombstone);
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
            _logger.LogError(ex, "Error processing RGS Rollback {ProviderTxId} for wallet {WalletId}", normalizedTxId, request.WalletId);
            throw;
        }
    }
}

