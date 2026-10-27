import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CalendarClock, ChevronDown, MapPin, RefreshCw } from 'lucide-react';

import { formatDecimalOdds } from '@/domain/odds';
import {
  buildUfcCards,
  findEventSource,
  findMarket,
  formatFightDate,
  formatUpdatedAt,
  type UfcSelection,
} from '@/domain/ufc';
import { useUfcEvents } from '@/hooks/useUfcEvents';
import SportsBentoGrid from '@/modules/Sportsbook/components/SportsBentoGrid';
import { HOME_ART } from '@/modules/Sportsbook/components/sportVisuals';

const STEPS = [
  {
    code: '#1',
    kind: 'Elige',
    title: 'Disciplina y cartelera',
    text: 'Entra por deporte y abre la cartelera con sus combates y mercados.',
    art: HOME_ART.hercules,
  },
  {
    code: '#2',
    kind: 'Revisa',
    title: 'Cuota con procedencia',
    text: 'Cada mercado indica su proveedor y la hora en que se observó la cuota.',
    art: HOME_ART.prudence,
  },
  {
    code: '#3',
    kind: 'Confirma',
    title: 'Boleto claro',
    text: 'Ves monto, cuota total y ganancia antes de enviar. Sin duplicados.',
    art: HOME_ART.moneylender,
  },
] as const;

const FAQ = [
  {
    q: '¿Las cuotas son ejecutables?',
    a: 'No. Son cuotas de referencia tomadas de un snapshot declarado. Cada mercado indica su proveedor y su timestamp de observación.',
  },
  {
    q: '¿Qué deportes puedo ver hoy?',
    a: 'Hoy solo UFC / MMA. Fútbol, baloncesto, boxeo, eSports, tenis y béisbol aparecen como "Pronto" y no muestran cuotas hasta que existan.',
  },
  {
    q: '¿Cómo se protege mi apuesta?',
    a: 'Validamos tu saldo antes de confirmar y protegemos cada apuesta contra envíos duplicados. Revisas monto, cuota total y ganancia antes de enviar.',
  },
] as const;

function SectionLabel({ code, children }: { code: string; children: string }) {
  return (
    <p className='font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-sage'>
      <span className='text-lime-400'>{code}</span> {children}
    </p>
  );
}

function OddsPill({ name, selection }: { name: string; selection?: UfcSelection }) {
  return (
    <div className='flex min-w-0 items-center justify-between gap-3 border border-white/10 bg-obsidian-surface px-3 py-2.5'>
      <span className='truncate font-serif text-sm font-bold uppercase text-cream'>{name}</span>
      <span className='odds-number text-base text-gold'>
        {selection ? formatDecimalOdds(selection.decimalOdds) : '—'}
      </span>
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const { events, isLoading, error, reload } = useUfcEvents();

  const cards = buildUfcCards(events);
  const activeCard = cards[0];
  const mainEvent = activeCard?.mainEvent;
  const mainMarket = mainEvent ? findMarket(mainEvent, 'moneyline') : undefined;
  const red = mainMarket?.selections.find((selection) => selection.code === 'red');
  const blue = mainMarket?.selections.find((selection) => selection.code === 'blue');
  const source = mainEvent ? findEventSource(mainEvent) : null;
  const updatedAt = formatUpdatedAt(mainEvent?.oddsUpdatedAt ?? null);
  const sportsbookHref = activeCard ? `/sportsbook?card=${activeCard.key}` : '/sportsbook';
  const marketCount = events.reduce((total, event) => total + event.markets.length, 0);

  const mmaStats = useMemo(() => {
    const openMarketCount = events.reduce((count, event) => {
      if (event.isExpired || !event.isBettingOpen) return count;
      return count + event.markets.filter((market) => market.status === 'open').length;
    }, 0);
    const liveCount = events.filter(
      (event) => event.status === 'live' && !event.isExpired,
    ).length;

    return { eventCount: events.length, liveCount, marketCount, openMarketCount, isLoading };
  }, [events, isLoading, marketCount]);

  return (
    <div className='flex min-h-full w-full flex-col bg-canvas text-cream'>
      <div className='mx-auto flex w-full max-w-7xl flex-col gap-16 px-4 py-8 sm:px-6 sm:py-12 lg:gap-24 lg:px-8'>
        {/* ------------------------------------------------------------ */}
        {/* Hero: la marca y la acción, sin nombres de peleadores          */}
        {/* ------------------------------------------------------------ */}
        <section className='grid items-center gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-14'>
          <div className='flex min-w-0 flex-col gap-6'>
            <p className='font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-sage'>
              Zenbet · Shibuya <span className='text-lime-400'>/</span> Sportsbook
            </p>

            <h1 className='font-display text-[clamp(2.2rem,6vw,4.5rem)] font-bold uppercase leading-[1.02] tracking-tight text-cream'>
              Elige el deporte.
              <br />
              <span className='text-lime-400'>Revisa cada cuota.</span>
            </h1>

            <p className='max-w-xl font-serif text-base italic leading-relaxed text-cream/75 sm:text-lg'>
              Carteleras con cuotas de referencia, procedencia declarada y un boleto claro antes de
              confirmar.
            </p>

            <div className='flex flex-wrap items-center gap-3'>
              <Link to={sportsbookHref} className='btn btn-primary btn-lg'>
                Abrir cartelera UFC
                <ArrowRight size={16} aria-hidden='true' />
              </Link>
              <a href='#como-funciona' className='btn btn-ghost btn-lg'>
                Cómo funciona
              </a>
            </div>

            <p className='font-mono text-[11px] uppercase tracking-wide text-sage'>
              {isLoading
                ? 'Consultando carteleras…'
                : error
                  ? 'Cartelera no disponible'
                  : `${events.length} combates · ${marketCount} mercados · snapshot declarado`}
            </p>
          </div>

          <figure className='relative overflow-hidden border border-white/10 bg-[#0A0A0A]'>
            <img
              src={HOME_ART.cardsharps.image}
              alt={HOME_ART.cardsharps.alt}
              decoding='async'
              className='aspect-[4/3] w-full object-cover'
              style={{ objectPosition: '35% 35%' }}
            />
            <div
              aria-hidden='true'
              className='pointer-events-none absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-[#0A0A0A]/90 to-transparent'
            />
            <figcaption className='absolute inset-x-3 bottom-3'>
              <span className='zb-plaque'>
                {HOME_ART.cardsharps.title} · {HOME_ART.cardsharps.subtitle}
              </span>
            </figcaption>
          </figure>
        </section>

        {/* ------------------------------------------------------------ */}
        {/* Disciplinas: la puerta de entrada (como las categorías de un   */}
        {/* sportsbook), en lugar de volcar combates y nombres             */}
        {/* ------------------------------------------------------------ */}
        <section aria-label='Disciplinas' className='flex flex-col gap-4'>
          <SectionLabel code='#1'>Disciplinas</SectionLabel>
          <SportsBentoGrid
            activeSport='mma'
            onSelectSport={(sport) => navigate(`/sportsbook?sport=${sport}`)}
            mmaStats={mmaStats}
          />
        </section>

        {/* ------------------------------------------------------------ */}
        {/* Próxima cartelera: una sola tarjeta, evento estelar plegado    */}
        {/* ------------------------------------------------------------ */}
        <section aria-label='Próxima cartelera' className='flex flex-col gap-4'>
          <SectionLabel code='#2'>Próxima cartelera</SectionLabel>

          {isLoading && !activeCard ? (
            <div
              className='h-44 animate-pulse border border-white/10 bg-obsidian-card'
              aria-busy='true'
              aria-label='Cargando cartelera'
            />
          ) : error && !activeCard ? (
            <div className='flex flex-col items-start gap-4 border border-burgundy-hi/60 bg-burgundy/20 p-6'>
              <div>
                <h2 className='font-display text-2xl font-bold uppercase tracking-tight text-cream'>
                  La cartelera no está disponible
                </h2>
                <p className='mt-2 max-w-xl text-sm leading-relaxed text-cream/75'>{error}</p>
              </div>
              <button type='button' onClick={reload} className='btn btn-danger'>
                <RefreshCw size={14} aria-hidden='true' />
                Reintentar
              </button>
            </div>
          ) : activeCard ? (
            <div className='border border-white/10 bg-obsidian-card'>
              <div className='flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6'>
                <div className='min-w-0'>
                  <div className='flex flex-wrap items-center gap-2'>
                    <span className='rounded-[2px] bg-burgundy px-1.5 py-1 font-mono text-[10px] font-bold leading-none text-cream'>
                      UFC
                    </span>
                    <span
                      className={`font-mono text-[10px] font-bold uppercase tracking-wider ${
                        activeCard.liveCount > 0 || activeCard.isBettingOpen
                          ? 'text-lime-400'
                          : 'text-sage'
                      }`}
                    >
                      {activeCard.liveCount > 0
                        ? `${activeCard.liveCount} en vivo`
                        : activeCard.isBettingOpen
                          ? 'Apuestas abiertas'
                          : 'Apuestas cerradas'}
                    </span>
                  </div>

                  <h2 className='mt-3 font-display text-3xl font-bold uppercase leading-none tracking-tight text-cream sm:text-4xl'>
                    {activeCard.competition}
                  </h2>

                  <div className='mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] uppercase tracking-wide text-sage'>
                    <span className='inline-flex items-center gap-1.5'>
                      <CalendarClock size={12} aria-hidden='true' />
                      {formatFightDate(activeCard.startTime)}
                    </span>
                    <span className='inline-flex items-center gap-1.5'>
                      <MapPin size={12} aria-hidden='true' />
                      {activeCard.venue} · {activeCard.location}
                    </span>
                    <span>
                      {activeCard.events.length} combates · {activeCard.marketCount} mercados
                    </span>
                  </div>
                </div>

                <Link to={sportsbookHref} className='btn btn-primary btn-lg shrink-0'>
                  Ver cartelera
                  <ArrowRight size={16} aria-hidden='true' />
                </Link>
              </div>

              {mainEvent && (
                <details className='group border-t border-white/10'>
                  <summary className='flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 font-mono text-[11px] font-semibold uppercase tracking-wider text-sage transition-colors hover:text-cream sm:px-6 [&::-webkit-details-marker]:hidden'>
                    <span>Evento estelar y cuotas</span>
                    <ChevronDown
                      size={14}
                      aria-hidden='true'
                      className='transition-transform duration-200 group-open:rotate-180'
                    />
                  </summary>
                  <div className='flex flex-col gap-3 px-5 pb-5 sm:px-6 sm:pb-6'>
                    <p className='font-mono text-[10px] uppercase tracking-wide text-sage'>
                      {mainEvent.bout.weightDivisionLabel} · {mainEvent.bout.scheduledRounds}{' '}
                      asaltos
                    </p>
                    <div className='grid gap-2 sm:grid-cols-2'>
                      <OddsPill name={mainEvent.bout.red.name} selection={red} />
                      <OddsPill name={mainEvent.bout.blue.name} selection={blue} />
                    </div>
                    {updatedAt && (
                      <p className='font-mono text-[10px] uppercase tracking-wide text-sage'>
                        Cuotas actualizadas {updatedAt} · Fuente:{' '}
                        {source?.name ?? 'snapshot declarado'}
                      </p>
                    )}
                  </div>
                </details>
              )}
            </div>
          ) : (
            <p className='border border-white/10 bg-obsidian-card p-5 text-sm text-sage'>
              No hay combates programados en este momento.
            </p>
          )}
        </section>

        {/* ------------------------------------------------------------ */}
        {/* Cómo funciona: pasos numerados con obra tramada                */}
        {/* ------------------------------------------------------------ */}
        <section id='como-funciona' className='flex scroll-mt-24 flex-col gap-6'>
          <div className='flex flex-col gap-3'>
            <SectionLabel code='#3'>Cómo funciona</SectionLabel>
            <h2 className='font-display text-3xl font-bold uppercase leading-tight tracking-tight text-cream sm:text-5xl'>
              Tres pasos. <span className='text-lime-400'>Nada oculto.</span>
            </h2>
          </div>

          <div className='grid gap-4 md:grid-cols-3'>
            {STEPS.map((step) => (
              <article
                key={step.code}
                className='flex flex-col border border-white/10 bg-obsidian-card'
              >
                <div className='relative'>
                  <img
                    src={step.art.image}
                    alt={step.art.alt}
                    loading='lazy'
                    decoding='async'
                    className='aspect-[16/10] w-full object-cover'
                    style={{ objectPosition: step.art.focus }}
                  />
                  <span className='zb-plaque absolute bottom-2 left-2 max-w-[calc(100%-1rem)]'>
                    {step.art.title} · {step.art.subtitle}
                  </span>
                </div>
                <div className='flex flex-1 flex-col gap-2 p-5'>
                  <p className='font-mono text-[11px] font-semibold uppercase tracking-[0.14em]'>
                    <span className='text-lime-400'>{step.code}</span>{' '}
                    <span className='text-sage'>{step.kind}</span>
                  </p>
                  <h3 className='font-display text-xl font-bold uppercase leading-tight tracking-tight text-cream'>
                    {step.title}
                  </h3>
                  <p className='text-sm leading-relaxed text-cream/70'>{step.text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* ------------------------------------------------------------ */}
        {/* Preguntas frecuentes                                           */}
        {/* ------------------------------------------------------------ */}
        <section className='flex flex-col gap-4'>
          <SectionLabel code='#4'>Preguntas frecuentes</SectionLabel>
          <div className='divide-y divide-white/10 border-y border-white/10'>
            {FAQ.map((item) => (
              <details key={item.q} className='group py-4'>
                <summary className='flex cursor-pointer list-none items-center justify-between gap-4 font-display text-base font-bold uppercase tracking-tight text-cream transition-colors sm:text-lg hover:text-lime-400 [&::-webkit-details-marker]:hidden'>
                  {item.q}
                  <ChevronDown
                    size={18}
                    aria-hidden='true'
                    className='shrink-0 text-sage transition-transform duration-200 group-open:rotate-180'
                  />
                </summary>
                <p className='mt-3 max-w-3xl text-sm leading-relaxed text-cream/70'>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <p className='border-t border-white/10 pt-4 text-[11px] leading-relaxed text-sage'>
          Cartelera y cuotas con fines informativos. Las cuotas son un snapshot de referencia y no
          una cotización ejecutable. Juega de forma responsable.
        </p>
      </div>
    </div>
  );
}
