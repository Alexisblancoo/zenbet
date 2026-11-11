import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  AxiosHeaders,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';

import { http, IDEMPOTENCY_HEADER } from '@/api';
import {
  beginPriceMarketAttempt,
  priceMarket,
  priceMarketSignature,
  type PriceMarketRequest,
} from '@/services/adminTradingService';

const MARKET_ID = '8f1d6f7e-2b4a-4c9e-9f0a-1d2c3b4a5e6f';

const REQUEST: PriceMarketRequest = {
  marginPercent: 8,
  selections: [
    { selectionId: 'selection-red', fairProbability: 0.55 },
    { selectionId: 'selection-blue', fairProbability: 0.45 },
  ],
  note: 'Cotizado desde la consola de trading',
};

interface SentIdempotency {
  readonly header: string | null;
  readonly body: string | null;
}

let captured: InternalAxiosRequestConfig[] = [];
const originalAdapter = http.defaults.adapter;

function sentIdempotency(config: InternalAxiosRequestConfig): SentIdempotency {
  const headers = AxiosHeaders.from(config.headers);
  const rawHeader = headers.get(IDEMPOTENCY_HEADER);
  const parsedBody: unknown =
    typeof config.data === 'string' ? JSON.parse(config.data) : config.data;

  const body =
    typeof parsedBody === 'object' &&
    parsedBody !== null &&
    'idempotencyKey' in parsedBody &&
    typeof parsedBody.idempotencyKey === 'string'
      ? parsedBody.idempotencyKey
      : null;

  return {
    header: typeof rawHeader === 'string' ? rawHeader : null,
    body,
  };
}

beforeEach(() => {
  captured = [];
  http.defaults.adapter = async (config): Promise<AxiosResponse> => {
    captured.push(config);
    return {
      data: {
        marketId: MARKET_ID,
        overroundPercent: 8,
        idempotentReplay: false,
        selections: [
          { selectionId: 'selection-red', fairProbability: 0.55, decimalOdds: 1.8 },
          { selectionId: 'selection-blue', fairProbability: 0.45, decimalOdds: 2.2 },
        ],
      },
      status: 200,
      statusText: 'OK',
      headers: new AxiosHeaders(),
      config,
    };
  };
});

afterEach(() => {
  http.defaults.adapter = originalAdapter;
});

describe('priceMarket · idempotencia por envío', () => {
  it('un reintento reutiliza la clave y envía el mismo valor en body y header', async () => {
    const signature = priceMarketSignature(MARKET_ID, REQUEST);
    const firstAttempt = beginPriceMarketAttempt(null, signature);
    // El usuario reintenta exactamente el mismo envío (mismo formulario).
    const retryAttempt = beginPriceMarketAttempt(firstAttempt, signature);

    expect(retryAttempt.idempotencyKey).toBe(firstAttempt.idempotencyKey);

    await priceMarket(MARKET_ID, REQUEST, firstAttempt.idempotencyKey);
    await priceMarket(MARKET_ID, REQUEST, retryAttempt.idempotencyKey);

    expect(captured).toHaveLength(2);

    for (const config of captured) {
      expect(sentIdempotency(config)).toEqual({
        header: firstAttempt.idempotencyKey,
        body: firstAttempt.idempotencyKey,
      });
    }
  });

  it('una edición del formulario genera una clave nueva', () => {
    const firstAttempt = beginPriceMarketAttempt(
      null,
      priceMarketSignature(MARKET_ID, REQUEST),
    );

    const edited: PriceMarketRequest = { ...REQUEST, marginPercent: 9 };
    const nextAttempt = beginPriceMarketAttempt(
      firstAttempt,
      priceMarketSignature(MARKET_ID, edited),
    );

    expect(nextAttempt.idempotencyKey).not.toBe(firstAttempt.idempotencyKey);
  });

  it('la misma cotización en otro mercado no reutiliza la clave', () => {
    const firstAttempt = beginPriceMarketAttempt(
      null,
      priceMarketSignature(MARKET_ID, REQUEST),
    );

    const otherMarket = beginPriceMarketAttempt(
      firstAttempt,
      priceMarketSignature('00000000-0000-4000-8000-000000000000', REQUEST),
    );

    expect(otherMarket.idempotencyKey).not.toBe(firstAttempt.idempotencyKey);
  });
});
