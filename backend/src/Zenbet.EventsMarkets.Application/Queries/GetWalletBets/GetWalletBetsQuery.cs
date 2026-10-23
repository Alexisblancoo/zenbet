namespace Zenbet.EventsMarkets.Application.Queries.GetWalletBets;

using MediatR;
using Zenbet.EventsMarkets.Application.DTOs;

public sealed record GetWalletBetsQuery(Guid WalletId) : IRequest<IReadOnlyList<WalletBetDto>>;
