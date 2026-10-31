namespace Zenbet.EventsMarkets.Application.Commands.PlaceBet;

using FluentValidation;
using Zenbet.EventsMarkets.Domain.ValueObjects;

public sealed class PlaceBetCommandValidator : AbstractValidator<PlaceBetCommand>
{
    public PlaceBetCommandValidator()
    {
        RuleFor(x => x.WalletId)
            .NotEqual(WalletId.Empty)
            .WithMessage("WalletId is required");

        RuleFor(x => x.SelectionId)
            .NotEqual(SelectionId.Empty)
            .WithMessage("SelectionId is required");

        RuleFor(x => x.Amount)
            .Must(amount => amount > Money.Zero)
            .WithMessage("Bet amount must be greater than zero");

        RuleFor(x => x.Description)
            .NotEmpty()
            .MaximumLength(500)
            .WithMessage("Description is required and must not exceed 500 characters");

        RuleFor(x => x.IdempotencyKey)
            .NotEqual(Guid.Empty)
            .WithMessage("IdempotencyKey is required");

        RuleFor(x => x.PromoCode)
            .MaximumLength(40)
            .When(x => !string.IsNullOrWhiteSpace(x.PromoCode))
            .WithMessage("El código promocional no puede superar 40 caracteres");

        RuleFor(x => x.ExpectedOdds)
            .GreaterThan(1m)
            .When(x => x.ExpectedOdds.HasValue)
            .WithMessage("Expected odds must be greater than 1.0");

        RuleFor(x => x.MaxSlippagePercent)
            .InclusiveBetween(0m, 100m)
            .When(x => x.MaxSlippagePercent.HasValue)
            .WithMessage("Max slippage percent must be between 0 and 100");

        RuleFor(x => x.MinAcceptedOdds)
            .GreaterThan(1m)
            .When(x => x.MinAcceptedOdds.HasValue)
            .WithMessage("Min accepted odds must be greater than 1.0");
    }
}