namespace Zenbet.EventsMarkets.Infrastructure.Persistence.Services;

using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Zenbet.EventsMarkets.Application.Interfaces;
using Zenbet.EventsMarkets.Domain.ValueObjects;
using Zenbet.EventsMarkets.Domain.Enums;
using Zenbet.EventsMarkets.Infrastructure.Persistence;

public sealed class EfRiskManagementService : IRiskManagementService
{
    private readonly EventsMarketsDbContext _dbContext;
    private readonly RiskLimitsOptions _options;

    public EfRiskManagementService(
        EventsMarketsDbContext dbContext,
        IOptions<RiskLimitsOptions> options)
    {
        _dbContext = dbContext;
        _options = options.Value;
    }

    public async Task<RiskValidationResult> ValidatePlaceBetAsync(
        WalletId walletId,
        SelectionId selectionId,
        Money amount,
        CancellationToken cancellationToken = default)
    {
        // 1. Validate max user bet limit
        var userBetLimitResult = await ValidateMaxUserBetLimitAsync(walletId, amount, cancellationToken);
        if (!userBetLimitResult.IsValid)
            return userBetLimitResult;

        // 2. Get market ID for this selection
        var marketId = await GetMarketIdForSelectionAsync(selectionId, cancellationToken);
        if (marketId == MarketId.Empty)
        {
            return new RiskValidationResult(false, "Selection not found", RiskViolationType.MaxMarketExposureExceeded);
        }

        // 3. Validate max market exposure limit
        var marketExposureResult = await ValidateMaxMarketExposureAsync(marketId, selectionId, amount, cancellationToken);
        if (!marketExposureResult.IsValid)
            return marketExposureResult;

        return new RiskValidationResult(true);
    }

    private async Task<RiskValidationResult> ValidateMaxUserBetLimitAsync(
        WalletId walletId,
        Money amount,
        CancellationToken cancellationToken)
    {
        var maxLimit = _options.MaxUserBetLimit;
        
        if (amount > maxLimit)
        {
            return new RiskValidationResult(
                false,
                $"Bet amount {amount} exceeds maximum allowed bet per user: {maxLimit}",
                RiskViolationType.MaxUserBetLimitExceeded);
        }

        return new RiskValidationResult(true);
    }

    private async Task<MarketId> GetMarketIdForSelectionAsync(
        SelectionId selectionId,
        CancellationToken cancellationToken)
    {
        var marketId = await _dbContext.Selections
            .Where(s => s.Id == selectionId)
            .Select(s => EF.Property<MarketId>(s, "MarketId"))
            .FirstOrDefaultAsync(cancellationToken);

        return marketId == MarketId.Empty ? MarketId.Empty : marketId;
    }

    private async Task<RiskValidationResult> ValidateMaxMarketExposureAsync(
        MarketId marketId,
        SelectionId selectionId,
        Money newBetAmount,
        CancellationToken cancellationToken)
    {
        // Get the current odd for the selection to calculate potential payout
        var selection = await _dbContext.Selections
            .FirstOrDefaultAsync(s => s.Id == selectionId, cancellationToken);

        if (selection == null)
        {
            return new RiskValidationResult(false, "Selection not found", RiskViolationType.MaxMarketExposureExceeded);
        }

        var odd = selection.CurrentOdd.Value;
        var potentialPayout = new Money(newBetAmount.Amount * odd);

        // Calculate current exposure for this market (sum of all pending payouts on all selections)
        var currentExposure = await CalculateMarketExposureAsync(marketId, cancellationToken);

        var newTotalExposure = new Money(currentExposure.Amount + potentialPayout.Amount);
        var maxExposure = _options.MaxMarketExposureLimit;

        if (newTotalExposure > maxExposure)
        {
            return new RiskValidationResult(
                false,
                $"Market {marketId} exposure limit would be exceeded. Current: {currentExposure}, New bet would add: {potentialPayout}, Max allowed: {maxExposure}",
                RiskViolationType.MaxMarketExposureExceeded);
        }

        return new RiskValidationResult(true);
    }

    private async Task<Money> CalculateMarketExposureAsync(
        MarketId marketId,
        CancellationToken cancellationToken)
    {
        // Get all selections for this market
        var selections = await _dbContext.Selections
            .Where(s => EF.Property<MarketId>(s, "MarketId") == marketId)
            .ToListAsync(cancellationToken);

        if (!selections.Any())
            return Money.Zero;

        // Get all pending bets on these selections
        var selectionIds = selections.Select(s => s.Id).ToList();
        
        var pendingBets = await _dbContext.Transactions
            .Where(t => t.Type == TransactionType.BetPlacement
                     && t.Status == TransactionStatus.Pending
                     && selectionIds.Contains(t.SelectionId!.Value))
            .ToListAsync(cancellationToken);

        if (!pendingBets.Any())
            return Money.Zero;

        // Calculate total potential payout = sum of (bet amount * odd) for each selection
        decimal totalExposure = 0;
        
        foreach (var bet in pendingBets)
        {
            if (bet.SelectionId.HasValue)
            {
                var selection = selections.FirstOrDefault(s => s.Id == bet.SelectionId.Value);
                if (selection != null)
                {
                    totalExposure += bet.Amount.Amount * selection.CurrentOdd.Value;
                }
            }
        }

        return new Money(totalExposure);
    }
}