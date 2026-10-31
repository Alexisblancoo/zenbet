import { ArrowUpRight } from 'lucide-react';

import {
  SPORTSBOOK_SPORTS,
  type SportsbookSportDefinition,
  type SportsbookSportId,
} from '@/domain/sportsbook';

import { SPORT_CLASSICAL_ART, SPORT_ICONS } from './sportVisuals';

export interface TrendingSportsActivity {
  readonly eventCount: number;
  readonly liveCount: number;
  readonly marketCount: number;
  readonly openMarketCount: number;
  readonly isLoading: boolean;
}

export interface SportsBentoGridProps {
  readonly activeSport: SportsbookSportId;
  readonly onSelectSport: (sport: SportsbookSportId) => void;
  readonly mmaStats: TrendingSportsActivity;
  readonly footballStats?: TrendingSportsActivity;
  readonly className?: string;
}

interface SportActivity {
  readonly label: string;
  readonly detail: string;
  readonly isLive: boolean;
}

function activityFor(
  sport: SportsbookSportDefinition,
  stats: TrendingSportsActivity,
  footballStats?: TrendingSportsActivity,
): SportActivity {
  if (sport.id === 'soccer' && footballStats) {
    if (footballStats.isLoading && footballStats.eventCount === 0) {
      return {
        label: 'Cargando actividad',
        detail: 'Sincronizando partidos',
        isLive: false,
      };
    }

    if (footballStats.liveCount > 0) {
      return {
        label: `${footballStats.liveCount} en vivo`,
        detail:
          footballStats.openMarketCount > 0
            ? `${footballStats.openMarketCount} mercados abiertos`
            : 'Mercados en actualización',
        isLive: true,
      };
    }

    if (footballStats.eventCount > 0) {
      return {
        label: `${footballStats.eventCount} partidos`,
        detail:
          footballStats.marketCount === 0
            ? 'Mercados en preparación'
            : footballStats.openMarketCount > 0
              ? `${footballStats.openMarketCount} mercados abiertos`
              : 'Mercados cerrados',
        isLive: false,
      };
    }

    return {
      label: 'Sin partidos',
      detail: 'Nueva jornada pronto',
      isLive: false,
    };
  }

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
  footballStats?: TrendingSportsActivity,
): string {
  if (activity.isLive) return 'En vivo';
  if (sport.id === 'mma') {
    if (stats.eventCount === 0) return 'Sin eventos';
    if (stats.openMarketCount === 0) return 'Cerrado';
    return 'Abierto';
  }
  if (sport.id === 'soccer' && footballStats) {
    if (footballStats.eventCount === 0) return 'Sin eventos';
    if (footballStats.openMarketCount === 0) return 'Cerrado';
    return 'Abierto';
  }
  return 'Pronto';
}

/**
 * Bento Grid editorial de disciplinas de ZenBet.
 *
 * Fusión de interfaces de vanguardia (Hermes Agent / Cyberpunk Shibuya) con una
 * dirección de arte basada en pinturas al óleo de la Antigüedad Clásica (Grecia y Roma),
 * tratadas con duotono y líneas de barrido en Shibuya Lime (#D4FF3F), alto contraste
 * cinematográfico y capas ópticas de legibilidad industrial.
 */
export default function SportsBentoGrid({
  activeSport,
  onSelectSport,
  mmaStats,
  footballStats,
  className = '',
}: SportsBentoGridProps) {
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
      aria-labelledby='sports-bento-title'
      className={`rounded-2xl border border-white/[0.06] bg-[#0A0A0A]/85 p-3.5 backdrop-blur-xl sm:p-4 ${className}`}
    >
      {/* Cabecera editorial con estética Hermes / Shibuya */}
      <div className='flex flex-wrap items-end justify-between gap-2.5 pb-3 border-b border-white/[0.05]'>
        <div className='min-w-0'>
          <div className='flex items-center gap-2'>
            <span className='font-mono text-[9px] font-bold tracking-widest uppercase text-[#D4FF3F]'>
              / DISCIPLINA & AGON
            </span>
            <span className='font-mono text-[8px] font-semibold tracking-wider text-[#FF3F7F] border border-[#FF3F7F]/30 bg-[#FF3F7F]/10 px-1.5 py-0.5 rounded'>
              SYS // #FF3F7F
            </span>
          </div>
          <h2
            id='sports-bento-title'
            className='mt-1 font-display text-[15px] font-bold uppercase tracking-tight text-white sm:text-base'
          >
            Deportes en tendencia
          </h2>
          <p className='mt-0.5 max-w-xl text-[10px] leading-relaxed text-neutral-400'>
            Selecciona una disciplina para acceder a mercados en vivo y carteleras activas.
          </p>
        </div>

        <div className='flex items-center gap-2'>
          <span
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-[8px] font-bold uppercase tracking-wider backdrop-blur-md transition-all duration-300 ${
              mmaStats.liveCount > 0
                ? 'border-[#FF3F7F]/45 bg-[#FF3F7F]/[0.10] text-[#FF3F7F] shadow-[0_0_15px_rgba(255,63,127,0.22)]'
                : 'border-white/[0.08] bg-white/[0.03] text-neutral-400'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                mmaStats.liveCount > 0
                  ? 'bg-[#FF3F7F] motion-safe:animate-pulse shadow-[0_0_6px_#FF3F7F]'
                  : 'bg-neutral-500'
              }`}
              aria-hidden='true'
            />
            {liveLabel}
          </span>
        </div>
      </div>

      {/* Grid Bento responsivo con lienzos de la Antigüedad Clásica */}
      <div className='mt-3.5 grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3'>
        {SPORTSBOOK_SPORTS.map((sport) => {
          const active = sport.id === activeSport;
          const activity = activityFor(sport, mmaStats, footballStats);
          const status = sportStatusLabel(sport, activity, mmaStats, footballStats);
          const Icon = SPORT_ICONS[sport.id];
          const art = SPORT_CLASSICAL_ART[sport.id];

          return (
            <button
              key={sport.id}
              type='button'
              onClick={() => onSelectSport(sport.id)}
              aria-pressed={active}
              aria-label={`${sport.label} (${sport.shortLabel}): ${status}. ${sport.description} ${activity.label}${
                activity.detail ? `, ${activity.detail}` : ''
              }. ${sport.available ? 'Ver carteleras' : 'Abrir aviso de próximamente'}`}
              title={`${sport.label} — ${art.title} (${art.subtitle})`}
              data-sport={sport.id}
              data-active={active}
              data-available={sport.available}
              className={`group relative flex min-h-[148px] sm:min-h-[156px] min-w-0 flex-col justify-between overflow-hidden rounded-xl border p-3.5 sm:p-4 text-left transition-[border-color,box-shadow,transform] duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4FF3F] motion-reduce:transition-none ${
                active
                  ? 'border-[#D4FF3F] bg-[#0D0D0D] shadow-[0_0_24px_rgba(212,255,63,0.18),inset_0_0_0_1px_rgba(255,63,127,0.30)] z-10'
                  : sport.available
                    ? 'border-neutral-800 bg-[#0D0D0D] hover:border-[#FF3F7F]/60 hover:shadow-[0_0_24px_rgba(255,63,127,0.18)] hover:-translate-y-0.5'
                    : 'border-neutral-800/80 bg-[#0D0D0D] hover:border-neutral-700'
              } ${sport.id === 'mma' ? 'col-span-2' : 'col-span-1'}`}
            >
              {/* 1. Puntillismo Hermes: semitono monocromo en Shibuya Lime (#D4FF3F) sobre negro */}
              <div
                aria-hidden='true'
                className={`zb-stipple ${sport.available || active ? '' : 'opacity-60'}`}
              >
                <img
                  src={art.image}
                  alt=''
                  loading='lazy'
                  decoding='async'
                  className='zb-stipple__img'
                  style={{ objectPosition: art.focus }}
                />
              </div>

              {/* 4. Capas de legibilidad (Gradientes de contraste superior e inferior) */}
              <div
                aria-hidden='true'
                className='pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-[#121212]/90 via-[#121212]/45 to-transparent'
              />
              <div
                aria-hidden='true'
                className='pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-[#121212]/70 via-[#121212]/30 to-transparent'
              />

              {/* 5. Resplandor dual Shibuya Lime (#D4FF3F) + Crimson Neon (#FF3F7F) */}
              <div
                aria-hidden='true'
                className={`pointer-events-none absolute inset-0 transition-opacity duration-500 ${
                  active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}
                style={{
                  background: active
                    ? 'radial-gradient(ellipse at 86% 14%, rgba(212, 255, 63, 0.16) 0%, transparent 48%), radial-gradient(ellipse at 16% 86%, rgba(255, 63, 127, 0.12) 0%, transparent 44%)'
                    : 'radial-gradient(ellipse at 86% 14%, rgba(255, 63, 127, 0.14) 0%, transparent 50%)',
                }}
              />

              {/* Fila superior: Icono de disciplina de línea fina + Estado */}
              <div className='relative z-10 flex items-start justify-between gap-2'>
                <div className='flex items-center gap-2'>
                  <span
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border backdrop-blur-md transition-all duration-200 ${
                      active
                        ? 'border-[#D4FF3F]/60 bg-[#D4FF3F]/15 text-[#D4FF3F] shadow-[0_0_12px_rgba(212,255,63,0.22)]'
                        : activity.isLive
                          ? 'border-[#FF3F7F]/60 bg-[#FF3F7F]/15 text-[#FF3F7F] shadow-[0_0_12px_rgba(255,63,127,0.25)]'
                          : sport.available
                            ? 'border-neutral-700 bg-neutral-900/80 text-white group-hover:border-[#FF3F7F]/50 group-hover:bg-[#FF3F7F]/10 group-hover:text-[#FF3F7F]'
                            : 'border-neutral-800 bg-neutral-950/80 text-neutral-400 group-hover:border-neutral-700'
                    }`}
                  >
                    <Icon size={16} strokeWidth={1.75} aria-hidden='true' />
                  </span>
                </div>

                {/* Badge de disponibilidad con acento Crimson en eventos en vivo */}
                <span
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-wider backdrop-blur-md transition-all duration-200 ${
                    activity.isLive
                      ? 'border-[#FF3F7F]/50 bg-[#FF3F7F]/15 text-[#FF3F7F] shadow-[0_0_10px_rgba(255,63,127,0.25)]'
                      : active
                        ? 'border-[#D4FF3F]/40 bg-[#D4FF3F]/10 text-[#D4FF3F]'
                        : sport.available
                          ? 'border-neutral-700/80 bg-neutral-900/80 text-neutral-300 group-hover:border-[#FF3F7F]/40 group-hover:text-[#F3E5AB]'
                          : 'border-neutral-800/80 bg-neutral-950/70 text-neutral-400'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      activity.isLive
                        ? 'bg-[#FF3F7F] motion-safe:animate-pulse shadow-[0_0_6px_#FF3F7F]'
                        : active
                          ? 'bg-[#D4FF3F]'
                          : sport.available
                            ? 'bg-[#D4FF3F]/60'
                            : 'bg-neutral-600'
                    }`}
                    aria-hidden='true'
                  />
                  {status}
                </span>
              </div>

              {/* Fila inferior: Tipografía y contadores de actividad */}
              <div className='relative z-10 mt-3 flex min-w-0 flex-1 flex-col justify-end'>
                <div className='min-w-0'>
                  {/* Cartela de la obra (ver .zb-plaque en design-system.css) */}
                  <span className='zb-plaque align-top'>
                    {art.title} · {art.epoch}
                  </span>

                  {/* Nombre del deporte: crema #F3E5AB; lima #D4FF3F en activo; crimson en live hover */}
                  <span
                    className={`mt-1.5 block break-words font-serif [text-shadow:0_1px_6px_rgba(0,0,0,0.85)] text-[14px] font-bold uppercase leading-tight tracking-tight transition-colors duration-200 sm:text-[15px] ${
                      active
                        ? 'text-[#D4FF3F]'
                        : activity.isLive
                          ? 'text-[#F3E5AB] group-hover:text-[#FF3F7F]'
                          : 'text-[#F3E5AB] group-hover:text-[#D4FF3F]'
                    }`}
                  >
                    {sport.label}
                  </span>
                </div>

                {/* Separador industrial y actividad */}
                <div className='mt-2.5 flex min-w-0 items-center justify-between gap-2 border-t border-white/[0.07] pt-2'>
                  <span className='flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 font-mono text-[8px] uppercase leading-relaxed tracking-wide'>
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        activity.isLive
                          ? 'bg-[#FF3F7F] motion-safe:animate-pulse shadow-[0_0_6px_#FF3F7F]'
                          : active
                            ? 'bg-[#D4FF3F]'
                            : sport.available
                              ? 'bg-[#D4FF3F]/60'
                              : 'bg-neutral-600'
                      }`}
                      aria-hidden='true'
                    />
                    <span
                      className={
                        activity.isLive
                          ? 'font-bold text-[#FF3F7F]'
                          : active
                            ? 'font-semibold text-[#D4FF3F]'
                            : 'text-neutral-300'
                      }
                    >
                      {activity.label}
                    </span>
                    {activity.detail && (
                      <>
                        <span className='text-white/20' aria-hidden='true'>
                          /
                        </span>
                        <span className='truncate text-neutral-400'>{activity.detail}</span>
                      </>
                    )}
                  </span>

                  <ArrowUpRight
                    size={13}
                    className={`shrink-0 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transition-none ${
                      active
                        ? 'text-[#D4FF3F]'
                        : activity.isLive
                          ? 'text-[#FF3F7F]'
                          : 'text-neutral-400 group-hover:text-[#FF3F7F]'
                    }`}
                    aria-hidden='true'
                  />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
