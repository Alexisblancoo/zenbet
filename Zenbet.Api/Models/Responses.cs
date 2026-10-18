namespace Zenbet.Api.Models;

public class UserDto
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public decimal Balance { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class AuthResponse
{
    public string Status { get; set; } = "success";
    public string Message { get; set; } = string.Empty;
    public string Token { get; set; } = string.Empty;
    public UserDto? User { get; set; }
}

public class BetResponse
{
    public string Status { get; set; } = "success";
    public string Message { get; set; } = string.Empty;
    public int? LedgerId { get; set; }
    public decimal? NewBalance { get; set; }
    public decimal OriginalOdds { get; set; }
    public decimal EffectiveOdds { get; set; }
    public int AppliedDelayMs { get; set; }
    public bool ShadowBanned { get; set; }
}

public class ShadowBanEvaluation
{
    public decimal OriginalOdds { get; set; }
    public decimal EffectiveOdds { get; set; }
    public int AppliedDelayMs { get; set; }
    public bool IsShadowBanned { get; set; }
}

public class BetExecutionResult
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public int? LedgerId { get; set; }
    public decimal? NewBalance { get; set; }
}
