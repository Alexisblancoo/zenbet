import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import axios from 'axios';
import { z } from 'zod';
import { http } from '@/api/client';
import {
  UniversalMatchAnalysisSchema,
  type UniversalMatchAnalysis,
  type SportType,
  MOCK_SOCCER_ANALYSIS,
  MOCK_BASKETBALL_ANALYSIS,
  MOCK_TENNIS_ANALYSIS,
  MOCK_BOXING_ANALYSIS,
} from '@/modules/Sportsbook/components/UniversalAnalysisCard';

/* ==========================================================================
   1. ERRORES DE CONTRATO ZOD (Para consumo por ErrorBoundary de React)
   ========================================================================== */

export class ZodContractViolationError extends Error {
  public readonly issues: z.ZodIssue[];
  public readonly rawPayload: unknown;

  constructor(message: string, issues: z.ZodIssue[], rawPayload: unknown) {
    super(message);
    this.name = 'ZodContractViolationError';
    this.issues = issues;
    this.rawPayload = rawPayload;
    Object.setPrototypeOf(this, ZodContractViolationError.prototype);
  }
}

/* ==========================================================================
   2. REPOSITORIO DE DATOS FALLBACK / DEMO
   ========================================================================== */

const FALLBACK_SPORT_DATA: Record<SportType, UniversalMatchAnalysis> = {
  soccer: MOCK_SOCCER_ANALYSIS,
  basketball: MOCK_BASKETBALL_ANALYSIS,
  tennis: MOCK_TENNIS_ANALYSIS,
  boxing: MOCK_BOXING_ANALYSIS,
};

/* ==========================================================================
   3. DATA FETCHING CON PARSEO ESTRICTO DE AXIOS + ZOD
   ========================================================================== */

/**
 * Consulta la telemetría y análisis predictivo del deporte mediante Axios,
 * aplicando safeParse estricto de Zod antes de entregar la información al estado.
 */
export async function fetchSportEventsAnalysis(
  sportType: SportType,
): Promise<UniversalMatchAnalysis> {
  let rawData: unknown;

  try {
    // Intento de conexión al backend de ZenBet (.NET 10 API)
    const response = await http.get(`/sportsbook/events/${sportType}`);
    rawData = response.data;
  } catch (error) {
    // En entornos de prueba, fallback o si el endpoint aún no está expuesto en backend
    if (axios.isAxiosError(error) && (!error.response || error.response.status === 404)) {
      rawData = FALLBACK_SPORT_DATA[sportType];
    } else {
      // Si la API respondió un error 500/401/403 real, se propaga
      throw error;
    }
  }

  // REGLA DE ORO: safeParse estricto antes de entregar al frontend
  const parseResult = UniversalMatchAnalysisSchema.safeParse(rawData);

  if (!parseResult.success) {
    const errorDetails = parseResult.error.issues
      .map((issue) => `[${issue.path.join('.') || 'root'}]: ${issue.message}`)
      .join(' | ');

    throw new ZodContractViolationError(
      `[Zod Contract Failure] La respuesta para el deporte '${sportType}' no cumple el esquema dimensional: ${errorDetails}`,
      parseResult.error.issues,
      rawData,
    );
  }

  return parseResult.data;
}

/* ==========================================================================
   4. HOOK TANSTACK QUERY: useGetEvents
   ========================================================================== */

export interface UseGetEventsOptions {
  enabled?: boolean;
  refetchInterval?: number | false;
  staleTime?: number;
}

/**
 * Hook `useGetEvents`: Carga y sincroniza la telemetría deportiva mediante React Query v5.
 * Reemplaza directamente los mocks estáticos de UniversalAnalysisCard.
 *
 * @param sportType - Deporte activo ('soccer' | 'basketball' | 'tennis' | 'boxing')
 * @param options - Opciones de configuración de TanStack Query
 */
export function useGetEvents(
  sportType: SportType = 'soccer',
  options?: UseGetEventsOptions,
): UseQueryResult<UniversalMatchAnalysis, Error> {
  return useQuery<UniversalMatchAnalysis, Error>({
    queryKey: ['sportsbook', 'events', sportType],
    queryFn: () => fetchSportEventsAnalysis(sportType),
    staleTime: options?.staleTime ?? 1000 * 60 * 2, // 2 minutos de frescura
    refetchInterval: options?.refetchInterval ?? false,
    enabled: options?.enabled ?? true,
    retry: (failureCount, error) => {
      // Si es un error de violación de contrato Zod, no reintentar (es determinista)
      if (error instanceof ZodContractViolationError) {
        return false;
      }
      return failureCount < 2;
    },
  });
}

