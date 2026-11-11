/**
 * Cotización de mercados desde el backoffice (trading propio).
 *
 * Contrato: `POST /api/v1/admin/markets/{marketId}/pricing` (solo admin).
 * El servidor calcula las cuotas con `OddsPricing.Price`; la UI nunca las
 * inventa: cualquier rechazo se propaga con su RFC 7807.
 */

import { apiClient, createUuidV4 } from '@/api';

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

export async function priceMarket(
  marketId: string,
  request: PriceMarketRequest,
): Promise<PriceMarketResponse> {
  return apiClient.post<PriceMarketResponse, unknown>(adminPricingPath(marketId), {
    marginPercent: request.marginPercent,
    selections: request.selections,
    note: request.note ?? null,
    idempotencyKey: createUuidV4(),
  });
}
