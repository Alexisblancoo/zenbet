namespace Zenbet.EventsMarkets.Application.Commands.Rgs;

using System.Security.Cryptography;
using System.Text;
using MediatR;
using Zenbet.EventsMarkets.Domain.ValueObjects;

public sealed record GetRgsBalanceQuery(
    WalletId WalletId,
    string ProviderId = "PRAGMATIC") : IRequest<RgsWalletResult>;

public sealed record ProcessRgsBetCommand(
    WalletId WalletId,
    Money Amount,
    string ProviderTransactionId,
    string GameId,
    string RoundId,
    string ProviderId = "PRAGMATIC") : IRequest<RgsWalletResult>;

public sealed record ProcessRgsWinCommand(
    WalletId WalletId,
    Money WinAmount,
    string ProviderTransactionId,
    string GameId,
    string RoundId,
    string? OriginalBetTransactionId = null,
    string ProviderId = "PRAGMATIC") : IRequest<RgsWalletResult>;

public sealed record ProcessRgsRollbackCommand(
    WalletId WalletId,
    string ProviderTransactionId,
    string GameId,
    string RoundId,
    string ProviderId = "PRAGMATIC") : IRequest<RgsWalletResult>;

public sealed record RgsWalletResult(
    bool Success,
    WalletId WalletId,
    decimal TotalBalance,
    decimal RealAvailable,
    decimal BonusAvailable,
    decimal RealComponent,
    decimal BonusComponent,
    string? PlatformTransactionId,
    string ProviderTransactionId,
    bool IdempotentReplay = false,
    bool TombstoneCreated = false,
    string ErrorCode = "OK",
    string? ErrorMessage = null);

internal static class RgsAdvisoryLockKey
{
    public static long ForProviderTransaction(WalletId walletId, string providerTransactionId)
    {
        var raw = $"{walletId.Value:N}:{providerTransactionId.Trim().ToUpperInvariant()}";
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(raw));
        return BitConverter.ToInt64(hash, 0);
    }

    public static long ForWallet(WalletId walletId)
    {
        return BitConverter.ToInt64(walletId.Value.ToByteArray(), 0);
    }
}

