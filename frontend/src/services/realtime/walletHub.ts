import {
  HubConnectionBuilder,
  LogLevel,
  type HubConnection,
} from '@microsoft/signalr';

import { API_BASE_URL, authToken } from '@/api';

import { oddsHubRetryPolicy } from './oddsHub';

/**
 * Canal privado de la billetera (SignalR).
 *
 * El hub vive en `/wallet-hub` y exige sesión: el servidor direcciona el
 * empuje `SaldoActualizado` por el claim `wallet_id` del token, así que cada
 * jugador recibe únicamente los movimientos de su propia cuenta.
 */

export const WALLET_HUB_PATH = '/wallet-hub';

/** Eventos servidor → cliente. */
export const WALLET_HUB_EVENTS = {
  /** Depósito acreditado / movimiento de saldo aprobado por administración. */
  saldoActualizado: 'SaldoActualizado',
} as const;

export const WALLET_HUB_URL: string = (() => {
  const override = import.meta.env.VITE_HUB_URL?.trim();
  if (override) {
    // El override de .env es compartido con el hub de cuotas (`/odds-hub`):
    // reescribe su sufijo para apuntar al canal de wallet.
    if (/odds-hub\/?$/i.test(override)) {
      return override.replace(/odds-hub\/?$/i, 'wallet-hub');
    }
    return override.replace(/\/+$/, '');
  }

  try {
    return new URL(WALLET_HUB_PATH, API_BASE_URL).href;
  } catch {
    return WALLET_HUB_PATH;
  }
})();

/** Payload de `SaldoActualizado`. */
export interface WalletBalanceUpdate {
  readonly walletId: string;
  readonly userId: string;
  readonly amount: number;
  readonly newBalance: number;
  readonly transactionId: string;
  readonly timestamp: string;
}

/**
 * El `accessTokenFactory` se evalúa en cada (re)conexión: el token viaja en el
 * query string del negotiate porque el handshake WebSocket no puede enviar
 * headers (`?access_token=…`).
 */
export function createWalletHubConnection(): HubConnection {
  return new HubConnectionBuilder()
    .withUrl(WALLET_HUB_URL, {
      accessTokenFactory: () => authToken.get() ?? '',
      withCredentials: false,
    })
    .withAutomaticReconnect(oddsHubRetryPolicy)
    .configureLogging(import.meta.env.DEV ? LogLevel.Warning : LogLevel.Error)
    .build();
}
