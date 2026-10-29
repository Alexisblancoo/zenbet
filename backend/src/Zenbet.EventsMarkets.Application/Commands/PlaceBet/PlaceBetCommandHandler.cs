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

    public PlaceBetCommandHandler(
        IWalletRepository walletRepository,
        ISelectionRepository selectionRepository,
        IMarketRepository marketRepository,
        IEventRepository eventRepository,
        ITransactionRepository transactionRepository,
        IUnitOfWork unitOfWork,
        IOutboxWriter outboxWriter,
        IIdempotencyService idempotencyService,
        ILogger<PlaceBetCommandHandler> logger)
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

            // The initial reads may have happened while another transaction
            // owned this user-market lock. Refresh the values used for the
            // balance/version check after entering the serialized section.
            wallet = await _walletRepository.GetByIdAsync(request.WalletId, cancellationToken)
                ?? throw new WalletNotFoundException(request.WalletId);
            selection = await _selectionRepository.GetByIdAsync(request.SelectionId, cancellationToken)
                ?? throw new SelectionNotFoundException(request.SelectionId);
            market = await _marketRepository.GetBySelectionIdAsync(request.SelectionId, cancellationToken);
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

            // 4. Execute domain logic - PlaceBet validates balance and creates transaction.
            // La versión debe capturarse antes de mutar el agregado: PlaceBet la
            // incrementa y EF la usa como token de concurrencia.
            var expectedVersion = wallet.Version;
            var transaction = wallet.PlaceBet(
                request.Amount,
                request.SelectionId,
                request.Description,
                request.IdempotencyKey.ToString(),
                selection.CurrentOdd.Value,
                promoCode?.Code);

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
            await _idempotencyService.AddAsync(
                idempotencyKey,
                nameof(PlaceBetCommand),
                cancellationToken,
                payloadHash);

            await _unitOfWork.CommitAsync(cancellationToken);

            wallet.ClearDomainEvents();

            _logger.LogInformation("Bet placed successfully for wallet {WalletId}, selection {SelectionId}, amount {Amount}",
                request.WalletId, request.SelectionId, request.Amount);

            // La transacción ES la apuesta en este modelo. Devolver su id como
            // betId hace que el ticket del recibo coincida con el historial de
            // la billetera en lugar de exponer un identificador efímero.
            return new PlaceBetResult(
                true,
                new BetId(transaction.Id.Value),
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
}
