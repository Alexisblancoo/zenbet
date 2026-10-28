import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  formatFootballMatchTime,
  type FootballLeague,
  type FootballMatch,
  type FootballMatchStatus,
} from '@/domain/football';
import {
  footballService,
  getCachedFootballMatches,
  FOOTBALL_CACHE_UPDATED_EVENT,
  type ListFootballOptions,
} from '@/services/footballService';
import {
  startFootballRealtime,
  stopFootballRealtime,
  FOOTBALL_ODDS_UPDATED_EVENT,
  FOOTBALL_SCORE_UPDATED_EVENT,
  type FootballOddsUpdatePayload,
  type FootballScoreUpdatePayload,
} from '@/services/realtime/footballHub';
import type { LocalFightDateTime } from '@/utils/localTimezone';

export interface UseFootballEventsOptions {
  readonly status?: FootballMatchStatus;
  readonly leagueId?: string;
  readonly autoRefreshIntervalMs?: number;
}

interface FootballEventsState {
  readonly matches: readonly FootballMatch[];
  readonly isLoading: boolean;
  readonly isRevalidating: boolean;
  readonly error: string | null;
  readonly loadedAt: number | null;
}

function getInitialState(options?: UseFootballEventsOptions): FootballEventsState {
  const cached = getCachedFootballMatches();
  if (cached) {
    let filtered = cached.matches;
    if (options?.status) filtered = filtered.filter((m) => m.status === options.status);
    if (options?.leagueId) filtered = filtered.filter((m) => m.league.id === options.leagueId);

    return {
      matches: filtered,
      isLoading: false,
      isRevalidating: true,
      error: null,
      loadedAt: cached.loadedAt,
    };
  }

  return {
    matches: [],
    isLoading: true,
    isRevalidating: false,
    error: null,
    loadedAt: null,
  };
}

/**
 * Hook de Partidos de Fútbol con patrón SWR + Sincronización SignalR en Tiempo Real.
 *
 * Hidratación síncrona en el frame 0 desde el caché en memoria para evitar
 * pantallas en blanco, revalidando en segundo plano, escuchando actualizaciones
 * en directo vía SignalR y disparando el destello neón Shibuya Lime (#D4FF3F).
 */
export function useFootballEvents(options: UseFootballEventsOptions = {}) {
  const { status, leagueId, autoRefreshIntervalMs } = options;

  const [state, setState] = useState<FootballEventsState>(() => getInitialState(options));
  const [reloadToken, setReloadToken] = useState(0);
  const [flashingSelectionIds, setFlashingSelectionIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  // Inicia la conexión SignalR y el ticker de tiempo real
  useEffect(() => {
    void startFootballRealtime();
    return () => {
      stopFootballRealtime();
    };
  }, []);

  // Escucha actualizaciones en directo de cuotas por SignalR
  useEffect(() => {
    const handleOddsUpdate = (event: Event) => {
      const payload = (event as CustomEvent<FootballOddsUpdatePayload>).detail;
      if (!payload || !payload.selectionId) return;

      const { selectionId, odds } = payload;

      // Activa destello Shibuya Lime temporal en la ficha
      setFlashingSelectionIds((prev) => new Set([...prev, selectionId]));
      const timer = window.setTimeout(() => {
        setFlashingSelectionIds((prev) => {
          const next = new Set(prev);
          next.delete(selectionId);
          return next;
        });
      }, 1200);

      // Actualiza la cuota en el estado del partido correspondiente
      setState((prev) => ({
        ...prev,
        matches: prev.matches.map((match) => ({
          ...match,
          markets: match.markets.map((market) => ({
            ...market,
            selections: market.selections.map((sel) =>
              sel.id === selectionId ? { ...sel, decimalOdds: odds } : sel,
            ),
          })),
        })),
      }));

      return () => window.clearTimeout(timer);
    };

    const handleScoreUpdate = (event: Event) => {
      const payload = (event as CustomEvent<FootballScoreUpdatePayload>).detail;
      if (!payload || !payload.matchId) return;

      const { matchId, homeScore, awayScore, minute, period } = payload;

      setState((prev) => ({
        ...prev,
        matches: prev.matches.map((match) => {
          if (match.id !== matchId) return match;
          return {
            ...match,
            status: 'live',
            scores: {
              ...match.scores,
              home: homeScore,
              away: awayScore,
            },
            clock: match.clock
              ? {
                  ...match.clock,
                  minute,
                  label: `${minute}'`,
                }
              : {
                  minute,
                  period: 'second_half',
                  isRunning: true,
                  label: `${minute}'`,
                },
          };
        }),
      }));
    };

    window.addEventListener(FOOTBALL_ODDS_UPDATED_EVENT, handleOddsUpdate);
    window.addEventListener(FOOTBALL_SCORE_UPDATED_EVENT, handleScoreUpdate);

    return () => {
      window.removeEventListener(FOOTBALL_ODDS_UPDATED_EVENT, handleOddsUpdate);
      window.removeEventListener(FOOTBALL_SCORE_UPDATED_EVENT, handleScoreUpdate);
    };
  }, []);

  // Escucha actualizaciones emitidas por el bus de eventos de caché
  useEffect(() => {
    const handleCacheUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ data: readonly FootballMatch[]; timestamp: number }>)
        .detail;

      if (detail?.data) {
        let filtered = detail.data;
        if (status) filtered = filtered.filter((m) => m.status === status);
        if (leagueId) filtered = filtered.filter((m) => m.league.id === leagueId);

        setState((previous) => ({
          ...previous,
          matches: filtered,
          isLoading: false,
          isRevalidating: false,
          error: null,
          loadedAt: detail.timestamp,
        }));
      }
    };

    window.addEventListener(FOOTBALL_CACHE_UPDATED_EVENT, handleCacheUpdate);
    return () => window.removeEventListener(FOOTBALL_CACHE_UPDATED_EVENT, handleCacheUpdate);
  }, [status, leagueId]);

  // Carga y revalidación en segundo plano
  useEffect(() => {
    const controller = new AbortController();

    const fetchMatches = async (isManualReload = false) => {
      setState((previous) => ({
        ...previous,
        isRevalidating: true,
        isLoading: previous.matches.length === 0,
        error: isManualReload ? null : previous.error,
      }));

      try {
        const listOptions: ListFootballOptions = {
          status,
          leagueId,
          signal: controller.signal,
          forceRefresh: isManualReload,
        };

        const result = await footballService.listMatches(listOptions);
        if (controller.signal.aborted) return;

        setState({
          matches: result,
          isLoading: false,
          isRevalidating: false,
          error: null,
          loadedAt: Date.now(),
        });
      } catch (caught) {
        if (controller.signal.aborted) return;

        setState((previous) => ({
          ...previous,
          isLoading: false,
          isRevalidating: false,
          error:
            previous.matches.length === 0
              ? caught instanceof Error
                ? caught.message
                : 'No se pudo cargar la cartelera de fútbol.'
              : null,
        }));
      }
    };

    void fetchMatches(reloadToken > 0);

    return () => controller.abort();
  }, [status, leagueId, reloadToken]);

  // Polling automático opcional para partidos en vivo
  useEffect(() => {
    if (!autoRefreshIntervalMs || autoRefreshIntervalMs <= 0) return;

    const timer = window.setInterval(() => {
      setReloadToken((t) => t + 1);
    }, autoRefreshIntervalMs);

    return () => window.clearInterval(timer);
  }, [autoRefreshIntervalMs]);

  const reload = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  // Filtros derivados
  const liveMatches = useMemo(
    () => state.matches.filter((match) => match.status === 'live'),
    [state.matches],
  );

  const upcomingMatches = useMemo(
    () => state.matches.filter((match) => match.status === 'upcoming'),
    [state.matches],
  );

  const finishedMatches = useMemo(
    () => state.matches.filter((match) => match.status === 'finished'),
    [state.matches],
  );

  const leagues = useMemo(() => {
    const map = new Map<string, FootballLeague>();
    for (const match of state.matches) {
      if (!map.has(match.league.id)) {
        map.set(match.league.id, match.league);
      }
    }
    return Array.from(map.values());
  }, [state.matches]);

  const getMatchLocalTime = useCallback(
    (startTimeUTC: string): LocalFightDateTime => {
      return formatFootballMatchTime(startTimeUTC);
    },
    [],
  );

  return {
    matches: state.matches,
    liveMatches,
    upcomingMatches,
    finishedMatches,
    leagues,
    flashingSelectionIds,
    isLoading: state.isLoading,
    isRevalidating: state.isRevalidating,
    error: state.error,
    loadedAt: state.loadedAt,
    reload,
    getMatchLocalTime,
  } as const;
}
