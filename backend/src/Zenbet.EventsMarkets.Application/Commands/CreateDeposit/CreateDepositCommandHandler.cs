namespace Zenbet.EventsMarkets.Application.Commands.CreateDeposit;

using MediatR;
using Zenbet.EventsMarkets.Application.Interfaces;
using Zenbet.EventsMarkets.Domain.Aggregates;
using Zenbet.EventsMarkets.Domain.Repositories;
using Zenbet.EventsMarkets.Domain.ValueObjects;

public sealed class CreateDepositCommandHandler
    : IRequestHandler<CreateDepositCommand, CreateDepositResult>
{
    private readonly IWalletRepository _walletRepository;
    private readonly ITransactionRepository _transactionRepository;
    private readonly IUnitOfWork _unitOfWork;

    public CreateDepositCommandHandler(
        IWalletRepository walletRepository,
        ITransactionRepository transactionRepository,
        IUnitOfWork unitOfWork)
    {
        _walletRepository = walletRepository;
        _transactionRepository = transactionRepository;
        _unitOfWork = unitOfWork;
    }

    public async Task<CreateDepositResult> Handle(
        CreateDepositCommand request,
        CancellationToken cancellationToken)
    {
        if (request.Amount <= Money.Zero)
        {
            return Failure(
                CreateDepositError.InvalidAmount,
                "El monto del depósito debe ser mayor a cero.");
        }

        var reference = request.Reference.Trim();
        if (reference.Length == 0 || reference.Length > 100)
        {
            return Failure(
                CreateDepositError.InvalidReference,
                "La referencia del depósito es obligatoria y no puede superar los 100 caracteres.");
        }

        var wallet = await _walletRepository.GetByIdAsync(request.WalletId, cancellationToken);
        if (wallet is null)
        {
            return Failure(
                CreateDepositError.WalletNotFound,
                "La billetera de tu sesión no está disponible.");
        }

        var transaction = Transaction.CreatePendingDeposit(
            wallet.Id,
            wallet.UserId,
            request.Amount,
            request.Method,
            reference,
            wallet.Balance);

        await _transactionRepository.AddAsync(transaction, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return new CreateDepositResult(
            true,
            transaction.Id,
            "pending",
            transaction.CreatedAt,
            CreateDepositError.None,
            null);
    }

    private static CreateDepositResult Failure(CreateDepositError error, string message) =>
        new(false, null, null, null, error, message);
}
