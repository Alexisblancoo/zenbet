import {
  HubConnectionBuilder,
  LogLevel,
  type HubConnection,
} from '@microsoft/signalr';

import { API_BASE_URL, authToken } from '@/api';
import { oddsHubRetryPolicy } from './oddsHub';

export const FOOTBALL_ODDS_UPDATED_EVENT = 'zenbet:football-odds-updated';
export const FOOTBALL_SCORE_UPDATED_EVENT = 'zenbet:football-score-updated';

export interface FootballOddsUpdatePayload {
  readonly matchId?: string;
  readonly marketId?: string;
  readonly selectionId: string;
  readonly odds: number;
  readonly trend?: 'up' | 'down' | 'unchanged';
}

export interface FootballScoreUpdatePayload {
  readonly matchId: string;
  readonly homeScore: number;
  readonly awayScore: number;
  readonly minute: number;
  readonly period: string;
}

export const FOOTBALL_HUB_PATH = '/football-hub';

export const FOOTBALL_HUB_URL: string = (() => {
  const override = import.meta.env.VITE_FOOTBALL_HUB_URL?.trim();
  if (override) return override.replace(/\/+$/, '');

  try {
    return new URL(FOOTBALL_HUB_PATH, API_BASE_URL).href;
  } catch {
    return FOOTBALL_HUB_PATH;
  }
})();

let hubConnection: HubConnection | null = null;

export function getFootballHubConnection(): HubConnection {
  if (hubConnection) return hubConnection;

  hubConnection = new HubConnectionBuilder()
    .withUrl(FOOTBALL_HUB_URL, {
      accessTokenFactory: () => authToken.get() ?? '',
      withCredentials: true,
    })
    .withAutomaticReconnect(oddsHubRetryPolicy)
    .configureLogging(import.meta.env.DEV ? LogLevel.Warning : LogLevel.Error)
    .build();

  hubConnection.on('ReceiveFootballOddsUpdate', (payload: FootballOddsUpdatePayload) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(FOOTBALL_ODDS_UPDATED_EVENT, { detail: payload }),
      );
    }
  });

  hubConnection.on('ReceiveMatchScoreUpdate', (payload: FootballScoreUpdatePayload) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(FOOTBALL_SCORE_UPDATED_EVENT, { detail: payload }),
      );
    }
  });

  // Evento estándar de cuotas de SignalR emitido por el backend
  hubConnection.on(
    'ReceiveOddsUpdate',
    (marketId: string, selectionId: string, odds: number, trend?: 'up' | 'down') => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent(FOOTBALL_ODDS_UPDATED_EVENT, {
            detail: { marketId, selectionId, odds, trend },
          }),
        );
      }
    },
  );

  return hubConnection;
}

/**
 * Conecta al canal SignalR de fútbol para recibir cuotas y marcadores en vivo desde el backend.
 */
export async function startFootballRealtime(): Promise<void> {
  const connection = getFootballHubConnection();

  if (connection.state === 'Disconnected') {
    try {
      await connection.start();
    } catch {
      // Manejo silencioso de fallo de conexión inicial (SignalR reconectará automáticamente)
    }
  }
}

export function stopFootballRealtime(): void {
  if (hubConnection && hubConnection.state !== 'Disconnected') {
    void hubConnection.stop().catch(() => {});
  }
}
