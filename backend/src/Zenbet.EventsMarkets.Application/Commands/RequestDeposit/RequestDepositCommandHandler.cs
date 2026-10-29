namespace Zenbet.EventsMarkets.Application.Commands.RequestDeposit;

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
/// Registra la intención de depósito como transacción pendiente de revisión.
/// No acredita saldo: el abono ocurre cuando administración aprueba la
/// solicitud (ApproveDepositCommand → Wallet.CreditDeposit).
/// </summary>
public sealed class RequestDepositCommandHandler : IRequestHandler<RequestDepositCommand, RequestDepositResult>
{
    private readonly IWalletRepository _walletRepository;
    private readonly ITransactionRepository _transactionRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IIdempotencyService _idempotencyService;
    private readonly ILogger<RequestDepositCommandHandler> _logger;

    public RequestDepositCommandHandler(
        IWalletRepository walletRepository,
        ITransactionRepository transactionRepository,
        IUnitOfWork unitOfWork,
        IIdempotencyService idempotencyService,
        ILogger<RequestDepositCommandHandler> logger)
    {
        _walletRepository = walletRepository;
        _transactionRepository = transactionRepository;
        _unitOfWork = unitOfWork;
        _idempotencyService = idempotencyService;
        _logger = logger;
    }

    public async Task<RequestDepositResult> Handle(
        RequestDepositCommand request,
        CancellationToken cancellationToken)
    {
        if (request.Amount <= Money.Zero)
        {
            return Failure("El monto del depósito debe ser mayor a cero.");
        }

        var reference = request.Reference.Trim();
        if (reference.Length is < 4 or > 100)
        {
            return Failure("La referencia del comprobante debe tener entre 4 y 100 caracteres.");
        }

        var idempotencyKey = request.IdempotencyKey.ToString();
        var payloadHash = IdempotencyPayloadHasher.Compute(new
        {
            walletId = request.WalletId.Value,
            amount = request.Amount.Amount,
            method = request.Method,
            request.Reference,
        });

        if (await _idempotencyService.ExistsAsync(
                idempotencyKey,
                nameof(RequestDepositCommand),
                payloadHash,
                cancellationToken))
        {
            var existing = await _transactionRepository.GetDepositByReferenceAsync(
                request.WalletId,
                reference,
                cancellationToken);

            return new RequestDepositResult(
                true,
                existing?.Id,
                existing?.ReferenceId ?? reference,
                existing?.Amount.Amount ?? request.Amount.Amount,
                existing?.Method ?? request.Method,
                DescribeStatus(existing?.Status),
                existing?.CreatedAt,
                "La solicitud ya fue registrada.");
        }

        await _unitOfWork.BeginTransactionAsync(cancellationToken);

        try
        {
            var idempotencyLockKey = BitConverter.ToInt64(request.IdempotencyKey.ToByteArray(), 0);
            await _unitOfWork.TryAcquireAdvisoryLockAsync(idempotencyLockKey, cancellationToken);

            // Serializa operaciones concurrentes de la misma billetera para que
            // el chequeo de referencia única no tenga carrera.
            var lockKey = BitConverter.ToInt64(request.WalletId.Value.ToByteArray(), 0);
            if (!await _unitOfWork.TryAcquireAdvisoryLockAsync(lockKey, cancellationToken))
            {
                throw new InvalidOperationException(
                    $"Wallet {request.WalletId} already has a deposit request in progress.");
            }

            // The fast-path check above can race with another request carrying
            // the same key. Re-check after acquiring the wallet lock so retries
            // observe the committed request instead of being reported as a
            // duplicate receipt reference.
            if (await _idempotencyService.ExistsAsync(
                    idempotencyKey,
                    nameof(RequestDepositCommand),
                    payloadHash,
                    cancellationToken))
            {
                var replay = await _transactionRepository.GetDepositByReferenceAsync(
                    request.WalletId,
                    reference,
                    cancellationToken);

                await _unitOfWork.CommitAsync(cancellationToken);

                return new RequestDepositResult(
                    true,
                    replay?.Id,
                    replay?.ReferenceId ?? reference,
                    replay?.Amount.Amount ?? request.Amount.Amount,
                    replay?.Method ?? request.Method,
                    DescribeStatus(replay?.Status),
                    replay?.CreatedAt,
                    "La solicitud ya fue registrada.");
            }

            var wallet = await _walletRepository.GetByIdAsync(request.WalletId, cancellationToken)
                ?? throw new WalletNotFoundException(request.WalletId);

            var duplicate = await _transactionRepository.GetDepositByReferenceAsync(
                request.WalletId,
                reference,
                cancellationToken);

            if (duplicate is not null && duplicate.Status != TransactionStatus.Rejected)
            {
                await _unitOfWork.CommitAsync(cancellationToken);

                return Failure(
                    "Ese número de comprobante ya fue registrado. Usa la referencia exacta de tu transferencia; si fue rechazada puedes reenviarla.");
            }

            var transaction = Transaction.CreatePendingDeposit(
                wallet.Id,
                wallet.UserId,
                request.Amount,
                request.Method,
                reference,
                wallet.Balance);

            await _transactionRepository.AddAsync(transaction, cancellationToken);

            await _idempotencyService.AddAsync(
                idempotencyKey,
                nameof(RequestDepositCommand),
                cancellationToken,
                payloadHash);

            await _unitOfWork.CommitAsync(cancellationToken);

            _logger.LogInformation(
                "Deposit request created for wallet {WalletId}: {Amount} via {Method}, reference {Reference}",
                request.WalletId,
                request.Amount,
                request.Method,
                reference);

            return new RequestDepositResult(
                true,
                transaction.Id,
                transaction.ReferenceId,
                transaction.Amount.Amount,
                transaction.Method,
                DescribeStatus(transaction.Status),
                transaction.CreatedAt,
                null);
        }
        catch (InvalidTransactionAmountException exception)
        {
            await _unitOfWork.RollbackAsync(cancellationToken);
            return Failure(exception.Message);
        }
        catch (WalletNotFoundException exception)
        {
            await _unitOfWork.RollbackAsync(cancellationToken);
            return Failure(exception.Message);
        }
        catch (Exception exception)
        {
            await _unitOfWork.RollbackAsync(cancellationToken);
            _logger.LogError(
                exception,
                "Error creating deposit request for wallet {WalletId}",
                request.WalletId);
            throw;
        }
    }

    private static RequestDepositResult Failure(string message) =>
        new(false, null, null, null, null, null, null, message);

    private static string DescribeStatus(TransactionStatus? status) => status switch
    {
        TransactionStatus.Approved => "approved",
        TransactionStatus.Rejected => "rejected",
        TransactionStatus.Completed => "completed",
        _ => "pending",
    };
}
