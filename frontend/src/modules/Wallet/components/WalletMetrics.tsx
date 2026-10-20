import { Clock3, Target, Ticket, TrendingDown, TrendingUp } from 'lucide-react';

import {
  formatInteger,
  formatSignedMoney,
  formatWalletMoney,
  formatWinRate,
  type WalletMetrics as WalletMetricsValue,
} from '@/domain/wallet';

interface WalletMetricsProps {
  readonly metrics: WalletMetricsValue;
  readonly className?: string;
}

export function WalletMetrics({ metrics, className = '' }: WalletMetricsProps) {
  const netTone =
    metrics.netProfit > 0
      ? 'text-odds-up'
      : metrics.netProfit < 0
        ? 'text-odds-down'
        : 'text-white';
  const NetIcon = metrics.netProfit < 0 ? TrendingDown : TrendingUp;

  const tiles = [
    {
      label: 'En juego',
      value: formatWalletMoney(metrics.pendingStake),
      detail: `${metrics.openBets} ${metrics.openBets === 1 ? 'apuesta abierta' : 'apuestas abiertas'}`,
      icon: Clock3,
      iconTone: 'border-odds-live/25 bg-odds-live/5 text-odds-live',
      valueTone: 'text-white',
    },
    {
      label: 'Ganancia neta',
      value: formatSignedMoney(metrics.netProfit),
      detail: metrics.settledCount > 0 ? 'Apuestas liquidadas' : 'Aún sin liquidaciones',
      icon: NetIcon,
      iconTone:
        metrics.netProfit < 0
          ? 'border-odds-down/25 bg-odds-down/5 text-odds-down'
          : 'border-odds-up/25 bg-odds-up/5 text-odds-up',
      valueTone: netTone,
    },
    {
      label: 'Tasa de acierto',
      value: formatWinRate(metrics.winRate),
      detail: `${metrics.wonCount}G · ${metrics.lostCount}P`,
      icon: Target,
      iconTone: 'border-gold/25 bg-gold/5 text-gold-imperial',
      valueTone: 'text-white',
    },
    {
      label: 'Apuestas',
      value: formatInteger(metrics.totalBets),
      detail:
        metrics.totalBets > 0
          ? `Cuota media ${metrics.averageOdds.toFixed(2)}`
          : 'Sin actividad todavía',
      icon: Ticket,
      iconTone: 'border-metallic-slate/25 bg-metallic-slate/5 text-metallic-platinum',
      valueTone: 'text-white',
    },
  ] as const;

  const borderClasses = [
    'border-b border-r md:border-b-0',
    'border-b md:border-b-0 md:border-r',
    'border-r md:border-r',
    '',
  ] as const;

  return (
    <section aria-label='Métricas de la billetera' className={`glass-panel overflow-hidden ${className}`}>
      <dl className='grid grid-cols-2 md:grid-cols-4'>
        {tiles.map((tile, index) => {
          const Icon = tile.icon;

          return (
            <div
              key={tile.label}
              className={`border-obsidian-border/60 p-4 sm:p-5 ${borderClasses[index]}`}
            >
              <div className='flex items-start justify-between gap-2'>
                <dt className='font-mono text-[9px] font-bold uppercase tracking-brutal text-metallic-slate'>
                  {tile.label}
                </dt>
                <span
                  aria-hidden='true'
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-sm border ${tile.iconTone}`}
                >
                  <Icon size={12} strokeWidth={1.9} />
                </span>
              </div>
              <dd className='mt-2'>
                <span
                  className={`block font-mono text-lg font-bold leading-none tracking-tight tabular-nums sm:text-xl ${tile.valueTone}`}
                >
                  {tile.value}
                </span>
                <span className='mt-1.5 block text-[10px] leading-relaxed text-metallic-slate'>
                  {tile.detail}
                </span>
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
