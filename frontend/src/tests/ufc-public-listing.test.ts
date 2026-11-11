import { describe, expect, it } from 'vitest';

import {
  applyFightUpdate,
  applyFightUpdates,
  isPubliclyListable,
  normalizeEventsPage,
  type UfcEvent,
  type UfcFightResult,
} from '@/domain/ufc';

const RESULT: UfcFightResult = {
  winnerCorner: 'red',
  winnerName: 'Ganador de prueba',
  method: 'decision',
  methodLabel: 'Decisión unánime',
  round: 3,
  recordedAt: '2026-01-01T00:00:00.000Z',
};

const STARTS_AT = '2026-11-11T20:00:00.000Z';
const ENDS_AT = '2026-11-11T21:00:00.000Z';
const AFTER_ENDS_AT = Date.parse('2026-11-11T21:30:00.000Z');

function fighter(id: string, name: string) {
  return { id, name };
}

/**
 * Construye el evento por la misma frontera que usa la página (`normalizeEventsPage`)
 * para que la prueba no dependa de un objeto inventado a mano.
 */
function normalizeLiveEvent(overrides: Record<string, unknown> = {}): UfcEvent {
  const page = normalizeEventsPage({
    items: [
      {
        id: 'evt-live-1',
        name: 'Pelea en vivo',
        startTime: STARTS_AT,
        endsAt: ENDS_AT,
        status: 'live',
        isExpired: false,
        isBettingOpen: true,
        bout: {
          scheduledRounds: 3,
          red: fighter('fighter-red', 'Rojo'),
          blue: fighter('fighter-blue', 'Azul'),
        },
        markets: [],
        ...overrides,
      },
    ],
  });

  const event = page.items[0];
  if (!event) throw new Error('El fixture no produjo un evento normalizado.');
  return event;
}

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

describe('applyFightUpdate · pelea en vivo que supera su endsAt estimado', () => {
  it('no expira por reloj local una pelea live sin resultado oficial', () => {
    const event = normalizeLiveEvent();

    const updated = applyFightUpdate(event, null, null, AFTER_ENDS_AT);

    expect(updated.status).toBe('live');
    expect(updated.result).toBeNull();
    expect(updated.isExpired).toBe(false);
    expect(isPubliclyListable(updated)).toBe(true);
  });

  it('sí cierra la pelea cuando el servidor publica el resultado', () => {
    const event = normalizeLiveEvent();

    const updated = applyFightUpdate(
      event,
      {
        eventId: event.id,
        status: 'finished',
        isExpired: true,
        isBettingOpen: false,
        startTime: event.startTime,
        endsAt: event.endsAt,
        result: RESULT,
        updatedAt: new Date(AFTER_ENDS_AT).toISOString(),
      },
      null,
      AFTER_ENDS_AT,
    );

    expect(updated.status).toBe('finished');
    expect(updated.isExpired).toBe(true);
    expect(isPubliclyListable(updated)).toBe(true);
  });

  it('sigue ocultando un combate programado que superó su ventana sin resultado', () => {
    const event = normalizeLiveEvent({ status: 'scheduled', isBettingOpen: true });

    const updated = applyFightUpdate(event, null, null, AFTER_ENDS_AT);

    expect(updated.status).toBe('scheduled');
    expect(updated.isExpired).toBe(true);
    expect(isPubliclyListable(updated)).toBe(false);
  });

  it('la normalización inicial tampoco expira un live que ya pasó su endsAt', () => {
    const event = normalizeLiveEvent({
      endsAt: '2026-11-11T19:00:00.000Z',
      isExpired: undefined,
      isBettingOpen: undefined,
    });

    expect(event.status).toBe('live');
    expect(event.isExpired).toBe(false);
    expect(isPubliclyListable(event)).toBe(true);
  });

  it('el cruce masivo sin mensajes de SignalR deja visible la pelea live', () => {
    const event = normalizeLiveEvent();

    const [updated] = applyFightUpdates([event], {}, {}, AFTER_ENDS_AT);

    expect(updated?.isExpired).toBe(false);
    expect(updated ? isPubliclyListable(updated) : null).toBe(true);
  });
});
