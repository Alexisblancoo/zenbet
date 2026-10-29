namespace Zenbet.EventsMarkets.Application.Interfaces;

using FluentValidation;

public sealed class MmaEventSnapshotValidator : AbstractValidator<MmaEventSnapshot>
{
    public MmaEventSnapshotValidator()
    {
        RuleFor(item => item.ExternalId).NotEmpty().MaximumLength(200);
        RuleFor(item => item.PromotionSlug).NotEmpty().MaximumLength(120);
        RuleFor(item => item.Name).NotEmpty().MaximumLength(160);
        RuleFor(item => item.Slug).NotEmpty().MaximumLength(160);
        RuleFor(item => item.StartTime).NotEmpty();
        RuleFor(item => item.Fights).NotNull();
        RuleForEach(item => item.Fights).SetValidator(new MmaFightSnapshotValidator());
    }
}

internal sealed class MmaFightSnapshotValidator : AbstractValidator<MmaFightSnapshot>
{
    public MmaFightSnapshotValidator()
    {
        RuleFor(item => item.ExternalId).NotEmpty().MaximumLength(200);
        RuleFor(item => item.Name).NotEmpty().MaximumLength(200);
        RuleFor(item => item.StartTime).NotEmpty();
        RuleFor(item => item.Competition).NotEmpty().MaximumLength(200);
        RuleFor(item => item.Division).NotEmpty();
        RuleFor(item => item.ScheduledRounds).Must(rounds => rounds is 3 or 5);
        RuleFor(item => item.Billing).NotEmpty();
        RuleFor(item => item.BillingOrder).GreaterThan(0);
        RuleFor(item => item.Venue).NotEmpty().MaximumLength(160);
        RuleFor(item => item.Location).NotEmpty().MaximumLength(160);
        RuleFor(item => item.Red).NotNull().SetValidator(new MmaFighterSnapshotValidator());
        RuleFor(item => item.Blue).NotNull().SetValidator(new MmaFighterSnapshotValidator());
        RuleFor(item => item.Markets).NotNull();
        RuleForEach(item => item.Markets).SetValidator(new MmaMarketSnapshotValidator());
    }
}

internal sealed class MmaFighterSnapshotValidator : AbstractValidator<MmaFighterSnapshot>
{
    public MmaFighterSnapshotValidator()
    {
        RuleFor(item => item.ExternalId).NotEmpty().MaximumLength(100);
        RuleFor(item => item.Name).NotEmpty().MaximumLength(120);
        RuleFor(item => item.CountryCode).Length(2);
        RuleFor(item => item.Country).NotEmpty().MaximumLength(80);
        RuleFor(item => item.Record).NotEmpty().MaximumLength(20);
        RuleFor(item => item.Division).NotEmpty();
        RuleFor(item => item.ImageUrl).Must(IsHttpUrl).When(item => !string.IsNullOrWhiteSpace(item.ImageUrl));
        RuleFor(item => item.ReachInches).InclusiveBetween(50, 90).When(item => item.ReachInches.HasValue);
        RuleFor(item => item.TakedownDefensePercent).InclusiveBetween(0m, 100m).When(item => item.TakedownDefensePercent.HasValue);
        RuleFor(item => item.StrikingAccuracyPercent).InclusiveBetween(0m, 100m).When(item => item.StrikingAccuracyPercent.HasValue);
    }

    internal static bool IsHttpUrl(string? value) =>
        Uri.TryCreate(value, UriKind.Absolute, out var uri) &&
        (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);
}

internal sealed class MmaMarketSnapshotValidator : AbstractValidator<MmaMarketSnapshot>
{
    public MmaMarketSnapshotValidator()
    {
        RuleFor(item => item.ExternalId).NotEmpty().MaximumLength(200);
        RuleFor(item => item.Name).NotEmpty().MaximumLength(160);
        RuleFor(item => item.Type).NotEmpty();
        RuleFor(item => item.Provider).NotEmpty().MaximumLength(120);
        RuleFor(item => item.SourceUrl).Must(MmaFighterSnapshotValidator.IsHttpUrl)
            .When(item => !string.IsNullOrWhiteSpace(item.SourceUrl));
        RuleFor(item => item.ObservedAt).NotEmpty();
        RuleFor(item => item.Selections).NotEmpty();
        RuleForEach(item => item.Selections).SetValidator(new MmaSelectionSnapshotValidator());
    }
}

internal sealed class MmaSelectionSnapshotValidator : AbstractValidator<MmaSelectionSnapshot>
{
    public MmaSelectionSnapshotValidator()
    {
        RuleFor(item => item.ExternalId).NotEmpty().MaximumLength(200);
        RuleFor(item => item.Code).NotEmpty().MaximumLength(40);
        RuleFor(item => item.Name).NotEmpty().MaximumLength(120);
        RuleFor(item => item.DecimalOdds).GreaterThan(1m);
        RuleFor(item => item.DisplayOrder).GreaterThanOrEqualTo(0);
    }
}
