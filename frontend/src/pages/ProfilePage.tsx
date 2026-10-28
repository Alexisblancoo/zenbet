import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CalendarDays,
  Mail,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  UserRound,
  Wallet,
} from 'lucide-react';

import { useAuth } from '@/context/authState';
import {
  formatWalletDateLong,
  formatWalletId,
  formatWalletMoney,
  formatWalletMoneyParts,
} from '@/domain/wallet';
import { useWalletDashboard } from '@/hooks/useWalletDashboard';
import { TransactionHistoryPanel } from '@/modules/Wallet/components/TransactionHistoryPanel';
import { WalletDepositPanel } from '@/modules/Wallet/components/WalletDepositPanel';

export default function ProfilePage() {
  const { user } = useAuth();
  const { snapshot, metrics, status, error, refresh } = useWalletDashboard();

  const transactions = snapshot?.transactions ?? [];
  const bets = snapshot?.bets ?? [];

  const handleViewTransactions = useCallback(() => {
    const target = document.getElementById('profile-wallet-transactions');
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
            Inicia sesión para ver tu perfil
          </p>
          <Link
            to='/login'
            className='mt-4 inline-flex items-center gap-2 rounded-sm border border-crimson/60 bg-crimson/10 px-4 py-2 font-display text-[10px] font-bold uppercase tracking-wide text-crimson'
          >
            Ir a iniciar sesión
            <ArrowRight size={12} aria-hidden='true' />
          </Link>
        </div>
      </div>
    );
  }

  const balance = snapshot?.balance ?? user.walletBalance;
  const { whole, fraction } = formatWalletMoneyParts(balance);
  const initials = user.username.slice(0, 2).toUpperCase();
  const memberSince = user.createdAt ? formatWalletDateLong(user.createdAt) : '—';
  const isInitialLoading = !snapshot && (status === 'loading' || status === 'refreshing');

  return (
    <div className='relative isolate min-h-full overflow-hidden bg-canvas'>
      <div
        aria-hidden='true'
        className='pointer-events-none absolute inset-x-0 top-0 h-[620px] bg-gradient-ambient-crimson opacity-65'
      />
      <div
        aria-hidden='true'
        className='pointer-events-none absolute inset-x-0 top-0 h-[620px] bg-[radial-gradient(ellipse_at_82%_0%,rgba(212,255,63,0.075),transparent_52%)]'
      />

      <div className='relative mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8'>
        <header className='border-b border-obsidian-border/70 pb-5'>
          <div className='flex flex-wrap items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-ultra text-metallic-slate'>
            <Link to='/' className='transition-colors hover:text-metallic-platinum'>
              Inicio
            </Link>
            <span aria-hidden='true'>/</span>
            <span className='text-lime-400'>Mi perfil</span>
          </div>

          <div className='mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between'>
            <div>
              <div className='inline-flex items-center gap-2 border border-lime-400/30 bg-lime-400/[0.055] px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-brutal text-lime-400'>
                <UserRound size={11} aria-hidden='true' />
                Cuenta ZenBet
              </div>
              <h1 className='mt-3 font-display text-3xl font-bold uppercase tracking-tight text-white sm:text-4xl'>
                Mi perfil
              </h1>
              <p className='mt-2 max-w-xl text-xs leading-relaxed text-metallic-titanium'>
                Tu identidad, tu saldo y todos los movimientos de la billetera en una sola
                vista.
              </p>
            </div>

            <div className='flex flex-wrap items-center gap-2'>
              <Link
                to='/my-bets'
                className='inline-flex items-center gap-2 rounded-sm border border-lime-400/40 bg-lime-400/[0.06] px-3 py-2 font-display text-[10px] font-bold uppercase tracking-wide text-lime-400 transition-colors hover:bg-lime-400/[0.1]'
              >
                <ReceiptText size={12} aria-hidden='true' />
                Mis apuestas
              </Link>
              <Link
                to='/sportsbook'
                className='inline-flex items-center gap-2 rounded-sm border border-lime-400 bg-lime-400 px-3 py-2 font-display text-[10px] font-bold uppercase tracking-wide text-[#0D0D0D] transition-colors hover:bg-lime-500'
              >
                Apostar ahora
                <ArrowRight size={12} aria-hidden='true' />
              </Link>
            </div>
          </div>
        </header>

        <div className='mt-6 grid gap-4 lg:grid-cols-12'>
          <section
            aria-labelledby='profile-identity-title'
            className='surface-panel reveal-up p-5 sm:p-6 lg:col-span-4'
          >
            <div className='flex items-center justify-between gap-3'>
              <span className='font-mono text-[9px] font-bold uppercase tracking-ultra text-metallic-slate'>
                Identidad
              </span>
              <ShieldCheck size={14} className='text-money' aria-hidden='true' />
            </div>

            <div className='mt-6 flex items-center gap-4'>
              <span className='grid h-16 w-16 shrink-0 place-items-center border border-lime-400/55 bg-lime-400/[0.06] font-display text-xl font-bold tracking-[0.08em] text-lime-400 shadow-[0_0_30px_-16px_rgba(212,255,63,0.8)]'>
                {initials}
              </span>
              <div className='min-w-0'>
                <h2
                  id='profile-identity-title'
                  className='truncate font-display text-xl font-bold tracking-wide text-white'
                >
                  @{user.username}
                </h2>
                <p className='mt-1 inline-flex items-center gap-1.5 truncate font-mono text-[10px] text-metallic-titanium'>
                  <Mail size={11} className='shrink-0' aria-hidden='true' />
                  {user.email}
                </p>
              </div>
            </div>

            <dl className='mt-6 space-y-3 border-t border-obsidian-border/60 pt-4'>
              <div className='flex items-center justify-between gap-4'>
                <dt className='font-mono text-[9px] uppercase tracking-wide text-metallic-slate'>
                  Miembro desde
                </dt>
                <dd className='inline-flex items-center gap-1.5 font-mono text-[10px] text-metallic-platinum'>
                  <CalendarDays size={11} className='text-metallic-slate' aria-hidden='true' />
                  {memberSince}
                </dd>
              </div>
              <div className='flex items-center justify-between gap-4'>
                <dt className='font-mono text-[9px] uppercase tracking-wide text-metallic-slate'>
                  ID de cuenta
                </dt>
                <dd className='font-mono text-[10px] text-metallic-platinum'>
                  {String(user.id).slice(0, 8)}
                </dd>
              </div>
              <div className='flex items-center justify-between gap-4'>
                <dt className='font-mono text-[9px] uppercase tracking-wide text-metallic-slate'>
                  Billetera
                </dt>
                <dd className='font-mono text-[10px] text-metallic-platinum'>
                  {formatWalletId(user.walletId)}
                </dd>
              </div>
              <div className='flex items-center justify-between gap-4'>
                <dt className='font-mono text-[9px] uppercase tracking-wide text-metallic-slate'>
                  Apuestas
                </dt>
                <dd className='font-mono text-[10px] text-metallic-platinum'>
                  {bets.length} {bets.length === 1 ? 'ticket' : 'tickets'}
                </dd>
              </div>
            </dl>

            <p className='mt-5 border-t border-obsidian-border/60 pt-4 text-[10px] leading-relaxed text-metallic-slate'>
              Tu cuenta y tu billetera comparten el mismo identificador. El saldo nunca se
              acepta desde el navegador.
            </p>
          </section>

          <section
            id='billetera'
            aria-labelledby='profile-wallet-title'
            className='glass-panel reveal-up stagger-1 relative scroll-mt-24 overflow-hidden p-5 sm:p-6 lg:col-span-8'
          >
            <div aria-hidden='true' className='pointer-events-none absolute inset-0'>
              <div className='absolute -right-24 -top-28 h-64 w-64 rounded-full bg-lime-400/[0.07] blur-3xl' />
              <div className='absolute -bottom-28 left-1/4 h-64 w-64 rounded-full bg-money/10 blur-3xl' />
            </div>

            <div className='relative'>
              <div className='flex flex-wrap items-start justify-between gap-3'>
                <div>
                  <div className='inline-flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-ultra text-metallic-titanium'>
                    <span className='grid h-5 w-5 place-items-center rounded-sm border border-lime-400/30 bg-lime-400/[0.06] text-lime-400'>
                      <Wallet size={11} aria-hidden='true' />
                    </span>
                    <h2 id='profile-wallet-title'>Billetera</h2>
                  </div>
                  <p className='mt-2 text-[11px] leading-relaxed text-metallic-titanium'>
                    Saldo disponible y desglose de tu actividad real.
                  </p>
                </div>

                <div className='flex items-center gap-2'>
                  <button
                    type='button'
                    onClick={refresh}
                    disabled={status === 'loading' || status === 'refreshing'}
                    className='inline-flex items-center gap-1.5 rounded-sm border border-obsidian-border bg-obsidian-surface/60 px-2.5 py-1.5 font-mono text-[9px] font-bold uppercase tracking-brutal text-metallic-platinum transition-colors hover:border-metallic-slate hover:text-white disabled:cursor-wait disabled:opacity-60'
                  >
                    <RefreshCw
                      size={11}
                      className={status === 'refreshing' ? 'animate-spin' : undefined}
                      aria-hidden='true'
                    />
                    {status === 'refreshing' ? 'Sincronizando' : 'Actualizar'}
                  </button>
                  <span className='inline-flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-brutal text-metallic-slate'>
                    <span className='live-dot' aria-hidden='true' />
                    En vivo
                  </span>
                </div>
              </div>

              <div className='mt-7 flex flex-wrap items-end gap-x-3 gap-y-2'>
                <span aria-hidden='true' data-saldo-flash-target className='inline-flex items-end'>
                  <span className='font-mono text-[2.7rem] font-black leading-none tracking-tightest text-white tabular-nums sm:text-6xl'>
                    {whole}
                  </span>
                  <span className='pb-0.5 font-mono text-lg font-semibold leading-none text-white/70 sm:pb-1 sm:text-xl'>
                    .{fraction}
                  </span>
                </span>
                <span className='mb-1 rounded-sm border border-lime-400/30 bg-lime-400/[0.06] px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-brutal text-lime-400'>
                  USD
                </span>
                <span className='mb-1 font-mono text-[9px] uppercase tracking-wide text-metallic-slate'>
                  Saldo disponible
                </span>
              </div>
              <span className='sr-only'>
                Saldo disponible: {formatWalletMoney(balance)} dólares.
              </span>

              {isInitialLoading ? (
                <div className='mt-6 grid grid-cols-2 gap-2 lg:grid-cols-4' aria-live='polite'>
                  {[0, 1, 2, 3].map((item) => (
                    <div
                      key={item}
                      className='h-[74px] animate-pulse rounded-sm border border-white/[0.06] bg-obsidian-elevated/50'
                    />
                  ))}
                </div>
              ) : status === 'error' && !snapshot ? (
                <div className='mt-6 flex flex-col gap-3 border border-odds-down/25 bg-odds-down/[0.045] px-4 py-3 sm:flex-row sm:items-center sm:justify-between'>
                  <p className='flex items-start gap-2 text-[11px] leading-relaxed text-odds-down'>
                    <TriangleAlert size={13} className='mt-0.5 shrink-0' aria-hidden='true' />
                    {error ?? 'No se pudo cargar el historial de la billetera.'}
                  </p>
                  <button
                    type='button'
                    onClick={refresh}
                    className='shrink-0 self-start rounded-sm border border-odds-down/30 px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-brutal text-odds-down transition-colors hover:bg-odds-down/10 sm:self-auto'
                  >
                    Reintentar
                  </button>
                </div>
              ) : (
                <div className='mt-6 grid grid-cols-2 gap-2 lg:grid-cols-4'>
                  <div className='border border-lime-400/20 bg-lime-400/[0.035] p-3'>
                    <span className='block font-mono text-[8px] uppercase tracking-wide text-metallic-slate'>
                      Saldo base
                    </span>
                    <span className='mt-1.5 block font-mono text-sm font-bold text-lime-400 tabular-nums'>
                      {formatWalletMoney(0)}
                    </span>
                  </div>
                  <div className='border border-white/[0.07] bg-white/[0.018] p-3'>
                    <span className='block font-mono text-[8px] uppercase tracking-wide text-metallic-slate'>
                      En juego
                    </span>
                    <span className='mt-1.5 block font-mono text-sm font-bold text-money tabular-nums'>
                      {formatWalletMoney(metrics.pendingStake)}
                    </span>
                  </div>
                  <div className='border border-white/[0.07] bg-white/[0.018] p-3'>
                    <span className='block font-mono text-[8px] uppercase tracking-wide text-metallic-slate'>
                      Retorno potencial
                    </span>
                    <span className='mt-1.5 block font-mono text-sm font-bold text-metallic-platinum tabular-nums'>
                      {formatWalletMoney(
                        bets
                          .filter((bet) => bet.status === 'pending')
                          .reduce((total, bet) => total + bet.potentialPayout, 0),
                      )}
                    </span>
                  </div>
                  <div className='border border-white/[0.07] bg-white/[0.018] p-3'>
                    <span className='block font-mono text-[8px] uppercase tracking-wide text-metallic-slate'>
                      Movimientos
                    </span>
                    <span className='mt-1.5 block font-mono text-sm font-bold text-white tabular-nums'>
                      {transactions.length}
                    </span>
                  </div>
                </div>
              )}

              {status === 'error' && snapshot ? (
                <p className='mt-4 border border-odds-live/25 bg-odds-live/[0.045] px-3 py-2 text-[10px] leading-relaxed text-odds-live'>
                  No se pudo actualizar: {error}. Se muestra la última versión disponible.
                </p>
              ) : null}

              <div className='mt-6 flex flex-col gap-2 border-t border-obsidian-border/60 pt-4 sm:flex-row sm:flex-wrap sm:items-center'>
                <button
                  type='button'
                  onClick={handleViewTransactions}
                  className='inline-flex items-center justify-center gap-2 rounded-sm border border-lime-400 bg-lime-400 px-4 py-2.5 font-display text-[10px] font-bold uppercase tracking-wide text-[#0D0D0D] transition-colors hover:bg-lime-500'
                >
                  Ver movimientos
                  <ArrowRight size={12} aria-hidden='true' />
                </button>
                <Link
                  to='/my-bets'
                  className='inline-flex items-center justify-center gap-2 rounded-sm border border-lime-400/35 bg-lime-400/[0.05] px-4 py-2.5 font-display text-[10px] font-bold uppercase tracking-wide text-lime-400 transition-colors hover:bg-lime-400/[0.1]'
                >
                  <ReceiptText size={12} aria-hidden='true' />
                  Mis apuestas
                </Link>
                <Link
                  to='/wallet'
                  className='inline-flex items-center justify-center gap-2 rounded-sm border border-obsidian-border bg-obsidian-surface/60 px-4 py-2.5 font-display text-[10px] font-bold uppercase tracking-wide text-metallic-platinum transition-colors hover:border-metallic-slate hover:text-white sm:ml-auto'
                >
                  <Wallet size={12} aria-hidden='true' />
                  Abrir billetera
                </Link>
              </div>

              <p className='mt-4 flex items-start gap-2 border-t border-obsidian-border/50 pt-3 text-[10px] leading-relaxed text-metallic-slate'>
                <Sparkles size={11} className='mt-0.5 shrink-0 text-lime-400' aria-hidden='true' />
                Tu cuenta inicia en {formatWalletMoney(0)}. Usa la recarga para sumar
                saldo; el historial inferior muestra depósitos, apuestas y liquidaciones
                reales.
              </p>
            </div>
          </section>
        </div>

        <div className='mt-4'>
          <WalletDepositPanel
            onSubmitted={() => refresh()}
            className='reveal-up stagger-2'
          />
        </div>

        <div id='profile-wallet-transactions' className='mt-6 scroll-mt-24'>
          <TransactionHistoryPanel
            transactions={transactions}
            className='reveal-up stagger-2'
          />
        </div>

        <div className='mt-6 flex items-start gap-2 border-t border-obsidian-border/60 pt-4'>
          <ShieldCheck size={12} className='mt-0.5 shrink-0 text-metallic-slate' aria-hidden='true' />
          <p className='text-[10px] leading-relaxed text-metallic-slate'>
            Los montos y estados provienen de tu billetera en ZenBet. Las apuestas activas se
            actualizan cuando el mercado se liquida.
          </p>
        </div>
      </div>
    </div>
  );
}
