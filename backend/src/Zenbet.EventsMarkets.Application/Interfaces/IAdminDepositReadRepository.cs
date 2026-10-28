namespace Zenbet.EventsMarkets.Application.Interfaces;

using Zenbet.EventsMarkets.Application.DTOs;

public interface IAdminDepositReadRepository
{
    Task<IReadOnlyList<PendingDepositDto>> ListPendingAsync(
        CancellationToken cancellationToken = default);
}
