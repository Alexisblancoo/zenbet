import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Info, Ticket } from 'lucide-react';

import {
  WALLET_BET_FILTERS,
  WALLET_PERIODS,
  filterBetsByPeriod,
  filterBetsByStatus,
  formatRelativeTime,
  formatSignedMoney,
  formatWalletDateTime,
  formatWalletMoney,
  type WalletBet,
  type WalletBetFilter,
  type WalletHistoryPeriod,
} from '@/domain/wallet';

import { WalletEmptyState } from './WalletEmptyState';
import { WalletFilterPills } from './WalletFilterPills';
import { BetStatusBadge } from './WalletStatusBadge';

interface BetHistoryPanelProps {
  readonly bets: readonly WalletBet[];
  readonly className?: string;
}

interface ReturnPresentation {
  readonly value: string;
  readonly detail: string;
  readonly tone: string;
}

function describeReturn(bet: WalletBet): ReturnPresentation {
  switch (bet.status) {
    case 'won':
      return {
        value: formatSignedMoney(bet.payout ?? bet.potentialPayout),
        detail: 'Pagado',
        tone: 'text-odds-up',
      };
    case 'cancelled':
      return {
        value: formatWalletMoney(bet.payout ?? bet.stake),
        detail: 'Reembolso',
        tone: 'text-metallic-platinum',
      };
    case 'lost':
      return {
        value: '—',
        detail: 'Sin retorno',
        tone: 'text-metallic-slate',
      };
    case 'pending':
    default:
      return {
        value: formatWalletMoney(bet.potentialPayout),
        detail: 'Potencial',
        tone: 'text-metallic-platinum',
      };
  }
}

export function BetHistoryPanel({ bets, className = '' }: BetHistoryPanelProps) {
  const [filter, setFilter] = useState<WalletBetFilter>('all');
  const [period, setPeriod] = useState<WalletHistoryPeriod>('30d');

  const periodBets = useMemo(() => filterBetsByPeriod(bets, period), [bets, period]);

  const counts = useMemo<Record<WalletBetFilter, number>>(() => {
    const next: Record<WalletBetFilter, number> = {
      all: periodBets.length,
      pending: 0,
      won: 0,
      lost: 0,
      cancelled: 0,
    };

    for (const bet of periodBets) next[bet.status] += 1;
    return next;
  }, [periodBets]);

  const visibleBets = useMemo(
    () => filterBetsByStatus(periodBets, filter),
    [periodBets, filter],
  );

  const filterOptions = WALLET_BET_FILTERS.map((option) => ({
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
        Ver todas las apuestas
      </button>
    ) : period !== 'all' ? (
      <button
        type='button'
        onClick={() => setPeriod('all')}
        className='rounded-sm border border-obsidian-border bg-obsidian-surface/60 px-3 py-2 font-display text-[10px] font-extrabold uppercase tracking-brutal text-metallic-platinum transition-colors hover:border-metallic-slate hover:text-white'
      >
        Ampliar a todo el historial
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
      aria-labelledby='wallet-bets-title'
      className={`surface-panel overflow-hidden ${className}`}
    >
      <div className='p-5 sm:p-6'>
        <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
          <div>
            <div className='flex flex-wrap items-center gap-2'>
              <span className='font-mono text-[9px] font-bold uppercase tracking-ultra text-metallic-slate'>
                Historial
              </span>
            </div>
            <h2
              id='wallet-bets-title'
              className='mt-1 font-display text-base font-extrabold uppercase tracking-tight text-white'
            >
              Tus apuestas
            </h2>
            <p className='mt-1 text-[11px] leading-relaxed text-metallic-titanium'>
              Seguimiento de tickets, cuotas y liquidaciones.
            </p>
          </div>

          <div className='flex flex-wrap items-center gap-2'>
            <span className='font-mono text-[9px] font-bold uppercase tracking-brutal text-metallic-slate'>
              {periodBets.length} {periodBets.length === 1 ? 'ticket' : 'tickets'}
            </span>
            <label className='inline-flex items-center gap-2'>
              <span className='sr-only'>Periodo del historial de apuestas</span>
              <CalendarDays size={12} className='text-metallic-slate' aria-hidden='true' />
              <select
                value={period}
                onChange={(event) => setPeriod(event.target.value as WalletHistoryPeriod)}
                className='rounded-sm border border-obsidian-border bg-obsidian-surface/60 px-2 py-1.5 font-mono text-[9px] font-bold uppercase tracking-brutal text-metallic-platinum outline-none transition-colors hover:border-metallic-slate focus:border-crimson'
              >
                {WALLET_PERIODS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <WalletFilterPills
          options={filterOptions}
          value={filter}
          onChange={setFilter}
          ariaLabel='Filtrar apuestas por estado'
          className='mt-5 border-b border-obsidian-border/70 pb-4'
        />

        {visibleBets.length === 0 ? (
          <WalletEmptyState
            icon={Ticket}
            title={bets.length === 0 ? 'Tu historial empieza aquí' : 'Sin apuestas en este estado'}
            description={
              bets.length === 0
                ? 'Cuando confirmes tu primera apuesta aparecerá en esta sección con su cuota, stake y estado.'
                : 'Prueba con otro estado o amplía el periodo para ver más registros.'
            }
            action={emptyAction}
          />
        ) : (
          <>
            <div className='hidden overflow-x-auto xl:block'>
              <table className='w-full min-w-[760px] border-collapse text-left'>
                <caption className='sr-only'>Historial de apuestas de la billetera</caption>
                <thead>
                  <tr className='border-b border-obsidian-border/60'>
                    <th
                      scope='col'
                      className='pb-3 pr-4 font-mono text-[9px] font-bold uppercase tracking-brutal text-metallic-slate'
                    >
                      Apuesta
                    </th>
                    <th
                      scope='col'
                      className='pb-3 pr-4 text-right font-mono text-[9px] font-bold uppercase tracking-brutal text-metallic-slate'
                    >
                      Cuota
                    </th>
                    <th
                      scope='col'
                      className='pb-3 pr-4 text-right font-mono text-[9px] font-bold uppercase tracking-brutal text-metallic-slate'
                    >
                      Stake
                    </th>
                    <th
                      scope='col'
                      className='pb-3 pr-4 text-right font-mono text-[9px] font-bold uppercase tracking-brutal text-metallic-slate'
                    >
                      Retorno
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
                  {visibleBets.map((bet) => {
                    const returnInfo = describeReturn(bet);

                    return (
                      <tr
                        key={bet.id}
                        className='border-b border-obsidian-border/40 transition-colors last:border-0 hover:bg-white/[0.015]'
                      >
                        <td className='min-w-[280px] py-3.5 pr-4 align-top'>
                          <p className='font-display text-[11px] font-bold uppercase tracking-wide text-white'>
                            {bet.eventName}
                          </p>
                          <p className='mt-1 text-[11px] text-metallic-titanium'>
                            {bet.selectionName}
                            <span className='text-metallic-slate'> · {bet.marketLabel}</span>
                          </p>
                          <div className='mt-1.5 flex flex-wrap items-center gap-1.5 font-mono text-[8px] uppercase tracking-wide text-metallic-slate'>
                            <span>
                              {bet.type === 'combined' ? `Combinada · ${bet.legs}` : 'Simple'}
                            </span>
                            <span aria-hidden='true'>·</span>
                            <span>{bet.ticket}</span>
                          </div>
                        </td>

                        <td className='py-3.5 pr-4 text-right align-top'>
                          <span className='font-mono text-xs font-bold text-white tabular-nums'>
                            {bet.odds.toFixed(2)}
                          </span>
                        </td>

                        <td className='py-3.5 pr-4 text-right align-top'>
                          <span className='font-mono text-xs font-semibold text-metallic-platinum tabular-nums'>
                            {formatWalletMoney(bet.stake)}
                          </span>
                        </td>

                        <td className='py-3.5 pr-4 text-right align-top'>
                          <span className={`font-mono text-xs font-bold tabular-nums ${returnInfo.tone}`}>
                            {returnInfo.value}
                          </span>
                          <span className='mt-0.5 block font-mono text-[8px] uppercase tracking-wide text-metallic-slate'>
                            {returnInfo.detail}
                          </span>
                        </td>

                        <td className='py-3.5 pr-4 align-top'>
                          <BetStatusBadge status={bet.status} />
                        </td>

                        <td className='py-3.5 text-right align-top'>
                          <span className='block font-mono text-[10px] text-metallic-titanium'>
                            {formatWalletDateTime(bet.placedAt)}
                          </span>
                          <span className='mt-0.5 block font-mono text-[8px] uppercase tracking-wide text-metallic-slate'>
                            {formatRelativeTime(bet.placedAt)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ul className='divide-y divide-obsidian-border/50 xl:hidden'>
              {visibleBets.map((bet) => {
                const returnInfo = describeReturn(bet);

                return (
                  <li key={bet.id} className='py-4 first:pt-4 last:pb-0'>
                    <div className='flex items-start justify-between gap-3'>
                      <div className='min-w-0'>
                        <p className='font-display text-[11px] font-bold uppercase tracking-wide text-white'>
                          {bet.eventName}
                        </p>
                        <p className='mt-1 text-[11px] text-metallic-titanium'>
                          {bet.selectionName}
                          <span className='text-metallic-slate'> · {bet.marketLabel}</span>
                        </p>
                      </div>
                      <BetStatusBadge status={bet.status} />
                    </div>

                    <div className='mt-3 grid grid-cols-3 gap-2 rounded-sm border border-obsidian-border/50 bg-obsidian-surface/40 p-2.5'>
                      <div>
                        <span className='block font-mono text-[8px] uppercase tracking-wide text-metallic-slate'>
                          Stake
                        </span>
                        <span className='mt-1 block font-mono text-[11px] font-bold text-metallic-platinum tabular-nums'>
                          {formatWalletMoney(bet.stake)}
                        </span>
                      </div>
                      <div>
                        <span className='block font-mono text-[8px] uppercase tracking-wide text-metallic-slate'>
                          Cuota
                        </span>
                        <span className='mt-1 block font-mono text-[11px] font-bold text-white tabular-nums'>
                          {bet.odds.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className='block font-mono text-[8px] uppercase tracking-wide text-metallic-slate'>
                          Retorno
                        </span>
                        <span className={`mt-1 block font-mono text-[11px] font-bold tabular-nums ${returnInfo.tone}`}>
                          {returnInfo.value}
                        </span>
                      </div>
                    </div>

                    <div className='mt-2 flex flex-wrap items-center justify-between gap-2 font-mono text-[8px] uppercase tracking-wide text-metallic-slate'>
                      <span className='flex flex-wrap items-center gap-1.5'>
                        <span>
                          {bet.type === 'combined' ? `Combinada · ${bet.legs}` : 'Simple'}
                        </span>
                        <span aria-hidden='true'>·</span>
                        <span>{bet.ticket}</span>
                      </span>
                      <span>{formatWalletDateTime(bet.placedAt)}</span>
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
          {'Historial sincronizado con la billetera de Zenbet.'}
        </p>
      </div>
    </section>
  );
}
