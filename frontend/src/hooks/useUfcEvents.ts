import { useCallback, useEffect, useState } from 'react';

import type { UfcEventsPage } from '@/domain/ufc';
import {
  describeUfcLoadError,
  getCachedUfcEvents,
  listUfcEvents,
  UFC_EVENTS_CACHE_EVENT,
} from '@/services/ufcService';

interface UfcEventsState {
  readonly data: UfcEventsPage | null;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly loadedAt: number | null;
}

function getInitialState(): UfcEventsState {
  const cached = getCachedUfcEvents();
  if (cached) {
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
 * Ventana de carga: ayer para no perder una cartelera que terminó tarde y una
 * semana hacia adelante para que el selector tenga contexto. No se filtra por
 * estado para conservar los combates en vivo y finalizados del día.
 */
function loadWindow(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1),
  );
  const to = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 8),
  );

  return { from: from.toISOString(), to: to.toISOString() };
}

/**
 * Carga la cartelera pública con patrón SWR (Stale-While-Revalidate).
 * Si hay datos en caché en memoria o sesión, se hidratan en el frame 0 (sin spinner),
 * revalidando en segundo plano de manera transparente.
 */
export function useUfcEvents() {
  const [state, setState] = useState<UfcEventsState>(getInitialState);
  const [reloadToken, setReloadToken] = useState(0);

  // Escucha actualizaciones emitidas por otras partes de la app
  useEffect(() => {
    const handleCacheUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ data: UfcEventsPage; timestamp: number }>).detail;
      if (detail?.data) {
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

  useEffect(() => {
    const controller = new AbortController();
    const { from, to } = loadWindow();

    void listUfcEvents({ signal: controller.signal, from, to, pageSize: 100 })
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
          // Si ya teníamos datos cacheados, conservarlos en error transitorio
          isLoading: false,
          error: previous.data ? null : describeUfcLoadError(error),
        }));
      });

    return () => controller.abort();
  }, [reloadToken]);

  const reload = useCallback(() => {
    setState((previous) => ({
      ...previous,
      isLoading: !previous.data,
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
