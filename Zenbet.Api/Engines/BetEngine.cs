using System.Data;
using Npgsql;
using Zenbet.Api.Data;
using Zenbet.Api.Models;

namespace Zenbet.Api.Engines;

public class BetEngine : IBetEngine
{
    private readonly DbConnectionFactory _connectionFactory;
    private readonly ILogger<BetEngine> _logger;

    public BetEngine(DbConnectionFactory connectionFactory, ILogger<BetEngine> logger)
    {
        _connectionFactory = connectionFactory;
        _logger = logger;
    }

    public async Task<BetExecutionResult> ProcessBetTransactionAsync(int userId, string eventId, decimal amount, decimal odds)
    {
        if (amount <= 0)
        {
            return new BetExecutionResult
            {
                Success = false,
                Message = "El monto de la apuesta debe ser estrictamente mayor a 0."
            };
        }

        if (odds < 1.0m)
        {
            return new BetExecutionResult
            {
                Success = false,
                Message = "La cuota de la apuesta no puede ser menor a 1.00."
            };
        }

        await using var connection = await _connectionFactory.CreateOpenConnectionAsync();

        // 1. Iniciar transacción ACID atómica con nivel de aislamiento ReadCommitted
        await using var transaction = await connection.BeginTransactionAsync(IsolationLevel.ReadCommitted);

        try
        {
            // 2. Bloqueo pesimista de fila: SELECT balance FROM usuarios WHERE id = @id FOR UPDATE
            const string lockUserQuery = @"
                SELECT balance 
                FROM usuarios 
                WHERE id = @id 
                FOR UPDATE;
            ";

            await using var lockCommand = new NpgsqlCommand(lockUserQuery, connection, transaction);
            lockCommand.Parameters.AddWithValue("id", userId);

            var balanceResult = await lockCommand.ExecuteScalarAsync();

            if (balanceResult == null || balanceResult == DBNull.Value)
            {
                await transaction.RollbackAsync();
                _logger.LogWarning("[BET_ENGINE] Transacción abortada: Usuario {UserId} no existe en la base de datos.", userId);
                return new BetExecutionResult
                {
                    Success = false,
                    Message = "Usuario no encontrado."
                };
            }

            decimal currentBalance = Convert.ToDecimal(balanceResult);

            // 3. Validación estricta de saldo
            if (currentBalance < amount)
            {
                await transaction.RollbackAsync();
                _logger.LogWarning("[BET_ENGINE] Transacción abortada por saldo insuficiente. Usuario {UserId}: Saldo={Balance}, Monto={Amount}",
                    userId, currentBalance, amount);

                return new BetExecutionResult
                {
                    Success = false,
                    Message = $"Saldo insuficiente. Balance actual: ${currentBalance:N2}, Monto requerido: ${amount:N2}"
                };
            }

            // 4. Descuento atómico del saldo
            const string deductBalanceQuery = @"
                UPDATE usuarios 
                SET balance = balance - @amount 
                WHERE id = @id 
                RETURNING balance;
            ";

            await using var deductCommand = new NpgsqlCommand(deductBalanceQuery, connection, transaction);
            deductCommand.Parameters.AddWithValue("amount", amount);
            deductCommand.Parameters.AddWithValue("id", userId);

            var updatedBalanceResult = await deductCommand.ExecuteScalarAsync();
            decimal newBalance = Convert.ToDecimal(updatedBalanceResult);

            // 5. Registro inmutable en la tabla ledger
            const string insertLedgerQuery = @"
                INSERT INTO ledger (user_id, event_id, amount, odds, status, created_at)
                VALUES (@userId, @eventId, @amount, @odds, 'placed', NOW())
                RETURNING id;
            ";

            await using var ledgerCommand = new NpgsqlCommand(insertLedgerQuery, connection, transaction);
            ledgerCommand.Parameters.AddWithValue("userId", userId);
            ledgerCommand.Parameters.AddWithValue("eventId", eventId);
            ledgerCommand.Parameters.AddWithValue("amount", amount);
            ledgerCommand.Parameters.AddWithValue("odds", odds);

            var ledgerIdResult = await ledgerCommand.ExecuteScalarAsync();
            int ledgerId = Convert.ToInt32(ledgerIdResult);

            // 6. Confirmación de la transacción (COMMIT)
            await transaction.CommitAsync();

            _logger.LogInformation("[BET_ENGINE] Apuesta ACID confirmada con éxito. LedgerId: {LedgerId}, Usuario: {UserId}, NuevoBalance: {NewBalance}",
                ledgerId, userId, newBalance);

            return new BetExecutionResult
            {
                Success = true,
                Message = "Apuesta procesada y liquidada atómicamente en el ledger.",
                LedgerId = ledgerId,
                NewBalance = newBalance
            };
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            _logger.LogError(ex, "[BET_ENGINE] Error de transacción ACID al procesar apuesta para usuario {UserId}: {Message}",
                userId, ex.Message);

            return new BetExecutionResult
            {
                Success = false,
                Message = $"Error interno en la transacción financiera: {ex.Message}"
            };
        }
    }
}
