namespace Zenbet.EventsMarkets.Application.Commands.GrantBonus;

using MediatR;
using Microsoft.Extensions.Logging;
using Zenbet.EventsMarkets.Application.Common;
using Zenbet.EventsMarkets.Application.Interfaces;
using Zenbet.EventsMarkets.Domain.Exceptions;
using Zenbet.EventsMarkets.Domain.Repositories;
using Zenbet.EventsMarkets.Domain.ValueObjects;

public sealed class GrantBonusCommandHandler : IRequestHandler<GrantBonusCommand, GrantBonusResult>
{
    private readonly IWalletRepository _walletRepository;
    private readonly ITransactionRepository _transactionRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IOutboxWriter _outboxWriter;
    private readonly IIdempotencyService _idempotencyService;
    private readonly ILogger<GrantBonusCommandHandler> _logger;

    public GrantBonusCommandHandler(
        IWalletRepository walletRepository,
        ITransactionRepository transactionRepository,
        IUnitOfWork unitOfWork,
        IOutboxWriter outboxWriter,
        IIdempotencyService idempotencyService,
        ILogger<GrantBonusCommandHandler> logger)
    {
        _walletRepository = walletRepository;
        _transactionRepository = transactionRepository;
        _unitOfWork = unitOfWork;
        _outboxWriter = outboxWriter;
        _idempotencyService = idempotencyService;
        _logger = logger;
    }

    public async Task<GrantBonusResult> Handle(
        GrantBonusCommand request,
        CancellationToken cancellationToken)
    {
        if (request.BonusAmount <= Money.Zero)
        {
            return Failure("El monto del bono debe ser mayor a cero.");
        }

        if (request.WageringRequirement <= Money.Zero)
        {
            return Failure("El requisito de rollover (WageringRequirement) debe ser mayor a cero.");
        }

        if (request.MinOdds <= 1m)
        {
            return Failure("La cuota mínima (MinOdds) del bono debe ser mayor a 1.00.");
        }

        if (request.MaxConversion <= Money.Zero)
        {
            return Failure("El tope de conversión real (MaxConversion) debe ser mayor a cero.");
        }

        var idempotencyKey = request.IdempotencyKey.ToString();
        var payloadHash = IdempotencyPayloadHasher.Compute(new
        {
            walletId = request.WalletId.Value,
            bonusAmount = request.BonusAmount.Amount,
            wageringRequirement = request.WageringRequirement.Amount,
            minOdds = request.MinOdds,
            maxConversion = request.MaxConversion.Amount,
        });

        if (await _idempotencyService.ExistsAsync(
                idempotencyKey,
                nameof(GrantBonusCommand),
                payloadHash,
                cancellationToken))
        {
            var existingWallet = await _walletRepository.GetByIdAsync(
                request.WalletId,
                cancellationToken);

            return new GrantBonusResult(
                true,
                existingWallet?.ActiveBonus?.Id,
                null,
                existingWallet?.BonusAvailable,
                existingWallet?.Balance,
                "El bono ya fue otorgado previamente.");
        }

        await _unitOfWork.BeginTransactionAsync(cancellationToken);

        try
        {
            var idempotencyLockKey = BitConverter.ToInt64(request.IdempotencyKey.ToByteArray(), 0);
            await _unitOfWork.TryAcquireAdvisoryLockAsync(idempotencyLockKey, cancellationToken);

            var lockKey = BitConverter.ToInt64(request.WalletId.Value.ToByteArray(), 0);
            if (!await _unitOfWork.TryAcquireAdvisoryLockAsync(lockKey, cancellationToken))
            {
                throw new InvalidOperationException(
                    $"Wallet {request.WalletId} already has an operation in progress.");
            }

            if (await _idempotencyService.ExistsAsync(
                    idempotencyKey,
                    nameof(GrantBonusCommand),
                    payloadHash,
                    cancellationToken))
            {
                var existingWallet = await _walletRepository.GetByIdAsync(
                    request.WalletId,
                    cancellationToken);

                await _unitOfWork.CommitAsync(cancellationToken);

                return new GrantBonusResult(
                    true,
                    existingWallet?.ActiveBonus?.Id,
                    null,
                    existingWallet?.BonusAvailable,
                    existingWallet?.Balance,
                    "El bono ya fue otorgado previamente.");
            }

            var wallet = await _walletRepository.GetByIdForUpdateAsync(request.WalletId, cancellationToken)
                ?? throw new WalletNotFoundException(request.WalletId);

            var expectedVersion = wallet.Version;
            var transaction = wallet.GrantBonus(
                request.BonusAmount,
                request.WageringRequirement,
                request.MinOdds,
                request.MaxConversion,
                request.Description,
                $"BONUS-{request.IdempotencyKey:N}");
            transaction.Complete();

            await _walletRepository.UpdateAsync(wallet, expectedVersion, cancellationToken);
            await _transactionRepository.AddAsync(transaction, cancellationToken);

            foreach (var domainEvent in wallet.DomainEvents)
            {
                await _outboxWriter.WriteAsync(domainEvent, cancellationToken);
            }

            await _idempotencyService.AddAsync(
                idempotencyKey,
                nameof(GrantBonusCommand),
                cancellationToken,
                payloadHash);

            await _unitOfWork.CommitAsync(cancellationToken);
            wallet.ClearDomainEvents();

            _logger.LogInformation(
                "Smart Bonus granted for wallet {WalletId}: Amount={BonusAmount}, Rollover={WageringRequirement}, MinOdds={MinOdds}, MaxConversion={MaxConversion}",
                request.WalletId,
                request.BonusAmount,
                request.WageringRequirement,
                request.MinOdds,
                request.MaxConversion);

            return new GrantBonusResult(
                true,
                wallet.ActiveBonus?.Id,
                transaction.Id,
                wallet.BonusAvailable,
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
        catch (InvalidOperationException exception)
        {
            await _unitOfWork.RollbackAsync(cancellationToken);
            return Failure(exception.Message);
        }
        catch (Exception exception)
        {
            await _unitOfWork.RollbackAsync(cancellationToken);
            _logger.LogError(
                exception,
                "Error granting bonus for wallet {WalletId}",
                request.WalletId);
            throw;
        }
    }

    private static GrantBonusResult Failure(string message) =>
        new(false, null, null, null, null, message);
}

