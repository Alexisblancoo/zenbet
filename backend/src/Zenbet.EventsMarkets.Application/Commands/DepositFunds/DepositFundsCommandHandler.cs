namespace Zenbet.EventsMarkets.Application.Commands.DepositFunds;

using MediatR;
using Microsoft.Extensions.Logging;
using Zenbet.EventsMarkets.Application.Interfaces;
using Zenbet.EventsMarkets.Domain.Exceptions;
using Zenbet.EventsMarkets.Domain.Repositories;
using Zenbet.EventsMarkets.Domain.ValueObjects;

/// <summary>
/// Recarga autenticada de la billetera. En este entorno el abono se acredita de
/// inmediato; la pasarela de pago real queda fuera del alcance del dominio.
/// </summary>
public sealed class DepositFundsCommandHandler : IRequestHandler<DepositFundsCommand, DepositFundsResult>
{
    private readonly IWalletRepository _walletRepository;
    private readonly ITransactionRepository _transactionRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IOutboxWriter _outboxWriter;
    private readonly IIdempotencyService _idempotencyService;
    private readonly ILogger<DepositFundsCommandHandler> _logger;

    public DepositFundsCommandHandler(
        IWalletRepository walletRepository,
        ITransactionRepository transactionRepository,
        IUnitOfWork unitOfWork,
        IOutboxWriter outboxWriter,
        IIdempotencyService idempotencyService,
        ILogger<DepositFundsCommandHandler> logger)
    {
        _walletRepository = walletRepository;
        _transactionRepository = transactionRepository;
        _unitOfWork = unitOfWork;
        _outboxWriter = outboxWriter;
        _idempotencyService = idempotencyService;
        _logger = logger;
    }

    public async Task<DepositFundsResult> Handle(
        DepositFundsCommand request,
        CancellationToken cancellationToken)
    {
        if (request.Amount <= Money.Zero)
        {
            return Failure("El monto de la recarga debe ser mayor a cero.");
        }

        var idempotencyKey = request.IdempotencyKey.ToString();

        if (await _idempotencyService.ExistsAsync(idempotencyKey, cancellationToken))
        {
            var existingWallet = await _walletRepository.GetByIdAsync(
                request.WalletId,
                cancellationToken);

            return new DepositFundsResult(
                true,
                null,
                existingWallet?.Balance,
                "La recarga ya fue procesada.");
        }

        await _unitOfWork.BeginTransactionAsync(cancellationToken);

        try
        {
            var lockKey = BitConverter.ToInt64(request.WalletId.Value.ToByteArray(), 0);
            if (!await _unitOfWork.TryAcquireAdvisoryLockAsync(lockKey, cancellationToken))
            {
                throw new InvalidOperationException(
                    $"Wallet {request.WalletId} already has a deposit in progress.");
            }

            // Revalidar bajo el lock para que dos reintentos simultáneos no
            // acrediten el mismo movimiento dos veces.
            if (await _idempotencyService.ExistsAsync(idempotencyKey, cancellationToken))
            {
                var existingWallet = await _walletRepository.GetByIdAsync(
                    request.WalletId,
                    cancellationToken);

                await _unitOfWork.CommitAsync(cancellationToken);

                return new DepositFundsResult(
                    true,
                    null,
                    existingWallet?.Balance,
                    "La recarga ya fue procesada.");
            }

            var wallet = await _walletRepository.GetByIdAsync(request.WalletId, cancellationToken)
                ?? throw new WalletNotFoundException(request.WalletId);

            var expectedVersion = wallet.Version;
            var transaction = wallet.Deposit(
                request.Amount,
                DescribeDeposit(request.PaymentMethod),
                $"DEP-{request.IdempotencyKey:N}");
            transaction.Complete();

            await _walletRepository.UpdateAsync(wallet, expectedVersion, cancellationToken);
            await _transactionRepository.AddAsync(transaction, cancellationToken);

            foreach (var domainEvent in wallet.DomainEvents)
            {
                await _outboxWriter.WriteAsync(domainEvent, cancellationToken);
            }

            await _idempotencyService.AddAsync(
                idempotencyKey,
                nameof(DepositFundsCommand),
                cancellationToken);

            await _unitOfWork.CommitAsync(cancellationToken);
            wallet.ClearDomainEvents();

            _logger.LogInformation(
                "Deposit completed for wallet {WalletId}: {Amount} via {PaymentMethod}",
                request.WalletId,
                request.Amount,
                request.PaymentMethod);

            return new DepositFundsResult(
                true,
                transaction.Id,
                wallet.Balance,
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
                "Error depositing funds for wallet {WalletId}",
                request.WalletId);
            throw;
        }
    }

    private static DepositFundsResult Failure(string message) =>
        new(false, null, null, message);

    private static string DescribeDeposit(string paymentMethod) =>
        paymentMethod.Trim().ToLowerInvariant() switch
        {
            "card" or "tarjeta" => "Recarga · tarjeta",
            "crypto" or "cripto" => "Recarga · cripto",
            "spei" or "transfer" or "transferencia" => "Recarga · transferencia",
            _ => "Recarga de saldo",
        };
}
