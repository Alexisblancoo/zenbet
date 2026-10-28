namespace Zenbet.EventsMarkets.Application.Commands.RequestDeposit;

using MediatR;
using Zenbet.EventsMarkets.Domain.Enums;
using Zenbet.EventsMarkets.Domain.ValueObjects;

/// <summary>
/// Solicitud de depósito del jugador: se registra como transacción PENDING
/// con su número de comprobante y queda a la espera de aprobación de
/// administración. El saldo NO se mueve aquí.
/// </summary>
public sealed record RequestDepositCommand(
    WalletId WalletId,
    Money Amount,
    PaymentMethod Method,
    string Reference,
    Guid IdempotencyKey) : IRequest<RequestDepositResult>;

public sealed record RequestDepositResult(
    bool Success,
    TransactionId? TransactionId,
    string? Reference,
    decimal? Amount,
    PaymentMethod? Method,
    DateTimeOffset? CreatedAt,
    string? ErrorMessage);
