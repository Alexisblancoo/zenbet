namespace Zenbet.EventsMarkets.Infrastructure.Persistence.Repositories;

using Microsoft.EntityFrameworkCore;
using Zenbet.EventsMarkets.Application.Common;
using Zenbet.EventsMarkets.Application.DTOs;
using Zenbet.EventsMarkets.Application.Interfaces;
using Zenbet.EventsMarkets.Domain.Enums;
using Zenbet.EventsMarkets.Domain.ValueObjects;

public sealed class AdminDepositReadRepository : IAdminDepositReadRepository
{
    private readonly EventsMarketsDbContext _dbContext;

    public AdminDepositReadRepository(EventsMarketsDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<IReadOnlyList<PendingDepositDto>> ListPendingAsync(
        CancellationToken cancellationToken = default)
    {
        var deposits = await _dbContext.Transactions
            .AsNoTracking()
            .Where(transaction => transaction.Type == TransactionType.Deposit
                && transaction.Status == TransactionStatus.Pending
                && transaction.Method != null)
            .OrderBy(transaction => transaction.CreatedAt)
            .Select(transaction => new PendingDepositProjection(
                transaction.Id.Value,
                transaction.WalletId.Value,
                transaction.UserId,
                transaction.Amount.Amount,
                transaction.Method,
                transaction.ReferenceId,
                transaction.CreatedAt))
            .ToListAsync(cancellationToken);

        if (deposits.Count == 0)
        {
            return Array.Empty<PendingDepositDto>();
        }

        var userIds = deposits
            .Select(deposit => deposit.UserId.Value)
            .Distinct()
            .ToList();

        var users = await _dbContext.UserAccounts
            .AsNoTracking()
            .Where(account => userIds.Contains(account.Id))
            .Select(account => new UserProjection(account.Id, account.Username, account.Email))
            .ToDictionaryAsync(account => account.Id, cancellationToken);

        return deposits.Select(deposit =>
        {
            users.TryGetValue(deposit.UserId.Value, out var user);

            return new PendingDepositDto(
                deposit.Id,
                deposit.WalletId,
                deposit.UserId.Value,
                user?.Username ?? string.Empty,
                user?.Email ?? string.Empty,
                deposit.Amount,
                deposit.Method is null
                    ? string.Empty
                    : DepositPaymentMethods.Describe(deposit.Method.Value),
                deposit.Reference ?? string.Empty,
                "pending",
                deposit.CreatedAt);
        }).ToList();
    }

    private sealed record PendingDepositProjection(
        Guid Id,
        Guid WalletId,
        UserId UserId,
        decimal Amount,
        PaymentMethod? Method,
        string? Reference,
        DateTimeOffset CreatedAt);

    private sealed record UserProjection(Guid Id, string Username, string Email);
}
