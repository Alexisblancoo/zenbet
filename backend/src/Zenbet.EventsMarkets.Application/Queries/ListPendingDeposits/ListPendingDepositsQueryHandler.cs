namespace Zenbet.EventsMarkets.Application.Queries.ListPendingDeposits;

using MediatR;
using Zenbet.EventsMarkets.Domain.Enums;
using Zenbet.EventsMarkets.Domain.Repositories;

public sealed class ListPendingDepositsQueryHandler
    : IRequestHandler<ListPendingDepositsQuery, IReadOnlyList<MyPendingDepositDto>>
{
    private readonly ITransactionRepository _transactionRepository;

    public ListPendingDepositsQueryHandler(ITransactionRepository transactionRepository)
    {
        _transactionRepository = transactionRepository;
    }

    public async Task<IReadOnlyList<MyPendingDepositDto>> Handle(
        ListPendingDepositsQuery request,
        CancellationToken cancellationToken)
    {
        var transactions = await _transactionRepository.ListPendingDepositTransactionsAsync(
            request.WalletId,
            limit: 100,
            cancellationToken);

        return transactions
            .Select(transaction => new MyPendingDepositDto(
                transaction.Id.Value,
                transaction.WalletId.Value,
                transaction.UserId.Value,
                transaction.Amount.Amount,
                DescribeMethod(transaction.Method),
                transaction.ReferenceId ?? string.Empty,
                transaction.CreatedAt))
            .ToList();
    }

    private static string DescribeMethod(PaymentMethod? method) => method switch
    {
        PaymentMethod.Qr => "qr_transfer",
        PaymentMethod.Crypto => "usdt",
        PaymentMethod.Transfer => "qr_transfer",
        _ => "qr_transfer",
    };
}
