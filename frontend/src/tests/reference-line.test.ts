import { describe, expect, it } from 'vitest';

import { ProblemDetailsException } from '@/api';
import { describeBetError } from '@/services/betService';
import {
  isReferenceLine,
  REFERENCE_LINE_NOTICE,
  type UfcMarket,
  type UfcMarketSource,
} from '@/domain/ufc';

function marketWithSource(source: UfcMarketSource | null): UfcMarket {
  return { source } as unknown as UfcMarket;
}

const MODEL_SOURCE: UfcMarketSource = {
  kind: 'model',
  name: 'modelo interno',
  url: null,
  observedAt: '2026-01-01T00:00:00.000Z',
  note: null,
};

const OPERATOR_SOURCE: UfcMarketSource = {
  ...MODEL_SOURCE,
  kind: 'operator',
  name: 'ZenBet Trading',
};

describe('isReferenceLine', () => {
  it('marca como referencia una cuota con procedencia model', () => {
    expect(isReferenceLine(marketWithSource(MODEL_SOURCE))).toBe(true);
    expect(REFERENCE_LINE_NOTICE).toBe('Cuota en revisión');
  });

  it('deja apostable una cuota cotizada por el operador', () => {
    expect(isReferenceLine(marketWithSource(OPERATOR_SOURCE))).toBe(false);
  });

  it('no rompe con mercados sin procedencia', () => {
    expect(isReferenceLine(marketWithSource(null))).toBe(false);
    expect(isReferenceLine(null)).toBe(false);
    expect(isReferenceLine(undefined)).toBe(false);
  });
});

describe('describeBetError · REFERENCE_LINE_NOT_BETTABLE', () => {
  it('mapea el 422 del servidor a un fallo accionable sin confundirlo con cuota cambiada', () => {
    const problem = new ProblemDetailsException({
      status: 422,
      type: 'https://zenbet.com/errors/reference-line-not-bettable',
      title: 'Referencia no apostable',
      // El detalle menciona "cuota": la precedencia debe ser línea de referencia.
      detail: 'Esta cuota es una línea de referencia y todavía no admite apuestas.',
      code: 'REFERENCE_LINE_NOT_BETTABLE',
    });

    const failure = describeBetError(problem);

    expect(failure.code).toBe('REFERENCE_LINE');
    expect(failure.status).toBe(422);
    expect(failure.title).toBe('Cuota en revisión');
    expect(failure.message).toContain('línea de referencia');
  });

  it('usa el copy por defecto cuando el servidor no envía detalle', () => {
    const problem = new ProblemDetailsException({
      status: 422,
      title: 'Referencia no apostable',
      code: 'REFERENCE_LINE_NOT_BETTABLE',
    });

    const failure = describeBetError(problem);

    expect(failure.code).toBe('REFERENCE_LINE');
    expect(failure.message).toContain('no admite apuestas');
  });
});
