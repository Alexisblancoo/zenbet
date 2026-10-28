namespace Zenbet.EventsMarkets.Api.Hubs;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

/// <summary>
/// Canal privado de saldo. El destinatario se resuelve con
/// <c>WalletUserIdProvider</c> (claim <c>wallet_id</c>), así que el hub no
/// expone métodos ni grupos: solo recibe <c>SaldoActualizado</c>.
/// </summary>
[Authorize]
public sealed class WalletHub : Hub
{
}
