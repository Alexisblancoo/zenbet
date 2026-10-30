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
  readonly nickname?: string | null;
  readonly countryCode: string;
  readonly country: string;
  readonly record: string;
  readonly rank: string | null;
  readonly division: string;
  readonly divisionLabel: string;
  readonly imageUrl: string | null;
  readonly wins: number;
  readonly losses: number;
  readonly draws: number;
  readonly winRate: number;
  readonly reachInches: number | null;
  readonly stance: string | null;
  readonly takedownDefensePercent: number | null;
  readonly strikingAccuracyPercent: number | null;
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
  readonly posterUrl?: string | null;
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
  /** Cierre estimado por el backend; no es la hora oficial del resultado. */
  readonly endsAt: string;
  readonly isExpired: boolean;
  readonly isBettingOpen: boolean;
  readonly result: UfcFightResult | null;
  readonly clock: UfcFightClock | null;
  readonly competition: string | null;
  readonly posterUrl?: string | null;
  readonly promotionLogoUrl?: string | null;
  readonly bout: UfcBout;
  readonly markets: readonly UfcMarket[];
  readonly oddsUpdatedAt: string | null;
}

/** Resultado oficial publicado por la API. */
export interface UfcFightResult {
  readonly winnerCorner: 'red' | 'blue' | string;
  readonly winnerName: string;
  readonly method: string;
  readonly methodLabel: string;
  readonly round: number;
  readonly recordedAt: string;
}

/** Latido del reloj calculado en servidor. */
export interface UfcFightClock {
  readonly eventId: string;
  readonly status: string;
  readonly round: number | null;
  readonly clock: string | null;
  readonly elapsedSeconds: number;
  readonly startTime: string;
  readonly endsAt: string;
  readonly serverTime: string;
}

/** Evento `ReceiveFightUpdate` del FightHub. */
export interface UfcFightUpdate {
  readonly eventId: string;
  readonly status: string;
  readonly isExpired: boolean;
  readonly isBettingOpen: boolean;
  readonly startTime: string;
  readonly endsAt: string;
  readonly result: UfcFightResult | null;
  readonly updatedAt: string;
}

/** Evento `ReceiveCardUpdate` del FightHub. */
export interface UfcCardUpdate {
  readonly cardKey: string;
  readonly status: string;
  readonly totalCount: number;
  readonly liveCount: number;
  readonly finishedCount: number;
  readonly isBettingOpen: boolean;
  readonly updatedAt: string;
}


export interface UfcEventsPage {
  readonly items: readonly UfcEvent[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

/**
 * Ficha Head-to-Head que devuelve `/fighters/compare`. Es autosuficiente:
 * incluye perfiles, contexto del combate y mercados publicados.
 */
export interface UfcFighterComparison {
  readonly eventId: string;
  readonly eventName: string;
  readonly competition: string | null;
  readonly status: string;
  readonly startTime: string;
  readonly weightDivision: string;
  readonly weightDivisionLabel: string;
  readonly scheduledRounds: number;
  readonly isTitleFight: boolean;
  readonly billing: string;
  readonly billingLabel: string;
  readonly billingOrder: number;
  readonly venue: string;
  readonly location: string;
  readonly red: UfcFighter;
  readonly blue: UfcFighter;
  readonly markets: readonly UfcMarket[];
  readonly oddsUpdatedAt: string | null;
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
  readonly status: 'scheduled' | 'live' | 'finished' | string;
  readonly isFinished: boolean;
  readonly isBettingOpen: boolean;
  readonly liveCount: number;
  readonly finishedCount: number;
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

function readOptionalBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

const TERMINAL_EVENT_STATUSES = new Set([
  'finished',
  'cancelled',
  'canceled',
  'void',
  'finalizado',
  'cancelado',
  'anulado',
]);
const LIVE_EVENT_STATUSES = new Set(['live', 'suspended']);

/** Estados en los que el combate ya no puede aceptar picks. */
export function isTerminalEventStatus(status: string): boolean {
  return TERMINAL_EVENT_STATUSES.has(status.toLowerCase());
}

/**
 * Elegibilidad estricta para el Hero: el combate debe seguir vivo y su
 * ventana estimada no puede haber vencido. `isExpired` es la fuente principal;
 * `endsAt` actúa como red de seguridad local.
 */
export function isEventHeroEligible(event: UfcEvent, nowMs = Date.now()): boolean {
  return (
    !event.isExpired &&
    !isTerminalEventStatus(event.status) &&
    !hasReached(event.endsAt, nowMs)
  );
}

/**
 * Ventana de seguridad espejo de la API. Solo se usa cuando el payload no
 * incluye `endsAt` (por ejemplo, una API antigua o un fixture incompleto).
 */
export function estimateFightEnd(startTime: string, scheduledRounds: number): string {
  const start = new Date(startTime);
  if (Number.isNaN(start.getTime())) return startTime;

  const minutes = scheduledRounds >= 5 ? 75 : 60;
  return new Date(start.getTime() + minutes * 60_000).toISOString();
}

function hasReached(value: string, nowMs = Date.now()): boolean {
  const timestamp = new Date(value).getTime();
  return !Number.isNaN(timestamp) && timestamp <= nowMs;
}

function normalizeFightResult(value: unknown): UfcFightResult | null {
  const raw = asRecord(value);
  if (!raw) return null;

  const winnerCorner = readString(raw.winnerCorner);
  const winnerName = readString(raw.winnerName);
  const method = readString(raw.method);
  const methodLabel = readString(raw.methodLabel);
  const round = readNumber(raw.round);
  const recordedAt = readString(raw.recordedAt);

  if (!winnerCorner || !winnerName || !method || !methodLabel || round === null || !recordedAt) {
    return null;
  }

  return {
    winnerCorner,
    winnerName,
    method,
    methodLabel,
    round,
    recordedAt,
  };
}

export function normalizeFightClock(payload: unknown): UfcFightClock | null {
  const raw = asRecord(payload);
  if (!raw) return null;

  const eventId = readString(raw.eventId);
  const status = readString(raw.effectiveStatus) ?? readString(raw.status);
  const startTime = readString(raw.startTime);
  const endsAt = readString(raw.endsAt);
  const serverTime = readString(raw.serverTime);
  if (!eventId || !status || !startTime || !endsAt || !serverTime) return null;

  return {
    eventId,
    status,
    round: readNumber(raw.round),
    clock: readString(raw.clock),
    elapsedSeconds: readNumber(raw.elapsedSeconds) ?? 0,
    startTime,
    endsAt,
    serverTime,
  };
}

export function normalizeFightUpdate(payload: unknown): UfcFightUpdate | null {
  const raw = asRecord(payload);
  if (!raw) return null;

  const eventId = readString(raw.eventId);
  // El backend calcula el estado efectivo y lo publica como `status`; el alias
  // `effectiveStatus` queda aceptado para futuras versiones del contrato.
  const status = readString(raw.effectiveStatus) ?? readString(raw.status);
  const startTime = readString(raw.startTime);
  const endsAt = readString(raw.endsAt);
  const updatedAt = readString(raw.updatedAt);
  if (!eventId || !status || !startTime || !endsAt || !updatedAt) return null;

  const isExpired =
    isTerminalEventStatus(status) ||
    (readOptionalBoolean(raw.isExpired) ?? hasReached(endsAt));
  const isBettingOpen =
    !isExpired &&
    status.toLowerCase() !== 'suspended' &&
    (readOptionalBoolean(raw.isBettingOpen) ??
      (status === 'scheduled' || status === 'live'));

  return {
    eventId,
    status,
    isExpired,
    isBettingOpen,
    startTime,
    endsAt,
    result: normalizeFightResult(raw.result),
    updatedAt,
  };
}

export function normalizeCardUpdate(payload: unknown): UfcCardUpdate | null {
  const raw = asRecord(payload);
  if (!raw) return null;

  const cardKey = readString(raw.cardKey);
  const status = readString(raw.status);
  const updatedAt = readString(raw.updatedAt);
  if (!cardKey || !status || !updatedAt) return null;

  return {
    cardKey,
    status,
    totalCount: readNumber(raw.totalCount) ?? 0,
    liveCount: readNumber(raw.liveCount) ?? 0,
    finishedCount: readNumber(raw.finishedCount) ?? 0,
    isBettingOpen: readBoolean(raw.isBettingOpen),
    updatedAt,
  };
}

/** Aplica un `ReceiveFightUpdate` y/o un `ReceiveFightClock` a un evento. */
export function applyFightUpdate(
  event: UfcEvent,
  update: UfcFightUpdate | null | undefined,
  clock: UfcFightClock | null | undefined,
  nowMs = Date.now(),
): UfcEvent {
  // Sin mensaje de SignalR todavía puede existir un cierre local por `endsAt`.
  if (!update && !clock && !hasReached(event.endsAt, nowMs)) return event;

  const nextStatus = update?.status ?? clock?.status ?? event.status;
  const nextEndsAt = update?.endsAt ?? clock?.endsAt ?? event.endsAt;
  // Un evento finalizado no vuelve a abrirse por un mensaje atrasado. El reloj
  // local solo actúa como red de seguridad cuando el backend ya fijó `endsAt`.
  const nextExpired =
    event.isExpired ||
    isTerminalEventStatus(nextStatus) ||
    (update?.isExpired ?? false) ||
    hasReached(nextEndsAt, nowMs);
  const nextOpen =
    !nextExpired &&
    nextStatus.toLowerCase() !== 'suspended' &&
    (update?.isBettingOpen ?? event.isBettingOpen);

  return {
    ...event,
    status: nextStatus,
    startTime: update?.startTime ?? event.startTime,
    endsAt: nextEndsAt,
    isExpired: nextExpired,
    isBettingOpen: nextOpen,
    result: update?.result ?? event.result,
    clock: clock ?? event.clock,
  };
}

/**
 * Cruza la cartelera con los mapas del FightHub. No crea eventos nuevos: solo
 * enriquece los que ya conoce la API. `nowMs` permite cerrar un combate cuyo
 * `endsAt` ya pasó aunque el mensaje de SignalR se haya perdido.
 */
export function applyFightUpdates(
  events: readonly UfcEvent[],
  updates: Readonly<Record<string, UfcFightUpdate>>,
  clocks: Readonly<Record<string, UfcFightClock>>,
  nowMs = Date.now(),
): readonly UfcEvent[] {
  let changed = false;
  const next = events.map((event) => {
    const update = updates[event.id];
    const clock = clocks[event.id];
    const reachedEnd = !event.isExpired && hasReached(event.endsAt, nowMs);
    if (!update && !clock && !reachedEnd) return event;

    changed = true;
    return applyFightUpdate(event, update, clock, nowMs);
  });

  return changed ? next : events;
}

export function formatFightClock(clock: UfcFightClock | null): string | null {
  if (!clock || clock.status !== 'live') return null;
  if (clock.round !== null && clock.clock) return `R${clock.round} · ${clock.clock}`;
  return 'En vivo';
}

export function fightStatusLabel(event: Pick<UfcEvent, 'status' | 'isExpired'>): string {
  if (event.isExpired || isTerminalEventStatus(event.status)) return 'Finalizado';
  if (event.status === 'suspended') return 'Suspendido';
  if (LIVE_EVENT_STATUSES.has(event.status.toLowerCase())) return 'En vivo';
  return 'Programado';
}

export function fightResultLabel(result: UfcFightResult | null): string | null {
  if (!result) return null;
  return `Ganó ${result.winnerName} · ${result.methodLabel} · R${result.round}`;
}

export interface FighterRecordBreakdown {
  readonly wins: number;
  readonly losses: number;
  readonly draws: number;
  readonly total: number;
  readonly winRate: number;
}

/**
 * Interpreta el récord editorial W-L-D. Si el formato no es reconocible
 * devuelve ceros; la UI muestra el texto original en cualquier caso.
 */
export function parseFighterRecord(value: string | null | undefined): FighterRecordBreakdown {
  const parts = (value ?? '').trim().split('-');
  if (parts.length < 2 || parts.length > 3) {
    return { wins: 0, losses: 0, draws: 0, total: 0, winRate: 0 };
  }

  const wins = Number(parts[0]);
  const losses = Number(parts[1]);
  const draws = parts.length === 3 ? Number(parts[2]) : 0;

  if (![wins, losses, draws].every((part) => Number.isInteger(part) && part >= 0)) {
    return { wins: 0, losses: 0, draws: 0, total: 0, winRate: 0 };
  }

  const total = wins + losses + draws;
  return {
    wins,
    losses,
    draws,
    total,
    winRate: total === 0 ? 0 : Math.round((wins * 1000) / total) / 10,
  };
}

const STANCE_LABELS: Readonly<Record<string, string>> = {
  orthodox: 'Ortodoxa',
  southpaw: 'Zurda',
  switch: 'Cambio',
};

export function formatFighterStance(stance: string | null): string {
  if (!stance) return 'Sin dato';
  return STANCE_LABELS[stance.toLowerCase()] ?? stance;
}

function normalizeFighter(value: unknown): UfcFighter | null {
  const raw = asRecord(value);
  if (!raw) return null;

  const id = readString(raw.id);
  const name = readString(raw.name);
  if (!id || !name) return null;

  const division =
    readString(raw.division) ??
    readString(raw.weightDivision) ??
    'catchweight';

  const record = readString(raw.record) ?? '—';
  const recordBreakdown = parseFighterRecord(record);

  return {
    id,
    name,
    nickname: readString(raw.nickname),
    countryCode: readString(raw.countryCode) ?? '',
    country: readString(raw.country) ?? '',
    record,
    rank: readString(raw.rank),
    division,
    divisionLabel: readString(raw.divisionLabel) ?? division,
    imageUrl: readString(raw.imageUrl),
    wins: readNumber(raw.wins) ?? recordBreakdown.wins,
    losses: readNumber(raw.losses) ?? recordBreakdown.losses,
    draws: readNumber(raw.draws) ?? recordBreakdown.draws,
    winRate: readNumber(raw.winRate) ?? recordBreakdown.winRate,
    reachInches: readNumber(raw.reachInches),
    stance: readString(raw.stance),
    takedownDefensePercent: readNumber(raw.takedownDefensePercent),
    strikingAccuracyPercent: readNumber(raw.strikingAccuracyPercent),
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

  const rawBilling = readString(raw.billing) ?? 'prelims';
  const billing = rawBilling === 'early' ? 'early_prelims' : rawBilling;

  return {
    weightDivision: readString(raw.weightDivision) ?? red.division,
    weightDivisionLabel: readString(raw.weightDivisionLabel) ?? red.divisionLabel,
    weightLimitLbs: readNumber(raw.weightLimitLbs) ?? 0,
    scheduledRounds: readNumber(raw.scheduledRounds) ?? 3,
    isTitleFight: readBoolean(raw.isTitleFight),
    billing,
    billingLabel:
      readString(raw.billingLabel) ??
      (billing === 'early_prelims'
        ? 'Primeras preliminares'
        : billing === 'main'
          ? 'Cartelera estelar'
          : 'Preliminares'),
    billingOrder: readNumber(raw.billingOrder) ?? 99,
    venue: readString(raw.venue) ?? '',
    location: readString(raw.location) ?? '',
    posterUrl: readString(raw.posterUrl),
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

  const status = readString(raw.effectiveStatus) ?? readString(raw.status) ?? 'scheduled';
  const endsAt = readString(raw.endsAt) ?? estimateFightEnd(startTime, bout.scheduledRounds);
  const isExpired =
    isTerminalEventStatus(status) ||
    (readOptionalBoolean(raw.isExpired) ?? hasReached(endsAt));
  const isBettingOpen =
    !isExpired &&
    status.toLowerCase() !== 'suspended' &&
    (readOptionalBoolean(raw.isBettingOpen) ??
      (status === 'scheduled' || status === 'live'));

  return {
    id,
    name,
    sport: readString(raw.sport) ?? 'MMA',
    sportKey: readString(raw.sportKey) ?? 'mma',
    status,
    startTime,
    endsAt,
    isExpired,
    isBettingOpen,
    result: normalizeFightResult(raw.result),
    clock: null,
    competition: readString(raw.competition),
    posterUrl: readString(raw.posterUrl) ?? bout.posterUrl,
    promotionLogoUrl: readString(raw.promotionLogoUrl),
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

export function normalizeFighterComparison(payload: unknown): UfcFighterComparison | null {
  const raw = asRecord(payload);
  if (!raw) return null;

  const eventId = readString(raw.eventId);
  const eventName = readString(raw.eventName);
  const startTime = readString(raw.startTime);
  const red = normalizeFighter(raw.red);
  const blue = normalizeFighter(raw.blue);
  if (!eventId || !eventName || !startTime || !red || !blue) return null;

  const markets = Array.isArray(raw.markets)
    ? raw.markets
        .map(normalizeMarket)
        .filter((market): market is UfcMarket => market !== null)
        .sort((a, b) => a.displayOrder - b.displayOrder)
    : [];

  return {
    eventId,
    eventName,
    competition: readString(raw.competition),
    status: readString(raw.status) ?? 'scheduled',
    startTime,
    weightDivision: readString(raw.weightDivision) ?? red.division,
    weightDivisionLabel: readString(raw.weightDivisionLabel) ?? red.divisionLabel,
    scheduledRounds: readNumber(raw.scheduledRounds) ?? 3,
    isTitleFight: readBoolean(raw.isTitleFight),
    billing: readString(raw.billing) ?? 'prelims',
    billingLabel: readString(raw.billingLabel) ?? 'Preliminares',
    billingOrder: readNumber(raw.billingOrder) ?? 99,
    venue: readString(raw.venue) ?? '',
    location: readString(raw.location) ?? '',
    red,
    blue,
    markets,
    oddsUpdatedAt: readString(raw.oddsUpdatedAt),
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
    .filter((event) => {
      const b = event.bout.billing;
      if (billing === 'early_prelims') return b === 'early_prelims' || b === 'early';
      return b === billing;
    })
    .sort((a, b) => a.bout.billingOrder - b.bout.billingOrder);
}

/**
 * Clave estable para navegar entre sábados. La fecha UTC coincide con la fecha
 * editorial que publica la UFC para estas carteleras.
 */
export function cardKeyForEvent(event: UfcEvent): string {
  const comp = (event.competition ?? '').trim();
  if (comp) {
    const slug = comp
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    if (slug) return slug;
  }
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

      const finishedCount = sorted.filter(
        (event) => event.isExpired || isTerminalEventStatus(event.status),
      ).length;
      const liveCount = sorted.filter(
        (event) => event.status === 'live' && !event.isExpired,
      ).length;
      const isFinished = sorted.length > 0 && finishedCount === sorted.length;
      const isBettingOpen = sorted.some(
        (event) => event.isBettingOpen && !event.isExpired,
      );
      const status = isFinished
        ? 'finished'
        : liveCount > 0
          ? 'live'
          : sorted.some((event) => event.status === 'suspended')
            ? 'suspended'
            : 'scheduled';

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
        status,
        isFinished,
        isBettingOpen,
        liveCount,
        finishedCount,
      } satisfies UfcCard;
    })
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

export function isUfcCardHeroEligible(card: UfcCard, nowMs = Date.now()): boolean {
  return card.events.some((event) => isEventHeroEligible(event, nowMs));
}

function findDefaultUfcCard(
  cards: readonly UfcCard[],
  nowMs: number,
): UfcCard | undefined {
  // Una cartelera con combates vivos siempre manda.
  const live =
    cards.find(
      (card) =>
        card.status === 'live' &&
        card.isBettingOpen &&
        isUfcCardHeroEligible(card, nowMs),
    ) ??
    cards.find(
      (card) => card.status === 'live' && isUfcCardHeroEligible(card, nowMs),
    );
  if (live) return live;

  // Después, la siguiente cartelera activa con mercado abierto. Las carteleras
  // terminadas nunca compiten aquí aunque su fecha local sea "hoy".
  const nextOpen = cards.find(
    (card) => card.isBettingOpen && isUfcCardHeroEligible(card, nowMs),
  );
  if (nextOpen) return nextOpen;

  const nextActive = cards.find((card) => isUfcCardHeroEligible(card, nowMs));
  if (nextActive) return nextActive;

  // Fallback solo para navegación: permite revisar resultados antiguos, pero
  // el Hero se mantiene oculto porque no hay ningún evento elegible.
  return cards[cards.length - 1] ?? cards[0];
}

export function findUfcCard(
  cards: readonly UfcCard[],
  key: string | null,
  nowMs = Date.now(),
): UfcCard | undefined {
  if (key) {
    const requested = cards.find((card) => card.key === key);
    if (requested) return requested;
  }

  return findDefaultUfcCard(cards, nowMs);
}

export interface UfcHeroSelection {
  readonly card: UfcCard;
  readonly event: UfcEvent;
}

function heroEventForCard(card: UfcCard, nowMs: number): UfcEvent | null {
  const eligible = card.events.filter((event) => isEventHeroEligible(event, nowMs));
  if (eligible.length === 0) return null;

  const live = eligible.find((event) => event.status.toLowerCase() === 'live');
  if (live) return live;

  const mainEvent =
    eligible.find((event) => event.id === card.mainEvent.id) ??
    eligible.find(
      (event) => event.bout.billing === 'main' && event.bout.billingOrder === 1,
    );
  if (mainEvent) return mainEvent;

  return (
    [...eligible].sort((a, b) => {
      const time = a.startTime.localeCompare(b.startTime);
      return time !== 0 ? time : a.bout.billingOrder - b.bout.billingOrder;
    })[0] ?? null
  );
}

/**
 * Selecciona el evento que puede ocupar el Hero. Prioriza la cartelera
 * solicitada si sigue elegible; si expiró, rota a la cartelera viva o a la
 * siguiente activa. Devuelve `null` cuando no queda ningún combate válido.
 */
export function findUfcHero(
  cards: readonly UfcCard[],
  preferredKey: string | null,
  nowMs = Date.now(),
): UfcHeroSelection | null {
  const eligibleCards = cards.filter((card) => isUfcCardHeroEligible(card, nowMs));
  if (eligibleCards.length === 0) return null;

  const preferred = preferredKey
    ? eligibleCards.find((card) => card.key === preferredKey)
    : undefined;
  const live =
    eligibleCards.find((card) => card.status === 'live' && card.isBettingOpen) ??
    eligibleCards.find((card) => card.status === 'live');
  const nextOpen = eligibleCards.find((card) => card.isBettingOpen);

  const candidates = [preferred, live, nextOpen, ...eligibleCards].filter(
    (card): card is UfcCard => card !== undefined,
  );
  const seen = new Set<string>();

  for (const card of candidates) {
    if (seen.has(card.key)) continue;
    seen.add(card.key);

    const event = heroEventForCard(card, nowMs);
    if (event) return { card, event };
  }

  return null;
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
  if (!market) return undefined;
  const match = market.selections.find((selection) => selection.code === code);
  if (match) return match;
  if (code === 'red' && market.selections.length > 0) return market.selections[0];
  if (code === 'blue' && market.selections.length > 1) return market.selections[1];
  return undefined;
}

/** Nombre de la fuente tal como se muestra; «Zenbet Reference» va en árabe libanés. */
export function displaySourceName(name: string | null | undefined): string {
  if (!name) return '';
  return /^zenbet\s+reference$/i.test(name.trim()) ? 'مرجع زنبت' : name;
}

export function marketSourceLabel(source: UfcMarketSource | null): string {
  if (!source) return 'Cuota de referencia';
  const name = displaySourceName(source.name);
  if (source.kind === 'aggregator') return `Consenso ${name}`;
  if (source.kind === 'exchange') return `Exchange ${name}`;
  if (source.kind === 'model') return `Modelo ${name}`;
  return name;
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
