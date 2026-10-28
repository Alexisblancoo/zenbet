namespace Zenbet.EventsMarkets.Application.Commands.RejectDeposit;

using MediatR;
using Zenbet.EventsMarkets.Domain.ValueObjects;

/// <summary>
/// Rechazo administrativo de un depósito pendiente: no mueve saldo; marca la
/// transacción como rechazada con su motivo.
/// </summary>
public sealed record RejectDepositCommand(TransactionId TransactionId, string? Reason)
    : IRequest<RejectDepositResult>;

public sealed record RejectDepositResult(
    bool Success,
    string? ErrorMessage);
