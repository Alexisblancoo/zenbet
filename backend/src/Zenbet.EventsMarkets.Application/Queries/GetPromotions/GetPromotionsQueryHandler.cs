namespace Zenbet.EventsMarkets.Application.Queries.GetPromotions;

using MediatR;
using Zenbet.EventsMarkets.Application.DTOs;
using Zenbet.EventsMarkets.Domain.Repositories;

public sealed class GetPromotionsQueryHandler : IRequestHandler<GetPromotionsQuery, IReadOnlyList<PromotionDto>>
{
    private readonly IPromotionRepository _promotionRepository;

    public GetPromotionsQueryHandler(IPromotionRepository promotionRepository) =>
        _promotionRepository = promotionRepository;

    public async Task<IReadOnlyList<PromotionDto>> Handle(
        GetPromotionsQuery request,
        CancellationToken cancellationToken)
    {
        var promotions = await _promotionRepository.ListAsync(request.Tier, cancellationToken);
        return promotions
            .Select(promotion => new PromotionDto(
                promotion.Id,
                promotion.Name,
                promotion.Slug,
                promotion.Tier.ToString(),
                promotion.CountryCode))
            .ToList();
    }
}
