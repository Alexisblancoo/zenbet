import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';

import { createIdempotencyKey } from '@/api';
import { BALANCE_UPDATED_EVENT, useAuth } from '@/context/authState';
import {
  areOddsEqual,
  countPendingOdds,
  normalizeSelectionInput,
  roundMoney,
  type BetFailure,
  type BetReceipt,
  type BetSelection,
  type LiveBetSelection,
  type PlaceBetOutcome,
  type SelectionInput,
} from '@/domain/bets';
import { useOddsHub } from '@/hooks/useOddsHub';
import {
  betService,
  createBetFailure,
  describeBetError,
  isRetryableBetError,
  resolveWalletId,
} from '@/services/betService';

import { BetSlipContext, type BetSlipContextValue } from './betSlipState';

/**
 * BetSlipProvider — estado global del boleto + única conexión SignalR.
 *
 * El hub se comparte con la cartelera (no se abre una conexión por componente)
 * y sus cuotas se cruzan con la cuota aceptada de cada selección. La alerta de
 * "cuota cambiada" es, por tanto, una comparación derivada, sin efectos que
 * encadenen renders.
 */

interface AttemptKey {
  readonly key: string;
  readonly signature: string;
}

export function BetSlipProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();

  const [selections, setSelections] = useState<readonly BetSelection[]>([]);
  const [visibleMarkets, setVisibleMarketsState] = useState<readonly string[]>([]);
  const [isPlacingBet, setIsPlacingBet] = useState(false);
  const [error, setError] = useState<BetFailure | null>(null);
  const [receipt, setReceipt] = useState<BetReceipt | null>(null);

  const attemptRef = useRef<AttemptKey | null>(null);
  const placingRef = useRef(false);

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
    lastUpdateAt,
  } = useOddsHub({
    markets: activeMarkets,
    enabled: isAuthenticated && activeMarkets.length > 0,
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

  const addSelection = useCallback((input: SelectionInput) => {
    const selection = normalizeSelectionInput(input);
    if (!selection) return;

    attemptRef.current = null;
    setError(null);
    setReceipt(null);

    // Regla de casa: un pick por combate (reemplaza la cuota previa del evento).
    setSelections((previous) => [
      ...previous.filter(
        (item) => item.eventId !== selection.eventId && item.selectionId !== selection.selectionId,
      ),
      selection,
    ]);
  }, []);

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
    async (stake: number): Promise<PlaceBetOutcome> => {
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
      if (countPendingOdds(liveSelections) > 0) return reject(createBetFailure('ODDS_CHANGED'));

      const selection = liveSelections[0];
      const normalizedStake = roundMoney(stake);

      if (!Number.isFinite(normalizedStake) || normalizedStake <= 0) {
        return reject(createBetFailure('INVALID_STAKE'));
      }

      const walletId = resolveWalletId(user);
      if (!walletId) return reject(createBetFailure('WALLET_NOT_LINKED'));

      // Una misma intención (selección + cuota aceptada + stake) reutiliza la
      // llave si el intento anterior murió sin respuesta. Cambiar cualquier
      // dato genera una llave nueva para no reutilizar efectos de negocio.
      const signature = `${selection.selectionId}|${selection.odds.toFixed(2)}|${normalizedStake.toFixed(2)}`;
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
        });

        // La cuota aceptada es la que el usuario vio al confirmar; liveOdds ya
        // coincide porque el envío se bloquea mientras haya cambios pendientes.
        const odds = selection.odds;
        const nextReceipt: BetReceipt = {
          betId: result.betId,
          transactionId: result.transactionId,
          stake: normalizedStake,
          odds,
          potentialPayout: roundMoney(normalizedStake * odds),
          newBalance: result.newBalance,
          selectionCount: 1,
          idempotentReplay: result.idempotentReplay,
          placedAt: Date.now(),
        };

        setReceipt(nextReceipt);
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
      setVisibleMarkets,
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
      setVisibleMarkets,
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
