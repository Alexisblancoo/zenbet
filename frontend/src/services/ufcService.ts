import { apiClient, isProblemDetailsException } from '@/api';
import {
  normalizeEventsPage,
  normalizeFighterComparison,
  type UfcEventsPage,
  type UfcFighterComparison,
} from '@/domain/ufc';

export const UFC_EVENTS_ENDPOINT = '/events';
export const MMA_EVENTS_ENDPOINT = '/mma/events';
export const UFC_FIGHTER_COMPARE_ENDPOINT = '/fighters/compare';
export const UFC_DEFAULT_PAGE_SIZE = 50;
export const UFC_EVENTS_CACHE_EVENT = 'zenbet:ufc-events-cache-updated';

export interface ListUfcEventsOptions {
  readonly signal?: AbortSignal;
  readonly page?: number;
  readonly pageSize?: number;
  readonly competition?: string;
  readonly status?: 'scheduled' | 'live' | 'finished';
  readonly from?: string;
  readonly to?: string;
  readonly forceRefresh?: boolean;
}

interface CachedEntry<T> {
  data: T;
  timestamp: number;
}

const EVENTS_CACHE_KEY = 'zenbet_ufc_events_cache_v1';
const COMPARE_CACHE_PREFIX = 'zenbet_ufc_compare_';
const EVENTS_CACHE_TTL_MS = 60_000; // 1 minuto de validez fresca
const COMPARE_CACHE_TTL_MS = 300_000; // 5 minutos de validez

// Memoria viva (acceso síncrono $O(1)$)
let memoryEventsCache: CachedEntry<UfcEventsPage> | null = null;
const memoryCompareCache = new Map<string, CachedEntry<UfcFighterComparison>>();
const inFlightRequests = new Map<string, Promise<unknown>>();

/**
 * Invalida el caché local de carteleras en memoria y en sessionStorage.
 */
export function clearUfcCache(): void {
  memoryEventsCache = null;
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      window.sessionStorage.removeItem(EVENTS_CACHE_KEY);
    } catch {
      // Ignora errores de sessionStorage
    }
  }
}

/**
 * Lee la cartelera UFC del cache local en memoria o sessionStorage si aún es utilizable.
 * No devuelve entradas vacías para no envenenar la carga inicial con carteleras sin combates.
 */
export function getCachedUfcEvents(): { data: UfcEventsPage; loadedAt: number } | null {
  if (
    memoryEventsCache &&
    memoryEventsCache.data.items.length > 0 &&
    Date.now() - memoryEventsCache.timestamp < EVENTS_CACHE_TTL_MS
  ) {
    return { data: memoryEventsCache.data, loadedAt: memoryEventsCache.timestamp };
  }

  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const raw = window.sessionStorage.getItem(EVENTS_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CachedEntry<UfcEventsPage>;
        if (
          parsed &&
          parsed.data?.items?.length > 0 &&
          Date.now() - parsed.timestamp < EVENTS_CACHE_TTL_MS
        ) {
          memoryEventsCache = parsed;
          return { data: parsed.data, loadedAt: parsed.timestamp };
        }
      }
    } catch {
      // Ignora errores de cuota o parseo
    }
  }

  return memoryEventsCache && memoryEventsCache.data.items.length > 0
    ? { data: memoryEventsCache.data, loadedAt: memoryEventsCache.timestamp }
    : null;
}

/**
 * Lee la ficha técnica comparativa de un combate desde el cache.
 */
export function getCachedFighterComparison(eventId: string): UfcFighterComparison | null {
  const memory = memoryCompareCache.get(eventId);
  if (memory && Date.now() - memory.timestamp < COMPARE_CACHE_TTL_MS) {
    return memory.data;
  }

  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const raw = window.sessionStorage.getItem(`${COMPARE_CACHE_PREFIX}${eventId}`);
      if (raw) {
        const parsed = JSON.parse(raw) as CachedEntry<UfcFighterComparison>;
        if (parsed && Date.now() - parsed.timestamp < COMPARE_CACHE_TTL_MS) {
          memoryCompareCache.set(eventId, parsed);
          return parsed.data;
        }
      }
    } catch {
      // Ignora errores de cuota
    }
  }

  return memory?.data ?? null;
}

/**
 * Prefetch anticipado al hacer hover o focus en el botón "Ficha H2H".
 */
export function prefetchFighterComparison(eventId: string): void {
  if (getCachedFighterComparison(eventId)) return;
  void compareFighters(eventId).catch(() => {
    // Falla silenciosa de prefetch
  });
}

function saveEventsToCache(data: UfcEventsPage): void {
  // Evita persistir respuestas vacías que envenenan la hidratación del frame 0
  if (!data || data.items.length === 0) return;

  const entry: CachedEntry<UfcEventsPage> = { data, timestamp: Date.now() };
  memoryEventsCache = entry;

  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.setItem(EVENTS_CACHE_KEY, JSON.stringify(entry));
      window.dispatchEvent(new CustomEvent(UFC_EVENTS_CACHE_EVENT, { detail: entry }));
    } catch {
      // Silencioso si sessionStorage está lleno
    }
  }
}

function saveCompareToCache(eventId: string, data: UfcFighterComparison): void {
  const entry: CachedEntry<UfcFighterComparison> = { data, timestamp: Date.now() };
  memoryCompareCache.set(eventId, entry);

  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      window.sessionStorage.setItem(`${COMPARE_CACHE_PREFIX}${eventId}`, JSON.stringify(entry));
    } catch {
      // Silencioso
    }
  }
}

/**
 * Lee la cartelera pública y la normaliza en el borde de la capa de datos.
 * Con deduplicación de peticiones concurrentes y cache SWR.
 */
export async function listUfcEvents({
  signal,
  page = 1,
  pageSize = UFC_DEFAULT_PAGE_SIZE,
  competition,
  status,
  from,
  to,
  forceRefresh = false,
}: ListUfcEventsOptions = {}): Promise<UfcEventsPage> {
  const cacheKey = `events_${page}_${pageSize}_${competition ?? ''}_${status ?? ''}_${from ?? ''}_${to ?? ''}`;

  if (forceRefresh) {
    clearUfcCache();
    inFlightRequests.delete(cacheKey);
  } else {
    const ongoing = inFlightRequests.get(cacheKey) as Promise<UfcEventsPage> | undefined;
    if (ongoing) return ongoing;
  }

  const promise = (async () => {
    try {
      let payload: unknown;
      try {
        payload = await apiClient.get<unknown>(UFC_EVENTS_ENDPOINT, {
          params: {
            sport: 'mma',
            page,
            pageSize,
            ...(status ? { status } : {}),
            ...(from ? { from } : {}),
            ...(to ? { to } : {}),
            ...(competition ? { competition } : {}),
          },
          signal,
        });
      } catch {
        // Fallback al endpoint alternativo /mma/events
        payload = await apiClient.get<unknown>(MMA_EVENTS_ENDPOINT, {
          params: {
            page,
            pageSize,
            ...(status ? { status } : {}),
            ...(from ? { from } : {}),
            ...(to ? { to } : {}),
            ...(competition ? { competition } : {}),
          },
          signal,
        });
      }

      const pageResult = normalizeEventsPage(payload);
      saveEventsToCache(pageResult);
      return pageResult;
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();

  inFlightRequests.set(cacheKey, promise);
  return promise;
}

/**
 * Ficha técnica de las dos esquinas del combate. El evento es el identificador
 * estable: el backend resuelve el par y devuelve ambos perfiles y mercados.
 */
export async function compareFighters(
  eventId: string,
  signal?: AbortSignal,
): Promise<UfcFighterComparison> {
  const cached = getCachedFighterComparison(eventId);
  if (cached && !signal) return cached;

  const ongoing = inFlightRequests.get(`compare_${eventId}`) as Promise<UfcFighterComparison> | undefined;
  if (ongoing) return ongoing;

  const promise = (async () => {
    try {
      const payload = await apiClient.get<unknown>(UFC_FIGHTER_COMPARE_ENDPOINT, {
        params: { eventId },
        signal,
      });

      const comparison = normalizeFighterComparison(payload);
      if (!comparison) {
        throw new Error('La API devolvió una ficha Head-to-Head incompleta.');
      }

      saveCompareToCache(eventId, comparison);
      return comparison;
    } finally {
      inFlightRequests.delete(`compare_${eventId}`);
    }
  })();

  inFlightRequests.set(`compare_${eventId}`, promise);
  return promise;
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
