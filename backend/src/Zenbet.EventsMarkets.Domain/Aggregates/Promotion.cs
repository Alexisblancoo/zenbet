namespace Zenbet.EventsMarkets.Domain.Aggregates;

using System.Text.RegularExpressions;
using Zenbet.EventsMarkets.Domain.Enums;

public sealed class Promotion
{
    private readonly List<FightingEvent> _events = [];

    private Promotion() { } // EF Core

    public Promotion(Guid id, string name, string slug, PromotionTier tier, string countryCode)
    {
        if (id == Guid.Empty)
            throw new ArgumentException("Promotion ID cannot be empty.", nameof(id));

        Id = id;
        Name = ValidateName(name);
        Slug = ValidateSlug(slug);
        Tier = Enum.IsDefined(tier) ? tier : throw new ArgumentOutOfRangeException(nameof(tier));
        CountryCode = ValidateCountryCode(countryCode);
    }

    public Guid Id { get; private set; }
    public string Name { get; private set; } = null!;
    public string Slug { get; private set; } = null!;
    public PromotionTier Tier { get; private set; }
    public string CountryCode { get; private set; } = null!;
    public IReadOnlyCollection<FightingEvent> Events => _events.AsReadOnly();

    public void AddEvent(FightingEvent fightingEvent)
    {
        ArgumentNullException.ThrowIfNull(fightingEvent);
        if (fightingEvent.PromotionId != Id)
            throw new InvalidOperationException("The event belongs to a different promotion.");
        if (_events.All(item => item.Id != fightingEvent.Id))
            _events.Add(fightingEvent);
    }

    private static string ValidateName(string value)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value);
        if (value.Trim().Length > 120)
            throw new ArgumentOutOfRangeException(nameof(value), "Promotion name cannot exceed 120 characters.");
        return value.Trim();
    }

    private static string ValidateSlug(string value)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value);
        var slug = value.Trim().ToLowerInvariant();
        if (slug.Length > 120 || !Regex.IsMatch(slug, "^[a-z0-9]+(?:-[a-z0-9]+)*$", RegexOptions.CultureInvariant))
            throw new ArgumentException("Slug must contain lowercase ASCII letters, digits, and single hyphens.", nameof(value));
        return slug;
    }

    private static string ValidateCountryCode(string value)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value);
        var code = value.Trim().ToUpperInvariant();
        if (code.Length != 2 || code.Any(character => character is < 'A' or > 'Z'))
            throw new ArgumentException("CountryCode must be a two-letter ISO 3166-1 alpha-2 code.", nameof(value));
        return code;
    }
}
