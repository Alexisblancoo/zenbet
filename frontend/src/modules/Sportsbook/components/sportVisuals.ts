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
  /** Intensidad del puntillismo: más bajo para obras claras, más alto para oscuras. */
  readonly stippleGain?: number;
  readonly alt: string;
}

const BASE_URL = import.meta.env.BASE_URL.endsWith('/')
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`;

export function getSportArtUrl(filename: string): string {
  return `${BASE_URL}art/${filename}`;
}

/** Catálogo de obras pictóricas al óleo de la Antigüedad Clásica (Grecia y Roma) */
export const SPORT_CLASSICAL_ART: Readonly<Record<SportsbookSportId, SportClassicalArt>> = {
  mma: {
    id: 'mma',
    title: 'Pollice Verso',
    subtitle: 'Gladiatores & Colosseum',
    epoch: 'Roma Imperial · S. I d.C.',
    medium: 'Óleo sobre lienzo',
    code: 'ROM-01',
    image: `${BASE_URL}art/mma.jpg`,
    alt: 'Combate a muerte de gladiadores en la arena del Coliseo romano',
  },
  soccer: {
    id: 'soccer',
    title: 'Currus & Stadium',
    subtitle: 'Circus Maximus Agon',
    epoch: 'Circus Maximus · S. II a.C.',
    medium: 'Óleo sobre lienzo',
    code: 'GRE-02',
    image: `${BASE_URL}art/soccer.jpg`,
    alt: 'Carrera épica de cuadrigas y atletas en el circo máximo',
  },
  basketball: {
    id: 'basketball',
    title: 'Olympia Palaestra',
    subtitle: 'Saltus Athleticum',
    epoch: 'Grecia Arcaica · 776 a.C.',
    medium: 'Óleo sobre lienzo',
    code: 'OLY-03',
    image: `${BASE_URL}art/basketball.jpg`,
    alt: 'Atletas olímpicos saltando en la palestra monumental de Olimpia',
  },
  boxing: {
    id: 'boxing',
    title: 'Pygmachia Caestus',
    subtitle: 'Pugilatus & Brutalitas',
    epoch: 'Grecia Clásica · S. IV a.C.',
    medium: 'Óleo sobre lienzo',
    code: 'CAE-04',
    image: `${BASE_URL}art/boxing.jpg`,
    alt: 'Púgiles clásicos con correas de cuero caestus en combate frontal',
  },
  esports: {
    id: 'esports',
    title: 'Strategos Council',
    subtitle: 'Tactica & Minerva',
    epoch: 'Atenas / Roma · S. V a.C.',
    medium: 'Óleo sobre lienzo',
    code: 'TAC-05',
    image: `${BASE_URL}art/esports.jpg`,
    alt: 'Consejo de estrategas estudiando mapas y miniaturas tácticas',
  },
  tennis: {
    id: 'tennis',
    title: 'Sphairisterion Agon',
    subtitle: 'Pila Pagana & Apollo',
    epoch: 'Grecia Clásica · S. IV a.C.',
    medium: 'Óleo sobre lienzo',
    code: 'APO-06',
    image: `${BASE_URL}art/tennis.jpg`,
    stippleGain: 0.9,
    alt: 'Atletas clásicos en el patio de esferisterio de Apolo',
  },
  baseball: {
    id: 'baseball',
    title: 'Hercules Agonistes',
    subtitle: 'Clava & Bellum Mythologicum',
    epoch: 'Mitología Heroica',
    medium: 'Óleo sobre lienzo',
    code: 'HER-07',
    image: `${BASE_URL}art/baseball.jpg`,
    alt: 'Hércules empuñando la maza de madera en batalla mítica',
  },
};


