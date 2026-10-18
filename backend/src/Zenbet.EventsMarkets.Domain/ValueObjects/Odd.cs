namespace Zenbet.EventsMarkets.Domain.ValueObjects;

public readonly record struct Odd
{
    public decimal Value { get; init; }
    public DateTimeOffset Timestamp { get; init; }
    public string Provider { get; init; }

    public Odd(decimal value, DateTimeOffset timestamp, string provider = "internal")
    {
        if (value < 1.0m)
            throw new ArgumentException("Odd value must be >= 1.0", nameof(value));

        Value = Math.Round(value, 2, MidpointRounding.AwayFromZero);
        Timestamp = timestamp;
        Provider = provider ?? "internal";
    }

    public static implicit operator decimal(Odd odd) => odd.Value;
    public static explicit operator Odd(decimal value) => new(value, DateTimeOffset.UtcNow);

    public override string ToString() => $"{Value:F2} (@ {Timestamp:O} from {Provider})";
}