namespace Zenbet.EventsMarkets.Domain.ValueObjects;

using Zenbet.EventsMarkets.Domain.Enums;
using Zenbet.EventsMarkets.Domain.Exceptions;

/// <summary>
/// Peleador dentro de una cartelera. La división se guarda en el peleador para
/// poder rechazar emparejamientos entre divisiones distintas en el dominio.
/// </summary>
public sealed class Fighter
{
    private Fighter() { } // EF Core

    private Fighter(
        string id,
        string name,
        string countryCode,
        string country,
        string record,
        string? rank,
        WeightDivision division,
        string? imageUrl)
    {
        Id = id;
        Name = name;
        CountryCode = countryCode;
        Country = country;
        Record = record;
        Rank = rank;
        Division = division;
        ImageUrl = imageUrl;
    }

    public string Id { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public string CountryCode { get; private set; } = string.Empty;
    public string Country { get; private set; } = string.Empty;
    public string Record { get; private set; } = string.Empty;
    public string? Rank { get; private set; }
    public WeightDivision Division { get; private set; }
    public string? ImageUrl { get; private set; }

    public static Fighter Create(
        string id,
        string name,
        string countryCode,
        string country,
        string record,
        string? rank,
        WeightDivision division,
        string? imageUrl = null)
    {
        if (string.IsNullOrWhiteSpace(id))
            throw new ArgumentException("El peleador necesita un identificador estable.", nameof(id));

        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("El peleador necesita un nombre.", nameof(name));

        if (string.IsNullOrWhiteSpace(countryCode))
            throw new ArgumentException("El peleador necesita un código de país.", nameof(countryCode));

        if (string.IsNullOrWhiteSpace(country))
            throw new ArgumentException("El peleador necesita un país para presentación.", nameof(country));

        if (string.IsNullOrWhiteSpace(record))
            throw new ArgumentException("El peleador necesita un récord.", nameof(record));

        WeightDivisionCatalog.Get(division); // Valida que la división exista en el catálogo.

        return new Fighter(
            id.Trim(),
            name.Trim(),
            countryCode.Trim().ToUpperInvariant(),
            country.Trim(),
            record.Trim(),
            string.IsNullOrWhiteSpace(rank) ? null : rank.Trim(),
            division,
            NormalizeImageUrl(imageUrl));
    }

    public void UpdateImageUrl(string? imageUrl) => ImageUrl = NormalizeImageUrl(imageUrl);

    private static string? NormalizeImageUrl(string? imageUrl)
    {
        if (string.IsNullOrWhiteSpace(imageUrl))
            return null;

        var trimmed = imageUrl.Trim();
        if (trimmed.Length > 512 ||
            !Uri.TryCreate(trimmed, UriKind.Absolute, out var uri) ||
            (uri.Scheme != Uri.UriSchemeHttps && uri.Scheme != Uri.UriSchemeHttp))
        {
            throw new ArgumentException(
                "La imagen del peleador debe ser una URL HTTP(S) absoluta de hasta 512 caracteres.",
                nameof(imageUrl));
        }

        return trimmed;
    }
}

/// <summary>
/// Metadatos de un combate de MMA. Es un componente propiedad de Event, no un
/// aggregate independiente: nace y se valida junto al evento que lo contiene.
/// </summary>
public sealed class MmaBout
{
    private MmaBout() { } // EF Core

    private MmaBout(
        Fighter red,
        Fighter blue,
        WeightDivision division,
        int scheduledRounds,
        bool isTitleFight,
        FightBilling billing,
        int billingOrder,
        string venue,
        string location)
    {
        Red = red;
        Blue = blue;
        Division = division;
        ScheduledRounds = scheduledRounds;
        IsTitleFight = isTitleFight;
        Billing = billing;
        BillingOrder = billingOrder;
        Venue = venue;
        Location = location;
    }

    public Fighter Red { get; private set; } = null!;
    public Fighter Blue { get; private set; } = null!;
    public WeightDivision Division { get; private set; }
    public int ScheduledRounds { get; private set; }
    public bool IsTitleFight { get; private set; }
    public FightBilling Billing { get; private set; }
    public int BillingOrder { get; private set; }
    public string Venue { get; private set; } = string.Empty;
    public string Location { get; private set; } = string.Empty;

    public static MmaBout Create(
        Fighter red,
        Fighter blue,
        WeightDivision division,
        int scheduledRounds,
        bool isTitleFight,
        FightBilling billing,
        int billingOrder,
        string venue,
        string location)
    {
        ArgumentNullException.ThrowIfNull(red);
        ArgumentNullException.ThrowIfNull(blue);

        if (red.Division != division || blue.Division != division)
        {
            throw new DivisionMismatchException(
                $"El combate {red.Name} vs. {blue.Name} no comparte la división oficial: " +
                $"{WeightDivisionCatalog.Get(red.Division).Label} vs. {WeightDivisionCatalog.Get(blue.Division).Label} " +
                $"para un mercado declarado como {WeightDivisionCatalog.Get(division).Label}.");
        }

        if (scheduledRounds is not (3 or 5))
            throw new ArgumentOutOfRangeException(nameof(scheduledRounds), "Un combate UFC debe ser a 3 o 5 asaltos.");

        if (billingOrder < 1)
            throw new ArgumentOutOfRangeException(nameof(billingOrder), "El orden de cartelera debe ser positivo.");

        if (string.IsNullOrWhiteSpace(venue))
            throw new ArgumentException("El combate necesita un recinto.", nameof(venue));

        if (string.IsNullOrWhiteSpace(location))
            throw new ArgumentException("El combate necesita una ubicación.", nameof(location));

        return new MmaBout(
            red,
            blue,
            division,
            scheduledRounds,
            isTitleFight,
            billing,
            billingOrder,
            venue.Trim(),
            location.Trim());
    }

    /// <summary>
    /// Actualiza únicamente la media de presentación. El seed puede refrescar
    /// fotos sin reescribir cuotas ni el resto de los metadatos del combate.
    /// </summary>
    public void UpdateFighterImages(string? redImageUrl, string? blueImageUrl)
    {
        Red.UpdateImageUrl(redImageUrl);
        Blue.UpdateImageUrl(blueImageUrl);
    }
}
