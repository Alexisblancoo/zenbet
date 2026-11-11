import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { z } from 'zod';
import { http } from '@/api/client';
import {
  UniversalMatchAnalysisSchema,
  type UniversalMatchAnalysis,
  type SportType,
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
   2. DATA FETCHING CON PARSEO ESTRICTO DE AXIOS + ZOD
   ========================================================================== */

/**
 * Consulta la telemetría y análisis predictivo del deporte mediante Axios,
 * aplicando safeParse estricto de Zod antes de entregar la información al estado.
 *
 * Si la API no tiene el endpoint (404) o no responde, la consulta falla: no se
 * sustituye por fixtures. Un análisis inventado nunca debe llegar a la UI.
 */
export async function fetchSportEventsAnalysis(
  sportType: SportType,
): Promise<UniversalMatchAnalysis> {
  // Cualquier error de red o HTTP se propaga a React Query.
  const response = await http.get(`/sportsbook/events/${sportType}`);
  const rawData: unknown = response.data;

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
   3. HOOK TANSTACK QUERY: useGetEvents
   ========================================================================== */

export interface UseGetEventsOptions {
  enabled?: boolean;
  refetchInterval?: number | false;
  staleTime?: number;
}

/**
 * Hook `useGetEvents`: Carga y sincroniza la telemetría deportiva mediante React Query v5.
 * Sin respuesta válida del backend la consulta queda en error; nunca sirve fixtures.
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

