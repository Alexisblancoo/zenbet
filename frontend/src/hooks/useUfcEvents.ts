import { useCallback, useEffect, useState } from 'react';

import type { UfcEventsPage } from '@/domain/ufc';
import { describeUfcLoadError, listUfcEvents } from '@/services/ufcService';

interface UfcEventsState {
  readonly data: UfcEventsPage | null;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly loadedAt: number | null;
}

const INITIAL_STATE: UfcEventsState = {
  data: null,
  isLoading: true,
  error: null,
  loadedAt: null,
};

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
 * Carga la cartelera pública. La petición se cancela al desmontar y el botón
 * de reintento crea una petición nueva sin recargar la página.
 */
export function useUfcEvents() {
  const [state, setState] = useState<UfcEventsState>(INITIAL_STATE);
  const [reloadToken, setReloadToken] = useState(0);

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
          isLoading: false,
          error: describeUfcLoadError(error),
        }));
      });

    return () => controller.abort();
  }, [reloadToken]);

  const reload = useCallback(() => {
    setState((previous) => ({
      ...previous,
      isLoading: true,
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
