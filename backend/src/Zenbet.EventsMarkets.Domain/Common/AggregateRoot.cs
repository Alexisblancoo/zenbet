namespace Zenbet.EventsMarkets.Domain.Common;

using Zenbet.EventsMarkets.Domain.Events;

public abstract class AggregateRoot<TId> : Entity<TId>
    where TId : struct
{
    private readonly List<DomainEvent> _domainEvents = new();

    protected AggregateRoot(TId id) : base(id) { }

    protected AggregateRoot() : base() { } // EF Core

    public IReadOnlyCollection<DomainEvent> DomainEvents => _domainEvents.AsReadOnly();

    protected void AddDomainEvent(DomainEvent domainEvent)
    {
        _domainEvents.Add(domainEvent);
    }

    public void ClearDomainEvents()
    {
        _domainEvents.Clear();
    }
}

public abstract class Entity<TId>
    where TId : struct
{
    public TId Id { get; protected init; }

    protected Entity(TId id)
    {
        Id = id;
    }

    protected Entity() { } // EF Core

    public override bool Equals(object? obj)
    {
        if (obj is not Entity<TId> other) return false;
        if (ReferenceEquals(this, other)) return true;
        if (Id.Equals(default(TId)) || other.Id.Equals(default(TId))) return false;
        return Id.Equals(other.Id);
    }

    public override int GetHashCode() => Id.GetHashCode();

    public static bool operator ==(Entity<TId>? a, Entity<TId>? b)
    {
        if (a is null && b is null) return true;
        if (a is null || b is null) return false;
        return a.Equals(b);
    }

    public static bool operator !=(Entity<TId>? a, Entity<TId>? b) => !(a == b);
}