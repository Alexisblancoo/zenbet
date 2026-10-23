import { Link2Off, RefreshCw, User, Wallet, ArrowRight } from 'lucide-react';

import type { AuthUser } from '@/domain/auth';
import {
  formatWalletId,
  formatWalletMoney,
  formatWalletMoneyParts,
} from '@/domain/wallet';
import type { WalletDashboardStatus } from '@/hooks/useWalletDashboard';

interface WalletBalanceHeroProps {
  readonly user: AuthUser;
  readonly balance: number;
  readonly status: WalletDashboardStatus;
  readonly onRefresh: () => void;
  readonly onViewTransactions: () => void;
  readonly className?: string;
}

export function WalletBalanceHero({
  user,
  balance,
  status,
  onRefresh,
  onViewTransactions,
  className = '',
}: WalletBalanceHeroProps) {
  const { whole, fraction } = formatWalletMoneyParts(balance);
  const isRefreshing = status === 'refreshing';

  return (
    <section
      aria-labelledby='wallet-balance-title'
      className={`glass-panel relative isolate overflow-hidden p-5 sm:p-6 ${className}`}
    >
      <div aria-hidden='true' className='pointer-events-none absolute inset-0'>
        <div className='absolute -right-20 -top-28 h-64 w-64 rounded-full bg-money/10 blur-3xl' />
        <div className='absolute -bottom-28 left-1/4 h-64 w-64 rounded-full bg-electric/10 blur-3xl' />
        <div className='absolute inset-0 bg-grid-hairline opacity-[0.12] [mask-image:radial-gradient(ellipse_at_top,black,transparent_72%)]' />
      </div>

      <div className='relative'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div className='inline-flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-ultra text-metallic-titanium'>
            <span className='grid h-5 w-5 place-items-center rounded-sm border border-money/25 bg-money/5 text-money'>
              <Wallet size={11} aria-hidden='true' />
            </span>
            <h2 id='wallet-balance-title'>Billetera Zenbet</h2>
          </div>

          <span className='inline-flex items-center gap-2 font-mono text-[9px] font-bold uppercase tracking-brutal text-metallic-titanium'>
            <span className='live-dot' aria-hidden='true' />
            {isRefreshing ? 'Sincronizando' : 'Saldo en vivo'}
          </span>
        </div>

        <div className='mt-7'>
          <p className='font-mono text-[9px] font-bold uppercase tracking-ultra text-metallic-slate'>
            Saldo disponible
          </p>

          <div aria-live='polite' aria-atomic='true'>
            <span className='sr-only'>
              Saldo disponible: {formatWalletMoney(balance)} dólares.
            </span>
            <div
              aria-hidden='true'
              className='mt-1.5 flex flex-wrap items-end gap-x-2.5 gap-y-1'
            >
              <span className='inline-flex items-end'>
                <span className='font-mono text-[2.75rem] font-black leading-none tracking-tightest text-money tabular-nums sm:text-6xl'>
                  {whole}
                </span>
                <span className='pb-0.5 font-mono text-lg font-semibold leading-none text-money/80 sm:pb-1 sm:text-xl'>
                  .{fraction}
                </span>
              </span>
              <span className='mb-1 rounded-sm border border-money/25 bg-money/5 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-brutal text-money'>
                USD
              </span>
            </div>
          </div>

          <div className='mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-[10px] uppercase tracking-wide text-metallic-titanium'>
            <span className='inline-flex items-center gap-1.5'>
              <User size={11} className='text-metallic-slate' aria-hidden='true' />
              @{user.username}
            </span>
            <span className='h-3 w-px bg-obsidian-border' aria-hidden='true' />
            <span>ID {user.id}</span>
            <span className='h-3 w-px bg-obsidian-border' aria-hidden='true' />
            {user.walletId ? (
              <span className='inline-flex items-center gap-1.5'>
                <Wallet size={11} className='text-electric-soft' aria-hidden='true' />
                {formatWalletId(user.walletId)}
              </span>
            ) : (
              <span
                className='inline-flex items-center gap-1.5 text-odds-live'
                title='La billetera de apuestas aún no está vinculada a esta sesión.'
              >
                <Link2Off size={11} aria-hidden='true' />
                Billetera no vinculada
              </span>
            )}
          </div>
        </div>

        <div className='mt-7 flex flex-col gap-4 border-t border-obsidian-border/70 pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between'>
          <p className='max-w-xs text-[11px] leading-relaxed text-metallic-slate'>
            El saldo se actualiza al confirmar una apuesta y se conserva en tu sesión.
          </p>

          <div className='flex flex-col gap-2 sm:ml-auto xl:flex-row'>
            <button
              type='button'
              onClick={onViewTransactions}
              className='group inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm border border-crimson/70 bg-crimson px-4 py-2.5 font-display text-[10px] font-bold uppercase tracking-wide text-white transition-colors duration-150 hover:bg-crimson-pure focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crimson/70'
            >
              Ver movimientos
              <ArrowRight
                size={13}
                className='transition-transform duration-150 group-hover:translate-x-0.5'
                aria-hidden='true'
              />
            </button>

            <button
              type='button'
              onClick={onRefresh}
              disabled={isRefreshing}
              className='inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm border border-obsidian-border bg-obsidian-surface/60 px-4 py-2.5 font-display text-[10px] font-bold uppercase tracking-wide text-metallic-platinum transition-colors duration-150 hover:border-metallic-slate hover:text-white disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-metallic-slate/60'
            >
              <RefreshCw
                size={13}
                className={isRefreshing ? 'animate-spin' : undefined}
                aria-hidden='true'
              />
              {isRefreshing ? 'Actualizando' : 'Actualizar'}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
