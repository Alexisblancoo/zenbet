namespace Zenbet.EventsMarkets.Domain.Aggregates;

using System.Diagnostics.CodeAnalysis;
using Zenbet.EventsMarkets.Domain.Events;
using Zenbet.EventsMarkets.Domain.Enums;
using Zenbet.EventsMarkets.Domain.Exceptions;
using Zenbet.EventsMarkets.Domain.ValueObjects;
using Zenbet.EventsMarkets.Domain.Common;

public sealed class Wallet : AggregateRoot<WalletId>
{
    private readonly List<Transaction> _transactions = new();

    private Wallet() { } // EF Core

    [SetsRequiredMembers]
    public Wallet(WalletId id, UserId userId)
        : base(id)
    {
        UserId = userId;
        Balance = Money.Zero;
        Version = 0;
    }

    public required UserId UserId { get; init; }
    public Money Balance { get; private set; }
    public uint Version { get; private set; }
    public IReadOnlyCollection<Transaction> Transactions => _transactions.AsReadOnly();

    public Transaction Deposit(Money amount, string? description = null, string? referenceId = null)
    {
        if (amount <= Money.Zero)
            throw new InvalidTransactionAmountException("Deposit amount must be positive");

        var transaction = new Transaction(
            TransactionId.New(),
            Id,
            TransactionType.Deposit,
            amount,
            Balance + amount,
            description,
            referenceId);

        _transactions.Add(transaction);
        Balance += amount;
        Version++;

        AddDomainEvent(new WalletDepositedDomainEvent(Id, UserId, amount, Balance, transaction.Id, DateTimeOffset.UtcNow));
        return transaction;
    }

    public Transaction Withdraw(Money amount, string? description = null, string? referenceId = null)
    {
        if (amount <= Money.Zero)
            throw new InvalidTransactionAmountException("Withdrawal amount must be positive");

        if (Balance < amount)
            throw new InsufficientFundsException(Id, amount, Balance);

        var transaction = new Transaction(
            TransactionId.New(),
            Id,
            TransactionType.Withdrawal,
            amount,
            Balance - amount,
            description,
            referenceId);

        _transactions.Add(transaction);
        Balance -= amount;
        Version++;

        AddDomainEvent(new WalletWithdrawnDomainEvent(Id, UserId, amount, Balance, transaction.Id, DateTimeOffset.UtcNow));
        return transaction;
    }

    public Transaction PlaceBet(
        Money amount,
        SelectionId selectionId,
        string? description = null,
        string? referenceId = null,
        decimal? acceptedOdds = null,
        string? promoCode = null)
    {
        if (amount <= Money.Zero)
            throw new InvalidTransactionAmountException("Bet amount must be positive");

        if (acceptedOdds is <= 1m)
            throw new InvalidTransactionAmountException("Accepted odds must be greater than 1");

        if (Balance < amount)
            throw new InsufficientFundsException(Id, amount, Balance);

        var transaction = new Transaction(
            TransactionId.New(),
            Id,
            TransactionType.BetPlacement,
            amount,
            Balance - amount,
            description,
            referenceId,
            selectionId,
            acceptedOdds,
            promoCode,
            BetStatus.Pending);

        _transactions.Add(transaction);
        Balance -= amount;
        Version++;

        AddDomainEvent(new BetPlacedDomainEvent(Id, UserId, amount, Balance, transaction.Id, DateTimeOffset.UtcNow));
        return transaction;
    }

    public Transaction SettleBet(Money amount, SettlementResult result, string? description = null, string? referenceId = null)
    {
        if (amount <= Money.Zero)
            throw new InvalidTransactionAmountException("Settlement amount must be positive");

        // En una apuesta ganadora el importe es el retorno bruto; en un void o
        // push se devuelve el stake. Una apuesta perdida no mueve saldo y el
        // worker no crea movimiento de liquidación.
        var netAmount = result is SettlementResult.Won or SettlementResult.Void or SettlementResult.Push
            ? amount
            : Money.Zero;

        var transaction = new Transaction(
            TransactionId.New(),
            Id,
            TransactionType.BetSettlement,
            netAmount,
            Balance + netAmount,
            description,
            referenceId);

        _transactions.Add(transaction);
        Balance += netAmount;
        Version++;

        AddDomainEvent(new BetSettledDomainEvent(Id, UserId, netAmount, Balance, transaction.Id, DateTimeOffset.UtcNow));
        return transaction;
    }

    public Transaction CancelBet(Money amount, string? description = null, string? referenceId = null)
    {
        if (amount <= Money.Zero)
            throw new InvalidTransactionAmountException("Cancellation amount must be positive");

        var transaction = new Transaction(
            TransactionId.New(),
            Id,
            TransactionType.BetCancellation,
            amount,
            Balance + amount,
            description,
            referenceId);

        _transactions.Add(transaction);
        Balance += amount;
        Version++;

        AddDomainEvent(new BetCancelledDomainEvent(Id, UserId, amount, Balance, transaction.Id, DateTimeOffset.UtcNow));
        return transaction;
    }

    public Transaction AddBonus(Money amount, string? description = null, string? referenceId = null)
    {
        if (amount <= Money.Zero)
            throw new InvalidTransactionAmountException("Bonus amount must be positive");

        var transaction = new Transaction(
            TransactionId.New(),
            Id,
            TransactionType.Bonus,
            amount,
            Balance + amount,
            description,
            referenceId);

        _transactions.Add(transaction);
        Balance += amount;
        Version++;

        AddDomainEvent(new BonusAddedDomainEvent(Id, UserId, amount, Balance, transaction.Id, DateTimeOffset.UtcNow));
        return transaction;
    }

    public Transaction Adjust(Money amount, string? description = null, string? referenceId = null)
    {
        var newBalance = Balance + amount;
        if (newBalance < Money.Zero)
            throw new InsufficientFundsException(Id, Money.Zero - newBalance, Balance);

        var transaction = new Transaction(
            TransactionId.New(),
            Id,
            TransactionType.Adjustment,
            amount,
            newBalance,
            description,
            referenceId);

        _transactions.Add(transaction);
        Balance = newBalance;
        Version++;

        AddDomainEvent(new WalletAdjustedDomainEvent(Id, UserId, amount, Balance, transaction.Id, DateTimeOffset.UtcNow));
        return transaction;
    }
}

public sealed class Transaction : Entity<TransactionId>
{
    private Transaction() { } // EF Core

    [SetsRequiredMembers]
    public Transaction(
        TransactionId id,
        WalletId walletId,
        TransactionType type,
        Money amount,
        Money balanceAfter,
        string? description = null,
        string? referenceId = null,
        SelectionId? selectionId = null,
        decimal? acceptedOdds = null,
        string? promoCode = null,
        BetStatus? betStatus = null)
        : base(id)
    {
        WalletId = walletId;
        Type = type;
        Amount = amount;
        BalanceAfter = balanceAfter;
        Description = description;
        ReferenceId = referenceId;
        SelectionId = selectionId;
        AcceptedOdds = acceptedOdds;
        PromoCode = string.IsNullOrWhiteSpace(promoCode) ? null : promoCode.Trim().ToUpperInvariant();
        BetStatus = betStatus;
        Status = TransactionStatus.Pending;
        CreatedAt = DateTimeOffset.UtcNow;
    }

    public required WalletId WalletId { get; init; }
    public required TransactionType Type { get; init; }
    public required Money Amount { get; init; }
    public required Money BalanceAfter { get; init; }
    public string? Description { get; init; }
    public string? ReferenceId { get; init; }
    public SelectionId? SelectionId { get; init; }

    /// <summary>Cuota aceptada al confirmar la apuesta; base del pago real.</summary>
    public decimal? AcceptedOdds { get; init; }

    /// <summary>Código promocional aplicado al boleto, si existe.</summary>
    public string? PromoCode { get; init; }

    /// <summary>Estado deportivo de la apuesta (solo para cargos de apuesta).</summary>
    public BetStatus? BetStatus { get; private set; }

    public TransactionStatus Status { get; private set; }
    public required DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset? CompletedAt { get; private set; }
    public string? FailureReason { get; private set; }

    /// <summary>
    /// Marca la apuesta como ganadora, perdedora o anulada. El movimiento de
    /// cargo queda completado en el mismo acto para que la billetera y el
    /// historial deportivo compartan la misma línea temporal.
    /// </summary>
    public void SettleBet(BetStatus outcome)
    {
        if (Type != TransactionType.BetPlacement)
            throw new InvalidOperationException("Solo un cargo de apuesta puede liquidarse.");

        if (outcome == Zenbet.EventsMarkets.Domain.Enums.BetStatus.Pending)
            throw new ArgumentOutOfRangeException(nameof(outcome), "El resultado de la apuesta no puede ser Pending.");

        if (BetStatus.HasValue && BetStatus.Value != Zenbet.EventsMarkets.Domain.Enums.BetStatus.Pending)
            throw new InvalidOperationException($"La apuesta ya fue liquidada como {BetStatus}.");

        BetStatus = outcome;

        if (Status == TransactionStatus.Pending)
            Complete();
    }

    public void Complete()
    {
        if (Status != TransactionStatus.Pending)
            throw new InvalidOperationException($"Cannot complete transaction in status {Status}");

        Status = TransactionStatus.Completed;
        CompletedAt = DateTimeOffset.UtcNow;
    }

    public void Fail(string reason)
    {
        if (Status != TransactionStatus.Pending)
            throw new InvalidOperationException($"Cannot fail transaction in status {Status}");

        Status = TransactionStatus.Failed;
        FailureReason = reason ?? "Unknown failure";
    }

    public void Cancel()
    {
        if (Status != TransactionStatus.Pending)
            throw new InvalidOperationException($"Cannot cancel transaction in status {Status}");

        Status = TransactionStatus.Cancelled;
    }
}