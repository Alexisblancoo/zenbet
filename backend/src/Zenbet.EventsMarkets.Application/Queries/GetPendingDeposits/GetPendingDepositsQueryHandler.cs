namespace Zenbet.EventsMarkets.Application.Queries.GetPendingDeposits;

using MediatR;
using Zenbet.EventsMarkets.Application.DTOs;
using Zenbet.EventsMarkets.Application.Interfaces;

public sealed class GetPendingDepositsQueryHandler
    : IRequestHandler<GetPendingDepositsQuery, IReadOnlyList<PendingDepositDto>>
{
    private readonly IAdminDepositReadRepository _depositReadRepository;

    public GetPendingDepositsQueryHandler(IAdminDepositReadRepository depositReadRepository)
    {
        _depositReadRepository = depositReadRepository;
    }

    public Task<IReadOnlyList<PendingDepositDto>> Handle(
        GetPendingDepositsQuery request,
        CancellationToken cancellationToken) =>
        _depositReadRepository.ListPendingAsync(cancellationToken);
}
