import { memo, useCallback, useDeferredValue, useEffect, useId, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarClock,
  Check,
  Database,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Swords,
} from 'lucide-react';

import BetSlip from '@/components/BetSlip';
import { useBetSlip } from '@/context/betSlipState';
import { useFightHubState } from '@/context/fightHubState';
import type { SelectionInput } from '@/domain/bets';
import { formatDecimalOdds, type OddsQuote } from '@/domain/odds';
import {
  parseSportsbookSport,
  SPORTSBOOK_SPORT_BY_ID,
  type SportsbookSportId,
} from '@/domain/sportsbook';
import {
  applyFightUpdates,
  buildUfcCards,
  cardCity,
  cardKeyForEvent,
  eventsForBilling,
  findEventSource,
  findMarket,
  findSelectionByCode,
  findUfcCard,
  findUfcHero,
  fightResultLabel,
  fightStatusLabel,
  formatAmericanOdds,
  formatCardDayBadge,
  formatCardLongDate,
  formatFightClock,
  formatFightDate,
  formatFighterStance,
  formatRank,
  formatSnapshotAt,
  formatWeightDivision,
  isEventHeroEligible,
  isTerminalEventStatus,
  ufcCardNumber,
  UFC_BILLING_SECTIONS,
  UFC_MARKET_FAMILIES,
  displaySourceName,
  formatFightDay,
  shortFighterName,
  type UfcEvent,
  type UfcFighter,
  type UfcMarket,
  type UfcSelection,
} from '@/domain/ufc';
import { useUfcEvents } from '@/hooks/useUfcEvents';
import { useFootballEvents } from '@/hooks/useFootballEvents';
import FootballEventsSection from '../components/FootballEventsSection';
import CardNav, { type CardSectionKey } from '../components/CardNav';
import FighterSearch from '../components/FighterSearch';
import FightCard from '../components/FightCard';
import FighterAvatar from '../components/FighterAvatar';
import FighterComparisonModal from '../components/FighterComparisonModal';
import HubStatusBadge from '../components/HubStatusBadge';
import SourceBadge from '../components/SourceBadge';
import SportComingSoon from '../components/SportComingSoon';
import SportsBentoGrid from '../components/SportsBentoGrid';
import VenueAnimalGrid, { type VenueCardItem } from '../components/VenueAnimalGrid';
import SportsbookHeroBanner from '../components/SportsbookHeroBanner';
import { getCountryFlagEmoji } from '@/utils/countryFlags';

const SECTION_DESCRIPTIONS: Readonly<Record<string, string>> = {
  main: 'La cartelera estelar abre con el combate de título. Cuatro familias por pelea, sin cambiar de pestaña.',
  prelims: 'Combates previos al evento principal. Misma matriz de mercados y procedencia visible.',
  early_prelims: 'Apertura de la cartelera. Horarios sujetos a cambios de la organización.',
};

const EMPTY_EVENTS: readonly UfcEvent[] = [];

const MARKET_TICKS: Readonly<Record<string, string>> = {
  moneyline: 'bg-crimson',
  method_of_victory: 'bg-sage',
  total_rounds: 'bg-white/70',
  go_to_decision: 'bg-metallic-titanium',
};

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
        <span className='hidden h-px w-10 bg-linear-to-r from-crimson/40 to-transparent sm:block' aria-hidden='true' />
      </div>
      <p className='hidden max-w-xl text-right font-mono text-[9px] uppercase leading-relaxed tracking-wide text-metallic-slate lg:block'>
        {description}
      </p>
    </div>
  );
}

function LoadingCard() {
  return (
    <div className='overflow-hidden border border-white/[0.06] bg-[#0C0C0C]'>
      <div className='h-[2px] w-full bg-white/[0.06]' />
      <div className='space-y-3 p-4'>
        <div className='h-2.5 w-24 animate-pulse bg-white/[0.05]' />
        <div className='h-5 w-2/3 animate-pulse bg-white/[0.06]' />
        <div className='grid grid-cols-2 gap-px border border-white/[0.05] bg-white/[0.05] md:grid-cols-4'>
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className='h-36 animate-pulse bg-[#111111]' />
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
  readonly closed?: boolean;
}

function HeroPick({
  market,
  selection,
  corner,
  selected,
  quote,
  onToggle,
  closed = false,
}: HeroPickProps) {
  const odds = quote && quote.odds > 1 ? quote.odds : selection.decimalOdds;
  const isRed = corner === 'red';
  const isSelected = selected && !closed;

  return (
    <button
      type='button'
      onClick={() => onToggle(market, selection)}
      disabled={closed}
      aria-pressed={isSelected}
      aria-label={`${selection.name}: ${formatDecimalOdds(odds)} decimal, ${formatAmericanOdds(odds)} americana${isSelected ? ', seleccionada' : ''}${closed ? ', mercado cerrado' : ''}`}
      data-selected={isSelected}
      data-trend={quote?.trend ?? 'unchanged'}
      data-closed={closed}
      className={`hero-pick group relative flex min-h-[68px] min-w-0 flex-col justify-between gap-2 overflow-hidden rounded-lg border p-3 text-left transition duration-150 active:translate-y-px focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sage ${
        closed
          ? 'cursor-not-allowed border-white/[0.05] bg-[#050505] opacity-55 grayscale'
          : isRed
            ? 'border-crimson/25 bg-crimson/[0.05] hover:border-crimson/50 hover:bg-crimson/[0.09]'
            : 'border-sage/25 bg-sage/[0.05] hover:border-sage/50 hover:bg-sage/[0.09]'
      } ${
        closed
          ? ''
          : 'data-[selected=true]:border-lime-400/80 data-[selected=true]:bg-lime-400/[0.1] data-[selected=true]:shadow-[0_0_24px_-14px_rgb(212_255_63_/_0.95)]'
      }`}
    >
      <span className='flex items-center justify-between gap-2'>
        <span
          className={`inline-flex items-center gap-1.5 font-mono text-[8px] font-bold uppercase tracking-ultra ${
            isRed ? 'text-crimson' : 'text-electric-soft'
          }`}
        >
          <span className={`h-1.5 w-1.5 ${isRed ? 'bg-crimson' : 'bg-electric'}`} aria-hidden='true' />
          {isRed ? 'Roja' : 'Azul'} · Moneyline
        </span>
        {isSelected ? (
          <Check size={12} strokeWidth={3} className='text-lime-400' aria-hidden='true' />
        ) : (
          <span className='font-mono text-[8px] uppercase tracking-wide text-metallic-slate'>
            {closed ? 'Cerrado' : '2 vías'}
          </span>
        )}
      </span>

      <span className='flex min-w-0 items-end justify-between gap-2'>
        <span className='min-w-0'>
          <span className='block truncate font-display text-[12px] font-bold uppercase tracking-wide text-white sm:text-[13px]'>
            {selection.name}
          </span>
          <span
            className={`mt-0.5 block font-mono text-[8px] uppercase tracking-wide ${
              isSelected ? 'text-lime-400' : 'text-metallic-slate'
            }`}
          >
            {isSelected ? 'En boleto' : closed ? 'Mercado cerrado' : 'Toca para agregar'}
          </span>
        </span>
        <span className='flex shrink-0 items-baseline gap-1.5'>
          <span
            key={quote?.sequence ?? 'snapshot'}
            className={`odds-number text-lg ${isSelected ? 'text-lime-400' : 'text-white'}`}
          >
            {formatDecimalOdds(odds)}
          </span>
          <span className='font-mono text-[8px] font-semibold text-metallic-slate'>
            {formatAmericanOdds(odds)}
          </span>
        </span>
      </span>
    </button>
  );
}

function formatPercent(value: number | null): string {
  return value === null ? '—' : `${Math.round(value)}%`;
}

function ArenaFighter({ fighter, corner }: { readonly fighter: UfcFighter; readonly corner: 'red' | 'blue' }) {
  const isRed = corner === 'red';

  return (
    <div
      className={`relative flex min-w-0 flex-col gap-2 ${
        isRed ? 'items-start text-left' : 'items-end text-right'
      }`}
    >
      <span
        className={`font-mono text-[8px] font-bold uppercase tracking-ultra ${
          isRed ? 'text-crimson' : 'text-electric-soft'
        }`}
      >
        {isRed ? 'Esquina roja' : 'Esquina azul'}
      </span>

      <FighterAvatar fighter={fighter} corner={corner} size='hero' priority />

      <h2 className='max-w-full break-words font-display text-[clamp(1.05rem,3.2vw,2rem)] font-bold uppercase leading-[0.95] tracking-tight text-white'>
        {fighter.name}
      </h2>

      <div
        className={`flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[9px] uppercase tracking-wide text-metallic-titanium ${
          isRed ? '' : 'justify-end'
        }`}
      >
        <span className='text-white/80'>{fighter.record}</span>
        <span className='h-2.5 w-px bg-white/10' aria-hidden='true' />
        <span>{formatRank(fighter)}</span>
        {fighter.countryCode ? (
          <>
            <span className='h-2.5 w-px bg-white/10' aria-hidden='true' />
            <span className='inline-flex items-center gap-1'>
              {getCountryFlagEmoji(fighter.countryCode) ? (
                <span className='text-[10px] leading-none' aria-hidden='true'>
                  {getCountryFlagEmoji(fighter.countryCode)}
                </span>
              ) : null}
              <span>{fighter.countryCode}</span>
            </span>
          </>
        ) : null}
      </div>

      <div
        className={`hidden flex-wrap items-center gap-1.5 font-mono text-[8px] uppercase tracking-wide sm:flex ${
          isRed ? '' : 'justify-end'
        }`}
      >
        <span className='border border-white/[0.08] bg-white/[0.025] px-1.5 py-0.5 text-metallic-slate'>
          {formatFighterStance(fighter.stance)}
        </span>
        <span className='border border-white/[0.08] bg-white/[0.025] px-1.5 py-0.5 text-metallic-slate'>
          {formatPercent(fighter.winRate)} victorias
        </span>
      </div>
    </div>
  );
}

function StatChip({
  label,
  value,
  accent = false,
}: {
  readonly label: string;
  readonly value: number;
  readonly accent?: boolean;
}) {
  return (
    <span className='inline-flex items-baseline gap-1.5 border border-white/[0.07] bg-white/[0.025] px-2 py-1 font-mono text-[8px] uppercase tracking-wide text-metallic-slate'>
      {label}
      <span
        className={`font-odds text-sm font-bold tabular-nums ${
          accent ? 'text-sage' : 'text-white'
        }`}
      >
        {value}
      </span>
    </span>
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

const MainEventHero = memo(function MainEventHero({
  event,
  boutCount,
  marketCount,
  selectionCount,
  selectedIds,
  oddsMap,
  onAddSelection,
  onRemoveSelection,
}: MainEventHeroProps) {
  if (!isEventHeroEligible(event)) return null;

  const { bout } = event;
  const source = findEventSource(event);
  const moneyline = findMarket(event, 'moneyline');
  const red = findSelectionByCode(moneyline, 'red');
  const blue = findSelectionByCode(moneyline, 'blue');
  const snapshot = formatSnapshotAt(source?.observedAt ?? null);
  const cardNumber = ufcCardNumber(event.competition ?? '');
  const isFinished = event.isExpired || isTerminalEventStatus(event.status);
  const isClosed = isFinished || !event.isBettingOpen;
  const clockLabel = formatFightClock(event.clock);
  const statusLabel = isClosed
    ? isFinished
      ? 'FINALIZADO'
      : 'SUSPENDIDO'
    : clockLabel ?? fightStatusLabel(event);
  const resultLabel = fightResultLabel(event.result);

  const toggle = (market: UfcMarket, selection: UfcSelection) => {
    if (isClosed) return;

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
      eventStatus: event.status,
      eventEndsAt: event.endsAt,
      eventIsExpired: event.isExpired,
      eventIsBettingOpen: event.isBettingOpen,
    });
  };

  return (
    <section
      aria-label={`Evento principal ${event.competition ?? 'UFC'}`}
      data-closed={isClosed}
      data-expired={event.isExpired}
      data-effective-status={event.status}
      className='shibuya-hero relative overflow-hidden rounded-2xl'
    >
      <div className='shibuya-scan' aria-hidden='true' />
      <h1 className='sr-only'>
        {event.competition
          ? `${event.competition}: ${bout.red.name} vs ${bout.blue.name}`
          : event.name}
      </h1>

      <div className='relative flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-3 sm:px-6'>
        <div className='flex flex-wrap items-center gap-x-3 gap-y-1.5'>
          <span className='shibuya-kicker text-crimson'>Zenbet // Sportsbook</span>
          <span className='font-mono text-[7px] uppercase tracking-wider text-metallic-slate/35'>ЛИНИЯ</span>
          <span className='h-px w-4 bg-crimson/50' aria-hidden='true' />
          <span className='inline-flex items-center border border-crimson/40 bg-crimson/[0.08] px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-wide text-crimson'>
            {event.competition ?? 'UFC'}
          </span>
        </div>

        <div className='flex flex-wrap items-center gap-3 font-mono text-[9px] uppercase tracking-wide text-metallic-slate'>
          <span
            className={`inline-flex items-center gap-1.5 border px-1.5 py-0.5 font-bold ${
              isClosed
                ? 'border-white/10 bg-white/[0.03] text-metallic-slate'
                : event.status === 'live'
                  ? 'border-lime-400/40 bg-lime-400/[0.09] text-lime-400'
                  : 'border-white/[0.08] bg-white/[0.025] text-metallic-titanium'
            }`}
          >
            {!isClosed && event.status === 'live' && (
              <span className='h-1.5 w-1.5 animate-pulse rounded-full bg-lime-400' aria-hidden='true' />
            )}
            {statusLabel}
          </span>
          <span>{formatCardDayBadge(event.startTime)}</span>
          <span className='h-3 w-px bg-white/10' aria-hidden='true' />
          <span>{cardNumber ? `UFC ${cardNumber}` : 'Fight Night'}</span>
        </div>
      </div>

      {resultLabel && (
        <div className='relative border-b border-white/[0.07] bg-[#050505]/70 px-4 py-2 font-mono text-[9px] font-bold uppercase tracking-wide text-metallic-titanium sm:px-6'>
          <span className='mr-2 text-lime-400/85'>Resultado final</span>{' '}
          {resultLabel}
        </div>
      )}

      <div className='relative overflow-hidden'>
        <div
          aria-hidden='true'
          className='pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(239,68,68,0.09),transparent_38%,transparent_62%,rgba(56,189,248,0.075))]'
        />
        <div className='relative grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-4 py-5 sm:gap-6 sm:px-6 sm:py-6 lg:gap-10 lg:px-8'>
          <ArenaFighter fighter={bout.red} corner='red' />

          <div className='flex min-w-[54px] flex-col items-center gap-2 text-center'>
            <span className='font-mono text-[8px] font-bold uppercase tracking-ultra text-metallic-slate'>
              Main event
            </span>
            <span className='grid h-11 w-11 place-items-center rounded-full border border-crimson/45 bg-[#131313] font-odds text-sm font-bold tracking-wide text-crimson shadow-[0_0_30px_-12px_rgb(239_68_68_/_0.9)] sm:h-14 sm:w-14 sm:text-base'>
              VS
            </span>
            <span className='font-mono text-[9px] font-bold uppercase leading-tight tracking-wide text-metallic-titanium'>
              {formatWeightDivision(bout)}
            </span>
            <span className='font-mono text-[8px] uppercase tracking-wide text-metallic-slate'>
              {bout.scheduledRounds} asaltos
            </span>
            {bout.isTitleFight && (
              <span className='inline-flex items-center gap-1 border border-crimson/35 bg-crimson/[0.08] px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-wide text-crimson'>
                <ShieldCheck size={8} aria-hidden='true' />
                Título
              </span>
            )}
          </div>

          <ArenaFighter fighter={bout.blue} corner='blue' />
        </div>
      </div>

      {moneyline && red && blue && (
        <div className='relative grid grid-cols-1 gap-2 border-t border-white/[0.07] px-4 py-3 sm:grid-cols-2 sm:px-6 lg:px-8'>
          <HeroPick
            market={moneyline}
            selection={red}
            corner='red'
            selected={selectedIds.includes(red.id)}
            quote={oddsMap[red.id]}
            onToggle={toggle}
            closed={isClosed}
          />
          <HeroPick
            market={moneyline}
            selection={blue}
            corner='blue'
            selected={selectedIds.includes(blue.id)}
            quote={oddsMap[blue.id]}
            onToggle={toggle}
            closed={isClosed}
          />
        </div>
      )}

      <div className='relative border-t border-white/[0.07] px-4 py-3 sm:px-6'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div className='flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[9px] uppercase tracking-wide text-metallic-titanium'>
            <span className='inline-flex items-center gap-1.5'>
              <Swords size={11} className='text-crimson' aria-hidden='true' />
              {formatWeightDivision(bout)}
            </span>
            <span className='inline-flex items-center gap-1.5'>
              <CalendarClock size={11} aria-hidden='true' />
              {formatFightDate(event.startTime)}
            </span>
            <span className='inline-flex min-w-0 items-center gap-1.5'>
              <MapPin size={11} className='shrink-0' aria-hidden='true' />
              <span className='truncate'>
                {bout.venue}
                {bout.location ? ` · ${bout.location}` : ''}
              </span>
            </span>
          </div>

          <div className='flex flex-wrap items-center gap-2'>
            <StatChip label='Luchas' value={boutCount} />
            <StatChip label='Mercados' value={marketCount} />
            <StatChip label='Cuotas' value={selectionCount} accent />
          </div>
        </div>

        <div className='mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.05] pt-2'>
          <div className='flex min-w-0 items-center gap-2'>
            <SourceBadge source={source} />
            <p className='min-w-0 truncate font-mono text-[8px] uppercase tracking-wide text-metallic-slate'>
              {source?.note ?? 'Cuota de referencia. Verifica la casa antes de apostar.'}
            </p>
          </div>
          <span className='font-mono text-[8px] uppercase tracking-wide text-metallic-slate'>
            Observado {snapshot ?? 'Snapshot local'}
          </span>
        </div>
      </div>
    </section>
  );
});

function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

const searchHaystackCache = new WeakMap<UfcEvent, string>();

function getEventHaystack(event: UfcEvent): string {
  let cached = searchHaystackCache.get(event);
  if (cached === undefined) {
    const { red, blue, weightDivisionLabel } = event.bout;
    cached = [
      red.name,
      blue.name,
      red.country,
      blue.country,
      weightDivisionLabel,
      event.name,
      event.competition ?? '',
    ]
      .map(normalizeSearch)
      .join(' | ');
    searchHaystackCache.set(event, cached);
  }
  return cached;
}

/** Coincidencia optimizada con haystack indexado en WeakMap */
function eventMatches(event: UfcEvent, term: string): boolean {
  const haystack = getEventHaystack(event);
  return term.split(/\s+/).every((part) => haystack.includes(part));
}

export default function MmaEventsPage() {
  const { events: sourceEvents, isLoading, error, reload } = useUfcEvents();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    selections,
    quotes,
    hubStatus,
    lastUpdateAt,
    setVisibleMarkets,
    syncEventLifecycle,
    addSelection,
    removeSelection,
  } = useBetSlip();

  const [activeSection, setActiveSection] = useState<CardSectionKey>('all');
  const [comparisonEvent, setComparisonEvent] = useState<UfcEvent | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const activeSport = parseSportsbookSport(searchParams.get('sport'));
  const activeSportDefinition =
    SPORTSBOOK_SPORT_BY_ID.get(activeSport) ?? SPORTSBOOK_SPORT_BY_ID.get('mma')!;
  const isMma = activeSport === 'mma';

  // Red de seguridad para el cierre por horario: si SignalR no entrega el
  // update final, la página reevalúa `endsAt` sin esperar a una recarga.
  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const baseCards = useMemo(() => buildUfcCards(sourceEvents), [sourceEvents]);
  const watchedEventIds = useMemo(
    () => sourceEvents.map((event) => event.id),
    [sourceEvents],
  );
  const watchedCardKeys = useMemo(() => baseCards.map((card) => card.key), [baseCards]);
  const fightHub = useFightHubState();
  const { watchEvents, unwatchEvents, watchCards, unwatchCards } = fightHub;
  const fightHubOwnerId = useId();

  useEffect(() => {
    watchEvents(fightHubOwnerId, watchedEventIds);
  }, [fightHubOwnerId, watchedEventIds, watchEvents]);

  useEffect(() => {
    watchCards(fightHubOwnerId, watchedCardKeys);
  }, [fightHubOwnerId, watchedCardKeys, watchCards]);

  useEffect(
    () => () => {
      unwatchEvents(fightHubOwnerId);
      unwatchCards(fightHubOwnerId);
    },
    [fightHubOwnerId, unwatchCards, unwatchEvents],
  );

  // SignalR no reproduce mensajes perdidos. Al reconectar, se refresca la
  // cartelera por REST y se descartan los mapas de updates anteriores.
  useEffect(() => {
    if (fightHub.reconnectCount === 0) return;
    reload();
  }, [fightHub.reconnectCount, reload]);

  const events = useMemo(() => {
    const updated = applyFightUpdates(
      sourceEvents,
      fightHub.updates,
      fightHub.clocks,
      nowMs,
    );

    // El agregado de cartelera es una red de seguridad: si un update de pelea
    // se pierde, un `ReceiveCardUpdate` final igual cierra todos sus mercados.
    return updated.map((event) => {
      const cardUpdate = fightHub.cardUpdates[cardKeyForEvent(event)];
      if (!cardUpdate || cardUpdate.status !== 'finished') return event;
      if (event.isExpired && !event.isBettingOpen) return event;
      return { ...event, isExpired: true, isBettingOpen: false };
    });
  }, [sourceEvents, fightHub.updates, fightHub.clocks, fightHub.cardUpdates, nowMs]);

  const mmaEvents = useMemo(
    () => events.filter((event) => event.sportKey === 'mma'),
    [events],
  );
  const sportEvents = useMemo(
    () =>
      events.filter((event) =>
        activeSportDefinition.eventSportKeys.includes(event.sportKey),
      ),
    [activeSportDefinition.eventSportKeys, events],
  );
  const cards = useMemo(() => buildUfcCards(sportEvents), [sportEvents]);
  const activeCard = findUfcCard(cards, searchParams.get('card'), nowMs);
  const activeKey = activeCard?.key ?? null;
  const activeEvents = useMemo(
    () => activeCard?.events ?? EMPTY_EVENTS,
    [activeCard],
  );
  const hero = useMemo(
    () => findUfcHero(cards, activeCard?.key ?? null, nowMs),
    [activeCard?.key, cards, nowMs],
  );
  const heroCard = hero?.card;
  const heroEvent = hero?.event;
  const [lastActiveKey, setLastActiveKey] = useState(activeKey);

  // Cambiar de cartelera reinicia la sección y cierra la ficha comparativa sin
  // esperar a un efecto posterior al pintado.
  if (lastActiveKey !== activeKey) {
    setLastActiveKey(activeKey);
    setActiveSection('all');
    setComparisonEvent(null);
  }

  const handleSelectCard = useCallback(
    (key: string) => {
      const next = new URLSearchParams(searchParams);
      next.set('card', key);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const handleSelectSport = useCallback(
    (sport: SportsbookSportId) => {
      const currentSport = parseSportsbookSport(searchParams.get('sport'));
      if (sport === currentSport) return;

      const next = new URLSearchParams(searchParams);
      if (sport === 'mma') next.delete('sport');
      else next.set('sport', sport);
      next.delete('card');

      setSearchParams(next, { replace: true });
      setActiveSection('all');
      setComparisonEvent(null);
    },
    [searchParams, setSearchParams],
  );

  const [selectedFootballCompetitionId, setSelectedFootballCompetitionId] = useState<string | null>(null);

  const handleSelectFootballCompetition = useCallback((id: string) => {
    setSelectedFootballCompetitionId(id === 'all' ? null : id);
  }, []);

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

  const eventLifecycle = useMemo(
    () =>
      events.map((event) => ({
        eventId: event.id,
        status: event.status,
        endsAt: event.endsAt,
        isExpired: event.isExpired,
        isBettingOpen: event.isBettingOpen,
      })),
    [events],
  );

  useEffect(() => {
    syncEventLifecycle(eventLifecycle);
  }, [eventLifecycle, syncEventLifecycle]);

  const handleAddSelection = useCallback(
    (selection: SelectionInput) => {
      addSelection(selection);
    },
    [addSelection],
  );

  const handleOpenComparison = useCallback((event: UfcEvent) => {
    setComparisonEvent(event);
  }, []);

  const mainEvent = activeCard?.mainEvent;
  const liveComparisonEvent = comparisonEvent
    ? (events.find((event) => event.id === comparisonEvent.id) ?? comparisonEvent)
    : null;
  const fightHubLabel =
    fightHub.status === 'connected'
      ? 'Combates en vivo'
      : fightHub.status === 'connecting'
        ? 'Conectando combates'
        : fightHub.status === 'reconnecting'
          ? 'Reconectando combates'
          : 'Combates sin conexión';

  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const normalizedTerm = useMemo(() => normalizeSearch(deferredSearchTerm), [deferredSearchTerm]);
  const isSearching = normalizedTerm.length >= 2;
  const searchCards = useMemo(() => {
    if (!isSearching) return [];
    const matches = sportEvents.filter((event) => eventMatches(event, normalizedTerm));
    return buildUfcCards(matches);
  }, [isSearching, normalizedTerm, sportEvents]);
  const searchCount = searchCards.reduce((sum, card) => sum + card.events.length, 0);

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

  const familyPulse = UFC_MARKET_FAMILIES.map((family) => {
    const markets = activeEvents
      .map((event) => findMarket(event, family.key))
      .filter((market): market is UfcMarket => market !== null);

    return {
      ...family,
      events: markets.length,
      selections: markets.reduce((sum, market) => sum + market.selections.length, 0),
    };
  });

  const mmaStats = useMemo(() => {
    const mmaMarketCount = mmaEvents.reduce(
      (count, event) => count + event.markets.length,
      0,
    );
    const openMarketCount = mmaEvents.reduce((count, event) => {
      if (event.isExpired || !event.isBettingOpen) return count;
      return count + event.markets.filter((market) => market.status === 'open').length;
    }, 0);
    const liveCount = mmaEvents.filter(
      (event) => event.status === 'live' && !event.isExpired,
    ).length;

    return {
      eventCount: mmaEvents.length,
      liveCount,
      marketCount: mmaMarketCount,
      openMarketCount,
      isLoading,
    };
  }, [isLoading, mmaEvents]);

  const {
    matches: footballMatches,
    liveMatches: footballLiveMatches,
    isLoading: isFootballLoading,
  } = useFootballEvents();

  const mmaVenueItems = useMemo<readonly VenueCardItem[]>(
    () =>
      cards.map((card) => ({
        id: card.key,
        title: ufcCardNumber(card.competition) ? `UFC ${ufcCardNumber(card.competition)}` : card.competition,
        place: card.location || card.venue,
        venue: card.venue || undefined,
        whenLabel: formatFightDay(card.startTime),
        versus: {
          left: {
            name: shortFighterName(card.mainEvent.bout.red.name),
            imageUrl: card.mainEvent.bout.red.imageUrl,
          },
          right: {
            name: shortFighterName(card.mainEvent.bout.blue.name),
            imageUrl: card.mainEvent.bout.blue.imageUrl,
          },
        },
        dateLabel: formatCardDayBadge(card.startTime),
        countLabel: `${card.events.length} ${card.events.length === 1 ? 'combate' : 'combates'}`,
        liveCount: card.liveCount,
      })),
    [cards],
  );

  const footballVenueItems = useMemo<readonly VenueCardItem[]>(() => {
    const byLeague = new Map<string, { item: VenueCardItem; count: number; live: number }>();
    for (const match of footballMatches) {
      const entry = byLeague.get(match.league.id) ?? {
        item: {
          id: match.league.id,
          title: match.league.name,
          place: match.league.country,
          hint: match.league.countryCode,
          detail: match.league.season,
          countLabel: '',
          liveCount: 0,
        },
        count: 0,
        live: 0,
      };
      entry.count += 1;
      if (match.status === 'live' && !match.isExpired) entry.live += 1;
      byLeague.set(match.league.id, entry);
    }
    return [...byLeague.values()].map(({ item, count, live }) => ({
      ...item,
      countLabel: `${count} ${count === 1 ? 'partido' : 'partidos'}`,
      liveCount: live,
    }));
  }, [footballMatches]);

  const nextCard = cards.find((card) => !card.isFinished);
  const nextFootballMatch = footballMatches
    .filter((match) => !match.isExpired && match.status !== 'finished')
    .sort((a, b) => Date.parse(a.startTimeUTC) - Date.parse(b.startTimeUTC))[0];

  const footballStats = useMemo(() => {
    const marketCount = footballMatches.reduce((sum, m) => sum + m.markets.length, 0);
    const openMarketCount = footballMatches.reduce((sum, m) => {
      if (m.isExpired || !m.isBettingOpen || m.status === 'finished') return sum;
      return sum + m.markets.filter((mkt) => mkt.status === 'open').length;
    }, 0);

    return {
      eventCount: footballMatches.length,
      liveCount: footballLiveMatches.length,
      marketCount,
      openMarketCount,
      isLoading: isFootballLoading,
    };
  }, [footballMatches, footballLiveMatches, isFootballLoading]);

  const betSlipPanel = (
    <div
      id='bet-slip'
      className='hidden min-w-0 min-[1400px]:sticky min-[1400px]:top-32 min-[1400px]:block'
    >
      <BetSlip
        minStake={50}
        maxStake={5000}
        variant='floating'
        className='min-[1400px]:max-h-[calc(100vh_-_9rem)]'
      />
    </div>
  );

  if (!isMma) {
    if (activeSport === 'soccer') {
      return (
        <div className='shibuya-page min-h-full pb-6 min-[1400px]:pb-0'>
          <div className='mx-auto w-full max-w-[1600px] px-3 py-4 sm:px-4 sm:py-5 lg:px-6'>
            <div className='grid grid-cols-1 items-start gap-4 min-[1400px]:grid-cols-[minmax(0,1fr)_360px] min-[1400px]:gap-5'>
              <div className='flex min-w-0 flex-col gap-4'>
                <SportsbookHeroBanner
                  activeSport='soccer'
                  liveCount={footballStats.liveCount}
                  totalEvents={footballStats.eventCount}
                  openMarketCount={footballStats.openMarketCount}
                  nextStartTime={nextFootballMatch?.startTimeUTC ?? null}
                  nextPlace={
                    nextFootballMatch
                      ? (nextFootballMatch.city ?? nextFootballMatch.league.country)
                      : null
                  }
                  nextCountryCode={nextFootballMatch?.league.countryCode ?? null}
                  isLoading={isFootballLoading}
                />
                <VenueAnimalGrid
                  kicker='Ligas'
                  title='Ligas con'
                  titleAccent='partidos publicados'
                  description='Aquí ves las ligas que tienen partidos disponibles ahora mismo.'
                  items={footballVenueItems}
                  selectedId={selectedFootballCompetitionId}
                  onSelect={handleSelectFootballCompetition}
                  allowClear
                  emptyMessage='La API no tiene partidos de fútbol publicados por ahora.'
                  isLoading={isFootballLoading}
                />
                <SportsBentoGrid
                  activeSport={activeSport}
                  onSelectSport={handleSelectSport}
                  mmaStats={mmaStats}
                  footballStats={footballStats}
                />
                <FootballEventsSection
                  selectedIds={selectedIds}
                  onAddSelection={handleAddSelection}
                  onRemoveSelection={removeSelection}
                  oddsMap={quotes}
                  activeLeagueId={selectedFootballCompetitionId}
                  onSelectLeague={handleSelectFootballCompetition}
                />
              </div>
              {betSlipPanel}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className='shibuya-page min-h-full pb-6 min-[1400px]:pb-0'>
        <div className='mx-auto w-full max-w-[1600px] px-3 py-4 sm:px-4 sm:py-5 lg:px-6'>
          <div className='grid grid-cols-1 items-start gap-4 min-[1400px]:grid-cols-[minmax(0,1fr)_360px] min-[1400px]:gap-5'>
            <div className='flex min-w-0 flex-col gap-4'>
              <SportsBentoGrid
                activeSport={activeSport}
                onSelectSport={handleSelectSport}
                mmaStats={mmaStats}
                footballStats={footballStats}
              />
              <SportComingSoon
                sport={activeSportDefinition}
                onBack={() => handleSelectSport('mma')}
              />
            </div>
            {betSlipPanel}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='shibuya-page min-h-full pb-6 min-[1400px]:pb-0'>
      <CardNav
        eventName={heroEvent?.competition ?? 'UFC'}
        dateLabel={
          heroEvent ? formatFightDate(heroEvent.startTime) : 'Próximas carteleras'
        }
        marketCount={marketCount}
        sections={sectionCounts}
        activeSection={activeSection}
        observedAt={globalSource?.observedAt ?? null}
        sourceName={globalSource?.name ?? null}
        onSectionChange={setActiveSection}
      />

      <div className='mx-auto w-full max-w-[1600px] px-3 py-4 sm:px-4 sm:py-5 lg:px-6'>
        <div className='grid grid-cols-1 items-start gap-4 min-[1400px]:grid-cols-[minmax(0,1fr)_360px] min-[1400px]:gap-5'>
          <div
            className='flex min-w-0 flex-col gap-4'
            data-hero-visible={Boolean(heroEvent)}
            data-hero-event-id={heroEvent?.id ?? undefined}
          >
            <SportsbookHeroBanner
              activeSport='mma'
              liveCount={mmaStats.liveCount}
              totalEvents={mmaStats.eventCount}
              openMarketCount={mmaStats.openMarketCount}
              nextStartTime={nextCard?.startTime ?? null}
              nextPlace={nextCard ? nextCard.location || nextCard.venue : null}
              connectionLabel={fightHubLabel}
              isLoading={isLoading}
            />
            <VenueAnimalGrid
              kicker='Sedes'
              title='Carteleras'
              titleAccent='por sede'
              description='Escoge una cartelera y entra directo a sus combates y cuotas.'
              items={mmaVenueItems}
              selectedId={activeKey}
              onSelect={handleSelectCard}
              emptyMessage='No hay carteleras publicadas por ahora.'
              isLoading={isLoading}
            />
            <SportsBentoGrid
              activeSport={activeSport}
              onSelectSport={handleSelectSport}
              mmaStats={mmaStats}
              footballStats={footballStats}
            />

            <FighterSearch
              value={searchTerm}
              onChange={setSearchTerm}
              resultCount={isSearching ? searchCount : null}
            />

            {heroEvent && (
              <MainEventHero
                event={heroEvent}
                boutCount={heroCard?.events.length ?? 0}
                marketCount={heroCard?.marketCount ?? 0}
                selectionCount={heroCard?.selectionCount ?? 0}
                selectedIds={selectedIds}
                oddsMap={quotes}
                onAddSelection={handleAddSelection}
                onRemoveSelection={removeSelection}
              />
            )}

            {activeEvents.length > 0 && (
              <div
                role='group'
                aria-label='Cobertura de mercados de la cartelera'
                className='grid grid-cols-2 gap-2 sm:grid-cols-4'
              >
                {familyPulse.map((family) => (
                  <div
                    key={family.key}
                    className='flex min-w-0 items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-white/[0.018] px-2.5 py-2'
                  >
                    <div className='flex min-w-0 items-center gap-2'>
                      <span
                        className={`h-1.5 w-1.5 shrink-0 ${MARKET_TICKS[family.key]}`}
                        aria-hidden='true'
                      />
                      <div className='min-w-0'>
                        <p className='truncate font-display text-[10px] font-bold uppercase tracking-wide text-white'>
                          {family.label}
                        </p>
                        <p className='font-mono text-[8px] uppercase tracking-wide text-metallic-slate'>
                          {family.events} combates
                        </p>
                      </div>
                    </div>
                    <span className='shrink-0 font-odds text-sm font-bold tabular-nums text-white'>
                      {family.selections}
                    </span>
                  </div>
                ))}
              </div>
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
                <HubStatusBadge
                  status={fightHub.status}
                  lastUpdateAt={fightHub.lastUpdateAt}
                  label={fightHubLabel}
                />
                <span className='border border-white/[0.07] bg-white/[0.02] px-2 py-1.5 font-mono text-[8px] font-bold uppercase tracking-brutal text-metallic-slate'>
                  {isLoading ? 'Cargando' : `${activeEvents.length} combates`}
                </span>
              </div>
            </div>

            {isLoading && events.length === 0 && (
              <div className='flex flex-col gap-3' aria-busy='true' aria-label='Cargando cartelera'>
                <LoadingCard />
                <LoadingCard />
              </div>
            )}

            {!isLoading && error && <EventsError message={error} onRetry={reload} />}

            {isSearching &&
              searchCards.map((card) => (
                <section
                  key={card.key}
                  aria-label={`Resultados ${card.competition}`}
                  className='flex min-w-0 flex-col gap-2.5'
                >
                  <h3 className='font-mono text-[10px] font-bold uppercase tracking-wide text-lime-400'>
                    {card.competition} · {formatFightDay(card.startTime)}
                  </h3>
                  <div className='flex flex-col gap-3'>
                    {card.events.map((event) => (
                      <FightCard
                        key={event.id}
                        event={event}
                        featured={false}
                        selectedIds={selectedIds}
                        onAddSelection={handleAddSelection}
                        onRemoveSelection={removeSelection}
                        onOpenComparison={handleOpenComparison}
                        oddsMap={quotes}
                      />
                    ))}
                  </div>
                </section>
              ))}

            {isSearching && searchCards.length === 0 && !isLoading && (
              <p className='shibuya-glass p-5 text-xs text-metallic-titanium'>
                Ningún combate coincide con “{searchTerm.trim()}”.
              </p>
            )}

            {!isSearching && !isLoading && !error && activeEvents.length === 0 && <EventsEmpty />}

            {(isSearching ? [] : visibleSections).map((section, index) => (
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
                      onOpenComparison={handleOpenComparison}
                      oddsMap={quotes}
                    />
                  ))}
                </div>
              </section>
            ))}

            {!isSearching && visibleSections.length === 0 && !isLoading && !error && activeEvents.length > 0 && (
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
                        ? `${displaySourceName(globalSource.name)} · ${
                            globalSource.kind === 'model' ? 'modelo de referencia' : 'promedio de casas'
                          } · snapshot`
                        : 'Procedencia no declarada'}
                    </span>
                  </div>
                  <p className='max-w-3xl text-[10px] leading-relaxed text-metallic-slate'>
                    Las cuatro familias (Moneyline, método de victoria, total de asaltos y decisión)
                    se actualizan por mercado en tiempo real desde {displaySourceName(globalSource?.name) || 'la fuente declarada'}.
                    El estado del combate y el reloj llegan por el canal de combates; si el canal se
                    interrumpe, se conserva el último precio recibido. Verifica la cuota antes de
                    confirmar tu apuesta.
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

          {betSlipPanel}
        </div>
      </div>

      {liveComparisonEvent && (
        <FighterComparisonModal
          event={liveComparisonEvent}
          selectedIds={selectedIds}
          oddsMap={quotes}
          onAddSelection={handleAddSelection}
          onRemoveSelection={removeSelection}
          onClose={() => setComparisonEvent(null)}
        />
      )}
    </div>
  );
}
