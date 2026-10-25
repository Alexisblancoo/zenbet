import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HubConnectionState, type HubConnection } from '@microsoft/signalr';

import {
  normalizeCardUpdate,
  normalizeFightClock,
  normalizeFightUpdate,
  type UfcCardUpdate,
  type UfcFightClock,
  type UfcFightUpdate,
} from '@/domain/ufc';
import {
  createFightHubConnection,
  FIGHT_HUB_EVENTS,
  FIGHT_HUB_METHODS,
} from '@/services/realtime/fightHub';

/**
 * useFightHub — canal SignalR público de ciclo de vida de combates.
 *
 * Mantiene una sola conexión por montaje (la página de cartelera es su único
 * consumidor), se suscribe a los eventos visibles y a sus carteleras, y
 * expone los últimos updates/relojes recibidos. La conexión no depende del
 * JWT: el estado de un combate es información pública.
 */

export type FightHubStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export interface UseFightHubOptions {
  /** Combates visibles; se sincronizan join/leave automáticamente. */
  readonly eventIds?: readonly string[];
  /** Carteleras visibles; reciben el agregado de estado de la tarjeta. */
  readonly cardKeys?: readonly string[];
  readonly enabled?: boolean;
  readonly onStatusChange?: (status: FightHubStatus) => void;
}

export interface UseFightHubResult {
  readonly status: FightHubStatus;
  readonly isConnected: boolean;
  readonly updates: Readonly<Record<string, UfcFightUpdate>>;
  readonly clocks: Readonly<Record<string, UfcFightClock>>;
  readonly cardUpdates: Readonly<Record<string, UfcCardUpdate>>;
  readonly lastUpdateAt: number | null;
  /** Incrementa cuando el canal vuelve a conectar; la página debe refrescar. */
  readonly reconnectCount: number;
  joinEvent(eventId: string): void;
  leaveEvent(eventId: string): void;
  joinCard(cardKey: string): void;
  leaveCard(cardKey: string): void;
}

const KEY_SEPARATOR = '\u0000';
const WATCHDOG_BASE_DELAY_MS = 2_000;
const WATCHDOG_MAX_DELAY_MS = 30_000;

export function useFightHub(options: UseFightHubOptions = {}): UseFightHubResult {
  const { eventIds, cardKeys, enabled = true, onStatusChange } = options;

  const [status, setStatus] = useState<FightHubStatus>('disconnected');
  const [updates, setUpdates] = useState<Record<string, UfcFightUpdate>>({});
  const [clocks, setClocks] = useState<Record<string, UfcFightClock>>({});
  const [cardUpdates, setCardUpdates] = useState<Record<string, UfcCardUpdate>>({});
  const [lastUpdateAt, setLastUpdateAt] = useState<number | null>(null);
  const [reconnectCount, setReconnectCount] = useState(0);

  const connectionRef = useRef<HubConnection | null>(null);
  const statusRef = useRef<FightHubStatus>('disconnected');
  const desiredEventsRef = useRef<Set<string>>(new Set());
  const desiredCardsRef = useRef<Set<string>>(new Set());
  const watchdogTimerRef = useRef<number | null>(null);
  const watchdogAttemptRef = useRef(0);
  const disposedRef = useRef(false);
  const hasConnectedRef = useRef(false);
  const onStatusChangeRef = useRef(onStatusChange);
  const startConnectionRef = useRef<() => void>(() => {});

  const eventsKey = eventIds?.join(KEY_SEPARATOR) ?? '';
  const cardsKey = cardKeys?.join(KEY_SEPARATOR) ?? '';

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  const publishStatus = useCallback((next: FightHubStatus) => {
    if (statusRef.current === next) return;

    statusRef.current = next;
    setStatus(next);
    onStatusChangeRef.current?.(next);
  }, []);

  const resetRealtime = useCallback(() => {
    setUpdates({});
    setClocks({});
    setCardUpdates({});
  }, []);

  const invokeGroupMethod = useCallback(async (method: string, key: string) => {
    const connection = connectionRef.current;
    if (!connection || connection.state !== HubConnectionState.Connected) return;

    try {
      await connection.invoke(method, key);
    } catch {
      // La reconexión vuelve a sincronizar los grupos en `onreconnected`.
    }
  }, []);

  const rejoinGroups = useCallback(async () => {
    for (const eventId of desiredEventsRef.current) {
      await invokeGroupMethod(FIGHT_HUB_METHODS.joinEvent, eventId);
    }

    for (const cardKey of desiredCardsRef.current) {
      await invokeGroupMethod(FIGHT_HUB_METHODS.joinCard, cardKey);
    }
  }, [invokeGroupMethod]);

  const joinEvent = useCallback(
    (eventId: string) => {
      const id = eventId?.trim();
      if (!id || desiredEventsRef.current.has(id)) return;

      desiredEventsRef.current.add(id);
      void invokeGroupMethod(FIGHT_HUB_METHODS.joinEvent, id);
    },
    [invokeGroupMethod],
  );

  const leaveEvent = useCallback(
    (eventId: string) => {
      const id = eventId?.trim();
      if (!id || !desiredEventsRef.current.delete(id)) return;

      void invokeGroupMethod(FIGHT_HUB_METHODS.leaveEvent, id);
    },
    [invokeGroupMethod],
  );

  const joinCard = useCallback(
    (cardKey: string) => {
      const key = cardKey?.trim();
      if (!key || desiredCardsRef.current.has(key)) return;

      desiredCardsRef.current.add(key);
      void invokeGroupMethod(FIGHT_HUB_METHODS.joinCard, key);
    },
    [invokeGroupMethod],
  );

  const leaveCard = useCallback(
    (cardKey: string) => {
      const key = cardKey?.trim();
      if (!key || !desiredCardsRef.current.delete(key)) return;

      void invokeGroupMethod(FIGHT_HUB_METHODS.leaveCard, key);
    },
    [invokeGroupMethod],
  );

  const clearWatchdog = useCallback(() => {
    if (watchdogTimerRef.current === null) return;

    window.clearTimeout(watchdogTimerRef.current);
    watchdogTimerRef.current = null;
  }, []);

  const scheduleRestart = useCallback(() => {
    if (disposedRef.current || watchdogTimerRef.current !== null) return;

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
    if (connection.state !== HubConnectionState.Disconnected) return;

    clearWatchdog();
    publishStatus('connecting');

    try {
      await connection.start();
    } catch (error) {
      publishStatus('disconnected');
      if (import.meta.env.DEV) {
        console.warn('[zenbet/fight-hub] No se pudo abrir el canal de combates.', error);
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

    if (hasConnectedRef.current) {
      // Tras un cierre total, los mapas pueden contener estados anteriores a
      // la caída. La página refresca por REST al ver incrementado el contador.
      resetRealtime();
      setReconnectCount((count) => count + 1);
    } else {
      hasConnectedRef.current = true;
    }

    await rejoinGroups();
  }, [clearWatchdog, publishStatus, rejoinGroups, resetRealtime, scheduleRestart]);

  useEffect(() => {
    startConnectionRef.current = () => void startConnection();
  }, [startConnection]);

  const handleFightUpdate = useCallback((payload: unknown) => {
    const update = normalizeFightUpdate(payload);
    if (!update) return;

    setUpdates((previous) => ({ ...previous, [update.eventId]: update }));
    setLastUpdateAt(Date.now());
  }, []);

  const handleFightClock = useCallback((payload: unknown) => {
    const clock = normalizeFightClock(payload);
    if (!clock) return;

    setClocks((previous) => ({ ...previous, [clock.eventId]: clock }));
    setLastUpdateAt(Date.now());
  }, []);

  const handleCardUpdate = useCallback((payload: unknown) => {
    const update = normalizeCardUpdate(payload);
    if (!update) return;

    setCardUpdates((previous) => ({ ...previous, [update.cardKey]: update }));
    setLastUpdateAt(Date.now());
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;

    disposedRef.current = false;
    watchdogAttemptRef.current = 0;

    const connection = createFightHubConnection();
    connectionRef.current = connection;

    connection.on(FIGHT_HUB_EVENTS.fightUpdate, handleFightUpdate);
    connection.on(FIGHT_HUB_EVENTS.fightClock, handleFightClock);
    connection.on(FIGHT_HUB_EVENTS.cardUpdate, handleCardUpdate);
    connection.onreconnecting(() => publishStatus('reconnecting'));
    connection.onreconnected(() => {
      watchdogAttemptRef.current = 0;
      publishStatus('connected');
      resetRealtime();
      setReconnectCount((count) => count + 1);
      void rejoinGroups();
    });
    connection.onclose(() => {
      publishStatus('disconnected');
      scheduleRestart();
    });

    void startConnectionRef.current();

    return () => {
      disposedRef.current = true;
      clearWatchdog();

      connection.off(FIGHT_HUB_EVENTS.fightUpdate, handleFightUpdate);
      connection.off(FIGHT_HUB_EVENTS.fightClock, handleFightClock);
      connection.off(FIGHT_HUB_EVENTS.cardUpdate, handleCardUpdate);
      connectionRef.current = null;
      void connection.stop().catch(() => {});
    };
  }, [
    enabled,
    clearWatchdog,
    handleCardUpdate,
    handleFightClock,
    handleFightUpdate,
    publishStatus,
    rejoinGroups,
    resetRealtime,
    scheduleRestart,
  ]);

  useEffect(() => {
    const desired = desiredEventsRef.current;
    const next = new Set(eventsKey ? eventsKey.split(KEY_SEPARATOR) : []);

    for (const eventId of [...desired]) {
      if (next.has(eventId)) continue;
      desired.delete(eventId);
      void invokeGroupMethod(FIGHT_HUB_METHODS.leaveEvent, eventId);
    }

    for (const eventId of next) {
      if (desired.has(eventId)) continue;
      desired.add(eventId);
      void invokeGroupMethod(FIGHT_HUB_METHODS.joinEvent, eventId);
    }
  }, [eventsKey, invokeGroupMethod]);

  useEffect(() => {
    const desired = desiredCardsRef.current;
    const next = new Set(cardsKey ? cardsKey.split(KEY_SEPARATOR) : []);

    for (const cardKey of [...desired]) {
      if (next.has(cardKey)) continue;
      desired.delete(cardKey);
      void invokeGroupMethod(FIGHT_HUB_METHODS.leaveCard, cardKey);
    }

    for (const cardKey of next) {
      if (desired.has(cardKey)) continue;
      desired.add(cardKey);
      void invokeGroupMethod(FIGHT_HUB_METHODS.joinCard, cardKey);
    }
  }, [cardsKey, invokeGroupMethod]);

  return useMemo(
    () => ({
      status,
      isConnected: status === 'connected',
      updates,
      clocks,
      cardUpdates,
      lastUpdateAt,
      reconnectCount,
      joinEvent,
      leaveEvent,
      joinCard,
      leaveCard,
    }),
    [
      status,
      updates,
      clocks,
      cardUpdates,
      lastUpdateAt,
      reconnectCount,
      joinEvent,
      leaveEvent,
      joinCard,
      leaveCard,
    ],
  );
}
