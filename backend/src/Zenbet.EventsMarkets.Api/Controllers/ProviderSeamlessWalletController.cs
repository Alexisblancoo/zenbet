namespace Zenbet.EventsMarkets.Api.Controllers;

using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Zenbet.EventsMarkets.Application.Commands.Rgs;
using Zenbet.EventsMarkets.Domain.ValueObjects;

/// <summary>
/// Controlador oficial de Integración RGS (Remote Game Server) mediante arquitectura "Seamless Wallet"
/// para proveedores externos de Casino (ej. Pragmatic Play, Evolution).
/// Todas las rutas bajo <c>/api/rgs/*</c> están protegidas por <see cref="Authentication.RgsAuthenticationMiddleware"/>
/// mediante firmas HMAC-SHA256 en el encabezado <c>X-Provider-Signature</c>.
/// </summary>
[ApiController]
[Route("api/rgs")]
[AllowAnonymous] // Autenticado perimetralmente por RgsAuthenticationMiddleware vía HMAC-SHA256
[Produces("application/json")]
public sealed class ProviderSeamlessWalletController : ControllerBase
{
    private readonly IMediator _mediator;

    public ProviderSeamlessWalletController(IMediator mediator)
    {
        _mediator = mediator;
    }

    /// <summary>
    /// Consulta el saldo unificado disponible del jugador en el motor Smart Bonus Ledger.
    /// </summary>
    /// <remarks>
    /// Devuelve la suma de <c>RealAvailable</c> + <c>BonusAvailable</c> junto con su desglose contable
    /// para que el servidor de juego remoto (RGS) autorice giros o rondas en tiempo real.
    /// </remarks>
    /// <param name="request">Identificador de la billetera y metadatos del proveedor RGS.</param>
    /// <param name="cancellationToken">Token de cancelación de la petición HTTP.</param>
    /// <response code="200">Saldo consultado exitosamente.</response>
    /// <response code="401">Firma HMAC-SHA256 ausente o inválida en <c>X-Provider-Signature</c>.</response>
    /// <response code="404">La billetera solicitada no existe.</response>
    [HttpPost("balance")]
    [ProducesResponseType(typeof(RgsSeamlessWalletResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(RgsSeamlessWalletResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetBalance(
        [FromBody] RgsBalanceRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(
            new GetRgsBalanceQuery(
                WalletId.From(request.WalletId),
                request.ProviderId ?? "PRAGMATIC"),
            cancellationToken);

        var response = MapResponse(result, request.Currency);
        return result.ErrorCode == "WALLET_NOT_FOUND"
            ? NotFound(response)
            : Ok(response);
    }

    /// <summary>
    /// Deduce fondos por una apuesta de casino aplicando la política "Real-First" e Idempotencia Estricta.
    /// </summary>
    /// <remarks>
    /// Consume primero el saldo <c>RealAvailable</c> y cubre cualquier faltante con <c>BonusAvailable</c>.
    /// Registra la proporción exacta (<c>RealStake</c> y <c>BonusStake</c>) asociada al <c>ProviderTransactionId</c>
    /// bajo <c>pg_advisory_xact_lock</c>. Si el proveedor reintenta el mismo <c>ProviderTransactionId</c>,
    /// devuelve la respuesta previa sin duplicar el cargo. Si existe un Tombstone previo, rechaza el cobro tardío.
    /// </remarks>
    /// <param name="request">Datos del cargo de apuesta enviado por el proveedor RGS.</param>
    /// <param name="cancellationToken">Token de cancelación de la petición HTTP.</param>
    /// <response code="200">Apuesta procesada (o reintento idempotente) exitosamente.</response>
    /// <response code="401">Firma HMAC-SHA256 ausente o inválida.</response>
    /// <response code="422">Fondos insuficientes o apuesta previamente anulada por Tombstone.</response>
    [HttpPost("bet")]
    [ProducesResponseType(typeof(RgsSeamlessWalletResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(RgsSeamlessWalletResponse), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> PlaceBet(
        [FromBody] RgsBetRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(
            new ProcessRgsBetCommand(
                WalletId.From(request.WalletId),
                new Money(request.Amount),
                request.ProviderTransactionId,
                request.GameId,
                request.RoundId,
                request.ProviderId ?? "PRAGMATIC"),
            cancellationToken);

        var response = MapResponse(result, request.Currency);
        return result.Success
            ? Ok(response)
            : UnprocessableEntity(response);
    }

    /// <summary>
    /// Acredita ganancias de una ronda de casino con distribución proporcional (Real / Bono).
    /// </summary>
    /// <remarks>
    /// Inspecciona la apuesta original de la ronda (<c>OriginalBetTransactionId</c> o <c>RoundId</c>).
    /// Si la apuesta fue mixta (ej. 80% Real, 20% Bono), distribuye el premio en esa misma proporción
    /// exacta hacia <c>RealAvailable</c> y <c>BonusAvailable</c>, evaluando además la conversión automática
    /// de Rollover si se alcanzó el 100% de <c>WageringRequirement</c> respetando <c>MaxConversion</c>.
    /// </remarks>
    /// <param name="request">Datos del premio a acreditar enviados por el proveedor RGS.</param>
    /// <param name="cancellationToken">Token de cancelación de la petición HTTP.</param>
    /// <response code="200">Ganancia acreditada (o reintento idempotente) exitosamente.</response>
    /// <response code="401">Firma HMAC-SHA256 ausente o inválida.</response>
    [HttpPost("win")]
    [ProducesResponseType(typeof(RgsSeamlessWalletResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> CreditWin(
        [FromBody] RgsWinRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(
            new ProcessRgsWinCommand(
                WalletId.From(request.WalletId),
                new Money(request.Amount),
                request.ProviderTransactionId,
                request.GameId,
                request.RoundId,
                request.OriginalBetTransactionId,
                request.ProviderId ?? "PRAGMATIC"),
            cancellationToken);

        var response = MapResponse(result, request.Currency);
        return result.Success
            ? Ok(response)
            : UnprocessableEntity(response);
    }

    /// <summary>
    /// Revierte una apuesta previa o registra un registro "Tombstone" ante timeouts del proveedor RGS.
    /// </summary>
    /// <remarks>
    /// Implementa el patrón <b>Tombstone</b>:
    /// <list type="bullet">
    /// <item><description>Si la apuesta original existe, reintegra exactamente <c>RealStake</c> a <c>RealAvailable</c> y <c>BonusStake</c> a <c>BonusAvailable</c>.</description></item>
    /// <item><description>Si la apuesta original nunca llegó a ZenBet por timeout de red, inserta una transacción Tombstone con el <c>ProviderTransactionId</c> para bloquear cualquier llegada tardía de <c>POST /api/rgs/bet</c>.</description></item>
    /// </list>
    /// </remarks>
    /// <param name="request">Identificador de la transacción del proveedor a anular.</param>
    /// <param name="cancellationToken">Token de cancelación de la petición HTTP.</param>
    /// <response code="200">Rollback aplicado o Tombstone registrado de forma idempotente.</response>
    /// <response code="401">Firma HMAC-SHA256 ausente o inválida.</response>
    [HttpPost("rollback")]
    [ProducesResponseType(typeof(RgsSeamlessWalletResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> RollbackBet(
        [FromBody] RgsRollbackRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(
            new ProcessRgsRollbackCommand(
                WalletId.From(request.WalletId),
                request.ProviderTransactionId,
                request.GameId,
                request.RoundId,
                request.ProviderId ?? "PRAGMATIC"),
            cancellationToken);

        var response = MapResponse(result, request.Currency);
        return result.Success
            ? Ok(response)
            : NotFound(response);
    }

    private static RgsSeamlessWalletResponse MapResponse(RgsWalletResult result, string? currency) =>
        new(
            Success: result.Success,
            WalletId: result.WalletId.Value,
            TotalBalance: result.TotalBalance,
            RealAvailable: result.RealAvailable,
            BonusAvailable: result.BonusAvailable,
            RealComponent: result.RealComponent,
            BonusComponent: result.BonusComponent,
            Currency: string.IsNullOrWhiteSpace(currency) ? "USD" : currency.Trim().ToUpperInvariant(),
            PlatformTransactionId: result.PlatformTransactionId,
            ProviderTransactionId: result.ProviderTransactionId,
            IdempotentReplay: result.IdempotentReplay,
            TombstoneCreated: result.TombstoneCreated,
            ErrorCode: result.ErrorCode,
            ErrorMessage: result.ErrorMessage,
            Timestamp: DateTimeOffset.UtcNow);
}

/// <summary>Solicitud de consulta de saldo RGS Seamless Wallet.</summary>
public sealed record RgsBalanceRequest(
    Guid WalletId,
    string? ProviderId = "PRAGMATIC",
    string? Currency = "USD");

/// <summary>Solicitud de cargo de apuesta RGS Seamless Wallet con consumo Real-First.</summary>
public sealed record RgsBetRequest(
    Guid WalletId,
    decimal Amount,
    string ProviderTransactionId,
    string GameId,
    string RoundId,
    string? ProviderId = "PRAGMATIC",
    string? Currency = "USD");

/// <summary>Solicitud de acreditación de premio RGS Seamless Wallet con pago proporcional.</summary>
public sealed record RgsWinRequest(
    Guid WalletId,
    decimal Amount,
    string ProviderTransactionId,
    string GameId,
    string RoundId,
    string? OriginalBetTransactionId = null,
    string? ProviderId = "PRAGMATIC",
    string? Currency = "USD");

/// <summary>Solicitud de reversión (Rollback / Tombstone) de transacción RGS Seamless Wallet.</summary>
public sealed record RgsRollbackRequest(
    Guid WalletId,
    string ProviderTransactionId,
    string GameId,
    string RoundId,
    string? ProviderId = "PRAGMATIC",
    string? Currency = "USD");

/// <summary>Respuesta estandarizada del motor RGS Seamless Wallet de ZenBet.</summary>
public sealed record RgsSeamlessWalletResponse(
    bool Success,
    Guid WalletId,
    decimal TotalBalance,
    decimal RealAvailable,
    decimal BonusAvailable,
    decimal RealComponent,
    decimal BonusComponent,
    string Currency,
    string? PlatformTransactionId,
    string ProviderTransactionId,
    bool IdempotentReplay,
    bool TombstoneCreated,
    string ErrorCode,
    string? ErrorMessage,
    DateTimeOffset Timestamp);

