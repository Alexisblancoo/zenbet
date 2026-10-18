namespace Zenbet.Api.Models;

public class AuditShadowBanned
{
    public int Id { get; set; }
    public int? UserId { get; set; }
    public decimal OriginalOdds { get; set; }
    public decimal EffectiveOdds { get; set; }
    public int AppliedDelayMs { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
