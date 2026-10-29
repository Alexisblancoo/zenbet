namespace Zenbet.EventsMarkets.Application.Commands.SettleFight;

using FluentValidation;
using Zenbet.EventsMarkets.Domain.ValueObjects;

public sealed class SettleFightCommandValidator : AbstractValidator<SettleFightCommand>
{
    public SettleFightCommandValidator()
    {
        RuleFor(command => command.EventId).NotEqual(EventId.Empty);
        RuleFor(command => command.WinnerCorner).IsInEnum();
        RuleFor(command => command.Method).IsInEnum();
        RuleFor(command => command.Round).InclusiveBetween(1, 5);
        RuleFor(command => command.SettledBy).NotEmpty().MaximumLength(120);
        RuleFor(command => command.IdempotencyKey)
            .Must(key => key is null || key != Guid.Empty)
            .WithMessage("IdempotencyKey cannot be empty when provided.");
    }
}
