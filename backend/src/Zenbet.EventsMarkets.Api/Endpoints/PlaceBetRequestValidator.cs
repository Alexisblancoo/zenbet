namespace Zenbet.EventsMarkets.Api.Endpoints;

using FluentValidation;

public sealed class PlaceBetRequestValidator : AbstractValidator<PlaceBetRequest>
{
    public PlaceBetRequestValidator()
    {
        RuleFor(request => request.WalletId).NotEmpty();
        RuleFor(request => request.SelectionId).NotEmpty();
        RuleFor(request => request.Amount).GreaterThan(0m);
        RuleFor(request => request.Description).NotEmpty().MaximumLength(500);
        RuleFor(request => request.PromoCode).MaximumLength(40).When(request => request.PromoCode is not null);
        RuleFor(request => request.ExpectedOdds).GreaterThan(1m).When(request => request.ExpectedOdds.HasValue);
        RuleFor(request => request.MaxSlippagePercent).InclusiveBetween(0m, 100m).When(request => request.MaxSlippagePercent.HasValue);
        RuleFor(request => request.MinAcceptedOdds).GreaterThan(1m).When(request => request.MinAcceptedOdds.HasValue);
    }
}
