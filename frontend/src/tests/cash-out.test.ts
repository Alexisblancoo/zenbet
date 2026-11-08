import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  WalletBetSchema,
  CashOutRequestSchema,
  CashOutResponseSchema,
  type WalletBetDto,
} from '@/domain/wallet';
import {
  BALANCE_UPDATED_EVENT,
  SALDO_FLASH_EVENT,
  WALLET_REFRESH_EVENT,
} from '@/context/authState';
import { httpWalletRepository } from '@/services/walletService';
import { apiClient } from '@/api';

describe('Cash Out Contracts & Zod Validation (Zero-Any)', () => {
  const validBet: WalletBetDto = {
    id: 'bet-12345',
    ticket: 'TKT-9988',
    eventName: 'Real Madrid vs Manchester City',
    selectionName: 'Real Madrid',
    marketLabel: 'Ganador del Partido',
    type: 'single',
    legs: 1,
    stake: 20,
    odds: 2.1,
    potentialPayout: 42,
    payout: null,
    status: 'pending',
    placedAt: '2026-11-05T01:00:00.000Z',
    settledAt: null,
    source: 'live',
    cashOutAvailable: true,
    currentCashOutValue: 18.5,
    isSuspendedByRisk: false,
    marketId: 'market-rm-mc-01',
  };

  it('debe validar un WalletBet con cashOutAvailable y currentCashOutValue válidos', () => {
    const parsed = WalletBetSchema.parse(validBet);
    expect(parsed.cashOutAvailable).toBe(true);
    expect(parsed.currentCashOutValue).toBe(18.5);
    expect(parsed.isSuspendedByRisk).toBe(false);
  });

  it('debe validar un WalletBet marcado con isSuspendedByRisk por Circuit Breaker', () => {
    const suspendedBet = {
      ...validBet,
      isSuspendedByRisk: true,
    };
    const parsed = WalletBetSchema.parse(suspendedBet);
    expect(parsed.isSuspendedByRisk).toBe(true);
  });

  it('debe rechazar un WalletBet si currentCashOutValue es negativo', () => {
    const invalidBet = {
      ...validBet,
      currentCashOutValue: -5,
    };
    expect(() => WalletBetSchema.parse(invalidBet)).toThrow();
  });

  it('debe validar CashOutRequestSchema con datos correctos', () => {
    const request = {
      betId: 'bet-12345',
      amount: 18.5,
    };
    const parsed = CashOutRequestSchema.parse(request);
    expect(parsed.betId).toBe('bet-12345');
    expect(parsed.amount).toBe(18.5);
  });

  it('debe rechazar CashOutRequestSchema si el monto es <= 0', () => {
    expect(() => CashOutRequestSchema.parse({ betId: 'bet-1', amount: 0 })).toThrow();
    expect(() => CashOutRequestSchema.parse({ betId: 'bet-1', amount: -10 })).toThrow();
  });

  it('debe validar CashOutResponseSchema con el contrato real del backend', () => {
    const response = {
      success: true,
      betId: 'bet-12345',
      transactionId: 'tx-cashout-999',
      cashOutAmount: 18.5,
      newBalance: 118.5,
      newRealAvailable: 118.5,
      initialOdds: 2,
      currentOdds: 2.2,
      retentionMargin: 0.9,
      idempotentReplay: false,
    };
    const parsed = CashOutResponseSchema.parse(response);
    expect(parsed.success).toBe(true);
    expect(parsed.cashOutAmount).toBe(18.5);
    expect(parsed.newBalance).toBe(118.5);
  });

  it('debe rechazar la forma antigua (cashedOutAmount) que el backend nunca envía', () => {
    expect(() =>
      CashOutResponseSchema.parse({ success: true, betId: 'b', cashedOutAmount: 1, newBalance: 1 }),
    ).toThrow();
  });

  it('debe aceptar saldo negativo tras un clawback VAR', () => {
    const parsed = CashOutResponseSchema.parse({
      success: true,
      betId: 'b',
      cashOutAmount: 5,
      newBalance: -20,
    });
    expect(parsed.newBalance).toBe(-20);
  });
});

describe('Cash Out Optimistic Execution (walletService)', () => {
  const originalWindow = globalThis.window;

  beforeEach(() => {
    vi.restoreAllMocks();

    // Mock minimal Window EventTarget para el entorno Node de vitest
    const eventTarget = new EventTarget();
    // @ts-expect-error Mocking window in Node test environment
    globalThis.window = {
      addEventListener: eventTarget.addEventListener.bind(eventTarget),
      removeEventListener: eventTarget.removeEventListener.bind(eventTarget),
      dispatchEvent: eventTarget.dispatchEvent.bind(eventTarget),
    };
  });

  afterEach(() => {
    globalThis.window = originalWindow;
  });

  it('debe disparar actualización optimista de saldo antes de llamar a la API', async () => {
    const dispatchedEvents: { type: string; detail?: unknown }[] = [];
    const handleEvent = (event: Event) => {
      const custom = event as CustomEvent;
      dispatchedEvents.push({ type: custom.type, detail: custom.detail });
    };

    window.addEventListener(BALANCE_UPDATED_EVENT, handleEvent);
    window.addEventListener(SALDO_FLASH_EVENT, handleEvent);
    window.addEventListener(WALLET_REFRESH_EVENT, handleEvent);

    // Respuesta real de POST /api/v1/bets/{betId}/cashout (CashOutResponse del backend).
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
      success: true,
      betId: 'bet-99',
      transactionId: 'tx-opt-1',
      cashOutAmount: 25,
      newBalance: 125,
      newRealAvailable: 125,
      initialOdds: 2,
      currentOdds: 2.5,
      retentionMargin: 0.9,
      idempotentReplay: false,
    });

    const result = await httpWalletRepository.executeCashOut({
      betId: 'bet-99',
      amount: 25,
      currentBalance: 100,
    });

    expect(postSpy).toHaveBeenCalledWith('/bets/bet-99/cashout', undefined, undefined);
    expect(result.success).toBe(true);
    expect(result.cashOutAmount).toBe(25);
    expect(result.newBalance).toBe(125);

    // Debe contener el balance optimista inicial (125) y el flash
    const balanceEvents = dispatchedEvents.filter((e) => e.type === BALANCE_UPDATED_EVENT);
    expect(balanceEvents.length).toBeGreaterThanOrEqual(2);
    expect(balanceEvents[0].detail).toBe(125);

    const flashEvents = dispatchedEvents.filter((e) => e.type === SALDO_FLASH_EVENT);
    expect(flashEvents.length).toBe(1);

    window.removeEventListener(BALANCE_UPDATED_EVENT, handleEvent);
    window.removeEventListener(SALDO_FLASH_EVENT, handleEvent);
    window.removeEventListener(WALLET_REFRESH_EVENT, handleEvent);
  });

  it('debe revertir el saldo optimista si la llamada a la API falla', async () => {
    const balancesDispatched: number[] = [];
    const handleBalance = (event: Event) => {
      const custom = event as CustomEvent<number>;
      balancesDispatched.push(custom.detail);
    };

    window.addEventListener(BALANCE_UPDATED_EVENT, handleBalance);

    vi.spyOn(apiClient, 'post').mockRejectedValueOnce({
      status: 500,
      message: 'Internal server error',
    });

    await expect(
      httpWalletRepository.executeCashOut({
        betId: 'bet-error',
        amount: 30,
        currentBalance: 100,
      })
    ).rejects.toBeDefined();

    // balancesDispatched debe contener: 130 (optimista) y luego 100 (rollback)
    expect(balancesDispatched).toEqual([130, 100]);

    window.removeEventListener(BALANCE_UPDATED_EVENT, handleBalance);
  });

  it('no debe fabricar un Cash Out exitoso cuando la API responde 404', async () => {
    const balancesDispatched: number[] = [];
    const handleBalance = (event: Event) => {
      balancesDispatched.push((event as CustomEvent<number>).detail);
    };
    window.addEventListener(BALANCE_UPDATED_EVENT, handleBalance);

    vi.spyOn(apiClient, 'post').mockRejectedValueOnce({ status: 404, message: 'Not Found' });

    await expect(
      httpWalletRepository.executeCashOut({ betId: 'bet-404', amount: 10, currentBalance: 50 }),
    ).rejects.toMatchObject({ status: 404 });

    // Optimista (60) y rollback (50); ningún saldo inventado.
    expect(balancesDispatched).toEqual([60, 50]);

    window.removeEventListener(BALANCE_UPDATED_EVENT, handleBalance);
  });
});
