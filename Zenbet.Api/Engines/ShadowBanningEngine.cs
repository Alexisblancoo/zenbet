using Npgsql;
using Zenbet.Api.Data;
using Zenbet.Api.Models;

namespace Zenbet.Api.Engines;

public class ShadowBanningEngine : IShadowBanningEngine
{
    private readonly DbConnectionFactory _connectionFactory;
    private readonly ILogger<ShadowBanningEngine> _logger;

    public ShadowBanningEngine(DbConnectionFactory connectionFactory, ILogger<ShadowBanningEngine> logger)
    {
        _connectionFactory = connectionFactory;
        _logger = logger;
    }

    public async Task<ShadowBanEvaluation> EvaluateAndApplySlippageAsync(int userId, decimal odds)
    {
        // Regla Arquitectónica: Si la cuota (odds) es >= 2.50:
        // 1. Aplica 1.5s de latencia artificial.
        // 2. Aplica negative slippage del 5% sobre las cuotas (odds * 0.95).
        // 3. Registra el evento en la tabla audit_shadow_banned de PostgreSQL.
        if (odds >= 2.50m)
        {
            const int delayMs = 1500;
            _logger.LogWarning("[SHADOW_BAN] Alerta de cuota alta ({Odds} >= 2.50) para usuario {UserId}. Inyectando {DelayMs}ms de latencia y 5% negative slippage.",
                odds, userId, delayMs);

            // Inyección de latencia artificial de 1.5s
            await Task.Delay(delayMs);

            // Negative slippage del 5%
            decimal effectiveOdds = Math.Round(odds * 0.95m, 4, MidpointRounding.AwayFromZero);
            if (effectiveOdds < 1.01m)
            {
                effectiveOdds = 1.01m;
            }

            // Registro en la tabla audit_shadow_banned de PostgreSQL
            try
            {
                await using var connection = await _connectionFactory.CreateOpenConnectionAsync();
                const string auditSql = @"
                    INSERT INTO audit_shadow_banned (user_id, original_odds, effective_odds, applied_delay_ms, created_at)
                    VALUES (@userId, @originalOdds, @effectiveOdds, @appliedDelayMs, NOW());
                ";

                await using var command = new NpgsqlCommand(auditSql, connection);
                command.Parameters.AddWithValue("userId", userId);
                command.Parameters.AddWithValue("originalOdds", odds);
                command.Parameters.AddWithValue("effectiveOdds", effectiveOdds);
                command.Parameters.AddWithValue("appliedDelayMs", delayMs);

                await command.ExecuteNonQueryAsync();
                _logger.LogInformation("[SHADOW_BAN] Auditoría persistida en audit_shadow_banned. Cuota original: {Original}, Cuota efectiva: {Effective}",
                    odds, effectiveOdds);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[SHADOW_BAN] Error al persistir auditoría en PostgreSQL para usuario {UserId}: {Message}",
                    userId, ex.Message);
            }

            return new ShadowBanEvaluation
            {
                OriginalOdds = odds,
                EffectiveOdds = effectiveOdds,
                AppliedDelayMs = delayMs,
                IsShadowBanned = true
            };
        }

        // Si la cuota es menor a 2.50, no se aplica delay ni deslizamiento
        return new ShadowBanEvaluation
        {
            OriginalOdds = odds,
            EffectiveOdds = odds,
            AppliedDelayMs = 0,
            IsShadowBanned = false
        };
    }
}
