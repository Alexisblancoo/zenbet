import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarClock,
  Database,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Swords,
} from 'lucide-react';

import BetSlip from '@/components/BetSlip';
import { useBetSlip } from '@/context/betSlipState';
import type { SelectionInput } from '@/domain/bets';
import { formatDecimalOdds, type OddsQuote } from '@/domain/odds';
import {
  buildUfcCards,
  cardCity,
  eventsForBilling,
  findEventSource,
  findMarket,
  findSelectionByCode,
  findUfcCard,
  formatAmericanOdds,
  formatCardDayBadge,
  formatCardLongDate,
  formatFightDate,
  formatSnapshotAt,
  formatWeightDivision,
  ufcCardNumber,
  UFC_BILLING_SECTIONS,
  type UfcEvent,
  type UfcMarket,
  type UfcSelection,
} from '@/domain/ufc';
import { useUfcEvents } from '@/hooks/useUfcEvents';
import CardNav, { type CardSectionKey } from '../components/CardNav';
import CardSelector from '../components/CardSelector';
import FightCard from '../components/FightCard';
import FighterAvatar from '../components/FighterAvatar';
import HubStatusBadge from '../components/HubStatusBadge';
import SourceBadge from '../components/SourceBadge';

const SECTION_DESCRIPTIONS: Readonly<Record<string, string>> = {
  main: 'La cartelera estelar abre con el combate de título. Cuatro familias por pelea, sin cambiar de pestaña.',
  prelims: 'Combates previos al evento principal. Misma matriz de mercados y procedencia visible.',
  early_prelims: 'Apertura de la cartelera. Horarios sujetos a cambios de la organización.',
};

const EMPTY_EVENTS: readonly UfcEvent[] = [];

function SectionHeading({
  label,
  count,
  description,
  index,
}: {
  label: string;
  count: number;
  description: string;
  index: number;
}) {
  return (
    <div className='flex flex-wrap items-end justify-between gap-2 border-b border-white/[0.06] pb-2'>
      <div className='flex min-w-0 items-center gap-2.5'>
        <span className='font-odds text-[10px] font-bold tabular-nums text-crimson'>
          /{String(index + 1).padStart(2, '0')}
        </span>
        <h2 className='font-display text-[12px] font-bold uppercase tracking-wide text-white'>
          {label}
        </h2>
        <span className='border border-white/[0.07] bg-white/[0.025] px-1.5 py-0.5 font-mono text-[9px] font-bold tabular-nums text-metallic-slate'>
          {count}
        </span>
        <span className='hidden h-px w-10 bg-gradient-to-r from-crimson/40 to-transparent sm:block' aria-hidden='true' />
      </div>
      <p className='hidden max-w-xl text-right font-mono text-[9px] uppercase leading-relaxed tracking-wide text-metallic-slate lg:block'>
        {description}
      </p>
    </div>
  );
}

function LoadingCard() {
  return (
    <div className='overflow-hidden border border-white/[0.06] bg-[#090C12]'>
      <div className='h-[2px] w-full bg-white/[0.06]' />
      <div className='space-y-3 p-4'>
        <div className='h-2.5 w-24 animate-pulse bg-white/[0.05]' />
        <div className='h-5 w-2/3 animate-pulse bg-white/[0.06]' />
        <div className='grid grid-cols-2 gap-px border border-white/[0.05] bg-white/[0.05] md:grid-cols-4'>
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className='h-36 animate-pulse bg-[#0A0D14]' />
          ))}
        </div>
      </div>
    </div>
  );
}

function EventsError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className='shibuya-glass flex min-w-0 flex-col items-start gap-4 border-crimson/30 p-5'>
      <div className='flex items-start gap-3'>
        <AlertTriangle size={18} className='mt-0.5 shrink-0 text-crimson' aria-hidden='true' />
        <div className='min-w-0'>
          <h2 className='font-display text-sm font-bold uppercase tracking-wide text-white'>
            No se pudo cargar la cartelera
          </h2>
          <p className='mt-1 break-words text-xs leading-relaxed text-metallic-titanium'>{message}</p>
        </div>
      </div>
      <button
        type='button'
        onClick={onRetry}
        className='inline-flex items-center gap-2 border border-crimson/45 bg-crimson/10 px-3 py-2 font-display text-[10px] font-bold uppercase tracking-wide text-crimson transition-colors duration-150 hover:bg-crimson/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crimson/60'
      >
        <RefreshCw size={12} aria-hidden='true' />
        Reintentar
      </button>
    </div>
  );
}

function EventsEmpty() {
  return (
    <div className='shibuya-glass flex flex-col items-start gap-3 p-6'>
      <Database size={20} className='text-metallic-slate' aria-hidden='true' />
      <div>
        <h2 className='font-display text-sm font-bold uppercase tracking-wide text-white'>
          Cartelera sin eventos
        </h2>
        <p className='mt-1 max-w-xl text-xs leading-relaxed text-metallic-titanium'>
          No hay combates programados en este momento. Vuelve a consultar en unos minutos.
        </p>
      </div>
    </div>
  );
}

interface HeroPickProps {
  readonly market: UfcMarket;
  readonly selection: UfcSelection;
  readonly corner: 'red' | 'blue';
  readonly selected: boolean;
  readonly quote?: OddsQuote;
  readonly onToggle: (market: UfcMarket, selection: UfcSelection) => void;
}

function HeroPick({ market, selection, corner, selected, quote, onToggle }: HeroPickProps) {
  const odds =
    quote && quote.odds > 1 ? quote.odds : selection.decimalOdds;

  return (
    <button
      type='button'
      onClick={() => onToggle(market, selection)}
      aria-pressed={selected}
      aria-label={`${selection.name}: ${formatDecimalOdds(odds)} decimal, ${formatAmericanOdds(odds)} americana`}
      data-selected={selected}
      className='group flex min-h-[52px] min-w-0 items-center justify-between gap-3 border border-white/[0.12] bg-white/[0.035] px-3 py-2.5 text-left transition duration-150 hover:border-white/30 hover:bg-white/[0.06] active:translate-y-px focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-electric data-[selected=true]:border-money/80 data-[selected=true]:bg-money/[0.12] data-[selected=true]:shadow-[0_0_20px_-12px_rgb(16_185_129_/_0.8)]'
    >
      <span className='flex min-w-0 items-center gap-2'>
        <span
          className={`h-1.5 w-1.5 shrink-0 ${corner === 'red' ? 'bg-crimson' : 'bg-electric'}`}
          aria-hidden='true'
        />
        <span className='min-w-0'>
          <span className='block truncate font-display text-[12px] font-semibold uppercase tracking-wide text-white'>
            {selection.name}
          </span>
          <span className={`mt-0.5 block font-mono text-[9px] uppercase tracking-wide ${selected ? 'text-money' : 'text-metallic-titanium'}`}>
            {corner === 'red' ? 'Esquina roja' : 'Esquina azul'}
            {selected ? ' · en boleto' : ''}
          </span>
        </span>
      </span>
      <span className='flex shrink-0 items-baseline gap-2'>
        <span className={`odds-number text-base ${selected ? 'text-money' : 'text-white'}`}>
          {formatDecimalOdds(odds)}
        </span>
        <span className='font-mono text-[9px] font-semibold text-metallic-slate'>
          {formatAmericanOdds(odds)}
        </span>
      </span>
    </button>
  );
}

interface MainEventHeroProps {
  readonly event: UfcEvent;
  readonly boutCount: number;
  readonly marketCount: number;
  readonly selectionCount: number;
  readonly selectedIds: readonly string[];
  readonly oddsMap: Readonly<Record<string, OddsQuote>>;
  readonly onAddSelection: (selection: SelectionInput) => void;
  readonly onRemoveSelection: (selectionId: string) => void;
}

function MainEventHero({
  event,
  boutCount,
  marketCount,
  selectionCount,
  selectedIds,
  oddsMap,
  onAddSelection,
  onRemoveSelection,
}: MainEventHeroProps) {
  const { bout } = event;
  const source = findEventSource(event);
  const moneyline = findMarket(event, 'moneyline');
  const red = findSelectionByCode(moneyline, 'red');
  const blue = findSelectionByCode(moneyline, 'blue');
  const snapshot = formatSnapshotAt(source?.observedAt ?? null);

  const toggle = (market: UfcMarket, selection: UfcSelection) => {
    if (selectedIds.includes(selection.id)) {
      onRemoveSelection(selection.id);
      return;
    }

    onAddSelection({
      selectionId: selection.id,
      eventId: event.id,
      marketId: market.id,
      eventName: event.competition ? `${event.competition} · ${event.name}` : event.name,
      marketLabel: market.name,
      selectionName: selection.name,
      odds: oddsMap[selection.id]?.odds ?? selection.decimalOdds,
    });
  };

  return (
    <section
      aria-label={`Evento principal ${event.competition ?? 'UFC'}`}
      className='shibuya-hero relative overflow-hidden px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7'
    >
      <div className='shibuya-scan' aria-hidden='true' />
      <span
        aria-hidden='true'
        className='pointer-events-none absolute right-3 top-2 hidden select-none font-display text-[54px] font-black leading-none text-white/[0.022] lg:block'
      >
        渋谷夜市
      </span>

      <div className='relative grid gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.72fr)] lg:items-end'>
        <div className='min-w-0'>
          <div className='flex flex-wrap items-center gap-x-3 gap-y-1.5'>
            <span className='shibuya-kicker text-crimson'>Zenbet // Sportsbook</span>
            <span className='h-px w-4 bg-crimson/50' aria-hidden='true' />
            <span className='inline-flex items-center border border-crimson/40 bg-crimson/[0.08] px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-wide text-crimson'>
              {event.competition ?? 'UFC'}
            </span>
            <span className='shibuya-kicker text-metallic-titanium'>Night Card</span>
            <span className='inline-flex items-center gap-1 border border-electric/30 bg-electric/[0.08] px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-wide text-electric-soft'>
              <ShieldCheck size={9} aria-hidden='true' />
              {source?.kind === 'model' ? 'Línea de referencia' : 'Snapshot verificado'}
            </span>
          </div>

          <div className='mt-4 flex items-center gap-3 sm:gap-4'>
            <FighterAvatar fighter={bout.red} corner='red' size='hero' priority />
            <div className='flex items-center gap-2' aria-hidden='true'>
              <span className='h-px w-4 bg-crimson/40 sm:w-7' />
              <span className='font-mono text-[10px] font-bold tracking-ultra text-crimson sm:text-xs'>
                VS
              </span>
              <span className='h-px w-4 bg-electric/35 sm:w-7' />
            </div>
            <FighterAvatar fighter={bout.blue} corner='blue' size='hero' priority />
            <span className='ml-1 hidden border-l border-white/[0.08] pl-3 font-mono text-[9px] uppercase leading-relaxed tracking-wide text-metallic-slate sm:block'>
              Retratos oficiales
              <br />
              <span className='text-metallic-gunmetal'>Carga del roster UFC</span>
            </span>
          </div>

          <h1 className='shibuya-title-glow mt-3 max-w-5xl break-normal font-display text-[clamp(1.55rem,6.1vw,3.8rem)] font-bold uppercase leading-[0.98] tracking-tight text-white'>
            <span className='block'>{bout.red.name}</span>
            <span className='my-0.5 flex items-center gap-3 text-crimson'>
              <span className='h-px w-7 bg-crimson/60 sm:w-12' aria-hidden='true' />
              <span className='font-mono text-[0.34em] font-bold tracking-ultra text-crimson'>
                VS
              </span>
              <span className='h-px flex-1 bg-gradient-to-r from-crimson/50 to-transparent' aria-hidden='true' />
            </span>
            <span className='block'>{bout.blue.name}</span>
          </h1>

          <div className='mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[9px] uppercase tracking-wide text-metallic-titanium'>
            <span className='inline-flex items-center gap-1.5'>
              <Swords size={11} className='text-crimson' aria-hidden='true' />
              {formatWeightDivision(bout)}
            </span>
            <span className='inline-flex items-center gap-1.5'>
              <CalendarClock size={11} aria-hidden='true' />
              {formatFightDate(event.startTime)}
            </span>
            <span className='inline-flex items-center gap-1.5'>
              <MapPin size={11} aria-hidden='true' />
              {bout.venue} · {bout.location}
            </span>
          </div>

          <p className='mt-3 max-w-2xl text-[11px] leading-relaxed text-metallic-titanium sm:text-xs'>
            {bout.isTitleFight ? 'Combate de título' : 'Evento principal'} a {bout.scheduledRounds}{' '}
            asaltos. Moneyline, método, total de asaltos y decisión publicados por la misma fuente.
          </p>

          {moneyline && red && blue && (
            <div className='mt-4 grid max-w-2xl grid-cols-1 gap-2 sm:grid-cols-2'>
              <HeroPick
                market={moneyline}
                selection={red}
                corner='red'
                selected={selectedIds.includes(red.id)}
                quote={oddsMap[red.id]}
                onToggle={toggle}
              />
              <HeroPick
                market={moneyline}
                selection={blue}
                corner='blue'
                selected={selectedIds.includes(blue.id)}
                quote={oddsMap[blue.id]}
                onToggle={toggle}
              />
            </div>
          )}
        </div>

        <div className='shibuya-ticket relative hidden self-stretch p-4 sm:p-5 lg:block'>
          <div className='relative z-10 flex h-full flex-col'>
            <div className='flex items-start justify-between gap-3'>
              <div>
                <p className='shibuya-kicker text-metallic-slate'>
                  Night pass / {ufcCardNumber(event.competition ?? '') ?? 'FN'}
                </p>
                <p className='mt-1 font-display text-2xl font-bold uppercase leading-none tracking-tight text-white'>
                  {event.competition ?? 'UFC'}
                </p>
              </div>
              <span className='border border-crimson/40 bg-crimson/[0.08] px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wide text-crimson'>
                {formatCardDayBadge(event.startTime)}
              </span>
            </div>

            <p className='mt-3 font-mono text-[9px] uppercase leading-relaxed tracking-wide text-metallic-slate'>
              {bout.venue}
              <br />
              {bout.location}
            </p>

            <dl className='mt-4 grid grid-cols-3 divide-x divide-white/[0.07] border-y border-white/[0.07]'>
              <div className='py-2 pr-2'>
                <dt className='font-mono text-[9px] uppercase tracking-wide text-metallic-slate'>
                  Luchas
                </dt>
                <dd className='mt-0.5 font-odds text-lg font-bold tabular-nums text-white'>
                  {boutCount}
                </dd>
              </div>
              <div className='px-2 py-2'>
                <dt className='font-mono text-[9px] uppercase tracking-wide text-metallic-slate'>
                  Mercados
                </dt>
                <dd className='mt-0.5 font-odds text-lg font-bold tabular-nums text-white'>
                  {marketCount}
                </dd>
              </div>
              <div className='py-2 pl-2'>
                <dt className='font-mono text-[9px] uppercase tracking-wide text-metallic-slate'>
                  Cuotas
                </dt>
                <dd className='mt-0.5 font-odds text-lg font-bold tabular-nums text-electric-soft'>
                  {selectionCount}
                </dd>
              </div>
            </dl>

            <div className='mt-3'>
              <SourceBadge source={source} />
              <p className='mt-2 line-clamp-2 font-mono text-[9px] uppercase leading-relaxed tracking-wide text-metallic-slate'>
                {source?.note ?? 'Cuota de referencia. Verifica la casa antes de apostar.'}
              </p>
            </div>

            <div className='mt-auto flex items-end justify-between gap-3 pt-4'>
              <div>
                <p className='font-mono text-[9px] uppercase tracking-wide text-metallic-slate'>
                  Observado
                </p>
                <p className='mt-0.5 font-mono text-[9px] uppercase tracking-wide text-metallic-titanium'>
                  {snapshot ?? 'Snapshot local'}
                </p>
              </div>
              <div className='flex h-7 items-end gap-[2px]' aria-hidden='true'>
                {[3, 6, 2, 7, 4, 6, 3, 5, 7, 2, 4, 6, 3, 5, 7, 4, 2, 6, 3, 5].map((height, index) => (
                  <span
                    key={index}
                    className='w-[2px] bg-white/30'
                    style={{ height: `${height * 3 + 4}px` }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function MmaEventsPage() {
  const { events, isLoading, error, reload } = useUfcEvents();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    selections,
    quotes,
    hubStatus,
    lastUpdateAt,
    setVisibleMarkets,
    addSelection,
    removeSelection,
  } = useBetSlip();

  const [activeSection, setActiveSection] = useState<CardSectionKey>('all');

  const cards = useMemo(() => buildUfcCards(events), [events]);
  const activeCard = findUfcCard(cards, searchParams.get('card'));
  const activeKey = activeCard?.key ?? null;
  const activeEvents = activeCard?.events ?? EMPTY_EVENTS;

  useEffect(() => {
    setActiveSection('all');
  }, [activeKey]);

  const handleSelectCard = useCallback(
    (key: string) => {
      const next = new URLSearchParams(searchParams);
      next.set('card', key);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const marketIds = useMemo(
    () => [...new Set(activeEvents.flatMap((event) => event.markets.map((market) => market.id)))],
    [activeEvents],
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

  const mainEvent = activeCard?.mainEvent;

  const groupedEvents = useMemo(
    () =>
      UFC_BILLING_SECTIONS.map((section) => ({
        ...section,
        events: eventsForBilling(activeEvents, section.key),
      })).filter((section) => section.events.length > 0),
    [activeEvents],
  );

  const sectionCounts = useMemo(
    () =>
      UFC_BILLING_SECTIONS.map((section) => ({
        key: section.key,
        label: section.label,
        shortLabel: section.shortLabel,
        count: eventsForBilling(activeEvents, section.key).length,
      })),
    [activeEvents],
  );

  const visibleSections =
    activeSection === 'all'
      ? groupedEvents
      : groupedEvents.filter((section) => section.key === activeSection);

  const marketCount = activeEvents.reduce((count, event) => count + event.markets.length, 0);
  const selectionCount = activeEvents.reduce(
    (count, event) =>
      count + event.markets.reduce((sum, market) => sum + market.selections.length, 0),
    0,
  );
  const globalSource = useMemo(
    () =>
      activeEvents
        .map(findEventSource)
        .find((source) => source !== null) ?? null,
    [activeEvents],
  );

  return (
    <div className='shibuya-page min-h-full pb-6 min-[1400px]:pb-0'>
      <CardNav
        eventName={mainEvent?.competition ?? 'UFC'}
        dateLabel={mainEvent ? formatFightDate(mainEvent.startTime) : 'Próximo sábado'}
        marketCount={marketCount}
        sections={sectionCounts}
        activeSection={activeSection}
        observedAt={globalSource?.observedAt ?? null}
        sourceName={globalSource?.name ?? null}
        onSectionChange={setActiveSection}
      />

      <div className='mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-3 py-4 sm:px-4 sm:py-5 lg:px-6'>
        <CardSelector cards={cards} activeKey={activeKey} onSelect={handleSelectCard} />

        {mainEvent && (
          <MainEventHero
            event={mainEvent}
            boutCount={activeEvents.length}
            marketCount={marketCount}
            selectionCount={selectionCount}
            selectedIds={selectedIds}
            oddsMap={quotes}
            onAddSelection={handleAddSelection}
            onRemoveSelection={removeSelection}
          />
        )}

        <div className='flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-2.5'>
          <div className='flex min-w-0 items-center gap-3'>
            <span className='shibuya-kicker text-crimson'>
              / {mainEvent ? formatCardDayBadge(mainEvent.startTime) : 'CARD'}
            </span>
            <h2 className='font-display text-sm font-bold uppercase tracking-tight text-white'>
              Cartelera completa
            </h2>
            <span className='hidden font-mono text-[9px] uppercase tracking-wide text-metallic-slate sm:inline'>
              {activeEvents.length} combates · {marketCount} mercados · {selectionCount} cuotas
            </span>
          </div>
          <div className='flex flex-wrap items-center gap-2'>
            <HubStatusBadge status={hubStatus} lastUpdateAt={lastUpdateAt} />
            <span className='border border-white/[0.07] bg-white/[0.02] px-2 py-1.5 font-mono text-[8px] font-bold uppercase tracking-brutal text-metallic-slate'>
              {isLoading ? 'Cargando' : `${activeEvents.length} combates`}
            </span>
          </div>
        </div>

        <div className='grid grid-cols-1 items-start gap-4 min-[1400px]:grid-cols-[minmax(0,1fr)_360px] min-[1400px]:gap-5'>
          <div className='flex min-w-0 flex-col gap-5'>
            {isLoading && events.length === 0 && (
              <div className='flex flex-col gap-3' aria-busy='true' aria-label='Cargando cartelera'>
                <LoadingCard />
                <LoadingCard />
              </div>
            )}

            {!isLoading && error && <EventsError message={error} onRetry={reload} />}

            {!isLoading && !error && activeEvents.length === 0 && <EventsEmpty />}

            {visibleSections.map((section, index) => (
              <section
                key={section.key}
                aria-labelledby={`section-${section.key}`}
                className='flex min-w-0 flex-col gap-2.5'
              >
                <div id={`section-${section.key}`}>
                  <SectionHeading
                    label={section.label}
                    count={section.events.length}
                    description={SECTION_DESCRIPTIONS[section.key] ?? ''}
                    index={index}
                  />
                </div>
                <div className='flex flex-col gap-3'>
                  {section.events.map((event) => (
                    <FightCard
                      key={event.id}
                      event={event}
                      featured={event.id === mainEvent?.id}
                      selectedIds={selectedIds}
                      onAddSelection={handleAddSelection}
                      onRemoveSelection={removeSelection}
                      oddsMap={quotes}
                    />
                  ))}
                </div>
              </section>
            ))}

            {visibleSections.length === 0 && !isLoading && !error && activeEvents.length > 0 && (
              <p className='shibuya-glass p-5 text-xs text-metallic-titanium'>
                No hay combates en esta sección.
              </p>
            )}

            <footer className='mt-2 border-t border-white/[0.06] pt-4'>
              <div className='grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end'>
                <div className='min-w-0 space-y-2'>
                  <div className='flex flex-wrap items-center gap-2'>
                    <SourceBadge source={globalSource} />
                    <span className='font-mono text-[9px] uppercase tracking-wide text-metallic-slate'>
                      {globalSource
                        ? `${globalSource.name} · ${
                            globalSource.kind === 'model' ? 'modelo de referencia' : 'promedio de casas'
                          } · snapshot`
                        : 'Procedencia no declarada'}
                    </span>
                  </div>
                  <p className='max-w-3xl text-[10px] leading-relaxed text-metallic-slate'>
                    Las cuatro familias (Moneyline, método de victoria, total de asaltos y decisión)
                    provienen del mismo snapshot de {globalSource?.name ?? 'la fuente declarada'}.
                    Son cuotas de referencia, no una cuota ejecutable ni un feed en vivo. Verifica
                    la casa antes de apostar.
                  </p>
                  {mainEvent && (
                    <p className='max-w-3xl text-[10px] leading-relaxed text-metallic-slate'>
                      Cartelera: {mainEvent.competition ?? 'UFC'} ·{' '}
                      {formatCardLongDate(mainEvent.startTime)} · {mainEvent.bout.venue},{' '}
                      {cardCity(mainEvent.bout.location)}.
                    </p>
                  )}
                </div>
                <div className='text-left md:text-right'>
                  <p className='font-display text-[10px] font-bold uppercase tracking-wide text-white/65'>
                    Shibuya Yoichi
                  </p>
                  <p className='mt-0.5 font-mono text-[9px] uppercase tracking-wide text-metallic-slate'>
                    渋谷夜市 · Editorial reference
                  </p>
                  <p className='mt-2 font-mono text-[8px] uppercase tracking-wide text-metallic-slate'>
                    ZenBet · Shibuya Night Edition
                  </p>
                </div>
              </div>
            </footer>
          </div>

          <div
            id='bet-slip'
            className='hidden min-w-0 min-[1400px]:sticky min-[1400px]:top-32 min-[1400px]:block'
          >
            <BetSlip
              minStake={50}
              maxStake={5000}
              className='min-[1400px]:max-h-[calc(100vh_-_9rem)]'
            />
          </div>
        </div>
      </div>
    </div>
  );
}
