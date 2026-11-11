import { describe, expect, it } from 'vitest';

import {
  floorToCents,
  impliedProbabilities,
  priceMarketPreview,
  PricingPreviewError,
} from '@/domain/trading';

describe('priceMarketPreview (espejo de OddsPricing.Price)', () => {
  it('calcula cuotas con margen y redondea siempre hacia abajo', () => {
    const preview = priceMarketPreview(
      [
        { selectionId: 'a', fairProbability: 0.5 },
        { selectionId: 'b', fairProbability: 0.5 },
      ],
      8,
    );

    // 1 / (0.5 * 1.08) = 1.8518… -> 1.85 (nunca 1.86)
    expect(preview.selections.map((selection) => selection.decimalOdds)).toEqual([1.85, 1.85]);
    expect(preview.overroundPercent).toBeGreaterThanOrEqual(8);
    expect(preview.overroundPercent).toBeCloseTo(8.11, 2);
  });

  it('redondea hacia abajo aunque el tercer decimal sea 9', () => {
    expect(floorToCents(1.999)).toBe(1.99);
    const preview = priceMarketPreview(
      [
        { selectionId: 'a', fairProbability: 1 / 3 },
        { selectionId: 'b', fairProbability: 1 / 3 },
        { selectionId: 'c', fairProbability: 1 / 3 },
      ],
      5,
    );
    for (const selection of preview.selections) {
      expect(selection.decimalOdds).toBe(2.85);
    }
  });

  it('rechaza un margen fuera del rango 2–20 %', () => {
    expect(() =>
      priceMarketPreview(
        [
          { selectionId: 'a', fairProbability: 0.5 },
          { selectionId: 'b', fairProbability: 0.5 },
        ],
        1,
      ),
    ).toThrowError(PricingPreviewError);
    expect(() =>
      priceMarketPreview(
        [
          { selectionId: 'a', fairProbability: 0.5 },
          { selectionId: 'b', fairProbability: 0.5 },
        ],
        25,
      ),
    ).toThrowError(/entre 2% y 20%/);
  });

  it('rechaza probabilidades que no suman 1 (tolerancia 0.005)', () => {
    expect(() =>
      priceMarketPreview(
        [
          { selectionId: 'a', fairProbability: 0.6 },
          { selectionId: 'b', fairProbability: 0.6 },
        ],
        5,
      ),
    ).toThrowError(/deben sumar 1/);
  });

  it('rechaza mercados con una sola selección o ids repetidos', () => {
    expect(() =>
      priceMarketPreview([{ selectionId: 'a', fairProbability: 1 }], 5),
    ).toThrowError(/al menos dos selecciones/);
    expect(() =>
      priceMarketPreview(
        [
          { selectionId: 'a', fairProbability: 0.5 },
          { selectionId: 'a', fairProbability: 0.5 },
        ],
        5,
      ),
    ).toThrowError(/repetidas/);
  });

  it('no puede prometer un margen que el mínimo de cuota destruye', () => {
    expect(() =>
      priceMarketPreview(
        [
          { selectionId: 'favorito', fairProbability: 0.999 },
          { selectionId: 'outsider', fairProbability: 0.001 },
        ],
        20,
      ),
    ).toThrowError(/margen pedido/);
  });
});

describe('impliedProbabilities', () => {
  it('normaliza las cuotas actuales a probabilidad justa sumando 1', () => {
    const probabilities = impliedProbabilities([2, 2]);
    expect(probabilities).toEqual([0.5, 0.5]);
    expect(probabilities.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
  });

  it('devuelve ceros si no hay cuotas utilizables en vez de inventarlas', () => {
    expect(impliedProbabilities([1, Number.NaN])).toEqual([0, 0]);
  });
});
