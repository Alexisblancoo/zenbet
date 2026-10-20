/**
 * Entidades y reglas del boleto de apuestas.
 *
 * Capa de dominio: sin React, Axios ni SignalR. Aquí viven los cálculos de
 * cuota/retorno, la normalización de selecciones y los errores de negocio que
 * la UI puede presentar sin conocer el transporte.
 */

import type { OddsTrend } from './odds';

export const DEFAULT_MIN_STAKE = 1;
export const DEFAULT_MAX_STAKE = 10_000;

/** GUID vacío que devuelve la API en replays idempotentes. */
export const EMPTY_GUID = '00000000-0000-0000-0000-000000000000';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type BetSlipTab = 'single' | 'combined';

export type StakeIssue = 'invalid' | 'below-min' | 'above-max';

export type BetFailureCode =
  | 'SESSION_REQUIRED'
  | 'EMPTY_SLIP'
  | 'COMBINED_NOT_SUPPORTED'
  | 'ODDS_CHANGED'
  | 'INVALID_STAKE'
  | 'WALLET_NOT_LINKED'
  | 'INVALID_SELECTION'
  | 'INSUFFICIENT_BALANCE'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'SERVER_ERROR'
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'INVALID_RESPONSE'
  | 'UNKNOWN';

/** Payload que entrega `EventCard` al agregar un pick. */
export interface SelectionInput {
  readonly selectionId?: string;
  readonly id?: string;
  readonly eventId?: string;
  readonly eventName?: string;
  readonly marketId?: string;
  readonly marketLabel?: string;
  readonly market?: string;
  readonly selectionName?: string;
  readonly selection?: string;
  readonly odds?: number | string;
}

/** Selección tal como la aceptó el usuario al agregarla al boleto. */
export interface BetSelection {
  readonly selectionId: string;
  readonly eventId: string;
  readonly marketId: string;
  readonly selectionName: string;
  readonly eventName: string;
  readonly marketLabel: string;
  /** Cuota aceptada explícitamente (la que el usuario vio al agregar o aceptar). */
  readonly odds: number;
  readonly addedAt: number;
}

/** Selección enriquecida con la cotización vigente del hub. */
export interface LiveBetSelection extends BetSelection {
  readonly liveOdds: number;
  readonly liveUpdatedAt: number | null;
  readonly trend: OddsTrend;
}

export interface BetReceipt {
  readonly betId: string;
  readonly transactionId: string;
  readonly stake: number;
  readonly odds: number;
  readonly potentialPayout: number;
  readonly newBalance: number | null;
  readonly selectionCount: number;
  readonly idempotentReplay: boolean;
  readonly placedAt: number;
}

export interface BetFailureField {
  readonly field: string;
  readonly messages: readonly string[];
}

/** Error listo para pintar: nunca expone Axios ni detalles de transporte. */
export interface BetFailure {
  readonly code: BetFailureCode;
  readonly title: string;
  readonly message: string;
  readonly status: number;
  readonly retryAfterSeconds?: number;
  readonly fieldErrors?: readonly BetFailureField[];
}

export type PlaceBetOutcome =
  | { readonly ok: true; readonly receipt: BetReceipt }
  | { readonly ok: false; readonly error: BetFailure };

export class BetSlipError extends Error {
  readonly code: BetFailureCode;
  readonly title: string;

  constructor(code: BetFailureCode, title: string, message: string) {
    super(message);
    this.name = 'BetSlipError';
    this.code = code;
    this.title = title;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

function readText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readOdds(value: unknown): number | undefined {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
        ? Number(value.replace(',', '.'))
        : Number.NaN;

  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Valida el formato GUID del contrato sin exigir una versión concreta. */
export function isUuid(value: string | null | undefined): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value.trim());
}

/**
 * Normaliza el pick de `EventCard` al contrato del store.
 * Devuelve `null` si falta identidad, evento o una cuota decimal válida.
 */
export function normalizeSelectionInput(input: SelectionInput): BetSelection | null {
  const selectionId = readText(input.selectionId) ?? readText(input.id);
  const eventId = readText(input.eventId);
  const selectionName = readText(input.selectionName) ?? readText(input.selection);
  const odds = readOdds(input.odds);

  if (!selectionId || !eventId || !selectionName) return null;
  if (odds === undefined || odds <= 1) return null;

  return {
    selectionId,
    eventId,
    marketId: readText(input.marketId) ?? eventId,
    selectionName,
    eventName: readText(input.eventName) ?? eventId,
    marketLabel: readText(input.marketLabel) ?? readText(input.market) ?? 'Moneyline',
    odds,
    addedAt: Date.now(),
  };
}

/** Redondeo monetario a 2 decimales (evita arrastrar binarios en la UI). */
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Cuota total del boleto. El backend limita hoy a una selección por apuesta,
 * pero el cálculo combinado alimenta la pestaña informativa.
 */
export function calculateTotalOdds(
  selections: readonly Pick<LiveBetSelection, 'liveOdds'>[],
): number {
  if (selections.length === 0) return 0;

  return selections.reduce(
    (product, selection) =>
      Number.isFinite(selection.liveOdds) && selection.liveOdds > 1
        ? product * selection.liveOdds
        : product,
    1,
  );
}

/** Retorno bruto (stake incluido) con la cuota viva de cada selección. */
export function calculatePotentialPayout(
  stake: number | null,
  selections: readonly Pick<LiveBetSelection, 'liveOdds'>[],
): number {
  if (stake === null || !Number.isFinite(stake) || stake <= 0 || selections.length === 0) {
    return 0;
  }

  return roundMoney(stake * calculateTotalOdds(selections));
}

/** Acepta coma o punto decimal; devuelve `null` para entradas incompletas. */
export function parseStakeInput(raw: string): number | null {
  const normalized = raw.trim().replace(',', '.');
  if (!normalized || !/^\d*(\.\d*)?$/.test(normalized)) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Motivo de rechazo del stake, o `null` si está dentro de los límites. */
export function getStakeIssue(
  stake: number | null,
  minStake: number,
  maxStake: number,
): StakeIssue | null {
  if (stake === null) return 'invalid';
  if (!Number.isFinite(stake) || stake <= 0) return 'invalid';
  if (stake < minStake) return 'below-min';
  if (stake > maxStake) return 'above-max';
  return null;
}

/** Compara cuotas con tolerancia para evitar falsos cambios por IEEE-754. */
const ODDS_EPSILON = 1e-9;

export function areOddsEqual(accepted: number, live: number): boolean {
  return Math.abs(live - accepted) <= ODDS_EPSILON;
}

/** Selecciones cuya cuota viva ya no coincide con la aceptada. */
export function countPendingOdds(
  selections: readonly Pick<LiveBetSelection, 'odds' | 'liveOdds'>[],
): number {
  return selections.reduce(
    (count, selection) =>
      areOddsEqual(selection.odds, selection.liveOdds) ? count : count + 1,
    0,
  );
}
