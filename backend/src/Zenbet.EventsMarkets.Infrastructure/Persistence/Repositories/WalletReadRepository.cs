namespace Zenbet.EventsMarkets.Infrastructure.Persistence.Repositories;

using Microsoft.EntityFrameworkCore;
using Zenbet.EventsMarkets.Application.DTOs;
using Zenbet.EventsMarkets.Application.Interfaces;
using Zenbet.EventsMarkets.Domain.Enums;
using Zenbet.EventsMarkets.Domain.ValueObjects;

/// <summary>
/// Proyecciones de lectura de la billetera. Mantiene el historial fuera del
/// agregado para que un listado no cargue transacciones ni selecciones
/// completas en memoria.
/// </summary>
public sealed class WalletReadRepository : IWalletReadRepository
{
    private readonly EventsMarketsDbContext _dbContext;

    public WalletReadRepository(EventsMarketsDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<decimal?> GetBalanceAsync(
        Guid walletId,
        CancellationToken cancellationToken = default)
    {
        var id = WalletId.From(walletId);

        var wallet = await _dbContext.Wallets
            .AsNoTracking()
            .Where(candidate => candidate.Id == id)
            .Select(candidate => new { candidate.Balance })
            .FirstOrDefaultAsync(cancellationToken);

        return wallet?.Balance.Amount;
    }

    public async Task<IReadOnlyList<WalletBetDto>> ListBetsAsync(
        Guid walletId,
        CancellationToken cancellationToken = default)
    {
        var id = WalletId.From(walletId);

        var rows = await (
            from transaction in _dbContext.Transactions.AsNoTracking()
            where transaction.WalletId == id
                && transaction.Type == TransactionType.BetPlacement
                && transaction.SelectionId != null
            join selection in _dbContext.Selections.AsNoTracking()
                on transaction.SelectionId!.Value equals selection.Id
            join market in _dbContext.Markets.AsNoTracking()
                on EF.Property<MarketId>(selection, "MarketId") equals market.Id
            join @event in _dbContext.Events.AsNoTracking()
                on market.EventId equals @event.Id
            orderby transaction.CreatedAt descending
            select new BetProjection(
                transaction.Id.Value,
                transaction.Amount.Amount,
                transaction.CreatedAt,
                transaction.Status,
                @event.Name,
                selection.Name,
                market.Name,
                selection.CurrentOdd.Value,
                selection.SettlementResult))
            .ToListAsync(cancellationToken);

        if (rows.Count == 0) return Array.Empty<WalletBetDto>();

        // El trabajador de pagos enlaza cada liquidación con el id de la
        // transacción original en el reference id. Se resuelve en memoria para
        // no depender de una columna adicional en el esquema.
        var settlements = await _dbContext.Transactions
            .AsNoTracking()
            .Where(transaction => transaction.WalletId == id
                && transaction.Type == TransactionType.BetSettlement)
            .Select(transaction => new SettlementProjection(
                transaction.ReferenceId,
                transaction.Amount.Amount,
                transaction.CreatedAt,
                transaction.CompletedAt))
            .ToListAsync(cancellationToken);

        var settlementByBet = settlements
            .Select(settlement => new
            {
                BetId = TryReadBetId(settlement.ReferenceId),
                settlement.Amount,
                settlement.CreatedAt,
                settlement.CompletedAt,
            })
            .Where(settlement => settlement.BetId is not null)
            .GroupBy(settlement => settlement.BetId!, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(
                group => group.Key,
                group => group.OrderByDescending(settlement => settlement.CreatedAt).First(),
                StringComparer.OrdinalIgnoreCase);

        return rows.Select(row =>
        {
            var status = ResolveStatus(row.TransactionStatus, row.SettlementResult);
            var stake = RoundMoney(row.Stake);
            var odds = row.Odds;
            var potentialPayout = RoundMoney(stake * odds);
            settlementByBet.TryGetValue(row.Id.ToString("N"), out var settlement);

            decimal? payout = status switch
            {
                "won" => settlement?.Amount ?? potentialPayout,
                "lost" => 0m,
                "cancelled" => stake,
                _ => null,
            };

            var settledAt = settlement?.CompletedAt
                ?? settlement?.CreatedAt
                ?? (status is "cancelled" ? row.PlacedAt : null);

            return new WalletBetDto(
                row.Id,
                row.Id,
                FormatTicket(row.Id),
                row.EventName,
                row.SelectionName,
                row.MarketName,
                "single",
                1,
                stake,
                odds,
                potentialPayout,
                payout,
                status,
                row.PlacedAt,
                settledAt);
        }).ToList();
    }

    public async Task<IReadOnlyList<WalletTransactionDto>> ListTransactionsAsync(
        Guid walletId,
        CancellationToken cancellationToken = default)
    {
        var id = WalletId.From(walletId);

        var rows = await _dbContext.Transactions
            .AsNoTracking()
            .Where(transaction => transaction.WalletId == id)
            .OrderByDescending(transaction => transaction.CreatedAt)
            .Select(transaction => new TransactionProjection(
                transaction.Id.Value,
                transaction.Type,
                transaction.Status,
                transaction.Amount.Amount,
                transaction.BalanceAfter.Amount,
                transaction.Description,
                transaction.ReferenceId,
                transaction.CreatedAt,
                transaction.CompletedAt))
            .ToListAsync(cancellationToken);

        return rows.Select(row => new WalletTransactionDto(
                row.Id,
                row.Type.ToString().ToLowerInvariant(),
                // El cargo de una apuesta ya se aplicó al saldo; su ciclo de
                // vida posterior se refleja en el historial de apuestas.
                row.Type == TransactionType.BetPlacement
                    ? "completed"
                    : row.Status.ToString().ToLowerInvariant(),
                SignedAmount(row.Type, row.Amount),
                row.BalanceAfter,
                row.Description ?? DescribeTransaction(row.Type),
                row.Type == TransactionType.BetPlacement
                    ? FormatTicket(row.Id)
                    : row.Reference,
                row.CreatedAt,
                row.CompletedAt))
            .ToList();
    }

    private static decimal SignedAmount(TransactionType type, decimal amount) =>
        type is TransactionType.Withdrawal or TransactionType.BetPlacement
            ? -Math.Abs(amount)
            : amount;

    private static string ResolveStatus(
        TransactionStatus transactionStatus,
        SettlementResult? settlementResult)
    {
        if (transactionStatus == TransactionStatus.Cancelled) return "cancelled";
        if (transactionStatus == TransactionStatus.Failed) return "lost";

        return settlementResult switch
        {
            SettlementResult.Won => "won",
            SettlementResult.Lost => "lost",
            SettlementResult.Void or SettlementResult.Push => "cancelled",
            _ => "pending",
        };
    }

    private static string? TryReadBetId(string? reference)
    {
        if (string.IsNullOrWhiteSpace(reference)) return null;

        const string marker = "-bet-";
        var markerIndex = reference.LastIndexOf(marker, StringComparison.OrdinalIgnoreCase);
        if (markerIndex < 0) return null;

        var candidate = reference[(markerIndex + marker.Length)..].Trim();
        return Guid.TryParse(candidate, out var id) ? id.ToString("N") : null;
    }

    private static string FormatTicket(Guid id) =>
        $"#{id.ToString("N")[..8].ToUpperInvariant()}";

    private static decimal RoundMoney(decimal value) =>
        Math.Round(value, 2, MidpointRounding.AwayFromZero);

    private static string DescribeTransaction(TransactionType type) => type switch
    {
        TransactionType.Deposit => "Depósito",
        TransactionType.Withdrawal => "Retiro",
        TransactionType.BetPlacement => "Apuesta",
        TransactionType.BetSettlement => "Liquidación",
        TransactionType.BetCancellation => "Reembolso",
        TransactionType.Bonus => "Bono",
        TransactionType.Adjustment => "Ajuste",
        _ => "Movimiento",
    };

    private sealed record BetProjection(
        Guid Id,
        decimal Stake,
        DateTimeOffset PlacedAt,
        TransactionStatus TransactionStatus,
        string EventName,
        string SelectionName,
        string MarketName,
        decimal Odds,
        SettlementResult? SettlementResult);

    private sealed record SettlementProjection(
        string? ReferenceId,
        decimal Amount,
        DateTimeOffset CreatedAt,
        DateTimeOffset? CompletedAt);

    private sealed record TransactionProjection(
        Guid Id,
        TransactionType Type,
        TransactionStatus Status,
        decimal Amount,
        decimal BalanceAfter,
        string? Description,
        string? Reference,
        DateTimeOffset CreatedAt,
        DateTimeOffset? CompletedAt);
}
