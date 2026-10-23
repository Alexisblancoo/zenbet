namespace Zenbet.EventsMarkets.Application.DTOs;

/// <summary>
/// Movimiento firmado de la billetera. El importe positivo entra a la cuenta y
/// el negativo sale de ella, de modo que la UI no tenga que reinterpretar el
/// tipo de transacción para pintar el signo.
/// </summary>
public sealed record WalletTransactionDto(
    Guid Id,
    string Type,
    string Status,
    decimal Amount,
    decimal BalanceAfter,
    string Description,
    string? Reference,
    DateTimeOffset CreatedAt,
    DateTimeOffset? CompletedAt);

/// <summary>
/// Apuesta materializada desde el cargo de billetera y su selección. El
/// historial actual registra apuestas simples; el contrato deja espacio para
/// combinadas futuras mediante <see cref="Type"/> y <see cref="Legs"/>.
/// </summary>
public sealed record WalletBetDto(
    Guid Id,
    Guid TransactionId,
    string Ticket,
    string EventName,
    string SelectionName,
    string MarketLabel,
    string Type,
    int Legs,
    decimal Stake,
    decimal Odds,
    decimal PotentialPayout,
    decimal? Payout,
    string Status,
    DateTimeOffset PlacedAt,
    DateTimeOffset? SettledAt);

/// <summary>
/// Read model completo de la billetera del jugador autenticado.
/// </summary>
public sealed record WalletDashboardDto(
    string Currency,
    decimal Balance,
    IReadOnlyList<WalletBetDto> Bets,
    IReadOnlyList<WalletTransactionDto> Transactions,
    DateTimeOffset UpdatedAt);
