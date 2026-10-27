import type { BetSelection } from '@/domain/bets';

/**
 * Persistencia del boleto.
 *
 * Solo se guardan las selecciones aceptadas (`BetSelection`). La cuota viva,
 * la tendencia y los recibos son estado derivado/de sesión y nunca se
 * serializan. El payload lleva versión para poder migrar o descartar datos de
 * una versión anterior sin romper la hidratación.
 */

export const BET_SLIP_STORAGE_KEY = 'zenbet:bet-slip:v1';

const BET_SLIP_STORAGE_VERSION = 1;
const MAX_PERSISTED_SELECTIONS = 50;

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function readText(value: unknown): string | null {
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

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizePersistedSelection(value: unknown): BetSelection | null {
  const raw = asRecord(value);
  if (!raw) return null;

  const selectionId = readText(raw.selectionId);
  const eventId = readText(raw.eventId);
  const selectionName = readText(raw.selectionName);
  const odds = readNumber(raw.odds);

  if (!selectionId || !eventId || !selectionName || odds === null || odds <= 1) {
    return null;
  }

  return {
    selectionId,
    eventId,
    marketId: readText(raw.marketId) ?? eventId,
    selectionName,
    eventName: readText(raw.eventName) ?? eventId,
    marketLabel: readText(raw.marketLabel) ?? 'Moneyline',
    odds,
    addedAt: readNumber(raw.addedAt) ?? 0,
    eventStatus: readText(raw.eventStatus) ?? 'scheduled',
    eventEndsAt: readText(raw.eventEndsAt) ?? '',
    eventIsExpired: readBoolean(raw.eventIsExpired, false),
    eventIsBettingOpen: readBoolean(raw.eventIsBettingOpen, true),
    marketSettled: raw.marketSettled === true,
  };
}

/**
 * Parsea y sanea el payload persistido. Devuelve `null` cuando el documento
 * está corrupto o pertenece a otra versión; el llamador decide si conserva el
 * estado actual en lugar de vaciar el boleto por un dato inválido.
 */
export function parsePersistedSelections(
  raw: string | null,
): readonly BetSelection[] | null {
  if (raw === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  const payload = asRecord(parsed);
  if (
    !payload ||
    payload.version !== BET_SLIP_STORAGE_VERSION ||
    !Array.isArray(payload.selections)
  ) {
    return null;
  }

  // La casa permite un pick por combate. Si una escritura antigua dejó
  // duplicados, se conserva el más reciente.
  const latestByEvent = new Map<string, BetSelection>();

  for (const item of payload.selections) {
    const selection = normalizePersistedSelection(item);
    if (!selection) continue;

    const current = latestByEvent.get(selection.eventId);
    if (!current || selection.addedAt >= current.addedAt) {
      latestByEvent.set(selection.eventId, selection);
    }
  }

  return [...latestByEvent.values()]
    .sort((a, b) => a.addedAt - b.addedAt)
    .slice(-MAX_PERSISTED_SELECTIONS);
}

/** Serializa únicamente los campos aceptados; nunca la cuota viva. */
export function serializeSelections(selections: readonly BetSelection[]): string {
  return JSON.stringify({
    version: BET_SLIP_STORAGE_VERSION,
    selections: selections.map((selection) => ({
      selectionId: selection.selectionId,
      eventId: selection.eventId,
      marketId: selection.marketId,
      selectionName: selection.selectionName,
      eventName: selection.eventName,
      marketLabel: selection.marketLabel,
      odds: selection.odds,
      addedAt: selection.addedAt,
      eventStatus: selection.eventStatus,
      eventEndsAt: selection.eventEndsAt,
      eventIsExpired: selection.eventIsExpired,
      eventIsBettingOpen: selection.eventIsBettingOpen,
      marketSettled: selection.marketSettled === true,
    })),
  });
}

export function loadPersistedSelections(): readonly BetSelection[] {
  if (typeof window === 'undefined') return [];

  try {
    return parsePersistedSelections(window.localStorage.getItem(BET_SLIP_STORAGE_KEY)) ?? [];
  } catch {
    // localStorage puede estar bloqueado (modo privado, política del navegador).
    return [];
  }
}

export function writePersistedSelections(serialized: string): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(BET_SLIP_STORAGE_KEY, serialized);
  } catch {
    // Sin almacenamiento el boleto sigue funcionando en memoria.
  }
}
