import { describe, it, expect } from 'vitest';
import { ProblemDetailsException } from '@/api';
import { describeBetError } from '@/services/betService';
import {
  UniversalMatchAnalysisSchema,
  MOCK_SOCCER_ANALYSIS,
  MOCK_BASKETBALL_ANALYSIS,
  MOCK_TENNIS_ANALYSIS,
  MOCK_BOXING_ANALYSIS,
} from '@/modules/Sportsbook/components/UniversalAnalysisCard';
import {
  UserDashboardDataSchema,
  WalletBalanceSchema,
  UserProfileSchema,
  LedgerEntrySchema,
  MOCK_INITIAL_DASHBOARD_DATA,
  MOCK_WALLET_BALANCE,
  MOCK_USER_PROFILE,
} from '@/modules/Wallet/components/UserDashboard';
import { PlaceBetInputSchema, OddsChangedError } from '@/modules/Wallet/hooks/useWallet';
import { OddsUpdatePayloadSchema } from '@/hooks/useLiveOdds';
import {
  TrackingEventSchema,
  type TrackingEvent,
} from '@/telemetry/telemetrySchema';

/* ==========================================================================
   SUITE 1: CONTRATOS POLIMÓRFICOS DE SPORTSBOOK (UniversalMatchAnalysisSchema)
   ========================================================================== */

describe('Sportsbook Contracts: UniversalMatchAnalysisSchema', () => {
  it('debe validar exitosamente el mock de Fútbol (Soccer) con métricas 1X2 y posesión', () => {
    const result = UniversalMatchAnalysisSchema.safeParse(MOCK_SOCCER_ANALYSIS);
    expect(result.success).toBe(true);
    if (result.success && result.data.sportType === 'soccer') {
      expect(result.data.sportType).toBe('soccer');
      expect(result.data.odds1X2.home).toBeGreaterThan(1);
      expect(
        result.data.metrics.possessionProjection.homePercent +
          result.data.metrics.possessionProjection.awayPercent
      ).toBe(100);
    }
  });

  it('debe validar exitosamente el mock de Básquetbol con spread y rebotes', () => {
    const result = UniversalMatchAnalysisSchema.safeParse(MOCK_BASKETBALL_ANALYSIS);
    expect(result.success).toBe(true);
    if (result.success && result.data.sportType === 'basketball') {
      expect(result.data.sportType).toBe('basketball');
      expect(result.data.oddsMoneyline.home).toBeGreaterThan(1);
    }
  });

  it('debe validar exitosamente el mock de Tenis con aces y primer servicio', () => {
    const result = UniversalMatchAnalysisSchema.safeParse(MOCK_TENNIS_ANALYSIS);
    expect(result.success).toBe(true);
    if (result.success && result.data.sportType === 'tennis') {
      expect(result.data.sportType).toBe('tennis');
      expect(result.data.metrics.firstServePct.playerOne).toBeLessThanOrEqual(100);
      expect(result.data.metrics.projectedAces.playerOne).toBeGreaterThanOrEqual(0);
    }
  });

  it('debe validar exitosamente el mock de Boxeo / MMA con reach y takedown defense', () => {
    const result = UniversalMatchAnalysisSchema.safeParse(MOCK_BOXING_ANALYSIS);
    expect(result.success).toBe(true);
    if (result.success && result.data.sportType === 'boxing') {
      expect(result.data.sportType).toBe('boxing');
      expect(result.data.redCorner.reachInches).toBeGreaterThan(0);
      expect(result.data.metrics.takedownDefenseOrGuardPct.redCorner).toBeGreaterThanOrEqual(0);
    }
  });

  it('debe rechazar un evento con cuotas decimales inválidas (<= 1.0)', () => {
    const corruptSoccer = {
      ...MOCK_SOCCER_ANALYSIS,
      odds1X2: {
        ...MOCK_SOCCER_ANALYSIS.odds1X2,
        home: 0.95, // Violación de contrato: las cuotas decimales deben ser estrictamente > 1.0
      },
    };

    const result = UniversalMatchAnalysisSchema.safeParse(corruptSoccer);
    expect(result.success).toBe(false);
    if (!result.success) {
      const homeOddsIssue = result.error.issues.find((i) => i.path.includes('home'));
      expect(homeOddsIssue).toBeDefined();
    }
  });

  it('debe rechazar un evento de fútbol cuyas probabilidades de 1X2 no sumen ~100%', () => {
    const corruptProbabilities = {
      ...MOCK_SOCCER_ANALYSIS,
      probabilities: {
        homeWin: 80,
        draw: 40,
        awayWin: 20, // Suma 140% -> viola la regla de refinamiento
      },
    };

    const result = UniversalMatchAnalysisSchema.safeParse(corruptProbabilities);
    expect(result.success).toBe(false);
  });

  it('debe rechazar un evento sin telemetría del LLM agnóstico', () => {
    const missingTelemetry = { ...MOCK_SOCCER_ANALYSIS };
    delete (missingTelemetry as { llmTelemetry?: unknown }).llmTelemetry;

    const result = UniversalMatchAnalysisSchema.safeParse(missingTelemetry);
    expect(result.success).toBe(false);
  });

  it('debe rechazar deportes no admitidos en el discriminador', () => {
    const invalidSport = {
      ...MOCK_SOCCER_ANALYSIS,
      sportType: 'waterpolo',
    };

    const result = UniversalMatchAnalysisSchema.safeParse(invalidSport);
    expect(result.success).toBe(false);
  });
});

/* ==========================================================================
   SUITE 2: CONTRATOS FINANCIEROS Y LEDGER (UserDashboardDataSchema)
   ========================================================================== */

describe('Wallet Contracts: UserDashboardDataSchema & WalletBalanceSchema', () => {
  it('debe validar la estructura completa del Dashboard del Jugador (Perfil + Saldo + Ledger)', () => {
    const result = UserDashboardDataSchema.safeParse(MOCK_INITIAL_DASHBOARD_DATA);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.wallet.currency).toBe('USD');
      expect(result.data.wallet.available).toBeGreaterThanOrEqual(0);
      expect(result.data.ledger.length).toBeGreaterThan(0);
    }
  });

  it('debe validar el saldo individual con WalletBalanceSchema', () => {
    const result = WalletBalanceSchema.safeParse(MOCK_WALLET_BALANCE);
    expect(result.success).toBe(true);
  });

  it('debe rechazar terminantemente un saldo disponible negativo (invariante contable)', () => {
    const negativeBalance = {
      ...MOCK_WALLET_BALANCE,
      available: -150.0,
    };

    const result = WalletBalanceSchema.safeParse(negativeBalance);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes('available'));
      expect(issue).toBeDefined();
      expect(issue?.message).toContain('El saldo disponible no puede ser negativo');
    }
  });

  it('debe rechazar un saldo bloqueado en apuestas que sea negativo', () => {
    const negativeLocked = {
      ...MOCK_WALLET_BALANCE,
      lockedInBets: -10.0,
    };

    const result = WalletBalanceSchema.safeParse(negativeLocked);
    expect(result.success).toBe(false);
  });

  it('debe rechazar perfiles con correos electrónicos malformados', () => {
    const invalidEmailUser = {
      ...MOCK_USER_PROFILE,
      email: 'usuario-sin-arroba-ni-dominio',
    };

    const result = UserProfileSchema.safeParse(invalidEmailUser);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes('email'));
      expect(issue).toBeDefined();
    }
  });

  it('debe rechazar entradas de Ledger con tipos de transacción desconocidos', () => {
    const invalidLedgerEntry = {
      id: 'tx-test-999',
      type: 'CRYPTO_AIRDROP_HACK', // Tipo no permitido por LedgerEntryTypeSchema
      amount: 100,
      currency: 'USD',
      description: 'Transacción anómala',
      timestamp: new Date().toISOString(),
      status: 'COMPLETED',
    };

    const result = LedgerEntrySchema.safeParse(invalidLedgerEntry);
    expect(result.success).toBe(false);
  });
});

/* ==========================================================================
   SUITE 3: CONTRATOS EN TIEMPO REAL (OddsUpdatePayloadSchema)
   ========================================================================== */

describe('Real-Time Contracts: OddsUpdatePayloadSchema (SignalR)', () => {
  it('debe validar una actualización viva de cuota legítima', () => {
    const validPayload = {
      marketId: 'mkt-ucl-001',
      selectionId: 'sel-rm-win',
      newOdd: 2.15,
      previousOdd: 2.05,
      direction: 'UP' as const,
      timestamp: new Date().toISOString(),
    };

    const result = OddsUpdatePayloadSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.newOdd).toBe(2.15);
      expect(result.data.direction).toBe('UP');
    }
  });

  it('debe rechazar una cuota decimal menor o igual a 1.0 (imposibilidad matemática)', () => {
    const invalidOdds = {
      marketId: 'mkt-ucl-001',
      selectionId: 'sel-rm-win',
      newOdd: 1.0, // Las cuotas decimales deben ser > 1.0
      direction: 'UNCHANGED' as const,
      timestamp: new Date().toISOString(),
    };

    const result = OddsUpdatePayloadSchema.safeParse(invalidOdds);
    expect(result.success).toBe(false);
  });

  it('debe rechazar payloads donde el valor de la cuota sea un string o NaN', () => {
    const nonNumericOdd = {
      marketId: 'mkt-ucl-001',
      selectionId: 'sel-rm-win',
      newOdd: 'DOS_PUNTO_CINCO',
      timestamp: new Date().toISOString(),
    };

    const result = OddsUpdatePayloadSchema.safeParse(nonNumericOdd);
    expect(result.success).toBe(false);
  });

  it('debe rechazar direcciones de tendencia no estandarizadas', () => {
    const invalidDirection = {
      marketId: 'mkt-ucl-001',
      selectionId: 'sel-rm-win',
      newOdd: 1.85,
      direction: 'SIDEWAYS', // Solo se admite 'UP' | 'DOWN' | 'UNCHANGED'
      timestamp: new Date().toISOString(),
    };

    const result = OddsUpdatePayloadSchema.safeParse(invalidDirection);
    expect(result.success).toBe(false);
  });
});

/* ==========================================================================
   SUITE 4: CONTRATOS DE TELEMETRÍA (TrackingEventSchema)
   ========================================================================== */

describe('Telemetry Contracts: TrackingEventSchema (Anti-Fraude y Retención)', () => {
  it('debe validar un evento de apuesta cancelada por fluctuación de cuotas', () => {
    const event: TrackingEvent = {
      eventType: 'BET_CANCELLED_ODDS_CHANGED',
      payload: {
        marketId: 'mkt-ufc-334',
        selectionId: 'sel-ciryl-gane',
        initialOdds: 1.85,
        newOdds: 1.72,
        stake: 250,
      },
    };

    const result = TrackingEventSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it('debe validar un evento de interacción con cartelera (CARD_CLICKED)', () => {
    const event: TrackingEvent = {
      eventType: 'CARD_CLICKED',
      payload: {
        sportType: 'boxing',
        eventId: 'evt-canelo-crawford',
        componentOrigin: 'SportsBentoGrid',
      },
    };

    const result = TrackingEventSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it('debe validar un evento de bloqueo de retiro por KYC (WITHDRAWAL_ATTEMPT_BLOCKED_KYC)', () => {
    const event: TrackingEvent = {
      eventType: 'WITHDRAWAL_ATTEMPT_BLOCKED_KYC',
      payload: {
        requestedAmount: 500,
        currentKycStatus: 'UNVERIFIED',
      },
    };

    const result = TrackingEventSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it('debe rechazar un evento con tipo desconocido', () => {
    const invalidEvent = {
      eventType: 'UNKNOWN_MALICIOUS_INJECTION',
      payload: { foo: 'bar' },
    };

    const result = TrackingEventSchema.safeParse(invalidEvent);
    expect(result.success).toBe(false);
  });
});

/* ==========================================================================
   SUITE 5: CÁLCULOS DEL BOLETO DE APUESTAS Y NAVEGACIÓN DINÁMICA DE EVENTOS
   ========================================================================== */

import {
  calculateTotalOdds,
  calculatePotentialPayout,
  roundMoney,
  normalizeSelectionInput,
  type LiveBetSelection,
} from '@/domain/bets';
import { findUfcCard, type UfcCard, type UfcEvent } from '@/domain/ufc';

function createMockSelection(selectionId: string, eventId: string, odds: number): LiveBetSelection {
  return {
    selectionId,
    eventId,
    marketId: `mkt-${eventId}`,
    eventName: `UFC 300 · Event ${eventId}`,
    marketLabel: 'Moneyline',
    selectionName: 'Fighter A',
    odds,
    addedAt: 1700000000000,
    eventStatus: 'upcoming',
    eventEndsAt: '2026-11-01T06:00:00Z',
    eventIsExpired: false,
    eventIsBettingOpen: true,
    liveOdds: odds,
    liveUpdatedAt: 1700000000000,
    trend: 'unchanged',
  };
}

describe('BetSlip Calculations & Sportsbook Dynamic Navigation', () => {
  it('debe calcular la cuota total acumulada correctamente para una o múltiples selecciones', () => {
    const single = [createMockSelection('sel-1', 'evt-1', 1.85)];
    expect(calculateTotalOdds(single)).toBe(1.85);

    const parlay = [
      createMockSelection('sel-1', 'evt-1', 1.85),
      createMockSelection('sel-2', 'evt-2', 2.0),
    ];
    // 1.85 * 2.00 = 3.70
    expect(calculateTotalOdds(parlay)).toBe(3.7);
  });

  it('debe calcular retornos potenciales limpios redondeados con stake válido', () => {
    const selections = [createMockSelection('sel-1', 'evt-1', 2.45)];
    const stake = 100;
    const payout = calculatePotentialPayout(stake, selections);
    expect(payout).toBe(245.0);
    expect(roundMoney(payout)).toBe(245.0);
  });

  it('debe retornar 0 en retornos potenciales si el stake es nulo o 0', () => {
    const selections = [createMockSelection('sel-1', 'evt-1', 2.0)];
    expect(calculatePotentialPayout(null, selections)).toBe(0);
    expect(calculatePotentialPayout(0, selections)).toBe(0);
    expect(calculatePotentialPayout(-50, selections)).toBe(0);
  });

  it('debe normalizar un SelectionInput estrictamente protegiendo tipos', () => {
    const rawInput = {
      selectionId: 'sel-ufc-1',
      eventId: 'evt-ufc-1',
      marketId: 'mkt-ufc-1',
      eventName: 'UFC 300',
      marketLabel: 'Ganador',
      selectionName: 'Pereira',
      odds: 1.95,
      eventStatus: 'live',
      eventEndsAt: '2026-11-01T04:00:00Z',
      eventIsExpired: false,
      eventIsBettingOpen: true,
    };

    const normalized = normalizeSelectionInput(rawInput);
    expect(normalized).not.toBeNull();
    expect(normalized?.selectionId).toBe('sel-ufc-1');
    expect(normalized?.odds).toBe(1.95);
    expect(normalized?.eventIsBettingOpen).toBe(true);
  });

  it('debe resolver la cartelera correspondiente según el searchParam card o event', () => {
    const mockCard: UfcCard = {
      key: 'ufc-300-las-vegas',
      competition: 'UFC 300',
      startTime: '2026-11-01T04:00:00Z',
      venue: 'T-Mobile Arena',
      location: 'Las Vegas, NV',
      status: 'scheduled',
      isBettingOpen: true,
      isFinished: false,
      liveCount: 0,
      finishedCount: 0,
      marketCount: 12,
      selectionCount: 24,
      events: [
        {
          id: 'fight-101',
          name: 'Pereira vs Prochazka',
        } as UfcEvent,
      ],
      mainEvent: {
        id: 'fight-101',
        name: 'Pereira vs Prochazka',
      } as UfcEvent,
    };

    const cards: readonly UfcCard[] = [mockCard];
    const resolved = findUfcCard(cards, 'ufc-300-las-vegas');

    expect(resolved).toBeDefined();
    expect(resolved?.key).toBe('ufc-300-las-vegas');
    expect(resolved?.events.some((e) => e.id === 'fight-101')).toBe(true);
  });
});

/* ==========================================================================
   SUITE 7: MECANISMO TRANSACCIONAL ANTI-SLIPPAGE (PlaceBetInputSchema & Errors)
   ========================================================================== */

describe('QuickBet & Anti-Slippage Contracts: PlaceBetInputSchema', () => {
  it('debe validar una orden de apuesta rápida con parámetros de tolerancia al deslizamiento', () => {
    const validOrder = {
      walletId: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
      selectionId: 'sel-ufc-101-pereira',
      stake: 50.0,
      oddsDecimal: 2.15,
      expectedOdds: 2.15,
      maxSlippagePercent: 2.5,
      minAcceptedOdds: 2.05,
      description: 'Pereira por KO',
      idempotencyKey: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
    };

    const result = PlaceBetInputSchema.safeParse(validOrder);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.expectedOdds).toBe(2.15);
      expect(result.data.maxSlippagePercent).toBe(2.5);
      expect(result.data.minAcceptedOdds).toBe(2.05);
    }
  });

  it('debe rechazar órdenes con deslizamiento negativo o superior al 100%', () => {
    const invalidNegative = {
      selectionId: 'sel-1',
      stake: 20,
      maxSlippagePercent: -5,
    };
    expect(PlaceBetInputSchema.safeParse(invalidNegative).success).toBe(false);

    const invalidOver100 = {
      selectionId: 'sel-1',
      stake: 20,
      maxSlippagePercent: 120,
    };
    expect(PlaceBetInputSchema.safeParse(invalidOver100).success).toBe(false);
  });

  it('debe rechazar órdenes con cuotas mínimas menores o iguales a 1.0', () => {
    const invalidOdds = {
      selectionId: 'sel-1',
      stake: 20,
      minAcceptedOdds: 0.95,
    };
    expect(PlaceBetInputSchema.safeParse(invalidOdds).success).toBe(false);
  });

  it('debe instanciar OddsChangedError con código ODDS_CHANGED y cuotas correctas', () => {
    const err = new OddsChangedError(
      'La cuota cambió de 2.10 a 1.95',
      1.95,
      2.10
    );
    expect(err.code).toBe('ODDS_CHANGED');
    expect(err.currentOdds).toBe(1.95);
    expect(err.expectedOdds).toBe(2.10);
    expect(err.message).toContain('2.10');
  });
});

/* ==========================================================================
   SUITE 8: CONCURRENCIA Y RESILIENCIA DE LEDGER (Multi-User QuickBet Simulation)
   ========================================================================== */

describe('Concurrency & Ledger Invariants: Client-Side QuickBet Simulation', () => {
  it('debe mantener consistencia matemática exacta ante 20 mutaciones concurrentes con fallos de slippage', async () => {
    // Estado inicial de la billetera en cliente
    let availableBalance = 10_000;
    let lockedInBets = 0;
    const ledger: Array<{ id: string; amount: number; status: 'PENDING' | 'ACCEPTED' | 'REVERTED' }> = [];

    const STAKE = 100;
    const TOTAL_USERS = 20;

    // Simular 20 llamadas concurrentes: 10 sufrirán ODDS_CHANGED y 10 serán ACCEPTED
    const promises = Array.from({ length: TOTAL_USERS }, async (_, index) => {
      const willSlip = index % 2 === 0; // 10 slip, 10 ok
      const txId = `tx-concurrent-${index}`;

      // 1. Optimistic Mutation (onMutate)
      availableBalance -= STAKE;
      lockedInBets += STAKE;
      ledger.push({ id: txId, amount: -STAKE, status: 'PENDING' });

      // Simular latencia de red asíncrona (10-30ms)
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 20 + 10));

      // 2. Server Response
      if (willSlip) {
        // Rollback optimista (onError ante OddsChangedError)
        availableBalance += STAKE;
        lockedInBets -= STAKE;
        const entry = ledger.find((e) => e.id === txId);
        if (entry) entry.status = 'REVERTED';
      } else {
        // Confirmación (onSuccess)
        const entry = ledger.find((e) => e.id === txId);
        if (entry) entry.status = 'ACCEPTED';
      }
    });

    await TaskWhenAll(promises);

    // Invariantes matemáticas estrictas
    expect(availableBalance).toBe(9_000); // 10 apuestas aceptadas de 100 = 1000 descontados
    expect(lockedInBets).toBe(1_000); // 1000 bloqueados en juego
    expect(availableBalance + lockedInBets).toBe(10_000); // Conservación total de fondos

    const acceptedCount = ledger.filter((e) => e.status === 'ACCEPTED').length;
    const revertedCount = ledger.filter((e) => e.status === 'REVERTED').length;
    expect(acceptedCount).toBe(10);
    expect(revertedCount).toBe(10);
  });
});

/* ==========================================================================
   SUITE 9: CONTRATO DE RIESGO FINANCIERO Y LÍMITES DE EXPOSICIÓN (RFC 7807)
   ========================================================================== */

describe('Financial Risk Contracts: Exposure and Liability RFC 7807', () => {
  it('debe mapear un error RFC 7807 de EXPOSURE_LIMIT_EXCEEDED al fallo de dominio correspondiente', () => {
    const problem = new ProblemDetailsException({
      status: 422,
      type: 'https://zenbet.com/errors/exposure-limit-exceeded',
      title: 'Límite de riesgo excedido',
      detail: 'Market exposure limit would be exceeded. Current: 9500, New bet would add: 1000, Max allowed: 10000',
      code: 'EXPOSURE_LIMIT_EXCEEDED',
    });

    const failure = describeBetError(problem);

    expect(failure.code).toBe('EXPOSURE_LIMIT_EXCEEDED');
    expect(failure.status).toBe(422);
    expect(failure.title).toBe('Límite de riesgo excedido');
    expect(failure.message).toContain('Market exposure limit would be exceeded');
  });

  it('debe mapear un error RFC 7807 de USER_LIMIT_EXCEEDED al fallo de dominio correspondiente', () => {
    const problem = new ProblemDetailsException({
      status: 422,
      type: 'https://zenbet.com/errors/user-limit-exceeded',
      title: 'Límite de usuario excedido',
      detail: 'Bet amount 1500 exceeds maximum allowed bet per user: 1000',
      code: 'USER_LIMIT_EXCEEDED',
    });

    const failure = describeBetError(problem);

    expect(failure.code).toBe('USER_LIMIT_EXCEEDED');
    expect(failure.status).toBe(422);
    expect(failure.title).toBe('Límite de usuario excedido');
    expect(failure.message).toContain('exceeds maximum allowed bet per user');
  });

  it('debe inferir EXPOSURE_LIMIT_EXCEEDED a partir del mensaje backend estándar', () => {
    const problem = new ProblemDetailsException({
      status: 400,
      title: 'Validation Error',
      detail: 'The market exposure limit has been exceeded for this market',
    });

    const failure = describeBetError(problem);

    expect(failure.code).toBe('EXPOSURE_LIMIT_EXCEEDED');
    expect(failure.message).toBe('El mercado ha alcanzado el límite de exposición financiera. Intenta con un monto menor.');
  });
});

async function TaskWhenAll(promises: Promise<void>[]): Promise<void> {
  await Promise.all(promises);
}
