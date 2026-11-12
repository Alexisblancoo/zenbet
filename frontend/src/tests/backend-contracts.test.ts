import { afterEach, describe, expect, it, vi } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import { http } from '@/api/client';
import { ProblemDetailsException } from '@/api/errors';
import {
  PlaceBetError,
  ZodContractViolationError,
  fetchUserProfile,
  placeBetRequest,
} from '@/modules/Wallet/hooks/useWallet';
import { fetchSportEventsAnalysis } from '@/modules/Sportsbook/hooks/useSportsbook';
import { describeBetError } from '@/services/betService';
import { mapBet, mapWalletDashboard } from '@/services/walletService';
import { resolveAuthBaseUrl } from '@/services/authService';
import { buildUfcCards, formatFighterRecord, normalizeEventsPage } from '@/domain/ufc';

function makeAxiosError(status: number, data: unknown = {}, headers: Record<string, string> = {}) {
  return new AxiosError('HTTP Error', 'ERR_BAD_RESPONSE', undefined, undefined, {
    data,
    status,
    statusText: String(status),
    headers,
    config: { headers: new AxiosHeaders() },
  });
}

describe('Contratos reales de Backend — Nada Simulado', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('(a) 404 o sin red en placeBet rechaza con error tipado y nunca inventa ticket', async () => {
    vi.spyOn(http, 'post').mockRejectedValueOnce(makeAxiosError(404, { status: 404 }));
    await expect(
      placeBetRequest({ selectionId: '11111111-1111-4111-8111-111111111111', stake: 50, oddsDecimal: 2.1 })
    ).rejects.toMatchObject({
      name: 'PlaceBetError',
      message: 'No pudimos registrar tu apuesta. No se descontó saldo.',
      status: 404,
    });

    vi.spyOn(http, 'post').mockRejectedValueOnce(new AxiosError('Network Error', 'ERR_NETWORK'));
    await expect(
      placeBetRequest({ selectionId: '11111111-1111-4111-8111-111111111111', stake: 50, oddsDecimal: 2.1 })
    ).rejects.toThrow(PlaceBetError);
  });

  it('(b) 201 Created real mapea PlaceBetResponse y rechaza 2xx sin betId', async () => {
    vi.spyOn(http, 'post').mockResolvedValueOnce({
      status: 201,
      data: {
        success: true,
        betId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
        transactionId: 'f1e2d3c4-b5a6-4987-8765-43210fedcba9',
        newBalance: 950,
        idempotentReplay: false,
      },
    });
    const res = await placeBetRequest({ selectionId: '22222222-2222-4222-8222-222222222222', stake: 50, oddsDecimal: 2.0 });
    expect(res.betId).toBe('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d');
    expect(res.newBalance).toBe(950);
    expect('ticket' in res).toBe(false);

    vi.spyOn(http, 'post').mockResolvedValueOnce({ status: 201, data: { success: true, newBalance: 900 } });
    await expect(
      placeBetRequest({ selectionId: '22222222-2222-4222-8222-222222222222', stake: 50, oddsDecimal: 2.0 })
    ).rejects.toThrow(ZodContractViolationError);
  });

  it('(c) mapBet sin campos de cash out marca no disponible y sin importe (0)', () => {
    const wireBet = {
      id: 'bet-real-001',
      ticket: 'ZB-9001',
      eventName: 'UFC 334',
      selectionName: 'Ciryl Gane',
      marketLabel: 'Ganador',
      type: 'single',
      legs: 1,
      stake: 100,
      odds: 2.25,
      potentialPayout: 225,
      payout: null,
      status: 'pending',
      placedAt: '2026-11-08T20:00:00Z',
      settledAt: null,
    };
    const mapped = mapBet(wireBet);
    expect(mapped.cashOutAvailable).toBe(false);
    expect(mapped.currentCashOutValue).toBe(0);

    const dashboard = mapWalletDashboard({
      balance: 500,
      currency: 'BOB',
      updatedAt: '2026-11-08T20:00:00Z',
      bets: [wireBet],
      transactions: [],
    });
    expect(dashboard.bets[0]?.cashOutAvailable).toBe(false);
    expect(dashboard.bets[0]?.currentCashOutValue).toBe(0);
  });

  it('(d) 503 con Retry-After mapea "Mucha demanda, reintenta en N s" y reutiliza la MISMA Idempotency-Key', async () => {
    const postSpy = vi
      .spyOn(http, 'post')
      .mockRejectedValueOnce(makeAxiosError(503, { status: 503, extensions: { code: 'SERVICE_BUSY' } }, { 'retry-after': '4' }))
      .mockResolvedValueOnce({ status: 201, data: { success: true, betId: 'bet-retry-ok', newBalance: 425, idempotentReplay: false } });

    const betInput = { selectionId: '33333333-3333-4333-8333-333333333333', stake: 75, oddsDecimal: 1.85 };
    await expect(placeBetRequest(betInput)).rejects.toMatchObject({
      code: 'SERVICE_BUSY',
      status: 503,
      retryAfterSeconds: 4,
      message: 'Mucha demanda, reintenta en 4 s',
    });

    await placeBetRequest(betInput);
    const key1 = (postSpy.mock.calls[0]?.[2]?.headers as Record<string, string>)?.['X-Idempotency-Key'];
    const key2 = (postSpy.mock.calls[1]?.[2]?.headers as Record<string, string>)?.['X-Idempotency-Key'];
    expect(key1).toBeTruthy();
    expect(key2).toBe(key1);
    expect(describeBetError(new ProblemDetailsException({ status: 503, code: 'SERVICE_BUSY', retryAfterSeconds: 4 })).message).toBe(
      'Mucha demanda, reintenta en 4 s'
    );
  });

  it('(e) 422 REFERENCE_LINE_NOT_BETTABLE mapea a "Cuotas próximamente"', async () => {
    vi.spyOn(http, 'post').mockRejectedValueOnce(makeAxiosError(422, { status: 422, extensions: { code: 'REFERENCE_LINE_NOT_BETTABLE' } }));
    await expect(
      placeBetRequest({ selectionId: '44444444-4444-4444-8444-444444444444', stake: 30, oddsDecimal: 1.95 })
    ).rejects.toMatchObject({
      code: 'REFERENCE_LINE_NOT_BETTABLE',
      status: 422,
      message: 'Cuotas próximamente',
    });
    expect(describeBetError(new ProblemDetailsException({ status: 422, code: 'REFERENCE_LINE_NOT_BETTABLE' }))).toMatchObject({
      code: 'REFERENCE_LINE',
      status: 422,
    });
  });

  it('(T3/T4/T5) auth base URL sin /v1, sin fallbacks mock y cartelera limpia', async () => {
    expect(resolveAuthBaseUrl('/api/v1', '', '')).toBe('/api');
    vi.spyOn(http, 'get').mockRejectedValueOnce(makeAxiosError(404));
    await expect(fetchUserProfile()).rejects.toThrow();
    vi.spyOn(http, 'get').mockRejectedValueOnce(makeAxiosError(404));
    await expect(fetchSportEventsAnalysis('soccer')).rejects.toThrow();

    expect(formatFighterRecord('N/D', 0, 0, 0)).toBe('—');
    expect(formatFighterRecord('0-0-0', 0, 0, 0)).toBe('—');
    const page = normalizeEventsPage({
      items: [
        { id: 'e1', name: 'A vs B', sport: 'MMA', sportKey: 'mma', status: 'scheduled', startTime: '2026-01-01T00:00:00Z', endsAt: '2026-01-01T03:00:00Z', isExpired: true, isBettingOpen: false, markets: [], bout: { red: { id: 'r1', name: 'R', record: 'N/D', wins: 0, losses: 0, draws: 0 }, blue: { id: 'b1', name: 'B', record: 'N/D', wins: 0, losses: 0, draws: 0 } } },
        { id: 'e2', name: 'C vs D', sport: 'MMA', sportKey: 'mma', status: 'scheduled', startTime: '2099-01-01T00:00:00Z', endsAt: '2099-01-01T03:00:00Z', isExpired: false, isBettingOpen: true, markets: [], bout: { red: { id: 'r2', name: 'C', record: 'N/D', wins: 0, losses: 0, draws: 0 }, blue: { id: 'b2', name: 'D', record: '0-0-0', wins: 0, losses: 0, draws: 0 } } },
      ],
    });
    expect(page.items[1]?.bout.red.record).toBe('—');
    expect(buildUfcCards(page.items).flatMap((c) => c.events.map((e) => e.id))).toEqual(['e2']);
  });
});
