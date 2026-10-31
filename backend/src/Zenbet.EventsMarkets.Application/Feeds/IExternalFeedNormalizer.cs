namespace Zenbet.EventsMarkets.Application.Feeds;

using Zenbet.EventsMarkets.Application.Commands.SettleMarket;
using Zenbet.EventsMarkets.Application.Commands.UpdateOdds;

/// <summary>
/// Contrato del servicio de normalización de feeds deportivos externos.
/// Traduce cargas útiles heterogéneas (minificadas o B2B estándar) hacia comandos CQRS de ZenBet.
/// </summary>
public interface IExternalFeedNormalizer
{
    FeedNormalizationResult<UpdateOddsCommand> NormalizeMinifiedOdds(MinifiedFeedBatch batch);
    FeedNormalizationResult<UpdateOddsCommand> NormalizeIndustryOdds(IReadOnlyList<IndustryFeedUpdate> updates, Guid? batchId = null);
    FeedNormalizationResult<SettleMarketCommand> NormalizeSettlement(IndustryFeedUpdate update, Guid? idempotencyKey = null);
}

