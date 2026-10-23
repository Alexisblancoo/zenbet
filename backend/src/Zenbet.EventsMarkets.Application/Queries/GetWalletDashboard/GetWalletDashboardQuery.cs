namespace Zenbet.EventsMarkets.Application.Queries.GetWalletDashboard;

using MediatR;
using Zenbet.EventsMarkets.Application.DTOs;

public sealed record GetWalletDashboardQuery(Guid WalletId) : IRequest<WalletDashboardDto?>;
