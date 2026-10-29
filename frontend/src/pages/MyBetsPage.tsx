import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CalendarDays,
  Clock3,
  ReceiptText,
  RefreshCw,
  Sparkles,
  Ticket,
  TrendingUp,
  TriangleAlert,
  Wallet,
} from 'lucide-react';

import { useAuth } from '@/context/authState';
import {
  formatRelativeTime,
  formatWalletDateTime,
  formatWalletMoney,
  type WalletBet,
} from '@/domain/wallet';
import { useWalletDashboard } from '@/hooks/useWalletDashboard';
import { BetStatusBadge } from '@/modules/Wallet/components/WalletStatusBadge';

type TicketFilter = 'active' | 'past' | 'all';

const EMPTY_BETS: readonly WalletBet[] = [];

const FILTERS: readonly { value: TicketFilter; label: string }[] = [
  { value: 'active', label: 'Activas' },
  { value: 'past', label: 'Finalizadas' },
  { value: 'all', label: 'Todas' },
];

function isActive(bet: WalletBet): boolean {
  return bet.status === 'pending';
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

interface StatTileProps {
  readonly label: string;
  readonly value: string;
  readonly detail: string;
  readonly icon: typeof Clock3;
  readonly accent?: 'lime' | 'money' | 'neutral';
}

function StatTile({ label, value, detail, icon: Icon, accent = 'neutral' }: StatTileProps) {
  const tone =
    accent === 'lime'
      ? 'border-lime-400/25 bg-lime-400/[0.045] text-lime-400'
      : accent === 'money'
        ? 'border-money/20 bg-money/[0.045] text-money'
        : 'border-white/[0.08] bg-white/[0.02] text-metallic-titanium';

  return (
    <div className='surface-panel flex items-start justify-between gap-4 p-4 sm:p-5'>
      <div className='min-w-0'>
        <p className='font-mono text-[9px] font-bold uppercase tracking-brutal text-metallic-slate'>
          {label}
        </p>
        <p className='mt-2 truncate font-mono text-xl font-bold text-white tabular-nums sm:text-2xl'>
          {value}
        </p>
        <p className='mt-1.5 text-[10px] leading-relaxed text-metallic-slate'>{detail}</p>
      </div>
      <span
        aria-hidden='true'
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-sm border ${tone}`}
      >
        <Icon size={16} strokeWidth={1.8} />
      </span>
    </div>
  );
}

interface TicketCardProps {
  readonly bet: WalletBet;
}

function TicketCard({ bet }: TicketCardProps) {
  const pending = bet.status === 'pending';
  const accent = pending
    ? 'bg-lime-400'
    : bet.status === 'won'
      ? 'bg-odds-up'
      : bet.status === 'lost'
        ? 'bg-odds-down'
        : 'bg-metallic-slate';

  const returnValue = bet.payout ?? bet.potentialPayout;
  const returnLabel = pending ? 'Retorno potencial' : bet.payout !== null ? 'Pagado' : 'Retorno';

  return (
    <article className='group relative overflow-hidden rounded-sm border border-white/[0.09] bg-[#0A0A0A] shadow-[0_18px_45px_-32px_rgba(0,0,0,0.9)] transition-colors duration-150 hover:border-white/[0.16]'>
      <span aria-hidden='true' className={`block h-px w-full ${accent} opacity-80`} />

      <div className='p-4 sm:p-5'>
        <div className='flex items-start justify-between gap-3'>
          <div className='flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1'>
            <span className='font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-lime-400'>
              {bet.ticket}
            </span>
            <span aria-hidden='true' className='text-metallic-slate'>·</span>
            <span className='font-mono text-[9px] uppercase tracking-wide text-metallic-titanium'>
              {bet.type === 'combined' ? `Combinada · ${bet.legs}` : 'Simple'}
            </span>
          </div>
          <BetStatusBadge status={bet.status} />
        </div>

        <div className='mt-5'>
          <h3 className='font-display text-[15px] font-bold uppercase leading-snug tracking-wide text-white'>
            {bet.eventName}
          </h3>
          <p className='mt-1.5 text-xs leading-relaxed text-metallic-titanium'>
            <span className='font-semibold text-metallic-platinum'>{bet.selectionName}</span>
            <span className='text-metallic-slate'> · {bet.marketLabel}</span>
          </p>
        </div>

        <div className='mt-5 grid grid-cols-3 divide-x divide-white/[0.07] border-y border-white/[0.07] py-3'>
          <div className='pr-2'>
            <span className='block font-mono text-[8px] uppercase tracking-wide text-metallic-slate'>
              Stake
            </span>
            <span className='mt-1 block font-mono text-[12px] font-bold text-metallic-platinum tabular-nums'>
              {formatWalletMoney(bet.stake)}
            </span>
          </div>
          <div className='px-2'>
            <span className='block font-mono text-[8px] uppercase tracking-wide text-metallic-slate'>
              Cuota
            </span>
            <span className='mt-1 block font-mono text-[12px] font-bold text-white tabular-nums'>
              {bet.odds.toFixed(2)}
            </span>
          </div>
          <div className='pl-2 text-right'>
            <span className='block font-mono text-[8px] uppercase tracking-wide text-metallic-slate'>
              {returnLabel}
            </span>
            <span
              className={`mt-1 block font-mono text-[12px] font-bold tabular-nums ${
                bet.status === 'won' ? 'text-odds-up' : pending ? 'text-lime-400' : 'text-metallic-platinum'
              }`}
            >
              {formatWalletMoney(returnValue)}
            </span>
          </div>
        </div>

        <div className='mt-3 flex flex-wrap items-center justify-between gap-2 font-mono text-[8px] uppercase tracking-wide text-metallic-slate'>
          <span className='inline-flex items-center gap-1.5'>
            <CalendarDays size={10} aria-hidden='true' />
            {formatWalletDateTime(bet.placedAt)}
          </span>
          <span>{formatRelativeTime(bet.placedAt)}</span>
        </div>
      </div>
    </article>
  );
}

function EmptyTickets({ filtered }: { readonly filtered: boolean }) {
  return (
    <div className='surface-panel flex flex-col items-center justify-center px-6 py-16 text-center'>
      <span className='grid h-12 w-12 place-items-center rounded-sm border border-lime-400/30 bg-lime-400/[0.06] text-lime-400'>
        <Ticket size={20} strokeWidth={1.7} aria-hidden='true' />
      </span>
      <h2 className='mt-4 font-display text-sm font-bold uppercase tracking-wide text-white'>
        {filtered ? 'Sin tickets en este filtro' : 'Tu primer ticket te espera'}
      </h2>
      <p className='mt-2 max-w-sm text-xs leading-relaxed text-metallic-titanium'>
        {filtered
          ? 'Cambia el filtro para consultar el resto de tus apuestas.'
          : 'Cuando confirmes una apuesta, aparecerá aquí con su cuota, stake y retorno potencial.'}
      </p>
      <div className='mt-5 flex flex-wrap justify-center gap-2'>
        <Link
          to='/sportsbook'
          className='inline-flex items-center gap-2 rounded-sm border border-lime-400 bg-lime-400 px-4 py-2 font-display text-[10px] font-bold uppercase tracking-wide text-[#0D0D0D] transition-colors hover:bg-lime-500'
        >
          Ver cartelera UFC
          <ArrowRight size={12} aria-hidden='true' />
        </Link>
        <Link
          to='/wallet'
          className='inline-flex items-center gap-2 rounded-sm border border-obsidian-border bg-obsidian-surface/60 px-4 py-2 font-display text-[10px] font-bold uppercase tracking-wide text-metallic-platinum transition-colors hover:border-metallic-slate hover:text-white'
        >
          <Wallet size={12} aria-hidden='true' />
          Mi billetera
        </Link>
      </div>
    </div>
  );
}

export default function MyBetsPage() {
  const { user } = useAuth();
  const { snapshot, status, error, refresh } = useWalletDashboard();
  const [filter, setFilter] = useState<TicketFilter>('all');

  const bets = snapshot?.bets ?? EMPTY_BETS;

  const activeBets = useMemo(() => bets.filter(isActive), [bets]);
  const pastBets = useMemo(() => bets.filter((bet) => !isActive(bet)), [bets]);

  const activeStake = sum(activeBets.map((bet) => bet.stake));
  const potentialReturn = sum(activeBets.map((bet) => bet.potentialPayout));
  const settledPayout = sum(pastBets.map((bet) => bet.payout ?? 0));

  if (!user) {
    return (
      <div className='mx-auto flex min-h-[60vh] w-full max-w-7xl items-center justify-center px-4'>
        <div className='surface-panel px-6 py-8 text-center'>
          <p className='font-display text-sm font-bold uppercase tracking-wide text-white'>
            Inicia sesión para ver tus apuestas
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

  const isInitialLoading = !snapshot && (status === 'loading' || status === 'refreshing');
  const visibleActive = filter === 'past' ? [] : activeBets;
  const visiblePast = filter === 'active' ? [] : pastBets;
  const visibleCount = visibleActive.length + visiblePast.length;

  const counts: Record<TicketFilter, number> = {
    active: activeBets.length,
    past: pastBets.length,
    all: bets.length,
  };

  return (
    <div className='relative isolate min-h-full overflow-hidden bg-canvas'>
      <div
        aria-hidden='true'
        className='pointer-events-none absolute inset-x-0 top-0 h-[560px] bg-gradient-ambient-crimson opacity-70'
      />
      <div
        aria-hidden='true'
        className='pointer-events-none absolute inset-x-0 top-0 h-[560px] bg-[radial-gradient(ellipse_at_78%_0%,rgba(212,255,63,0.075),transparent_48%)]'
      />

      <div className='relative mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8'>
        <header className='border-b border-obsidian-border/70 pb-5'>
          <div className='flex flex-wrap items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-ultra text-metallic-slate'>
            <Link to='/' className='transition-colors hover:text-metallic-platinum'>
              Inicio
            </Link>
            <span aria-hidden='true'>/</span>
            <Link to='/sportsbook' className='transition-colors hover:text-metallic-platinum'>
              Sportsbook
            </Link>
            <span aria-hidden='true'>/</span>
            <span className='text-lime-400'>Mis apuestas</span>
          </div>

          <div className='mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between'>
            <div className='min-w-0'>
              <div className='inline-flex items-center gap-2 border border-lime-400/30 bg-lime-400/[0.055] px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-brutal text-lime-400'>
                <ReceiptText size={11} aria-hidden='true' />
                Historial personal
              </div>
              <h1 className='mt-3 font-display text-3xl font-bold uppercase tracking-tight text-white sm:text-4xl'>
                Mis apuestas
              </h1>
              <p className='mt-2 max-w-xl text-xs leading-relaxed text-metallic-titanium'>
                Sigue tus tickets activos y consulta el resultado de cada apuesta. Todo se
                sincroniza con tu billetera ZenBet.
              </p>
            </div>

            <div className='flex flex-wrap items-center gap-2'>
              <span className='font-mono text-[9px] uppercase tracking-wide text-metallic-slate'>
                {snapshot ? `Actualizado ${formatRelativeTime(snapshot.updatedAt)}` : 'Sincronizando'}
              </span>
              <button
                type='button'
                onClick={refresh}
                disabled={status === 'loading' || status === 'refreshing'}
                className='inline-flex items-center gap-1.5 rounded-sm border border-obsidian-border bg-obsidian-surface/60 px-3 py-2 font-display text-[10px] font-bold uppercase tracking-wide text-metallic-platinum transition-colors hover:border-metallic-slate hover:text-white disabled:cursor-wait disabled:opacity-60'
              >
                <RefreshCw
                  size={12}
                  className={status === 'refreshing' ? 'animate-spin' : undefined}
                  aria-hidden='true'
                />
                Actualizar
              </button>
              <Link
                to='/sportsbook'
                className='inline-flex items-center gap-2 rounded-sm border border-crimson/60 bg-crimson px-3 py-2 font-display text-[10px] font-bold uppercase tracking-wide text-white transition-colors hover:bg-crimson-pure'
              >
                Nueva apuesta
                <ArrowRight size={12} aria-hidden='true' />
              </Link>
            </div>
          </div>
        </header>

        {isInitialLoading ? (
          <div className='mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3' aria-live='polite'>
            <span className='sr-only'>Cargando apuestas…</span>
            {[0, 1, 2].map((item) => (
              <div key={item} className='surface-panel animate-pulse p-5'>
                <div className='h-3 w-24 rounded-sm bg-obsidian-elevated/70' />
                <div className='mt-5 h-4 w-3/4 rounded-sm bg-obsidian-elevated/70' />
                <div className='mt-2 h-3 w-1/2 rounded-sm bg-obsidian-elevated/60' />
                <div className='mt-6 h-14 rounded-sm bg-obsidian-elevated/50' />
              </div>
            ))}
          </div>
        ) : status === 'error' && !snapshot ? (
          <div className='surface-panel mt-6 flex flex-col items-center justify-center px-6 py-16 text-center'>
            <span className='grid h-11 w-11 place-items-center rounded-md border border-odds-down/30 bg-odds-down/5 text-odds-down'>
              <TriangleAlert size={19} strokeWidth={1.8} aria-hidden='true' />
            </span>
            <h2 className='mt-4 font-display text-sm font-bold uppercase tracking-wide text-white'>
              No pudimos cargar tus apuestas
            </h2>
            <p className='mt-1.5 max-w-sm text-xs leading-relaxed text-metallic-titanium'>
              {error ?? 'Ocurrió un error inesperado al consultar tus tickets.'}
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
        ) : (
          <>
            <div className='mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4'>
              <StatTile
                label='Apuestas activas'
                value={String(activeBets.length)}
                detail={activeBets.length === 1 ? 'Ticket en juego' : 'Tickets en juego'}
                icon={Clock3}
                accent='lime'
              />
              <StatTile
                label='En juego'
                value={formatWalletMoney(activeStake)}
                detail='Stake comprometido'
                icon={Wallet}
              />
              <StatTile
                label='Retorno potencial'
                value={formatWalletMoney(potentialReturn)}
                detail='Si aciertan tus selecciones'
                icon={TrendingUp}
                accent='money'
              />
              <StatTile
                label='Tickets finalizados'
                value={String(pastBets.length)}
                detail={`${formatWalletMoney(settledPayout)} pagados`}
                icon={Sparkles}
              />
            </div>

            <div className='mt-6 flex flex-col gap-3 border-b border-obsidian-border/70 pb-3 sm:flex-row sm:items-center sm:justify-between'>
              <div
                role='tablist'
                aria-label='Filtrar apuestas'
                className='flex flex-wrap items-center gap-1.5'
              >
                {FILTERS.map((option) => {
                  const selected = filter === option.value;
                  return (
                    <button
                      key={option.value}
                      type='button'
                      role='tab'
                      aria-selected={selected}
                      onClick={() => setFilter(option.value)}
                      className={`inline-flex items-center gap-2 rounded-sm border px-3 py-2 font-display text-[10px] font-bold uppercase tracking-wide transition-colors ${
                        selected
                          ? 'border-lime-400/55 bg-lime-400/[0.09] text-lime-400'
                          : 'border-obsidian-border bg-obsidian-surface/40 text-metallic-titanium hover:border-metallic-slate hover:text-white'
                      }`}
                    >
                      {option.label}
                      <span className='font-mono text-[9px] text-metallic-slate'>
                        {counts[option.value]}
                      </span>
                    </button>
                  );
                })}
              </div>

              <span className='font-mono text-[9px] uppercase tracking-wide text-metallic-slate'>
                {visibleCount} {visibleCount === 1 ? 'ticket visible' : 'tickets visibles'}
              </span>
            </div>

            {visibleCount === 0 ? (
              <div className='mt-6'>
                <EmptyTickets filtered={bets.length > 0} />
              </div>
            ) : (
              <div className='mt-6 space-y-8'>
                {visibleActive.length > 0 ? (
                  <section aria-labelledby='active-tickets-title'>
                    <div className='mb-3 flex flex-wrap items-center justify-between gap-2'>
                      <h2
                        id='active-tickets-title'
                        className='font-display text-sm font-bold uppercase tracking-wide text-white'
                      >
                        Tickets activos
                      </h2>
                      <span className='font-mono text-[9px] uppercase tracking-wide text-lime-400'>
                        {formatWalletMoney(potentialReturn)} en juego
                      </span>
                    </div>
                    <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
                      {visibleActive.map((bet) => (
                        <TicketCard key={bet.id} bet={bet} />
                      ))}
                    </div>
                  </section>
                ) : null}

                {visiblePast.length > 0 ? (
                  <section aria-labelledby='past-tickets-title'>
                    <div className='mb-3 flex flex-wrap items-center justify-between gap-2'>
                      <h2
                        id='past-tickets-title'
                        className='font-display text-sm font-bold uppercase tracking-wide text-white'
                      >
                        Tickets finalizados
                      </h2>
                      <span className='font-mono text-[9px] uppercase tracking-wide text-metallic-slate'>
                        {pastBets.length} {pastBets.length === 1 ? 'registro' : 'registros'}
                      </span>
                    </div>
                    <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
                      {visiblePast.map((bet) => (
                        <TicketCard key={bet.id} bet={bet} />
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>
            )}

            <div className='mt-6 flex flex-col gap-3 border-t border-obsidian-border/60 pt-4 text-[10px] leading-relaxed text-metallic-slate sm:flex-row sm:items-center sm:justify-between'>
              <p className='max-w-xl'>
                Las cuotas se muestran con el valor de referencia de la selección. El retorno
                potencial se calcula sobre el stake confirmado.
              </p>
              <Link
                to='/wallet'
                className='inline-flex shrink-0 items-center gap-1.5 font-display text-[10px] font-bold uppercase tracking-wide text-lime-400 transition-colors hover:text-lime-400'
              >
                Ver movimientos
                <ArrowRight size={11} aria-hidden='true' />
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
