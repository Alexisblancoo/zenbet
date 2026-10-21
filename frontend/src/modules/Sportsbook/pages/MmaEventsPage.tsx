import { useCallback, useEffect, useMemo } from 'react';
import { AlertTriangle, CalendarClock, Database, MapPin, RefreshCw, Swords } from 'lucide-react';

import BetSlip from '@/components/BetSlip';
import { useBetSlip } from '@/context/betSlipState';
import type { SelectionInput } from '@/domain/bets';
import {
  formatFightDate,
  formatWeightDivision,
  eventsForBilling,
  UFC_BILLING_SECTIONS,
  type UfcEvent,
} from '@/domain/ufc';
import { useUfcEvents } from '@/hooks/useUfcEvents';
import HubStatusBadge from '../components/HubStatusBadge';
import EventCard from '../components/EventCard';

function SectionHeading({
  label,
  count,
  description,
}: {
  label: string;
  count: number;
  description: string;
}) {
  return (
    <div className='flex min-w-0 flex-col gap-2'>
      <div className='flex items-center gap-3'>
        <span className='h-2 w-2 shrink-0 border border-crimson/70 bg-crimson/20' aria-hidden='true' />
        <h2 className='font-display text-[11px] font-extrabold uppercase tracking-ultra text-metallic-chrome'>
          {label}
        </h2>
        <span className='shrink-0 border border-obsidian-border/80 bg-obsidian-surface/50 px-1.5 py-0.5 font-mono text-[9px] tabular-nums text-metallic-slate'>
          {count}
        </span>
        <span className='h-px min-w-4 flex-1 bg-obsidian-border' aria-hidden='true' />
      </div>
      <p className='pl-5 text-[10px] leading-relaxed text-metallic-slate'>{description}</p>
    </div>
  );
}

function LoadingCard() {
  return (
    <div className='animate-pulse border border-obsidian-border bg-obsidian-card'>
      <div className='h-[3px] w-full bg-obsidian-elevated' />
      <div className='space-y-4 p-4'>
        <div className='h-3 w-24 bg-obsidian-elevated' />
        <div className='h-6 w-2/3 bg-obsidian-elevated' />
        <div className='grid grid-cols-2 gap-3'>
          <div className='h-20 bg-obsidian-surface' />
          <div className='h-20 bg-obsidian-surface' />
        </div>
        <div className='grid grid-cols-4 gap-1'>
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className='h-9 bg-obsidian-surface' />
          ))}
        </div>
        <div className='grid grid-cols-2 gap-2'>
          <div className='h-12 bg-obsidian-surface' />
          <div className='h-12 bg-obsidian-surface' />
        </div>
      </div>
    </div>
  );
}

function EventsError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className='flex min-w-0 flex-col items-start gap-4 border border-crimson/40 bg-crimson/5 p-5'>
      <div className='flex items-start gap-3'>
        <AlertTriangle size={18} className='mt-0.5 shrink-0 text-crimson' aria-hidden='true' />
        <div className='min-w-0'>
          <h2 className='font-display text-sm font-extrabold uppercase tracking-brutal text-white'>
            No se pudo cargar la cartelera
          </h2>
          <p className='mt-1 break-words text-xs leading-relaxed text-metallic-titanium'>{message}</p>
        </div>
      </div>
      <button
        type='button'
        onClick={onRetry}
        className='inline-flex items-center gap-2 border border-crimson/60 bg-crimson/10 px-3 py-2 font-display text-[10px] font-extrabold uppercase tracking-brutal text-crimson transition-colors duration-150 hover:bg-crimson/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crimson/60'
      >
        <RefreshCw size={12} aria-hidden='true' />
        Reintentar
      </button>
    </div>
  );
}

function EventsEmpty() {
  return (
    <div className='flex flex-col items-start gap-3 border border-obsidian-border bg-obsidian-card p-6'>
      <Database size={20} className='text-metallic-slate' aria-hidden='true' />
      <div>
        <h2 className='font-display text-sm font-extrabold uppercase tracking-brutal text-white'>
          Cartelera sin eventos
        </h2>
        <p className='mt-1 max-w-xl text-xs leading-relaxed text-metallic-titanium'>
          La API respondió correctamente, pero no hay combates programados en este momento. El seed
          de UFC 333 solo se carga en un entorno con la base de datos migrada.
        </p>
      </div>
    </div>
  );
}

function MainEventSummary({
  event,
  boutCount,
  marketCount,
}: {
  event: UfcEvent;
  boutCount: number;
  marketCount: number;
}) {
  const { bout } = event;

  return (
    <section
      aria-label='Evento principal'
      className='relative overflow-hidden border border-gold/30 bg-obsidian-card px-5 py-5 sm:px-6'
    >
      <div className='absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent' />
      <div className='grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-end'>
        <div className='min-w-0'>
          <div className='flex flex-wrap items-center gap-2 font-mono text-[9px] font-bold uppercase tracking-ultra text-gold'>
            <span>{event.competition ?? 'UFC'}</span>
            <span className='h-px w-4 bg-gold/40' aria-hidden='true' />
            <span className='text-metallic-titanium'>Datos persistidos</span>
          </div>
          <h1 className='mt-2 font-display text-2xl font-extrabold uppercase leading-[1.02] tracking-tightest text-white sm:text-4xl'>
            <span className='block sm:inline'>{bout.red.name}</span>{' '}
            <span className='text-crimson'>vs.</span>{' '}
            <span className='block sm:inline'>{bout.blue.name}</span>
          </h1>
          <div className='mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] uppercase tracking-wide text-metallic-titanium'>
            <span className='inline-flex items-center gap-1.5'>
              <Swords size={12} className='text-crimson' aria-hidden='true' />
              {formatWeightDivision(bout)}
            </span>
            <span className='inline-flex items-center gap-1.5'>
              <CalendarClock size={12} aria-hidden='true' />
              {formatFightDate(event.startTime)}
            </span>
            <span className='inline-flex items-center gap-1.5'>
              <MapPin size={12} aria-hidden='true' />
              {bout.venue} · {bout.location}
            </span>
          </div>
          <p className='mt-3 max-w-2xl text-xs leading-relaxed text-metallic-titanium'>
            {bout.isTitleFight ? 'Combate de título a ' : 'Combate a '}
            {bout.scheduledRounds} asaltos. Ambos peleadores compiten en{' '}
            <span className='text-metallic-chrome'>{bout.weightDivisionLabel}</span>.
          </p>
        </div>

        <dl className='grid grid-cols-3 gap-2 border-t border-obsidian-border/80 pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0'>
          <div className='min-w-0'>
            <dt className='font-mono text-[9px] uppercase tracking-brutal text-metallic-slate'>Evento</dt>
            <dd className='mt-1 font-display text-lg font-extrabold text-white'>{boutCount}</dd>
            <dd className='font-mono text-[9px] uppercase tracking-wide text-metallic-slate'>combates</dd>
          </div>
          <div className='min-w-0'>
            <dt className='font-mono text-[9px] uppercase tracking-brutal text-metallic-slate'>Mercados</dt>
            <dd className='mt-1 font-display text-lg font-extrabold text-gold'>{marketCount}</dd>
            <dd className='font-mono text-[9px] uppercase tracking-wide text-metallic-slate'>
              {boutCount > 0 ? `${Math.round(marketCount / boutCount)} por combate` : 'sin cuotas'}
            </dd>
          </div>
          <div className='min-w-0'>
            <dt className='font-mono text-[9px] uppercase tracking-brutal text-metallic-slate'>Estado</dt>
            <dd className='mt-1 font-display text-sm font-extrabold uppercase text-odds-live'>
              {event.status === 'live' ? 'En vivo' : event.status === 'scheduled' ? 'Próximo' : event.status}
            </dd>
            <dd className='font-mono text-[9px] uppercase tracking-wide text-metallic-slate'>
              {formatFightDate(event.startTime).split(' · ')[0]}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

export default function MmaEventsPage() {
  const { events, isLoading, error, reload } = useUfcEvents();
  const {
    selections,
    quotes,
    hubStatus,
    lastUpdateAt,
    setVisibleMarkets,
    addSelection,
    removeSelection,
  } = useBetSlip();

  const marketIds = useMemo(
    () => [...new Set(events.flatMap((event) => event.markets.map((market) => market.id)))],
    [events],
  );

  useEffect(() => {
    setVisibleMarkets(marketIds);
    return () => setVisibleMarkets([]);
  }, [marketIds, setVisibleMarkets]);

  const selectedIds = useMemo(
    () => selections.map((selection) => selection.selectionId),
    [selections],
  );

  const handleAddSelection = useCallback(
    (selection: SelectionInput) => {
      addSelection(selection);
    },
    [addSelection],
  );

  const mainEvent = useMemo(
    () =>
      events.find(
        (event) => event.bout.billing === 'main' && event.bout.billingOrder === 1,
      ) ?? events[0],
    [events],
  );

  const groupedEvents = useMemo(
    () =>
      UFC_BILLING_SECTIONS.map((section) => ({
        ...section,
        events: eventsForBilling(events, section.key),
      })).filter((section) => section.events.length > 0),
    [events],
  );

  const marketCount = events.reduce((count, event) => count + event.markets.length, 0);

  return (
    <div className='bg-gradient-obsidian-radial'>
      <div className='mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8'>
        <header className='flex flex-wrap items-end justify-between gap-4 border-b border-obsidian-border px-5 py-5'>
          <div className='min-w-0'>
            <p className='flex items-center gap-2 text-[10px] font-bold uppercase tracking-ultra text-crimson'>
              <Swords size={12} aria-hidden='true' />
              Zenbet · Sportsbook
            </p>
            <h1 className='mt-2 font-display text-2xl font-extrabold uppercase tracking-tightest text-white sm:text-3xl'>
              Cartelera MMA
            </h1>
            <p className='mt-1 max-w-2xl text-xs leading-relaxed text-metallic-titanium'>
              Combates y mercados de UFC 333. Cuotas decimales y americanas; el boleto usa los
              identificadores reales de la API.
            </p>
          </div>

          <div className='flex flex-wrap items-center gap-2'>
            <HubStatusBadge status={hubStatus} lastUpdateAt={lastUpdateAt} />
            <span className='border border-obsidian-border bg-obsidian-elevated px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-brutal text-metallic-titanium'>
              {events.length > 0 ? `${events.length} combates` : isLoading ? 'Cargando' : 'Sin datos'}
            </span>
            <span className='border border-gold/35 bg-gold/5 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-brutal text-gold'>
              {marketCount > 0 ? `${marketCount} mercados` : 'Cuotas de referencia'}
            </span>
          </div>
        </header>

        {mainEvent && (
          <MainEventSummary
            event={mainEvent}
            boutCount={events.length}
            marketCount={marketCount}
          />
        )}

        <div className='grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]'>
          <div className='flex min-w-0 flex-col gap-8'>
            {isLoading && events.length === 0 && (
              <div className='flex flex-col gap-4' aria-busy='true' aria-label='Cargando cartelera'>
                <LoadingCard />
                <LoadingCard />
                <LoadingCard />
              </div>
            )}

            {!isLoading && error && <EventsError message={error} onRetry={reload} />}

            {!isLoading && !error && events.length === 0 && <EventsEmpty />}

            {groupedEvents.map((section) => (
              <section
                key={section.key}
                aria-labelledby={`section-${section.key}`}
                className='flex min-w-0 flex-col gap-4'
              >
                <div id={`section-${section.key}`}>
                  <SectionHeading
                    label={section.label}
                    count={section.events.length}
                    description={
                      section.key === 'main'
                        ? 'Los combates con mayor jerarquía de la cartelera. El evento principal encabeza la sección.'
                        : section.key === 'prelims'
                          ? 'Combates previos a la cartelera estelar.'
                          : 'Apertura de la cartelera. Horarios sujetos a cambios de la organización.'
                    }
                  />
                </div>
                {section.events.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    featured={event.id === mainEvent?.id}
                    selectedIds={selectedIds}
                    onAddSelection={handleAddSelection}
                    onRemoveSelection={removeSelection}
                    oddsMap={quotes}
                  />
                ))}
              </section>
            ))}

            <footer className='flex flex-col gap-2 border-t border-obsidian-border pt-4 text-[10px] leading-relaxed text-metallic-slate'>
              <p>
                <span className='font-mono font-bold uppercase tracking-brutal text-metallic-titanium'>
                  Fuente de cuotas:
                </span>{' '}
                Moneyline tomado del consenso publicado por UFCalendar (20 oct 2026). Método de
                victoria, total de asaltos y decisión son precios modelados por ZenBet a partir de
                esas probabilidades; no son líneas oficiales de una casa.
              </p>
              <p>
                Cartelera: UFC 333, 24 de octubre de 2026, Etihad Arena, Abu Dhabi. Todos los
                emparejamientos comparten división oficial. Verifica la cartelera en{' '}
                <a
                  href='https://www.ufc.com/event/ufc-333'
                  target='_blank'
                  rel='noreferrer'
                  className='text-crimson underline decoration-crimson/40 underline-offset-2 hover:text-white'
                >
                  UFC.com
                </a>
                .
              </p>
            </footer>
          </div>

          <div className='min-w-0 lg:sticky lg:top-6'>
            <BetSlip minStake={50} maxStake={5000} className='lg:max-h-[calc(100vh_-_3rem)]' />
          </div>
        </div>
      </div>
    </div>
  );
}
