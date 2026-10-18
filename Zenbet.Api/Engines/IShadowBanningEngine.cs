using Zenbet.Api.Models;

namespace Zenbet.Api.Engines;

public interface IShadowBanningEngine
{
    Task<ShadowBanEvaluation> EvaluateAndApplySlippageAsync(int userId, decimal odds);
}
