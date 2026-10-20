import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HubConnectionState, type HubConnection } from '@microsoft/signalr';

import {
  AUTH_TOKEN_CHANGED_EVENT,
  AUTH_UNAUTHORIZED_EVENT,
  authToken,
  type AuthTokenChangeDetail,
} from '@/api';
import { applyOddsUpdate, parseOddsUpdate, type OddsQuote, type OddsUpdate } from '@/domain/odds';
import {
  createOddsHubConnection,
  ODDS_HUB_EVENTS,
  ODDS_HUB_METHODS,
} from '@/services/realtime/oddsHub';

/**
 * useOddsHub — canal SignalR de cuotas en vivo.
 *
 * - Conecta a `/odds-hub` con el JWT actual (`accessTokenFactory`).
 * - Reconexión automática con backoff exponencial + watchdog propio.
 * - Suscripción por grupos: `joinMarket` / `leaveMarket` (los mercados visibles).
 * - Escucha `ReceiveOddsUpdate` y expone `quotes` con dirección (`up`/`down`).
 * - Si la sesión expira (401) detiene el canal y se reconecta al renovarse.
 */

export type OddsHubStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export interface UseOddsHubOptions {
  /** Mercados visibles en pantalla; se sincronizan join/leave automáticamente. */
  readonly markets?: readonly string[];
  /** Permite diferir la conexión (p. ej. hasta tener sesión activa). */
  readonly enabled?: boolean;
  /** Notificación de cambios de estado para toasts/telemetría. */
  readonly onStatusChange?: (status: OddsHubStatus) => void;
}

export interface UseOddsHubResult {
  readonly status: OddsHubStatus;
  readonly isConnected: boolean;
  /** Última cotización por `selectionId`. */
  readonly quotes: Readonly<Record<string, OddsQuote>>;
  /** Epoch ms del último lote aplicado (indicador de frescura). */
  readonly lastUpdateAt: number | null;
  joinMarket(marketId: string): void;
  leaveMarket(marketId: string): void;
}

const MARKET_KEY_SEPARATOR = '\u0000';
const WATCHDOG_BASE_DELAY_MS = 2_000;
const WATCHDOG_MAX_DELAY_MS = 30_000;

export function useOddsHub(options: UseOddsHubOptions = {}): UseOddsHubResult {
  const { markets, enabled = true, onStatusChange } = options;

  const [status, setStatus] = useState<OddsHubStatus>('disconnected');
  const [quotes, setQuotes] = useState<Record<string, OddsQuote>>({});
  const [lastUpdateAt, setLastUpdateAt] = useState<number | null>(null);

  const connectionRef = useRef<HubConnection | null>(null);
  const statusRef = useRef<OddsHubStatus>('disconnected');
  const desiredMarketsRef = useRef<Set<string>>(new Set());
  const pendingUpdatesRef = useRef<Map<string, OddsUpdate>>(new Map());
  const frameRef = useRef<number | null>(null);
  const watchdogTimerRef = useRef<number | null>(null);
  const watchdogAttemptRef = useRef(0);
  const disposedRef = useRef(false);
  const onStatusChangeRef = useRef(onStatusChange);
  /** Permite que `scheduleRestart` reanude sin dependencia circular. */
  const startConnectionRef = useRef<() => void>(() => {});

  const marketsKey = markets?.join(MARKET_KEY_SEPARATOR) ?? '';

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  /* ---------------------------------------------------------------------- */
  /* Estado                                                                  */
  /* ---------------------------------------------------------------------- */

  const publishStatus = useCallback((next: OddsHubStatus) => {
    if (statusRef.current === next) return;

    statusRef.current = next;
    setStatus(next);
    onStatusChangeRef.current?.(next);
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Batch de cuotas por frame (evita renders y flashes en ráfaga)           */
  /* ---------------------------------------------------------------------- */

  const flushPendingUpdates = useCallback(() => {
    frameRef.current = null;

    const pending = pendingUpdatesRef.current;
    if (pending.size === 0) return;

    pendingUpdatesRef.current = new Map();

    setQuotes((previous) => {
      let next = previous;
      for (const update of pending.values()) {
        next = applyOddsUpdate(next, update);
      }
      return next;
    });
    setLastUpdateAt(Date.now());
  }, []);

  const enqueueOddsUpdate = useCallback(
    (payload: unknown) => {
      const update = parseOddsUpdate(payload);
      if (!update) return;

      // Solo la última cuota por selección dentro del frame; el mapa está acotado.
      pendingUpdatesRef.current.set(update.selectionId, update);

      if (frameRef.current === null) {
        frameRef.current = window.requestAnimationFrame(flushPendingUpdates);
      }
    },
    [flushPendingUpdates],
  );

  /* ---------------------------------------------------------------------- */
  /* Grupos                                                                  */
  /* ---------------------------------------------------------------------- */

  const invokeGroupMethod = useCallback(async (method: string, marketId: string) => {
    const connection = connectionRef.current;
    if (!connection || connection.state !== HubConnectionState.Connected) return;

    try {
      await connection.invoke(method, marketId);
    } catch {
      // La reconexión vuelve a sincronizar los grupos en `onreconnected`.
    }
  }, []);

  const rejoinMarkets = useCallback(async () => {
    for (const marketId of desiredMarketsRef.current) {
      await invokeGroupMethod(ODDS_HUB_METHODS.joinMarket, marketId);
    }
  }, [invokeGroupMethod]);

  const joinMarket = useCallback(
    (marketId: string) => {
      const id = marketId?.trim();
      if (!id || desiredMarketsRef.current.has(id)) return;

      desiredMarketsRef.current.add(id);
      void invokeGroupMethod(ODDS_HUB_METHODS.joinMarket, id);
    },
    [invokeGroupMethod],
  );

  const leaveMarket = useCallback(
    (marketId: string) => {
      const id = marketId?.trim();
      if (!id || !desiredMarketsRef.current.delete(id)) return;

      void invokeGroupMethod(ODDS_HUB_METHODS.leaveMarket, id);
    },
    [invokeGroupMethod],
  );

  /* ---------------------------------------------------------------------- */
  /* Ciclo de conexión + watchdog                                            */
  /* ---------------------------------------------------------------------- */

  const clearWatchdog = useCallback(() => {
    if (watchdogTimerRef.current === null) return;

    window.clearTimeout(watchdogTimerRef.current);
    watchdogTimerRef.current = null;
  }, []);

  /** Reintento del watchdog cuando el reconector automático agotó su política. */
  const scheduleRestart = useCallback(() => {
    if (disposedRef.current || watchdogTimerRef.current !== null) return;
    if (!authToken.has()) return;

    const attempt = watchdogAttemptRef.current++;
    const delay = Math.min(WATCHDOG_MAX_DELAY_MS, WATCHDOG_BASE_DELAY_MS * 2 ** attempt);

    watchdogTimerRef.current = window.setTimeout(() => {
      watchdogTimerRef.current = null;
      void startConnectionRef.current();
    }, delay);
  }, []);

  const startConnection = useCallback(async () => {
    const connection = connectionRef.current;
    if (!connection || disposedRef.current) return;

    // Sin token no se intenta: el evento de login reinicia el canal.
    if (!authToken.has()) {
      publishStatus('disconnected');
      return;
    }

    if (connection.state !== HubConnectionState.Disconnected) return;

    clearWatchdog();
    publishStatus('connecting');

    try {
      await connection.start();
    } catch (error) {
      publishStatus('disconnected');
      if (import.meta.env.DEV) {
        console.warn('[zenbet/odds-hub] No se pudo abrir el canal en tiempo real.', error);
      }
      scheduleRestart();
      return;
    }

    if (disposedRef.current) {
      void connection.stop().catch(() => {});
      return;
    }

    watchdogAttemptRef.current = 0;
    publishStatus('connected');
    await rejoinMarkets();
  }, [clearWatchdog, publishStatus, rejoinMarkets, scheduleRestart]);

  useEffect(() => {
    startConnectionRef.current = () => void startConnection();
  }, [startConnection]);

  /** Cambios de sesión: renovar JWT reconecta; logout/401 detiene el canal. */
  useEffect(() => {
    if (!enabled) return undefined;

    const stopConnection = () => {
      clearWatchdog();

      const connection = connectionRef.current;
      if (connection && connection.state !== HubConnectionState.Disconnected) {
        void connection.stop().catch(() => {});
      }

      publishStatus('disconnected');
    };

    const handleTokenChanged = (event: Event) => {
      const detail = (event as CustomEvent<AuthTokenChangeDetail>).detail;

      if (!detail?.token) {
        stopConnection();
        return;
      }

      watchdogAttemptRef.current = 0;
      if (connectionRef.current?.state === HubConnectionState.Disconnected) {
        startConnectionRef.current();
      }
    };

    const handleUnauthorized = () => stopConnection();

    window.addEventListener(AUTH_TOKEN_CHANGED_EVENT, handleTokenChanged);
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);

    return () => {
      window.removeEventListener(AUTH_TOKEN_CHANGED_EVENT, handleTokenChanged);
      window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    };
  }, [enabled, clearWatchdog, publishStatus]);

  /** Ciclo de vida del HubConnection (StrictMode-safe: cada efecto crea y detiene el suyo). */
  useEffect(() => {
    if (!enabled) return undefined;

    disposedRef.current = false;
    watchdogAttemptRef.current = 0;

    const connection = createOddsHubConnection();
    connectionRef.current = connection;

    connection.on(ODDS_HUB_EVENTS.oddsUpdate, enqueueOddsUpdate);
    connection.onreconnecting(() => publishStatus('reconnecting'));
    connection.onreconnected(() => {
      watchdogAttemptRef.current = 0;
      publishStatus('connected');
      void rejoinMarkets();
    });
    connection.onclose(() => {
      publishStatus('disconnected');
      scheduleRestart();
    });

    void startConnectionRef.current();

    return () => {
      disposedRef.current = true;
      clearWatchdog();

      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }

      connection.off(ODDS_HUB_EVENTS.oddsUpdate, enqueueOddsUpdate);
      connectionRef.current = null;
      void connection.stop().catch(() => {});
    };
  }, [enabled, enqueueOddsUpdate, publishStatus, rejoinMarkets, scheduleRestart, clearWatchdog]);

  /** Sincroniza los grupos con los mercados visibles (join nuevos, leave salidos). */
  useEffect(() => {
    const desired = desiredMarketsRef.current;
    const next = new Set(marketsKey ? marketsKey.split(MARKET_KEY_SEPARATOR) : []);

    for (const marketId of [...desired]) {
      if (next.has(marketId)) continue;
      desired.delete(marketId);
      void invokeGroupMethod(ODDS_HUB_METHODS.leaveMarket, marketId);
    }

    for (const marketId of next) {
      if (desired.has(marketId)) continue;
      desired.add(marketId);
      void invokeGroupMethod(ODDS_HUB_METHODS.joinMarket, marketId);
    }
  }, [marketsKey, invokeGroupMethod]);

  return useMemo(
    () => ({
      status,
      isConnected: status === 'connected',
      quotes,
      lastUpdateAt,
      joinMarket,
      leaveMarket,
    }),
    [status, quotes, lastUpdateAt, joinMarket, leaveMarket],
  );
}
