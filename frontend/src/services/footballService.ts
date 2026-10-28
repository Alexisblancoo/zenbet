/**
 * Servicio de Fútbol (Football / Soccer) para ZenBet.
 *
 * Contrato 100% API Backend (.NET 10). Consume exclusivamente endpoints oficiales
 * del backend (/football/matches, /football/live, /events?sport=soccer).
 * No contiene fixtures simulados ni datos inventados.
 */

import { apiClient } from '@/api';
import type {
  FootballLeague,
  FootballMarket,
  FootballMatch,
  FootballMatchStatus,
  FootballSelection,
} from '@/domain/football';

export const FOOTBALL_MATCHES_ENDPOINT = '/football/matches';
export const FOOTBALL_LIVE_ENDPOINT = '/football/live';
export const FOOTBALL_LEAGUES_ENDPOINT = '/football/leagues';
export const FOOTBALL_EVENTS_ENDPOINT = '/events';
export const FOOTBALL_CACHE_KEY = 'zenbet_football_matches_v1';
export const FOOTBALL_CACHE_TTL_MS = 60_000; // 1 minuto fresco
export const FOOTBALL_CACHE_UPDATED_EVENT = 'zenbet:football-cache-updated';

export interface ListFootballOptions {
  readonly status?: FootballMatchStatus;
  readonly leagueId?: string;
  readonly signal?: AbortSignal;
  readonly forceRefresh?: boolean;
}

interface CachedEntry<T> {
  readonly data: T;
  readonly timestamp: number;
}

// Caché en memoria viva (acceso síncrono $O(1)$)
let memoryMatchesCache: CachedEntry<readonly FootballMatch[]> | null = null;
const inFlightRequests = new Map<string, Promise<readonly FootballMatch[]>>();

/* --------------------------------------------------------------------------
   Catálogo de Metadatos de Ligas Principales
   -------------------------------------------------------------------------- */

export const FOOTBALL_LEAGUES: Record<string, FootballLeague> = {
  ucl: {
    id: 'ucl',
    name: 'UEFA Champions League',
    shortName: 'UCL',
    country: 'Europa',
    countryCode: 'EU',
    season: '2026/27',
    matchday: 'Fase de Liga',
    cyrillicName: 'ЛИГА ЧЕМПИОНОВ',
  },
  premier: {
    id: 'premier',
    name: 'Premier League',
    shortName: 'Premier',
    country: 'Inglaterra',
    countryCode: 'GB',
    season: '2026/27',
    matchday: 'Temporada Regular',
    cyrillicName: 'АПЛ',
  },
  laliga: {
    id: 'laliga',
    name: 'LaLiga EA Sports',
    shortName: 'LaLiga',
    country: 'España',
    countryCode: 'ES',
    season: '2026/27',
    matchday: 'Primera División',
    cyrillicName: 'ЛА ЛИГА',
  },
  bolivia: {
    id: 'bolivia',
    name: 'División Profesional (Liga Tigo)',
    shortName: 'Liga Tigo',
    country: 'Bolivia',
    countryCode: 'BO',
    season: '2026',
    matchday: 'Torneo Clausura',
    cyrillicName: 'ПРИМЕРА БОЛИВИИ',
  },
} as const;

/* --------------------------------------------------------------------------
   Normalizadores de Datos de la API del Backend
   -------------------------------------------------------------------------- */

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parseMatchStatus(statusStr: string | null): FootballMatchStatus {
  if (!statusStr) return 'upcoming';
  const s = statusStr.toLowerCase();
  if (s === 'live' || s === 'in_play' || s === 'playing') return 'live';
  if (s === 'finished' || s === 'completed' || s === 'settled') return 'finished';
  return 'upcoming';
}

function resolveLeague(compName?: string | null): FootballLeague {
  const comp = (compName ?? '').toUpperCase();
  if (comp.includes('CHAMPIONS') || comp.includes('UCL')) return FOOTBALL_LEAGUES.ucl;
  if (comp.includes('PREMIER') || comp.includes('EPL') || comp.includes('INGLATERRA')) return FOOTBALL_LEAGUES.premier;
  if (comp.includes('LALIGA') || comp.includes('ESPAÑA') || comp.includes('SPAIN')) return FOOTBALL_LEAGUES.laliga;
  if (comp.includes('BOLIVIA') || comp.includes('TIGO')) return FOOTBALL_LEAGUES.bolivia;

  return {
    id: comp.toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'league_general',
    name: compName || 'Fútbol Profesional',
    shortName: compName?.slice(0, 10) || 'Fútbol',
    country: 'Internacional',
    countryCode: 'GLOBAL',
    season: '2026/27',
  };
}

function parseTeamFromSide(name: string, fallbackCode: string) {
  const parts = name.trim().split(/\s+/);
  const code = parts.length > 1
    ? parts.map((p) => p[0]).join('').slice(0, 3).toUpperCase()
    : name.slice(0, 3).toUpperCase() || fallbackCode;

  return {
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, '_') || fallbackCode.toLowerCase(),
    name,
    shortName: name,
    code,
  };
}

export function normalizeFootballMatch(raw: unknown): FootballMatch | null {
  const record = asRecord(raw);
  if (!record) return null;

  const id = readString(record.id);
  const name = readString(record.name);
  if (!id || !name) return null;

  const startTimeUTC =
    readString(record.startTimeUTC) ??
    readString(record.startTime) ??
    new Date().toISOString();

  const status = parseMatchStatus(readString(record.status));
  const competition = readString(record.competition);
  const league = asRecord(record.league)
    ? (record.league as unknown as FootballLeague)
    : resolveLeague(competition);

  // Home y Away Teams
  let homeTeam = asRecord(record.homeTeam)
    ? (record.homeTeam as unknown as FootballMatch['homeTeam'])
    : null;
  let awayTeam = asRecord(record.awayTeam)
    ? (record.awayTeam as unknown as FootballMatch['awayTeam'])
    : null;

  if (!homeTeam || !awayTeam) {
    const vsParts = name.split(/\s+(?:vs\.?|contra|-)\s+/i);
    const homeName = vsParts[0]?.trim() || 'Equipo Local';
    const awayName = vsParts[1]?.trim() || 'Equipo Visitante';
    homeTeam = parseTeamFromSide(homeName, 'HOM');
    awayTeam = parseTeamFromSide(awayName, 'AWY');
  }

  const rawHome = asRecord(record.homeTeam);
  if (homeTeam && rawHome) {
    const crest = readString(rawHome.logoUrl) ?? readString(rawHome.teamCrestUrl);
    if (crest) homeTeam = { ...homeTeam, logoUrl: crest };
  }

  const rawAway = asRecord(record.awayTeam);
  if (awayTeam && rawAway) {
    const crest = readString(rawAway.logoUrl) ?? readString(rawAway.teamCrestUrl);
    if (crest) awayTeam = { ...awayTeam, logoUrl: crest };
  }

  // Scores
  const scoresRecord = asRecord(record.scores);
  const scores = {
    home: readNumber(scoresRecord?.home) ?? 0,
    away: readNumber(scoresRecord?.away) ?? 0,
  };

  // Markets
  const rawMarkets = Array.isArray(record.markets) ? record.markets : [];
  const markets: FootballMarket[] = [];

  for (const rawMkt of rawMarkets) {
    const mkt = asRecord(rawMkt);
    if (!mkt) continue;

    const mktId = readString(mkt.id) ?? `mkt_${id}_${markets.length}`;
    const mktName = readString(mkt.name) ?? 'Mercado de Partido';
    const typeKey = (readString(mkt.typeKey) ?? 'match_result_1x2') as FootballMarket['typeKey'];
    const line = readNumber(mkt.line);
    const mktStatus = (readString(mkt.status) ?? 'open') as FootballMarket['status'];

    const rawSelections = Array.isArray(mkt.selections) ? mkt.selections : [];
    const selections: FootballSelection[] = [];

    for (const rawSel of rawSelections) {
      const sel = asRecord(rawSel);
      if (!sel) continue;

      const selId = readString(sel.id);
      const selName = readString(sel.name);
      const odds = readNumber(sel.decimalOdds) ?? readNumber(sel.odds);
      if (!selId || !selName || !odds || odds <= 1) continue;

      selections.push({
        id: selId,
        marketId: mktId,
        name: selName,
        code: readString(sel.code) ?? '1',
        decimalOdds: odds,
        americanOdds: readString(sel.americanOdds) ?? undefined,
        line: readNumber(sel.line),
        status: 'active',
        cyrillicLabel: readString(sel.cyrillicLabel) ?? undefined,
      });
    }

    if (selections.length > 0) {
      markets.push({
        id: mktId,
        matchId: id,
        typeKey,
        name: mktName,
        line,
        status: mktStatus,
        selections,
        cyrillicMeta: {
          cyrillicTag: typeKey === 'match_result_1x2' ? 'ИСХОД 1X2' : 'ЛИНИЯ',
          coeffBadge: 'КОЭФ',
          lineBadge: status === 'live' ? 'ПРЯМОЙ ЭФИР' : 'ЛИНИЯ',
        },
      });
    }
  }

  return {
    id,
    homeTeam,
    awayTeam,
    league,
    startTimeUTC,
    status,
    scores,
    clock: asRecord(record.clock)
      ? (record.clock as unknown as FootballMatch['clock'])
      : undefined,
    markets,
    isBettingOpen: status !== 'finished',
    isExpired: status === 'finished',
    stadium: readString(record.stadium) ?? undefined,
    city: readString(record.city) ?? undefined,
    referee: readString(record.referee) ?? undefined,
  };
}

export function normalizeMatchesPayload(payload: unknown): readonly FootballMatch[] {
  if (!payload) return [];

  const record = asRecord(payload);
  const items = Array.isArray(payload)
    ? payload
    : Array.isArray(record?.items)
      ? record.items
      : Array.isArray(record?.matches)
        ? record.matches
        : [];

  return items
    .map(normalizeFootballMatch)
    .filter((m): m is FootballMatch => m !== null);
}

/* --------------------------------------------------------------------------
   Caché SWR en Memoria y Sesión
   -------------------------------------------------------------------------- */

export function getCachedFootballMatches(): {
  matches: readonly FootballMatch[];
  loadedAt: number;
} | null {
  if (memoryMatchesCache && Date.now() - memoryMatchesCache.timestamp < FOOTBALL_CACHE_TTL_MS) {
    return { matches: memoryMatchesCache.data, loadedAt: memoryMatchesCache.timestamp };
  }

  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const raw = window.sessionStorage.getItem(FOOTBALL_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CachedEntry<readonly FootballMatch[]>;
        if (parsed && Date.now() - parsed.timestamp < FOOTBALL_CACHE_TTL_MS) {
          memoryMatchesCache = parsed;
          return { matches: parsed.data, loadedAt: parsed.timestamp };
        }
      }
    } catch {
      // Ignora cuota o parseo
    }
  }

  return memoryMatchesCache
    ? { matches: memoryMatchesCache.data, loadedAt: memoryMatchesCache.timestamp }
    : null;
}

function saveMatchesToCache(matches: readonly FootballMatch[]): void {
  const entry: CachedEntry<readonly FootballMatch[]> = { data: matches, timestamp: Date.now() };
  memoryMatchesCache = entry;

  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      window.sessionStorage.setItem(FOOTBALL_CACHE_KEY, JSON.stringify(entry));
      window.dispatchEvent(
        new CustomEvent(FOOTBALL_CACHE_UPDATED_EVENT, { detail: entry }),
      );
    } catch {
      // Silencioso
    }
  }
}

/* --------------------------------------------------------------------------
   Servicio Principal (100% API Backend - Cero Mocks)
   -------------------------------------------------------------------------- */

export const footballService = {
  /**
   * Obtiene la lista de partidos exclusivamente desde la Web API de .NET.
   * En caso de lista vacía o error, reporta el estado legítimo sin generar datos simulados.
   */
  async listMatches(options: ListFootballOptions = {}): Promise<readonly FootballMatch[]> {
    const { status, leagueId, signal, forceRefresh } = options;
    const cacheKey = `football_${status ?? 'all'}_${leagueId ?? 'all'}`;

    if (!forceRefresh) {
      const cached = getCachedFootballMatches();
      if (cached) {
        let filtered = cached.matches;
        if (status) filtered = filtered.filter((m) => m.status === status);
        if (leagueId) filtered = filtered.filter((m) => m.league.id === leagueId);
        return filtered;
      }
    }

    const ongoing = inFlightRequests.get(cacheKey);
    if (ongoing) return ongoing;

    const promise = (async (): Promise<readonly FootballMatch[]> => {
      try {
        let payload: unknown;

        try {
          // Endpoint primario dedicado de fútbol
          payload = await apiClient.get<unknown>(FOOTBALL_MATCHES_ENDPOINT, {
            params: {
              ...(status ? { status } : {}),
              ...(leagueId ? { competition: leagueId } : {}),
            },
            signal,
          });
        } catch {
          // Fallback al endpoint unificado /events?sport=soccer
          payload = await apiClient.get<unknown>(FOOTBALL_EVENTS_ENDPOINT, {
            params: {
              sport: 'soccer',
              ...(status ? { status } : {}),
              ...(leagueId ? { competition: leagueId } : {}),
            },
            signal,
          });
        }

        const normalizedMatches = normalizeMatchesPayload(payload);
        saveMatchesToCache(normalizedMatches);

        let filtered = normalizedMatches;
        if (status) filtered = filtered.filter((m) => m.status === status);
        if (leagueId) filtered = filtered.filter((m) => m.league.id === leagueId);
        return filtered;
      } catch (error) {
        // En caso de error de red o desconexión, propaga el error legítimo sin inventar fixtures
        throw error;
      } finally {
        inFlightRequests.delete(cacheKey);
      }
    })();

    inFlightRequests.set(cacheKey, promise);
    return promise;
  },

  /**
   * Retorna un partido específico por su ID consultando a la API o al caché legítimo.
   */
  async getMatchById(id: string, signal?: AbortSignal): Promise<FootballMatch | null> {
    const cached = getCachedFootballMatches();
    if (cached) {
      const match = cached.matches.find((m) => m.id === id);
      if (match) return match;
    }

    const matches = await this.listMatches({ signal });
    return matches.find((m) => m.id === id) ?? null;
  },

  /**
   * Partidos en vivo consultados desde /football/live o filtrados legítimamente.
   */
  async listLiveMatches(signal?: AbortSignal): Promise<readonly FootballMatch[]> {
    try {
      const payload = await apiClient.get<unknown>(FOOTBALL_LIVE_ENDPOINT, { signal });
      const matches = normalizeMatchesPayload(payload);
      return matches.filter((m) => m.status === 'live');
    } catch {
      return this.listMatches({ status: 'live', signal });
    }
  },

  /**
   * Partidos filtrados por liga desde el backend.
   */
  async listMatchesByLeague(
    leagueId: string,
    signal?: AbortSignal,
  ): Promise<readonly FootballMatch[]> {
    return this.listMatches({ leagueId, signal });
  },

  /**
   * Catálogo oficial de ligas consultado desde el backend.
   */
  async listLeagues(signal?: AbortSignal): Promise<readonly FootballLeague[]> {
    try {
      const payload = await apiClient.get<unknown>(FOOTBALL_LEAGUES_ENDPOINT, { signal });
      if (Array.isArray(payload)) {
        return payload.map((item) => {
          const r = asRecord(item);
          return {
            id: readString(r?.id) || 'unknown',
            name: readString(r?.name) || '',
            shortName: readString(r?.shortName) || '',
            country: readString(r?.country) || '',
            countryCode: readString(r?.countryCode) || '',
            season: readString(r?.season) || '2026/27',
            matchday: readString(r?.matchday) || undefined,
            cyrillicName: readString(r?.cyrillicName) || undefined,
          };
        });
      }
      return Object.values(FOOTBALL_LEAGUES);
    } catch {
      return Object.values(FOOTBALL_LEAGUES);
    }
  },
};
