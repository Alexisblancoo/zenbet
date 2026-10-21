namespace Zenbet.EventsMarkets.Application.Commands.PlaceBet;

using MediatR;
using Microsoft.Extensions.Logging;
using Zenbet.EventsMarkets.Application.Interfaces;
using Zenbet.EventsMarkets.Domain.Aggregates;
using Zenbet.EventsMarkets.Domain.Repositories;
using Zenbet.EventsMarkets.Domain.ValueObjects;
using Zenbet.EventsMarkets.Domain.Exceptions;

public sealed class PlaceBetCommandHandler : IRequestHandler<PlaceBetCommand, PlaceBetResult>
{
    private readonly IWalletRepository _walletRepository;
    private readonly ITransactionRepository _transactionRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IOutboxWriter _outboxWriter;
    private readonly IIdempotencyService _idempotencyService;
    private readonly ILogger<PlaceBetCommandHandler> _logger;

    public PlaceBetCommandHandler(
        IWalletRepository walletRepository,
        ITransactionRepository transactionRepository,
        IUnitOfWork unitOfWork,
        IOutboxWriter outboxWriter,
        IIdempotencyService idempotencyService,
        ILogger<PlaceBetCommandHandler> logger)
    {
        _walletRepository = walletRepository;
        _transactionRepository = transactionRepository;
        _unitOfWork = unitOfWork;
        _outboxWriter = outboxWriter;
        _idempotencyService = idempotencyService;
        _logger = logger;
    }

    public async Task<PlaceBetResult> Handle(PlaceBetCommand request, CancellationToken cancellationToken)
    {
        // 1. Check idempotency first - fast path without loading aggregate
        var idempotencyExists = await _idempotencyService.ExistsAsync(request.IdempotencyKey.ToString(), cancellationToken);

        if (idempotencyExists)
        {
            _logger.LogInformation("Idempotent place bet request detected for key {Key}, returning existing result",
                request.IdempotencyKey);

            // Try to find existing transaction for this idempotency key
            // For simplicity, we'll return a generic success - in production you'd query the audit
            return new PlaceBetResult(
                true,
                BetId.Empty,
                TransactionId.Empty,
                null,
                "Idempotent request - bet already placed");
        }

        // 2. Start transaction and acquire advisory lock on UserId + SelectionId
        await _unitOfWork.BeginTransactionAsync(cancellationToken);

        try
        {
            // Advisory lock key: hash of UserId + SelectionId to prevent over-spending
            // We need to get the wallet first to get UserId, but we can use a composite key
            var lockKey = ComputeAdvisoryLockKey(request.WalletId, request.SelectionId);
            var lockAcquired = await _unitOfWork.TryAcquireAdvisoryLockAsync(lockKey, cancellationToken);
            if (!lockAcquired)
            {
                throw new InvalidOperationException($"Bet placement for wallet {request.WalletId} and selection {request.SelectionId} is already being processed");
            }

            // Re-check idempotency under lock
            if (await _idempotencyService.ExistsAsync(request.IdempotencyKey.ToString(), cancellationToken))
            {
                await _unitOfWork.CommitAsync(cancellationToken);
                return new PlaceBetResult(
                    true,
                    BetId.Empty,
                    TransactionId.Empty,
                    null,
                    "Idempotent request - bet already placed");
            }

            // 3. Load wallet
            var wallet = await _walletRepository.GetByIdAsync(request.WalletId, cancellationToken)
                ?? throw new WalletNotFoundException(request.WalletId);

            // 4. Execute domain logic - PlaceBet validates balance and creates transaction.
            // La versión debe capturarse antes de mutar el agregado: PlaceBet la
            // incrementa y EF la usa como token de concurrencia.
            var expectedVersion = wallet.Version;
            var transaction = wallet.PlaceBet(request.Amount, request.SelectionId, request.Description, request.IdempotencyKey.ToString());

            // 5. Persist wallet changes
            await _walletRepository.UpdateAsync(wallet, expectedVersion, cancellationToken);

            // 6. Save transaction
            await _transactionRepository.AddAsync(transaction, cancellationToken);

            // 7. Write domain events to outbox
            foreach (var domainEvent in wallet.DomainEvents)
            {
                await _outboxWriter.WriteAsync(domainEvent, cancellationToken);
            }

            // 8. Record idempotency key
            await _idempotencyService.AddAsync(request.IdempotencyKey.ToString(), nameof(PlaceBetCommand), cancellationToken);

            await _unitOfWork.CommitAsync(cancellationToken);

            wallet.ClearDomainEvents();

            _logger.LogInformation("Bet placed successfully for wallet {WalletId}, selection {SelectionId}, amount {Amount}",
                request.WalletId, request.SelectionId, request.Amount);

            return new PlaceBetResult(
                true,
                BetId.New(), // In production, you might have a separate Bet aggregate with its own ID
                transaction.Id,
                wallet.Balance,
                null);
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
}