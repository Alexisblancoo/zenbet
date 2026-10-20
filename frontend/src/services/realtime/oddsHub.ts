import {
  HubConnectionBuilder,
  LogLevel,
  type HubConnection,
  type IRetryPolicy,
} from '@microsoft/signalr';

import { API_BASE_URL, authToken } from '@/api';

/**
 * Infraestructura del canal de cuotas en vivo (SignalR).
 *
 * El hub vive en la raíz de la API (`/odds-hub`), no bajo `VITE_API_URL`;
 * la URL se deriva del origen de la API y admite override con `VITE_HUB_URL`.
 */

export const ODDS_HUB_PATH = '/odds-hub';

/** Eventos servidor → cliente. */
export const ODDS_HUB_EVENTS = {
  oddsUpdate: 'ReceiveOddsUpdate',
  marketSettled: 'ReceiveMarketSettled',
} as const;

/** Métodos cliente → servidor (grupos por mercado/evento). */
export const ODDS_HUB_METHODS = {
  joinMarket: 'JoinMarketGroup',
  leaveMarket: 'LeaveMarketGroup',
  joinEvent: 'JoinEventGroup',
  leaveEvent: 'LeaveEventGroup',
} as const;

export const ODDS_HUB_URL: string = (() => {
  const override = import.meta.env.VITE_HUB_URL?.trim();
  if (override) return override.replace(/\/+$/, '');

  try {
    return new URL(ODDS_HUB_PATH, API_BASE_URL).href;
  } catch {
    return ODDS_HUB_PATH;
  }
})();

const RECONNECT_BASE_DELAY_MS = 1_000;
const RECONNECT_MAX_DELAY_MS = 30_000;
/** Tras esta ventana el reconector automático cede el turno al watchdog del hook. */
const RECONNECT_MAX_ELAPSED_MS = 5 * 60_000;

/**
 * Backoff exponencial con jitter (evita tormentas de reconexión):
 * 1s, 2s, 4s, … hasta 30s, y luego watchdog del hook.
 */
export const oddsHubRetryPolicy: IRetryPolicy = {
  nextRetryDelayInMilliseconds({ previousRetryCount, elapsedMilliseconds }) {
    if (elapsedMilliseconds > RECONNECT_MAX_ELAPSED_MS) return null;

    const exponential = RECONNECT_BASE_DELAY_MS * 2 ** Math.max(previousRetryCount, 0);
    const capped = Math.min(exponential, RECONNECT_MAX_DELAY_MS);
    const jitter = 0.85 + Math.random() * 0.3;

    return Math.round(capped * jitter);
  },
};

/**
 * El `accessTokenFactory` se evalúa en cada (re)conexión, por lo que una sesión
 * renovada se propaga sin reiniciar la app.
 */
export function createOddsHubConnection(): HubConnection {
  return new HubConnectionBuilder()
    .withUrl(ODDS_HUB_URL, {
      accessTokenFactory: () => authToken.get() ?? '',
      withCredentials: false,
    })
    .withAutomaticReconnect(oddsHubRetryPolicy)
    .configureLogging(import.meta.env.DEV ? LogLevel.Warning : LogLevel.Error)
    .build();
}
