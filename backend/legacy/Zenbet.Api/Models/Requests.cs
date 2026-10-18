using System.ComponentModel.DataAnnotations;

namespace Zenbet.Api.Models;

public class RegisterRequest
{
    [Required]
    [StringLength(50, MinimumLength = 3)]
    public string Username { get; set; } = string.Empty;

    [Required]
    [EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required]
    [StringLength(100, MinimumLength = 6)]
    public string Password { get; set; } = string.Empty;

    [Range(0, 1000000)]
    public decimal InitialBalance { get; set; } = 1000.00m;

    [Required]
    public bool TermsAccepted { get; set; }
}

public class LoginRequest
{
    [Required]
    public string Identifier { get; set; } = string.Empty; // Email or username

    [Required]
    public string Password { get; set; } = string.Empty;
}

public class BetRequest
{
    [Required]
    public int UserId { get; set; }

    [Required]
    public string EventId { get; set; } = string.Empty;

    [Required]
    [Range(0.01, 1000000)]
    public decimal Amount { get; set; }

    [Required]
    [Range(1.0001, 1000.0)]
    public decimal Odds { get; set; }

    public string? DeviceId { get; set; }

    public bool TermsAccepted { get; set; } = true;
}
