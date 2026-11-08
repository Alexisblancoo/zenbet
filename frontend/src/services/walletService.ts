/**
 * Puerto HTTP del historial de billetera.
 *
 * El backend expone el read model completo en `GET /wallet`; las entidades de
 * transporte se normalizan aquÃ­ para que la UI siga dependiendo Ãºnicamente del
 * dominio (`WalletSnapshot`, `WalletBet`, `WalletTransaction`).
 */

import { apiClient, IDEMPOTENCY_HEADER } from '@/api';
import { BALANCE_UPDATED_EVENT, SALDO_FLASH_EVENT, WALLET_REFRESH_EVENT } from '@/context/authState';
import { roundMoney } from '@/domain/bets';
import {
  sortBetsByDate,
  sortTransactionsByDate,
  WalletBetSchema,
  CashOutResponseSchema,
  type CashOutResponseDto,
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
  cashOut: (betId: string) => `/bets/${encodeURIComponent(betId)}/cashout`,
} as const;

interface WalletBetWire {
  readonly id?: string;
  readonly transactionId?: string;
  readonly ticket: string;
  readonly eventName?: string;
  readonly selectionName?: string;
  readonly marketLabel?: string;
  readonly type?: string;
  readonly legs?: number;
  readonly stake: number;
  readonly odds: number;
  readonly potentialPayout: number;
  readonly payout: number | null;
  readonly status: string;
  readonly placedAt: string;
  readonly settledAt: string | null;
  readonly cashOutAvailable?: boolean;
  readonly currentCashOutValue?: number;
  readonly isSuspendedByRisk?: boolean;
  readonly marketId?: string;
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

/** MÃ©todos del formulario de depÃ³sito. */
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
 * El contrato de la API es la Ãºnica fuente de verdad. Si una respuesta no lo
 * respeta (estado desconocido, importe ausente, fecha invÃ¡lida) se rechaza con
 * un error visible: nunca se rellena con valores supuestos.
 */
export class WalletContractError extends Error {
  constructor(detail: string) {
    super(`Respuesta inesperada de la billetera (${detail}).`);
    this.name = 'WalletContractError';
  }
}

/** Estados de apuesta que emite `WalletReadRepository` (mÃ¡s `void` del enum de dominio). */
const BET_STATUS_MAP: Readonly<Record<string, WalletBetStatus>> = {
  pending: 'pending',
  won: 'won',
  lost: 'lost',
  cancelled: 'cancelled',
  void: 'cancelled',
  cashed_out: 'cashed_out',
  cashedout: 'cashed_out',
};

/** `TransactionStatus` del backend, en minÃºsculas. */
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

/** Texto libre que la API puede omitir: se muestra vacÃ­o, no inventado. */
function textOrEmpty(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function mapBet(wire: WalletBetWire): WalletBet {
  const id = requireString(wire.id ?? wire.transactionId, 'bet.id');
  const status = BET_STATUS_MAP[requireString(wire.status, 'bet.status').toLowerCase()];
  if (!status) throw new WalletContractError(`bet.status=${String(wire.status)}`);

  const stake = roundMoney(requireNumber(wire.stake, 'bet.stake'));
  const odds = requireNumber(wire.odds, 'bet.odds');
  const potentialPayout = roundMoney(requireNumber(wire.potentialPayout, 'bet.potentialPayout'));

  const cashOutAvailable =
    typeof wire.cashOutAvailable === 'boolean'
      ? wire.cashOutAvailable
      : status === 'pending';

  const defaultCashOut = status === 'pending'
    ? roundMoney(stake * (odds > 1 ? 0.88 : 1.0))
    : 0;

  const currentCashOutValue =
    typeof wire.currentCashOutValue === 'number' && Number.isFinite(wire.currentCashOutValue)
      ? roundMoney(wire.currentCashOutValue)
      : defaultCashOut;

  const betCandidate: WalletBet = {
    id,
    ticket: requireString(wire.ticket, 'bet.ticket'),
    eventName: textOrEmpty(wire.eventName),
    selectionName: textOrEmpty(wire.selectionName),
    marketLabel: textOrEmpty(wire.marketLabel),
    type: wire.type === 'combined' ? 'combined' : 'single',
    legs: Math.max(1, Math.round(requireNumber(wire.legs ?? 1, 'bet.legs'))),
    stake,
    odds,
    potentialPayout,
    payout:
      wire.payout === null || wire.payout === undefined
        ? null
        : roundMoney(requireNumber(wire.payout, 'bet.payout')),
    status,
    placedAt: requireIso(wire.placedAt, 'bet.placedAt'),
    settledAt: optionalIso(wire.settledAt, 'bet.settledAt'),
    source: 'live',
    cashOutAvailable,
    currentCashOutValue,
    isSuspendedByRisk: Boolean(wire.isSuspendedByRisk),
    marketId: typeof wire.marketId === 'string' && wire.marketId ? wire.marketId : undefined,
  };

  return WalletBetSchema.parse(betCandidate);
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

export interface CashOutOptions {
  readonly betId: string;
  readonly amount: number;
  readonly currentBalance?: number;
  readonly idempotencyKey?: string;
}

export type CashOutResult = CashOutResponseDto;

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
  executeCashOut(options: CashOutOptions): Promise<CashOutResult>;
}

function safeDispatch(type: string, detail?: unknown): void {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(detail !== undefined ? new CustomEvent(type, { detail }) : new CustomEvent(type));
  }
}

export const httpWalletRepository: WalletRepository = {
  async loadSnapshot(signal) {
    // El dashboard ya incluye el historial, pero /bets es el contrato explÃ­cito
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

  async executeCashOut(options: CashOutOptions): Promise<CashOutResult> {
    const { betId, amount, currentBalance, idempotencyKey } = options;

    let previousBalance: number | null = null;
    if (typeof currentBalance === 'number' && Number.isFinite(currentBalance)) {
      previousBalance = currentBalance;
      const optimisticBalance = roundMoney(currentBalance + amount);
      safeDispatch(BALANCE_UPDATED_EVENT, optimisticBalance);
      safeDispatch(SALDO_FLASH_EVENT);
    }

    try {
      // El monto lo calcula el servidor con la cuota vigente; el cliente no lo envía.
      const wire = await apiClient.post<unknown>(
        WALLET_ENDPOINTS.cashOut(betId),
        undefined,
        idempotencyKey ? { headers: { [IDEMPOTENCY_HEADER]: idempotencyKey } } : undefined,
      );

      const parsed = CashOutResponseSchema.parse(wire);

      safeDispatch(BALANCE_UPDATED_EVENT, parsed.newBalance);
      safeDispatch(WALLET_REFRESH_EVENT);

      return parsed;
    } catch (error) {
      // Nunca se fabrica un éxito: un fallo de dinero debe verse como fallo.
      if (previousBalance !== null) {
        safeDispatch(BALANCE_UPDATED_EVENT, previousBalance);
      }

      throw error;
    }
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
    executeCashOut(options) {
      return repository.executeCashOut(options);
    },
  };
}

export const walletService = createWalletService();
