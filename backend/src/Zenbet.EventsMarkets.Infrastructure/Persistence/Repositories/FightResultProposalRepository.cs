namespace Zenbet.EventsMarkets.Infrastructure.Persistence.Repositories;

using Microsoft.EntityFrameworkCore;
using Zenbet.EventsMarkets.Application.Interfaces;
using Zenbet.EventsMarkets.Domain.Aggregates;

public sealed class FightResultProposalRepository : IFightResultProposalRepository
{
    private readonly EventsMarketsDbContext _db;

    public FightResultProposalRepository(EventsMarketsDbContext db) => _db = db;

    public Task<FightResultProposal?> GetAsync(Guid id, CancellationToken cancellationToken = default) =>
        _db.FightResultProposals.FirstOrDefaultAsync(p => p.Id == id, cancellationToken);

    public async Task<IReadOnlyList<ResultProposalView>> ListAsync(ProposalStatus? status, int take, CancellationToken cancellationToken = default)
    {
        var query = _db.FightResultProposals.AsNoTracking().AsQueryable();
        if (status is not null) query = query.Where(p => p.Status == status);
        var rows = await query.OrderByDescending(p => p.UpdatedAt).Take(Math.Clamp(take, 1, 200)).ToListAsync(cancellationToken);
        var ids = rows.Select(r => r.EventId).ToList();
        var idValues = ids.Select(Zenbet.EventsMarkets.Domain.ValueObjects.EventId.From).ToList();
        var events = await _db.Events.AsNoTracking().Where(e => idValues.Contains(e.Id)).ToListAsync(cancellationToken);
        var names = events.ToDictionary(e => e.Id.Value, e => e.Name);
        return rows.Select(p => new ResultProposalView(p.Id, p.EventId, names.GetValueOrDefault(p.EventId, "(evento eliminado)"),
            p.Status.ToString(), p.WinnerCorner?.ToString(), p.Method?.ToString(), p.Round, p.MethodCorroborated,
            p.Detail, p.SourcesSummary, p.UpdatedAt, p.ReviewedBy, p.ReviewNote)).ToList();
    }

    public async Task<IReadOnlyDictionary<Guid, FightResultProposal>> GetByEventIdsAsync(IReadOnlyCollection<Guid> eventIds, CancellationToken cancellationToken = default) =>
        await _db.FightResultProposals.Where(p => eventIds.Contains(p.EventId)).ToDictionaryAsync(p => p.EventId, cancellationToken);

    public void Add(FightResultProposal proposal) => _db.FightResultProposals.Add(proposal);

    public Task SaveChangesAsync(CancellationToken cancellationToken = default) => _db.SaveChangesAsync(cancellationToken);
}
