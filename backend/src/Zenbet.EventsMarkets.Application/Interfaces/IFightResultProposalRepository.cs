namespace Zenbet.EventsMarkets.Application.Interfaces;

using Zenbet.EventsMarkets.Domain.Aggregates;

public sealed record ResultProposalView(
    Guid Id,
    Guid EventId,
    string EventName,
    string Status,
    string? WinnerCorner,
    string? Method,
    int? Round,
    bool MethodCorroborated,
    string Detail,
    string SourcesSummary,
    DateTimeOffset UpdatedAt,
    string? ReviewedBy,
    string? ReviewNote);

public interface IFightResultProposalRepository
{
    Task<FightResultProposal?> GetAsync(Guid id, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ResultProposalView>> ListAsync(ProposalStatus? status, int take, CancellationToken cancellationToken = default);
    Task<IReadOnlyDictionary<Guid, FightResultProposal>> GetByEventIdsAsync(IReadOnlyCollection<Guid> eventIds, CancellationToken cancellationToken = default);
    void Add(FightResultProposal proposal);
    Task SaveChangesAsync(CancellationToken cancellationToken = default);
}
