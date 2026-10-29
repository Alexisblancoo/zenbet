namespace Zenbet.EventsMarkets.Application.Common;

using Zenbet.EventsMarkets.Domain.Enums;

public static class DepositPaymentMethods
{
    public static string Describe(PaymentMethod method) => method switch
    {
        PaymentMethod.Qr => "QR",
        PaymentMethod.Crypto => "Cripto",
        PaymentMethod.Transfer => "Transferencia",
        _ => method.ToString(),
    };
}
