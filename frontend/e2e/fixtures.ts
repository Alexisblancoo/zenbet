/**
 * Payloads sintéticos para los E2E. Solo existen dentro de las pruebas: no se
 * importan desde `src` ni llegan nunca a un usuario real.
 */

interface FixtureEvent {
  readonly id: string;
  readonly red: string;
  readonly blue: string;
  readonly status: 'scheduled' | 'live' | 'finished';
  readonly isExpired: boolean;
  readonly isBettingOpen: boolean;
  readonly startTime: string;
  readonly endsAt: string;
  readonly sourceKind: 'model' | 'operator';
  readonly result?: {
    readonly winnerCorner: 'red' | 'blue';
    readonly winnerName: string;
    readonly method: string;
    readonly methodLabel: string;
    readonly round: number;
    readonly recordedAt: string;
  } | null;
}

export function fixtureEvent(o: FixtureEvent) {
  return {
    id: o.id,
    name: `${o.red} vs ${o.blue}`,
    sport: 'MMA',
    sportKey: 'mma',
    effectiveStatus: o.status,
    startTime: o.startTime,
    endsAt: o.endsAt,
    isExpired: o.isExpired,
    isBettingOpen: o.isBettingOpen,
    result: o.result ?? null,
    competition: 'E2E Fixture Night',
    bout: {
      weightDivision: 'lightweight',
      weightDivisionLabel: 'Peso ligero',
      scheduledRounds: 3,
      isTitleFight: false,
      billing: 'main',
      billingLabel: 'Cartelera estelar',
      billingOrder: 1,
      venue: 'E2E Arena',
      location: 'Test City',
      red: { id: `fighter-${o.id}-red`, name: o.red, record: '10-0-0' },
      blue: { id: `fighter-${o.id}-blue`, name: o.blue, record: '9-1-0' },
    },
    markets: [
      {
        id: `market-${o.id}`,
        typeKey: 'moneyline',
        type: 'moneyline',
        name: 'Ganador del combate',
        line: null,
        displayOrder: 1,
        status: 'open',
        source: {
          kind: o.sourceKind,
          name: 'E2E Model',
          url: null,
          observedAt: '2026-01-01T00:00:00Z',
          note: null,
        },
        selections: [
          {
            id: `sel-${o.id}-red`,
            code: 'red',
            name: o.red,
            decimalOdds: 1.9,
            displayOrder: 1,
            settled: false,
          },
          {
            id: `sel-${o.id}-blue`,
            code: 'blue',
            name: o.blue,
            decimalOdds: 1.9,
            displayOrder: 2,
            settled: false,
          },
        ],
      },
    ],
    oddsUpdatedAt: '2026-01-01T00:00:00Z',
  };
}

export function eventsPage(items: readonly unknown[]) {
  return { items, total: items.length, page: 1, pageSize: 50 };
}

export const referenceEvent = fixtureEvent({
  id: 'e2e-reference',
  red: 'Ana Viva',
  blue: 'Beto Vivo',
  status: 'live',
  isExpired: false,
  isBettingOpen: true,
  startTime: '2026-12-01T18:00:00Z',
  endsAt: '2026-12-01T23:00:00Z',
  sourceKind: 'model',
});

export const expiredWithoutResult = fixtureEvent({
  id: 'e2e-expired',
  red: 'Beto Vencido',
  blue: 'Bruno Vencido',
  status: 'finished',
  isExpired: true,
  isBettingOpen: false,
  startTime: '2026-01-01T18:00:00Z',
  endsAt: '2026-01-01T23:00:00Z',
  sourceKind: 'model',
});

export const expiredWithResult = fixtureEvent({
  id: 'e2e-settled',
  red: 'Carla Resuelta',
  blue: 'Ciro Resuelto',
  status: 'finished',
  isExpired: true,
  isBettingOpen: false,
  startTime: '2026-01-01T18:00:00Z',
  endsAt: '2026-01-01T23:00:00Z',
  sourceKind: 'model',
  result: {
    winnerCorner: 'red',
    winnerName: 'Carla Resuelta',
    method: 'decision',
    methodLabel: 'Decisión unánime',
    round: 3,
    recordedAt: '2026-01-02T00:00:00Z',
  },
});
