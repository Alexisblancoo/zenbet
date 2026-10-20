/**
 * Entidades y reglas del feed de cuotas en tiempo real.
 *
 * Capa de dominio: sin React ni SignalR. `parseOddsUpdate` es tolerante a los
 * alias del backend (`newOdd`, `selection`, `eventId`, …) para que un cambio de
 * contrato no rompa la UI.
 */

export type OddsTrend = 'up' | 'down' | 'unchanged';

export interface OddsQuote {
  /** Cuota decimal vigente (ej. 1.85). */
  readonly odds: number;
  /** Cuota previa observada; `null` si es la primera cotización. */
  readonly previousOdds: number | null;
  /** Dirección del último movimiento. */
  readonly trend: OddsTrend;
  /** Monótono: permite reiniciar la animación de flash aunque el valor se repita. */
  readonly sequence: number;
  /** Epoch ms del último mensaje aplicado. */
  readonly updatedAt: number;
}

export interface OddsUpdate {
  readonly marketId: string;
  readonly selectionId: string;
  readonly odds: number;
  readonly occurredAt?: string;
}

/** Cuota decimal mínima válida: descarta 0, NaN y valores de prueba. */
const MIN_VALID_ODDS = 1.0001;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

export function resolveOddsTrend(next: number, previous: number | null | undefined): OddsTrend {
  if (previous === null || previous === undefined || !Number.isFinite(previous)) return 'unchanged';
  if (next > previous) return 'up';
  if (next < previous) return 'down';
  return 'unchanged';
}

/**
 * Normaliza el payload de `ReceiveOddsUpdate`.
 * Soporta el formato del hub (`{ marketId, oddsUpdate: { selectionId, newOdd } }`).
 */
export function parseOddsUpdate(payload: unknown): OddsUpdate | null {
  if (!isRecord(payload)) return null;

  const nested = isRecord(payload.oddsUpdate) ? payload.oddsUpdate : payload;

  const selectionId =
    readString(nested.selectionId) ??
    readString(nested.selection) ??
    readString(nested.fighterId) ??
    readString(nested.selection_id);
  if (!selectionId) return null;

  const odds =
    readNumber(nested.newOdd) ??
    readNumber(nested.odds) ??
    readNumber(nested.price) ??
    readNumber(nested.newOdds) ??
    readNumber(nested.odd);
  if (odds === undefined || odds < MIN_VALID_ODDS) return null;

  const marketId =
    readString(nested.marketId) ??
    readString(payload.marketId) ??
    readString(nested.eventId) ??
    readString(payload.eventId) ??
    '';

  const occurredAt = readString(nested.timestamp) ?? readString(payload.timestamp);

  return { marketId, selectionId, odds, ...(occurredAt ? { occurredAt } : {}) };
}

/**
 * Merge puro e inmutable: devuelve el mismo mapa si la cuota no cambió
 * (evita re-render y flash innecesarios).
 */
export function applyOddsUpdate(
  quotes: Readonly<Record<string, OddsQuote>>,
  update: OddsUpdate,
): Record<string, OddsQuote> {
  const previous = quotes[update.selectionId] ?? null;

  if (previous && previous.odds === update.odds) return quotes as Record<string, OddsQuote>;

  const parsedTimestamp = update.occurredAt ? Date.parse(update.occurredAt) : Number.NaN;

  return {
    ...quotes,
    [update.selectionId]: {
      odds: update.odds,
      previousOdds: previous?.odds ?? null,
      trend: resolveOddsTrend(update.odds, previous?.odds ?? null),
      sequence: (previous?.sequence ?? 0) + 1,
      updatedAt: Number.isFinite(parsedTimestamp) ? parsedTimestamp : Date.now(),
    },
  };
}
