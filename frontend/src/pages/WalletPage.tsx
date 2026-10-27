import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  FlaskConical,
  Info,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';

import { useAuth } from '@/context/authState';
import { formatRelativeTime } from '@/domain/wallet';
import { useWalletDashboard } from '@/hooks/useWalletDashboard';
import { BetHistoryPanel } from '@/modules/Wallet/components/BetHistoryPanel';
import { TransactionHistoryPanel } from '@/modules/Wallet/components/TransactionHistoryPanel';
import { WalletBalanceHero } from '@/modules/Wallet/components/WalletBalanceHero';
import { WalletDepositPanel } from '@/modules/Wallet/components/WalletDepositPanel';
import { WalletMetrics } from '@/modules/Wallet/components/WalletMetrics';
import { WalletPerformancePanel } from '@/modules/Wallet/components/WalletPerformancePanel';
import { WalletSkeleton } from '@/modules/Wallet/components/WalletSkeleton';

/**
 * Dashboard de billetera.
 *
 * La vista solo compone: el saldo vive en AuthContext, los datos históricos
 * llegan del caso de uso `useWalletDashboard` y los cálculos se resuelven en
 * `domain/wallet.ts`. El modo demo se declara en la UI; nunca se disfraza de
 * información financiera real.
 */
export default function WalletPage() {
  const { user } = useAuth();
  const { snapshot, metrics, activity, activityNet, status, error, refresh } =
    useWalletDashboard();

  const handleViewTransactions = useCallback(() => {
    const target = document.getElementById('wallet-transactions');
    if (!target) return;

    const reduceMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    target.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'start',
    });
  }, []);

  if (!user) {
    return (
      <div className='mx-auto flex min-h-[60vh] w-full max-w-7xl items-center justify-center px-4'>
        <div className='surface-panel px-6 py-8 text-center'>
          <p className='font-display text-sm font-bold uppercase tracking-wide text-white'>
            Inicia sesión para ver tu billetera
          </p>
          <Link
            to='/login'
            className='mt-4 inline-flex items-center gap-2 rounded-sm border border-crimson/60 bg-crimson/10 px-4 py-2 font-display text-[10px] font-bold uppercase tracking-wide text-crimson transition-colors hover:bg-crimson/15'
          >
            Ir a iniciar sesión
            <ArrowRight size={12} aria-hidden='true' />
          </Link>
        </div>
      </div>
    );
  }

  const balance = snapshot?.balance ?? user.walletBalance;
  const isInitialLoading =
    !snapshot && (status === 'loading' || status === 'refreshing');
  const isDemo = snapshot?.mode === 'demo';

  return (
    <div className='relative isolate min-h-full overflow-hidden bg-canvas'>
      <div
        aria-hidden='true'
        className='pointer-events-none absolute inset-x-0 top-0 h-[620px] bg-gradient-ambient-crimson opacity-80'
      />
      <div
        aria-hidden='true'
        className='pointer-events-none absolute inset-x-0 top-0 h-[620px] bg-[radial-gradient(ellipse_at_18%_0%,rgb(var(--zb-electric-500)/0.09),transparent_55%)]'
      />

      <div className='relative mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8'>
        <header className='flex flex-col gap-4 border-b border-obsidian-border/70 pb-5 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between'>
          <div className='min-w-0'>
            <div className='flex items-center gap-2 font-mono text-[9px] font-bold uppercase tracking-ultra text-metallic-slate'>
              <Link
                to='/sportsbook'
                className='inline-flex items-center gap-1.5 transition-colors hover:text-metallic-platinum'
              >
                <ArrowLeft size={11} aria-hidden='true' />
                Sportsbook
              </Link>
              <span aria-hidden='true'>/</span>
              <span className='text-metallic-titanium'>Billetera</span>
            </div>

            <h1 className='mt-2 font-display text-2xl font-bold uppercase tracking-tight text-white sm:text-3xl'>
              Tu billetera
            </h1>
            <p className='mt-1.5 max-w-xl text-xs leading-relaxed text-metallic-titanium'>
              Saldo, apuestas y movimientos en un solo lugar. Tu sesión se mantiene
              sincronizada en tiempo real.
            </p>
          </div>

          <div className='flex flex-wrap items-center gap-2'>
            {isDemo ? (
              <span
                title='Historial de demostración; las consultas ampliadas estarán disponibles próximamente.'
                className='inline-flex items-center gap-1.5 rounded-sm border border-sage/25 bg-sage/5 px-2 py-1.5 font-mono text-[9px] font-bold uppercase tracking-brutal text-sage'
              >
                <FlaskConical size={11} aria-hidden='true' />
                Modo demo
              </span>
            ) : snapshot ? (
              <span className='inline-flex items-center gap-1.5 rounded-sm border border-crimson/30 bg-crimson/[0.07] px-2 py-1.5 font-mono text-[9px] font-bold uppercase tracking-brutal text-crimson'>
                <span className='h-1.5 w-1.5 rounded-full bg-crimson' aria-hidden='true' />
                Datos en vivo
              </span>
            ) : null}

            {snapshot ? (
              <span className='font-mono text-[9px] uppercase tracking-wide text-metallic-slate'>
                Actualizado {formatRelativeTime(snapshot.updatedAt)}
              </span>
            ) : null}

            <Link
              to='/sportsbook'
              className='inline-flex items-center gap-2 rounded-sm border border-crimson/60 bg-crimson/10 px-3 py-1.5 font-display text-[10px] font-bold uppercase tracking-wide text-crimson transition-colors hover:bg-crimson/15'
            >
              Apostar ahora
              <ArrowRight size={12} aria-hidden='true' />
            </Link>
          </div>
        </header>

        {isInitialLoading ? (
          <div className='mt-6'>
            <WalletSkeleton />
          </div>
        ) : status === 'error' && !snapshot ? (
          <div className='surface-panel mt-6 flex flex-col items-center justify-center px-6 py-16 text-center'>
            <span className='grid h-11 w-11 place-items-center rounded-md border border-odds-down/30 bg-odds-down/5 text-odds-down'>
              <TriangleAlert size={19} strokeWidth={1.8} aria-hidden='true' />
            </span>
            <h2 className='mt-4 font-display text-sm font-bold uppercase tracking-wide text-white'>
              No pudimos cargar tu billetera
            </h2>
            <p className='mt-1.5 max-w-sm text-xs leading-relaxed text-metallic-titanium'>
              {error ?? 'Ocurrió un error inesperado al consultar los datos.'}
            </p>
            <button
              type='button'
              onClick={refresh}
              className='mt-4 inline-flex items-center gap-2 rounded-sm border border-obsidian-border bg-obsidian-surface/60 px-4 py-2 font-display text-[10px] font-bold uppercase tracking-wide text-metallic-platinum transition-colors hover:border-metallic-slate hover:text-white'
            >
              <RefreshCw size={12} aria-hidden='true' />
              Reintentar
            </button>
          </div>
        ) : snapshot ? (
          <>
            {status === 'error' && error ? (
              <div className='mt-4 flex flex-col gap-2 border border-odds-live/30 bg-odds-live/5 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between'>
                <p className='flex items-start gap-2 text-[11px] leading-relaxed text-odds-live'>
                  <Info size={13} className='mt-0.5 shrink-0' aria-hidden='true' />
                  No se pudieron actualizar los datos: {error}. Se muestra la última versión
                  disponible.
                </p>
                <button
                  type='button'
                  onClick={refresh}
                  className='shrink-0 self-start rounded-sm border border-odds-live/30 px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-brutal text-odds-live transition-colors hover:bg-odds-live/10 sm:self-auto'
                >
                  Reintentar
                </button>
              </div>
            ) : null}

            <div className='mt-6 grid gap-4 lg:grid-cols-12'>
              <WalletBalanceHero
                user={user}
                balance={balance}
                status={status}
                onRefresh={refresh}
                onViewTransactions={handleViewTransactions}
                className='reveal-up lg:col-span-8'
              />
              <WalletPerformancePanel
                activity={activity}
                net={activityNet}
                winRate={metrics.winRate}
                settledCount={metrics.settledCount}
                className='reveal-up stagger-1 lg:col-span-4'
              />
            </div>

            <WalletMetrics
              metrics={metrics}
              className='reveal-up stagger-2 mt-4'
            />

            <WalletDepositPanel
              onDeposited={() => refresh()}
              className='reveal-up mt-4'
            />

            <div className='mt-6 flex flex-col gap-6'>
              <BetHistoryPanel
                bets={snapshot.bets}
                isDemo={isDemo}
                className='reveal-up stagger-3'
              />
              <TransactionHistoryPanel
                transactions={snapshot.transactions}
                isDemo={isDemo}
                className='reveal-up stagger-4'
              />
            </div>

            <div className='mt-6 flex items-start gap-2 border-t border-obsidian-border/60 pt-4'>
              <ShieldCheck
                size={12}
                className='mt-0.5 shrink-0 text-metallic-slate'
                aria-hidden='true'
              />
              <p className='text-[10px] leading-relaxed text-metallic-slate'>
                {isDemo
                  ? 'Saldo sincronizado con tu sesión. El historial ampliado estará disponible próximamente; las apuestas confirmadas en esta sesión ya se reflejan al instante.'
                  : 'Saldo e historial sincronizados con la billetera de Zenbet.'}
              </p>
            </div>
          </>
        ) : (
          <div className='surface-panel mt-6 flex flex-col items-center justify-center px-6 py-16 text-center'>
            <p className='font-display text-sm font-bold uppercase tracking-wide text-white'>
              Sin datos de billetera
            </p>
            <p className='mt-1.5 text-xs text-metallic-titanium'>
              Vuelve a cargar la página o inténtalo de nuevo en unos segundos.
            </p>
            <button
              type='button'
              onClick={refresh}
              className='mt-4 inline-flex items-center gap-2 rounded-sm border border-obsidian-border bg-obsidian-surface/60 px-4 py-2 font-display text-[10px] font-bold uppercase tracking-wide text-metallic-platinum transition-colors hover:border-metallic-slate hover:text-white'
            >
              <RefreshCw size={12} aria-hidden='true' />
              Reintentar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
