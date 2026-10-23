import { apiClient, isProblemDetailsException } from '@/api';
import { normalizeEventsPage, type UfcEventsPage } from '@/domain/ufc';

export const UFC_EVENTS_ENDPOINT = '/events';
export const UFC_DEFAULT_PAGE_SIZE = 50;

export interface ListUfcEventsOptions {
  readonly signal?: AbortSignal;
  readonly page?: number;
  readonly pageSize?: number;
  readonly competition?: string;
  readonly status?: 'scheduled' | 'live' | 'finished';
}

/**
 * Lee la cartelera pública y la normaliza en el borde de la capa de datos.
 * `normalizeEventsPage` conserva `line`, `source` y las cuotas de cuatro
 * decimales que publica la API; la UI decide cómo presentarlas.
 */
export async function listUfcEvents({
  signal,
  page = 1,
  pageSize = UFC_DEFAULT_PAGE_SIZE,
  competition,
  status = 'scheduled',
}: ListUfcEventsOptions = {}): Promise<UfcEventsPage> {
  const payload = await apiClient.get<unknown>(UFC_EVENTS_ENDPOINT, {
    // `apiClient` ya incluye /api/v1 en la base URL.
    params: {
      sport: 'mma',
      status,
      page,
      pageSize,
      ...(competition ? { competition } : {}),
    },
    signal,
  });

  return normalizeEventsPage(payload);
}

export function describeUfcLoadError(error: unknown): string {
  if (isProblemDetailsException(error)) {
    if (error.isNetworkError || error.isTimeout) {
      return 'No se pudo conectar con la API de eventos. Comprueba que el backend esté activo.';
    }

    return error.detail ?? error.title ?? 'La API rechazó la consulta de la cartelera.';
  }

  if (error instanceof Error && error.message) return error.message;
  return 'No se pudo cargar la cartelera UFC.';
}
