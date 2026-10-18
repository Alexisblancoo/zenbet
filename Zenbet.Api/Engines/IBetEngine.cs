using Zenbet.Api.Models;

namespace Zenbet.Api.Engines;

public interface IBetEngine
{
    Task<BetExecutionResult> ProcessBetTransactionAsync(int userId, string eventId, decimal amount, decimal odds);
}
