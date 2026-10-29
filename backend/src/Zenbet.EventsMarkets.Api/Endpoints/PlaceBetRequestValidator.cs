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
    }
}
