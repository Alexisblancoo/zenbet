import { CalendarClock, MapPin, ShieldCheck, Swords } from 'lucide-react';

import {
  formatFightDay,
  formatWeightDivision,
  type UfcEvent,
} from '@/domain/ufc';

import FighterAvatar from './FighterAvatar';

interface FightHeaderProps {
  readonly event: UfcEvent;
  readonly headingId: string;
  readonly selectedInEvent: number;
  readonly selectionCount: number;
}

function billingCode(billing: string): string {
  if (billing === 'main') return 'MAIN';
  if (billing === 'prelims') return 'PRE';
  if (billing === 'early_prelims') return 'EARLY';
  return 'CARD';
}

/**
 * Cabecera de combate. Mantiene el orden editorial de la cartelera y añade los
 * retratos de ambas esquinas con el mismo tratamiento Shibuya del resto del
 * módulo.
 */
export default function FightHeader({
  event,
  headingId,
  selectedInEvent,
  selectionCount,
}: FightHeaderProps) {
  const { bout } = event;

  return (
    <header className='relative flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-4'>
      <div className='flex min-w-0 items-start gap-2.5'>
        <div className='hidden shrink-0 flex-col items-center border border-white/[0.07] bg-white/[0.02] px-1.5 py-1 sm:flex'>
          <span className='font-mono text-[8px] font-bold uppercase tracking-wide text-metallic-slate'>
            {billingCode(bout.billing)}
          </span>
          <span className='mt-0.5 font-odds text-sm font-bold tabular-nums text-white'>
            {String(bout.billingOrder).padStart(2, '0')}
          </span>
        </div>

        <div className='min-w-0'>
          <div className='flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[9px] uppercase tracking-wide'>
            <span className='font-bold text-crimson'>{event.competition ?? 'UFC'}</span>
            <span className='h-px w-3 bg-white/15' aria-hidden='true' />
            <span className='text-metallic-slate'>{bout.billingLabel}</span>
            {bout.isTitleFight && (
              <span className='inline-flex items-center gap-1 border border-crimson/35 bg-crimson/[0.08] px-1 py-0.5 text-crimson'>
                <ShieldCheck size={8} aria-hidden='true' />
                Título
              </span>
            )}
          </div>

          <div className='mt-1.5 flex min-w-0 items-center gap-2 sm:gap-2.5'>
            <FighterAvatar fighter={bout.red} corner='red' size='sm' />
            <h3
              id={headingId}
              className='min-w-0 break-words font-display text-[14px] font-bold uppercase leading-tight tracking-tight text-white sm:text-[14px] min-[1400px]:text-[15px]'
            >
              <span>{bout.red.name}</span>{' '}
              <span className='mx-1.5 font-mono text-[10px] font-bold text-crimson'>vs</span>{' '}
              <span>{bout.blue.name}</span>
            </h3>
            <FighterAvatar fighter={bout.blue} corner='blue' size='sm' />
          </div>

          <div className='mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[9px] uppercase tracking-wide text-metallic-titanium'>
            <span className='inline-flex items-center gap-1'>
              <Swords size={9} className='text-crimson/80' aria-hidden='true' />
              {formatWeightDivision(bout)}
            </span>
            <span>{bout.scheduledRounds} asaltos</span>
            <span className='inline-flex items-center gap-1'>
              <CalendarClock size={9} aria-hidden='true' />
              {formatFightDay(event.startTime)}
            </span>
            <span className='hidden min-w-0 items-center gap-1 md:inline-flex'>
              <MapPin size={9} aria-hidden='true' />
              <span className='truncate'>{bout.venue}</span>
            </span>
          </div>
        </div>
      </div>

      <div className='flex shrink-0 items-center justify-between gap-3 border-t border-white/[0.055] pt-2 font-mono text-[9px] uppercase tracking-wide text-metallic-titanium sm:flex-col sm:items-end sm:border-t-0 sm:pt-0'>
        <span className='inline-flex items-center gap-1.5'>
          <span
            className={`h-1.5 w-1.5 ${selectedInEvent > 0 ? 'bg-money' : 'bg-metallic-slate'}`}
            aria-hidden='true'
          />
          <span className={selectedInEvent > 0 ? 'text-money' : undefined}>
            {selectedInEvent > 0 ? `${selectedInEvent} en boleto` : 'Sin selección'}
          </span>
        </span>
        <span className='text-metallic-slate'>
          {event.markets.length} MER · {selectionCount} SEL
        </span>
      </div>
    </header>
  );
}
