import { useId, useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  Check,
  ShieldCheck,
  Swords,
} from 'lucide-react';

import type { SelectionInput } from '@/domain/bets';
import type { OddsQuote } from '@/domain/odds';
import {
  findMarket,
  formatAmericanOdds,
  formatFightDay,
  formatRank,
  formatUpdatedAt,
  formatWeightDivision,
  type UfcEvent,
  type UfcFighter,
  type UfcMarket,
  type UfcMarketTypeKey,
  type UfcSelection,
} from '@/domain/ufc';

interface EventCardProps {
  readonly event: UfcEvent;
  readonly selectedIds: readonly string[];
  readonly onAddSelection: (selection: SelectionInput) => void;
  readonly onRemoveSelection: (selectionId: string) => void;
  readonly oddsMap: Readonly<Record<string, OddsQuote>>;
  readonly featured?: boolean;
}

const MARKET_TABS: readonly { key: UfcMarketTypeKey; label: string }[] = [
  { key: 'moneyline', label: 'Ganador' },
  { key: 'method_of_victory', label: 'Método' },
  { key: 'total_rounds', label: 'Asaltos' },
  { key: 'go_to_decision', label: 'Decisión' },
];

const METHOD_LABELS: Readonly<Record<string, string>> = {
  red_ko: 'KO/TKO',
  red_submission: 'Sumisión',
  red_decision: 'Decisión',
  blue_ko: 'KO/TKO',
  blue_submission: 'Sumisión',
  blue_decision: 'Decisión',
};

function sourceLabel(provider: string | null): string {
  if (!provider) return 'Cuota de referencia';
  if (provider.includes('zenbet-model')) return 'Modelo ZenBet · no oficial';
  if (provider.includes('ufc-consensus')) return 'Consenso UFCalendar';
  return provider;
}

function trendIcon(trend: OddsQuote['trend'] | undefined) {
  if (trend === 'up') return <ArrowUpRight size={11} aria-hidden='true' />;
  if (trend === 'down') return <ArrowDownRight size={11} aria-hidden='true' />;
  return null;
}

interface OddsButtonProps {
  readonly market: UfcMarket;
  readonly selection: UfcSelection;
  readonly isSelected: boolean;
  readonly quote?: OddsQuote;
  readonly onToggle: (market: UfcMarket, selection: UfcSelection) => void;
  readonly label?: string;
  readonly stacked?: boolean;
  readonly className?: string;
}

function OddsButton({
  market,
  selection,
  isSelected,
  quote,
  onToggle,
  label,
  stacked = false,
  className = '',
}: OddsButtonProps) {
  const liveOdds =
    quote && Number.isFinite(quote.odds) && quote.odds > 1
      ? quote.odds
      : selection.decimalOdds;
  const disabled = selection.settled || market.status !== 'open';
  const trend = quote?.trend ?? 'unchanged';
  const trendColor =
    trend === 'up' ? 'text-odds-up' : trend === 'down' ? 'text-odds-down' : 'text-metallic-slate';

  return (
    <button
      type='button'
      onClick={() => onToggle(market, selection)}
      disabled={disabled}
      aria-pressed={isSelected}
      aria-label={`${selection.name}: ${liveOdds.toFixed(2)} decimal, ${formatAmericanOdds(
        liveOdds,
      )} americana`}
      data-trend={trend}
      data-selected={isSelected}
      className={`odds-tile group min-w-0 ${
        stacked ? 'flex-col items-stretch justify-center gap-1' : ''
      } ${disabled ? 'cursor-not-allowed opacity-45' : ''} ${className}`}
    >
      {stacked ? (
        <>
          <span className='flex min-w-0 items-center gap-1 text-[9px] font-bold uppercase tracking-brutal text-metallic-titanium'>
            {isSelected && <Check size={11} strokeWidth={3} className='shrink-0 text-crimson' />}
            <span className='truncate'>{label ?? METHOD_LABELS[selection.code ?? ''] ?? selection.name}</span>
          </span>
          <span className='flex min-w-0 items-baseline gap-1.5'>
            <span className='odds-number text-[13px]'>{liveOdds.toFixed(2)}</span>
            <span className='font-mono text-[9px] font-semibold text-metallic-slate'>
              {formatAmericanOdds(liveOdds)}
            </span>
            <span className={`ml-auto ${trendColor}`}>{trendIcon(trend)}</span>
          </span>
        </>
      ) : (
        <>
          <span className='flex min-w-0 items-center gap-1.5'>
            {isSelected && <Check size={12} strokeWidth={3} className='shrink-0 text-crimson' />}
            <span className='truncate text-[10px] font-semibold uppercase tracking-wide text-metallic-titanium'>
              {label ?? selection.name}
            </span>
          </span>
          <span className='flex shrink-0 items-baseline gap-1.5'>
            <span className={`${trendColor} transition-colors`}>{trendIcon(trend)}</span>
            <span className='odds-number text-[13px]'>{liveOdds.toFixed(2)}</span>
            <span className='font-mono text-[9px] font-semibold text-metallic-slate'>
              {formatAmericanOdds(liveOdds)}
            </span>
          </span>
        </>
      )}
    </button>
  );
}

interface FighterLineProps {
  readonly fighter: UfcFighter;
  readonly market: UfcMarket;
  readonly selection?: UfcSelection;
  readonly isSelected: boolean;
  readonly quote?: OddsQuote;
  readonly onToggle: (market: UfcMarket, selection: UfcSelection) => void;
  readonly align?: 'left' | 'right';
}

function FighterLine({
  fighter,
  market,
  selection,
  isSelected,
  quote,
  onToggle,
  align = 'left',
}: FighterLineProps) {
  return (
    <div className={`flex min-w-0 flex-col gap-2 ${align === 'right' ? 'sm:text-right' : ''}`}>
      <div className={`flex min-w-0 items-center gap-2 ${align === 'right' ? 'sm:justify-end' : ''}`}>
        <span
          className={`h-1.5 w-1.5 shrink-0 ${
            fighter.rank === 'C' ? 'bg-gold' : 'bg-metallic-gunmetal'
          }`}
          aria-hidden='true'
        />
        <p className='min-w-0 break-words font-display text-[15px] font-bold leading-tight text-white'>
          {fighter.name}
        </p>
      </div>
      <p className='font-mono text-[10px] uppercase tracking-wide text-metallic-titanium'>
        {fighter.record} · {fighter.country || '—'} · {formatRank(fighter)}
      </p>
      {selection && (
        <OddsButton
          market={market}
          selection={selection}
          isSelected={isSelected}
          quote={quote}
          onToggle={onToggle}
          label='Moneyline'
          className='mt-1 w-full'
        />
      )}
    </div>
  );
}

interface MethodGroupProps {
  readonly fighter: UfcFighter;
  readonly selections: readonly UfcSelection[];
  readonly market: UfcMarket;
  readonly selectedSet: ReadonlySet<string>;
  readonly oddsMap: Readonly<Record<string, OddsQuote>>;
  readonly onToggle: (market: UfcMarket, selection: UfcSelection) => void;
}

function MethodGroup({
  fighter,
  selections,
  market,
  selectedSet,
  oddsMap,
  onToggle,
}: MethodGroupProps) {
  return (
    <div className='min-w-0 border border-obsidian-border/80 bg-obsidian-surface/35 p-3'>
      <div className='mb-2 flex min-w-0 items-baseline justify-between gap-2'>
        <p className='min-w-0 break-words font-display text-xs font-bold text-white'>
          {fighter.name}
        </p>
        <span className='shrink-0 font-mono text-[9px] uppercase tracking-wide text-metallic-slate'>
          {fighter.record}
        </span>
      </div>
      <div className='grid grid-cols-3 gap-1.5'>
        {selections.map((selection) => (
          <OddsButton
            key={selection.id}
            market={market}
            selection={selection}
            isSelected={selectedSet.has(selection.id)}
            quote={oddsMap[selection.id]}
            onToggle={onToggle}
            stacked
          />
        ))}
      </div>
    </div>
  );
}

export default function EventCard({
  event,
  selectedIds,
  onAddSelection,
  onRemoveSelection,
  oddsMap,
  featured = false,
}: EventCardProps) {
  const headingId = useId();
  const { bout } = event;
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const eventSelectionIds = useMemo(
    () =>
      new Set(
        event.markets.flatMap((market) => market.selections.map((selection) => selection.id)),
      ),
    [event],
  );
  const selectedInEvent = selectedIds.filter((selectionId) =>
    eventSelectionIds.has(selectionId),
  ).length;
  const [activeType, setActiveType] = useState<UfcMarketTypeKey>('moneyline');

  const availableTabs = useMemo(
    () =>
      MARKET_TABS.map((tab) => ({
        ...tab,
        market: findMarket(event, tab.key),
      })).filter((tab): tab is typeof tab & { market: UfcMarket } => Boolean(tab.market)),
    [event],
  );

  const activeTab = availableTabs.find((tab) => tab.key === activeType) ?? availableTabs[0];
  const activeMarket = activeTab?.market;
  if (!activeMarket) return null;

  const handleToggle = (market: UfcMarket, selection: UfcSelection) => {
    if (selectedSet.has(selection.id)) {
      onRemoveSelection(selection.id);
      return;
    }

    const liveOdds = oddsMap[selection.id]?.odds ?? selection.decimalOdds;

    onAddSelection({
      selectionId: selection.id,
      eventId: event.id,
      marketId: market.id,
      eventName: event.competition ? `${event.competition} · ${event.name}` : event.name,
      marketLabel: market.name,
      selectionName: selection.name,
      odds: liveOdds,
    });
  };

  const selectionByCode = (code: string) =>
    activeMarket.selections.find((selection) => selection.code === code);
  const redMoneyline = selectionByCode('red');
  const blueMoneyline = selectionByCode('blue');
  const redMethod = activeMarket.selections.filter((selection) =>
    selection.code?.startsWith('red_'),
  );
  const blueMethod = activeMarket.selections.filter((selection) =>
    selection.code?.startsWith('blue_'),
  );
  const updatedAt = formatUpdatedAt(activeMarket.updatedAt ?? event.oddsUpdatedAt);
  const isDerived = activeMarket.provider?.includes('zenbet-model') ?? false;

  return (
    <article
      aria-labelledby={headingId}
      className={`relative min-w-0 overflow-hidden border bg-obsidian-card transition-colors duration-200 ${
        featured
          ? 'border-gold/40 shadow-[inset_0_1px_0_rgb(212_175_55_/_0.12)]'
          : 'border-obsidian-border hover:border-crimson/35'
      }`}
    >
      <div
        className={`h-[3px] w-full ${featured ? 'bg-gold' : bout.isTitleFight ? 'bg-crimson' : 'bg-obsidian-border'}`}
        aria-hidden='true'
      />

      <header className='flex flex-col gap-3 px-4 pb-3 pt-4 sm:flex-row sm:items-start sm:justify-between'>
        <div className='min-w-0'>
          <div className='flex flex-wrap items-center gap-2'>
            <span className='font-mono text-[9px] font-bold uppercase tracking-ultra text-crimson'>
              {event.competition ?? 'UFC'}
            </span>
            <span className='h-px w-4 bg-obsidian-border' aria-hidden='true' />
            <span className='font-mono text-[9px] uppercase tracking-brutal text-metallic-slate'>
              {bout.billingLabel}
            </span>
          </div>

          <h3
            id={headingId}
            className='mt-2 break-words font-display text-lg font-extrabold uppercase leading-tight tracking-tight text-white'
          >
            {event.name}
          </h3>

          <div className='mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] uppercase tracking-wide text-metallic-titanium'>
            <span className='inline-flex items-center gap-1'>
              <Swords size={11} className='text-crimson' aria-hidden='true' />
              {formatWeightDivision(bout)}
            </span>
            <span>{bout.scheduledRounds} asaltos</span>
            {bout.isTitleFight && (
              <span className='inline-flex items-center gap-1 text-gold'>
                <ShieldCheck size={11} aria-hidden='true' />
                Título
              </span>
            )}
            <span className='inline-flex items-center gap-1'>
              <CalendarClock size={11} aria-hidden='true' />
              {formatFightDay(event.startTime)}
            </span>
          </div>
        </div>

        <div className='flex shrink-0 flex-col items-start gap-1 sm:items-end'>
          <span className='font-mono text-[9px] uppercase tracking-brutal text-metallic-slate'>
            {bout.venue || 'Sede por confirmar'}
          </span>
          <span className='max-w-full font-mono text-[9px] leading-relaxed text-metallic-slate sm:max-w-[220px] sm:text-right'>
            {bout.location}
          </span>
          <span className='mt-1 border border-obsidian-border bg-obsidian-surface/60 px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-brutal text-metallic-titanium'>
            {bout.billingOrder === 1 ? 'Evento estelar' : `Combate ${bout.billingOrder}`}
          </span>
        </div>
      </header>

      <div className='border-y border-obsidian-border/80 bg-obsidian-surface/25 px-4 py-2.5'>
        <div
          role='tablist'
          aria-label={`Mercados de ${event.name}`}
          className='grid grid-cols-2 gap-1 sm:grid-cols-4'
        >
          {availableTabs.map((tab) => {
            const isActive = tab.key === activeTab.key;
            return (
              <button
                key={tab.key}
                type='button'
                role='tab'
                aria-selected={isActive}
                onClick={() => setActiveType(tab.key)}
                className={`flex min-w-0 items-center justify-between gap-1.5 border px-2.5 py-2 font-display text-[10px] font-extrabold uppercase tracking-brutal transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-crimson ${
                  isActive
                    ? 'border-crimson/60 bg-crimson/10 text-white'
                    : 'border-transparent text-metallic-slate hover:border-obsidian-border hover:bg-obsidian-elevated hover:text-metallic-chrome'
                }`}
              >
                <span className='truncate'>{tab.label}</span>
                <span className='shrink-0 font-mono text-[8px] font-bold text-metallic-gunmetal'>
                  {tab.market.selections.length}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className='px-4 py-4'>
        <div className='mb-3 flex flex-wrap items-end justify-between gap-2'>
          <div className='min-w-0'>
            <p className='font-display text-[11px] font-extrabold uppercase tracking-brutal text-metallic-chrome'>
              {activeMarket.name}
              {activeMarket.line !== null && (
                <span className='ml-2 font-mono text-[10px] font-bold text-gold'>
                  {activeMarket.line}
                </span>
              )}
            </p>
            <p className='mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[9px] uppercase tracking-wide text-metallic-slate'>
              <span className={isDerived ? 'text-odds-live' : ''}>
                {sourceLabel(activeMarket.provider)}
              </span>
              {updatedAt && (
                <>
                  <span className='text-metallic-gunmetal'>·</span>
                  <span>Actualizado {updatedAt}</span>
                </>
              )}
            </p>
          </div>
          <span className='font-mono text-[9px] uppercase tracking-brutal text-metallic-slate'>
            Decimal / Americana
          </span>
        </div>

        {activeTab.key === 'moneyline' && (
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5'>
            <FighterLine
              fighter={bout.red}
              market={activeMarket}
              selection={redMoneyline}
              isSelected={Boolean(redMoneyline && selectedSet.has(redMoneyline.id))}
              quote={redMoneyline ? oddsMap[redMoneyline.id] : undefined}
              onToggle={handleToggle}
            />
            <FighterLine
              fighter={bout.blue}
              market={activeMarket}
              selection={blueMoneyline}
              isSelected={Boolean(blueMoneyline && selectedSet.has(blueMoneyline.id))}
              quote={blueMoneyline ? oddsMap[blueMoneyline.id] : undefined}
              onToggle={handleToggle}
              align='right'
            />
          </div>
        )}

        {activeTab.key === 'method_of_victory' && (
          <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
            <MethodGroup
              fighter={bout.red}
              selections={redMethod}
              market={activeMarket}
              selectedSet={selectedSet}
              oddsMap={oddsMap}
              onToggle={handleToggle}
            />
            <MethodGroup
              fighter={bout.blue}
              selections={blueMethod}
              market={activeMarket}
              selectedSet={selectedSet}
              oddsMap={oddsMap}
              onToggle={handleToggle}
            />
          </div>
        )}

        {(activeTab.key === 'total_rounds' || activeTab.key === 'go_to_decision') && (
          <div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
            {activeMarket.selections.map((selection) => (
              <OddsButton
                key={selection.id}
                market={activeMarket}
                selection={selection}
                isSelected={selectedSet.has(selection.id)}
                quote={oddsMap[selection.id]}
                onToggle={handleToggle}
                label={selection.name}
                className='min-h-[58px]'
              />
            ))}
          </div>
        )}
      </div>

      <footer className='flex flex-wrap items-center justify-between gap-2 border-t border-obsidian-border/70 px-4 py-2.5'>
        <p className='font-mono text-[9px] uppercase tracking-wide text-metallic-slate'>
          {isDerived
            ? 'Cuota modelada por ZenBet · no es una línea oficial'
            : 'Cuota de referencia · verifica antes de apostar'}
        </p>
        <span className='font-mono text-[9px] uppercase tracking-brutal text-metallic-gunmetal'>
          {selectedInEvent > 0 ? `${selectedInEvent} en boleto` : 'Selecciona una cuota'}
        </span>
      </footer>
    </article>
  );
}
