namespace Zenbet.EventsMarkets.Application.Interfaces;

using Zenbet.EventsMarkets.Domain.ValueObjects;

public sealed record RiskLimitsOptions
{
    public Money MaxUserBetLimit { get; set; } = new(1000m);
    public Money MaxMarketExposureLimit { get; set; } = new(100000m);
}