namespace Zenbet.EventsMarkets.Domain.ValueObjects;

using System.Text.Json.Serialization;

public readonly record struct EventId(Guid Value) : IComparable<EventId>, IEquatable<EventId>
{
    public static EventId New() => new(Guid.NewGuid());
    public static EventId From(Guid guid) => new(guid);
    public static EventId Empty => new(Guid.Empty);

    public int CompareTo(EventId other) => Value.CompareTo(other.Value);
    public bool Equals(EventId other) => Value.Equals(other.Value);
    public override int GetHashCode() => Value.GetHashCode();
    public override string ToString() => Value.ToString();

    public static implicit operator Guid(EventId id) => id.Value;
    public static explicit operator EventId(Guid guid) => new(guid);
}

public readonly record struct MarketId(Guid Value) : IComparable<MarketId>, IEquatable<MarketId>
{
    public static MarketId New() => new(Guid.NewGuid());
    public static MarketId From(Guid guid) => new(guid);
    public static MarketId Empty => new(Guid.Empty);

    public int CompareTo(MarketId other) => Value.CompareTo(other.Value);
    public bool Equals(MarketId other) => Value.Equals(other.Value);
    public override int GetHashCode() => Value.GetHashCode();
    public override string ToString() => Value.ToString();

    public static implicit operator Guid(MarketId id) => id.Value;
    public static explicit operator MarketId(Guid guid) => new(guid);
}

public readonly record struct SelectionId(Guid Value) : IComparable<SelectionId>, IEquatable<SelectionId>
{
    public static SelectionId New() => new(Guid.NewGuid());
    public static SelectionId From(Guid guid) => new(guid);
    public static SelectionId Empty => new(Guid.Empty);

    public int CompareTo(SelectionId other) => Value.CompareTo(other.Value);
    public bool Equals(SelectionId other) => Value.Equals(other.Value);
    public override int GetHashCode() => Value.GetHashCode();
    public override string ToString() => Value.ToString();

    public static implicit operator Guid(SelectionId id) => id.Value;
    public static explicit operator SelectionId(Guid guid) => new(guid);
}

public readonly record struct WalletId(Guid Value) : IComparable<WalletId>, IEquatable<WalletId>
{
    public static WalletId New() => new(Guid.NewGuid());
    public static WalletId From(Guid guid) => new(guid);
    public static WalletId Empty => new(Guid.Empty);

    public int CompareTo(WalletId other) => Value.CompareTo(other.Value);
    public bool Equals(WalletId other) => Value.Equals(other.Value);
    public override int GetHashCode() => Value.GetHashCode();
    public override string ToString() => Value.ToString();

    public static implicit operator Guid(WalletId id) => id.Value;
    public static explicit operator WalletId(Guid guid) => new(guid);
}

public readonly record struct UserId(Guid Value) : IComparable<UserId>, IEquatable<UserId>
{
    public static UserId New() => new(Guid.NewGuid());
    public static UserId From(Guid guid) => new(guid);
    public static UserId Empty => new(Guid.Empty);

    public int CompareTo(UserId other) => Value.CompareTo(other.Value);
    public bool Equals(UserId other) => Value.Equals(other.Value);
    public override int GetHashCode() => Value.GetHashCode();
    public override string ToString() => Value.ToString();

    public static implicit operator Guid(UserId id) => id.Value;
    public static explicit operator UserId(Guid guid) => new(guid);
}

public readonly record struct TransactionId(Guid Value) : IComparable<TransactionId>, IEquatable<TransactionId>
{
    public static TransactionId New() => new(Guid.NewGuid());
    public static TransactionId From(Guid guid) => new(guid);
    public static TransactionId Empty => new(Guid.Empty);

    public int CompareTo(TransactionId other) => Value.CompareTo(other.Value);
    public bool Equals(TransactionId other) => Value.Equals(other.Value);
    public override int GetHashCode() => Value.GetHashCode();
    public override string ToString() => Value.ToString();

    public static implicit operator Guid(TransactionId id) => id.Value;
    public static explicit operator TransactionId(Guid guid) => new(guid);
}

public readonly record struct BetId(Guid Value) : IComparable<BetId>, IEquatable<BetId>
{
    public static BetId New() => new(Guid.NewGuid());
    public static BetId From(Guid guid) => new(guid);
    public static BetId Empty => new(Guid.Empty);

    public int CompareTo(BetId other) => Value.CompareTo(other.Value);
    public bool Equals(BetId other) => Value.Equals(other.Value);
    public override int GetHashCode() => Value.GetHashCode();
    public override string ToString() => Value.ToString();

    public static implicit operator Guid(BetId id) => id.Value;
    public static explicit operator BetId(Guid guid) => new(guid);
}