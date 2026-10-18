namespace Zenbet.EventsMarkets.Infrastructure.Messaging;

using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Npgsql;
using Zenbet.EventsMarkets.Application.Interfaces;
using Zenbet.EventsMarkets.Domain.Aggregates;
using Zenbet.EventsMarkets.Domain.Events;
using Zenbet.EventsMarkets.Domain.Enums;
using Zenbet.EventsMarkets.Domain.Repositories;
using Zenbet.EventsMarkets.Domain.ValueObjects;
using Zenbet.EventsMarkets.Infrastructure.Persistence;
using Zenbet.EventsMarkets.Infrastructure.Persistence.Outbox;

public sealed class PayoutWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<PayoutWorker> _logger;
    private readonly PayoutWorkerOptions _options;
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false
    };

    public PayoutWorker(
        IServiceScopeFactory scopeFactory,
        ILogger<PayoutWorker> logger,
        IOptions<PayoutWorkerOptions> options)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
        _options = options.Value;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Payout worker started");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessBatchAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing payout batch");
            }

            await Task.Delay(_options.PollInterval, stoppingToken);
        }
    }

    private async Task ProcessBatchAsync(CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<EventsMarketsDbContext>();
        var walletRepository = scope.ServiceProvider.GetRequiredService<IWalletRepository>();
        var transactionRepository = scope.ServiceProvider.GetRequiredService<ITransactionRepository>();
        var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();
        var idempotencyService = scope.ServiceProvider.GetRequiredService<IIdempotencyService>();
        var outboxWriter = scope.ServiceProvider.GetRequiredService<IOutboxWriter>();

        // Get unprocessed MarketSettledDomainEvent messages from outbox
        var messages = await dbContext.OutboxMessages
            .Where(m => m.ProcessedAt == null 
                     && m.RetryCount < _options.MaxRetries
                     && m.Type == nameof(MarketSettledDomainEvent))
            .OrderBy(m => m.CreatedAt)
            .Take(_options.BatchSize)
            .ToListAsync(cancellationToken);

        if (messages.Count == 0) return;

        _logger.LogInformation("Processing {Count} market settlement events for payouts", messages.Count);

        foreach (var message in messages)
        {
            try
            {
                await ProcessMarketSettlementAsync(
                    message, 
                    dbContext, 
                    walletRepository, 
                    transactionRepository,
                    unitOfWork,
                    idempotencyService,
                    outboxWriter,
                    cancellationToken);

                message.ProcessedAt = DateTimeOffset.UtcNow;
                _logger.LogDebug("Processed payout for market settlement {MessageId}", message.Id);
            }
            catch (Exception ex)
            {
                message.RetryCount++;
                message.LastError = ex.Message;
                _logger.LogWarning(ex, "Failed to process payout for market settlement {MessageId}, retry {RetryCount}", message.Id, message.RetryCount);

                if (message.RetryCount >= _options.MaxRetries)
                {
                    await MoveToDeadLetterAsync(dbContext, message, ex);
                }
            }
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task ProcessMarketSettlementAsync(
        OutboxMessage message,
        EventsMarketsDbContext dbContext,
        IWalletRepository walletRepository,
        ITransactionRepository transactionRepository,
        IUnitOfWork unitOfWork,
        IIdempotencyService idempotencyService,
        IOutboxWriter outboxWriter,
        CancellationToken cancellationToken)
    {
        var settlementEvent = JsonSerializer.Deserialize<MarketSettledDomainEvent>(message.Payload, JsonOptions);
        if (settlementEvent == null)
        {
            _logger.LogWarning("Failed to deserialize MarketSettledDomainEvent from message {MessageId}", message.Id);
            return;
        }

        // Only process winning settlements
        if (settlementEvent.Result != SettlementResult.Won)
        {
            _logger.LogDebug("Market {MarketId} settled with result {Result}, no payouts needed", 
                settlementEvent.MarketId, settlementEvent.Result);
            return;
        }

        // Idempotency key for this market settlement payout
        var idempotencyKey = $"payout-market-{settlementEvent.MarketId}-{settlementEvent.SettledAt:yyyyMMddHHmmss}";
        
        var alreadyProcessed = await idempotencyService.ExistsAsync(idempotencyKey, cancellationToken);
        if (alreadyProcessed)
        {
            _logger.LogInformation("Payout for market {MarketId} already processed (idempotent)", settlementEvent.MarketId);
            return;
        }

        // Find all bets placed on the winning selection
        var winningBets = await dbContext.Transactions
            .Where(t => t.Type == TransactionType.BetPlacement 
                     && t.ReferenceId == settlementEvent.WinnerSelectionId.Value.ToString()
                     && t.Status == TransactionStatus.Pending)
            .ToListAsync(cancellationToken);

        if (!winningBets.Any())
        {
            _logger.LogInformation("No pending bets found on winning selection {SelectionId} for market {MarketId}",
                settlementEvent.WinnerSelectionId, settlementEvent.MarketId);
            
            // Still mark as processed to avoid retry
            await idempotencyService.AddAsync(idempotencyKey, "PayoutWorker", cancellationToken);
            return;
        }

        // Get the winning odd to calculate payout
        var winningOdd = await dbContext.Selections
            .Where(s => s.Id == settlementEvent.WinnerSelectionId)
            .Select(s => s.CurrentOdd)
            .FirstOrDefaultAsync(cancellationToken);

        if (winningOdd.Value <= 0)
        {
            _logger.LogWarning("Invalid winning odd for selection {SelectionId}", settlementEvent.WinnerSelectionId);
            return;
        }

        _logger.LogInformation("Processing payouts for {BetCount} bets on selection {SelectionId} at odd {Odd}",
            winningBets.Count, settlementEvent.WinnerSelectionId, winningOdd.Value);

        // Group bets by wallet for batch processing with advisory locks
        var betsByWallet = winningBets
            .GroupBy(b => b.WalletId)
            .ToList();

        foreach (var walletGroup in betsByWallet)
        {
            var walletId = walletGroup.Key;
            var bets = walletGroup.ToList();

            // Advisory lock per wallet to prevent concurrent payouts
            var lockKey = ComputeAdvisoryLockKey(walletId);
            var lockAcquired = await unitOfWork.TryAcquireAdvisoryLockAsync(lockKey, cancellationToken);
            
            if (!lockAcquired)
            {
                _logger.LogWarning("Could not acquire advisory lock for wallet {WalletId}, skipping", walletId);
                continue;
            }

            try
            {
                // Re-check idempotency under lock
                if (await idempotencyService.ExistsAsync(idempotencyKey, cancellationToken))
                {
                    await unitOfWork.CommitAsync(cancellationToken);
                    return;
                }

                var wallet = await walletRepository.GetByIdAsync(walletId, cancellationToken);
                if (wallet == null)
                {
                    _logger.LogWarning("Wallet {WalletId} not found", walletId);
                    await unitOfWork.CommitAsync(cancellationToken);
                    continue;
                }

                // Process each bet for this wallet
                foreach (var bet in bets)
                {
                    // Calculate payout: bet amount * odd
                    var betAmount = bet.Amount;
                    var payoutAmount = new Money(betAmount.Amount * winningOdd.Value);

                    // Settle the bet (this credits the wallet)
                    var settlementTx = wallet.SettleBet(payoutAmount, SettlementResult.Won, 
                        $"Payout for market {settlementEvent.MarketId} selection {settlementEvent.WinnerSelectionId}",
                        $"payout-market-{settlementEvent.MarketId}-bet-{bet.Id}");

                    settlementTx.Complete(); // Mark as completed
                    
                    await transactionRepository.AddAsync(settlementTx, cancellationToken);

                    // Write domain event to outbox
                    foreach (var domainEvent in wallet.DomainEvents)
                    {
                        await outboxWriter.WriteAsync(domainEvent, cancellationToken);
                    }
                    wallet.ClearDomainEvents();
                }

                await walletRepository.UpdateAsync(wallet, wallet.Version, cancellationToken);
                await unitOfWork.CommitAsync(cancellationToken);

                _logger.LogDebug("Processed payout for wallet {WalletId}: {BetCount} bets", walletId, bets.Count);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing payout for wallet {WalletId}", walletId);
                await unitOfWork.RollbackAsync(cancellationToken);
                throw;
            }
        }

        // Mark idempotency key after all wallets processed
        await idempotencyService.AddAsync(idempotencyKey, "PayoutWorker", cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }

    private static long ComputeAdvisoryLockKey(WalletId walletId)
    {
        var bytes = walletId.Value.ToByteArray();
        return BitConverter.ToInt64(bytes, 0);
    }

    private async Task MoveToDeadLetterAsync(EventsMarketsDbContext dbContext, OutboxMessage message, Exception ex)
    {
        var deadLetter = new DeadLetterEntry
        {
            Id = Guid.NewGuid(),
            OriginalTable = "outbox_messages",
            OriginalId = message.Id,
            Payload = message.Payload,
            Error = ex.ToString(),
            FailedAt = DateTimeOffset.UtcNow,
            RetryCount = message.RetryCount
        };

        dbContext.DeadLetters.Add(deadLetter);
        message.ProcessedAt = DateTimeOffset.UtcNow;
    }
}