import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { HubConnectionState, type HubConnection } from '@microsoft/signalr';
import { z } from 'zod';
import {
  createOddsHubConnection,
  ODDS_HUB_EVENTS,
  ODDS_HUB_METHODS,
} from '@/services/realtime/oddsHub';
import type { UniversalMatchAnalysis } from '@/modules/Sportsbook/components/UniversalAnalysisCard';

/* ==========================================================================
   1. ESQUEMAS ZOD ESTRICTOS PARA EL PAYLOAD DE SIGNALR (OddsHub)
   ========================================================================== */

export const OddsUpdatePayloadSchema = z.object({
  marketId: z.string().min(1),
  selectionId: z.string().min(1),
  newOdd: z.number().gt(1),
  previousOdd: z.number().gt(1).optional(),
  direction: z.enum(['UP', 'DOWN', 'UNCHANGED']).default('UNCHANGED'),
  timestamp: z.string(),
});

export type OddsUpdatePayload = z.infer<typeof OddsUpdatePayloadSchema>;

export type OddsTrendDirection = 'up' | 'down' | 'neutral';

export interface SelectionTrendState {
  readonly direction: OddsTrendDirection;
  readonly updatedAt: number;
}

export interface UseLiveOddsOptions {
  readonly marketIds?: readonly string[];
  readonly enabled?: boolean;
}

export interface UseLiveOddsReturn {
  readonly isConnected: boolean;
  readonly lastUpdateAt: number | null;
  readonly trends: Readonly<Record<string, SelectionTrendState>>;
  readonly getTrend: (selectionId: string) => OddsTrendDirection;
}

const MARKET_KEY_SEPARATOR = '\u0000';

/* ==========================================================================
   2. HOOK useLiveOdds: IN-MEMORY CACHE PATCHING + RECONCILIACIÓN POR VIEWPORT
   ========================================================================== */

/**
 * Hook `useLiveOdds`: Escucha el canal SignalR `/odds-hub` y aplica parches en tiempo real
 * sobre la caché en memoria de TanStack Query (`queryClient.setQueriesData`).
 *
 * Implementa la arquitectura de sincronización granular inspirada en Stake y Digitain:
 * - Conexión persistente desacoplada del ciclo de scroll o cambio de viewport.
 * - Suscripción/desuscripción en lotes (`JoinMarketGroups`/`LeaveMarketGroups`) calculando
 *   la diferencia de conjuntos (`toJoin` vs `toLeave`).
 * - Watchdog de conexión y re-suscripción automática tras reconexión.
 */
export function useLiveOdds(options: UseLiveOddsOptions = {}): UseLiveOddsReturn {
  const { marketIds = [], enabled = true } = options;
  const queryClient = useQueryClient();

  const connectionRef = useRef<HubConnection | null>(null);
  const subscribedMarketsRef = useRef<Set<string>>(new Set());
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastUpdateAt, setLastUpdateAt] = useState<number | null>(null);
  const [trends, setTrends] = useState<Record<string, SelectionTrendState>>({});

  const marketIdsKey = useMemo(() => marketIds.filter(Boolean).join(MARKET_KEY_SEPARATOR), [marketIds]);

  // Patching en memoria sin latencia de red
  const patchQueryCacheWithNewOdd = useCallback(
    (update: OddsUpdatePayload) => {
      setLastUpdateAt(Date.now());

      // 1. Mutar las queries activas de análisis deportivo ['sportsbook', 'events']
      queryClient.setQueriesData<UniversalMatchAnalysis>(
        { queryKey: ['sportsbook', 'events'] },
        (oldData) => {
          if (!oldData) return oldData;

          // Parcheo polimórfico según deporte
          if (oldData.sportType === 'soccer') {
            const isHome =
              update.selectionId.toLowerCase().includes('home') ||
              update.selectionId === oldData.homeTeam.name;
            const isAway =
              update.selectionId.toLowerCase().includes('away') ||
              update.selectionId === oldData.awayTeam.name;
            const isDraw =
              update.selectionId.toLowerCase().includes('draw') ||
              update.selectionId.toLowerCase().includes('empate');

            return {
              ...oldData,
              odds1X2: {
                ...oldData.odds1X2,
                home: isHome ? update.newOdd : oldData.odds1X2.home,
                draw: isDraw ? update.newOdd : oldData.odds1X2.draw,
                away: isAway ? update.newOdd : oldData.odds1X2.away,
              },
            };
          }

          // Si coincide el pick recomendado de valor
          if (
            oldData.recommendedBetAngle.selectionName.toLowerCase() ===
            update.selectionId.toLowerCase()
          ) {
            return {
              ...oldData,
              recommendedBetAngle: {
                ...oldData.recommendedBetAngle,
                suggestedLine: `${update.newOdd.toFixed(2)}`,
              },
            };
          }

          return oldData;
        }
      );

      // 2. Registrar el marcador efímero de parpadeo (Flash Trend)
      const mappedDirection: OddsTrendDirection =
        update.direction === 'UP' ? 'up' : update.direction === 'DOWN' ? 'down' : 'neutral';

      setTrends((prev) => ({
        ...prev,
        [update.selectionId]: {
          direction: mappedDirection,
          updatedAt: Date.now(),
        },
      }));
    },
    [queryClient]
  );

  // Ciclo de vida persistente de la conexión SignalR (independiente de los cambios de marketIds)
  useEffect(() => {
    if (!enabled) {
      setIsConnected(false);
      return;
    }

    const connection = createOddsHubConnection();
    connectionRef.current = connection;

    // Escuchar el evento oficial del backend ReceiveOddsUpdate
    connection.on(ODDS_HUB_EVENTS.oddsUpdate, (rawPayload: unknown) => {
      let updatePayload: unknown = rawPayload;
      if (typeof rawPayload === 'object' && rawPayload !== null && 'oddsUpdate' in rawPayload) {
        updatePayload = (rawPayload as { oddsUpdate: unknown }).oddsUpdate;
      }

      const result = OddsUpdatePayloadSchema.safeParse(updatePayload);
      if (result.success) {
        patchQueryCacheWithNewOdd(result.data);
      }
    });

    connection.onreconnecting(() => {
      setIsConnected(false);
    });

    connection.onreconnected(async () => {
      setIsConnected(true);
      // Re-suscribirse a todos los mercados activos en bloque
      const currentMarkets = Array.from(subscribedMarketsRef.current);
      if (currentMarkets.length > 0) {
        try {
          await connection.invoke(ODDS_HUB_METHODS.joinMarkets, currentMarkets);
        } catch {
          for (const m of currentMarkets) {
            void connection.invoke(ODDS_HUB_METHODS.joinMarket, m).catch(() => {});
          }
        }
      }
    });

    connection.onclose(() => {
      setIsConnected(false);
    });

    const startHub = async () => {
      try {
        await connection.start();
        setIsConnected(true);

        // Suscribirse a los mercados actuales en lote
        const initialMarkets = Array.from(subscribedMarketsRef.current);
        if (initialMarkets.length > 0) {
          try {
            await connection.invoke(ODDS_HUB_METHODS.joinMarkets, initialMarkets);
          } catch {
            for (const m of initialMarkets) {
              void connection.invoke(ODDS_HUB_METHODS.joinMarket, m).catch(() => {});
            }
          }
        }
      } catch {
        setIsConnected(false);
      }
    };

    void startHub();

    return () => {
      connection.off(ODDS_HUB_EVENTS.oddsUpdate);
      connectionRef.current = null;
      if (connection.state !== HubConnectionState.Disconnected) {
        void connection.stop();
      }
    };
  }, [enabled, patchQueryCacheWithNewOdd]);

  // Sincronización granular incremental de grupos por viewport (batch diffing sin desconexión)
  useEffect(() => {
    const subscribed = subscribedMarketsRef.current;
    const nextSet = new Set(marketIdsKey ? marketIdsKey.split(MARKET_KEY_SEPARATOR) : []);

    const toLeave: string[] = [];
    for (const marketId of Array.from(subscribed)) {
      if (!nextSet.has(marketId)) {
        subscribed.delete(marketId);
        toLeave.push(marketId);
      }
    }

    const toJoin: string[] = [];
    for (const marketId of Array.from(nextSet)) {
      if (!subscribed.has(marketId)) {
        subscribed.add(marketId);
        toJoin.push(marketId);
      }
    }

    const connection = connectionRef.current;
    if (!connection || connection.state !== HubConnectionState.Connected) return;

    if (toLeave.length > 0) {
      connection.invoke(ODDS_HUB_METHODS.leaveMarkets, toLeave).catch(() => {
        for (const m of toLeave) {
          void connection.invoke(ODDS_HUB_METHODS.leaveMarket, m).catch(() => {});
        }
      });
    }

    if (toJoin.length > 0) {
      connection.invoke(ODDS_HUB_METHODS.joinMarkets, toJoin).catch(() => {
        for (const m of toJoin) {
          void connection.invoke(ODDS_HUB_METHODS.joinMarket, m).catch(() => {});
        }
      });
    }
  }, [marketIdsKey]);

  const getTrend = useCallback(
    (selectionId: string): OddsTrendDirection => {
      const record = trends[selectionId];
      if (!record) return 'neutral';
      // La animación de parpadeo se mantiene activa durante 2.5 segundos
      if (Date.now() - record.updatedAt > 2500) return 'neutral';
      return record.direction;
    },
    [trends]
  );

  return { isConnected, lastUpdateAt, trends, getTrend };
}

export default useLiveOdds;
