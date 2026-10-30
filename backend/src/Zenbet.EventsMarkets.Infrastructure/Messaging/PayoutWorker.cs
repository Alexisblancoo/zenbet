namespace Zenbet.EventsMarkets.Infrastructure.Messaging;

using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Zenbet.EventsMarkets.Application.Interfaces;
using Zenbet.EventsMarkets.Domain.Aggregates;
using Zenbet.EventsMarkets.Domain.Enums;
using Zenbet.EventsMarkets.Domain.Events;
using Zenbet.EventsMarkets.Domain.Repositories;
using Zenbet.EventsMarkets.Domain.ValueObjects;
using Zenbet.EventsMarkets.Infrastructure.Persistence;

/// <summary>
/// Motor de liquidación en segundo plano. Descubre apuestas pendientes cuyos
/// mercados ya tienen resultado, actualiza su ciclo de vida y acredita el pago
/// en la billetera PostgreSQL. No depende del outbox de notificaciones: así una
/// notificación perdida nunca deja una apuesta sin pagar.
/// </summary>
public sealed class PayoutWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<PayoutWorker> _logger;
    private readonly PayoutWorkerOptions _options;

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

            try
            {
                await Task.Delay(_options.PollInterval, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
    }

    private async Task ProcessBatchAsync(CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<EventsMarketsDbContext>();
        var walletRepository = scope.ServiceProvider.GetRequiredService<IWalletRepository>();
        var transactionRepository = scope.ServiceProvider.GetRequiredService<ITransactionRepository>();
        var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();
        var outboxWriter = scope.ServiceProvider.GetRequiredService<IOutboxWriter>();

        // La unión se resuelve en PostgreSQL para no materializar tablas
        // completas ni enviar colecciones de GUID como parámetro (EF Core 8
        // sobre .NET 10 falla al evaluar ese tipo de cierre con ReadOnlySpan).
        var pendingRows = await (
                from transaction in dbContext.Transactions
                where transaction.Type == TransactionType.BetPlacement
                    && transaction.BetStatus == BetStatus.Pending
                    && transaction.SelectionId != null
                join selection in dbContext.Selections
                    on transaction.SelectionId!.Value equals selection.Id
                join market in dbContext.Markets
                    on EF.Property<MarketId>(selection, "MarketId") equals market.Id
                where market.Status == MarketStatus.Settled
                    || market.Status == MarketStatus.Void
                orderby transaction.CreatedAt
                select new PendingBetRow(
                    transaction,
                    selection.Id,
                    market.Id,
                    selection.SettlementResult,
                    selection.CurrentOdd.Value,
                    market.MarketSettlementResult,
                    market.WinnerSelectionId))
            .Take(_options.BatchSize)
            .ToListAsync(cancellationToken);

        if (pendingRows.Count == 0) return;

        var settledBets = new List<SettledBet>();
        foreach (var row in pendingRows)
        {
            var selectionResult = ResolveSelectionResult(row);
            if (selectionResult is null) continue;

            var outcome = selectionResult switch
            {
                SettlementResult.Won => BetStatus.Won,
                SettlementResult.Lost => BetStatus.Lost,
                SettlementResult.Void or SettlementResult.Push => BetStatus.Void,
                _ => BetStatus.Pending,
            };

            if (outcome == BetStatus.Pending) continue;

            var acceptedOdds = row.Bet.AcceptedOdds ?? row.CurrentOdds;
            var stake = row.Bet.Amount.Amount;
            var payout = outcome switch
            {
                BetStatus.Won => RoundMoney(stake * acceptedOdds),
                BetStatus.Void => RoundMoney(stake),
                _ => 0m,
            };

            var promoCode = PromoCodeCatalog.Resolve(row.Bet.PromoCode);
            var bonus = outcome == BetStatus.Won && promoCode is not null
                ? promoCode.CalculateBonus(payout - stake)
                : 0m;

            settledBets.Add(new SettledBet(
                row.Bet,
                row.MarketId,
                outcome,
                selectionResult.Value,
                payout,
                bonus));
        }

        if (settledBets.Count == 0) return;

        _logger.LogInformation(
            "Processing {Count} pending bets across {WalletCount} wallets",
            settledBets.Count,
            settledBets.Select(item => item.Bet.WalletId).Distinct().Count());

        foreach (var walletGroup in settledBets.GroupBy(item => item.Bet.WalletId))
        {
            await ProcessWalletAsync(
                walletGroup.Key,
                walletGroup.ToList(),
                dbContext,
                walletRepository,
                transactionRepository,
                unitOfWork,
                outboxWriter,
                cancellationToken);
        }
    }

    private async Task ProcessWalletAsync(
        WalletId walletId,
        IReadOnlyList<SettledBet> bets,
        EventsMarketsDbContext dbContext,
        IWalletRepository walletRepository,
        ITransactionRepository transactionRepository,
        IUnitOfWork unitOfWork,
        IOutboxWriter outboxWriter,
        CancellationToken cancellationToken)
    {
        await unitOfWork.BeginTransactionAsync(cancellationToken);

        try
        {
            var lockKey = ComputeAdvisoryLockKey(walletId);
            var lockAcquired = await unitOfWork.TryAcquireAdvisoryLockAsync(lockKey, cancellationToken);

            if (!lockAcquired)
            {
                _logger.LogWarning(
                    "Could not acquire payout lock for wallet {WalletId}; retrying on next poll",
                    walletId);
                await unitOfWork.RollbackAsync(cancellationToken);
                return;
            }

            var wallet = await walletRepository.GetByIdAsync(walletId, cancellationToken);
            if (wallet is null)
            {
                _logger.LogWarning("Wallet {WalletId} not found while settling bets", walletId);
                await unitOfWork.RollbackAsync(cancellationToken);
                return;
            }

            var expectedVersion = wallet.Version;
            var walletChanged = false;
            var appliedBets = new List<SettledBet>();

            foreach (var item in bets)
            {
                // Otra instancia del worker pudo pagar esta apuesta antes de
                // que adquiriéramos el lock. Se relee bajo la transacción.
                await dbContext.Entry(item.Bet).ReloadAsync(cancellationToken);
                if (item.Bet.BetStatus != BetStatus.Pending) continue;

                var stake = item.Bet.Amount.Amount;
                var reference = $"payout-market-{item.MarketId.Value}-bet-{item.Bet.Id.Value}";

                if (item.Outcome is BetStatus.Won or BetStatus.Void)
                {
                    var settlementTransaction = wallet.SettleBet(
                        new Money(item.Payout),
                        item.SelectionResult,
                        BuildSettlementDescription(item),
                        reference);

                    settlementTransaction.Complete();
                    await transactionRepository.AddAsync(settlementTransaction, cancellationToken);
                    walletChanged = true;
                }

                if (item.Bonus > 0m)
                {
                    var bonusTransaction = wallet.AddBonus(
                        new Money(item.Bonus),
                        $"Bono promocional {item.Bet.PromoCode} · apuesta {item.Bet.Id.Value}",
                        $"promo-{item.Bet.Id.Value}");

                    bonusTransaction.Complete();
                    await transactionRepository.AddAsync(bonusTransaction, cancellationToken);
                    walletChanged = true;
                }

                item.Bet.SettleBet(item.Outcome);
                await transactionRepository.UpdateAsync(item.Bet, cancellationToken);
                appliedBets.Add(item);

                _logger.LogInformation(
                    "Bet {BetId} settled as {Outcome} for wallet {WalletId}: stake {Stake}, payout {Payout}, bonus {Bonus}",
                    item.Bet.Id,
                    item.Outcome,
                    walletId,
                    stake,
                    item.Payout,
                    item.Bonus);
            }

            if (walletChanged)
            {
                await walletRepository.UpdateAsync(wallet, expectedVersion, cancellationToken);

                foreach (var domainEvent in wallet.DomainEvents)
                    await outboxWriter.WriteAsync(domainEvent, cancellationToken);

                wallet.ClearDomainEvents();
            }

            foreach (var item in appliedBets)
            {
                await outboxWriter.WriteAsync(new BetOutcomeSettledDomainEvent(
                    wallet.Id,
                    wallet.UserId,
                    item.Bet.Id,
                    item.MarketId,
                    item.Outcome,
                    new Money(item.Payout),
                    wallet.Balance,
                    DateTimeOffset.UtcNow), cancellationToken);
            }

            await unitOfWork.SaveChangesAsync(cancellationToken);
            await unitOfWork.CommitAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error settling bets for wallet {WalletId}", walletId);
            await unitOfWork.RollbackAsync(cancellationToken);
            throw;
        }
    }

    private static SettlementResult? ResolveSelectionResult(PendingBetRow row)
    {
        // Void y Push anulan el mercado completo: todas las apuestas reciben
        // su stake de vuelta, sin importar qué selección quedó marcada como
        // ganadora por el comando de liquidación.
        if (row.MarketResult is SettlementResult.Void or SettlementResult.Push)
            return row.MarketResult;

        if (row.SelectionResult is not null)
            return row.SelectionResult;

        if (row.WinnerSelectionId is null)
            return null;

        return row.WinnerSelectionId == row.SelectionId
            ? SettlementResult.Won
            : SettlementResult.Lost;
    }

    private static string BuildSettlementDescription(SettledBet item) =>
        item.Outcome == BetStatus.Void
            ? $"Reembolso por apuesta anulada · {item.Bet.Id.Value}"
            : $"Pago de apuesta ganadora · {item.Bet.Id.Value}";

    private static decimal RoundMoney(decimal value) =>
        Math.Round(value, 2, MidpointRounding.AwayFromZero);

    private static long ComputeAdvisoryLockKey(WalletId walletId)
    {
        var bytes = walletId.Value.ToByteArray();
        return BitConverter.ToInt64(bytes, 0);
    }

    private sealed record PendingBetRow(
        Transaction Bet,
        SelectionId SelectionId,
        MarketId MarketId,
        SettlementResult? SelectionResult,
        decimal CurrentOdds,
        SettlementResult? MarketResult,
        SelectionId? WinnerSelectionId);

    private sealed record SettledBet(
        Transaction Bet,
        MarketId MarketId,
        BetStatus Outcome,
        SettlementResult SelectionResult,
        decimal Payout,
        decimal Bonus);
}
