import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  CalendarClock,
  Database,
  MapPin,
  ShieldCheck,
  Swords,
} from 'lucide-react';

import {
  buildUfcCards,
  eventsForBilling,
  findEventSource,
  findMarket,
  formatAmericanOdds,
  formatFightDate,
  formatFightDay,
  formatRank,
  formatUpdatedAt,
  formatWeightDivision,
  type UfcEvent,
  type UfcFighter,
  type UfcSelection,
} from '@/domain/ufc';
import { formatDecimalOdds } from '@/domain/odds';
import { useUfcEvents } from '@/hooks/useUfcEvents';

function selectionFor(
  market: ReturnType<typeof findMarket>,
  code: string,
): UfcSelection | undefined {
  return market?.selections.find((selection) => selection.code === code);
}

function FighterOddsCard({
  fighter,
  selection,
  corner,
}: {
  fighter: UfcFighter;
  selection?: UfcSelection;
  corner: 'red' | 'blue';
}) {
  return (
    <div className='flex min-w-0 flex-col gap-3 border border-obsidian-border bg-obsidian-surface/80 p-4'>
      <div className='flex items-center justify-between gap-2'>
        <span
          className={`font-mono text-[9px] font-bold uppercase tracking-wide ${
            corner === 'red' ? 'text-crimson' : 'text-electric-soft'
          }`}
        >
          {corner === 'red' ? 'Esquina roja' : 'Esquina azul'}
        </span>
        <span className='font-mono text-[9px] uppercase tracking-wide text-metallic-slate'>
          {formatRank(fighter)}
        </span>
      </div>
      <div className='min-w-0'>
        <p className='break-words font-display text-base font-bold uppercase leading-tight text-white'>
          {fighter.name}
        </p>
        <p className='mt-1 font-mono text-[10px] uppercase tracking-wide text-metallic-titanium'>
          {fighter.record} · {fighter.country || '—'}
        </p>
      </div>
      <div className='mt-auto flex min-h-[46px] items-center justify-between gap-2 border-t border-obsidian-border/80 pt-2.5'>
        <span className='font-mono text-[9px] uppercase tracking-wide text-metallic-slate'>
          Moneyline
        </span>
        {selection ? (
          <span className='flex items-baseline gap-2'>
            <span className='odds-number text-lg text-white'>{formatDecimalOdds(selection.decimalOdds)}</span>
            <span className='font-mono text-[10px] font-semibold text-metallic-titanium'>
              {selection.americanOdds || formatAmericanOdds(selection.decimalOdds)}
            </span>
          </span>
        ) : (
          <span className='font-mono text-[9px] uppercase tracking-wide text-metallic-slate'>
            No disponible
          </span>
        )}
      </div>
    </div>
  );
}

function FeaturedBout({ event, cardKey }: { event: UfcEvent; cardKey?: string }) {
  const market = findMarket(event, 'moneyline');
  const red = selectionFor(market, 'red');
  const blue = selectionFor(market, 'blue');

  return (
    <Link
      to={cardKey ? `/sportsbook?card=${cardKey}` : '/sportsbook'}
      className='group flex min-w-0 flex-col gap-3 border border-obsidian-border bg-obsidian-card p-4 transition-colors duration-200 hover:border-crimson/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crimson/60'
    >
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <span className='font-mono text-[9px] font-bold uppercase tracking-wide text-crimson'>
          {event.competition ?? 'UFC'} · {event.bout.billingLabel}
        </span>
        <span className='font-mono text-[9px] uppercase tracking-wide text-metallic-slate'>
          {event.bout.scheduledRounds} asaltos
        </span>
      </div>

      <h3 className='break-words font-display text-sm font-bold uppercase leading-tight text-white group-hover:text-crimson'>
        {event.name}
      </h3>

      <div className='flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[9px] uppercase tracking-wide text-metallic-slate'>
        <span>{formatWeightDivision(event.bout)}</span>
        <span aria-hidden='true'>·</span>
        <span>{formatFightDay(event.startTime)}</span>
      </div>

      <div className='mt-1 grid grid-cols-2 gap-2'>
        <div className='min-w-0 border border-obsidian-border bg-obsidian-surface/70 p-2.5'>
          <p className='truncate font-display text-[11px] font-bold uppercase text-metallic-chrome'>
            {event.bout.red.name}
          </p>
          <p className='mt-1 font-mono text-[9px] text-metallic-slate'>
            {event.bout.red.record}
          </p>
          <div className='mt-2 flex items-baseline justify-between gap-1'>
            <span className='odds-number text-sm text-white'>{formatDecimalOdds(red?.decimalOdds ?? 0)}</span>
            <span className='font-mono text-[9px] text-metallic-titanium'>
              {red ? red.americanOdds || formatAmericanOdds(red.decimalOdds) : ''}
            </span>
          </div>
        </div>
        <div className='min-w-0 border border-obsidian-border bg-obsidian-surface/70 p-2.5'>
          <p className='truncate font-display text-[11px] font-bold uppercase text-metallic-chrome'>
            {event.bout.blue.name}
          </p>
          <p className='mt-1 font-mono text-[9px] text-metallic-slate'>
            {event.bout.blue.record}
          </p>
          <div className='mt-2 flex items-baseline justify-between gap-1'>
            <span className='odds-number text-sm text-white'>
              {formatDecimalOdds(blue?.decimalOdds ?? 0)}
            </span>
            <span className='font-mono text-[9px] text-metallic-titanium'>
              {blue ? blue.americanOdds || formatAmericanOdds(blue.decimalOdds) : ''}
            </span>
          </div>
        </div>
      </div>

      <span className='mt-1 inline-flex items-center gap-1 font-mono text-[9px] font-bold uppercase tracking-wide text-metallic-slate group-hover:text-crimson'>
        Abrir mercados
        <ArrowRight size={11} aria-hidden='true' />
      </span>
    </Link>
  );
}

export default function Home() {
  const { events, isLoading, error, reload } = useUfcEvents();

  // La API ordena de más reciente a más antiguo. En la home se destaca el
  // sábado más próximo y su cartelera, no una mezcla de competencias.
  const cards = buildUfcCards(events);
  const activeCard = cards[0];
  const cardEvents = activeCard?.events ?? [];
  const mainEvent = activeCard?.mainEvent;
  const mainMarket = mainEvent ? findMarket(mainEvent, 'moneyline') : undefined;
  const redSelection = selectionFor(mainMarket, 'red');
  const blueSelection = selectionFor(mainMarket, 'blue');
  const mainCardEvents = eventsForBilling(cardEvents, 'main')
    .filter((event) => event.id !== mainEvent?.id)
    .slice(0, 4);
  const marketCount = events.reduce((total, event) => total + event.markets.length, 0);
  const activeMarketCount = cardEvents.reduce(
    (total, event) => total + event.markets.length,
    0,
  );
  const marketsPerBout =
    cardEvents.length > 0 ? Math.max(1, Math.round(activeMarketCount / cardEvents.length)) : 0;
  const source = mainEvent ? findEventSource(mainEvent) : null;
  const sportsbookHref = activeCard ? `/sportsbook?card=${activeCard.key}` : '/sportsbook';
  const updatedAt = formatUpdatedAt(mainEvent?.oddsUpdatedAt ?? null);

  return (
    <div className='flex min-h-full w-full flex-col bg-canvas text-white'>
      <div className='w-full border-b border-obsidian-border bg-obsidian-surface/70'>
        <div className='mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2.5 font-mono text-[10px] uppercase tracking-wide text-metallic-slate sm:px-6 lg:px-8'>
          <span className='flex items-center gap-2'>
            <span className='h-1.5 w-1.5 bg-crimson' aria-hidden='true' />
            Carteleras UFC · próximos sábados · snapshot declarado
          </span>
          <span>
            {isLoading
              ? 'Consultando eventos…'
              : error
                ? 'Datos no disponibles'
                : `${events.length} combates · ${marketCount} mercados · múltiples carteleras`}
          </span>
        </div>
      </div>

      <div className='mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-8 sm:px-6 lg:px-8'>
        <section className='border-brutal-cold relative overflow-hidden bg-gradient-obsidian-radial p-6 sm:p-10'>
          <div className='pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-crimson/12 blur-3xl' />
          <div className='pointer-events-none absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-electric/10 blur-3xl' />

          <div className='relative z-10 flex flex-col gap-6'>
            <div className='flex flex-wrap items-center gap-3 font-mono text-[10px] uppercase tracking-wide'>
              <span className='inline-flex items-center gap-2 border border-crimson/40 bg-crimson/10 px-2.5 py-1 font-bold text-crimson'>
                <Swords size={11} aria-hidden='true' />
                {mainEvent?.competition ?? 'UFC'}
              </span>
              {mainEvent && (
                <>
                  <span className='inline-flex items-center gap-1.5 text-metallic-titanium'>
                    <CalendarClock size={11} aria-hidden='true' />
                    {formatFightDate(mainEvent.startTime)}
                  </span>
                  <span className='inline-flex items-center gap-1.5 text-metallic-titanium'>
                    <MapPin size={11} aria-hidden='true' />
                    {mainEvent.bout.venue} · {mainEvent.bout.location}
                  </span>
                </>
              )}
            </div>

            {isLoading && !mainEvent ? (
              <div className='space-y-4' aria-busy='true' aria-label='Cargando evento principal'>
                <div className='h-4 w-32 animate-pulse bg-obsidian-elevated' />
                <div className='h-14 w-full max-w-3xl animate-pulse bg-obsidian-elevated sm:h-20' />
                <div className='h-4 w-full max-w-xl animate-pulse bg-obsidian-surface' />
              </div>
            ) : error && !mainEvent ? (
              <div className='flex min-w-0 flex-col items-start gap-4 border border-crimson/40 bg-crimson/5 p-5'>
                <div>
                  <h1 className='font-display text-2xl font-bold uppercase tracking-tight text-white sm:text-3xl'>
                    La cartelera no está disponible
                  </h1>
                  <p className='mt-2 max-w-xl text-xs leading-relaxed text-metallic-titanium'>{error}</p>
                </div>
                <button
                  type='button'
                  onClick={reload}
                  className='inline-flex items-center gap-2 border border-crimson/60 bg-crimson/10 px-4 py-2.5 font-display text-[10px] font-bold uppercase tracking-wide text-crimson transition-colors hover:bg-crimson/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crimson/60'
                >
                  <Activity size={13} aria-hidden='true' />
                  Reintentar
                </button>
              </div>
            ) : mainEvent ? (
              <>
                <div className='max-w-4xl'>
                  <h1 className='font-display text-[clamp(1.6rem,7vw,4.1rem)] font-bold uppercase leading-[0.98] tracking-tight text-white sm:text-6xl lg:text-7xl'>
                    <span className='block break-normal sm:inline'>{mainEvent.bout.red.name}</span>{' '}
                    <span className='block text-crimson sm:inline'>vs.</span>{' '}
                    <span className='block break-normal sm:inline'>{mainEvent.bout.blue.name}</span>
                  </h1>
                  <p className='mt-4 max-w-2xl text-sm leading-relaxed text-metallic-platinum sm:text-base'>
                    {mainEvent.bout.isTitleFight
                      ? 'Combate de título'
                      : 'Evento principal'}{' '}
                    a {mainEvent.bout.scheduledRounds} asaltos en{' '}
                    {mainEvent.bout.weightDivisionLabel}. Cuotas decimales y americanas desde el
                    snapshot de {source?.name ?? 'la fuente declarada'}.
                  </p>
                </div>

                <div className='grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-2'>
                  <FighterOddsCard fighter={mainEvent.bout.red} selection={redSelection} corner='red' />
                  <FighterOddsCard
                    fighter={mainEvent.bout.blue}
                    selection={blueSelection}
                    corner='blue'
                  />
                </div>

                <div className='flex flex-wrap items-center gap-3 pt-1'>
                  <Link
                    to={sportsbookHref}
                    className='inline-flex items-center gap-2 border border-crimson bg-crimson px-5 py-3 font-display text-xs font-bold uppercase tracking-wide text-white transition-colors duration-150 hover:bg-crimson-pure focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crimson/60'
                  >
                    <Swords size={16} aria-hidden='true' />
                    Abrir cartelera completa
                    <ArrowRight size={15} aria-hidden='true' />
                  </Link>
                  <span className='font-mono text-[10px] uppercase tracking-wide text-metallic-slate'>
                    {cardEvents.length} combates · {marketsPerBout} mercados por combate
                  </span>
                </div>

                {updatedAt && (
                  <p className='font-mono text-[9px] uppercase tracking-wide text-metallic-slate'>
                    Cuotas actualizadas {updatedAt} · Fuente: {source?.name ?? 'snapshot declarado'}
                  </p>
                )}
              </>
            ) : (
              <div>
                <h1 className='font-display text-3xl font-bold uppercase tracking-tight text-white'>
                  Cartelera sin eventos
                </h1>
                <p className='mt-2 text-xs text-metallic-titanium'>
                  No hay combates programados en este momento.
                </p>
              </div>
            )}
          </div>
        </section>

        <section className='flex flex-col gap-4'>
          <div className='flex flex-wrap items-end justify-between gap-3 border-b border-obsidian-border pb-3'>
            <div className='min-w-0'>
              <p className='font-mono text-[9px] font-bold uppercase tracking-wide text-crimson'>
                Cartelera estelar
              </p>
              <h2 className='mt-1 font-display text-lg font-bold uppercase tracking-tight text-white'>
                Combates principales
              </h2>
            </div>
            <Link
              to={sportsbookHref}
              className='inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wide text-crimson hover:text-white'
            >
              Ver todos los mercados
              <ArrowRight size={12} aria-hidden='true' />
            </Link>
          </div>

          {isLoading && mainCardEvents.length === 0 ? (
            <div className='grid grid-cols-1 gap-3 md:grid-cols-2'>
              {[0, 1, 2, 3].map((item) => (
                <div
                  key={item}
                  className='h-48 animate-pulse border border-obsidian-border bg-obsidian-card'
                />
              ))}
            </div>
          ) : mainCardEvents.length > 0 ? (
            <div className='grid grid-cols-1 gap-3 md:grid-cols-2'>
              {mainCardEvents.map((event) => (
                <FeaturedBout key={event.id} event={event} cardKey={activeCard?.key} />
              ))}
            </div>
          ) : (
            <p className='border border-obsidian-border bg-obsidian-card p-5 text-xs text-metallic-titanium'>
              No hay combates principales publicados en este momento.
            </p>
          )}
        </section>

        <section className='grid grid-cols-1 gap-4 md:grid-cols-3'>
          <div className='flex flex-col gap-2 border border-obsidian-border bg-obsidian-surface p-5'>
            <div className='flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-wide text-electric-soft'>
              <Database size={14} aria-hidden='true' />
              Cartelera verificada
            </div>
            <p className='text-xs leading-relaxed text-metallic-titanium'>
              Cada combate conserva división, ronda y posición en su cartelera. Los {events.length}{' '}
              combates y sus {marketCount} mercados proceden de snapshots declarados y muestran su
              procedencia.
            </p>
          </div>

          <div className='flex flex-col gap-2 border border-obsidian-border bg-obsidian-surface p-5'>
            <div className='flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-wide text-electric-soft'>
              <ShieldCheck size={14} aria-hidden='true' />
              Cuotas declaradas
            </div>
            <p className='text-xs leading-relaxed text-metallic-titanium'>
              Cada mercado indica su proveedor y su timestamp de observación. Las cuatro familias de
              UFC se presentan desde el snapshot declarado de cada cartelera; son cuotas de
              referencia, no una línea ejecutable.
            </p>
          </div>

          <div className='flex flex-col gap-2 border border-obsidian-border bg-obsidian-surface p-5'>
            <div className='flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-wide text-crimson'>
              <Activity size={14} aria-hidden='true' />
              Boleto protegido
            </div>
            <p className='text-xs leading-relaxed text-metallic-titanium'>
              Añade cuotas y revisa monto, cuota total y ganancia antes de confirmar. Validamos tu
              saldo y protegemos cada apuesta contra envíos duplicados.
            </p>
          </div>
        </section>

        <p className='border-t border-obsidian-border pt-4 text-[10px] leading-relaxed text-metallic-slate'>
          Cartelera y cuotas con fines informativos. Las cuotas son un snapshot de referencia y no
          una cotización ejecutable. Juega de forma responsable.
        </p>
      </div>
    </div>
  );
}
