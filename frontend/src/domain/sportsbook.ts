/**
 * Catálogo editorial de disciplinas del Sportsbook.
 *
 * `available` describe si la plataforma ya publica carteleras para la
 * disciplina. Las disciplinas no disponibles se muestran con el estado
 * "Pronto" y abren una vista informativa; nunca inventan eventos ni cuotas.
 */

export type SportsbookSportId =
  | 'mma'
  | 'soccer'
  | 'basketball'
  | 'boxing'
  | 'esports'
  | 'tennis'
  | 'baseball';

export interface SportsbookSportDefinition {
  readonly id: SportsbookSportId;
  readonly label: string;
  readonly shortLabel: string;
  readonly kicker: string;
  readonly description: string;
  readonly available: boolean;
  /** Claves que puede publicar la API para esta disciplina. */
  readonly eventSportKeys: readonly string[];
}

export const SPORTSBOOK_SPORTS: readonly SportsbookSportDefinition[] = [
  {
    id: 'mma',
    label: 'UFC / MMA',
    shortLabel: 'MMA',
    kicker: 'Artes marciales mixtas',
    description: 'Carteleras, reloj en vivo y mercados por asalto.',
    available: true,
    eventSportKeys: ['mma'],
  },
  {
    id: 'soccer',
    label: 'Fútbol',
    shortLabel: 'Fútbol',
    kicker: 'Ligas y copas',
    description: 'Goles, hándicaps y mercados de partido.',
    available: false,
    eventSportKeys: ['football', 'soccer'],
  },
  {
    id: 'basketball',
    label: 'Baloncesto',
    shortLabel: 'Basket',
    kicker: 'NBA y ligas',
    description: 'Totales, spreads y ganador del partido.',
    available: false,
    eventSportKeys: ['basketball'],
  },
  {
    id: 'boxing',
    label: 'Boxeo',
    shortLabel: 'Boxeo',
    kicker: 'Peso y distancia',
    description: 'Ganador, método y total de asaltos.',
    available: false,
    eventSportKeys: ['boxing'],
  },
  {
    id: 'esports',
    label: 'eSports',
    shortLabel: 'eSports',
    kicker: 'Competencia digital',
    description: 'Mapas, series y mercados por partida.',
    available: false,
    eventSportKeys: ['esports'],
  },
  {
    id: 'tennis',
    label: 'Tenis',
    shortLabel: 'Tenis',
    kicker: 'ATP y WTA',
    description: 'Ganador, sets y total de juegos.',
    available: false,
    eventSportKeys: ['tennis'],
  },
  {
    id: 'baseball',
    label: 'Béisbol',
    shortLabel: 'Béisbol',
    kicker: 'MLB y ligas',
    description: 'Ganador, carreras y hándicap.',
    available: false,
    eventSportKeys: ['baseball'],
  },
];

export const SPORTSBOOK_SPORT_BY_ID: ReadonlyMap<SportsbookSportId, SportsbookSportDefinition> =
  new Map(SPORTSBOOK_SPORTS.map((sport) => [sport.id, sport]));

export function parseSportsbookSport(value: string | null | undefined): SportsbookSportId {
  return SPORTSBOOK_SPORTS.some((sport) => sport.id === value)
    ? (value as SportsbookSportId)
    : 'mma';
}
