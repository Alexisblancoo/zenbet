import { ArrowLeft, CalendarClock } from 'lucide-react';

import type { SportsbookSportDefinition } from '@/domain/sportsbook';

import { SPORT_ICONS } from './sportVisuals';

interface SportComingSoonProps {
  readonly sport: SportsbookSportDefinition;
  readonly onBack: () => void;
}

/**
 * Estado de filtro para disciplinas que todavía no tienen carteleras en la
 * API. Mantiene la selección visible y ofrece una salida inmediata a UFC/MMA.
 */
export default function SportComingSoon({ sport, onBack }: SportComingSoonProps) {
  const Icon = SPORT_ICONS[sport.id];

  return (
    <section
      aria-labelledby='sport-coming-soon-title'
      aria-live='polite'
      data-sport={sport.id}
      className='shibuya-glass relative overflow-hidden rounded-2xl p-5 sm:p-6'
    >
      <div
        aria-hidden='true'
        className='pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_20%,rgb(212_255_63_/_0.08),transparent_38%)]'
      />
      <Icon
        aria-hidden='true'
        strokeWidth={1}
        className='pointer-events-none absolute -bottom-10 -right-6 h-44 w-44 -rotate-12 text-white/[0.035]'
      />

      <div className='relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between'>
        <div className='flex min-w-0 items-start gap-3'>
          <span className='grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-lime-400/30 bg-lime-400/[0.07] text-lime-400'>
            <Icon size={22} strokeWidth={1.7} aria-hidden='true' />
          </span>
          <div className='min-w-0'>
            <span className='shibuya-kicker text-lime-400'>/ Próximamente</span>
            <h2
              id='sport-coming-soon-title'
              className='mt-1 font-display text-lg font-bold uppercase tracking-tight text-white'
            >
              {sport.label} llega pronto
            </h2>
            <p className='mt-1 max-w-2xl text-[11px] leading-relaxed text-metallic-titanium'>
              Estamos integrando mercados de {sport.label.toLowerCase()} en la plataforma. Aún no
              hay carteleras ni cuotas publicadas para esta disciplina. Mientras tanto, puedes
              seguir explorando la cartelera de UFC/MMA.
            </p>
            <div className='mt-3 flex flex-wrap items-center gap-2 font-mono text-[8px] uppercase tracking-wide'>
              <span className='inline-flex items-center gap-1 border border-white/[0.08] bg-white/[0.025] px-1.5 py-0.5 text-metallic-slate'>
                <CalendarClock size={9} aria-hidden='true' />
                Mercado en preparación
              </span>
              <span className='border border-white/[0.08] bg-white/[0.025] px-1.5 py-0.5 text-metallic-slate'>
                Sin cuotas publicadas
              </span>
            </div>
          </div>
        </div>

        <button
          type='button'
          onClick={onBack}
          className='inline-flex shrink-0 items-center justify-center gap-2 border border-lime-400/45 bg-lime-400/[0.08] px-3 py-2 font-display text-[10px] font-bold uppercase tracking-wide text-lime-400 transition-colors duration-150 hover:border-lime-400/70 hover:bg-lime-400/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400/70'
        >
          <ArrowLeft size={12} aria-hidden='true' />
          Ver UFC/MMA
        </button>
      </div>
    </section>
  );
}
