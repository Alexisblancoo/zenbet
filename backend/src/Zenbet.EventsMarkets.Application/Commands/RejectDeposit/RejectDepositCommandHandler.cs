namespace Zenbet.EventsMarkets.Application.Commands.RejectDeposit;

using MediatR;
using Microsoft.Extensions.Logging;
using Zenbet.EventsMarkets.Application.Interfaces;
using Zenbet.EventsMarkets.Domain.Repositories;
using Zenbet.EventsMarkets.Domain.ValueObjects;

/// <summary>
/// Marca el depósito pendiente como rechazado. No toca la billetera ni emite
/// eventos: el jugador conserva la referencia y puede reenviarla.
/// </summary>
public sealed class RejectDepositCommandHandler : IRequestHandler<RejectDepositCommand, RejectDepositResult>
{
    private readonly ITransactionRepository _transactionRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<RejectDepositCommandHandler> _logger;

    public RejectDepositCommandHandler(
        ITransactionRepository transactionRepository,
        IUnitOfWork unitOfWork,
        ILogger<RejectDepositCommandHandler> logger)
    {
        _transactionRepository = transactionRepository;
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    public async Task<RejectDepositResult> Handle(
        RejectDepositCommand request,
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
                await _unitOfWork.RollbackAsync(cancellationToken);
                return new RejectDepositResult(false, "El depósito solicitado no existe.");
            }

            if (transaction.Type != Domain.Enums.TransactionType.Deposit
                || transaction.Status != Domain.Enums.TransactionStatus.Pending)
            {
                await _unitOfWork.RollbackAsync(cancellationToken);
                return new RejectDepositResult(
                    false,
                    "El depósito ya fue procesado y no puede rechazarse de nuevo.");
            }

            transaction.Reject(request.Reason ?? string.Empty);
            await _transactionRepository.UpdateAsync(transaction, cancellationToken);

            // El UnitOfWork solo confirma la transacción de BD: el flush de
            // cambios es explícito (mismo patrón que DepositFunds).
            await _unitOfWork.SaveChangesAsync(cancellationToken);
            await _unitOfWork.CommitAsync(cancellationToken);

            _logger.LogInformation(
                "Deposit {TransactionId} rejected: {Reason}",
                request.TransactionId,
                transaction.FailureReason);

            return new RejectDepositResult(true, null);
        }
        catch (InvalidOperationException exception)
        {
            await _unitOfWork.RollbackAsync(cancellationToken);
            return new RejectDepositResult(false, exception.Message);
        }
        catch (Exception exception)
        {
            await _unitOfWork.RollbackAsync(cancellationToken);
            _logger.LogError(
                exception,
                "Error rejecting deposit {TransactionId}",
                request.TransactionId);
            throw;
        }
    }
}
