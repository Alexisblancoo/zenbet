namespace Zenbet.EventsMarkets.Application.Commands.ApproveDeposit;

using MediatR;
using Microsoft.Extensions.Logging;
using Zenbet.EventsMarkets.Application.Interfaces;
using Zenbet.EventsMarkets.Domain.Enums;
using Zenbet.EventsMarkets.Domain.Repositories;
using Zenbet.EventsMarkets.Domain.ValueObjects;

public sealed class ApproveDepositCommandHandler
    : IRequestHandler<ApproveDepositCommand, ApproveDepositResult>
{
    private readonly ITransactionRepository _transactionRepository;
    private readonly IWalletRepository _walletRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IOutboxWriter _outboxWriter;
    private readonly ILogger<ApproveDepositCommandHandler> _logger;

    public ApproveDepositCommandHandler(
        ITransactionRepository transactionRepository,
        IWalletRepository walletRepository,
        IUnitOfWork unitOfWork,
        IOutboxWriter outboxWriter,
        ILogger<ApproveDepositCommandHandler> logger)
    {
        _transactionRepository = transactionRepository;
        _walletRepository = walletRepository;
        _unitOfWork = unitOfWork;
        _outboxWriter = outboxWriter;
        _logger = logger;
    }

    public async Task<ApproveDepositResult> Handle(
        ApproveDepositCommand request,
        CancellationToken cancellationToken)
    {
        await _unitOfWork.BeginTransactionAsync(cancellationToken);

        try
        {
            var transaction = await _transactionRepository.GetByIdForUpdateAsync(
                request.TransactionId,
                cancellationToken);

            if (transaction is null)
            {
                await SafeRollbackAsync(cancellationToken);
                return Failure(
                    ApproveDepositError.TransactionNotFound,
                    "El depósito no existe.");
            }

            if (transaction.Type != TransactionType.Deposit)
            {
                await SafeRollbackAsync(cancellationToken);
                return Failure(
                    ApproveDepositError.NotADeposit,
                    "La transacción no es un depósito.");
            }

            if (transaction.Method is null)
            {
                await SafeRollbackAsync(cancellationToken);
                return Failure(
                    ApproveDepositError.LegacyDeposit,
                    "Este depósito no requiere aprobación manual.");
            }

            if (transaction.Status == TransactionStatus.Approved)
            {
                var currentWallet = await _walletRepository.GetByIdAsync(
                    transaction.WalletId,
                    cancellationToken);

                await _unitOfWork.CommitAsync(cancellationToken);

                return new ApproveDepositResult(
                    true,
                    transaction.Id,
                    "approved",
                    currentWallet?.Balance.Amount ?? transaction.BalanceAfter.Amount,
                    currentWallet?.AtRiskBalance.Amount ?? 0m,
                    true,
                    ApproveDepositError.None,
                    null);
            }

            if (transaction.Status != TransactionStatus.Pending)
            {
                await SafeRollbackAsync(cancellationToken);
                return Failure(
                    ApproveDepositError.InvalidState,
                    $"El depósito está en estado {transaction.Status}.");
            }

            var wallet = await _walletRepository.GetByIdForUpdateAsync(
                transaction.WalletId,
                cancellationToken);

            if (wallet is null)
            {
                await SafeRollbackAsync(cancellationToken);
                return Failure(
                    ApproveDepositError.TransactionNotFound,
                    "La billetera del depósito no existe.");
            }

            wallet.CreditDeposit(transaction);

            foreach (var domainEvent in wallet.DomainEvents)
            {
                await _outboxWriter.WriteAsync(domainEvent, cancellationToken);
            }

            await _unitOfWork.SaveChangesAsync(cancellationToken);

            var newBalance = wallet.Balance.Amount;
            var atRiskBalance = wallet.AtRiskBalance.Amount;

            await _unitOfWork.CommitAsync(cancellationToken);
            wallet.ClearDomainEvents();

            return new ApproveDepositResult(
                true,
                transaction.Id,
                "approved",
                newBalance,
                atRiskBalance,
                false,
                ApproveDepositError.None,
                null);
        }
        catch (InvalidOperationException exception)
        {
            await SafeRollbackAsync(cancellationToken);
            _logger.LogWarning(
                exception,
                "No se pudo aprobar el depósito {TransactionId}.",
                request.TransactionId);

            return Failure(ApproveDepositError.InvalidState, exception.Message);
        }
        catch (Exception)
        {
            await SafeRollbackAsync(cancellationToken);
            throw;
        }
    }

    private async Task SafeRollbackAsync(CancellationToken cancellationToken)
    {
        try
        {
            await _unitOfWork.RollbackAsync(cancellationToken);
        }
        catch (Exception exception)
        {
            _logger.LogWarning(exception, "No se pudo revertir la transacción del depósito.");
        }
    }

    private static ApproveDepositResult Failure(ApproveDepositError error, string message) =>
        new(false, null, null, null, null, false, error, message);
}
