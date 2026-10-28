namespace Zenbet.EventsMarkets.Api.Services;

using System.Security.Claims;
using Microsoft.AspNetCore.SignalR;

/// <summary>
/// Direccionamiento por jugador: la conexión de SignalR se identifica con el
/// claim <c>wallet_id</c> del token, de modo que <c>Clients.User(walletId)</c>
/// solo alcance la sesión del dueño de la billetera.
/// </summary>
public sealed class WalletUserIdProvider : IUserIdProvider
{
    public string? GetUserId(HubConnectionContext connection) =>
        connection.User?.FindFirstValue("wallet_id");
}
