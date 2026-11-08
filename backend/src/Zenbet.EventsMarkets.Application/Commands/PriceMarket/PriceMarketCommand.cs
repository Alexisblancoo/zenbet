namespace Zenbet.EventsMarkets.Application.Commands.PriceMarket;

using MediatR;
using Zenbet.EventsMarkets.Domain.Pricing;
using Zenbet.EventsMarkets.Domain.ValueObjects;

/// <summary>
/// Cotiza un mercado completo desde el backoffice: el trader da probabilidades justas y un margen; el servidor
/// calcula las cuotas, valida que el margen real sea positivo y las aplica de forma atómica.
/// </summary>
public sealed record PriceMarketCommand(
    MarketId MarketId,
    decimal MarginPercent,
    IReadOnlyList<SelectionProbability> Selections,
    string PricedBy,
    string? Note,
    Guid IdempotencyKey) : IRequest<PriceMarketResult>;

public sealed record PriceMarketResult(
    MarketId MarketId,
    decimal OverroundPercent,
    IReadOnlyList<PricedSelection> Selections,
    bool IdempotentReplay);
