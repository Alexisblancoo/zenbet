import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDownLeft,
  ArrowUpRight,
  FlaskConical,
  Gift,
  Info,
  RotateCcw,
  SlidersHorizontal,
  Ticket,
  Trophy,
  type LucideIcon,
} from 'lucide-react';

import {
  WALLET_TRANSACTION_FILTERS,
  WALLET_TRANSACTION_TYPE_LABELS,
  filterTransactionsByType,
  formatRelativeTime,
  formatSignedMoney,
  formatWalletDateTime,
  type WalletTransaction,
  type WalletTransactionFilter,
  type WalletTransactionType,
} from '@/domain/wallet';

import { WalletEmptyState } from './WalletEmptyState';
import { WalletFilterPills } from './WalletFilterPills';
import { TransactionStatusBadge } from './WalletStatusBadge';

interface TransactionHistoryPanelProps {
  readonly transactions: readonly WalletTransaction[];
  readonly isDemo: boolean;
  readonly className?: string;
}

const TRANSACTION_ICONS: Record<WalletTransactionType, LucideIcon> = {
  deposit: ArrowDownLeft,
  withdrawal: ArrowUpRight,
  bet: Ticket,
  settlement: Trophy,
  cancellation: RotateCcw,
  bonus: Gift,
  adjustment: SlidersHorizontal,
};

const TRANSACTION_ICON_TONES: Record<WalletTransactionType, string> = {
  deposit: 'border-odds-up/25 bg-odds-up/5 text-odds-up',
  withdrawal: 'border-gold/25 bg-gold/5 text-gold-imperial',
  bet: 'border-metallic-slate/25 bg-metallic-slate/5 text-metallic-platinum',
  settlement: 'border-odds-up/25 bg-odds-up/5 text-odds-up',
  cancellation: 'border-metallic-slate/25 bg-metallic-slate/5 text-metallic-platinum',
  bonus: 'border-gold/25 bg-gold/5 text-gold-imperial',
  adjustment: 'border-odds-neutral/25 bg-odds-neutral/5 text-odds-neutral',
};

function amountTone(transaction: WalletTransaction): string {
  if (transaction.status === 'failed' || transaction.status === 'cancelled') {
    return 'text-metallic-slate line-through';
  }
  return transaction.amount > 0 ? 'text-odds-up' : 'text-metallic-platinum';
}

export function TransactionHistoryPanel({
  transactions,
  isDemo,
  className = '',
}: TransactionHistoryPanelProps) {
  const [filter, setFilter] = useState<WalletTransactionFilter>('all');

  const counts = useMemo<Record<WalletTransactionFilter, number>>(() => {
    const next: Record<WalletTransactionFilter, number> = {
      all: transactions.length,
      deposit: 0,
      withdrawal: 0,
      settlement: 0,
      bet: 0,
    };

    for (const transaction of transactions) {
      if (
        transaction.type === 'deposit' ||
        transaction.type === 'withdrawal' ||
        transaction.type === 'settlement' ||
        transaction.type === 'bet'
      ) {
        next[transaction.type] += 1;
      }
    }

    return next;
  }, [transactions]);

  const visibleTransactions = useMemo(
    () => filterTransactionsByType(transactions, filter),
    [transactions, filter],
  );

  const filterOptions = WALLET_TRANSACTION_FILTERS.map((option) => ({
    value: option.value,
    label: option.label,
    count: counts[option.value],
  }));

  const emptyAction =
    filter !== 'all' ? (
      <button
        type='button'
        onClick={() => setFilter('all')}
        className='rounded-sm border border-obsidian-border bg-obsidian-surface/60 px-3 py-2 font-display text-[10px] font-extrabold uppercase tracking-brutal text-metallic-platinum transition-colors hover:border-metallic-slate hover:text-white'
      >
        Ver todos los movimientos
      </button>
    ) : (
      <Link
        to='/sportsbook'
        className='rounded-sm border border-crimson/60 bg-crimson/10 px-3 py-2 font-display text-[10px] font-extrabold uppercase tracking-brutal text-crimson transition-colors hover:bg-crimson/15'
      >
        Explorar sportsbook
      </Link>
    );

  return (
    <section
      id='wallet-transactions'
      aria-labelledby='wallet-transactions-title'
      className={`surface-panel scroll-mt-24 overflow-hidden ${className}`}
    >
      <div className='p-5 sm:p-6'>
        <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
          <div>
            <div className='flex flex-wrap items-center gap-2'>
              <span className='font-mono text-[9px] font-bold uppercase tracking-ultra text-metallic-slate'>
                Movimientos
              </span>
              {isDemo ? (
                <span
                  title='El backend aún no expone consultas de movimientos; este historial es de demostración.'
                  className='inline-flex items-center gap-1.5 rounded-sm border border-gold/25 bg-gold/5 px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-brutal text-gold-imperial'
                >
                  <FlaskConical size={9} aria-hidden='true' />
                  Demo
                </span>
              ) : null}
            </div>
            <h2
              id='wallet-transactions-title'
              className='mt-1 font-display text-base font-extrabold uppercase tracking-tight text-white [word-spacing:0.12em]'
            >
              Historial de transacciones
            </h2>
            <p className='mt-1 text-[11px] leading-relaxed text-metallic-titanium'>
              Depósitos, retiros y liquidaciones automáticas de tu cuenta.
            </p>
          </div>

          <span className='inline-flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-brutal text-metallic-slate'>
            <span className='h-1 w-1 rounded-full bg-odds-up' aria-hidden='true' />
            {transactions.length} movimientos
          </span>
        </div>

        <WalletFilterPills
          options={filterOptions}
          value={filter}
          onChange={setFilter}
          ariaLabel='Filtrar movimientos por tipo'
          className='mt-5 border-b border-obsidian-border/70 pb-4'
        />

        {visibleTransactions.length === 0 ? (
          <WalletEmptyState
            icon={ArrowDownLeft}
            title={
              transactions.length === 0
                ? 'Sin movimientos todavía'
                : 'Sin movimientos en esta categoría'
            }
            description={
              transactions.length === 0
                ? 'Los depósitos, retiros, apuestas y liquidaciones aparecerán aquí.'
                : 'Prueba con otro tipo de movimiento para ver más registros.'
            }
            action={emptyAction}
          />
        ) : (
          <>
            <div className='hidden overflow-x-auto xl:block'>
              <table className='w-full min-w-[720px] border-collapse text-left'>
                <caption className='sr-only'>Historial de transacciones de la billetera</caption>
                <thead>
                  <tr className='border-b border-obsidian-border/60'>
                    <th
                      scope='col'
                      className='pb-3 pr-4 font-mono text-[9px] font-bold uppercase tracking-brutal text-metallic-slate'
                    >
                      Movimiento
                    </th>
                    <th
                      scope='col'
                      className='pb-3 pr-4 font-mono text-[9px] font-bold uppercase tracking-brutal text-metallic-slate'
                    >
                      Referencia
                    </th>
                    <th
                      scope='col'
                      className='pb-3 pr-4 text-right font-mono text-[9px] font-bold uppercase tracking-brutal text-metallic-slate'
                    >
                      Monto
                    </th>
                    <th
                      scope='col'
                      className='pb-3 pr-4 font-mono text-[9px] font-bold uppercase tracking-brutal text-metallic-slate'
                    >
                      Estado
                    </th>
                    <th
                      scope='col'
                      className='pb-3 text-right font-mono text-[9px] font-bold uppercase tracking-brutal text-metallic-slate'
                    >
                      Fecha
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleTransactions.map((transaction) => {
                    const Icon = TRANSACTION_ICONS[transaction.type];

                    return (
                      <tr
                        key={transaction.id}
                        className='border-b border-obsidian-border/40 transition-colors last:border-0 hover:bg-white/[0.015]'
                      >
                        <td className='py-3.5 pr-4 align-top'>
                          <div className='flex items-start gap-2.5'>
                            <span
                              aria-hidden='true'
                              className={`grid h-8 w-8 shrink-0 place-items-center rounded-sm border ${TRANSACTION_ICON_TONES[transaction.type]}`}
                            >
                              <Icon size={14} strokeWidth={1.9} />
                            </span>
                            <div className='min-w-0'>
                              <div className='flex flex-wrap items-center gap-1.5'>
                                <span className='font-display text-[10px] font-extrabold uppercase tracking-brutal text-white'>
                                  {WALLET_TRANSACTION_TYPE_LABELS[transaction.type]}
                                </span>
                                {transaction.source === 'session' ? (
                                  <span className='rounded-sm border border-odds-up/30 bg-odds-up/5 px-1 py-0.5 font-mono text-[8px] uppercase tracking-wide text-odds-up'>
                                    Sesión
                                  </span>
                                ) : null}
                              </div>
                              <p className='mt-0.5 max-w-[360px] text-[11px] leading-relaxed text-metallic-titanium'>
                                {transaction.description}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className='py-3.5 pr-4 align-top'>
                          <span className='font-mono text-[10px] text-metallic-titanium'>
                            {transaction.reference ?? '—'}
                          </span>
                        </td>

                        <td className='py-3.5 pr-4 text-right align-top'>
                          <span
                            className={`font-mono text-xs font-bold tabular-nums ${amountTone(transaction)}`}
                          >
                            {formatSignedMoney(transaction.amount)}
                          </span>
                        </td>

                        <td className='py-3.5 pr-4 align-top'>
                          <TransactionStatusBadge status={transaction.status} />
                        </td>

                        <td className='py-3.5 text-right align-top'>
                          <span className='block font-mono text-[10px] text-metallic-titanium'>
                            {formatWalletDateTime(transaction.createdAt)}
                          </span>
                          <span className='mt-0.5 block font-mono text-[8px] uppercase tracking-wide text-metallic-slate'>
                            {formatRelativeTime(transaction.createdAt)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ul className='divide-y divide-obsidian-border/50 xl:hidden'>
              {visibleTransactions.map((transaction) => {
                const Icon = TRANSACTION_ICONS[transaction.type];

                return (
                  <li key={transaction.id} className='py-4 first:pt-4 last:pb-0'>
                    <div className='flex items-start justify-between gap-3'>
                      <div className='flex min-w-0 items-start gap-2.5'>
                        <span
                          aria-hidden='true'
                          className={`grid h-8 w-8 shrink-0 place-items-center rounded-sm border ${TRANSACTION_ICON_TONES[transaction.type]}`}
                        >
                          <Icon size={14} strokeWidth={1.9} />
                        </span>
                        <div className='min-w-0'>
                          <div className='flex flex-wrap items-center gap-1.5'>
                            <span className='font-display text-[10px] font-extrabold uppercase tracking-brutal text-white'>
                              {WALLET_TRANSACTION_TYPE_LABELS[transaction.type]}
                            </span>
                            {transaction.source === 'session' ? (
                              <span className='rounded-sm border border-odds-up/30 bg-odds-up/5 px-1 py-0.5 font-mono text-[8px] uppercase tracking-wide text-odds-up'>
                                Sesión
                              </span>
                            ) : null}
                          </div>
                          <p className='mt-0.5 text-[11px] leading-relaxed text-metallic-titanium'>
                            {transaction.description}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`shrink-0 font-mono text-xs font-bold tabular-nums ${amountTone(transaction)}`}
                      >
                        {formatSignedMoney(transaction.amount)}
                      </span>
                    </div>

                    <div className='mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-obsidian-border/40 pt-2.5'>
                      <div className='flex items-center gap-2 font-mono text-[9px] uppercase tracking-wide text-metallic-slate'>
                        <span>{transaction.reference ?? '—'}</span>
                        <span aria-hidden='true'>·</span>
                        <span>{formatWalletDateTime(transaction.createdAt)}</span>
                      </div>
                      <TransactionStatusBadge status={transaction.status} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      <div className='flex items-start gap-2 border-t border-obsidian-border/60 bg-obsidian-void/30 px-5 py-3 sm:px-6'>
        <Info size={11} className='mt-0.5 shrink-0 text-metallic-slate' aria-hidden='true' />
        <p className='text-[10px] leading-relaxed text-metallic-slate'>
          {isDemo
            ? 'Los movimientos históricos son de demostración. Las apuestas confirmadas en esta sesión se registran al instante.'
            : 'Las liquidaciones automáticas se acreditan al resolverse el mercado.'}
        </p>
      </div>
    </section>
  );
}
