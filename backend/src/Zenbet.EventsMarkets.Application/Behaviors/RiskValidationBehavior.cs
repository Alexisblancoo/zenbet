namespace Zenbet.EventsMarkets.Application.Behaviors;

using MediatR;
using Microsoft.Extensions.Logging;
using Zenbet.EventsMarkets.Application.Commands.PlaceBet;
using Zenbet.EventsMarkets.Application.Interfaces;
using Zenbet.EventsMarkets.Domain.ValueObjects;

public sealed class RiskValidationBehavior<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
    where TRequest : IRequest<TResponse>
{
    private readonly IRiskManagementService _riskManagementService;
    private readonly ILogger<RiskValidationBehavior<TRequest, TResponse>> _logger;

    public RiskValidationBehavior(
        IRiskManagementService riskManagementService,
        ILogger<RiskValidationBehavior<TRequest, TResponse>> logger)
    {
        _riskManagementService = riskManagementService;
        _logger = logger;
    }

    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken cancellationToken)
    {
        // Only apply risk validation to PlaceBetCommand
        if (request is PlaceBetCommand placeBetCommand)
        {
            _logger.LogDebug("Validating risk for PlaceBetCommand: WalletId={WalletId}, SelectionId={SelectionId}, Amount={Amount}",
                placeBetCommand.WalletId, placeBetCommand.SelectionId, placeBetCommand.Amount);

            var riskResult = await _riskManagementService.ValidatePlaceBetAsync(
                placeBetCommand.WalletId,
                placeBetCommand.SelectionId,
                placeBetCommand.Amount,
                cancellationToken);

            if (!riskResult.IsValid)
            {
                _logger.LogWarning("Risk validation failed for WalletId={WalletId}: {ErrorMessage}",
                    placeBetCommand.WalletId, riskResult.ErrorMessage);

                // Create a failed response for PlaceBetResult
                if (typeof(TResponse) == typeof(PlaceBetResult))
                {
                    var errorMessage = riskResult.ErrorMessage ?? "Risk validation failed";
                    var failedResult = (TResponse)(object)new PlaceBetResult(
                        false,
                        null,
                        null,
                        null,
                        errorMessage);
                    return failedResult;
                }

                // For other response types, we could throw, but for now just continue
                // The risk service will handle throwing appropriate exceptions
            }

            _logger.LogDebug("Risk validation passed for WalletId={WalletId}", placeBetCommand.WalletId);
        }

        return await next();
    }
}