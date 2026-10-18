using Microsoft.AspNetCore.Mvc;
using Zenbet.Api.Engines;
using Zenbet.Api.Models;

namespace Zenbet.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class BetController : ControllerBase
{
    private readonly IShadowBanningEngine _shadowBanningEngine;
    private readonly IBetEngine _betEngine;
    private readonly ILogger<BetController> _logger;

    public BetController(
        IShadowBanningEngine shadowBanningEngine,
        IBetEngine betEngine,
        ILogger<BetController> logger)
    {
        _shadowBanningEngine = shadowBanningEngine;
        _betEngine = betEngine;
        _logger = logger;
    }

    /// <summary>
    /// Procesa una apuesta aplicando Shadow-Banning (si cuota >= 2.50) y transacción ACID pesimista en Ledger.
    /// Soporta POST en /api/bet, /api/bet/place y /api/bet/process para máxima compatibilidad.
    /// </summary>
    [HttpPost]
    [HttpPost("place")]
    [HttpPost("process")]
    public async Task<IActionResult> PlaceBet([FromBody] BetRequest request)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(new BetResponse
            {
                Status = "error",
                Message = "Parámetros de apuesta inválidos o incompletos",
                OriginalOdds = request.Odds,
                EffectiveOdds = request.Odds
            });
        }

        // Validación obligatoria de aceptación de términos legales
        if (!request.TermsAccepted)
        {
            return BadRequest(new BetResponse
            {
                Status = "error",
                Message = "Debe aceptar obligatoriamente los Términos y Condiciones y la Política de Privacidad para realizar una apuesta.",
                OriginalOdds = request.Odds,
                EffectiveOdds = request.Odds
            });
        }

        _logger.LogInformation("[BET_CONTROLLER] Petición de apuesta recibida. Usuario: {UserId}, Evento: {EventId}, Monto: {Amount}, Cuota Solicitada: {Odds}",
            request.UserId, request.EventId, request.Amount, request.Odds);

        // 1. Inyección de Shadow-Banning Engine:
        // Si odds >= 2.50 -> 1.5s delay artificial, -5% negative slippage, auditoría en audit_shadow_banned
        var shadowEvaluation = await _shadowBanningEngine.EvaluateAndApplySlippageAsync(request.UserId, request.Odds);

        // 2. Ejecución de transacción financiera ACID en BetEngine (SELECT ... FOR UPDATE, deducción y ledger)
        var executionResult = await _betEngine.ProcessBetTransactionAsync(
            request.UserId,
            request.EventId,
            request.Amount,
            shadowEvaluation.EffectiveOdds
        );

        if (!executionResult.Success)
        {
            return UnprocessableEntity(new BetResponse
            {
                Status = "error",
                Message = executionResult.Message,
                OriginalOdds = shadowEvaluation.OriginalOdds,
                EffectiveOdds = shadowEvaluation.EffectiveOdds,
                AppliedDelayMs = shadowEvaluation.AppliedDelayMs,
                ShadowBanned = shadowEvaluation.IsShadowBanned
            });
        }

        return Ok(new BetResponse
        {
            Status = "success",
            Message = shadowEvaluation.IsShadowBanned
                ? "Apuesta procesada con ajuste dinámico de cuota por volatilidad."
                : "Apuesta procesada y liquidada exitosamente en el ledger.",
            LedgerId = executionResult.LedgerId,
            NewBalance = executionResult.NewBalance,
            OriginalOdds = shadowEvaluation.OriginalOdds,
            EffectiveOdds = shadowEvaluation.EffectiveOdds,
            AppliedDelayMs = shadowEvaluation.AppliedDelayMs,
            ShadowBanned = shadowEvaluation.IsShadowBanned
        });
    }
}
