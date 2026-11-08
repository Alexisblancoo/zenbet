namespace Zenbet.EventsMarkets.Application.Commands.ResultProposals;

using MediatR;
using Zenbet.EventsMarkets.Application.Commands.SettleFight;
using Zenbet.EventsMarkets.Application.Commands.SettleUfcEvent;
using Zenbet.EventsMarkets.Application.Interfaces;
using Zenbet.EventsMarkets.Domain.Aggregates;
using Zenbet.EventsMarkets.Domain.ValueObjects;

/// <summary>An admin applies a VERIFIED proposal through the one existing settlement pipeline.</summary>
public sealed record ConfirmResultProposalCommand(
    Guid ProposalId,
    string AdminLabel,
    bool AcknowledgeSingleSourceMethod,
    string? Note) : IRequest<SettleUfcEventResult>;

public sealed record DismissResultProposalCommand(Guid ProposalId, string AdminLabel, string Note) : IRequest;

public sealed class ConfirmResultProposalCommandHandler : IRequestHandler<ConfirmResultProposalCommand, SettleUfcEventResult>
{
    private readonly IFightResultProposalRepository _proposals;
    private readonly ISender _sender;

    public ConfirmResultProposalCommandHandler(IFightResultProposalRepository proposals, ISender sender)
    {
        _proposals = proposals;
        _sender = sender;
    }

    public async Task<SettleUfcEventResult> Handle(ConfirmResultProposalCommand request, CancellationToken cancellationToken)
    {
        var proposal = await _proposals.GetAsync(request.ProposalId, cancellationToken)
            ?? throw new KeyNotFoundException("Propuesta no encontrada.");

        if (proposal.Status != ProposalStatus.Verified)
            throw new InvalidOperationException(
                $"Solo se puede aplicar una propuesta verificada (estado actual: {proposal.Status}). {proposal.Detail}");
        if (!proposal.MethodCorroborated && !request.AcknowledgeSingleSourceMethod)
            throw new InvalidOperationException(
                "El método y el round vienen de una sola fuente. Confírmalos contra un resultado oficial (UFC.com/ESPN) y reintenta con acknowledgeSingleSourceMethod=true.");
        if (proposal.WinnerCorner is null || proposal.Method is null || proposal.Round is null)
            throw new InvalidOperationException("La propuesta está incompleta.");

        // Deterministic key: re-confirming the same proposal can never pay twice; a half-failed attempt is safe to retry.
        var key = new Guid(System.Security.Cryptography.SHA256.HashData(
            System.Text.Encoding.UTF8.GetBytes($"result-proposal:{proposal.Id}")).AsSpan(0, 16));

        var result = await _sender.Send(new SettleFightCommand(
            EventId.From(proposal.EventId), proposal.WinnerCorner.Value, proposal.Method.Value, proposal.Round.Value,
            request.AdminLabel, key), cancellationToken);

        // The settlement pipeline commits through the unit of work, which clears the EF change tracker: the entity
        // loaded above is detached by now. Reload it so the "applied" mark is really persisted (otherwise the proposal
        // would stay Verified and look re-applicable; the deterministic key would still prevent a double payout).
        var current = await _proposals.GetAsync(request.ProposalId, cancellationToken)
            ?? throw new InvalidOperationException("La propuesta desapareció durante la liquidación.");
        current.MarkApplied(request.AdminLabel, request.Note, DateTimeOffset.UtcNow);
        await _proposals.SaveChangesAsync(cancellationToken);
        return result;
    }
}

public sealed class DismissResultProposalCommandHandler : IRequestHandler<DismissResultProposalCommand>
{
    private readonly IFightResultProposalRepository _proposals;

    public DismissResultProposalCommandHandler(IFightResultProposalRepository proposals) => _proposals = proposals;

    public async Task Handle(DismissResultProposalCommand request, CancellationToken cancellationToken)
    {
        var proposal = await _proposals.GetAsync(request.ProposalId, cancellationToken)
            ?? throw new KeyNotFoundException("Propuesta no encontrada.");
        proposal.Dismiss(request.AdminLabel, request.Note, DateTimeOffset.UtcNow);
        await _proposals.SaveChangesAsync(cancellationToken);
    }
}
