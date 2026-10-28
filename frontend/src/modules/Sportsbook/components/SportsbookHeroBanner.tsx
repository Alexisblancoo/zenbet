import { memo } from 'react';

import Countdown from '@/components/Countdown';

import { animalForPlace } from './placeAnimals';

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
 * Cabecera del Sportsbook. Todas las cifras llegan de la API o del canal en
 * vivo; mientras no hay dato se muestra «—», nunca un número de ejemplo.
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
  const { Icon } = animal;
  const hasData = !isLoading && totalEvents > 0;
  const value = (n: number) => (hasData ? String(n) : '—');
  const sportLabel = activeSport === 'soccer' ? 'Fútbol' : 'UFC / MMA';

  return (
    <header className='relative overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0A0A0A] p-4 sm:p-6'>
      <span
        aria-hidden='true'
        className='pointer-events-none absolute inset-0 opacity-[0.1] [background-image:radial-gradient(#D4FF3F_1px,transparent_1.3px)] [background-size:8px_8px] [mask-image:linear-gradient(to_left,black,transparent_60%)]'
      />
      {nextPlace && (
        <Icon
          aria-hidden='true'
          className='pointer-events-none absolute -right-4 top-1/2 hidden h-56 w-56 -translate-y-1/2 text-lime-400 opacity-80 md:block'
        />
      )}

      <div className='relative z-10 max-w-2xl'>
        <p className='font-mono text-[10px] font-bold uppercase tracking-widest text-lime-400'>
          ZenBet · Sportsbook · {sportLabel}
        </p>

        <h1 className='mt-2 font-serif text-[clamp(1.5rem,3.2vw,2.4rem)] font-bold uppercase leading-[1.08] tracking-tight text-cream'>
          Cada cuota, <span className='text-lime-400'>con su procedencia.</span>
        </h1>

        <p className='mt-2 max-w-xl text-xs leading-relaxed text-metallic-titanium sm:text-[13px]'>
          Cada mercado muestra su fuente y la hora del último dato. Si el canal en vivo se
          interrumpe, se conserva el último precio recibido hasta que vuelva.
        </p>

        <dl className='mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap'>
          <Metric label='En vivo' value={value(liveCount)} accent />
          <Metric label={activeSport === 'soccer' ? 'Partidos' : 'Combates'} value={value(totalEvents)} />
          <Metric label='Mercados abiertos' value={value(openMarketCount)} />
          {nextStartTime && (
            <div className='rounded-sm border border-white/[0.08] bg-white/[0.02] px-3 py-1.5'>
              <dt className='font-mono text-[9px] font-bold uppercase tracking-wider text-metallic-titanium'>
                Próximo inicio
              </dt>
              <dd className='font-mono text-sm font-bold text-white tabular-nums'>
                <Countdown startTime={nextStartTime} className='text-white' />
              </dd>
            </div>
          )}
          {connectionLabel && (
            <Metric label='Canal en vivo' value={connectionLabel} small />
          )}
        </dl>

        {nextPlace && (
          <p className='mt-3 font-mono text-[9px] uppercase tracking-wider text-metallic-titanium'>
            Sede del próximo evento: {nextPlace} · {animal.label}
          </p>
        )}
      </div>
    </header>
  );
}

function Metric({
  label,
  value,
  accent = false,
  small = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly accent?: boolean;
  readonly small?: boolean;
}) {
  return (
    <div className='rounded-sm border border-white/[0.08] bg-white/[0.02] px-3 py-1.5'>
      <dt className='font-mono text-[9px] font-bold uppercase tracking-wider text-metallic-titanium'>
        {label}
      </dt>
      <dd
        className={`font-mono font-bold tabular-nums ${small ? 'text-sm' : 'text-lg'} ${
          accent ? 'text-lime-400' : 'text-white'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

export default memo(SportsbookHeroBanner);
