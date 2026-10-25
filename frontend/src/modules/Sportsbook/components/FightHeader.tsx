import { CalendarClock, MapPin, ShieldCheck } from 'lucide-react';

import {
  formatFightDay,
  formatRank,
  formatWeightDivision,
  type UfcEvent,
  type UfcFighter,
} from '@/domain/ufc';

import FighterAvatar from './FighterAvatar';

interface FightHeaderProps {
  readonly event: UfcEvent;
  readonly headingId: string;
  readonly selectedInEvent: number;
  readonly selectionCount: number;
}

type Corner = 'red' | 'blue';

function billingCode(billing: string): string {
  if (billing === 'main') return 'MAIN';
  if (billing === 'prelims') return 'PRE';
  if (billing === 'early_prelims') return 'EARLY';
  return 'CARD';
}

function ArenaCorner({
  fighter,
  corner,
}: {
  readonly fighter: UfcFighter;
  readonly corner: Corner;
}) {
  const isRed = corner === 'red';

  return (
    <div
      className={`flex min-w-0 items-center gap-2.5 ${
        isRed ? '' : 'flex-row-reverse text-right'
      }`}
    >
      <FighterAvatar fighter={fighter} corner={corner} size='md' className='max-sm:hidden' />
      <div className='min-w-0'>
        <span
          className={`font-mono text-[8px] font-bold uppercase tracking-ultra ${
            isRed ? 'text-crimson' : 'text-electric-soft'
          }`}
        >
          {isRed ? 'Esquina roja' : 'Esquina azul'}
        </span>
        <p className='mt-0.5 break-words font-display text-[11px] font-bold uppercase leading-[1.05] tracking-tight text-white sm:text-[13px]'>
          {fighter.name}
        </p>
        <p className='mt-1 flex flex-wrap items-center gap-x-1.5 font-mono text-[8px] uppercase tracking-wide text-metallic-slate'>
          <span className='text-metallic-titanium'>{fighter.record}</span>
          <span className='h-2 w-px bg-white/10' aria-hidden='true' />
          <span>{formatRank(fighter)}</span>
          {fighter.countryCode ? (
            <>
              <span className='h-2 w-px bg-white/10' aria-hidden='true' />
              <span>{fighter.countryCode}</span>
            </>
          ) : null}
        </p>
      </div>
    </div>
  );
}

/**
 * Cabecera de combate en formato arena/versus. Las dos esquinas comparten
 * jerarquía y el centro concentra la lectura rápida del combate; la matriz de
 * mercados queda inmediatamente debajo sin competir con la identidad.
 */
export default function FightHeader({
  event,
  headingId,
  selectedInEvent,
  selectionCount,
}: FightHeaderProps) {
  const { bout } = event;

  return (
    <header className='relative overflow-hidden'>
      <div
        aria-hidden='true'
        className='pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(239,68,68,0.055),transparent_38%,transparent_62%,rgba(56,189,248,0.045))]'
      />

      <div className='relative flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.055] px-3 py-2 sm:px-4'>
        <div className='flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[8px] uppercase tracking-wide'>
          <span className='border border-white/[0.08] bg-white/[0.025] px-1.5 py-0.5 font-bold text-metallic-titanium'>
            {billingCode(bout.billing)} {String(bout.billingOrder).padStart(2, '0')}
          </span>
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

        <div className='flex shrink-0 items-center gap-2 font-mono text-[8px] uppercase tracking-wide'>
          <span
            className={`inline-flex items-center gap-1.5 ${
              selectedInEvent > 0 ? 'text-money' : 'text-metallic-slate'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 ${selectedInEvent > 0 ? 'bg-money' : 'bg-metallic-slate'}`}
              aria-hidden='true'
            />
            {selectedInEvent > 0 ? `${selectedInEvent} en boleto` : 'Sin selección'}
          </span>
          <span className='hidden h-3 w-px bg-white/10 sm:block' aria-hidden='true' />
          <span className='hidden text-metallic-slate sm:inline'>
            {event.markets.length} MER · {selectionCount} SEL
          </span>
        </div>
      </div>

      <div className='relative grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-3 py-3 sm:gap-4 sm:px-4'>
        <ArenaCorner fighter={bout.red} corner='red' />

        <div className='flex min-w-[44px] flex-col items-center gap-1 text-center'>
          <span className='grid h-8 w-8 place-items-center border border-crimson/35 bg-crimson/[0.08] font-odds text-[10px] font-bold tracking-wide text-crimson shadow-[0_0_22px_-12px_rgb(239_68_68_/_0.8)] sm:h-9 sm:w-9 sm:text-[11px]'>
            VS
          </span>
          <span className='font-mono text-[8px] font-bold uppercase leading-tight tracking-wide text-metallic-titanium'>
            {formatWeightDivision(bout)}
          </span>
          <span className='font-mono text-[8px] uppercase tracking-wide text-metallic-slate'>
            {bout.scheduledRounds} RDS
          </span>
        </div>

        <ArenaCorner fighter={bout.blue} corner='blue' />
      </div>

      <div className='relative flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-white/[0.055] px-3 py-1.5 font-mono text-[8px] uppercase tracking-wide text-metallic-slate sm:px-4'>
        <span className='inline-flex min-w-0 items-center gap-1.5'>
          <MapPin size={9} className='shrink-0 text-crimson/70' aria-hidden='true' />
          <span className='truncate'>{bout.venue || 'Sede por confirmar'}</span>
        </span>
        <span className='inline-flex items-center gap-1.5'>
          <CalendarClock size={9} aria-hidden='true' />
          {formatFightDay(event.startTime)}
        </span>
      </div>

      <h3 id={headingId} className='sr-only'>
        {bout.red.name} vs {bout.blue.name}
      </h3>
    </header>
  );
}
