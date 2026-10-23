namespace Zenbet.EventsMarkets.Infrastructure.Security;

using System.Security.Cryptography;
using Zenbet.EventsMarkets.Application.Interfaces;

/// <summary>
/// PBKDF2-HMAC-SHA256 con sal aleatoria por contraseña. El formato versionado
/// permite rotar iteraciones sin invalidar hashes existentes.
/// </summary>
public sealed class Pbkdf2PasswordHasher : IPasswordHasher
{
    private const string Scheme = "pbkdf2-sha256";
    private const int SaltSize = 16;
    private const int KeySize = 32;
    private const int Iterations = 210_000;

    public string Hash(string password)
    {
        ArgumentNullException.ThrowIfNull(password);

        var salt = RandomNumberGenerator.GetBytes(SaltSize);
        var key = Rfc2898DeriveBytes.Pbkdf2(
            password,
            salt,
            Iterations,
            HashAlgorithmName.SHA256,
            KeySize);

        return string.Join(
            '$',
            Scheme,
            Iterations.ToString(System.Globalization.CultureInfo.InvariantCulture),
            Convert.ToBase64String(salt),
            Convert.ToBase64String(key));
    }

    public bool Verify(string password, string passwordHash)
    {
        if (string.IsNullOrEmpty(password) || string.IsNullOrWhiteSpace(passwordHash))
            return false;

        var parts = passwordHash.Split('$');
        if (parts.Length != 4 || parts[0] != Scheme)
            return false;

        if (!int.TryParse(
                parts[1],
                System.Globalization.NumberStyles.None,
                System.Globalization.CultureInfo.InvariantCulture,
                out var iterations) ||
            iterations <= 0)
        {
            return false;
        }

        try
        {
            var salt = Convert.FromBase64String(parts[2]);
            var expected = Convert.FromBase64String(parts[3]);
            var actual = Rfc2898DeriveBytes.Pbkdf2(
                password,
                salt,
                iterations,
                HashAlgorithmName.SHA256,
                expected.Length);

            return CryptographicOperations.FixedTimeEquals(actual, expected);
        }
        catch (FormatException)
        {
            return false;
        }
    }
}
