import {
  Activity,
  CircleDot,
  Gamepad2,
  Goal,
  HandFist,
  Swords,
  Trophy,
  type LucideIcon,
} from 'lucide-react';

import type { SportsbookSportId } from '@/domain/sportsbook';

/** Icono editorial por disciplina; compartido por la grilla y el estado vacío. */
export const SPORT_ICONS: Readonly<Record<SportsbookSportId, LucideIcon>> = {
  mma: Swords,
  soccer: Goal,
  basketball: Activity,
  boxing: HandFist,
  esports: Gamepad2,
  tennis: Trophy,
  baseball: CircleDot,
};

export interface SportClassicalArt {
  readonly id: SportsbookSportId;
  readonly title: string;
  readonly subtitle: string;
  readonly epoch: string;
  readonly medium: string;
  readonly code: string;
  readonly image: string;
  readonly alt: string;
  /** object-position CSS para encuadrar obras verticales en tarjetas apaisadas. */
  readonly focus?: string;
}

const BASE_URL = import.meta.env.BASE_URL.endsWith('/')
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`;

export function getSportArtUrl(filename: string): string {
  return `${BASE_URL}art/${filename}`;
}

/** Catálogo de obras reales por disciplina (se muestran con el tramado lima de Hermes). */
export const SPORT_CLASSICAL_ART: Readonly<Record<SportsbookSportId, SportClassicalArt>> = {
  mma: {
    id: 'mma',
    title: 'Pollice Verso',
    subtitle: 'Jean-Léon Gérôme',
    epoch: 'Roma Imperial · 1872',
    medium: 'Obra de dominio público',
    code: 'ROM-01',
    image: `${BASE_URL}art/mma.png`,
    alt: 'Gladiador vencedor sobre su rival caído mientras el Coliseo pide sentencia',
    focus: 'center 70%',
  },
  soccer: {
    id: 'soccer',
    title: 'Futebol',
    subtitle: 'Candido Portinari',
    epoch: 'Brasil · 1935',
    medium: 'Óleo sobre lienzo',
    code: 'GRE-02',
    image: `${BASE_URL}art/soccer.png`,
    alt: 'Niños jugando al fútbol sobre la tierra roja de un campo',
    focus: 'center 55%',
  },
  basketball: {
    id: 'basketball',
    title: 'Lucha en el club',
    subtitle: 'George Wesley Bellows',
    epoch: 'Nueva York · c. 1910',
    medium: 'Obra de dominio público',
    code: 'OLY-03',
    image: `${BASE_URL}art/basketball.png`,
    alt: 'Dos luchadores forcejeando ante un público en sombras, dibujo al carbón',
    focus: 'center 50%',
  },
  boxing: {
    id: 'boxing',
    title: 'Duelo a garrotazos',
    subtitle: 'Francisco de Goya',
    epoch: 'España · 1820–23',
    medium: 'Obra de dominio público',
    code: 'CAE-04',
    image: `${BASE_URL}art/boxing.png`,
    alt: 'Dos hombres se golpean a garrotazos hundidos hasta las rodillas',
    focus: 'center 40%',
  },
  esports: {
    id: 'esports',
    title: 'La escuela de Atenas',
    subtitle: 'Rafael Sanzio',
    epoch: 'Renacimiento · 1509–11',
    medium: 'Obra de dominio público',
    code: 'TAC-05',
    image: `${BASE_URL}art/esports.png`,
    alt: 'Filósofos y estrategas debatiendo bajo la bóveda de la escuela de Atenas',
    focus: 'center 60%',
  },
  tennis: {
    id: 'tennis',
    title: 'Le Jeu Royal de la Paume',
    subtitle: 'Grabado francés',
    epoch: 'Francia · 1632',
    medium: 'Obra de dominio público',
    code: 'APO-06',
    image: `${BASE_URL}art/tennis.png`,
    alt: 'Jugadores de jeu de paume con raquetas en un frontón cubierto',
    focus: 'center 72%',
  },
  baseball: {
    id: 'baseball',
    title: 'Hércules e Hidra',
    subtitle: 'Antonio del Pollaiuolo',
    epoch: 'Florencia · c. 1475',
    medium: 'Obra de dominio público',
    code: 'HER-07',
    image: `${BASE_URL}art/baseball.png`,
    alt: 'Hércules alzando su maza contra la hidra de Lerna',
    focus: 'center 22%',
  },
};

export interface HomeArt {
  readonly title: string;
  readonly subtitle: string;
  readonly epoch: string;
  readonly image: string;
  readonly alt: string;
  /** object-position CSS para encuadrar la obra dentro de su marco. */
  readonly focus: string;
}

/** Obras del inicio (hero y "Cómo funciona"), con el mismo tramado lima. */
export const HOME_ART = {
  cardsharps: {
    title: 'Los tahúres',
    subtitle: 'Caravaggio',
    epoch: 'Roma · c. 1594',
    image: `${BASE_URL}art/home-cardsharps.webp`,
    alt: 'Un joven mira sus cartas mientras un tahúr espía por encima de su hombro y otro esconde un naipe en la espalda',
    focus: '40% 30%',
  },
  hercules: {
    title: 'Hércules y Aqueloo',
    subtitle: 'Guido Reni',
    epoch: 'Bolonia · 1620–21',
    image: `${BASE_URL}art/home-hercules.webp`,
    alt: 'Hércules somete en la lucha al dios-río Aqueloo',
    focus: 'center 14%',
  },
  prudence: {
    title: 'Alegoría de la prudencia',
    subtitle: 'Tiziano y taller',
    epoch: 'Venecia · c. 1550–65',
    image: `${BASE_URL}art/home-prudence.webp`,
    alt: 'Tres rostros —anciano, adulto y joven— sobre las cabezas de un lobo, un león y un perro',
    focus: 'center 40%',
  },
  moneylender: {
    title: 'El prestamista y su esposa',
    subtitle: 'Quentin Massys',
    epoch: 'Amberes · 1514',
    image: `${BASE_URL}art/home-moneylender.webp`,
    alt: 'Un prestamista pesa monedas de oro mientras su esposa hojea un libro de horas',
    focus: 'center 55%',
  },
} as const satisfies Record<string, HomeArt>;

