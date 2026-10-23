/**
 * Puerto HTTP del historial de billetera.
 *
 * El backend expone el read model completo en `GET /wallet`; las entidades de
 * transporte se normalizan aquí para que la UI siga dependiendo únicamente del
 * dominio (`WalletSnapshot`, `WalletBet`, `WalletTransaction`).
 */

import { apiClient } from '@/api';
import { roundMoney } from '@/domain/bets';
import {
  sortBetsByDate,
  sortTransactionsByDate,
  type WalletBet,
  type WalletBetStatus,
  type WalletBetType,
  type WalletSnapshot,
  type WalletTransaction,
  type WalletTransactionStatus,
  type WalletTransactionType,
} from '@/domain/wallet';

export const WALLET_ENDPOINTS = {
  dashboard: '/wallet',
  transactions: '/wallet/transactions',
  bets: '/bets',
  deposit: '/wallet/deposit',
} as const;

interface WalletBetWire {
  readonly id: string;
  readonly transactionId: string;
  readonly ticket: string;
  readonly eventName: string;
  readonly selectionName: string;
  readonly marketLabel: string;
  readonly type: string;
  readonly legs: number;
  readonly stake: number;
  readonly odds: number;
  readonly potentialPayout: number;
  readonly payout: number | null;
  readonly status: string;
  readonly placedAt: string;
  readonly settledAt: string | null;
}

interface WalletTransactionWire {
  readonly id: string;
  readonly type: string;
  readonly status: string;
  readonly amount: number;
  readonly balanceAfter: number;
  readonly description: string;
  readonly reference: string | null;
  readonly createdAt: string;
  readonly completedAt: string | null;
}

interface WalletDashboardWire {
  readonly currency: string;
  readonly balance: number;
  readonly bets: readonly WalletBetWire[];
  readonly transactions: readonly WalletTransactionWire[];
  readonly updatedAt: string;
}

interface DepositFundsWire {
  readonly success: boolean;
  readonly transactionId: string | null;
  readonly newBalance: number;
}

export interface WalletDepositResult {
  readonly transactionId: string | null;
  readonly newBalance: number;
}

const BET_STATUSES = new Set<WalletBetStatus>(['pending', 'won', 'lost', 'cancelled']);
const TRANSACTION_STATUSES = new Set<WalletTransactionStatus>([
  'completed',
  'pending',
  'failed',
  'cancelled',
]);

const TRANSACTION_TYPE_MAP: Readonly<Record<string, WalletTransactionType>> = {
  deposit: 'deposit',
  withdrawal: 'withdrawal',
  betplacement: 'bet',
  bet: 'bet',
  betsettlement: 'settlement',
  settlement: 'settlement',
  betcancellation: 'cancellation',
  cancellation: 'cancellation',
  bonus: 'bonus',
  adjustment: 'adjustment',
};

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asIsoString(value: unknown): string {
  const candidate = asString(value);
  const date = new Date(candidate);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function asNullableIso(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeBetStatus(value: string): WalletBetStatus {
  return BET_STATUSES.has(value as WalletBetStatus)
    ? (value as WalletBetStatus)
    : 'pending';
}

function normalizeTransactionStatus(value: string): WalletTransactionStatus {
  return TRANSACTION_STATUSES.has(value as WalletTransactionStatus)
    ? (value as WalletTransactionStatus)
    : 'completed';
}

function normalizeBetType(value: string): WalletBetType {
  return value === 'combined' ? 'combined' : 'single';
}

function mapBet(wire: WalletBetWire): WalletBet | null {
  const id = asString(wire.id) || asString(wire.transactionId);
  if (!id) return null;

  return {
    id,
    ticket: asString(wire.ticket) || `#${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`,
    eventName: asString(wire.eventName, 'Evento Zenbet'),
    selectionName: asString(wire.selectionName, 'Selección'),
    marketLabel: asString(wire.marketLabel, 'Moneyline'),
    type: normalizeBetType(asString(wire.type)),
    legs: Math.max(1, Math.round(asNumber(wire.legs, 1))),
    stake: roundMoney(asNumber(wire.stake)),
    odds: asNumber(wire.odds, 1),
    potentialPayout: roundMoney(asNumber(wire.potentialPayout)),
    payout: wire.payout === null ? null : roundMoney(asNumber(wire.payout)),
    status: normalizeBetStatus(asString(wire.status)),
    placedAt: asIsoString(wire.placedAt),
    settledAt: asNullableIso(wire.settledAt),
    source: 'live',
  };
}

function mapTransaction(wire: WalletTransactionWire): WalletTransaction | null {
  const id = asString(wire.id);
  const type = TRANSACTION_TYPE_MAP[asString(wire.type)];
  if (!id || !type) return null;

  return {
    id,
    type,
    status: normalizeTransactionStatus(asString(wire.status)),
    amount: roundMoney(asNumber(wire.amount)),
    description: asString(wire.description, 'Movimiento de billetera'),
    reference: asString(wire.reference) || null,
    createdAt: asIsoString(wire.createdAt),
    source: 'live',
  };
}

export function mapWalletDashboard(wire: WalletDashboardWire): WalletSnapshot {
  const bets = wire.bets
    .map(mapBet)
    .filter((bet): bet is WalletBet => bet !== null);

  const transactions = wire.transactions
    .map(mapTransaction)
    .filter((transaction): transaction is WalletTransaction => transaction !== null);

  return {
    mode: 'live',
    currency: 'USD',
    balance: roundMoney(asNumber(wire.balance)),
    bets: sortBetsByDate(bets),
    transactions: sortTransactionsByDate(transactions),
    updatedAt: asIsoString(wire.updatedAt),
  };
}

export interface WalletRepository {
  loadSnapshot(signal?: AbortSignal): Promise<WalletSnapshot>;
  deposit(amount: number, method?: string): Promise<WalletDepositResult>;
}

export const httpWalletRepository: WalletRepository = {
  async loadSnapshot(signal) {
    // El dashboard ya incluye el historial, pero /bets es el contrato explícito
    // para la pantalla de apuestas. Consultamos ambos para mantener la ruta
    // /my-bets alineada con la API real y usamos /wallet como respaldo.
    const [dashboardResult, betsResult] = await Promise.allSettled([
      apiClient.get<WalletDashboardWire>(WALLET_ENDPOINTS.dashboard, { signal }),
      apiClient.get<readonly WalletBetWire[]>(WALLET_ENDPOINTS.bets, { signal }),
    ]);

    if (dashboardResult.status === 'rejected') {
      throw dashboardResult.reason;
    }

    const snapshot = mapWalletDashboard(dashboardResult.value);

    if (betsResult.status === 'fulfilled') {
      const bets = betsResult.value
        .map(mapBet)
        .filter((bet): bet is WalletBet => bet !== null);

      return {
        ...snapshot,
        bets: sortBetsByDate(bets),
      };
    }

    return snapshot;
  },

  async deposit(amount, method = 'card') {
    const wire = await apiClient.post<DepositFundsWire>(WALLET_ENDPOINTS.deposit, {
      amount,
      method,
    });

    return {
      transactionId: asString(wire.transactionId) || null,
      newBalance: roundMoney(asNumber(wire.newBalance)),
    };
  },
};

export type WalletService = WalletRepository;

export function createWalletService(
  repository: WalletRepository = httpWalletRepository,
): WalletService {
  return {
    loadSnapshot(signal) {
      return repository.loadSnapshot(signal);
    },
    deposit(amount, method) {
      return repository.deposit(amount, method);
    },
  };
}

export const walletService = createWalletService();
