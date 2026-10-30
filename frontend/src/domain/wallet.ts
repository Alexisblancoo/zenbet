/**
 * Dominio de billetera de Zenbet.
 *
 * Sin React, Axios ni localStorage. Aquí viven los contratos, los estados, los
 * formateadores y los cálculos que alimentan el dashboard. La fuente de datos
 * se inyecta desde la capa de servicios (HTTP).
 */

import { roundMoney, type BetReceipt } from './bets';

export type WalletBetStatus = 'pending' | 'won' | 'lost' | 'cancelled';
export type WalletBetType = 'single' | 'combined';
export type WalletBetFilter = 'all' | WalletBetStatus;
export type WalletActivitySource = 'live';

export type WalletTransactionType =
  | 'deposit'
  | 'withdrawal'
  | 'bet'
  | 'settlement'
  | 'cancellation'
  | 'bonus'
  | 'adjustment';

export type WalletTransactionStatus = 'completed' | 'pending' | 'failed' | 'cancelled';
export type WalletTransactionFilter = 'all' | 'deposit' | 'withdrawal' | 'settlement' | 'bet';

export type WalletCurrency = 'USD';
export type WalletHistoryPeriod = '7d' | '30d' | '90d' | 'all';

export interface WalletBet {
  readonly id: string;
  readonly ticket: string;
  readonly eventName: string;
  readonly selectionName: string;
  readonly marketLabel: string;
  readonly type: WalletBetType;
  readonly legs: number;
  readonly stake: number;
  readonly odds: number;
  readonly potentialPayout: number;
  /** Pago final; `null` mientras la apuesta no está liquidada. */
  readonly payout: number | null;
  readonly status: WalletBetStatus;
  readonly placedAt: string;
  readonly settledAt: string | null;
  readonly source: WalletActivitySource;
}

export interface WalletTransaction {
  readonly id: string;
  readonly type: WalletTransactionType;
  readonly status: WalletTransactionStatus;
  /** Firmado: positivo = entra a la cuenta, negativo = sale. */
  readonly amount: number;
  readonly description: string;
  readonly reference: string | null;
  readonly createdAt: string;
  readonly source: WalletActivitySource;
}

export interface WalletSnapshot {
  readonly mode: 'live';
  readonly currency: WalletCurrency;
  /** Saldo de respaldo. La UI prioriza el saldo vivo de AuthContext. */
  readonly balance: number;
  readonly bets: readonly WalletBet[];
  readonly transactions: readonly WalletTransaction[];
  readonly updatedAt: string;
}

export interface WalletMetrics {
  readonly pendingStake: number;
  readonly settledStake: number;
  readonly netProfit: number;
  readonly winRate: number;
  readonly wonCount: number;
  readonly lostCount: number;
  readonly settledCount: number;
  readonly totalBets: number;
  readonly openBets: number;
  readonly averageOdds: number;
}

export interface DailyActivityPoint {
  /** Clave local `YYYY-MM-DD`. */
  readonly date: string;
  readonly dayLabel: string;
  readonly weekdayLabel: string;
  readonly inflow: number;
  readonly outflow: number;
  readonly net: number;
}

export const WALLET_BET_STATUS_LABELS: Record<WalletBetStatus, string> = {
  pending: 'Pendiente',
  won: 'Ganada',
  lost: 'Perdida',
  cancelled: 'Cancelada',
};

export const WALLET_TRANSACTION_TYPE_LABELS: Record<WalletTransactionType, string> = {
  deposit: 'Depósito',
  withdrawal: 'Retiro',
  bet: 'Apuesta',
  settlement: 'Liquidación',
  cancellation: 'Reembolso',
  bonus: 'Bono',
  adjustment: 'Ajuste',
};

export const WALLET_TRANSACTION_STATUS_LABELS: Record<WalletTransactionStatus, string> = {
  completed: 'Completado',
  pending: 'Pendiente',
  failed: 'Fallido',
  cancelled: 'Cancelado',
};

export const WALLET_BET_FILTERS: readonly { value: WalletBetFilter; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'won', label: 'Ganadas' },
  { value: 'lost', label: 'Perdidas' },
  { value: 'cancelled', label: 'Canceladas' },
];

export const WALLET_TRANSACTION_FILTERS: readonly {
  value: WalletTransactionFilter;
  label: string;
}[] = [
  { value: 'all', label: 'Todos' },
  { value: 'deposit', label: 'Depósitos' },
  { value: 'withdrawal', label: 'Retiros' },
  { value: 'settlement', label: 'Liquidaciones' },
  { value: 'bet', label: 'Apuestas' },
];

export const WALLET_PERIODS: readonly {
  value: WalletHistoryPeriod;
  label: string;
  days: number | null;
}[] = [
  { value: '7d', label: '7 días', days: 7 },
  { value: '30d', label: '30 días', days: 30 },
  { value: '90d', label: '90 días', days: 90 },
  { value: 'all', label: 'Todo', days: null },
];

/* -------------------------------------------------------------------------- */
/* Formateadores                                                              */
/* -------------------------------------------------------------------------- */

const amountFormatter = new Intl.NumberFormat('es-MX', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactAmountFormatter = new Intl.NumberFormat('es-MX', {
  maximumFractionDigits: 0,
});

const integerFormatter = new Intl.NumberFormat('es-MX', {
  maximumFractionDigits: 0,
});

const shortDateFormatter = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: 'short',
});

const dateTimeFormatter = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

const longDateFormatter = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const weekdayFormatter = new Intl.DateTimeFormat('es-MX', { weekday: 'short' });

const relativeTimeFormatter = new Intl.RelativeTimeFormat('es-MX', {
  numeric: 'auto',
});

const DAY_MS = 86_400_000;
const WEEKDAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'] as const;

function safeNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function safeDate(value: string): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatWalletMoney(value: number): string {
  const safe = safeNumber(value);
  const sign = safe < 0 ? '−' : '';
  return `${sign}$${amountFormatter.format(Math.abs(safe))}`;
}

export function formatWalletMoneyCompact(value: number): string {
  const safe = safeNumber(value);
  const sign = safe < 0 ? '−' : '';
  return `${sign}$${compactAmountFormatter.format(Math.abs(safe))}`;
}

export function formatWalletMoneyParts(value: number): { whole: string; fraction: string } {
  const safe = Math.max(0, safeNumber(value));
  const [whole = '0', fraction = '00'] = amountFormatter.format(safe).split('.');
  return { whole: `$${whole}`, fraction };
}

export function formatSignedMoney(value: number): string {
  const safe = safeNumber(value);
  const sign = safe > 0 ? '+' : safe < 0 ? '−' : '';
  return `${sign}$${amountFormatter.format(Math.abs(safe))}`;
}

export function formatInteger(value: number): string {
  return integerFormatter.format(safeNumber(value));
}

export function formatWinRate(value: number): string {
  return `${Math.round(safeNumber(value) * 100)}%`;
}

export function formatWalletDate(value: string): string {
  const date = safeDate(value);
  return date ? shortDateFormatter.format(date) : '—';
}

export function formatWalletDateTime(value: string): string {
  const date = safeDate(value);
  return date ? dateTimeFormatter.format(date) : '—';
}

export function formatWalletDateLong(value: string): string {
  const date = safeDate(value);
  return date ? longDateFormatter.format(date) : '—';
}

export function formatWeekday(value: string | Date): string {
  const date = typeof value === 'string' ? safeDate(value) : value;
  if (!date) return '—';
  return weekdayFormatter.format(date).replace('.', '');
}

export function formatRelativeTime(value: string, now = Date.now()): string {
  const date = safeDate(value);
  if (!date) return '—';

  const diffMs = date.getTime() - now;
  const minutes = Math.round(diffMs / 60_000);

  if (Math.abs(minutes) < 1) return 'hace unos segundos';
  if (Math.abs(minutes) < 60) return relativeTimeFormatter.format(minutes, 'minute');

  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relativeTimeFormatter.format(hours, 'hour');

  const days = Math.round(hours / 24);
  return relativeTimeFormatter.format(days, 'day');
}

/** GUIDs largos se abrevian; los tickets legibles se conservan. */
export function formatTicket(value: string | null | undefined): string {
  const clean = value?.trim();
  if (!clean) return '—';

  const token = clean.length > 14 ? clean.replace(/-/g, '').slice(0, 8) : clean;
  return token.startsWith('#') ? token.toUpperCase() : `#${token.toUpperCase()}`;
}

export function formatWalletId(walletId: string | null | undefined): string {
  const clean = walletId?.trim();
  if (!clean) return 'No vinculada';
  return clean.length > 14 ? `${clean.slice(0, 6)}…${clean.slice(-4)}` : clean;
}

/* -------------------------------------------------------------------------- */
/* Cálculos                                                                   */
/* -------------------------------------------------------------------------- */

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + safeNumber(value), 0);
}

export function calculateWalletMetrics(bets: readonly WalletBet[]): WalletMetrics {
  const pending = bets.filter((bet) => bet.status === 'pending');
  const won = bets.filter((bet) => bet.status === 'won');
  const lost = bets.filter((bet) => bet.status === 'lost');
  const settled = [...won, ...lost];

  const settledStake = roundMoney(sum(settled.map((bet) => bet.stake)));
  const totalPayout = roundMoney(
    sum(won.map((bet) => bet.payout ?? bet.potentialPayout)),
  );
  const averageOdds =
    bets.length > 0 ? roundMoney(sum(bets.map((bet) => bet.odds)) / bets.length) : 0;

  return {
    pendingStake: roundMoney(sum(pending.map((bet) => bet.stake))),
    settledStake,
    netProfit: roundMoney(totalPayout - settledStake),
    winRate: settled.length > 0 ? won.length / settled.length : 0,
    wonCount: won.length,
    lostCount: lost.length,
    settledCount: settled.length,
    totalBets: bets.length,
    openBets: pending.length,
    averageOdds,
  };
}

export function filterBetsByStatus(
  bets: readonly WalletBet[],
  filter: WalletBetFilter,
): readonly WalletBet[] {
  return filter === 'all' ? bets : bets.filter((bet) => bet.status === filter);
}

export function filterBetsByPeriod(
  bets: readonly WalletBet[],
  period: WalletHistoryPeriod,
  now = Date.now(),
): readonly WalletBet[] {
  const config = WALLET_PERIODS.find((item) => item.value === period);
  if (!config?.days) return bets;

  const threshold = now - config.days * DAY_MS;
  return bets.filter((bet) => {
    const placedAt = Date.parse(bet.placedAt);
    return Number.isFinite(placedAt) && placedAt >= threshold;
  });
}

export function filterTransactionsByType(
  transactions: readonly WalletTransaction[],
  filter: WalletTransactionFilter,
): readonly WalletTransaction[] {
  return filter === 'all'
    ? transactions
    : transactions.filter((transaction) => transaction.type === filter);
}

export function sortBetsByDate(bets: readonly WalletBet[]): readonly WalletBet[] {
  return [...bets].sort((left, right) => {
    const leftTime = Date.parse(left.placedAt);
    const rightTime = Date.parse(right.placedAt);
    return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
  });
}

export function sortTransactionsByDate(
  transactions: readonly WalletTransaction[],
): readonly WalletTransaction[] {
  return [...transactions].sort((left, right) => {
    const leftTime = Date.parse(left.createdAt);
    const rightTime = Date.parse(right.createdAt);
    return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
  });
}

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

interface MutableActivityPoint {
  date: string;
  dayLabel: string;
  weekdayLabel: string;
  inflow: number;
  outflow: number;
  net: number;
}

/**
 * Flujo neto diario de los últimos `days` días. Solo cuenta movimientos
 * completados; los movimientos pendientes no alteran el gráfico.
 */
export function buildDailyActivity(
  transactions: readonly WalletTransaction[],
  days = 7,
  now = Date.now(),
): readonly DailyActivityPoint[] {
  const safeDays = Math.max(1, Math.min(31, Math.floor(days)));
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const points: MutableActivityPoint[] = [];

  for (let index = safeDays - 1; index >= 0; index -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - index);

    points.push({
      date: localDateKey(date),
      dayLabel: String(date.getDate()).padStart(2, '0'),
      weekdayLabel: WEEKDAYS[date.getDay()] ?? '',
      inflow: 0,
      outflow: 0,
      net: 0,
    });
  }

  const byDate = new Map(points.map((point) => [point.date, point]));

  for (const transaction of transactions) {
    if (transaction.status !== 'completed') continue;

    const date = safeDate(transaction.createdAt);
    if (!date) continue;

    const point = byDate.get(localDateKey(date));
    if (!point) continue;

    const amount = safeNumber(transaction.amount);
    if (amount > 0) point.inflow += amount;
    if (amount < 0) point.outflow += Math.abs(amount);
  }

  return points.map((point) => {
    const inflow = roundMoney(point.inflow);
    const outflow = roundMoney(point.outflow);
    return {
      date: point.date,
      dayLabel: point.dayLabel,
      weekdayLabel: point.weekdayLabel,
      inflow,
      outflow,
      net: roundMoney(inflow - outflow),
    };
  });
}

export function sumActivityNet(activity: readonly DailyActivityPoint[]): number {
  return roundMoney(sum(activity.map((point) => point.net)));
}
