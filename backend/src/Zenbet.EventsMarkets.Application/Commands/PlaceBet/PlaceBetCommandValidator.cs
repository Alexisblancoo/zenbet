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
    }
}