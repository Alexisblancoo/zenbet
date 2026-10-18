namespace Zenbet.EventsMarkets.Application.Interfaces;

using Zenbet.EventsMarkets.Domain.ValueObjects;
using Zenbet.EventsMarkets.Domain.Enums;

public interface IRiskManagementService
{
    Task<RiskValidationResult> ValidatePlaceBetAsync(
        WalletId walletId,
        SelectionId selectionId,
        Money amount,
        CancellationToken cancellationToken = default);
}

public sealed record RiskValidationResult(
    bool IsValid,
    string? ErrorMessage = null,
    RiskViolationType? ViolationType = null);

public enum RiskViolationType
{
    MaxUserBetLimitExceeded,
    MaxMarketExposureExceeded,
    InsufficientFunds
}