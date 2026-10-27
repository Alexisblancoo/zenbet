import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';

import { createIdempotencyKey } from '@/api';
import { BALANCE_UPDATED_EVENT, useAuth } from '@/context/authState';
import { useFightHubState } from '@/context/fightHubState';
import {
  areOddsEqual,
  calculatePromoBonus,
  countPendingOdds,
  expireSelectionsByTime,
  isSelectionEventClosed,
  normalizeSelectionInput,
  resolvePromoCode,
  roundMoney,
  type BetFailure,
  type BetReceipt,
  type BetSelection,
  type EventLifecycle,
  type LiveBetSelection,
  type PlaceBetOutcome,
  type SelectionInput,
} from '@/domain/bets';
import { isTerminalEventStatus, type UfcFightClock, type UfcFightUpdate } from '@/domain/ufc';
import { useOddsHub } from '@/hooks/useOddsHub';
import {
  betService,
  createBetFailure,
  describeBetError,
  isRetryableBetError,
  resolveWalletId,
} from '@/services/betService';

import {
  BET_SLIP_STORAGE_KEY,
  loadPersistedSelections,
  parsePersistedSelections,
  serializeSelections,
  writePersistedSelections,
} from './betSlipPersistence';
import { BetSlipContext, type BetSlipContextValue } from './betSlipState';

/**
 * BetSlipProvider — estado global del boleto + conexiones SignalR compartidas.
 *
 * Las selecciones aceptadas se hidratan y persisten en localStorage (sin la
 * cuota viva). El boleto se sincroniza entre pestañas, revalida el cierre por
 * horario al recuperar foco/visibilidad y consume el FightHub compartido para
 * cerrar picks cuando el combate termina. El OddsHub avisa además cuando un
 * mercado fue liquidado.
 */

interface AttemptKey {
  readonly key: string;
  readonly signature: string;
}

/**
 * Al recargar con selecciones persistidas, el OddsHub quiere conectarse antes
 * de que la cartelera termine su primer fetch. El backend limita a 5 req/s por
 * IP, así que se le da prioridad a la carga de eventos y al FightHub; el
 * OddsHub se suma poco después. Sin picks hidratados no hay prisa: los
 * mercados visibles llegan recién cuando la cartelera ya cargó.
 */
const ODDS_HUB_START_DELAY_MS = 1_200;

function buildRealtimeLifecycles(
  updates: Readonly<Record<string, UfcFightUpdate>>,
  clocks: Readonly<Record<string, UfcFightClock>>,
  nowMs = Date.now(),
): readonly EventLifecycle[] {
  const lifecycles = new Map<string, EventLifecycle>();

  for (const [eventId, update] of Object.entries(updates)) {
    lifecycles.set(eventId, {
      eventId,
      status: update.status,
      endsAt: update.endsAt,
      isExpired: update.isExpired,
      isBettingOpen: update.isBettingOpen,
    });
  }

  for (const [eventId, clock] of Object.entries(clocks)) {
    if (lifecycles.has(eventId)) continue;

    const endsAt = new Date(clock.endsAt).getTime();
    const reachedEnd = !Number.isNaN(endsAt) && endsAt <= nowMs;
    const isExpired = reachedEnd || isTerminalEventStatus(clock.status);

    lifecycles.set(eventId, {
      eventId,
      status: clock.status,
      endsAt: clock.endsAt,
      isExpired,
      isBettingOpen: !isExpired && clock.status.toLowerCase() !== 'suspended',
    });
  }

  return [...lifecycles.values()];
}

export function BetSlipProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const {
    updates: fightUpdates,
    clocks: fightClocks,
    watchEvents,
    unwatchEvents,
  } = useFightHubState();
  const fightHubOwnerId = useId();

  const [selections, setSelections] = useState<readonly BetSelection[]>(() =>
    expireSelectionsByTime(loadPersistedSelections()),
  );
  const [visibleMarkets, setVisibleMarketsState] = useState<readonly string[]>([]);
  const [isPlacingBet, setIsPlacingBet] = useState(false);
  const [error, setError] = useState<BetFailure | null>(null);
  const [receipt, setReceipt] = useState<BetReceipt | null>(null);
  const [receipts, setReceipts] = useState<readonly BetReceipt[]>([]);

  const attemptRef = useRef<AttemptKey | null>(null);
  const placingRef = useRef(false);
  const lastPersistedRef = useRef<string | null>(null);
  // Solo la hidratación inicial justifica cederle el primer turno al REST.
  const [oddsHubReady, setOddsHubReady] = useState(() => selections.length === 0);

  useEffect(() => {
    if (oddsHubReady) return undefined;

    const timer = window.setTimeout(() => setOddsHubReady(true), ODDS_HUB_START_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [oddsHubReady]);

  /* ---------------------------------------------------------------------- */
  /* Persistencia y sincronización entre pestañas                            */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    const serialized = serializeSelections(selections);
    if (lastPersistedRef.current === serialized) return;

    lastPersistedRef.current = serialized;
    writePersistedSelections(serialized);
  }, [selections]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== BET_SLIP_STORAGE_KEY) return;
      if (event.storageArea && event.storageArea !== window.localStorage) return;

      // Otra pestaña vació el boleto: se refleja sin reescribir la llave.
      if (event.newValue === null) {
        lastPersistedRef.current = serializeSelections([]);
        setSelections((previous) => (previous.length === 0 ? previous : []));
        return;
      }

      const parsed = parsePersistedSelections(event.newValue);
      if (parsed === null) return;

      const next = expireSelectionsByTime(parsed);
      const serialized = serializeSelections(next);
      lastPersistedRef.current = serialized;

      setSelections((previous) =>
        serializeSelections(previous) === serialized ? previous : next,
      );
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Red de seguridad local: SignalR puede perder el mensaje final o la
  // pestaña puede estar suspendida. Reevaluar `endsAt` periódicamente y al
  // recuperar foco evita que un combate vencido siga apostable.
  useEffect(() => {
    const revalidate = () => {
      setSelections((previous) => expireSelectionsByTime(previous));
    };

    revalidate();

    const interval = window.setInterval(revalidate, 30_000);
    const handleFocus = () => revalidate();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') revalidate();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Grupos del FightHub para los combates del boleto                        */
  /* ---------------------------------------------------------------------- */

  const selectionEventIds = useMemo(
    () => [...new Set(selections.map((selection) => selection.eventId))],
    [selections],
  );

  useEffect(() => {
    watchEvents(fightHubOwnerId, selectionEventIds);
  }, [fightHubOwnerId, selectionEventIds, watchEvents]);

  useEffect(
    () => () => {
      unwatchEvents(fightHubOwnerId);
    },
    [fightHubOwnerId, unwatchEvents],
  );

  /* ---------------------------------------------------------------------- */
  /* Mercados suscritos: visibles + seleccionados                            */
  /* ---------------------------------------------------------------------- */

  const setVisibleMarkets = useCallback((markets: readonly string[]) => {
    const next = [...new Set(markets.map((marketId) => marketId.trim()).filter(Boolean))];

    setVisibleMarketsState((previous) =>
      previous.length === next.length && previous.every((id, index) => id === next[index])
        ? previous
        : next,
    );
  }, []);

  const activeMarkets = useMemo(() => {
    const unique = new Set(visibleMarkets);
    for (const selection of selections) unique.add(selection.marketId);
    return [...unique];
  }, [visibleMarkets, selections]);

  const {
    status: hubStatus,
    quotes,
    settledMarkets,
    lastUpdateAt,
  } = useOddsHub({
    markets: activeMarkets,
    // El hub de cuotas es público: también observa a invitados para cerrar
    // mercados liquidados sin depender de una sesión iniciada.
    enabled: oddsHubReady && activeMarkets.length > 0,
  });

  /* ---------------------------------------------------------------------- */
  /* Cuota viva por selección (derivada; no se persiste)                     */
  /* ---------------------------------------------------------------------- */

  const liveSelections = useMemo<readonly LiveBetSelection[]>(
    () =>
      selections.map((selection) => {
        const quote = quotes[selection.selectionId];

        return {
          ...selection,
          liveOdds: quote?.odds ?? selection.odds,
          liveUpdatedAt: quote?.updatedAt ?? null,
          trend: quote?.trend ?? 'unchanged',
        };
      }),
    [selections, quotes],
  );

  /* ---------------------------------------------------------------------- */
  /* Acciones del boleto                                                     */
  /* ---------------------------------------------------------------------- */

  const syncEventLifecycle = useCallback((events: readonly EventLifecycle[]) => {
    if (events.length === 0) return;

    const lifecycleByEvent = new Map(events.map((event) => [event.eventId, event]));

    setSelections((previous) => {
      let changed = false;
      const next = previous.map((selection) => {
        const lifecycle = lifecycleByEvent.get(selection.eventId);
        if (!lifecycle) return selection;

        if (
          selection.eventStatus === lifecycle.status &&
          selection.eventEndsAt === lifecycle.endsAt &&
          selection.eventIsExpired === lifecycle.isExpired &&
          selection.eventIsBettingOpen === lifecycle.isBettingOpen
        ) {
          return selection;
        }

        changed = true;
        return {
          ...selection,
          eventStatus: lifecycle.status,
          eventEndsAt: lifecycle.endsAt,
          eventIsExpired: lifecycle.isExpired,
          eventIsBettingOpen: lifecycle.isBettingOpen,
        };
      });

      return changed ? next : previous;
    });
  }, []);

  // El FightHub compartido sigue observando los combates del boleto aunque el
  // usuario abandone la cartelera. Los updates cierran el pick sin esperar a
  // que vuelva a montarse MmaEventsPage.
  useEffect(() => {
    const lifecycles = buildRealtimeLifecycles(fightUpdates, fightClocks);
    if (lifecycles.length === 0) return;

    // oxlint-disable-next-line react/set-state-in-effect -- evento externo de SignalR
    syncEventLifecycle(lifecycles);
  }, [fightClocks, fightUpdates, syncEventLifecycle]);

  // Un mercado liquidado es terminal para sus picks. Se conserva la selección
  // visible (el usuario decide cuándo quitarla) pero el CTA queda bloqueado.
  useEffect(() => {
    if (settledMarkets.size === 0) return;

    // oxlint-disable-next-line react/set-state-in-effect -- evento externo de SignalR
    setSelections((previous) => {
      let changed = false;
      const next = previous.map((selection) => {
        if (!settledMarkets.has(selection.marketId) || selection.marketSettled) {
          return selection;
        }

        changed = true;
        return { ...selection, marketSettled: true };
      });

      return changed ? next : previous;
    });
  }, [settledMarkets]);

  const addSelection = useCallback(
    (input: SelectionInput) => {
      const selection = normalizeSelectionInput(input);
      if (!selection) return;

      // Si el mercado ya se liquidó mientras la UI mostraba una cuota previa,
      // el pick nace bloqueado en lugar de habilitar el CTA por error.
      const accepted = settledMarkets.has(selection.marketId)
        ? { ...selection, marketSettled: true }
        : selection;

      attemptRef.current = null;
      setError(null);
      setReceipt(null);

      // Regla de casa: un pick por combate (reemplaza la cuota previa del evento).
      setSelections((previous) => [
        ...previous.filter(
          (item) =>
            item.eventId !== accepted.eventId &&
            item.selectionId !== accepted.selectionId,
        ),
        accepted,
      ]);
    },
    [settledMarkets],
  );

  const removeSelection = useCallback((selectionId: string) => {
    attemptRef.current = null;
    setError(null);
    setSelections((previous) => previous.filter((item) => item.selectionId !== selectionId));
  }, []);

  const keepOnlySelection = useCallback((selectionId: string) => {
    attemptRef.current = null;
    setError(null);
    setSelections((previous) => previous.filter((item) => item.selectionId === selectionId));
  }, []);

  const clearSelections = useCallback(() => {
    attemptRef.current = null;
    setError(null);
    setSelections([]);
  }, []);

  const acceptLiveOdds = useCallback(() => {
    attemptRef.current = null;
    setError(null);

    setSelections((previous) =>
      previous.map((selection) => {
        const quote = quotes[selection.selectionId];
        return quote && !areOddsEqual(selection.odds, quote.odds)
          ? { ...selection, odds: quote.odds }
          : selection;
      }),
    );
  }, [quotes]);

  const clearError = useCallback(() => setError(null), []);

  const clearReceipt = useCallback(() => {
    setReceipt(null);
    setError(null);
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Envío idempotente                                                       */
  /* ---------------------------------------------------------------------- */

  const placeBet = useCallback(
    async (stake: number, promoCode?: string): Promise<PlaceBetOutcome> => {
      if (placingRef.current) {
        return {
          ok: false,
          error: createBetFailure('UNKNOWN', {
            title: 'Operación en curso',
            message: 'Espera a que se confirme la apuesta actual.',
          }),
        };
      }

      const reject = (failure: BetFailure): PlaceBetOutcome => {
        setError(failure);
        return { ok: false, error: failure };
      };

      if (!isAuthenticated || !user) return reject(createBetFailure('SESSION_REQUIRED'));
      if (liveSelections.length === 0) return reject(createBetFailure('EMPTY_SLIP'));
      if (liveSelections.length > 1) return reject(createBetFailure('COMBINED_NOT_SUPPORTED'));

      const closedSelection = liveSelections.find((selection) =>
        isSelectionEventClosed(selection),
      );
      if (closedSelection) {
        return reject(
          createBetFailure('EVENT_CLOSED', {
            title: closedSelection.marketSettled
              ? 'Mercado cerrado'
              : closedSelection.eventStatus === 'suspended'
                ? 'Combate suspendido'
                : 'Combate finalizado',
            message: closedSelection.marketSettled
              ? `${closedSelection.eventName}: este mercado ya no acepta apuestas. Elimina la selección para continuar.`
              : `${closedSelection.eventName} ya no acepta apuestas. Elimina la selección para continuar.`,
          }),
        );
      }

      if (countPendingOdds(liveSelections) > 0) return reject(createBetFailure('ODDS_CHANGED'));

      const selection = liveSelections[0];
      const normalizedStake = roundMoney(stake);
      const normalizedPromoCode = promoCode?.trim().toUpperCase() || undefined;

      if (!Number.isFinite(normalizedStake) || normalizedStake <= 0) {
        return reject(createBetFailure('INVALID_STAKE'));
      }

      const walletId = resolveWalletId(user);
      if (!walletId) return reject(createBetFailure('WALLET_NOT_LINKED'));

      // Una misma intención (selección + cuota aceptada + stake + promo)
      // reutiliza la llave si el intento anterior murió sin respuesta. Cambiar
      // cualquier dato genera una llave nueva para no reutilizar efectos de
      // negocio.
      const signature = `${selection.selectionId}|${selection.odds.toFixed(2)}|${normalizedStake.toFixed(2)}|${normalizedPromoCode ?? ''}`;
      const idempotencyKey =
        attemptRef.current?.signature === signature
          ? attemptRef.current.key
          : createIdempotencyKey();
      attemptRef.current = { key: idempotencyKey, signature };

      placingRef.current = true;
      setIsPlacingBet(true);
      setError(null);

      try {
        const result = await betService.placeBet({
          walletId,
          selection,
          stake: normalizedStake,
          idempotencyKey,
          promoCode: normalizedPromoCode,
        });

        // La cuota aceptada es la que el usuario vio al confirmar; liveOdds ya
        // coincide porque el envío se bloquea mientras haya cambios pendientes.
        const odds = selection.odds;
        const basePayout = roundMoney(normalizedStake * odds);
        const promo = normalizedPromoCode
          ? resolvePromoCode(normalizedPromoCode)
          : null;
        const promoBonus = promo
          ? calculatePromoBonus(basePayout, normalizedStake, promo.bonusRate)
          : 0;
        const nextReceipt: BetReceipt = {
          betId: result.betId,
          transactionId: result.transactionId,
          stake: normalizedStake,
          odds,
          potentialPayout: roundMoney(basePayout + promoBonus),
          newBalance: result.newBalance,
          selectionCount: 1,
          idempotentReplay: result.idempotentReplay,
          placedAt: Date.now(),
          promoCode: promo?.code,
          promoBonus,
          eventName: selection.eventName,
          selectionName: selection.selectionName,
          marketLabel: selection.marketLabel,
          accountId: String(user.id),
        };

        setReceipt(nextReceipt);

        // Historial de la sesión para el dashboard de billetera. Un replay no
        // vuelve a registrar el movimiento; ya existe en el backend.
        if (!nextReceipt.idempotentReplay && (nextReceipt.betId || nextReceipt.transactionId)) {
          setReceipts((previous) => [nextReceipt, ...previous].slice(0, 25));
        }

        setSelections((previous) =>
          previous.filter((item) => item.selectionId !== selection.selectionId),
        );
        attemptRef.current = null;

        if (result.newBalance !== null) {
          window.dispatchEvent(
            new CustomEvent(BALANCE_UPDATED_EVENT, { detail: result.newBalance }),
          );
        }

        return { ok: true, receipt: nextReceipt };
      } catch (caught) {
        if (!isRetryableBetError(caught)) attemptRef.current = null;
        return reject(describeBetError(caught));
      } finally {
        placingRef.current = false;
        setIsPlacingBet(false);
      }
    },
    [isAuthenticated, user, liveSelections],
  );

  /* ---------------------------------------------------------------------- */
  /* Valor del contexto                                                      */
  /* ---------------------------------------------------------------------- */

  const value = useMemo<BetSlipContextValue>(
    () => ({
      selections: liveSelections,
      quotes,
      hubStatus,
      lastUpdateAt,
      isPlacingBet,
      error,
      receipt,
      receipts,
      setVisibleMarkets,
      syncEventLifecycle,
      addSelection,
      removeSelection,
      keepOnlySelection,
      clearSelections,
      acceptLiveOdds,
      clearError,
      clearReceipt,
      placeBet,
    }),
    [
      liveSelections,
      quotes,
      hubStatus,
      lastUpdateAt,
      isPlacingBet,
      error,
      receipt,
      receipts,
      setVisibleMarkets,
      syncEventLifecycle,
      addSelection,
      removeSelection,
      keepOnlySelection,
      clearSelections,
      acceptLiveOdds,
      clearError,
      clearReceipt,
      placeBet,
    ],
  );

  return <BetSlipContext.Provider value={value}>{children}</BetSlipContext.Provider>;
}

export default BetSlipProvider;
