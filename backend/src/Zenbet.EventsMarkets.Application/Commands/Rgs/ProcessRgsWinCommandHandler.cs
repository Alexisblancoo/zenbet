namespace Zenbet.EventsMarkets.Application.Commands.Rgs;

using MediatR;
using Microsoft.Extensions.Logging;
using Zenbet.EventsMarkets.Application.Common;
using Zenbet.EventsMarkets.Application.Interfaces;
using Zenbet.EventsMarkets.Domain.Enums;
using Zenbet.EventsMarkets.Domain.Exceptions;
using Zenbet.EventsMarkets.Domain.Repositories;
using Zenbet.EventsMarkets.Domain.ValueObjects;

public sealed class ProcessRgsWinCommandHandler : IRequestHandler<ProcessRgsWinCommand, RgsWalletResult>
{
    private readonly IWalletRepository _walletRepository;
    private readonly ITransactionRepository _transactionRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IOutboxWriter _outboxWriter;
    private readonly IIdempotencyService _idempotencyService;
    private readonly ILogger<ProcessRgsWinCommandHandler> _logger;

    public ProcessRgsWinCommandHandler(
        IWalletRepository walletRepository,
        ITransactionRepository transactionRepository,
        IUnitOfWork unitOfWork,
        IOutboxWriter outboxWriter,
        IIdempotencyService idempotencyService,
        ILogger<ProcessRgsWinCommandHandler> logger)
    {
        _walletRepository = walletRepository;
        _transactionRepository = transactionRepository;
        _unitOfWork = unitOfWork;
        _outboxWriter = outboxWriter;
        _idempotencyService = idempotencyService;
        _logger = logger;
    }

    public async Task<RgsWalletResult> Handle(ProcessRgsWinCommand request, CancellationToken cancellationToken)
    {
        if (request.WinAmount < Money.Zero)
        {
            return new RgsWalletResult(
                false, request.WalletId, 0m, 0m, 0m, 0m, 0m, null, request.ProviderTransactionId,
                ErrorCode: "INVALID_AMOUNT",
                ErrorMessage: "El monto de ganancia RGS no puede ser negativo.");
        }

        var normalizedTxId = request.ProviderTransactionId.Trim();
        var idempotencyKey = $"RGS:WIN:{request.ProviderId}:{normalizedTxId}";
        var payloadHash = IdempotencyPayloadHasher.Compute(new
        {
            walletId = request.WalletId.Value,
            winAmount = request.WinAmount.Amount,
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

            // 1. Verificar idempotencia estricta bajo el lock transaccional
            var existingWinTx = await _transactionRepository.GetAnyByReferenceIdAsync(
                request.WalletId,
                normalizedTxId,
                cancellationToken);

            if (existingWinTx is not null && existingWinTx.Type == TransactionType.BetSettlement)
            {
                await _unitOfWork.CommitAsync(cancellationToken);

                return new RgsWalletResult(
                    Success: true,
                    WalletId: wallet.Id,
                    TotalBalance: wallet.RealAvailable.Amount + wallet.BonusAvailable.Amount,
                    RealAvailable: wallet.RealAvailable.Amount,
                    BonusAvailable: wallet.BonusAvailable.Amount,
                    RealComponent: existingWinTx.RealStake.Amount,
                    BonusComponent: existingWinTx.BonusStake.Amount,
                    PlatformTransactionId: existingWinTx.Id.Value.ToString(),
                    ProviderTransactionId: normalizedTxId,
                    IdempotentReplay: true);
            }

            // 2. Localizar la apuesta original para calcular la proporción exacta (RealStake / BonusStake)
            var originalBet = !string.IsNullOrWhiteSpace(request.OriginalBetTransactionId)
                ? await _transactionRepository.GetByReferenceIdAsync(
                    request.WalletId,
                    request.OriginalBetTransactionId.Trim(),
                    cancellationToken)
                : await _transactionRepository.GetLatestRgsBetByRoundIdAsync(
                    request.WalletId,
                    request.RoundId,
                    cancellationToken);

            var expectedVersion = wallet.Version;
            var winTransaction = wallet.CreditRgsWin(
                request.WinAmount,
                normalizedTxId,
                originalBet,
                request.GameId,
                request.RoundId);

            if (originalBet is not null && originalBet.BetStatus == BetStatus.Pending)
            {
                originalBet.SettleBet(request.WinAmount > Money.Zero ? BetStatus.Won : BetStatus.Lost);
                await _transactionRepository.UpdateAsync(originalBet, cancellationToken);
            }

            await _walletRepository.UpdateAsync(wallet, expectedVersion, cancellationToken);
            await _transactionRepository.AddAsync(winTransaction, cancellationToken);

            foreach (var domainEvent in wallet.DomainEvents)
            {
                await _outboxWriter.WriteAsync(domainEvent, cancellationToken);
            }

            await _idempotencyService.AddAsync(
                idempotencyKey,
                nameof(ProcessRgsWinCommand),
                cancellationToken,
                payloadHash);

            await _unitOfWork.CommitAsync(cancellationToken);
            wallet.ClearDomainEvents();

            _logger.LogInformation(
                "RGS Win processed: Wallet={WalletId}, ProviderTx={ProviderTxId}, Win={WinAmount} (RealPayout={RealPayout}, BonusPayout={BonusPayout})",
                wallet.Id, normalizedTxId, request.WinAmount, winTransaction.RealStake, winTransaction.BonusStake);

            return new RgsWalletResult(
                Success: true,
                WalletId: wallet.Id,
                TotalBalance: wallet.RealAvailable.Amount + wallet.BonusAvailable.Amount,
                RealAvailable: wallet.RealAvailable.Amount,
                BonusAvailable: wallet.BonusAvailable.Amount,
                RealComponent: winTransaction.RealStake.Amount,
                BonusComponent: winTransaction.BonusStake.Amount,
                PlatformTransactionId: winTransaction.Id.Value.ToString(),
                ProviderTransactionId: normalizedTxId);
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
            _logger.LogError(ex, "Error processing RGS Win {ProviderTxId} for wallet {WalletId}", normalizedTxId, request.WalletId);
            throw;
        }
    }
}

