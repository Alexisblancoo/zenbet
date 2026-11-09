namespace Zenbet.EventsMarkets.Application.Behaviors;

using MediatR;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Zenbet.EventsMarkets.Application.Commands.PlaceBet;
using Zenbet.EventsMarkets.Domain.Repositories;

/// <summary>
/// Opciones de apuestas. <see cref="AllowReferenceLines"/> solo debe activarse en demostraciones locales.
/// </summary>
public sealed class BettingOptions
{
    public const string SectionName = "Betting";

    /// <summary>
    /// Permite apostar sobre líneas "de referencia" (procedencia Model), que la propia API rotula como no ejecutables.
    /// Por defecto NO: con dinero real solo se apuesta a cuotas fijadas por el operador o de una fuente publicada.
    /// </summary>
    public bool AllowReferenceLines { get; set; }
}

/// <summary>
/// Rechaza apuestas sobre mercados cuya cuota es solo una línea de referencia. Se ejecuta antes de abrir
/// transacciones, así que no consume conexiones ni bloqueos.
/// </summary>
public sealed class ExecutableMarketBehavior<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
    where TRequest : IRequest<TResponse>
{
    public const string ErrorCode = "REFERENCE_LINE_NOT_BETTABLE";

    private readonly IMarketRepository _marketRepository;
    private readonly IOptions<BettingOptions> _options;
    private readonly ILogger<ExecutableMarketBehavior<TRequest, TResponse>> _logger;

    public ExecutableMarketBehavior(
        IMarketRepository marketRepository,
        IOptions<BettingOptions> options,
        ILogger<ExecutableMarketBehavior<TRequest, TResponse>> logger)
    {
        _marketRepository = marketRepository;
        _options = options;
        _logger = logger;
    }

    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken cancellationToken)
    {
        if (request is not PlaceBetCommand placeBet ||
            _options.Value.AllowReferenceLines ||
            typeof(TResponse) != typeof(PlaceBetResult))
        {
            return await next();
        }

        var market = await _marketRepository.GetBySelectionIdAsync(placeBet.SelectionId, cancellationToken);
        if (market is null || market.IsExecutable)
        {
            return await next();
        }

        _logger.LogWarning(
            "Apuesta rechazada: el mercado {MarketId} solo tiene una línea de referencia (no ejecutable).",
            market.Id.Value);

        var rejected = new PlaceBetResult(
            false,
            null,
            null,
            null,
            "Esta cuota es una línea de referencia y todavía no admite apuestas.",
            ErrorCode: ErrorCode);

        return (TResponse)(object)rejected;
    }
}
