namespace Zenbet.EventsMarkets.Application.Queries.GetPendingDeposits;

using MediatR;
using Zenbet.EventsMarkets.Application.DTOs;

public sealed record GetPendingDepositsQuery : IRequest<IReadOnlyList<PendingDepositDto>>;
