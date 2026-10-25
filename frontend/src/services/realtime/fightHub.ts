import {
  HubConnectionBuilder,
  LogLevel,
  type HubConnection,
} from '@microsoft/signalr';

import { API_BASE_URL, authToken } from '@/api';

import { oddsHubRetryPolicy } from './oddsHub';

/**
 * Canal público de ciclo de vida de combates.
 *
 * Se mantiene separado de `/odds-hub` para que el reloj y el cierre de la
 * cartelera no dependan de que el usuario tenga una sesión de apuestas ni de
 * que haya mercados visibles. La URL admite un override independiente.
 */

export const FIGHT_HUB_PATH = '/fight-hub';

export const FIGHT_HUB_EVENTS = {
  fightUpdate: 'ReceiveFightUpdate',
  fightClock: 'ReceiveFightClock',
  cardUpdate: 'ReceiveCardUpdate',
} as const;

export const FIGHT_HUB_METHODS = {
  joinEvent: 'JoinEventGroup',
  leaveEvent: 'LeaveEventGroup',
  joinCard: 'JoinCardGroup',
  leaveCard: 'LeaveCardGroup',
} as const;

export const FIGHT_HUB_URL: string = (() => {
  const override = import.meta.env.VITE_FIGHT_HUB_URL?.trim();
  if (override) return override.replace(/\/+$/, '');

  try {
    return new URL(FIGHT_HUB_PATH, API_BASE_URL).href;
  } catch {
    return FIGHT_HUB_PATH;
  }
})();

export function createFightHubConnection(): HubConnection {
  return new HubConnectionBuilder()
    .withUrl(FIGHT_HUB_URL, {
      accessTokenFactory: () => authToken.get() ?? '',
      withCredentials: false,
    })
    .withAutomaticReconnect(oddsHubRetryPolicy)
    .configureLogging(import.meta.env.DEV ? LogLevel.Warning : LogLevel.Error)
    .build();
}
