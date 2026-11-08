/**
 * Vista previa local del cotizador de mercados.
 *
 * Replica `Zenbet.EventsMarkets.Domain.Pricing.OddsPricing.Price` para que el
 * trader vea las cuotas antes de enviarlas. El servidor sigue siendo la
 * autoridad: sus 422 se muestran tal cual y nunca se sustituyen por la vista
 * previa.
 */

export const MIN_MARGIN_PERCENT = 2;
export const MAX_MARGIN_PERCENT = 20;
export const MIN_DECIMAL_ODDS = 1.01;
export const MAX_DECIMAL_ODDS = 1000;
export const MIN_PROBABILITY = 0.001;
export const PROBABILITY_TOLERANCE = 0.005;

export type PricingPreviewErrorCode =
  | 'TOO_FEW_SELECTIONS'
  | 'DUPLICATE_SELECTIONS'
  | 'MARGIN_OUT_OF_RANGE'
  | 'PROBABILITY_OUT_OF_RANGE'
  | 'PROBABILITIES_NOT_NORMALIZED'
  | 'MARGIN_NOT_ACHIEVABLE'
  | 'BELOW_MINIMUM_MARGIN';

export class PricingPreviewError extends Error {
  readonly code: PricingPreviewErrorCode;

  constructor(code: PricingPreviewErrorCode, message: string) {
    super(message);
    this.name = 'PricingPreviewError';
    this.code = code;
    Object.setPrototypeOf(this, PricingPreviewError.prototype);
  }
}

export interface SelectionProbabilityInput {
  readonly selectionId: string;
  /** Probabilidad justa sin margen, en el rango (0, 1). */
  readonly fairProbability: number;
}

export interface PricedSelectionPreview {
  readonly selectionId: string;
  readonly fairProbability: number;
  readonly decimalOdds: number;
}

export interface MarketPricingPreview {
  readonly selections: readonly PricedSelectionPreview[];
  /** Margen efectivo en %, redondeado a 2 decimales como el servidor. */
  readonly overroundPercent: number;
}

/** Redondeo hacia abajo a 2 decimales: la casa nunca regala margen. */
export function floorToCents(value: number): number {
  return Math.floor(value * 100) / 100;
}

function roundHalfEven(value: number): number {
  const scaled = value * 100;
  const floor = Math.floor(scaled);
  const diff = scaled - floor;
  let rounded: number;
  if (Math.abs(diff - 0.5) < 1e-9) {
    rounded = floor % 2 === 0 ? floor : floor + 1;
  } else {
    rounded = Math.round(scaled);
  }
  return rounded / 100;
}

export function priceMarketPreview(
  inputs: readonly SelectionProbabilityInput[],
  marginPercent: number,
): MarketPricingPreview {
  if (inputs.length < 2) {
    throw new PricingPreviewError(
      'TOO_FEW_SELECTIONS',
      'Un mercado necesita al menos dos selecciones.',
    );
  }

  const ids = new Set(inputs.map((input) => input.selectionId));
  if (ids.size !== inputs.length) {
    throw new PricingPreviewError('DUPLICATE_SELECTIONS', 'Hay selecciones repetidas.');
  }

  if (
    !Number.isFinite(marginPercent) ||
    marginPercent < MIN_MARGIN_PERCENT ||
    marginPercent > MAX_MARGIN_PERCENT
  ) {
    throw new PricingPreviewError(
      'MARGIN_OUT_OF_RANGE',
      `El margen debe estar entre ${MIN_MARGIN_PERCENT}% y ${MAX_MARGIN_PERCENT}%.`,
    );
  }

  for (const input of inputs) {
    if (
      !Number.isFinite(input.fairProbability) ||
      input.fairProbability < MIN_PROBABILITY ||
      input.fairProbability >= 1
    ) {
      throw new PricingPreviewError(
        'PROBABILITY_OUT_OF_RANGE',
        `La probabilidad de cada selección debe estar entre ${MIN_PROBABILITY} y 1 (excluido).`,
      );
    }
  }

  const sum = inputs.reduce((total, input) => total + input.fairProbability, 0);
  if (Math.abs(sum - 1) > PROBABILITY_TOLERANCE) {
    throw new PricingPreviewError(
      'PROBABILITIES_NOT_NORMALIZED',
      `Las probabilidades deben sumar 1 (tolerancia ${PROBABILITY_TOLERANCE}); suman ${sum.toFixed(4)}.`,
    );
  }

  const factor = 1 + marginPercent / 100;
  const priced: PricedSelectionPreview[] = inputs.map((input) => {
    const normalized = input.fairProbability / sum;
    const raw = 1 / (normalized * factor);
    const clamped = Math.min(Math.max(floorToCents(raw), MIN_DECIMAL_ODDS), MAX_DECIMAL_ODDS);
    return {
      selectionId: input.selectionId,
      fairProbability: input.fairProbability,
      decimalOdds: clamped,
    };
  });

  const overround = priced.reduce((total, p) => total + 1 / p.decimalOdds, 0) - 1;
  const overroundPercent = roundHalfEven(overround * 100);

  if (overroundPercent + 0.01 < marginPercent) {
    throw new PricingPreviewError(
      'MARGIN_NOT_ACHIEVABLE',
      `No se puede aplicar el margen pedido (${marginPercent}%): la cuota del favorito caería por debajo de ` +
        `${MIN_DECIMAL_ODDS} y el margen efectivo sería ${overroundPercent}%. Usa un margen menor o ` +
        'probabilidades menos extremas.',
    );
  }

  if (overround * 100 < MIN_MARGIN_PERCENT) {
    throw new PricingPreviewError(
      'BELOW_MINIMUM_MARGIN',
      `El margen efectivo (${overroundPercent}%) queda por debajo del mínimo (${MIN_MARGIN_PERCENT}%): ` +
        'las probabilidades son demasiado extremas para cotizar este mercado.',
    );
  }

  return { selections: priced, overroundPercent };
}

/**
 * Probabilidades justas implícitas en las cuotas actuales del mercado.
 * Solo se usan como punto de partida editable; el trader es quien decide.
 */
export function impliedProbabilities(
  decimalOdds: readonly number[],
): readonly number[] {
  const inverses = decimalOdds.map((odds) =>
    Number.isFinite(odds) && odds > 1 ? 1 / odds : 0,
  );
  const total = inverses.reduce((acc, value) => acc + value, 0);
  if (total <= 0) return decimalOdds.map(() => 0);
  return inverses.map((value) => value / total);
}
