namespace Zenbet.EventsMarkets.Domain.ValueObjects;

public readonly record struct Money : IComparable<Money>
{
    public decimal Amount { get; init; }

    public Money(decimal amount)
    {
        if (amount < 0)
            throw new ArgumentException("Money amount cannot be negative", nameof(amount));

        Amount = Math.Round(amount, 2, MidpointRounding.AwayFromZero);
    }

    public static Money Zero => new(0m);

    public static implicit operator decimal(Money money) => money.Amount;

    public static explicit operator Money(decimal amount) => new(amount);

    public static Money operator +(Money left, Money right) => new(left.Amount + right.Amount);

    public static Money operator -(Money left, Money right)
    {
        var result = left.Amount - right.Amount;
        if (result < 0)
            throw new InvalidOperationException("Money subtraction would result in negative amount");
        return new(result);
    }

    public static bool operator >(Money left, Money right) => left.Amount > right.Amount;

    public static bool operator <(Money left, Money right) => left.Amount < right.Amount;

    public static bool operator >=(Money left, Money right) => left.Amount >= right.Amount;

    public static bool operator <=(Money left, Money right) => left.Amount <= right.Amount;

    public int CompareTo(Money other) => Amount.CompareTo(other.Amount);

    public override string ToString() => $"{Amount:F2}";
}