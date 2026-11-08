import { describe, expect, it } from 'vitest';

import { isPubliclyListable, type UfcFightResult } from '@/domain/ufc';

const RESULT: UfcFightResult = {
  winnerCorner: 'red',
  winnerName: 'Ganador de prueba',
  method: 'decision',
  methodLabel: 'Decisión unánime',
  round: 3,
  recordedAt: '2026-01-01T00:00:00.000Z',
};

describe('isPubliclyListable', () => {
  it('publica un combate vigente aunque todavía no tenga resultado', () => {
    expect(isPubliclyListable({ isExpired: false, result: null })).toBe(true);
  });

  it('publica un combate vencido si el resultado oficial ya existe', () => {
    expect(isPubliclyListable({ isExpired: true, result: RESULT })).toBe(true);
  });

  it('oculta un combate vencido sin resultado: no se inventa el desenlace', () => {
    expect(isPubliclyListable({ isExpired: true, result: null })).toBe(false);
  });
});
