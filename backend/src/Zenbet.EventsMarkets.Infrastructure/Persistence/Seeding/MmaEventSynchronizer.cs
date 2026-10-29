namespace Zenbet.EventsMarkets.Infrastructure.Persistence.Seeding;

using System.Security.Cryptography;
using System.Text;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Zenbet.EventsMarkets.Application.Interfaces;
using Zenbet.EventsMarkets.Domain.Aggregates;
using Zenbet.EventsMarkets.Domain.Enums;
using Zenbet.EventsMarkets.Domain.Events;
using Zenbet.EventsMarkets.Domain.ValueObjects;
using Zenbet.EventsMarkets.Infrastructure.Persistence;

/// <summary>Transactional, deterministic upsert for provider cards, bouts and odds.</summary>
public sealed class MmaEventSynchronizer
{
    private const long SynchronizationLockId = 0x5A454E4245544D4D;
    private readonly EventsMarketsDbContext _dbContext;
    private readonly IOutboxWriter _outboxWriter;
    private readonly IValidator<MmaEventSnapshot> _snapshotValidator;

    public MmaEventSynchronizer(
        EventsMarketsDbContext dbContext,
        IOutboxWriter outboxWriter,
        IValidator<MmaEventSnapshot> snapshotValidator)
    {
        _dbContext = dbContext;
        _outboxWriter = outboxWriter;
        _snapshotValidator = snapshotValidator;
    }

    public async Task<MmaSyncResult> SynchronizeAsync(
        IReadOnlyList<MmaEventSnapshot> snapshots,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(snapshots);
        if (snapshots.Count == 0)
            return new MmaSyncResult(0, 0);

        foreach (var snapshot in snapshots)
            await _snapshotValidator.ValidateAndThrowAsync(snapshot, cancellationToken);
        ValidateExternalIds(snapshots);
        await using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            await _dbContext.Database.ExecuteSqlAsync(
                $"SELECT pg_advisory_xact_lock({SynchronizationLockId});",
                cancellationToken);

            var promotionSlugs = snapshots.Select(item => item.PromotionSlug).Distinct(StringComparer.Ordinal).ToArray();
            var promotions = await _dbContext.Promotions
                .Where(item => promotionSlugs.Contains(item.Slug))
                .ToDictionaryAsync(item => item.Slug, StringComparer.Ordinal, cancellationToken);

            var fightSnapshots = snapshots.SelectMany(card => card.Fights.Select(fight => (Card: card, Fight: fight))).ToList();
            var eventIds = fightSnapshots.Select(item => EventId.From(StableId("fight", item.Fight.ExternalId))).ToArray();
            var eventLookup = await _dbContext.Events
                .Include(item => item.Markets)
                .ThenInclude(market => market.Selections)
                .Where(item => eventIds.Contains(item.Id))
                .ToDictionaryAsync(item => item.Id, cancellationToken);

            var cardIds = snapshots.Select(item => StableId("card", item.ExternalId)).ToArray();
            var cardLookup = await _dbContext.FightingEvents
                .Where(item => cardIds.Contains(item.Id))
                .ToDictionaryAsync(item => item.Id, cancellationToken);

            var changes = 0;
            foreach (var cardSnapshot in snapshots)
            {
                if (!promotions.TryGetValue(cardSnapshot.PromotionSlug, out var promotion))
                    throw new InvalidDataException($"Promotion '{cardSnapshot.PromotionSlug}' is not configured in ZenBet.");

                var cardId = StableId("card", cardSnapshot.ExternalId);
                if (cardLookup.TryGetValue(cardId, out var card))
                {
                    if (card.PromotionId != promotion.Id)
                        throw new InvalidDataException($"Provider event '{cardSnapshot.ExternalId}' changed promotion identity.");
                    if (card.Synchronize(cardSnapshot.Name, cardSnapshot.Slug, cardSnapshot.StartTime))
                        changes++;
                }
                else
                {
                    card = new FightingEvent(cardId, cardSnapshot.Name, cardSnapshot.Slug,
                        cardSnapshot.StartTime, promotion.Id);
                    _dbContext.FightingEvents.Add(card);
                    cardLookup.Add(cardId, card);
                    changes++;
                }

                foreach (var fightSnapshot in cardSnapshot.Fights)
                {
                    var eventId = EventId.From(StableId("fight", fightSnapshot.ExternalId));
                    var bout = BuildBout(fightSnapshot);
                    if (eventLookup.TryGetValue(eventId, out var fightingEvent))
                    {
                        if (fightingEvent.SynchronizeFromProvider(
                                fightSnapshot.Name,
                                fightSnapshot.StartTime,
                                fightSnapshot.Competition,
                                bout))
                            changes++;
                    }
                    else
                    {
                        fightingEvent = new Event(eventId, fightSnapshot.Name, SportType.MixedMartialArts,
                            fightSnapshot.StartTime, fightSnapshot.Competition, bout);
                        _dbContext.Events.Add(fightingEvent);
                        eventLookup.Add(eventId, fightingEvent);
                        changes++;
                    }

                    changes += UpsertMarkets(fightingEvent, fightSnapshot);
                }
            }

            var domainEvents = eventLookup.Values
                .SelectMany(fightingEvent => fightingEvent.DomainEvents
                    .Concat(fightingEvent.Markets.SelectMany(market => market.DomainEvents)))
                .Distinct()
                .ToArray();
            foreach (var domainEvent in domainEvents)
                await _outboxWriter.WriteAsync(domainEvent, cancellationToken);

            await _dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            foreach (var fightingEvent in eventLookup.Values)
            {
                fightingEvent.ClearDomainEvents();
                foreach (var market in fightingEvent.Markets)
                    market.ClearDomainEvents();
            }

            return new MmaSyncResult(snapshots.Count, changes);
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    private static int UpsertMarkets(Event fightingEvent, MmaFightSnapshot snapshot)
    {
        var changes = 0;
        foreach (var marketSnapshot in snapshot.Markets)
        {
            var marketId = MarketId.From(StableId($"market:{snapshot.ExternalId}", marketSnapshot.ExternalId));
            var market = fightingEvent.Markets.FirstOrDefault(item => item.Id == marketId);
            var marketType = ParseMarketType(marketSnapshot.Type);
            var provenance = new MarketProvenance(
                marketSnapshot.Provider,
                ParseSourceKind(marketSnapshot.SourceUrl),
                marketSnapshot.SourceUrl,
                marketSnapshot.ObservedAt);

            if (market is null)
            {
                var selections = marketSnapshot.Selections.Select(selection => new Selection(
                    SelectionId.From(StableId($"selection:{snapshot.ExternalId}:{marketSnapshot.ExternalId}", selection.ExternalId)),
                    selection.Name,
                    new Odd(selection.DecimalOdds, marketSnapshot.ObservedAt, marketSnapshot.Provider),
                    selection.Code,
                    selection.DisplayOrder)).ToList();
                fightingEvent.AddMarket(marketId, marketSnapshot.Name, marketType, selections,
                    marketSnapshot.Line, marketSnapshot.DisplayOrder, provenance);
                changes++;
                continue;
            }

            if (market.Type != marketType)
                throw new InvalidDataException($"Provider market '{marketSnapshot.ExternalId}' changed market type.");
            if (market.Status is MarketStatus.Settled or MarketStatus.Void)
                continue;

            market.UpdatePresentation(marketSnapshot.Name, marketSnapshot.Line, marketSnapshot.DisplayOrder);
            market.SetProvenance(provenance);
            foreach (var selectionSnapshot in marketSnapshot.Selections)
            {
                var selectionId = SelectionId.From(StableId($"selection:{snapshot.ExternalId}:{marketSnapshot.ExternalId}", selectionSnapshot.ExternalId));
                var selection = market.Selections.FirstOrDefault(item => item.Id == selectionId);
                var odd = new Odd(selectionSnapshot.DecimalOdds, marketSnapshot.ObservedAt, marketSnapshot.Provider);
                if (selection is null)
                {
                    market.AddSelection(new Selection(selectionId, selectionSnapshot.Name, odd,
                        selectionSnapshot.Code, selectionSnapshot.DisplayOrder));
                    changes++;
                    continue;
                }

                selection.UpdateMetadata(selectionSnapshot.Name, selectionSnapshot.Code, selectionSnapshot.DisplayOrder);
                if (odd.Timestamp < selection.CurrentOdd.Timestamp)
                    continue;
                if (selection.CurrentOdd.Value != odd.Value ||
                    selection.CurrentOdd.Timestamp != odd.Timestamp ||
                    !string.Equals(selection.CurrentOdd.Provider, odd.Provider, StringComparison.Ordinal))
                {
                    market.UpdateSelectionOdds(selectionId, odd, odd.Timestamp);
                    changes++;
                }
            }
        }

        return changes;
    }

    private static MmaBout BuildBout(MmaFightSnapshot snapshot)
    {
        var division = WeightDivisionCatalog.Parse(snapshot.Division).Division;
        var red = BuildFighter(snapshot.Red);
        var blue = BuildFighter(snapshot.Blue);
        var billing = Enum.TryParse<FightBilling>(snapshot.Billing, true, out var parsedBilling)
            ? parsedBilling
            : throw new InvalidDataException($"Unsupported MMA billing '{snapshot.Billing}'.");
        return MmaBout.Create(red, blue, division, snapshot.ScheduledRounds, snapshot.IsTitleFight,
            billing, snapshot.BillingOrder, snapshot.Venue, snapshot.Location);
    }

    private static Fighter BuildFighter(MmaFighterSnapshot snapshot)
    {
        var division = WeightDivisionCatalog.Parse(snapshot.Division).Division;
        FighterStance? stance = null;
        if (!string.IsNullOrWhiteSpace(snapshot.Stance))
        {
            stance = Enum.TryParse<FighterStance>(snapshot.Stance, true, out var parsed)
                ? parsed
                : throw new InvalidDataException($"Unsupported fighter stance '{snapshot.Stance}'.");
        }
        return Fighter.Create(snapshot.ExternalId, snapshot.Name, snapshot.CountryCode, snapshot.Country,
            snapshot.Record, snapshot.Rank, division, snapshot.ImageUrl, snapshot.ReachInches, stance,
            snapshot.TakedownDefensePercent, snapshot.StrikingAccuracyPercent);
    }

    private static MarketType ParseMarketType(string value) => value.Trim().ToLowerInvariant() switch
    {
        "moneyline" or "mmamoneyline" => MarketType.MmaMoneyline,
        "method_of_victory" or "mmamethodofvictory" => MarketType.MmaMethodOfVictory,
        "total_rounds" or "mmatotalrounds" => MarketType.MmaTotalRounds,
        "go_to_decision" or "mmagotodecision" => MarketType.MmaGoToDecision,
        _ => throw new InvalidDataException($"Unsupported MMA market type '{value}'.")
    };

    private static OddsSourceKind ParseSourceKind(string? sourceUrl) =>
        string.IsNullOrWhiteSpace(sourceUrl) ? OddsSourceKind.Model : OddsSourceKind.Aggregator;

    private static void ValidateExternalIds(IReadOnlyList<MmaEventSnapshot> snapshots)
    {
        var cardIds = new HashSet<string>(StringComparer.Ordinal);
        var fightIds = new HashSet<string>(StringComparer.Ordinal);
        foreach (var card in snapshots)
        {
            Require(card.ExternalId, "card.externalId");
            if (!cardIds.Add(card.ExternalId))
                throw new InvalidDataException($"MMA card '{card.ExternalId}' has a duplicate external ID.");

            foreach (var fight in card.Fights)
            {
                if (!fightIds.Add(fight.ExternalId))
                    throw new InvalidDataException($"MMA fight '{fight.ExternalId}' has a duplicate external ID.");
            }
        }
    }

    private static Guid StableId(string category, string externalId)
    {
        Require(externalId, "externalId");
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes($"zenbet:{category}:{externalId.Trim()}"));
        return new Guid(hash.AsSpan(0, 16));
    }

    private static void Require(string value, string field)
    {
        if (string.IsNullOrWhiteSpace(value))
            throw new InvalidDataException($"MMA provider field '{field}' is required.");
    }
}

public sealed record MmaSyncResult(int Cards, int Changes);
