import type { IconType } from 'react-icons';
import {
  GiBearHead,
  GiBullHorns,
  GiCamelHead,
  GiCondorEmblem,
  GiEagleEmblem,
  GiEagleHead,
  GiElephantHead,
  GiFoxHead,
  GiKangaroo,
  GiKiwiBird,
  GiLion,
  GiPanda,
  GiRooster,
  GiTigerHead,
  GiWolfHead,
} from 'react-icons/gi';

export interface PlaceAnimal {
  readonly key: string;
  /** Ilustración en tinta (WebP con alfa). Si falta, se usa la silueta de respaldo. */
  readonly image?: string;
  /** Nombre en español del animal que representa el lugar. */
  readonly label: string;
  readonly Icon: IconType;
}

const ART_BASE = import.meta.env.BASE_URL.endsWith('/')
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`;
const ink = (name: string) => `${ART_BASE}art/animals/${name}.webp`;

const ANIMALS = {
  eagle: { key: 'eagle', image: ink('aguila'), label: 'Águila calva', Icon: GiEagleHead },
  imperialEagle: { key: 'imperialEagle', label: 'Águila imperial', Icon: GiEagleEmblem },
  lion: { key: 'lion', image: ink('leon'), label: 'León', Icon: GiLion },
  bull: { key: 'bull', label: 'Toro', Icon: GiBullHorns },
  jaguar: { key: 'jaguar', image: ink('jaguar'), label: 'Jaguar', Icon: GiTigerHead },
  condor: { key: 'condor', label: 'Cóndor', Icon: GiCondorEmblem },
  camel: { key: 'camel', image: ink('camello'), label: 'Camello', Icon: GiCamelHead },
  kangaroo: { key: 'kangaroo', image: ink('canguro'), label: 'Canguro', Icon: GiKangaroo },
  bear: { key: 'bear', image: ink('oso'), label: 'Oso', Icon: GiBearHead },
  rooster: { key: 'rooster', label: 'Gallo', Icon: GiRooster },
  wolf: { key: 'wolf', image: ink('lobo'), label: 'Lobo', Icon: GiWolfHead },
  panda: { key: 'panda', label: 'Panda', Icon: GiPanda },
  fox: { key: 'fox', label: 'Zorro', Icon: GiFoxHead },
  elephant: { key: 'elephant', label: 'Elefante', Icon: GiElephantHead },
  kiwi: { key: 'kiwi', label: 'Kiwi', Icon: GiKiwiBird },
} as const satisfies Record<string, PlaceAnimal>;

/**
 * Animal emblemático por lugar. Es un recurso decorativo: se elige por palabras
 * clave del país o ciudad que ya trae la API; no inventa ningún dato del evento.
 */
const RULES: ReadonlyArray<readonly [PlaceAnimal, readonly string[]]> = [
  [ANIMALS.eagle, ['usa', 'united states', 'estados unidos', 'eeuu', 'las vegas', 'nevada', 'new york', 'nueva york', 'miami', 'texas', 'los angeles', 'houston', 'newark']],
  [ANIMALS.lion, ['england', 'inglaterra', 'united kingdom', 'reino unido', 'london', 'londres', 'manchester', 'liverpool', 'scotland', 'escocia']],
  [ANIMALS.bull, ['spain', 'españa', 'madrid', 'barcelona', 'sevilla', 'valencia']],
  [ANIMALS.jaguar, ['brazil', 'brasil', 'rio de janeiro', 'sao paulo', 'mexico', 'méxico', 'argentina', 'buenos aires']],
  [ANIMALS.condor, ['bolivia', 'la paz', 'santa cruz', 'peru', 'perú', 'lima', 'chile', 'santiago', 'colombia']],
  [ANIMALS.camel, ['abu dhabi', 'dubai', 'emirates', 'emiratos', 'uae', 'saudi', 'arabia', 'riyadh', 'qatar', 'doha']],
  [ANIMALS.kangaroo, ['australia', 'sydney', 'melbourne', 'perth']],
  [ANIMALS.kiwi, ['new zealand', 'nueva zelanda', 'auckland']],
  [ANIMALS.bear, ['canada', 'canadá', 'toronto', 'vancouver', 'montreal']],
  [ANIMALS.rooster, ['france', 'francia', 'paris', 'parís']],
  [ANIMALS.wolf, ['italy', 'italia', 'rome', 'roma', 'milan', 'milán']],
  [ANIMALS.imperialEagle, ['germany', 'alemania', 'berlin', 'munich', 'frankfurt', 'poland', 'polonia', 'czech', 'chequia', 'prague', 'praga']],
  [ANIMALS.panda, ['china', 'shanghai', 'beijing', 'macau', 'macao']],
  [ANIMALS.fox, ['japan', 'japón', 'tokyo', 'tokio', 'saitama', 'osaka']],
  [ANIMALS.elephant, ['thailand', 'tailandia', 'bangkok', 'india', 'singapore', 'singapur']],
];

const CODE_RULES: Readonly<Record<string, PlaceAnimal>> = {
  AE: ANIMALS.camel,
  AU: ANIMALS.kangaroo,
  BO: ANIMALS.condor,
  BR: ANIMALS.jaguar,
  CA: ANIMALS.bear,
  CL: ANIMALS.condor,
  CN: ANIMALS.panda,
  CZ: ANIMALS.imperialEagle,
  DE: ANIMALS.imperialEagle,
  ES: ANIMALS.bull,
  EU: ANIMALS.bull,
  FR: ANIMALS.rooster,
  GB: ANIMALS.lion,
  IN: ANIMALS.elephant,
  IT: ANIMALS.wolf,
  JP: ANIMALS.fox,
  MX: ANIMALS.jaguar,
  NZ: ANIMALS.kiwi,
  US: ANIMALS.eagle,
  PE: ANIMALS.condor,
  PL: ANIMALS.imperialEagle,
  SA: ANIMALS.camel,
  SG: ANIMALS.elephant,
  TH: ANIMALS.elephant,
  UK: ANIMALS.lion,
};

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Coincidencia por palabra completa (evita que "es" coincida dentro de "Estados"). */
function hasWord(haystack: string, word: string): boolean {
  const w = normalize(word);
  return new RegExp(`(^|[^a-z])${w}([^a-z]|$)`).test(haystack);
}

/**
 * Devuelve el animal del lugar. Primero busca por nombre de país o ciudad y luego
 * por código de país (ISO-2); si no se reconoce, un lobo como emblema neutro.
 */
export function animalForPlace(
  place: string | null | undefined,
  countryCode?: string | null,
): PlaceAnimal {
  const text = normalize(place ?? '');
  for (const [animal, words] of RULES) {
    if (words.some((word) => hasWord(text, word))) return animal;
  }
  const byCode = countryCode ? CODE_RULES[countryCode.toUpperCase()] : undefined;
  return byCode ?? ANIMALS.wolf;
}

/** Pinta el animal del lugar: tinta en el color de acento, o la silueta de respaldo. */
export function AnimalInk({ animal, className = '' }: { readonly animal: PlaceAnimal; readonly className?: string }) {
  if (animal.image) {
    return (
      <span
        aria-hidden='true'
        className={`hx-ink ${className}`}
        style={{ WebkitMaskImage: `url(${animal.image})`, maskImage: `url(${animal.image})` }}
      />
    );
  }
  const { Icon } = animal;
  return <Icon aria-hidden='true' className={`absolute inset-[14%] h-[72%] w-[72%] text-[color:var(--ac,#D4FF3F)] ${className}`} />;
}
