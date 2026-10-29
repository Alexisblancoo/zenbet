namespace Zenbet.EventsMarkets.Application.Commands.SettleFight;

using MediatR;
using Zenbet.EventsMarkets.Application.Commands.SettleUfcEvent;

/// <summary>
/// Public settlement command. The existing UFC result pipeline owns the event
/// lock, market transactions, audit and outbox work; keeping one settlement
/// implementation avoids divergent payout semantics.
/// </summary>
public sealed class SettleFightCommandHandler : IRequestHandler<SettleFightCommand, SettleUfcEventResult>
{
    private readonly IMediator _mediator;

    public SettleFightCommandHandler(IMediator mediator) => _mediator = mediator;

    public Task<SettleUfcEventResult> Handle(SettleFightCommand request, CancellationToken cancellationToken) =>
        _mediator.Send(new SettleUfcEventCommand(
            request.EventId,
            request.WinnerCorner,
            request.Method,
            request.Round,
            request.SettledBy,
            request.IdempotencyKey ?? DeterministicIdempotencyKey(request)), cancellationToken);

    private static Guid DeterministicIdempotencyKey(SettleFightCommand command)
    {
        var value = $"fight-settlement:{command.EventId.Value}:{command.WinnerCorner}:{command.Method}:{command.Round}";
        return new Guid(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(value)).AsSpan(0, 16));
    }
}
