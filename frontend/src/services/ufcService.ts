import { apiClient, isProblemDetailsException } from '@/api';
import { normalizeEventsPage, type UfcEventsPage } from '@/domain/ufc';

export const UFC_EVENTS_ENDPOINT = '/events';

export interface ListUfcEventsOptions {
  readonly signal?: AbortSignal;
  readonly pageSize?: number;
  readonly competition?: string;
}

export async function listUfcEvents({
  signal,
  pageSize = 50,
  competition,
}: ListUfcEventsOptions = {}): Promise<UfcEventsPage> {
  const payload = await apiClient.get<unknown>(UFC_EVENTS_ENDPOINT, {
    // `apiClient` ya incluye /api/v1 en la base URL.
    params: {
      sport: 'mma',
      status: 'scheduled',
      page: 1,
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
