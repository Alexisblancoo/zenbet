/**
 * Puerto HTTP del historial de billetera.
 *
 * El backend expone el read model completo en `GET /wallet`; las entidades de
 * transporte se normalizan aquí para que la UI siga dependiendo únicamente del
 * dominio (`WalletSnapshot`, `WalletBet`, `WalletTransaction`).
 */

import { apiClient, IDEMPOTENCY_HEADER } from '@/api';
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
  /** Solicitud de depósito con comprobante (queda en revisión). */
  deposito: '/wallet/deposito',
  pendingDeposits: '/wallet/depositos/pendientes',
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

/** Respuesta de `POST /wallet/deposito` (solicitud pendiente). */
interface RequestDepositWire {
  readonly success: boolean;
  readonly transactionId: string;
  readonly reference: string;
  readonly amount: number;
  readonly method: string;
  readonly status: string;
  readonly createdAt: string;
}

/** Item de `GET /wallet/depositos/pendientes`. */
interface PendingDepositWire {
  readonly transactionId: string;
  readonly walletId: string;
  readonly userId: string;
  readonly amount: number;
  readonly method: string;
  readonly reference: string;
  readonly createdAt: string;
}

/** Métodos del formulario de depósito. */
export type WalletDepositMethod = 'qr_transfer' | 'usdt';

export interface WalletDepositRequestResult {
  readonly transactionId: string;
  readonly reference: string;
  readonly amount: number;
  readonly method: WalletDepositMethod;
  readonly createdAt: string;
}

export interface WalletPendingDeposit {
  readonly transactionId: string;
  readonly amount: number;
  readonly method: string;
  readonly reference: string;
  readonly createdAt: string;
}

export interface WalletDepositResult {
  readonly transactionId: string | null;
  readonly newBalance: number;
}


/**
 * El contrato de la API es la única fuente de verdad. Si una respuesta no lo
 * respeta (estado desconocido, importe ausente, fecha inválida) se rechaza con
 * un error visible: nunca se rellena con valores supuestos.
 */
export class WalletContractError extends Error {
  constructor(detail: string) {
    super(`Respuesta inesperada de la billetera (${detail}).`);
    this.name = 'WalletContractError';
  }
}

/** Estados de apuesta que emite `WalletReadRepository` (más `void` del enum de dominio). */
const BET_STATUS_MAP: Readonly<Record<string, WalletBetStatus>> = {
  pending: 'pending',
  won: 'won',
  lost: 'lost',
  cancelled: 'cancelled',
  void: 'cancelled',
};

/** `TransactionStatus` del backend, en minúsculas. */
const TRANSACTION_STATUS_MAP: Readonly<Record<string, WalletTransactionStatus>> = {
  pending: 'pending',
  completed: 'completed',
  approved: 'completed',
  failed: 'failed',
  rejected: 'failed',
  cancelled: 'cancelled',
};

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

function requireNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new WalletContractError(field);
  return value;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new WalletContractError(field);
  return value;
}

function requireIso(value: unknown, field: string): string {
  const candidate = requireString(value, field);
  const date = new Date(candidate);
  if (Number.isNaN(date.getTime())) throw new WalletContractError(field);
  return date.toISOString();
}

function optionalIso(value: unknown, field: string): string | null {
  if (value === null || value === undefined || value === '') return null;
  return requireIso(value, field);
}

/** Texto libre que la API puede omitir: se muestra vacío, no inventado. */
function textOrEmpty(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function mapBet(wire: WalletBetWire): WalletBet {
  const id = requireString(wire.id ?? wire.transactionId, 'bet.id');
  const status = BET_STATUS_MAP[requireString(wire.status, 'bet.status').toLowerCase()];
  if (!status) throw new WalletContractError(`bet.status=${String(wire.status)}`);

  return {
    id,
    ticket: requireString(wire.ticket, 'bet.ticket'),
    eventName: textOrEmpty(wire.eventName),
    selectionName: textOrEmpty(wire.selectionName),
    marketLabel: textOrEmpty(wire.marketLabel),
    type: wire.type === 'combined' ? 'combined' : 'single',
    legs: Math.max(1, Math.round(requireNumber(wire.legs, 'bet.legs'))),
    stake: roundMoney(requireNumber(wire.stake, 'bet.stake')),
    odds: requireNumber(wire.odds, 'bet.odds'),
    potentialPayout: roundMoney(requireNumber(wire.potentialPayout, 'bet.potentialPayout')),
    payout:
      wire.payout === null || wire.payout === undefined
        ? null
        : roundMoney(requireNumber(wire.payout, 'bet.payout')),
    status,
    placedAt: requireIso(wire.placedAt, 'bet.placedAt'),
    settledAt: optionalIso(wire.settledAt, 'bet.settledAt'),
    source: 'live',
  };
}

function mapTransaction(wire: WalletTransactionWire): WalletTransaction {
  const type = TRANSACTION_TYPE_MAP[requireString(wire.type, 'tx.type').toLowerCase()];
  if (!type) throw new WalletContractError(`tx.type=${String(wire.type)}`);
  const status = TRANSACTION_STATUS_MAP[requireString(wire.status, 'tx.status').toLowerCase()];
  if (!status) throw new WalletContractError(`tx.status=${String(wire.status)}`);

  return {
    id: requireString(wire.id, 'tx.id'),
    type,
    status,
    amount: roundMoney(requireNumber(wire.amount, 'tx.amount')),
    description: textOrEmpty(wire.description),
    reference: typeof wire.reference === 'string' && wire.reference ? wire.reference : null,
    createdAt: requireIso(wire.createdAt, 'tx.createdAt'),
    source: 'live',
  };
}

export function mapWalletDashboard(wire: WalletDashboardWire): WalletSnapshot {
  if (!Array.isArray(wire?.bets) || !Array.isArray(wire?.transactions)) {
    throw new WalletContractError('bets/transactions');
  }

  return {
    mode: 'live',
    currency: 'USD',
    balance: roundMoney(requireNumber(wire.balance, 'balance')),
    bets: sortBetsByDate(wire.bets.map(mapBet)),
    transactions: sortTransactionsByDate(wire.transactions.map(mapTransaction)),
    updatedAt: requireIso(wire.updatedAt, 'updatedAt'),
  };
}

export interface WalletRepository {
  loadSnapshot(signal?: AbortSignal): Promise<WalletSnapshot>;
  deposit(amount: number, method?: string, idempotencyKey?: string): Promise<WalletDepositResult>;
  requestDeposit(
    amount: number,
    method: WalletDepositMethod,
    reference: string,
    idempotencyKey?: string,
  ): Promise<WalletDepositRequestResult>;
  listPendingDeposits(signal?: AbortSignal): Promise<readonly WalletPendingDeposit[]>;
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
      if (!Array.isArray(betsResult.value)) throw new WalletContractError('/bets');

      return {
        ...snapshot,
        bets: sortBetsByDate(betsResult.value.map(mapBet)),
      };
    }

    return snapshot;
  },

  async deposit(amount, method = 'card', idempotencyKey) {
    const wire = await apiClient.post<DepositFundsWire>(
      WALLET_ENDPOINTS.deposit,
      { amount, method },
      idempotencyKey ? { headers: { [IDEMPOTENCY_HEADER]: idempotencyKey } } : undefined,
    );

    return {
      transactionId: typeof wire.transactionId === 'string' ? wire.transactionId : null,
      newBalance: roundMoney(requireNumber(wire.newBalance, 'newBalance')),
    };
  },

  async requestDeposit(amount, method, reference, idempotencyKey) {
    const wire = await apiClient.post<RequestDepositWire>(
      WALLET_ENDPOINTS.deposito,
      { monto: amount, metodo: method, referencia: reference },
      idempotencyKey ? { headers: { [IDEMPOTENCY_HEADER]: idempotencyKey } } : undefined,
    );

    return {
      transactionId: requireString(wire.transactionId, 'transactionId'),
      reference: requireString(wire.reference, 'reference'),
      amount: roundMoney(requireNumber(wire.amount, 'amount')),
      method,
      createdAt: requireIso(wire.createdAt, 'createdAt'),
    };
  },

  async listPendingDeposits(signal) {
    const wire = await apiClient.get<readonly PendingDepositWire[]>(
      WALLET_ENDPOINTS.pendingDeposits,
      { signal },
    );

    if (!Array.isArray(wire)) throw new WalletContractError('depositos/pendientes');

    return wire.map((item) => ({
      transactionId: requireString(item.transactionId, 'deposit.transactionId'),
      amount: roundMoney(requireNumber(item.amount, 'deposit.amount')),
      method: requireString(item.method, 'deposit.method'),
      reference: textOrEmpty(item.reference),
      createdAt: requireIso(item.createdAt, 'deposit.createdAt'),
    }));
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
    deposit(amount, method, idempotencyKey) {
      return repository.deposit(amount, method, idempotencyKey);
    },
    requestDeposit(amount, method, reference, idempotencyKey) {
      return repository.requestDeposit(amount, method, reference, idempotencyKey);
    },
    listPendingDeposits(signal) {
      return repository.listPendingDeposits(signal);
    },
  };
}

export const walletService = createWalletService();
