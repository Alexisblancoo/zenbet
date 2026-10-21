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
  eventsForBilling,
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
          className={`font-mono text-[9px] font-bold uppercase tracking-ultra ${
            corner === 'red' ? 'text-crimson' : 'text-metallic-titanium'
          }`}
        >
          {corner === 'red' ? 'Esquina roja' : 'Esquina azul'}
        </span>
        <span className='font-mono text-[9px] uppercase tracking-wide text-metallic-slate'>
          {formatRank(fighter)}
        </span>
      </div>
      <div className='min-w-0'>
        <p className='break-words font-display text-base font-extrabold uppercase leading-tight text-white'>
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
            <span className='odds-number text-lg text-white'>{selection.decimalOdds.toFixed(2)}</span>
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

function FeaturedBout({ event }: { event: UfcEvent }) {
  const market = findMarket(event, 'moneyline');
  const red = selectionFor(market, 'red');
  const blue = selectionFor(market, 'blue');

  return (
    <Link
      to='/sportsbook'
      className='group flex min-w-0 flex-col gap-3 border border-obsidian-border bg-obsidian-card p-4 transition-colors duration-200 hover:border-crimson/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crimson/60'
    >
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <span className='font-mono text-[9px] font-bold uppercase tracking-ultra text-crimson'>
          {event.competition ?? 'UFC'} · {event.bout.billingLabel}
        </span>
        <span className='font-mono text-[9px] uppercase tracking-wide text-metallic-slate'>
          {event.bout.scheduledRounds} asaltos
        </span>
      </div>

      <h3 className='break-words font-display text-sm font-extrabold uppercase leading-tight text-white group-hover:text-crimson'>
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
            <span className='odds-number text-sm text-white'>{red?.decimalOdds.toFixed(2) ?? '—'}</span>
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
              {blue?.decimalOdds.toFixed(2) ?? '—'}
            </span>
            <span className='font-mono text-[9px] text-metallic-titanium'>
              {blue ? blue.americanOdds || formatAmericanOdds(blue.decimalOdds) : ''}
            </span>
          </div>
        </div>
      </div>

      <span className='mt-1 inline-flex items-center gap-1 font-mono text-[9px] font-bold uppercase tracking-brutal text-metallic-slate group-hover:text-crimson'>
        Abrir mercados
        <ArrowRight size={11} aria-hidden='true' />
      </span>
    </Link>
  );
}

export default function Home() {
  const { events, isLoading, error, reload } = useUfcEvents();

  const mainEvent =
    events.find((event) => event.bout.billing === 'main' && event.bout.billingOrder === 1) ??
    events[0];
  const mainMarket = mainEvent ? findMarket(mainEvent, 'moneyline') : undefined;
  const redSelection = selectionFor(mainMarket, 'red');
  const blueSelection = selectionFor(mainMarket, 'blue');
  const mainCardEvents = eventsForBilling(events, 'main')
    .filter((event) => event.id !== mainEvent?.id)
    .slice(0, 4);
  const marketCount = events.reduce((total, event) => total + event.markets.length, 0);
  const marketsPerBout =
    events.length > 0 ? Math.max(1, Math.round(marketCount / events.length)) : 0;
  const updatedAt = formatUpdatedAt(mainEvent?.oddsUpdatedAt ?? null);

  return (
    <div className='flex min-h-full w-full flex-col bg-obsidian-void text-slate-100'>
      <div className='w-full border-b border-obsidian-border bg-obsidian-surface/70'>
        <div className='mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2.5 font-mono text-[10px] uppercase tracking-wide text-metallic-slate sm:px-6 lg:px-8'>
          <span className='flex items-center gap-2'>
            <span className='h-1.5 w-1.5 bg-crimson' aria-hidden='true' />
            Cartelera UFC conectada a la API
          </span>
          <span>
            {isLoading
              ? 'Consultando eventos…'
              : error
                ? 'API no disponible'
                : `${events.length} combates · ${marketCount} mercados · PostgreSQL`}
          </span>
        </div>
      </div>

      <div className='mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-8 sm:px-6 lg:px-8'>
        <section className='border-brutal-cold relative overflow-hidden bg-gradient-obsidian-radial p-6 sm:p-10'>
          <div className='pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-crimson/12 blur-3xl' />
          <div className='pointer-events-none absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-gold-imperial/8 blur-3xl' />

          <div className='relative z-10 flex flex-col gap-6'>
            <div className='flex flex-wrap items-center gap-3 font-mono text-[10px] uppercase tracking-wide'>
              <span className='inline-flex items-center gap-2 border border-gold/40 bg-gold/10 px-2.5 py-1 font-bold text-gold'>
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
                  <h1 className='font-display text-2xl font-extrabold uppercase tracking-tightest text-white sm:text-3xl'>
                    La cartelera no está disponible
                  </h1>
                  <p className='mt-2 max-w-xl text-xs leading-relaxed text-metallic-titanium'>{error}</p>
                </div>
                <button
                  type='button'
                  onClick={reload}
                  className='inline-flex items-center gap-2 border border-crimson/60 bg-crimson/10 px-4 py-2.5 font-display text-[10px] font-extrabold uppercase tracking-brutal text-crimson transition-colors hover:bg-crimson/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crimson/60'
                >
                  <Activity size={13} aria-hidden='true' />
                  Reintentar conexión
                </button>
              </div>
            ) : mainEvent ? (
              <>
                <div className='max-w-4xl'>
                  <h1 className='font-display text-[clamp(1.6rem,7vw,4.5rem)] font-black uppercase leading-[0.96] tracking-tightest text-white sm:text-6xl lg:text-7xl'>
                    <span className='block break-normal sm:inline'>{mainEvent.bout.red.name}</span>{' '}
                    <span className='block text-crimson sm:inline'>vs.</span>{' '}
                    <span className='block break-normal sm:inline'>{mainEvent.bout.blue.name}</span>
                  </h1>
                  <p className='mt-4 max-w-2xl text-sm leading-relaxed text-metallic-platinum sm:text-base'>
                    {mainEvent.bout.isTitleFight
                      ? 'Combate de título'
                      : 'Evento principal'}{' '}
                    a {mainEvent.bout.scheduledRounds} asaltos en{' '}
                    {mainEvent.bout.weightDivisionLabel}. Cuotas decimales y americanas con
                    selecciones persistidas en PostgreSQL.
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
                    to='/sportsbook'
                    className='inline-flex items-center gap-2 border-brutal-crimson bg-crimson px-5 py-3 font-display text-xs font-extrabold uppercase tracking-wider text-white transition-colors duration-150 hover:bg-crimson-pure focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crimson/60'
                  >
                    <Swords size={16} aria-hidden='true' />
                    Abrir cartelera completa
                    <ArrowRight size={15} aria-hidden='true' />
                  </Link>
                  <span className='font-mono text-[10px] uppercase tracking-wide text-metallic-slate'>
                    {events.length} combates · {marketsPerBout} mercados por combate
                  </span>
                </div>

                {updatedAt && (
                  <p className='font-mono text-[9px] uppercase tracking-wide text-metallic-slate'>
                    Cuotas actualizadas {updatedAt} · Moneyline: consenso UFCalendar
                  </p>
                )}
              </>
            ) : (
              <div>
                <h1 className='font-display text-3xl font-black uppercase tracking-tightest text-white'>
                  Cartelera sin eventos
                </h1>
                <p className='mt-2 text-xs text-metallic-titanium'>
                  La API respondió sin combates programados.
                </p>
              </div>
            )}
          </div>
        </section>

        <section className='flex flex-col gap-4'>
          <div className='flex flex-wrap items-end justify-between gap-3 border-b border-obsidian-border pb-3'>
            <div className='min-w-0'>
              <p className='font-mono text-[9px] font-bold uppercase tracking-ultra text-crimson'>
                Cartelera estelar
              </p>
              <h2 className='mt-1 font-display text-lg font-black uppercase tracking-tight text-white'>
                Combates principales
              </h2>
            </div>
            <Link
              to='/sportsbook'
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
                <FeaturedBout key={event.id} event={event} />
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
            <div className='flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-brutal text-crimson'>
              <Database size={14} aria-hidden='true' />
              Datos persistidos
            </div>
            <p className='text-xs leading-relaxed text-metallic-titanium'>
              Eventos, mercados y selecciones viven en PostgreSQL bajo el esquema{' '}
              <span className='font-mono text-metallic-chrome'>events_markets</span>, con migraciones
              EF Core y seed idempotente.
            </p>
          </div>

          <div className='flex flex-col gap-2 border border-obsidian-border bg-obsidian-surface p-5'>
            <div className='flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-brutal text-gold-imperial'>
              <ShieldCheck size={14} aria-hidden='true' />
              Cuotas declaradas
            </div>
            <p className='text-xs leading-relaxed text-metallic-titanium'>
              Cada mercado indica su proveedor. Moneyline procede del consenso de UFCalendar; los
              mercados derivados se identifican como modelo ZenBet, no como línea oficial.
            </p>
          </div>

          <div className='flex flex-col gap-2 border border-obsidian-border bg-obsidian-surface p-5'>
            <div className='flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-brutal text-odds-live'>
              <Activity size={14} aria-hidden='true' />
              Boleto con GUID
            </div>
            <p className='text-xs leading-relaxed text-metallic-titanium'>
              Las selecciones de la tarjeta envían el identificador real de la API al boleto. El
              backend valida la billetera, el saldo y la idempotencia antes de aceptar la apuesta.
            </p>
          </div>
        </section>

        <p className='border-t border-obsidian-border pt-4 text-[10px] leading-relaxed text-metallic-slate'>
          Cartelera y cuotas con fines informativos. No se presentan mercados derivados como líneas
          oficiales. Juega de forma responsable.
        </p>
      </div>
    </div>
  );
}
