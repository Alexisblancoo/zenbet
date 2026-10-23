/**
 * Contrato de lectura de la cartelera UFC.
 *
 * La API entrega IDs GUID de evento, mercado y selección. La UI no los
 * reconstruye: los usa tal cual para el boleto y para los grupos de SignalR.
 * Los normalizadores son deliberadamente tolerantes para que un campo nuevo no
 * tumbe la página, pero nunca inventan peleadores ni cuotas.
 */

export interface UfcFighter {
  readonly id: string;
  readonly name: string;
  readonly countryCode: string;
  readonly country: string;
  readonly record: string;
  readonly rank: string | null;
  readonly division: string;
  readonly divisionLabel: string;
  readonly imageUrl: string | null;
}

export interface UfcBout {
  readonly weightDivision: string;
  readonly weightDivisionLabel: string;
  readonly weightLimitLbs: number;
  readonly scheduledRounds: number;
  readonly isTitleFight: boolean;
  readonly billing: string;
  readonly billingLabel: string;
  readonly billingOrder: number;
  readonly venue: string;
  readonly location: string;
  readonly fighter1ImageUrl: string | null;
  readonly fighter2ImageUrl: string | null;
  readonly red: UfcFighter;
  readonly blue: UfcFighter;
}

export interface UfcSelection {
  readonly id: string;
  readonly code: string | null;
  readonly name: string;
  readonly decimalOdds: number;
  readonly americanOdds: string;
  readonly displayOrder: number;
  readonly settled: boolean;
  readonly provider: string | null;
  readonly updatedAt: string | null;
}

export interface UfcMarketSource {
  readonly kind: string;
  readonly name: string;
  readonly url: string | null;
  readonly observedAt: string;
  readonly note: string | null;
}

export interface UfcMarket {
  readonly id: string;
  readonly type: string;
  readonly typeKey: string;
  readonly name: string;
  readonly line: number | null;
  readonly displayOrder: number;
  readonly status: string;
  readonly provider: string | null;
  readonly updatedAt: string | null;
  readonly source: UfcMarketSource | null;
  readonly selections: readonly UfcSelection[];
}

export interface UfcEvent {
  readonly id: string;
  readonly name: string;
  readonly sport: string;
  readonly sportKey: string;
  readonly status: string;
  readonly startTime: string;
  readonly competition: string | null;
  readonly bout: UfcBout;
  readonly markets: readonly UfcMarket[];
  readonly oddsUpdatedAt: string | null;
}

export interface UfcEventsPage {
  readonly items: readonly UfcEvent[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

/**
 * Agrupación de presentación de una cartelera. La API entrega un evento por
 * combate; esta estructura reúne los combates del mismo sábado sin inventar
 * datos ni alterar los IDs que consume el boleto.
 */
export interface UfcCard {
  readonly key: string;
  readonly competition: string;
  readonly startTime: string;
  readonly events: readonly UfcEvent[];
  readonly mainEvent: UfcEvent;
  readonly venue: string;
  readonly location: string;
  readonly marketCount: number;
  readonly selectionCount: number;
}

export type UfcMarketTypeKey =
  | 'moneyline'
  | 'method_of_victory'
  | 'total_rounds'
  | 'go_to_decision';

export const UFC_MARKET_LABELS: Record<UfcMarketTypeKey, string> = {
  moneyline: 'Ganador',
  method_of_victory: 'Método',
  total_rounds: 'Asaltos',
  go_to_decision: 'Decisión',
};

/**
 * Orden editorial de la matriz. Las cuatro familias se muestran a la vez para
 * que el usuario compare sin cambiar de pestaña, como en una cartelera densa.
 */
export const UFC_MARKET_FAMILIES = [
  {
    key: 'moneyline',
    label: 'Ganador',
    shortLabel: 'ML',
    caption: 'Moneyline',
    description: 'Quién gana el combate',
  },
  {
    key: 'method_of_victory',
    label: 'Método',
    shortLabel: 'MÉT',
    caption: 'Method',
    description: 'KO/TKO, sumisión o decisión',
  },
  {
    key: 'total_rounds',
    label: 'Asaltos',
    shortLabel: 'O/U',
    caption: 'Total rounds',
    description: 'Línea de asaltos completados',
  },
  {
    key: 'go_to_decision',
    label: 'Decisión',
    shortLabel: 'DIST',
    caption: 'Distance',
    description: 'Si el combate llega a las tarjetas',
  },
] as const satisfies readonly {
  key: UfcMarketTypeKey;
  label: string;
  shortLabel: string;
  caption: string;
  description: string;
}[];

export const UFC_BILLING_SECTIONS = [
  { key: 'main', label: 'Cartelera estelar', shortLabel: 'Estelar' },
  { key: 'prelims', label: 'Preliminares', shortLabel: 'Prelims' },
  { key: 'early_prelims', label: 'Preliminares tempranas', shortLabel: 'Tempranas' },
] as const;

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readNumber(value: unknown): number | null {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
        ? Number(value)
        : Number.NaN;

  return Number.isFinite(parsed) ? parsed : null;
}

function readBoolean(value: unknown): boolean {
  return value === true;
}

function normalizeFighter(value: unknown): UfcFighter | null {
  const raw = asRecord(value);
  if (!raw) return null;

  const id = readString(raw.id);
  const name = readString(raw.name);
  const division = readString(raw.division);
  if (!id || !name || !division) return null;

  return {
    id,
    name,
    countryCode: readString(raw.countryCode) ?? '',
    country: readString(raw.country) ?? '',
    record: readString(raw.record) ?? '—',
    rank: readString(raw.rank),
    division,
    divisionLabel: readString(raw.divisionLabel) ?? division,
    imageUrl: readString(raw.imageUrl),
  };
}

function normalizeBout(value: unknown): UfcBout | null {
  const raw = asRecord(value);
  if (!raw) return null;

  const red = normalizeFighter(raw.red);
  const blue = normalizeFighter(raw.blue);
  if (!red || !blue) return null;

  const fighter1ImageUrl = readString(raw.fighter1ImageUrl) ?? red.imageUrl;
  const fighter2ImageUrl = readString(raw.fighter2ImageUrl) ?? blue.imageUrl;

  return {
    weightDivision: readString(raw.weightDivision) ?? red.division,
    weightDivisionLabel: readString(raw.weightDivisionLabel) ?? red.divisionLabel,
    weightLimitLbs: readNumber(raw.weightLimitLbs) ?? 0,
    scheduledRounds: readNumber(raw.scheduledRounds) ?? 3,
    isTitleFight: readBoolean(raw.isTitleFight),
    billing: readString(raw.billing) ?? 'prelims',
    billingLabel: readString(raw.billingLabel) ?? 'Preliminares',
    billingOrder: readNumber(raw.billingOrder) ?? 99,
    venue: readString(raw.venue) ?? '',
    location: readString(raw.location) ?? '',
    fighter1ImageUrl,
    fighter2ImageUrl,
    red: { ...red, imageUrl: fighter1ImageUrl },
    blue: { ...blue, imageUrl: fighter2ImageUrl },
  };
}

function normalizeSelection(value: unknown): UfcSelection | null {
  const raw = asRecord(value);
  if (!raw) return null;

  const id = readString(raw.id);
  const name = readString(raw.name);
  const decimalOdds = readNumber(raw.decimalOdds);
  if (!id || !name || decimalOdds === null || decimalOdds <= 1) return null;

  return {
    id,
    code: readString(raw.code),
    name,
    decimalOdds,
    americanOdds: readString(raw.americanOdds) ?? formatAmericanOdds(decimalOdds),
    displayOrder: readNumber(raw.displayOrder) ?? 0,
    settled: readBoolean(raw.settled),
    provider: readString(raw.provider),
    updatedAt: readString(raw.updatedAt),
  };
}

function normalizeMarketSource(value: unknown): UfcMarketSource | null {
  const raw = asRecord(value);
  if (!raw) return null;

  const name = readString(raw.name);
  const observedAt = readString(raw.observedAt);
  if (!name || !observedAt) return null;

  return {
    kind: readString(raw.kind) ?? 'unknown',
    name,
    url: readString(raw.url),
    observedAt,
    note: readString(raw.note),
  };
}

function normalizeMarket(value: unknown): UfcMarket | null {
  const raw = asRecord(value);
  if (!raw) return null;

  const id = readString(raw.id);
  const typeKey = readString(raw.typeKey);
  const name = readString(raw.name);
  if (!id || !typeKey || !name) return null;

  const selections = Array.isArray(raw.selections)
    ? raw.selections
        .map(normalizeSelection)
        .filter((selection): selection is UfcSelection => selection !== null)
        .sort((a, b) => a.displayOrder - b.displayOrder)
    : [];

  if (selections.length === 0) return null;

  return {
    id,
    type: readString(raw.type) ?? typeKey,
    typeKey,
    name,
    line: readNumber(raw.line),
    displayOrder: readNumber(raw.displayOrder) ?? 0,
    status: readString(raw.status) ?? 'open',
    provider: readString(raw.provider),
    updatedAt: readString(raw.updatedAt),
    source: normalizeMarketSource(raw.source),
    selections,
  };
}

function normalizeEvent(value: unknown): UfcEvent | null {
  const raw = asRecord(value);
  if (!raw) return null;

  const id = readString(raw.id);
  const name = readString(raw.name);
  const startTime = readString(raw.startTime);
  const bout = normalizeBout(raw.bout);
  if (!id || !name || !startTime || !bout) return null;

  const markets = Array.isArray(raw.markets)
    ? raw.markets
        .map(normalizeMarket)
        .filter((market): market is UfcMarket => market !== null)
        .sort((a, b) => a.displayOrder - b.displayOrder)
    : [];

  return {
    id,
    name,
    sport: readString(raw.sport) ?? 'MMA',
    sportKey: readString(raw.sportKey) ?? 'mma',
    status: readString(raw.status) ?? 'scheduled',
    startTime,
    competition: readString(raw.competition),
    bout,
    markets,
    oddsUpdatedAt: readString(raw.oddsUpdatedAt),
  };
}

export function normalizeEventsPage(payload: unknown): UfcEventsPage {
  const raw = asRecord(payload);
  if (!raw) return { items: [], total: 0, page: 1, pageSize: 50 };

  const items = Array.isArray(raw.items)
    ? raw.items
        .map(normalizeEvent)
        .filter((event): event is UfcEvent => event !== null)
        .filter((event) => event.sportKey === 'mma')
    : [];

  return {
    items,
    total: readNumber(raw.total) ?? items.length,
    page: readNumber(raw.page) ?? 1,
    pageSize: readNumber(raw.pageSize) ?? 50,
  };
}

export function formatAmericanOdds(decimalOdds: number): string {
  if (!Number.isFinite(decimalOdds) || decimalOdds <= 1) return '—';

  const american =
    decimalOdds >= 2
      ? Math.round((decimalOdds - 1) * 100)
      : -Math.round(100 / (decimalOdds - 1));

  return american > 0 ? `+${american}` : String(american);
}

export function eventsForBilling(
  events: readonly UfcEvent[],
  billing: string,
): readonly UfcEvent[] {
  return events
    .filter((event) => event.bout.billing === billing)
    .sort((a, b) => a.bout.billingOrder - b.bout.billingOrder);
}

/**
 * Clave estable para navegar entre sábados. La fecha UTC coincide con la fecha
 * editorial que publica la UFC para estas carteleras.
 */
export function cardKeyForEvent(event: UfcEvent): string {
  return event.startTime.slice(0, 10);
}

export function buildUfcCards(events: readonly UfcEvent[]): readonly UfcCard[] {
  const groups = new Map<string, UfcEvent[]>();

  for (const event of events) {
    const key = cardKeyForEvent(event);
    const group = groups.get(key);
    if (group) group.push(event);
    else groups.set(key, [event]);
  }

  return [...groups.entries()]
    .map(([key, groupEvents]) => {
      const sorted = [...groupEvents].sort((a, b) => {
        const time = a.startTime.localeCompare(b.startTime);
        return time !== 0 ? time : a.bout.billingOrder - b.bout.billingOrder;
      });
      const mainEvent =
        sorted.find(
          (event) => event.bout.billing === 'main' && event.bout.billingOrder === 1,
        ) ?? sorted[0];

      return {
        key,
        competition: mainEvent.competition ?? mainEvent.name,
        startTime: mainEvent.startTime,
        events: sorted,
        mainEvent,
        venue: mainEvent.bout.venue,
        location: mainEvent.bout.location,
        marketCount: sorted.reduce((count, event) => count + event.markets.length, 0),
        selectionCount: sorted.reduce(
          (count, event) =>
            count + event.markets.reduce((sum, market) => sum + market.selections.length, 0),
          0,
        ),
      } satisfies UfcCard;
    })
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

export function findUfcCard(
  cards: readonly UfcCard[],
  key: string | null,
): UfcCard | undefined {
  if (!key) return cards[0];
  return cards.find((card) => card.key === key) ?? cards[0];
}

export function ufcCardNumber(competition: string): string | null {
  const match = competition.match(/\bUFC\s+(\d{2,4})\b/i);
  return match?.[1] ?? null;
}

export function formatCardDayBadge(startTime: string): string {
  const date = new Date(startTime);
  if (Number.isNaN(date.getTime())) return startTime;

  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
  })
    .format(date)
    .replace('/', '.');
}

export function formatCardLongDate(startTime: string, locale = 'es-MX'): string {
  const date = new Date(startTime);
  if (Number.isNaN(date.getTime())) return startTime;

  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function cardCity(location: string): string {
  return location.split(',')[0]?.trim() || location;
}

export function findMarket(
  event: UfcEvent,
  typeKey: UfcMarketTypeKey,
  line?: number | null,
): UfcMarket | undefined {
  return event.markets.find(
    (market) =>
      market.typeKey === typeKey &&
      (line === undefined || line === null || market.line === line),
  );
}

export function findEventSource(event: UfcEvent): UfcMarketSource | null {
  return event.markets.find((market) => market.source !== null)?.source ?? null;
}

export function findSelectionByCode(
  market: UfcMarket | undefined,
  code: string,
): UfcSelection | undefined {
  return market?.selections.find((selection) => selection.code === code);
}

export function marketSourceLabel(source: UfcMarketSource | null): string {
  if (!source) return 'Cuota de referencia';
  if (source.kind === 'aggregator') return `Consenso ${source.name}`;
  if (source.kind === 'exchange') return `Exchange ${source.name}`;
  if (source.kind === 'model') return `Modelo ${source.name}`;
  if (source.kind === 'bookmaker') return source.name;
  return source.name;
}

export function formatSnapshotAt(value: string | null, locale = 'es-MX'): string | null {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
    timeZoneName: 'short',
  })
    .format(date)
    .replace(',', ' ·')
    .replace(/\./g, '')
    .toUpperCase();
}

export function shortFighterName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : name;
}

export function formatWeightDivision(bout: UfcBout): string {
  const weight = bout.weightLimitLbs > 0 ? ` · ${bout.weightLimitLbs} lb` : '';
  return `${bout.weightDivisionLabel}${weight}`;
}

export function formatRank(fighter: UfcFighter): string {
  if (fighter.rank === 'C') return 'Campeón';
  if (fighter.rank) return fighter.rank;
  return 'Sin ranking';
}

export function formatFightDate(startTime: string, locale = 'es-MX'): string {
  const date = new Date(startTime);
  if (Number.isNaN(date.getTime())) return startTime;

  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
    .format(date)
    .replace(',', ' ·')
    .toUpperCase();
}

/**
 * La UFC publica la hora de inicio del evento, no la de cada combate. Las
 * tarjetas muestran solo el día para no inventar un horario por pelea.
 */
export function formatFightDay(startTime: string, locale = 'es-MX'): string {
  const date = new Date(startTime);
  if (Number.isNaN(date.getTime())) return startTime;

  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  })
    .format(date)
    .replace(',', ' ·')
    .toUpperCase();
}

export function formatUpdatedAt(value: string | null, locale = 'es-MX'): string | null {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
