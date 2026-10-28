namespace Zenbet.EventsMarkets.Application.Commands.CreateDeposit;

using Zenbet.EventsMarkets.Domain.Enums;

public static class DepositPaymentMethods
{
    public static bool TryParse(string? value, out PaymentMethod method)
    {
        switch ((value ?? string.Empty).Trim().ToLowerInvariant())
        {
            case "qr":
                method = PaymentMethod.Qr;
                return true;
            case "cripto":
            case "crypto":
                method = PaymentMethod.Crypto;
                return true;
            case "transferencia":
            case "transferencia local":
            case "transferencia_local":
            case "transfer":
            case "local":
                method = PaymentMethod.Transfer;
                return true;
            default:
                method = default;
                return false;
        }
    }

    public static string Describe(PaymentMethod method) => method switch
    {
        PaymentMethod.Qr => "QR",
        PaymentMethod.Crypto => "Cripto",
        PaymentMethod.Transfer => "Transferencia",
        _ => method.ToString(),
    };
}
