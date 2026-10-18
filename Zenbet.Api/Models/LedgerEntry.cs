namespace Zenbet.Api.Models;

public class LedgerEntry
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string EventId { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public decimal Odds { get; set; }
    public string Status { get; set; } = "placed";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
