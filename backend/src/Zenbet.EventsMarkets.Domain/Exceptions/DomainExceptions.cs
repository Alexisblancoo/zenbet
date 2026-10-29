namespace Zenbet.EventsMarkets.Domain.Exceptions;

using Zenbet.EventsMarkets.Domain.ValueObjects;

public sealed class IdempotencyConflictException : DomainException
{
    public IdempotencyConflictException()
        : base("Idempotency-Key ya fue utilizada con un payload diferente o no verificable.")
    {
    }
}

public sealed class EventNotFoundException : DomainException
{
    public EventId EventId { get; }
    public EventNotFoundException(EventId eventId)
        : base($"Event with ID {eventId} was not found.")
    {
        EventId = eventId;
    }
}

public sealed class MarketNotFoundException : DomainException
{
    public MarketId MarketId { get; }
    public MarketNotFoundException(MarketId marketId)
        : base($"Market with ID {marketId} was not found.")
    {
        MarketId = marketId;
    }
}

public sealed class SelectionNotFoundException : DomainException
{
    public SelectionId SelectionId { get; }
    public SelectionNotFoundException(SelectionId selectionId)
        : base($"Selection with ID {selectionId} was not found.")
    {
        SelectionId = selectionId;
    }
}

public sealed class MarketAlreadySettledException : DomainException
{
    public MarketId MarketId { get; }
    public MarketAlreadySettledException(MarketId marketId)
        : base($"Market {marketId} has already been settled.")
    {
        MarketId = marketId;
    }
}

public sealed class InvalidOddsTransitionException : DomainException
{
    public InvalidOddsTransitionException(string message) : base(message) { }
}

public sealed class DivisionMismatchException : DomainException
{
    public DivisionMismatchException(string message) : base(message) { }
}

public sealed class WalletNotFoundException : DomainException
{
    public WalletId WalletId { get; }
    public WalletNotFoundException(WalletId walletId)
        : base($"Wallet with ID {walletId} was not found.")
    {
        WalletId = walletId;
    }
}

public sealed class InsufficientFundsException : DomainException
{
    public WalletId WalletId { get; }
    public Money RequestedAmount { get; }
    public Money AvailableBalance { get; }

    public InsufficientFundsException(WalletId walletId, Money requestedAmount, Money availableBalance)
        : base($"Wallet {walletId} has insufficient funds. Requested: {requestedAmount}, Available: {availableBalance}")
    {
        WalletId = walletId;
        RequestedAmount = requestedAmount;
        AvailableBalance = availableBalance;
    }
}

public sealed class InvalidTransactionAmountException : DomainException
{
    public InvalidTransactionAmountException(string message) : base(message) { }
}

public sealed class TransactionNotFoundException : DomainException
{
    public TransactionId TransactionId { get; }
    public TransactionNotFoundException(TransactionId transactionId)
        : base($"Transaction with ID {transactionId} was not found.")
    {
        TransactionId = transactionId;
    }
}

public abstract class RiskLimitExceededException : DomainException
{
    protected RiskLimitExceededException(string message) : base(message) { }
}

public sealed class MaxUserBetLimitExceededException : RiskLimitExceededException
{
    public WalletId WalletId { get; }
    public Money RequestedAmount { get; }
    public Money MaxAllowedAmount { get; }

    public MaxUserBetLimitExceededException(WalletId walletId, Money requestedAmount, Money maxAllowedAmount)
        : base($"User {walletId} bet limit exceeded. Requested: {requestedAmount}, Max allowed: {maxAllowedAmount}")
    {
        WalletId = walletId;
        RequestedAmount = requestedAmount;
        MaxAllowedAmount = maxAllowedAmount;
    }
}

public sealed class MaxMarketExposureExceededException : RiskLimitExceededException
{
    public MarketId MarketId { get; }
    public Money CurrentExposure { get; }
    public Money NewExposure { get; }
    public Money MaxExposure { get; }

    public MaxMarketExposureExceededException(MarketId marketId, Money currentExposure, Money newExposure, Money maxExposure)
        : base($"Market {marketId} exposure limit exceeded. Current: {currentExposure}, New bet would add: {newExposure}, Max allowed: {maxExposure}")
    {
        MarketId = marketId;
        CurrentExposure = currentExposure;
        NewExposure = newExposure;
        MaxExposure = maxExposure;
    }
}

public abstract class DomainException : Exception
{
    protected DomainException(string message) : base(message) { }
}
