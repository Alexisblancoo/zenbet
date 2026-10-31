import React, { createContext, useContext, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  TrackingEventSchema,
  type TrackingEvent,
  type TrackingEnvelope,
} from './telemetrySchema';
import { API_BASE_URL } from '@/api/client';
import { authToken } from '@/api/authToken';

export interface TelemetryContextValue {
  readonly trackEvent: (event: TrackingEvent) => void;
  readonly flushNow: () => Promise<void>;
  readonly sessionId: string;
}

const TelemetryContext = createContext<TelemetryContextValue | null>(null);

const FLUSH_INTERVAL_MS = 4000;
const MAX_BUFFER_SIZE = 25;

export interface TelemetryProviderProps {
  readonly children: React.ReactNode;
  readonly customEndpoint?: string;
}

/**
 * Proveedor de telemetría de alto rendimiento para auditoría, anti-fraude y retención.
 *
 * - Valida cada evento mediante Zod en tiempo de ejecución.
 * - Amortigua eventos en un buffer en memoria para no degradar el framerate de la UI.
 * - Despacha lotes mediante `navigator.sendBeacon` o `fetch` con `keepalive: true`.
 * - Se vacía automáticamente al ocultar la pestaña o descargar la página (`visibilitychange`).
 */
export function TelemetryProvider({
  children,
  customEndpoint,
}: TelemetryProviderProps): React.ReactElement {
  const bufferRef = useRef<TrackingEvent[]>([]);
  const sessionIdRef = useRef<string>(
    `sess-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  );

  const endpointUrl = useMemo(
    () => customEndpoint ?? `${API_BASE_URL}/telemetry/events`,
    [customEndpoint]
  );

  const flush = useCallback(async () => {
    if (bufferRef.current.length === 0) return;

    const eventsToDispatch = [...bufferRef.current];
    bufferRef.current = [];

    const envelope: TrackingEnvelope = {
      context: {
        sessionId: sessionIdRef.current,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown-Agent',
        currentPath: typeof window !== 'undefined' ? window.location.pathname : '/',
        timestamp: new Date().toISOString(),
      },
      events: eventsToDispatch,
    };

    const payloadString = JSON.stringify(envelope);

    try {
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        const blob = new Blob([payloadString], { type: 'application/json' });
        const queued = navigator.sendBeacon(endpointUrl, blob);
        if (queued) return;
      }

      await fetch(endpointUrl, {
        method: 'POST',
        body: payloadString,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken.get() ?? ''}`,
        },
        keepalive: true,
      }).catch(() => {
        // En caso de que el backend de telemetría no esté disponible en local, no rompemos la app
      });
    } catch {
      // Ignorar fallos de telemetría silenciosamente para no interrumpir el flujo de juego
    }
  }, [endpointUrl]);

  const trackEvent = useCallback(
    (event: TrackingEvent) => {
      // Regla de Oro: Validación estricta con safeParse antes de encolar
      const parsed = TrackingEventSchema.safeParse(event);
      if (!parsed.success) {
        if (import.meta.env.DEV) {
          console.warn('[ZenBet Telemetry Validation Ignored]', parsed.error.issues, event);
        }
        return;
      }

      bufferRef.current.push(parsed.data);

      if (bufferRef.current.length >= MAX_BUFFER_SIZE) {
        void flush();
      }
    },
    [flush]
  );

  useEffect(() => {
    const timer = setInterval(() => {
      void flush();
    }, FLUSH_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        void flush();
      }
    };

    const handlePageHide = () => {
      void flush();
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      clearInterval(timer);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      void flush();
    };
  }, [flush]);

  const value = useMemo<TelemetryContextValue>(
    () => ({
      trackEvent,
      flushNow: flush,
      sessionId: sessionIdRef.current,
    }),
    [trackEvent, flush]
  );

  return <TelemetryContext.Provider value={value}>{children}</TelemetryContext.Provider>;
}

/** Hook `useTelemetry` para inyectar eventos de tracking sin acoplar componentes visuales */
export function useTelemetry(): TelemetryContextValue {
  const ctx = useContext(TelemetryContext);
  if (!ctx) {
    throw new Error('useTelemetry debe ser utilizado dentro del árbol de un <TelemetryProvider>.');
  }
  return ctx;
}

export default TelemetryProvider;

