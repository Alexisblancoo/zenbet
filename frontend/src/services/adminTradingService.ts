/**
 * Cotización de mercados desde el backoffice (trading propio).
 *
 * Contrato: `POST /api/v1/admin/markets/{marketId}/pricing` (solo admin).
 * El servidor calcula las cuotas con `OddsPricing.Price`; la UI nunca las
 * inventa: cualquier rechazo se propaga con su RFC 7807.
 */

import { apiClient, createUuidV4, IDEMPOTENCY_HEADER } from '@/api';

export const ADMIN_MARKETS_ENDPOINT = '/admin/markets';

export interface PriceSelectionRequest {
  readonly selectionId: string;
  /** Probabilidad justa sin margen, entre 0.001 y 1 (excluido). */
  readonly fairProbability: number;
}

export interface PriceMarketRequest {
  readonly marginPercent: number;
  readonly selections: readonly PriceSelectionRequest[];
  readonly note?: string | null;
}

export interface PricedSelectionResponse {
  readonly selectionId: string;
  readonly fairProbability: number;
  readonly decimalOdds: number;
}

export interface PriceMarketResponse {
  readonly marketId: string;
  readonly overroundPercent: number;
  readonly idempotentReplay: boolean;
  readonly selections: readonly PricedSelectionResponse[];
}

export function adminPricingPath(marketId: string): string {
  return `${ADMIN_MARKETS_ENDPOINT}/${marketId}/pricing`;
}

/** Intento de envío: la clave se conserva mientras el formulario no cambie. */
export interface PriceMarketAttempt {
  readonly signature: string;
  readonly idempotencyKey: string;
}

/** Huella determinista del envío (mercado + contenido de la cotización). */
export function priceMarketSignature(
  marketId: string,
  request: PriceMarketRequest,
): string {
  return JSON.stringify([
    marketId,
    request.marginPercent,
    [...request.selections]
      .sort((a, b) => (a.selectionId < b.selectionId ? -1 : a.selectionId > b.selectionId ? 1 : 0))
      .map((s) => [s.selectionId, s.fairProbability]),
    request.note ?? null,
  ]);
}

/**
 * Reutiliza la clave si la huella coincide con el intento previo (reintento del
 * mismo envío); si el formulario o el mercado cambiaron, genera una nueva.
 */
export function beginPriceMarketAttempt(
  previous: PriceMarketAttempt | null,
  signature: string,
): PriceMarketAttempt {
  if (previous !== null && previous.signature === signature) {
    return previous;
  }
  return { signature, idempotencyKey: createUuidV4() };
}

export async function priceMarket(
  marketId: string,
  request: PriceMarketRequest,
  idempotencyKey: string = createUuidV4(),
): Promise<PriceMarketResponse> {
  return apiClient.post<PriceMarketResponse, unknown>(
    adminPricingPath(marketId),
    {
      marginPercent: request.marginPercent,
      selections: request.selections,
      note: request.note ?? null,
      idempotencyKey,
    },
    { headers: { [IDEMPOTENCY_HEADER]: idempotencyKey } },
  );
}
