import { ArrowUpRight } from 'lucide-react';

import {
  SPORTSBOOK_SPORTS,
  type SportsbookSportDefinition,
  type SportsbookSportId,
} from '@/domain/sportsbook';

import { SPORT_ICONS } from './sportVisuals';

export interface TrendingSportsActivity {
  readonly eventCount: number;
  readonly liveCount: number;
  readonly marketCount: number;
  readonly openMarketCount: number;
  readonly isLoading: boolean;
}

interface TrendingSportsGridProps {
  readonly activeSport: SportsbookSportId;
  readonly onSelectSport: (sport: SportsbookSportId) => void;
  readonly mmaStats: TrendingSportsActivity;
}

interface SportActivity {
  readonly label: string;
  readonly detail: string;
  readonly isLive: boolean;
}

function activityFor(
  sport: SportsbookSportDefinition,
  stats: TrendingSportsActivity,
): SportActivity {
  if (sport.id !== 'mma') {
    return {
      label: 'Sin cuotas',
      detail: '',
      isLive: false,
    };
  }

  if (stats.isLoading && stats.eventCount === 0) {
    return {
      label: 'Cargando actividad',
      detail: 'Sincronizando mercados',
      isLive: false,
    };
  }

  if (stats.liveCount > 0) {
    return {
      label: `${stats.liveCount} en vivo`,
      detail:
        stats.openMarketCount > 0
          ? `${stats.openMarketCount} mercados abiertos`
          : 'Mercados en actualización',
      isLive: true,
    };
  }

  if (stats.eventCount > 0) {
    return {
      label: `${stats.eventCount} combates`,
      detail:
        stats.marketCount === 0
          ? 'Mercados en preparación'
          : stats.openMarketCount > 0
            ? `${stats.openMarketCount} mercados abiertos`
            : 'Mercados cerrados',
      isLive: false,
    };
  }

  return {
    label: 'Sin eventos',
    detail: 'Nueva cartelera pronto',
    isLive: false,
  };
}

function sportStatusLabel(
  sport: SportsbookSportDefinition,
  activity: SportActivity,
  stats: TrendingSportsActivity,
): string {
  if (activity.isLive) return 'En vivo';
  if (sport.id === 'mma') {
    if (stats.eventCount === 0) return 'Sin eventos';
    if (stats.openMarketCount === 0) return 'Cerrado';
    return 'Abierto';
  }
  return 'Pronto';
}

/**
 * Acceso editorial a las disciplinas del Sportsbook. La tarjeta de MMA se
 * alimenta del estado real de la cartelera; las disciplinas sin backend se
 * presentan como "Pronto" y nunca simulan actividad ni cuotas.
 */
export default function TrendingSportsGrid({
  activeSport,
  onSelectSport,
  mmaStats,
}: TrendingSportsGridProps) {
  const liveLabel =
    mmaStats.liveCount > 0
      ? `${mmaStats.liveCount} en vivo`
      : mmaStats.isLoading
        ? 'Sincronizando'
        : mmaStats.openMarketCount > 0
          ? 'Carteleras activas'
          : 'Sin mercados abiertos';

  return (
    <section
      aria-labelledby='trending-sports-title'
      className='rounded-2xl border border-white/[0.06] bg-[#0A0A0A]/80 p-3 sm:p-4'
    >
      <div className='flex flex-wrap items-end justify-between gap-2'>
        <div className='min-w-0'>
          <span className='shibuya-kicker text-lime-400'>/ Descubrir</span>
          <h2
            id='trending-sports-title'
            className='mt-1 font-display text-[15px] font-bold uppercase tracking-tight text-white sm:text-base'
          >
            Deportes en tendencia
          </h2>
          <p className='mt-1 max-w-xl text-[10px] leading-relaxed text-metallic-slate'>
            Elige una disciplina y filtra la cartelera al instante.
          </p>
        </div>

        <span
          className={`inline-flex shrink-0 items-center gap-1.5 border px-2 py-1 font-mono text-[8px] font-bold uppercase tracking-wide ${
            mmaStats.liveCount > 0
              ? 'border-lime-400/35 bg-lime-400/[0.08] text-lime-400'
              : 'border-white/[0.08] bg-white/[0.025] text-metallic-titanium'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              mmaStats.liveCount > 0
                ? 'bg-lime-400 motion-safe:animate-pulse'
                : 'bg-metallic-slate'
            }`}
            aria-hidden='true'
          />
          {liveLabel}
        </span>
      </div>

      <div className='mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4'>
        {SPORTSBOOK_SPORTS.map((sport) => {
          const active = sport.id === activeSport;
          const activity = activityFor(sport, mmaStats);
          const status = sportStatusLabel(sport, activity, mmaStats);
          const Icon = SPORT_ICONS[sport.id];

          return (
            <button
              key={sport.id}
              type='button'
              onClick={() => onSelectSport(sport.id)}
              aria-pressed={active}
              aria-label={`${sport.label} (${sport.shortLabel}): ${status}. ${sport.description} ${activity.label}${
                activity.detail ? `, ${activity.detail}` : ''
              }. ${sport.available ? 'Ver carteleras' : 'Abrir aviso de próximamente'}`}
              title={sport.description}
              data-sport={sport.id}
              data-active={active}
              data-available={sport.available}
              className={`group relative flex min-h-[132px] min-w-0 flex-col overflow-hidden rounded-xl border p-3 text-left transition-[transform,border-color,background-color,box-shadow] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400/70 motion-reduce:transition-none ${
                active
                  ? 'border-lime-400/60 bg-[#0D0D0D] shadow-[inset_0_1px_0_rgb(255_255_255_/_0.06),0_0_32px_-20px_rgb(212_255_63_/_0.9)]'
                  : 'border-white/[0.07] bg-[#0D0D0D] hover:-translate-y-0.5 hover:border-lime-400/40 hover:bg-[#101010] motion-reduce:hover:translate-y-0'
              } ${sport.id === 'mma' ? 'col-span-2' : ''}`}
            >
              <span
                aria-hidden='true'
                className='pointer-events-none absolute inset-0'
                style={{
                  backgroundImage: sport.available
                    ? 'radial-gradient(circle at 84% 8%, rgba(212, 255, 63, 0.11), transparent 38%), linear-gradient(135deg, rgba(255, 255, 255, 0.035), transparent 52%)'
                    : 'radial-gradient(circle at 84% 8%, rgba(255, 255, 255, 0.055), transparent 38%), linear-gradient(135deg, rgba(255, 255, 255, 0.025), transparent 52%)',
                }}
              />
              <span
                aria-hidden='true'
                className='pointer-events-none absolute inset-0 opacity-[0.16]'
                style={{
                  backgroundImage:
                    'linear-gradient(to right, rgba(255, 255, 255, 0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.07) 1px, transparent 1px)',
                  backgroundSize: '22px 22px',
                }}
              />
              <Icon
                aria-hidden='true'
                strokeWidth={1.25}
                className='pointer-events-none absolute -bottom-5 -right-3 h-24 w-24 -rotate-12 text-white/[0.045] transition-transform duration-300 group-hover:scale-105 group-hover:text-lime-400/[0.07] motion-reduce:transition-none'
              />

              <span className='relative flex items-start justify-between gap-2'>
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-md border ${
                    active || sport.available
                      ? 'border-lime-400/30 bg-lime-400/[0.07] text-lime-400'
                      : 'border-white/10 bg-white/[0.025] text-metallic-slate'
                  }`}
                >
                  <Icon size={15} strokeWidth={2} aria-hidden='true' />
                </span>

                <span
                  className={`inline-flex shrink-0 items-center gap-1 border px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-wide ${
                    activity.isLive
                      ? 'border-lime-400/35 bg-lime-400/[0.08] text-lime-400'
                      : sport.available
                        ? 'border-white/10 bg-white/[0.025] text-metallic-titanium'
                        : 'border-white/[0.07] bg-white/[0.02] text-metallic-slate'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      activity.isLive
                        ? 'bg-lime-400 motion-safe:animate-pulse'
                        : sport.available
                          ? 'bg-lime-400/55'
                          : 'bg-metallic-slate'
                    }`}
                    aria-hidden='true'
                  />
                  {status}
                </span>
              </span>

              <span className='relative mt-3 flex min-w-0 flex-1 flex-col justify-end'>
                <span className='block break-words font-display text-[12px] font-bold uppercase leading-tight tracking-tight text-white sm:text-[13px]'>
                  {sport.label}
                </span>
                <span className='mt-0.5 block line-clamp-1 font-mono text-[8px] uppercase tracking-wide text-metallic-slate'>
                  {sport.kicker}
                </span>
                <span className='mt-2 flex min-w-0 items-end justify-between gap-2 border-t border-white/[0.06] pt-2'>
                  <span className='flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 font-mono text-[8px] uppercase leading-relaxed tracking-wide'>
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        activity.isLive
                          ? 'bg-lime-400 motion-safe:animate-pulse'
                          : sport.available
                            ? 'bg-lime-400/55'
                            : 'bg-metallic-slate'
                      }`}
                      aria-hidden='true'
                    />
                    <span className={activity.isLive ? 'text-lime-400' : 'text-metallic-titanium'}>
                      {activity.label}
                    </span>
                    {activity.detail && (
                      <>
                        <span className='text-white/20' aria-hidden='true'>
                          /
                        </span>
                        <span className='min-w-0 text-metallic-slate'>{activity.detail}</span>
                      </>
                    )}
                  </span>
                  <ArrowUpRight
                    size={13}
                    className={`shrink-0 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transition-none ${
                      active ? 'text-lime-400' : 'text-metallic-slate group-hover:text-lime-400'
                    }`}
                    aria-hidden='true'
                  />
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
