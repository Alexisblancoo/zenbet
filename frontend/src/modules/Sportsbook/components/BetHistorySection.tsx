import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Clock3,
  Flame,
  Layers,
  Radio,
  ReceiptText,
  RefreshCw,
  Sparkles,
  Ticket,
  TrendingUp,
  XCircle,
  Zap,
} from 'lucide-react';

import { triggerSaldoFlashElements } from '@/hooks/useSaldoFlash';
import { useWalletDashboard } from '@/hooks/useWalletDashboard';
import { formatDecimalOdds, formatAmericanOdds } from '@/domain/odds';
import {
  formatRelativeTime,
  formatWalletDateTime,
  formatWalletMoney,
  type WalletBet,
  type WalletBetStatus,
} from '@/domain/wallet';

export type BetHistoryFilter = 'active' | 'settled' | 'all';

interface BetHistorySectionProps {
  readonly defaultTab?: BetHistoryFilter;
  readonly className?: string;
  readonly compact?: boolean;
}

interface ToastNotification {
  readonly id: string;
  readonly title: string;
  readonly message: string;
  readonly type: 'won' | 'lost' | 'info';
  readonly amount?: number;
}

/**
 * Módulo Neo-Brutalista de Historial de Apuestas y Liquidación en Tiempo Real.
 * Muestra apuestas Activas y Liquidadas con badges ▲ GANADA / ▼ PERDIDA
 * y reacciona a eventos SignalR de finalización de partidos y combates.
 */
function BetHistorySection({
  defaultTab = 'active',
  className = '',
  compact = false,
}: BetHistorySectionProps) {
  const { snapshot, status, refresh } = useWalletDashboard();

  const [activeTab, setActiveTab] = useState<BetHistoryFilter>(defaultTab);
  const [toasts, setToasts] = useState<readonly ToastNotification[]>([]);

  // Sincroniza la pestaña si defaultTab cambia desde el componente padre
  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  // Las apuestas salen únicamente de la API (`/wallet` y `/bets`).
  const bets = useMemo(() => snapshot?.bets ?? [], [snapshot?.bets]);

  // Conteos
  const activeBets = useMemo(() => bets.filter((b) => b.status === 'pending'), [bets]);
  const settledBets = useMemo(() => bets.filter((b) => b.status !== 'pending'), [bets]);

  const displayedBets = useMemo(() => {
    if (activeTab === 'active') return activeBets;
    if (activeTab === 'settled') return settledBets;
    return bets;
  }, [activeTab, activeBets, settledBets, bets]);

  // Disparar toast flotante
  const pushToast = useCallback((toast: Omit<ToastNotification, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const item: ToastNotification = { ...toast, id };
    setToasts((prev) => [item, ...prev].slice(0, 3));

    // Auto-desaparecer en 5 segundos
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  // Liquidación real: cuando la API devuelve como ganada/perdida una apuesta que
  // antes estaba pendiente (tras `ReceiveMarketSettled` o `SaldoActualizado`),
  // se avisa con los importes que entrega el servidor. La primera carga no avisa.
  const previousStatuses = useRef<ReadonlyMap<string, WalletBetStatus> | null>(null);
  useEffect(() => {
    const previous = previousStatuses.current;
    previousStatuses.current = new Map(bets.map((bet) => [bet.id, bet.status]));
    if (!previous) return;

    for (const bet of bets) {
      if (previous.get(bet.id) !== 'pending') continue;

      if (bet.status === 'won') {
        triggerSaldoFlashElements();
        pushToast({
          title: '▲ APUESTA GANADA',
          message: `${bet.eventName || 'Tu apuesta'} fue liquidada. Se acreditaron ${formatWalletMoney(bet.payout ?? 0)}.`,
          type: 'won',
          ...(bet.payout ? { amount: bet.payout } : {}),
        });
      } else if (bet.status === 'lost') {
        pushToast({
          title: '▼ APUESTA LIQUIDADA',
          message: `${bet.eventName || 'Tu apuesta'} finalizó. Resultado registrado en el historial.`,
          type: 'lost',
        });
      }
    }
  }, [bets, pushToast]);

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Notificaciones Flotantes (Toasts) estilo Neo-Brutalista Shibuya */}
      <div
        aria-live='polite'
        className='pointer-events-none fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full px-4'
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 rounded-lg border p-3.5 shadow-2xl transition-all duration-300 animate-in fade-in slide-in-from-bottom-3 ${
              toast.type === 'won'
                ? 'border-[#D4FF3F] bg-[#0E1505] text-white shadow-[0_0_30px_rgba(212,255,63,0.35)]'
                : 'border-crimson/50 bg-[#150505] text-white shadow-[0_0_25px_rgba(239,68,68,0.25)]'
            }`}
          >
            <span
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-sm border ${
                toast.type === 'won'
                  ? 'border-[#D4FF3F] bg-[#D4FF3F]/20 text-[#D4FF3F]'
                  : 'border-crimson bg-crimson/20 text-crimson'
              }`}
            >
              {toast.type === 'won' ? <TrendingUp size={16} /> : <XCircle size={16} />}
            </span>
            <div className='min-w-0 flex-1'>
              <div className='flex items-center justify-between gap-1'>
                <p
                  className={`font-mono text-[10px] font-bold uppercase tracking-wider ${
                    toast.type === 'won' ? 'text-[#D4FF3F]' : 'text-crimson'
                  }`}
                >
                  {toast.title}
                </p>
                {toast.amount && (
                  <span className='font-mono text-xs font-bold text-[#D4FF3F]'>
                    +{formatWalletMoney(toast.amount)}
                  </span>
                )}
              </div>
              <p className='mt-0.5 text-[11px] leading-snug text-metallic-slate'>
                {toast.message}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Selector de Pestañas Neo-Brutalista */}
      <div className='flex items-center justify-between border-b border-white/[0.08] bg-[#0A0A0A] px-3 py-2'>
        <div className='flex items-center gap-1 font-mono text-[10px] uppercase'>
          <button
            type='button'
            onClick={() => setActiveTab('active')}
            className={`relative flex items-center gap-1.5 border px-2.5 py-1.5 font-bold transition-all ${
              activeTab === 'active'
                ? 'border-[#D4FF3F] bg-[#D4FF3F]/[0.1] text-[#D4FF3F] shadow-[0_0_10px_-2px_rgba(212,255,63,0.4)]'
                : 'border-white/[0.08] bg-white/[0.02] text-metallic-slate hover:text-white'
            }`}
          >
            <span className='h-1.5 w-1.5 animate-pulse rounded-full bg-[#D4FF3F]' />
            Activas ({activeBets.length})
          </button>

          <button
            type='button'
            onClick={() => setActiveTab('settled')}
            className={`flex items-center gap-1.5 border px-2.5 py-1.5 font-bold transition-all ${
              activeTab === 'settled'
                ? 'border-[#D4FF3F] bg-[#D4FF3F]/[0.1] text-[#D4FF3F] shadow-[0_0_10px_-2px_rgba(212,255,63,0.4)]'
                : 'border-white/[0.08] bg-white/[0.02] text-metallic-slate hover:text-white'
            }`}
          >
            <ReceiptText size={12} />
            Liquidadas ({settledBets.length})
          </button>

          <button
            type='button'
            onClick={() => setActiveTab('all')}
            className={`hidden border px-2 py-1.5 transition-all sm:inline-block ${
              activeTab === 'all'
                ? 'border-[#D4FF3F] bg-[#D4FF3F]/[0.1] text-[#D4FF3F]'
                : 'border-white/[0.08] bg-white/[0.02] text-metallic-slate hover:text-white'
            }`}
          >
            Todas ({bets.length})
          </button>
        </div>

        <button
          type='button'
          onClick={refresh}
          title='Refrescar historial'
          className='rounded border border-white/[0.08] p-1.5 text-metallic-slate hover:border-white/20 hover:text-white focus-visible:outline-none'
        >
          <RefreshCw size={11} className={status === 'refreshing' ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Lista de Apuestas */}
      <div className='flex flex-col gap-2.5 p-3 overflow-y-auto max-h-[560px] no-scrollbar'>
        {displayedBets.length === 0 ? (
          <div className='flex flex-col items-center justify-center py-10 text-center'>
            <span className='grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.02] text-metallic-slate'>
              <Ticket size={18} />
            </span>
            <p className='mt-2.5 font-display text-xs font-bold uppercase tracking-wide text-white'>
              {activeTab === 'active'
                ? 'No tienes apuestas activas en juego'
                : 'No hay apuestas liquidadas en el historial'}
            </p>
            <p className='mt-1 max-w-xs text-[10px] text-metallic-slate'>
              {activeTab === 'active'
                ? 'Selecciona una cuota de fútbol o MMA para comenzar a apostar.'
                : 'Tus apuestas finalizadas aparecerán aquí con el desglose oficial de pago.'}
            </p>
          </div>
        ) : (
          displayedBets.map((bet) => {
            const isWon = bet.status === 'won';
            const isLost = bet.status === 'lost';

            return (
              <article
                key={bet.id}
                className={`relative overflow-hidden rounded-md border p-3 text-left transition-all duration-200 ${
                  isWon
                    ? 'border-[#D4FF3F]/50 bg-[#0c1205] shadow-[0_0_18px_-8px_rgba(212,255,63,0.35)]'
                    : isLost
                      ? 'border-crimson/30 bg-[#120606] opacity-80'
                      : 'border-white/[0.09] bg-[#0C0C0C] hover:border-white/20'
                }`}
              >
                {/* Indicador de acento superior */}
                <div
                  aria-hidden='true'
                  className={`absolute inset-x-0 top-0 h-[2px] ${
                    isWon
                      ? 'bg-[#D4FF3F]'
                      : isLost
                        ? 'bg-crimson'
                        : 'bg-gradient-to-r from-transparent via-[#D4FF3F]/60 to-transparent'
                  }`}
                />

                {/* Encabezado: Ticket + Estado en vivo */}
                <div className='flex items-center justify-between gap-2 border-b border-white/[0.06] pb-2'>
                  <div className='flex items-center gap-1.5 font-mono text-[9px] text-metallic-slate'>
                    <span className='font-bold text-metallic-platinum'>{bet.ticket}</span>
                    <span className='h-2.5 w-px bg-white/10' />
                    <span>{formatRelativeTime(bet.placedAt)}</span>
                  </div>

                  {/* Badges de Estado */}
                  {isWon ? (
                    <span className='inline-flex items-center gap-1 rounded-[2px] border border-[#D4FF3F]/60 bg-[#D4FF3F]/15 px-1.5 py-0.5 font-mono text-[8px] font-extrabold uppercase tracking-wide text-[#D4FF3F]'>
                      <ArrowUpRight size={10} strokeWidth={3} />▲ GANADA
                    </span>
                  ) : isLost ? (
                    <span className='inline-flex items-center gap-1 rounded-[2px] border border-crimson/50 bg-crimson/15 px-1.5 py-0.5 font-mono text-[8px] font-extrabold uppercase tracking-wide text-crimson'>
                      <ArrowDownRight size={10} strokeWidth={3} />▼ PERDIDA
                    </span>
                  ) : (
                    <span className='inline-flex items-center gap-1 rounded-[2px] border border-[#D4FF3F]/40 bg-[#D4FF3F]/[0.08] px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-wide text-[#D4FF3F]'>
                      <span className='h-1.5 w-1.5 animate-pulse rounded-full bg-[#D4FF3F]' />
                      ● EN JUEGO
                    </span>
                  )}
                </div>

                {/* Evento y Selección */}
                <div className='mt-2'>
                  <p className='truncate font-mono text-[9px] uppercase tracking-wider text-metallic-slate'>
                    {bet.eventName}
                  </p>
                  <p className='mt-0.5 font-display text-[12px] font-bold uppercase text-white'>
                    {bet.selectionName}
                  </p>
                  <div className='mt-1 flex items-center justify-between font-mono text-[9px] text-metallic-slate'>
                    <span>{bet.marketLabel}</span>
                    <span className='font-bold text-white'>
                      Cuota: {formatDecimalOdds(bet.odds)}
                      <span className='ml-1 opacity-60'>({formatAmericanOdds(bet.odds)})</span>
                    </span>
                  </div>
                </div>

                {/* Métricas de Apostado y Ganancia */}
                <div className='mt-2.5 flex items-center justify-between rounded border border-white/[0.06] bg-black/40 px-2.5 py-1.5 font-mono'>
                  <div>
                    <span className='block text-[8px] uppercase tracking-wider text-metallic-slate'>
                      Apostado
                    </span>
                    <span className='text-xs font-bold text-white'>
                      {formatWalletMoney(bet.stake)}
                    </span>
                  </div>

                  <div className='text-right'>
                    <span className='block text-[8px] uppercase tracking-wider text-metallic-slate'>
                      {isWon ? 'Retorno Pagado' : 'Retorno Potencial'}
                    </span>
                    <span
                      className={`text-xs font-bold ${
                        isWon ? 'text-[#D4FF3F]' : 'text-metallic-platinum'
                      }`}
                    >
                      {formatWalletMoney(isWon ? bet.payout ?? bet.potentialPayout : bet.potentialPayout)}
                    </span>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}

export default memo(BetHistorySection);

