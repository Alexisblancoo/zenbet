/**
 * useZenBet — capa de integración React para la API + SignalR de ZenBet.
 *
 * - Carga promociones y próximos eventos desde `zenbetClient`.
 * - Mantiene una única conexión SignalR por montaje y se suscribe a los
 *   mercados visibles (cuotas) y a cada combate (estado/resultado).
 * - Aplica los mensajes en vivo sobre el estado local con actualizaciones
 *   inmutables y estructuralmente compartidas.
 * - Expone `loading`, `placingBet`, `error` y `placeBet` con clave de
 *   idempotencia generada si el llamador no la provee.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { createIdempotencyKey } from '@/api';
import {
  createZenBetRealtimeClient,
  type ZenBetRealtimeClient,
  type ZenBetRealtimeStatus,
} from '@/services/signalrClient';
import {
  toZenBetApiError,
  zenbetClient,
  type ZenBetApiError,
} from '@/services/zenbetClient';
import type {
  BetResponse,
  FightingEventDto,
  FightEventDto,
  FightUpdateDto,
  OddsUpdateDto,
  PlaceBetRequest,
  PromotionDto,
} from '@/types/zenbet';

/* ==========================================================================
   Utilidades puras (testeables sin React)
   ========================================================================== */

function formatAmericanOdds(decimalOdds: number): string {
  if (!Number.isFinite(decimalOdds) || decimalOdds <= 1) return '—';

  const american =
    decimalOdds >= 2
      ? Math.round((decimalOdds - 1) * 100)
      : -Math.round(100 / (decimalOdds - 1));

  return american > 0 ? `+${american}` : String(american);
}

/** Mercados que deben estar suscritos al hub de cuotas. */
export function collectMarketIds(
  fights: readonly FightEventDto[],
): readonly string[] {
  const ids = new Set<string>();

  for (const fight of fights) {
    if (!fight.isBettingOpen || fight.isExpired) continue;

    for (const market of fight.markets) {
      const status = market.status.toLowerCase();
      if (status === 'settled' || status === 'void') continue;

      // Incluye mercados suspendidos: pueden reabrirse sin cambiar el evento.
      ids.add(market.id);
    }
  }

  return [...ids];
}

/** Combates que deben estar suscritos al hub de estado. */
export function collectFightIds(
  fights: readonly FightEventDto[],
): readonly string[] {
  const ids = new Set<string>();

  for (const fight of fights) {
    ids.add(fight.id);
  }

  return [...ids];
}

/**
 * Aplica `ReceiveOddsUpdate` a un combate sin mutarlo. Devuelve la misma
 * referencia cuando el mensaje no toca ese combate o no cambia la cuota, de
 * modo que React pueda podar el re-render.
 */
export function applyOddsUpdateToFight(
  fight: FightEventDto,
  update: OddsUpdateDto,
): FightEventDto {
  const marketIndex = fight.markets.findIndex(
    (market) => market.id === update.marketId,
  );

  if (marketIndex === -1) return fight;

  const market = fight.markets[marketIndex];
  const selectionIndex = market.selections.findIndex(
    (selection) => selection.id === update.selectionId,
  );

  if (selectionIndex === -1) return fight;

  const selection = market.selections[selectionIndex];
  if (selection.decimalOdds === update.decimalOdds) return fight;

  const selections = market.selections.map((item, index) =>
    index === selectionIndex
      ? {
          ...item,
          decimalOdds: update.decimalOdds,
          americanOdds: formatAmericanOdds(update.decimalOdds),
          updatedAt: update.updatedAt ?? item.updatedAt,
        }
      : item,
  );

  const markets = fight.markets.map((item, index) =>
    index === marketIndex
      ? {
          ...item,
          selections,
          updatedAt: update.updatedAt ?? item.updatedAt,
        }
      : item,
  );

  return {
    ...fight,
    markets,
    oddsUpdatedAt: update.updatedAt ?? fight.oddsUpdatedAt,
  };
}

/** Aplica `ReceiveOddsUpdate` sobre la lista plana de combates. */
export function applyOddsUpdateToFights(
  fights: readonly FightEventDto[],
  update: OddsUpdateDto,
): readonly FightEventDto[] {
  let changed = false;

  const next = fights.map((fight) => {
    const updated = applyOddsUpdateToFight(fight, update);
    if (updated !== fight) changed = true;
    return updated;
  });

  return changed ? next : fights;
}

/** Aplica `ReceiveOddsUpdate` sobre las carteleras, reutilizando el helper. */
export function applyOddsUpdateToEvents(
  events: readonly FightingEventDto[],
  update: OddsUpdateDto,
): readonly FightingEventDto[] {
  let changed = false;

  const next = events.map((card) => {
    let cardChanged = false;

    const fights = card.fights.map((fight) => {
      const updated = applyOddsUpdateToFight(fight, update);
      if (updated !== fight) cardChanged = true;
      return updated;
    });

    if (!cardChanged) return card;

    changed = true;
    return { ...card, fights };
  });

  return changed ? next : events;
}

/** Aplica `ReceiveFightUpdate` a un combate; un cierre nunca se reabre. */
export function applyFightUpdateToFight(
  fight: FightEventDto,
  update: FightUpdateDto,
): FightEventDto {
  if (fight.id !== update.eventId) return fight;

  const isExpired = fight.isExpired || update.isExpired;
  const isBettingOpen = !isExpired && update.isBettingOpen;
  const result = update.result ?? fight.result;

  if (
    fight.status === update.status &&
    fight.isExpired === isExpired &&
    fight.isBettingOpen === isBettingOpen &&
    fight.startTime === update.startTime &&
    fight.endsAt === update.endsAt &&
    fight.result === result
  ) {
    return fight;
  }

  return {
    ...fight,
    status: update.status,
    isExpired,
    isBettingOpen,
    startTime: update.startTime,
    endsAt: update.endsAt,
    result,
  };
}

/** Aplica `ReceiveFightUpdate` sobre la lista plana de combates. */
export function applyFightUpdateToFights(
  fights: readonly FightEventDto[],
  update: FightUpdateDto,
): readonly FightEventDto[] {
  let changed = false;

  const next = fights.map((fight) => {
    const updated = applyFightUpdateToFight(fight, update);
    if (updated !== fight) changed = true;
    return updated;
  });

  return changed ? next : fights;
}

/** Aplica `ReceiveFightUpdate` sobre las carteleras, reutilizando el helper. */
export function applyFightUpdateToEvents(
  events: readonly FightingEventDto[],
  update: FightUpdateDto,
): readonly FightingEventDto[] {
  let changed = false;

  const next = events.map((card) => {
    let cardChanged = false;

    const fights = card.fights.map((fight) => {
      const updated = applyFightUpdateToFight(fight, update);
      if (updated !== fight) cardChanged = true;
      return updated;
    });

    if (!cardChanged) return card;

    changed = true;
    return { ...card, fights };
  });

  return changed ? next : events;
}

/**
 * Una clave de idempotencia solo puede reutilizarse si el payload no cambió.
 * La firma permite reintentar una apuesta de red sin arriesgar un cargo doble.
 */
function betRequestSignature(request: PlaceBetRequest): string {
  return JSON.stringify([
    request.walletId,
    request.selectionId,
    request.amount,
    request.description.trim(),
    request.promoCode?.trim() ?? '',
  ]);
}

function shouldRetainIdempotencyKey(error: ZenBetApiError): boolean {
  return (
    error.code === 'NETWORK' ||
    error.code === 'TIMEOUT' ||
    error.code === 'SERVER' ||
    error.code === 'RATE_LIMITED' ||
    error.code === 'UNKNOWN'
  );
}

/* ==========================================================================
   Hook
   ========================================================================== */

export interface UseZenBetOptions {
  /** Filtro opcional por tier; `null`/`undefined` devuelve todas. */
  readonly tier?: number | null;
  readonly enabled?: boolean;
  /** Permite desactivar SignalR manteniendo la carga REST. */
  readonly realtime?: boolean;
  readonly onRealtimeError?: (error: unknown) => void;
}

export interface UseZenBetResult {
  readonly events: readonly FightingEventDto[];
  /** Lista plana de combates tal como la entrega el backend. */
  readonly fights: readonly FightEventDto[];
  readonly promotions: readonly PromotionDto[];
  readonly loading: boolean;
  readonly placingBet: boolean;
  readonly error: ZenBetApiError | null;
  readonly realtimeStatus: ZenBetRealtimeStatus;
  readonly isRealtimeConnected: boolean;
  /** Epoch ms del último mensaje SignalR aplicado. */
  readonly lastRealtimeUpdateAt: number | null;
  readonly refresh: () => Promise<void>;
  readonly placeBet: (
    request: PlaceBetRequest,
    idempotencyKey?: string,
  ) => Promise<BetResponse>;
  readonly clearError: () => void;
}

const ID_KEY_SEPARATOR = '\u0000';

export function useZenBet(options: UseZenBetOptions = {}): UseZenBetResult {
  const {
    tier = null,
    enabled = true,
    realtime = true,
    onRealtimeError,
  } = options;

  const [events, setEvents] = useState<readonly FightingEventDto[]>([]);
  const [fights, setFights] = useState<readonly FightEventDto[]>([]);
  const [promotions, setPromotions] = useState<readonly PromotionDto[]>([]);
  const [loading, setLoading] = useState<boolean>(enabled);
  const [placingBet, setPlacingBet] = useState(false);
  const [error, setError] = useState<ZenBetApiError | null>(null);
  const [realtimeStatus, setRealtimeStatus] =
    useState<ZenBetRealtimeStatus>('disconnected');
  const [lastRealtimeUpdateAt, setLastRealtimeUpdateAt] = useState<number | null>(
    null,
  );

  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);
  const clientRef = useRef<ZenBetRealtimeClient | null>(null);
  const onRealtimeErrorRef = useRef(onRealtimeError);
  const pendingBetRef = useRef<{ signature: string; key: string } | null>(null);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    onRealtimeErrorRef.current = onRealtimeError;
  }, [onRealtimeError]);

  /* ---------------------------------------------------------------------- */
  /* Carga REST                                                             */
  /* ---------------------------------------------------------------------- */

  const load = useCallback(async (): Promise<void> => {
    const requestId = ++requestIdRef.current;

    if (mountedRef.current) {
      setLoading(true);
      setError(null);
    }

    const [promotionsResult, eventsResult] = await Promise.allSettled([
      zenbetClient.getPromotions(tier ?? undefined),
      zenbetClient.getUpcomingEvents(),
    ]);

    if (!mountedRef.current || requestId !== requestIdRef.current) return;

    let nextError: ZenBetApiError | null = null;

    if (promotionsResult.status === 'fulfilled') {
      setPromotions(promotionsResult.value);
    } else {
      nextError = toZenBetApiError(promotionsResult.reason);
    }

    if (eventsResult.status === 'fulfilled') {
      setEvents(eventsResult.value.events);
      setFights(eventsResult.value.fights);
    } else {
      nextError ??= toZenBetApiError(eventsResult.reason);
    }

    setError(nextError);
    setLoading(false);
  }, [tier]);

  const refresh = useCallback(() => load(), [load]);

  useEffect(() => {
    if (!enabled) return undefined;

    // Sincronización con un sistema externo (HTTP): marcar `loading` al
    // iniciar la petición es el estado que React debe reflejar.
    // oxlint-disable-next-line react/set-state-in-effect -- carga HTTP externa
    void load();

    return () => {
      // Invalida respuestas en vuelo; la siguiente carga gana.
      requestIdRef.current += 1;
    };
  }, [enabled, load]);

  /* ---------------------------------------------------------------------- */
  /* SignalR                                                                */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (!enabled || !realtime) return undefined;

    const client = createZenBetRealtimeClient();
    clientRef.current = client;

    const unsubscribeStatus = client.onStatusChange(setRealtimeStatus);

    const unsubscribeOdds = client.onOddsUpdate((update) => {
      if (!mountedRef.current) return;

      setEvents((previous) => applyOddsUpdateToEvents(previous, update));
      setFights((previous) => applyOddsUpdateToFights(previous, update));
      setLastRealtimeUpdateAt(Date.now());
    });

    const unsubscribeFight = client.onFightUpdate((update) => {
      if (!mountedRef.current) return;

      setEvents((previous) => applyFightUpdateToEvents(previous, update));
      setFights((previous) => applyFightUpdateToFights(previous, update));
      setLastRealtimeUpdateAt(Date.now());
    });

    const unsubscribeError = client.onError((reason) => {
      if (import.meta.env.DEV) {
        console.warn('[zenbet/useZenBet] Error en el canal en tiempo real.', reason);
      }

      onRealtimeErrorRef.current?.(reason);
    });

    client.start();

    return () => {
      unsubscribeStatus();
      unsubscribeOdds();
      unsubscribeFight();
      unsubscribeError();
      clientRef.current = null;
      void client.stop();
    };
  }, [enabled, realtime]);

  const marketIds = useMemo(() => collectMarketIds(fights), [fights]);
  const fightIds = useMemo(() => collectFightIds(fights), [fights]);
  const marketIdsKey = marketIds.join(ID_KEY_SEPARATOR);
  const fightIdsKey = fightIds.join(ID_KEY_SEPARATOR);

  useEffect(() => {
    const client = clientRef.current;
    if (!client) return;

    void client.setMarketSubscriptions(
      marketIdsKey ? marketIdsKey.split(ID_KEY_SEPARATOR) : [],
    );
  }, [enabled, realtime, marketIdsKey]);

  useEffect(() => {
    const client = clientRef.current;
    if (!client) return;

    void client.setEventSubscriptions(
      fightIdsKey ? fightIdsKey.split(ID_KEY_SEPARATOR) : [],
    );
  }, [enabled, realtime, fightIdsKey]);

  /* ---------------------------------------------------------------------- */
  /* Acciones                                                               */
  /* ---------------------------------------------------------------------- */

  const placeBet = useCallback(
    async (
      request: PlaceBetRequest,
      idempotencyKey?: string,
    ): Promise<BetResponse> => {
      const signature = betRequestSignature(request);
      const autoKey = idempotencyKey === undefined;
      const key =
        idempotencyKey ??
        (pendingBetRef.current?.signature === signature
          ? pendingBetRef.current.key
          : createIdempotencyKey());

      if (autoKey) pendingBetRef.current = { signature, key };

      if (mountedRef.current) {
        setPlacingBet(true);
        setError(null);
      }

      try {
        const response = await zenbetClient.placeBet(request, key);

        // La apuesta quedó confirmada: la siguiente operación usa clave nueva.
        pendingBetRef.current = null;

        return response;
      } catch (reason) {
        const normalized = toZenBetApiError(reason);

        if (autoKey && !shouldRetainIdempotencyKey(normalized)) {
          pendingBetRef.current = null;
        }

        if (mountedRef.current) setError(normalized);

        throw normalized;
      } finally {
        if (mountedRef.current) setPlacingBet(false);
      }
    },
    [],
  );

  const clearError = useCallback(() => setError(null), []);

  const effectiveLoading = enabled ? loading : false;
  const effectiveRealtimeStatus: ZenBetRealtimeStatus =
    enabled && realtime ? realtimeStatus : 'disconnected';

  return useMemo(
    () => ({
      events,
      fights,
      promotions,
      loading: effectiveLoading,
      placingBet,
      error,
      realtimeStatus: effectiveRealtimeStatus,
      isRealtimeConnected: effectiveRealtimeStatus === 'connected',
      lastRealtimeUpdateAt,
      refresh,
      placeBet,
      clearError,
    }),
    [
      events,
      fights,
      promotions,
      effectiveLoading,
      placingBet,
      error,
      effectiveRealtimeStatus,
      lastRealtimeUpdateAt,
      refresh,
      placeBet,
      clearError,
    ],
  );
}
