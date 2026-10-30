import { useCallback, useEffect, useMemo, useState } from 'react';

import type { UfcEventsPage } from '@/domain/ufc';
import {
  clearUfcCache,
  describeUfcLoadError,
  getCachedUfcEvents,
  listUfcEvents,
  UFC_EVENTS_CACHE_EVENT,
} from '@/services/ufcService';

export interface UseUfcEventsOptions {
  readonly from?: string;
  readonly to?: string;
  readonly pageSize?: number;
  readonly status?: 'scheduled' | 'live' | 'finished';
  readonly competition?: string;
}

interface UfcEventsState {
  readonly data: UfcEventsPage | null;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly loadedAt: number | null;
}

function getInitialState(): UfcEventsState {
  const cached = getCachedUfcEvents();
  if (cached && cached.data.items.length > 0) {
    return {
      data: cached.data,
      isLoading: false,
      error: null,
      loadedAt: cached.loadedAt,
    };
  }

  return {
    data: null,
    isLoading: true,
    error: null,
    loadedAt: null,
  };
}

const EMPTY_EVENTS: UfcEventsPage['items'] = [];

/**
 * Ventana de carga por defecto:
 * - `from`: 14 días atrás para conservar eventos y carteleras recientemente finalizadas.
 * - `to`: 90 días hacia adelante para capturar todos los eventos numerados (UFC 334, etc.)
 *   y Fight Nights programados en el calendario de la base de datos.
 */
function loadDefaultWindow(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 14),
  );
  const to = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 90),
  );

  return { from: from.toISOString(), to: to.toISOString() };
}

/**
 * Carga la cartelera pública de UFC / MMA con patrón SWR (Stale-While-Revalidate).
 * Si hay datos en caché en memoria o sesión con combates válidos, se hidratan
 * en el frame 0, revalidando contra la API en segundo plano sin bloquear la UI.
 */
export function useUfcEvents(options: UseUfcEventsOptions = {}) {
  const [state, setState] = useState<UfcEventsState>(getInitialState);
  const [reloadToken, setReloadToken] = useState(0);

  const defaultDates = useMemo(loadDefaultWindow, []);
  const from = options.from ?? defaultDates.from;
  const to = options.to ?? defaultDates.to;
  const pageSize = options.pageSize ?? 100;
  const status = options.status;
  const competition = options.competition;

  // Escucha actualizaciones emitidas por el bus de eventos de caché
  useEffect(() => {
    const handleCacheUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ data: UfcEventsPage; timestamp: number }>).detail;
      if (detail?.data && detail.data.items.length > 0) {
        setState((previous) => ({
          ...previous,
          data: detail.data,
          isLoading: false,
          error: null,
          loadedAt: detail.timestamp,
        }));
      }
    };

    window.addEventListener(UFC_EVENTS_CACHE_EVENT, handleCacheUpdate);
    return () => window.removeEventListener(UFC_EVENTS_CACHE_EVENT, handleCacheUpdate);
  }, []);

  // Petición REST inicial y revalidación en segundo plano
  useEffect(() => {
    const controller = new AbortController();

    void listUfcEvents({
      signal: controller.signal,
      from,
      to,
      pageSize,
      status,
      competition,
      forceRefresh: reloadToken > 0,
    })
      .then((data) => {
        if (controller.signal.aborted) return;

        setState({
          data,
          isLoading: false,
          error: null,
          loadedAt: Date.now(),
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;

        setState((previous) => ({
          ...previous,
          isLoading: false,
          error:
            previous.data && previous.data.items.length > 0
              ? null
              : describeUfcLoadError(error),
        }));
      });

    return () => controller.abort();
  }, [from, to, pageSize, status, competition, reloadToken]);

  const reload = useCallback(() => {
    clearUfcCache();
    setState((previous) => ({
      ...previous,
      isLoading: !previous.data || previous.data.items.length === 0,
      error: null,
    }));
    setReloadToken((token) => token + 1);
  }, []);

  return {
    data: state.data,
    events: state.data?.items ?? EMPTY_EVENTS,
    isLoading: state.isLoading,
    error: state.error,
    loadedAt: state.loadedAt,
    reload,
  } as const;
}
