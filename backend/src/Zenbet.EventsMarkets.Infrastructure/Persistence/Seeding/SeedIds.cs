namespace Zenbet.EventsMarkets.Infrastructure.Persistence.Seeding;

using System.Security.Cryptography;
using System.Text;

/// <summary>
/// GUID deterministas para que un seed repetido no cree eventos, mercados o
/// selecciones nuevas y para que los enlaces de la UI sean estables.
/// </summary>
internal static class SeedIds
{
    private const string Namespace = "zenbet-ufc-seed-v1:";

    public static Guid For(string value)
    {
        var bytes = Encoding.UTF8.GetBytes(Namespace + value);
        var hash = SHA1.HashData(bytes);
        var guidBytes = new byte[16];
        Array.Copy(hash, guidBytes, guidBytes.Length);

        // Variante RFC 4122 versión 5 (SHA-1 con espacio de nombres propio).
        guidBytes[7] = (byte)((guidBytes[7] & 0x0F) | 0x50);
        guidBytes[8] = (byte)((guidBytes[8] & 0x3F) | 0x80);

        return new Guid(guidBytes);
    }
}
