import { Activity, TrendingDown, TrendingUp } from 'lucide-react';

import {
  formatSignedMoney,
  formatWinRate,
  type DailyActivityPoint,
} from '@/domain/wallet';

interface WalletPerformancePanelProps {
  readonly activity: readonly DailyActivityPoint[];
  readonly net: number;
  readonly winRate: number;
  readonly settledCount: number;
  readonly className?: string;
}

export function WalletPerformancePanel({
  activity,
  net,
  winRate,
  settledCount,
  className = '',
}: WalletPerformancePanelProps) {
  const maxMagnitude = Math.max(1, ...activity.map((point) => Math.abs(point.net)));
  const NetIcon = net >= 0 ? TrendingUp : TrendingDown;
  const netTone =
    net > 0 ? 'text-odds-up' : net < 0 ? 'text-odds-down' : 'text-metallic-platinum';

  return (
    <section
      aria-labelledby='wallet-performance-title'
      className={`glass-panel flex flex-col p-5 ${className}`}
    >
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div>
          <p className='font-mono text-[9px] font-bold uppercase tracking-ultra text-metallic-slate'>
            Rendimiento
          </p>
          <h2
            id='wallet-performance-title'
            className='mt-1 font-display text-sm font-extrabold uppercase tracking-brutal text-white'
          >
            Actividad
          </h2>
        </div>
        <span className='ml-auto inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm border border-obsidian-border bg-obsidian-surface/50 px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-brutal text-metallic-titanium'>
          <Activity size={11} aria-hidden='true' />
          7 días
        </span>
      </div>

      <div className='mt-5'>
        <p className='font-mono text-[9px] font-bold uppercase tracking-brutal text-metallic-slate'>
          Flujo neto
        </p>
        <div className='mt-1 flex items-end gap-2'>
          <span className={`font-mono text-2xl font-black leading-none tracking-tight tabular-nums ${netTone}`}>
            {formatSignedMoney(net)}
          </span>
          <NetIcon size={15} className={`mb-0.5 ${netTone}`} aria-hidden='true' />
        </div>
      </div>

      <div
        role='list'
        aria-label='Flujo neto diario de los últimos siete días'
        className='mt-5 flex h-28 items-end gap-1.5'
      >
        {activity.map((point) => {
          const magnitude = Math.abs(point.net);
          const height =
            magnitude === 0 ? 2 : Math.max(6, Math.round((magnitude / maxMagnitude) * 100));
          const barTone =
            point.net > 0
              ? 'bg-gradient-to-t from-odds-up/30 to-odds-up'
              : point.net < 0
                ? 'bg-gradient-to-t from-odds-down/25 to-odds-down'
                : 'bg-metallic-slate/40';

          return (
            <div
              key={point.date}
              role='listitem'
              aria-label={`${point.weekdayLabel} ${point.dayLabel}: ${formatSignedMoney(point.net)}`}
              className='flex h-full flex-1 flex-col items-center gap-2'
            >
              <div className='flex w-full flex-1 items-end border-b border-obsidian-border/50'>
                <div
                  aria-hidden='true'
                  title={`${point.weekdayLabel} ${point.dayLabel}: ${formatSignedMoney(point.net)}`}
                  className={`w-full rounded-t-[2px] ${barTone}`}
                  style={{ height: `${height}%` }}
                />
              </div>
              <span className='font-mono text-[8px] font-bold uppercase tracking-wide text-metallic-slate'>
                {point.weekdayLabel}
              </span>
            </div>
          );
        })}
      </div>

      <div className='mt-auto border-t border-obsidian-border/60 pt-4'>
        <div className='flex items-center justify-between font-mono text-[9px] font-bold uppercase tracking-brutal'>
          <span className='text-metallic-slate'>Tasa de acierto</span>
          <span className='text-white'>{formatWinRate(winRate)}</span>
        </div>
        <div className='mt-2 h-1 overflow-hidden rounded-full bg-obsidian-elevated'>
          <div
            className='h-full rounded-full bg-gradient-to-r from-gold/60 to-gold'
            style={{ width: `${Math.round(winRate * 100)}%` }}
          />
        </div>
        <p className='mt-2 font-mono text-[9px] uppercase tracking-wide text-metallic-slate'>
          {settledCount > 0
            ? `${settledCount} apuestas liquidadas`
            : 'Sin apuestas liquidadas aún'}
        </p>
      </div>
    </section>
  );
}
