namespace Zenbet.Api.Models;

public class CryptoDeposit
{
    public int Id { get; set; }
    public string TxId { get; set; } = string.Empty;
    public string FromAddr { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string Status { get; set; } = "confirmed";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
