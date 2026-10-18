namespace Zenbet.EventsMarkets.Application.Commands.UpdateOdds;

using MediatR;
using Zenbet.EventsMarkets.Domain.ValueObjects;

public sealed record OddsUpdateItem(
    SelectionId SelectionId,
    decimal Value,
    DateTimeOffset Timestamp,
    string Provider);

public sealed record UpdateOddsCommand(
    IReadOnlyList<OddsUpdateItem> Updates,
    Guid IdempotencyKey) : IRequest<UpdateOddsResult>;

public sealed record UpdateOddsResult(
    int ProcessedCount,
    int FailedCount,
    IReadOnlyList<OddsUpdateFailure> Failures);

public sealed record OddsUpdateFailure(
    SelectionId SelectionId,
    string Error);