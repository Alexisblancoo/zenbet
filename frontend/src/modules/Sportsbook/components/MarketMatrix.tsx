import { memo, useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Check, Minus, Search, X } from 'lucide-react';

import { formatDecimalOdds, type OddsQuote } from '@/domain/odds';
import { getCountryFlagEmoji } from '@/utils/countryFlags';
import {
  findMarket,
  findSelectionByCode,
  formatAmericanOdds,
  isTerminalEventStatus,
  shortFighterName,
  UFC_MARKET_FAMILIES,
  type UfcEvent,
  type UfcMarket,
  type UfcMarketTypeKey,
  type UfcSelection,
} from '@/domain/ufc';

export interface MarketMatrixProps {
  readonly event: UfcEvent;
  readonly selectedIds: readonly string[];
  readonly oddsMap: Readonly<Record<string, OddsQuote>>;
  readonly onToggle: (market: UfcMarket, selection: UfcSelection) => void;
  readonly defaultTab?: MarketTabKey;
}

export type MarketTabKey = 'all' | 'main' | 'rounds' | 'method' | 'decision';

const MARKET_ACCENT: Record<
  UfcMarketTypeKey,
  { tick: string; text: string; border: string; bg: string; cyrillic: string }
> = {
  moneyline: {
    tick: 'bg-crimson',
    text: 'text-crimson-200',
    border: 'border-crimson/30',
    bg: 'bg-crimson/[0.06]',
    cyrillic: 'ИСХОД',
  },
  method_of_victory: {
    tick: 'bg-sage',
    text: 'text-sage',
    border: 'border-sage/30',
    bg: 'bg-sage/[0.07]',
    cyrillic: 'МЕТОД',
  },
  total_rounds: {
    tick: 'bg-white/80',
    text: 'text-metallic-platinum',
    border: 'border-white/20',
    bg: 'bg-white/[0.04]',
    cyrillic: 'ТОТАЛ',
  },
  go_to_decision: {
    tick: 'bg-metallic-titanium',
    text: 'text-metallic-titanium',
    border: 'border-white/15',
    bg: 'bg-white/[0.03]',
    cyrillic: 'РЕШЕНИЕ',
  },
};

const METHOD_LABEL: Readonly<Record<string, string>> = {
  ko: 'KO/TKO',
  submission: 'SUM',
  decision: 'DEC',
};

const METHOD_ORDER = ['ko', 'submission', 'decision'] as const;

function trendIcon(trend: OddsQuote['trend'] | undefined) {
  if (trend === 'up') return <ArrowUpRight size={9} aria-hidden='true' />;
  if (trend === 'down') return <ArrowDownRight size={9} aria-hidden='true' />;
  return null;
}

interface MarketTileProps {
  readonly market: UfcMarket;
  readonly selection: UfcSelection;
  readonly isSelected: boolean;
  readonly quote?: OddsQuote;
  readonly onToggle: (market: UfcMarket, selection: UfcSelection) => void;
  readonly label: string;
  readonly hint?: string;
  readonly corner?: 'red' | 'blue';
  readonly method?: boolean;
  readonly closed?: boolean;
}

export const MarketTile = memo(function MarketTile({
  market,
  selection,
  isSelected,
  quote,
  onToggle,
  label,
  hint,
  corner,
  method = false,
  closed = false,
}: MarketTileProps) {
  const liveOdds =
    quote && Number.isFinite(quote.odds) && quote.odds > 1
      ? quote.odds
      : selection.decimalOdds;
  const trend = quote?.trend ?? 'unchanged';

  // Destello neón cuando OddsHub empuja un cambio de cuota (no en el primer pintado).
  const previousOdds = useRef(liveOdds);
  const [isFlashing, setIsFlashing] = useState(false);
  useEffect(() => {
    if (previousOdds.current === liveOdds) return undefined;
    previousOdds.current = liveOdds;
    setIsFlashing(true);
    const timer = window.setTimeout(() => setIsFlashing(false), 1200);
    return () => window.clearTimeout(timer);
  }, [liveOdds]);

  const disabled = closed || selection.settled || market.status !== 'open';
  const trendTone =
    trend === 'up' ? 'text-odds-up' : trend === 'down' ? 'text-odds-down' : 'text-metallic-slate';
  const selected = isSelected && !closed;

  return (
    <button
      type='button'
      onClick={() => onToggle(market, selection)}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={`${selection.name}: ${formatDecimalOdds(liveOdds)} decimal, ${formatAmericanOdds(liveOdds)} americana${selected ? ', seleccionada' : ''}${closed ? ', mercado cerrado' : ''}`}
      title={`${selection.name} · ${formatDecimalOdds(liveOdds)} (${formatAmericanOdds(liveOdds)})`}
      data-selected={selected}
      data-trend={trend}
      data-closed={closed}
      className={`market-tile group relative min-w-0 transition-all duration-150 ${isFlashing ? 'zb-odds-lime-flash' : ''} ${method ? 'market-tile--method' : ''} ${
        closed
          ? 'cursor-not-allowed border-white/[0.045] bg-[#050505] opacity-55 grayscale'
          : disabled
            ? 'cursor-not-allowed opacity-40'
            : selected
              ? 'border-lime-400 bg-lime-400/[0.08] shadow-[0_0_20px_-8px_rgba(212,255,63,0.7)]'
              : 'border-white/[0.09] bg-[#0E0E0E] hover:border-lime-400/40 hover:bg-[#141414]'
      }`}
    >
      {method ? (
        <>
          <div className='flex w-full min-w-0 items-center justify-between gap-1'>
            <span className='truncate font-mono text-[9px] font-semibold uppercase tracking-wide text-metallic-titanium'>
              {label}
            </span>
            {isSelected && (
              <Check size={10} strokeWidth={3} className='shrink-0 text-lime-400' aria-hidden='true' />
            )}
          </div>
          <div className='flex w-full items-baseline justify-between gap-1'>
            <span className='font-mono text-[7px] font-bold text-metallic-slate/35 tracking-wider'>
              КОЭФ
            </span>
            <span
              key={quote?.sequence ?? 'snapshot'}
              className={`odds-number font-odds text-[12px] font-bold tabular-nums ${
                selected ? 'text-lime-400' : 'text-white'
              }`}
            >
              {formatDecimalOdds(liveOdds)}
            </span>
          </div>
          <span className={`self-end truncate font-mono text-[7px] font-semibold ${trendTone}`}>
            {formatAmericanOdds(liveOdds)}
          </span>
        </>
      ) : (
        <>
          <span className='flex min-w-0 items-center gap-1.5'>
            {corner && (
              <span
                className={`grid h-4 w-4 shrink-0 place-items-center border font-mono text-[7px] font-bold ${
                  corner === 'red'
                    ? 'border-crimson/50 bg-crimson/15 text-crimson'
                    : 'border-sage/50 bg-sage/15 text-sage'
                }`}
                aria-hidden='true'
              >
                {corner === 'red' ? 'R' : 'B'}
              </span>
            )}
            {isSelected && !corner && (
              <Check size={11} strokeWidth={3} className='shrink-0 text-lime-400' aria-hidden='true' />
            )}
            <span className='min-w-0'>
              <span className='block truncate font-display text-[10px] font-bold uppercase tracking-normal text-white sm:text-[11px]'>
                {label}
              </span>
              {hint && (
                <span className='block truncate font-mono text-[8px] uppercase tracking-wide text-metallic-slate'>
                  {hint}
                </span>
              )}
            </span>
          </span>
          <span className='flex shrink-0 flex-col items-end gap-0.5'>
            <span className='flex items-baseline gap-1'>
              <span className='font-mono text-[7px] font-bold text-metallic-slate/35 tracking-wider'>
                КОЭФ
              </span>
              <span className={trendTone}>{trendIcon(trend)}</span>
              <span
                key={quote?.sequence ?? 'snapshot'}
                className={`odds-number font-odds text-[13px] font-bold tabular-nums sm:text-[14px] ${
                  selected ? 'text-lime-400' : 'text-white'
                }`}
              >
                {formatDecimalOdds(liveOdds)}
              </span>
            </span>
            <span className='hidden font-mono text-[8px] font-semibold text-metallic-slate sm:block'>
              {formatAmericanOdds(liveOdds)}
            </span>
          </span>
        </>
      )}
    </button>
  );
});

interface MarketColumnProps {
  readonly family: (typeof UFC_MARKET_FAMILIES)[number];
  readonly index: number;
  readonly market?: UfcMarket;
  readonly children: ReactNode;
}

function MarketColumn({ family, index, market, children }: MarketColumnProps) {
  const accent = MARKET_ACCENT[family.key];
  const line = market?.line ?? null;

  return (
    <section
      aria-label={family.caption}
      data-family={family.key}
      className='market-panel flex min-w-0 flex-col border border-white/[0.07] bg-[#0A0A0A]'
    >
      <header className='flex min-w-0 items-start justify-between gap-2 border-b border-white/[0.06] bg-[#0E0E0E] px-2.5 py-1.5'>
        <div className='flex min-w-0 items-center gap-2'>
          <span
            className={`grid h-4 w-4 shrink-0 place-items-center border font-mono text-[8px] font-bold tabular-nums ${accent.border} ${accent.bg} ${accent.text}`}
          >
            {String(index + 1).padStart(2, '0')}
          </span>
          <div className='min-w-0'>
            <div className='flex items-center gap-1.5'>
              <span className={`h-1 w-1 shrink-0 ${accent.tick}`} aria-hidden='true' />
              <h4 className='truncate font-display text-[10px] font-bold uppercase tracking-wide text-white'>
                {family.label}
              </h4>
              <span className='font-mono text-[7px] uppercase tracking-wider text-metallic-slate/35'>
                {accent.cyrillic}
              </span>
            </div>
          </div>
        </div>
        {line !== null ? (
          <span className='shrink-0 border border-sage/25 bg-sage/[0.07] px-1 py-0.5 font-mono text-[8px] font-bold tabular-nums text-sage'>
            L {line.toFixed(1)}
          </span>
        ) : (
          <span className='shrink-0 font-mono text-[8px] tabular-nums text-metallic-slate'>
            {market?.selections.length ?? 0}
          </span>
        )}
      </header>

      <div className='flex min-h-[100px] flex-1 flex-col p-2'>{children}</div>
    </section>
  );
}

function EmptyMarket({ label }: { label: string }) {
  return (
    <div className='flex min-h-[84px] flex-col items-center justify-center gap-1.5 border border-dashed border-white/[0.08] px-2 text-center'>
      <Minus size={11} className='text-metallic-slate' aria-hidden='true' />
      <p className='font-mono text-[8px] uppercase tracking-wide text-metallic-slate'>
        {label} no publicado
      </p>
    </div>
  );
}

function MarketNote({ children }: { children: ReactNode }) {
  return (
    <p className='mt-auto pt-2 font-mono text-[7px] uppercase tracking-wide text-metallic-slate/70'>
      {children}
    </p>
  );
}

const TABS: readonly { key: MarketTabKey; label: string; cyrillic: string }[] = [
  { key: 'all', label: 'Todos', cyrillic: 'ВСЕ' },
  { key: 'main', label: 'Principales', cyrillic: 'ИСХОД' },
  { key: 'rounds', label: 'Asaltos', cyrillic: 'ТОТАЛ' },
  { key: 'method', label: 'Método', cyrillic: 'МЕТОД' },
  { key: 'decision', label: 'Decisión', cyrillic: 'РЕШЕНИЕ' },
];

/**
 * Matriz Brutalista de Mercados con Pestañas Internas y Buscador Rápido.
 * Proporciona exploración instantánea sin saturar la tarjeta.
 */
function MarketMatrix({
  event,
  selectedIds,
  oddsMap,
  onToggle,
  defaultTab = 'all',
}: MarketMatrixProps) {
  const [activeTab, setActiveTab] = useState<MarketTabKey>(defaultTab);
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearch = useDeferredValue(searchTerm);
  const query = deferredSearch.toLowerCase().trim();

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const closed = event.isExpired || isTerminalEventStatus(event.status) || !event.isBettingOpen;

  const markets = useMemo(
    () =>
      UFC_MARKET_FAMILIES.map((family) => ({
        family,
        market: findMarket(event, family.key),
      })),
    [event],
  );

  const moneyline = markets[0]?.market;
  const methodMarket = markets[1]?.market;
  const roundsMarket = markets[2]?.market;
  const decisionMarket = markets[3]?.market;

  const { bout } = event;

  const redMoneyline = findSelectionByCode(moneyline, 'red');
  const blueMoneyline = findSelectionByCode(moneyline, 'blue');
  const over = findSelectionByCode(roundsMarket, 'over');
  const under = findSelectionByCode(roundsMarket, 'under');
  const yes = findSelectionByCode(decisionMarket, 'yes');
  const no = findSelectionByCode(decisionMarket, 'no');

  const methodSelections = (corner: 'red' | 'blue') =>
    METHOD_ORDER.map((suffix) =>
      findSelectionByCode(methodMarket, `${corner}_${suffix}`),
    ).filter((selection): selection is UfcSelection => Boolean(selection));

  // Filtro por búsqueda
  const matchesQuery = (text: string) => !query || text.toLowerCase().includes(query);

  const showMoneyline = (activeTab === 'all' || activeTab === 'main') &&
    (matchesQuery('ganador') || matchesQuery('moneyline') || matchesQuery(bout.red.name) || matchesQuery(bout.blue.name));

  const showMethod = (activeTab === 'all' || activeTab === 'method') &&
    (matchesQuery('metodo') || matchesQuery('ko') || matchesQuery('tko') || matchesQuery('sumision') || matchesQuery('sub') || matchesQuery('decision') || matchesQuery(bout.red.name) || matchesQuery(bout.blue.name));

  const showRounds = (activeTab === 'all' || activeTab === 'rounds') &&
    (matchesQuery('asaltos') || matchesQuery('rounds') || matchesQuery('over') || matchesQuery('under') || matchesQuery('total') || matchesQuery(String(roundsMarket?.line ?? '')));

  const showDecision = (activeTab === 'all' || activeTab === 'decision') &&
    (matchesQuery('decision') || matchesQuery('tarjetas') || matchesQuery('distancia') || matchesQuery('si') || matchesQuery('no'));

  const filteredMethodSelections = (corner: 'red' | 'blue') => {
    const list = methodSelections(corner);
    if (!query) return list;
    return list.filter((s) => {
      const code = s.code?.toLowerCase() ?? '';
      const name = s.name.toLowerCase();
      return code.includes(query) || name.includes(query) || (query === 'ko' && code.includes('ko'));
    });
  };

  const activeColumnsCount = [showMoneyline, showMethod, showRounds, showDecision].filter(Boolean).length;

  return (
    <div
      role='group'
      aria-label={`Mercados y cuotas de ${bout.red.name} vs ${bout.blue.name}`}
      data-closed={closed}
      className='flex flex-col gap-2.5 bg-[#080808] p-2.5 sm:p-3'
    >
      {/* Barra de Filtros: Pestañas + Buscador Brutalista */}
      <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-white/[0.06] pb-2.5'>
        {/* Pestañas Neo-Brutalistas */}
        <div className='flex flex-wrap items-center gap-1 font-mono text-[8px] uppercase tracking-wider'>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type='button'
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1 border px-2 py-1 transition-all duration-150 ${
                  isActive
                    ? 'border-lime-400 bg-lime-400 text-[#0D0D0D] font-bold shadow-[0_0_12px_-4px_rgba(212,255,63,0.8)]'
                    : 'border-white/10 bg-white/[0.02] text-metallic-slate hover:border-white/25 hover:text-white'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[6px] ${isActive ? 'text-[#0D0D0D]/60' : 'text-metallic-slate/40'}`}>
                  {tab.cyrillic}
                </span>
              </button>
            );
          })}
        </div>

        {/* Buscador de Cuotas con debounce */}
        <div className='relative min-w-[180px] sm:w-56'>
          <Search size={11} className='pointer-events-none absolute left-2 top-2 text-metallic-slate' aria-hidden='true' />
          <input
            type='text'
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder='Filtrar cuotas (KO, +2.5...)'
            aria-label='Buscar en mercados de este combate'
            className='h-7 w-full border border-white/10 bg-[#0E0E0E] pl-6 pr-6 font-mono text-[9px] uppercase text-white placeholder:text-metallic-slate/50 focus:border-lime-400/60 focus:bg-[#121212] focus:outline-none'
          />
          {searchTerm && (
            <button
              type='button'
              onClick={() => setSearchTerm('')}
              aria-label='Limpiar búsqueda'
              className='absolute right-2 top-2 text-metallic-slate hover:text-white'
            >
              <X size={10} aria-hidden='true' />
            </button>
          )}
        </div>
      </div>

      {/* Grid de Mercados Filtrados */}
      {activeColumnsCount === 0 ? (
        <div className='flex h-20 items-center justify-center border border-dashed border-white/10 text-center font-mono text-[9px] uppercase tracking-wide text-metallic-slate'>
          [ 0 COINCIDENCIAS PARA &quot;{query}&quot; ]
        </div>
      ) : (
        <div
          className={`grid gap-2 ${
            activeColumnsCount === 1
              ? 'grid-cols-1'
              : activeColumnsCount === 2
                ? 'grid-cols-1 sm:grid-cols-2'
                : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
          }`}
        >
          {showMoneyline && (
            <MarketColumn family={markets[0].family} index={0} market={moneyline}>
              {redMoneyline || blueMoneyline ? (
                <div className='flex flex-1 flex-col gap-1.5'>
                  {redMoneyline && (
                    <MarketTile
                      market={moneyline!}
                      selection={redMoneyline}
                      isSelected={selectedSet.has(redMoneyline.id)}
                      quote={oddsMap[redMoneyline.id]}
                      onToggle={onToggle}
                      closed={closed}
                      label={shortFighterName(bout.red.name)}
                      hint={`${bout.red.record} · ${getCountryFlagEmoji(bout.red.countryCode) ? `${getCountryFlagEmoji(bout.red.countryCode)} ` : ''}${bout.red.countryCode || '—'}`}
                      corner='red'
                    />
                  )}
                  {blueMoneyline && (
                    <MarketTile
                      market={moneyline!}
                      selection={blueMoneyline}
                      isSelected={selectedSet.has(blueMoneyline.id)}
                      quote={oddsMap[blueMoneyline.id]}
                      onToggle={onToggle}
                      closed={closed}
                      label={shortFighterName(bout.blue.name)}
                      hint={`${bout.blue.record} · ${getCountryFlagEmoji(bout.blue.countryCode) ? `${getCountryFlagEmoji(bout.blue.countryCode)} ` : ''}${bout.blue.countryCode || '—'}`}
                      corner='blue'
                    />
                  )}
                  <MarketNote>Ganador · 2 vías · ПРЯМАЯ ЛИНИЯ</MarketNote>
                </div>
              ) : (
                <EmptyMarket label='Moneyline' />
              )}
            </MarketColumn>
          )}

          {showMethod && (
            <MarketColumn family={markets[1].family} index={1} market={methodMarket}>
              {methodMarket ? (
                <div className='flex flex-1 flex-col gap-2'>
                  {(
                    [
                      ['red', bout.red],
                      ['blue', bout.blue],
                    ] as const
                  ).map(([corner, fighter]) => {
                    const selections = filteredMethodSelections(corner);
                    if (selections.length === 0) return null;

                    return (
                      <div key={corner} className='min-w-0'>
                        <div className='mb-1 flex min-w-0 items-center gap-1.5'>
                          <span
                            className={`h-1 w-1 shrink-0 ${corner === 'red' ? 'bg-crimson' : 'bg-electric'}`}
                            aria-hidden='true'
                          />
                          <span className='truncate font-mono text-[8px] font-bold uppercase tracking-wide text-metallic-titanium'>
                            {shortFighterName(fighter.name)}
                          </span>
                        </div>
                        <div className='grid min-w-0 grid-cols-3 gap-1'>
                          {selections.map((selection) => {
                            const suffix = selection.code?.split('_')[1] ?? '';

                            return (
                              <MarketTile
                                key={selection.id}
                                market={methodMarket}
                                selection={selection}
                                isSelected={selectedSet.has(selection.id)}
                                quote={oddsMap[selection.id]}
                                onToggle={onToggle}
                                closed={closed}
                                label={METHOD_LABEL[suffix] ?? selection.code ?? '-'}
                                method
                              />
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  <MarketNote>6 vías · sin empate · СПОСОБ ПОБЕДЫ</MarketNote>
                </div>
              ) : (
                <EmptyMarket label='Método' />
              )}
            </MarketColumn>
          )}

          {showRounds && (
            <MarketColumn family={markets[2].family} index={2} market={roundsMarket}>
              {roundsMarket && (over || under) ? (
                <div className='flex flex-1 flex-col gap-1.5'>
                  <div className='mb-0.5 flex items-center justify-between border border-white/[0.08] bg-white/[0.02] px-1.5 py-1'>
                    <span className='font-mono text-[8px] uppercase tracking-wide text-metallic-slate'>
                      Línea
                    </span>
                    <span className='font-odds text-sm font-bold tabular-nums text-odds-neutral'>
                      {roundsMarket.line !== null ? roundsMarket.line.toFixed(1) : '—'}
                    </span>
                  </div>
                  {over && (
                    <MarketTile
                      market={roundsMarket}
                      selection={over}
                      isSelected={selectedSet.has(over.id)}
                      quote={oddsMap[over.id]}
                      onToggle={onToggle}
                      closed={closed}
                      label={`Más de ${roundsMarket.line ?? ''}`}
                      hint='Over · БОЛЬШЕ'
                    />
                  )}
                  {under && (
                    <MarketTile
                      market={roundsMarket}
                      selection={under}
                      isSelected={selectedSet.has(under.id)}
                      quote={oddsMap[under.id]}
                      onToggle={onToggle}
                      closed={closed}
                      label={`Menos de ${roundsMarket.line ?? ''}`}
                      hint='Under · МЕНЬШЕ'
                    />
                  )}
                  <MarketNote>Asaltos completados · ТОТАЛ РАУНДОВ</MarketNote>
                </div>
              ) : (
                <EmptyMarket label='Total de asaltos' />
              )}
            </MarketColumn>
          )}

          {showDecision && (
            <MarketColumn family={markets[3].family} index={3} market={decisionMarket}>
              {decisionMarket && (yes || no) ? (
                <div className='flex flex-1 flex-col gap-1.5'>
                  <div className='mb-0.5 flex items-center justify-between border border-white/[0.08] bg-white/[0.02] px-1.5 py-1'>
                    <span className='font-mono text-[8px] uppercase tracking-wide text-metallic-slate'>
                      Distancia
                    </span>
                    <span className='font-mono text-[8px] font-bold uppercase text-sage'>
                      {bout.scheduledRounds} RDS
                    </span>
                  </div>
                  {yes && (
                    <MarketTile
                      market={decisionMarket}
                      selection={yes}
                      isSelected={selectedSet.has(yes.id)}
                      quote={oddsMap[yes.id]}
                      onToggle={onToggle}
                      closed={closed}
                      label='Sí'
                      hint='Llega a decisión · ДА'
                    />
                  )}
                  {no && (
                    <MarketTile
                      market={decisionMarket}
                      selection={no}
                      isSelected={selectedSet.has(no.id)}
                      quote={oddsMap[no.id]}
                      onToggle={onToggle}
                      closed={closed}
                      label='No'
                      hint='Termina antes · НЕТ'
                    />
                  )}
                  <MarketNote>Tarjetas · 2 vías · ДОЙДЕТ ДО РЕШЕНИЯ</MarketNote>
                </div>
              ) : (
                <EmptyMarket label='Decisión' />
              )}
            </MarketColumn>
          )}
        </div>
      )}
    </div>
  );
}

function areMarketMatrixPropsEqual(prev: MarketMatrixProps, next: MarketMatrixProps): boolean {
  if (prev.event !== next.event) return false;
  if (prev.onToggle !== next.onToggle) return false;
  if (prev.defaultTab !== next.defaultTab) return false;

  for (const market of prev.event.markets) {
    for (const sel of market.selections) {
      const prevSel = prev.selectedIds.includes(sel.id);
      const nextSel = next.selectedIds.includes(sel.id);
      if (prevSel !== nextSel) return false;

      const prevQuote = prev.oddsMap[sel.id];
      const nextQuote = next.oddsMap[sel.id];
      if (prevQuote !== nextQuote) {
        if (!prevQuote || !nextQuote) return false;
        if (
          prevQuote.odds !== nextQuote.odds ||
          prevQuote.trend !== nextQuote.trend ||
          prevQuote.sequence !== nextQuote.sequence
        ) {
          return false;
        }
      }
    }
  }

  return true;
}

export default memo(MarketMatrix, areMarketMatrixPropsEqual);
