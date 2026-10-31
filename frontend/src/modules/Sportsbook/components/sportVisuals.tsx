import type { SVGProps } from 'react';
import type { SportsbookSportId } from '@/domain/sportsbook';

/* ==========================================================================
   ÍCONOS VECTORIALES DE LÍNEA FINA PARA DISCIPLINAS DEPORTIVAS (FINE LINE STYLE)
   Diseñados a medida para ZenBet: alta precisión geométrica, trazo fino (1.75),
   fondos oscuros #0D0D0D y acentos duales Shibuya Lime (#D4FF3F) / Crimson (#FF3F7F).
   ========================================================================== */

export interface SportIconProps extends SVGProps<SVGSVGElement> {
  size?: number | string;
  strokeWidth?: number | string;
}

/** UFC / MMA: Octágono icónico de combate con líneas de cruce y nodo central de strike */
export function MmaLineIcon({
  size = 24,
  strokeWidth = 1.75,
  className = '',
  ...props
}: SportIconProps) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      width={size}
      height={size}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth={strokeWidth}
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
      {...props}
    >
      <polygon points='7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2' />
      <line x1='8.5' y1='8.5' x2='15.5' y2='15.5' />
      <line x1='15.5' y1='8.5' x2='8.5' y2='15.5' />
      <circle cx='12' cy='12' r='1.5' fill='currentColor' stroke='none' />
    </svg>
  );
}

/** Fútbol / Soccer: Balón geométrico de precisión con costuras radiales y pentágono central */
export function SoccerLineIcon({
  size = 24,
  strokeWidth = 1.75,
  className = '',
  ...props
}: SportIconProps) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      width={size}
      height={size}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth={strokeWidth}
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
      {...props}
    >
      <circle cx='12' cy='12' r='9.5' />
      <polygon points='12 7.5 15.8 10.3 14.3 14.8 9.7 14.8 8.2 10.3' />
      <line x1='12' y1='7.5' x2='12' y2='2.5' />
      <line x1='15.8' y1='10.3' x2='20.1' y2='8.9' />
      <line x1='14.3' y1='14.8' x2='17.2' y2='18.7' />
      <line x1='9.7' y1='14.8' x2='6.8' y2='18.7' />
      <line x1='8.2' y1='10.3' x2='3.9' y2='8.9' />
    </svg>
  );
}

/** Baloncesto / Basketball: Esfera de básquetbol con canales ortogonales y costuras curvas */
export function BasketballLineIcon({
  size = 24,
  strokeWidth = 1.75,
  className = '',
  ...props
}: SportIconProps) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      width={size}
      height={size}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth={strokeWidth}
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
      {...props}
    >
      <circle cx='12' cy='12' r='9.5' />
      <line x1='12' y1='2.5' x2='12' y2='21.5' />
      <line x1='2.5' y1='12' x2='21.5' y2='12' />
      <path d='M5.2 5.2C8.8 8.8 8.8 15.2 5.2 18.8' />
      <path d='M18.8 5.2C15.2 8.8 15.2 15.2 18.8 18.8' />
    </svg>
  );
}

/** Boxeo / Boxing: Guante de boxeo profesional de perfil con muñequera y cordones */
export function BoxingLineIcon({
  size = 24,
  strokeWidth = 1.75,
  className = '',
  ...props
}: SportIconProps) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      width={size}
      height={size}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth={strokeWidth}
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
      {...props}
    >
      <path d='M6.5 13.5C5 12 4.5 9 5.5 6.5 6.8 3.5 10 2 13 2.5c3 .5 5.5 2.5 6 5.5.5 3-.5 6-2.5 8' />
      <path d='M7 8.5C5.5 9 4.5 10.5 5 12c.5 1.5 2 2 3.5 1.5' />
      <rect x='8.5' y='16' width='9' height='5' rx='1' />
      <line x1='11' y1='18' x2='15' y2='18' />
      <line x1='11' y1='19.5' x2='15' y2='19.5' />
    </svg>
  );
}

/** Esports: Mando de consola ergonómico y estilizado con cruceta, botones y leds de telemetría */
export function EsportsLineIcon({
  size = 24,
  strokeWidth = 1.75,
  className = '',
  ...props
}: SportIconProps) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      width={size}
      height={size}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth={strokeWidth}
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
      {...props}
    >
      <path d='M6 8a4 4 0 0 1 6.5-1.5A4 4 0 0 1 18 8c1.5 2 2.5 5.5 1 8.5-1 2-3 2.5-4.5 1l-1.5-1.5h-2L9.5 17.5C8 19 6 18.5 5 16.5 3.5 13.5 4.5 10 6 8Z' />
      <line x1='7.5' y1='11.5' x2='10.5' y2='11.5' />
      <line x1='9' y1='10' x2='9' y2='13' />
      <circle cx='15.5' cy='10.5' r='.7' fill='currentColor' stroke='none' />
      <circle cx='14' cy='12' r='.7' fill='currentColor' stroke='none' />
      <circle cx='17' cy='12' r='.7' fill='currentColor' stroke='none' />
      <circle cx='15.5' cy='13.5' r='.7' fill='currentColor' stroke='none' />
      <line x1='11.2' y1='10.5' x2='12.8' y2='10.5' />
    </svg>
  );
}

/** Tenis / Tennis: Raqueta cruzada con cordaje de línea fina y pelota de tenis con costura */
export function TennisLineIcon({
  size = 24,
  strokeWidth = 1.75,
  className = '',
  ...props
}: SportIconProps) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      width={size}
      height={size}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth={strokeWidth}
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
      {...props}
    >
      <ellipse cx='14.5' cy='7.5' rx='6' ry='5' transform='rotate(-45 14.5 7.5)' />
      <line x1='12' y1='5' x2='17' y2='10' />
      <line x1='14' y1='3' x2='19' y2='8' />
      <line x1='10' y1='7' x2='15' y2='12' />
      <line x1='12' y1='10' x2='17' y2='5' />
      <line x1='10' y1='8' x2='15' y2='3' />
      <path d='M9.5 12.5L6.5 15.5M11.5 14.5L8.5 17.5' />
      <line x1='7.5' y1='16.5' x2='3' y2='21' />
      <line x1='3' y1='21' x2='4.5' y2='22.5' />
      <line x1='4.5' y1='22.5' x2='9' y2='18' />
      <circle cx='19' cy='17' r='3' />
      <path d='M17 15.5c1 .5 1.5 1.5 1.5 2.5' />
    </svg>
  );
}

/** Béisbol / Baseball: Pelota de béisbol con costuras gemelas y pespuntes en chevron */
export function BaseballLineIcon({
  size = 24,
  strokeWidth = 1.75,
  className = '',
  ...props
}: SportIconProps) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      width={size}
      height={size}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth={strokeWidth}
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
      {...props}
    >
      <circle cx='12' cy='12' r='9.5' />
      <path d='M6.5 4.5C9.5 7 9.5 17 6.5 19.5' />
      <path d='M17.5 4.5C14.5 7 14.5 17 17.5 19.5' />
      <line x1='7' y1='7.5' x2='8.5' y2='7' />
      <line x1='7.8' y1='10.5' x2='9.3' y2='10' />
      <line x1='7.8' y1='13.5' x2='9.3' y2='14' />
      <line x1='7' y1='16.5' x2='8.5' y2='17' />
      <line x1='17' y1='7.5' x2='15.5' y2='7' />
      <line x1='16.2' y1='10.5' x2='14.7' y2='10' />
      <line x1='16.2' y1='13.5' x2='14.7' y2='14' />
      <line x1='17' y1='16.5' x2='15.5' y2='17' />
    </svg>
  );
}

/** Mapeo canónico de íconos de línea fina por disciplina deportiva */
export const SPORT_ICONS: Readonly<Record<SportsbookSportId, React.ComponentType<SportIconProps>>> = {
  mma: MmaLineIcon,
  soccer: SoccerLineIcon,
  basketball: BasketballLineIcon,
  boxing: BoxingLineIcon,
  esports: EsportsLineIcon,
  tennis: TennisLineIcon,
  baseball: BaseballLineIcon,
};

/* ==========================================================================
   ARTE CLÁSICO Y CATÁLOGO EDITORIAL
   ========================================================================== */

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

