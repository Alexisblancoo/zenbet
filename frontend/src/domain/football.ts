/**
 * Dominio de Fútbol (Football / Soccer) para ZenBet.
 *
 * Arquitectura modular tipada para el módulo de fútbol profesional.
 * Integra la estética Neo-Brutalista "Shibuya Lime" (#D4FF3F), micro-detalles
 * tipográficos en cirílico estilo bookie europea/rusa ('ЛИНИЯ', 'КОЭФ', 'ИСХОД', 'ТОТАЛ'),
 * soporte para huso horario local automático y compatibilidad directa con el BetSlip.
 */

import type { SelectionInput } from './bets';
export { formatAmericanOdds, formatDecimalOdds } from './odds';
import { formatLocalFightDateTime, type LocalFightDateTime } from '@/utils/localTimezone';

/* --------------------------------------------------------------------------
   1. Estados y Tiempos de Partido
   -------------------------------------------------------------------------- */

export type FootballMatchStatus = 'upcoming' | 'live' | 'finished';

export type FootballPeriod =
  | 'pre_match'
  | 'first_half'
  | 'half_time'
  | 'second_half'
  | 'extra_time'
  | 'penalties'
  | 'full_time';

export interface FootballClock {
  readonly minute: number;
  readonly addedMinutes?: number;
  readonly period: FootballPeriod;
  readonly isRunning: boolean;
  readonly label: string; // Ej: "38'", "45+2'", "HT", "82'"
  readonly cyrillicPeriodLabel?: string; // Ej: "1-Й ТАЙМ", "ПЕРЕРЫВ", "2-Й ТАЙМ"
}

export interface FootballScore {
  readonly home: number;
  readonly away: number;
  readonly firstHalf?: { readonly home: number; readonly away: number };
  readonly secondHalf?: { readonly home: number; readonly away: number };
  readonly penalties?: { readonly home: number; readonly away: number };
}

/* --------------------------------------------------------------------------
   2. Equipos y Competiciones
   -------------------------------------------------------------------------- */

export interface FootballTeam {
  readonly id: string;
  readonly name: string;
  readonly shortName: string;
  readonly code: string;                // Ej: "RMA", "FCB", "MCI", "LIV", "BOL"
  readonly logoUrl?: string;
  readonly country?: string;
  readonly countryCode?: string;        // Ej: "ES", "GB", "IT", "DE", "BO"
  readonly cyrillicName?: string;       // Ej: "РЕАЛ МАДРИД", "БАРСЕЛОНА"
}

export interface FootballLeague {
  readonly id: string;
  readonly name: string;                // Ej: "LaLiga EA Sports", "UEFA Champions League"
  readonly shortName: string;           // Ej: "LaLiga", "UCL", "Premier"
  readonly country: string;
  readonly countryCode: string;         // Ej: "ES", "EU", "GB"
  readonly season?: string;             // Ej: "2026/2027"
  readonly matchday?: string;           // Ej: "Jornada 10", "Cuartos de final"
  readonly cyrillicName?: string;       // Ej: "ЛА ЛИГА", "ЛИГА ЧЕМПИОНОВ", "АПЛ"
}

/* --------------------------------------------------------------------------
   3. Mercados y Cuotas (1X2, Totales, Ambos Anotan, etc.)
   -------------------------------------------------------------------------- */

export type FootballMarketTypeKey =
  | 'match_result_1x2'          // 1X2 - Victoria Local (1), Empate (X), Victoria Visitante (2)
  | 'total_goals'               // Más / Menos de Goles (Over / Under con línea ej. 1.5, 2.5, 3.5)
  | 'both_teams_to_score'       // Ambos equipos anotan (Sí / No - BTTS)
  | 'double_chance'             // Doble oportunidad (1X, 12, X2)
  | 'draw_no_bet'               // Apuesta sin empate (1, 2)
  | 'half_time_result'          // 1X2 al descanso (1, X, 2)
  | 'first_team_to_score';      // Primer equipo en marcar (Local, Ninguno, Visitante)

export type FootballMarketStatus = 'open' | 'suspended' | 'settled' | 'closed';

/**
 * Metadatos para microdetalles tipográficos estilo bookie europea/rusa
 * en baja opacidad (0.25 - 0.40) para enriquecer la estética Neo-Brutalista.
 */
export interface FootballCyrillicMeta {
  readonly cyrillicTag: string;         // Ej: "ИСХОД 1X2", "ТОТАЛ ГОЛОВ", "ОБЕ ЗАБЬЮТ"
  readonly cyrillicHint?: string;       // Ej: "ОСНОВНОЕ ВРЕМЯ", "БОЛЬШЕ/МЕНЬШЕ"
  readonly coeffBadge: 'КОЭФ';
  readonly lineBadge: 'ЛИНИЯ' | 'ПРЯМОЙ ЭФИР';
}

export interface FootballSelection {
  readonly id: string;
  readonly marketId: string;
  readonly name: string;                // Ej: "Real Madrid", "Empate", "Más de 2.5", "Sí"
  readonly code: string;                // "1", "X", "2", "over", "under", "btts_yes", "btts_no", "1X", "12", "X2"
  readonly decimalOdds: number;         // Ej: 1.85 (conserva precisión)
  readonly americanOdds?: string;       // Ej: "-118"
  readonly line?: number | null;        // Ej: 2.5 para totales de goles
  readonly status: 'active' | 'suspended' | 'settled';
  readonly settled?: boolean;
  readonly outcome?: 'won' | 'lost' | 'push';
  readonly cyrillicLabel?: string;      // Ej: "П1", "X", "П2", "Б 2.5", "М 2.5", "ДА", "НЕТ"
}

export interface FootballMarket {
  readonly id: string;
  readonly matchId: string;
  readonly typeKey: FootballMarketTypeKey;
  readonly name: string;                // Ej: "Resultado del Partido (1X2)"
  readonly line: number | null;         // Ej: 2.5 para totales, null para 1X2
  readonly status: FootballMarketStatus;
  readonly selections: readonly FootballSelection[];
  readonly cyrillicMeta: FootballCyrillicMeta;
}

/* --------------------------------------------------------------------------
   4. Modelo Principal: FootballMatch
   -------------------------------------------------------------------------- */

export interface FootballMatch {
  readonly id: string;
  readonly homeTeam: FootballTeam;
  readonly awayTeam: FootballTeam;
  readonly league: FootballLeague;
  readonly startTimeUTC: string;        // ISO 8601 (ej. "2026-10-28T19:00:00Z")
  readonly status: FootballMatchStatus;
  readonly clock?: FootballClock;
  readonly scores: FootballScore;
  readonly markets: readonly FootballMarket[];
  readonly isBettingOpen: boolean;
  readonly isExpired: boolean;
  readonly stadium?: string;
  readonly city?: string;
  readonly referee?: string;
}

/* --------------------------------------------------------------------------
   5. Catálogo de Familias de Mercados para Pestañas y Bento Grid
   -------------------------------------------------------------------------- */

export interface FootballMarketFamilyDefinition {
  readonly key: FootballMarketTypeKey;
  readonly label: string;
  readonly shortLabel: string;
  readonly caption: string;
  readonly cyrillicTag: string;
  readonly cyrillicShort: string;
}

export const FOOTBALL_MARKET_FAMILIES: readonly FootballMarketFamilyDefinition[] = [
  {
    key: 'match_result_1x2',
    label: 'Resultado Final (1X2)',
    shortLabel: '1X2',
    caption: 'Victoria Local, Empate o Victoria Visitante',
    cyrillicTag: 'ИСХОД 1X2',
    cyrillicShort: '1X2',
  },
  {
    key: 'total_goals',
    label: 'Total de Goles',
    shortLabel: 'Goles',
    caption: 'Más / Menos (Over / Under) en el tiempo reglamentario',
    cyrillicTag: 'ТОТАЛ ГОЛОВ',
    cyrillicShort: 'ТОТАЛ',
  },
  {
    key: 'both_teams_to_score',
    label: 'Ambos Equipos Anotan',
    shortLabel: 'Ambos Anotan',
    caption: 'Sí / No (Both Teams to Score - BTTS)',
    cyrillicTag: 'ОБЕ ЗАБЬЮТ',
    cyrillicShort: 'ОЗ',
  },
  {
    key: 'double_chance',
    label: 'Doble Oportunidad',
    shortLabel: 'Doble Oportunidad',
    caption: '1X (Local o Empate), 12 (Cualquiera), X2 (Visitante o Empate)',
    cyrillicTag: 'ДВОЙНОЙ ШАНС',
    cyrillicShort: '2Х',
  },
  {
    key: 'draw_no_bet',
    label: 'Apuesta sin Empate',
    shortLabel: 'Sin Empate',
    caption: 'Reembolso en caso de empate',
    cyrillicTag: 'ФОРА (0)',
    cyrillicShort: 'DNB',
  },
  {
    key: 'half_time_result',
    label: 'Resultado al Descanso',
    shortLabel: '1.er Tiempo',
    caption: '1X2 en los primeros 45 minutos',
    cyrillicTag: '1-Й ТАЙМ',
    cyrillicShort: '1Т 1X2',
  },
];

export const FOOTBALL_MARKET_FAMILY_BY_KEY: ReadonlyMap<
  FootballMarketTypeKey,
  FootballMarketFamilyDefinition
> = new Map(FOOTBALL_MARKET_FAMILIES.map((fam) => [fam.key, fam]));

/* --------------------------------------------------------------------------
   6. Funciones de Ayuda (Helpers de Dominio y Normalización)
   -------------------------------------------------------------------------- */

/**
 * Busca un mercado de fútbol en el partido por su clave de tipo y línea opcional.
 */
export function findFootballMarket(
  match: FootballMatch,
  typeKey: FootballMarketTypeKey,
  line?: number | null,
): FootballMarket | undefined {
  return match.markets.find(
    (market) =>
      market.typeKey === typeKey &&
      (line === undefined || line === null || market.line === line),
  );
}

/**
 * Busca una selección específica dentro de un mercado por su código interno.
 * Códigos comunes: "1", "X", "2", "over", "under", "btts_yes", "btts_no".
 */
export function findFootballSelectionByCode(
  market: FootballMarket | undefined,
  code: string,
): FootballSelection | undefined {
  return market?.selections.find((selection) => selection.code === code);
}

/**
 * Extrae las tres opciones de la línea principal 1X2 del partido.
 */
export function getMatch1X2(match: FootballMatch): {
  readonly market?: FootballMarket;
  readonly home?: FootballSelection;
  readonly draw?: FootballSelection;
  readonly away?: FootballSelection;
} {
  const market = findFootballMarket(match, 'match_result_1x2');
  return {
    market,
    home: findFootballSelectionByCode(market, '1'),
    draw: findFootballSelectionByCode(market, 'X'),
    away: findFootballSelectionByCode(market, '2'),
  };
}

/**
 * Extrae las selecciones del mercado de Totales de Goles (Over/Under) para una línea dada.
 */
export function getMatchOverUnder(
  match: FootballMatch,
  targetLine = 2.5,
): {
  readonly market?: FootballMarket;
  readonly over?: FootballSelection;
  readonly under?: FootballSelection;
} {
  // Intenta encontrar la línea exacta, o el primer mercado de total de goles disponible
  const market =
    findFootballMarket(match, 'total_goals', targetLine) ??
    findFootballMarket(match, 'total_goals');

  return {
    market,
    over: findFootballSelectionByCode(market, 'over'),
    under: findFootballSelectionByCode(market, 'under'),
  };
}

/**
 * Extrae las selecciones del mercado Ambos Equipos Anotan (BTTS).
 */
export function getMatchBTTS(match: FootballMatch): {
  readonly market?: FootballMarket;
  readonly yes?: FootballSelection;
  readonly no?: FootballSelection;
} {
  const market = findFootballMarket(match, 'both_teams_to_score');
  return {
    market,
    yes: findFootballSelectionByCode(market, 'btts_yes'),
    no: findFootballSelectionByCode(market, 'btts_no'),
  };
}

/**
 * Convierte una selección de fútbol al formato `SelectionInput` universal
 * compatible con el BetSlip existente de ZenBet.
 */
export function toFootballSelectionInput(
  match: FootballMatch,
  market: FootballMarket,
  selection: FootballSelection,
  currentLiveOdds?: number,
): SelectionInput {
  const liveDecimal =
    currentLiveOdds !== undefined && Number.isFinite(currentLiveOdds) && currentLiveOdds > 1
      ? currentLiveOdds
      : selection.decimalOdds;

  const eventName = `${match.homeTeam.name} vs ${match.awayTeam.name}`;
  const marketLabel =
    market.line !== null ? `${market.name} ${market.line.toFixed(1)}` : market.name;

  return {
    selectionId: selection.id,
    eventId: match.id,
    marketId: market.id,
    eventName: match.league.name ? `${match.league.name} · ${eventName}` : eventName,
    marketLabel,
    selectionName: selection.name,
    odds: liveDecimal,
    eventStatus: match.status,
    eventEndsAt: undefined,
    eventIsExpired: match.isExpired,
    eventIsBettingOpen: match.isBettingOpen,
  };
}

/**
 * Formatea el reloj de juego en vivo (minuto y periodo) con soporte estético ruso.
 */
export function formatFootballClockDisplay(clock: FootballClock | undefined): {
  readonly text: string;
  readonly periodText: string;
  readonly cyrillicPeriodText: string;
} {
  if (!clock) {
    return { text: '—', periodText: 'Previa', cyrillicPeriodText: 'ПРЕДМАТЧ' };
  }

  if (clock.period === 'half_time') {
    return { text: 'HT', periodText: 'Descanso', cyrillicPeriodText: 'ПЕРЕРЫВ' };
  }

  if (clock.period === 'full_time') {
    return { text: 'FT', periodText: 'Final', cyrillicPeriodText: 'ФИНАЛ' };
  }

  const added = clock.addedMinutes ? `+${clock.addedMinutes}'` : '';
  const text = `${clock.minute}'${added}`;

  const periodMap: Record<FootballPeriod, { es: string; ru: string }> = {
    pre_match: { es: 'Previa', ru: 'ПРЕДМАТЧ' },
    first_half: { es: '1.er Tiempo', ru: '1-Й ТАЙМ' },
    half_time: { es: 'Descanso', ru: 'ПЕРЕРЫВ' },
    second_half: { es: '2.º Tiempo', ru: '2-Й ТАЙМ' },
    extra_time: { es: 'Prórroga', ru: 'ДОП. ВРЕМЯ' },
    penalties: { es: 'Penales', ru: 'ПЕНАЛЬТИ' },
    full_time: { es: 'Final', ru: 'ФИНАЛ' },
  };

  const periodInfo = periodMap[clock.period] ?? { es: clock.label, ru: 'МАТЧ' };

  return {
    text,
    periodText: periodInfo.es,
    cyrillicPeriodText: periodInfo.ru,
  };
}

/**
 * Formatea el marcador con representación clara "Local - Visitante".
 */
export function formatFootballScore(scores: FootballScore | undefined): string {
  if (!scores) return '0 - 0';
  return `${scores.home} - ${scores.away}`;
}

/**
 * Formatea la fecha y hora del partido usando la zona horaria nativa del navegador del usuario.
 */
export function formatFootballMatchTime(startTimeUTC: string): LocalFightDateTime {
  return formatLocalFightDateTime(startTimeUTC);
}

/**
 * Genera etiqueta de estado con descriptor dual Español / Cirílico.
 */
export function getFootballStatusDescriptor(status: FootballMatchStatus): {
  readonly label: string;
  readonly cyrillic: string;
  readonly isLive: boolean;
  readonly isUpcoming: boolean;
  readonly isFinished: boolean;
} {
  switch (status) {
    case 'live':
      return {
        label: 'En Vivo',
        cyrillic: 'ПРЯМОЙ ЭФИР',
        isLive: true,
        isUpcoming: false,
        isFinished: false,
      };
    case 'finished':
      return {
        label: 'Finalizado',
        cyrillic: 'ИТОГ',
        isLive: false,
        isUpcoming: false,
        isFinished: true,
      };
    case 'upcoming':
    default:
      return {
        label: 'Programado',
        cyrillic: 'ЛИНИЯ',
        isLive: false,
        isUpcoming: true,
        isFinished: false,
      };
  }
}

