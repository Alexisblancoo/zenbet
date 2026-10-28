import { memo } from 'react';

import Countdown from '@/components/Countdown';

import { animalForPlace, AnimalInk } from './placeAnimals';

interface SportsbookHeroBannerProps {
  readonly activeSport?: string;
  readonly liveCount?: number;
  readonly totalEvents?: number;
  readonly openMarketCount?: number;
  /** Inicio real del próximo evento (ISO-8601) según la API. */
  readonly nextStartTime?: string | null;
  /** Sede real del próximo evento; define el animal de la ilustración. */
  readonly nextPlace?: string | null;
  readonly nextCountryCode?: string | null;
  /** Estado real del canal en vivo (SignalR). */
  readonly connectionLabel?: string;
  readonly isLoading?: boolean;
}

/**
 * Cabecera «Hermes ink». Todas las cifras llegan de la API o del canal en vivo;
 * mientras no hay dato se muestra «—», nunca un número de ejemplo.
 */
function SportsbookHeroBanner({
  activeSport = 'mma',
  liveCount = 0,
  totalEvents = 0,
  openMarketCount = 0,
  nextStartTime = null,
  nextPlace = null,
  nextCountryCode = null,
  connectionLabel,
  isLoading = false,
}: SportsbookHeroBannerProps) {
  const animal = animalForPlace(nextPlace, nextCountryCode);
  const hasData = !isLoading && totalEvents > 0;
  const value = (n: number) => (hasData ? String(n) : '—');
  const sportLabel = activeSport === 'soccer' ? 'Fútbol' : 'UFC / MMA';

  return (
    <header className='hx hx-bg rounded-sm px-4 py-6 sm:px-6'>
      <div className='hx-frame' aria-labelledby='hero-title'>
        <span className='hx-plus tl' aria-hidden='true'>+</span>
        <span className='hx-plus tr' aria-hidden='true'>+</span>
        <span className='hx-plus bl' aria-hidden='true'>+</span>
        <span className='hx-plus br' aria-hidden='true'>+</span>

        <div className='hx-mono flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-[#2C2C2C] px-6 py-3.5 text-[#9C9C9C]'>
          <span className='inline-flex items-center gap-2 text-[color:var(--hx-accent)]'>
            <span className='h-[7px] w-[7px] rounded-full bg-[color:var(--hx-accent)]' />
            [00] ZenBet // Sportsbook · {sportLabel}
          </span>
          {connectionLabel && <span className='sm:ml-auto'>{connectionLabel}</span>}
        </div>

        <div className='flex flex-wrap'>
          <div className='flex min-w-0 flex-[1.45_1_440px] flex-col gap-7 px-6 py-10 sm:px-10 sm:py-12'>
            <h1
              id='hero-title'
              className='hx-serif m-0 text-[clamp(40px,5.2vw,64px)] leading-none tracking-[-0.02em] text-[#F3E5AB]'
            >
              Cada cuota, <em className='text-[color:var(--hx-accent)]'>con su procedencia.</em>
            </h1>
            <p className='m-0 max-w-[520px] text-[15px] leading-relaxed text-[#B9B9B9]'>
              Mira de dónde sale cada cuota y a qué hora se actualizó por última vez. Si se corta
              la conexión en vivo, te dejamos el último precio que recibimos hasta que vuelva.
            </p>

            <div className='flex flex-wrap gap-3'>
              <a className='hx-btn solid' href='#sedes'>
                Ver carteleras
                <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.4' aria-hidden='true'>
                  <path d='M12 4v16M5 13l7 7 7-7' />
                </svg>
              </a>
            </div>

            <dl className='m-0 flex flex-wrap self-start border border-[#2C2C2C]'>
              <Metric label='En vivo' value={value(liveCount)} accent />
              <Metric label={activeSport === 'soccer' ? 'Partidos' : 'Combates'} value={value(totalEvents)} />
              <Metric label='Mercados abiertos' value={value(openMarketCount)} />
              {nextStartTime && (
                <Metric
                  label='Próximo inicio'
                  value={<Countdown startTime={nextStartTime} className='text-[#F3E5AB]' />}
                />
              )}
            </dl>
          </div>

          {nextPlace && (
            <div className='relative min-h-[360px] min-w-0 flex-[1_1_320px] border-t border-[#2C2C2C] lg:border-l lg:border-t-0'>
              <div className='absolute inset-0'>
                <div className='hx-art h-full w-full' style={{ ['--ac' as string]: '#D4FF3F' }}>
                  <AnimalInk animal={animal} />
                </div>
              </div>
              <div className='hx-mono absolute bottom-3.5 left-4 z-[3] bg-[color:var(--hx-accent)] px-2.5 py-[5px] font-bold text-[#0D0D0D]'>
                Fig. 01 · {nextPlace}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function Metric({
  label,
  value,
  accent = false,
}: {
  readonly label: string;
  readonly value: React.ReactNode;
  readonly accent?: boolean;
}) {
  return (
    <div className='flex flex-col gap-1.5 border-r border-[#2C2C2C] px-5 py-3 last:border-r-0'>
      <dt className='hx-mono text-[10px] text-[#9C9C9C]'>{label}</dt>
      <dd
        className={`hx-mono m-0 text-[20px] font-bold tracking-[0.06em] tabular-nums ${
          accent ? 'text-[color:var(--hx-accent)]' : 'text-[#F3E5AB]'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

export default memo(SportsbookHeroBanner);
