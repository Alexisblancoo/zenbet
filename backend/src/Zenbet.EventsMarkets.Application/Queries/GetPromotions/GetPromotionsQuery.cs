namespace Zenbet.EventsMarkets.Application.Queries.GetPromotions;

using MediatR;
using Zenbet.EventsMarkets.Application.DTOs;
using Zenbet.EventsMarkets.Domain.Enums;

public sealed record GetPromotionsQuery(PromotionTier? Tier = null) : IRequest<IReadOnlyList<PromotionDto>>;
