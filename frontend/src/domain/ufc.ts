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

export const UFC_BILLING_SECTIONS = [
  { key: 'main', label: 'Cartelera estelar', shortLabel: 'Estelar' },
  { key: 'prelims', label: 'Preliminares', shortLabel: 'Prelims' },
  { key: 'early_prelims', label: 'Preliminares tempranas', shortLabel: 'Early' },
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
  };
}

function normalizeBout(value: unknown): UfcBout | null {
  const raw = asRecord(value);
  if (!raw) return null;

  const red = normalizeFighter(raw.red);
  const blue = normalizeFighter(raw.blue);
  if (!red || !blue) return null;

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
    red,
    blue,
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

export function findMarket(
  event: UfcEvent,
  typeKey: UfcMarketTypeKey,
): UfcMarket | undefined {
  return event.markets.find((market) => market.typeKey === typeKey);
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
