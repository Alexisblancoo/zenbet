import { memo, useDeferredValue, useMemo, useState } from 'react';
import { Check, Search, X } from 'lucide-react';

import { formatAmericanOdds, formatDecimalOdds, type OddsQuote } from '@/domain/odds';
import type {
  FootballMarket,
  FootballMarketTypeKey,
  FootballMatch,
  FootballSelection,
} from '@/domain/football';

export type FootballMarketTabKey = 'all' | 'main' | 'goals' | 'btts' | 'double_chance';

export interface FootballMarketMatrixProps {
  readonly match: FootballMatch;
  readonly selectedIds: readonly string[];
  readonly oddsMap?: Readonly<Record<string, OddsQuote>>;
  readonly flashingSelectionIds?: ReadonlySet<string>;
  readonly onToggle: (market: FootballMarket, selection: FootballSelection) => void;
  readonly defaultTab?: FootballMarketTabKey;
}

interface TabOption {
  readonly key: FootballMarketTabKey;
  readonly label: string;
  readonly cyrillic: string;
}

const TAB_OPTIONS: readonly TabOption[] = [
  { key: 'all', label: 'Todos', cyrillic: 'ВСЕ' },
  { key: 'main', label: 'Principales', cyrillic: 'ОСНОВНЫЕ' },
  { key: 'goals', label: 'Goles', cyrillic: 'ТОТАЛ' },
  { key: 'btts', label: 'Ambos Anotan', cyrillic: 'ОЗ' },
  { key: 'double_chance', label: 'Doble Op.', cyrillic: '2Х' },
];

function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

interface MarketTileProps {
  readonly market: FootballMarket;
  readonly selection: FootballSelection;
  readonly isSelected: boolean;
  readonly liveOdds: number;
  readonly closed: boolean;
  readonly isFlashing?: boolean;
  readonly onToggle: (market: FootballMarket, selection: FootballSelection) => void;
}

const MarketTile = memo(function MarketTile({
  market,
  selection,
  isSelected,
  liveOdds,
  closed,
  isFlashing = false,
  onToggle,
}: MarketTileProps) {
  const disabled = closed || selection.status !== 'active' || market.status !== 'open';
  const selected = isSelected && !closed;

  return (
    <button
      type='button'
      onClick={() => onToggle(market, selection)}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={`${selection.name}: ${formatDecimalOdds(liveOdds)} decimal, ${formatAmericanOdds(liveOdds)} americana${selected ? ', seleccionada' : ''}${closed ? ', mercado cerrado' : ''}`}
      className={`group/tile relative flex items-center justify-between gap-2 border p-2 text-left transition-all duration-150 ${
        isFlashing ? 'zb-odds-lime-flash ring-1 ring-lime-400' : ''
      } ${
        disabled
          ? 'cursor-not-allowed border-white/[0.04] bg-[#050505] opacity-50'
          : selected
            ? 'border-lime-400 bg-lime-400/[0.09] shadow-[0_0_16px_-6px_rgba(212,255,63,0.7)]'
            : 'border-white/[0.08] bg-[#0D0D0D] hover:border-lime-400/40 hover:bg-[#141414]'
      }`}
    >
      <div className='flex min-w-0 items-center gap-1.5'>
        {selection.cyrillicLabel && (
          <span
            aria-hidden='true'
            className='grid h-4 min-w-[1.25rem] shrink-0 place-items-center border border-white/10 bg-white/[0.03] px-1 font-mono text-[7px] font-bold text-metallic-slate'
          >
            {selection.cyrillicLabel}
          </span>
        )}
        <span className='truncate font-display text-[11px] font-bold uppercase text-white group-hover/tile:text-white'>
          {selection.name}
        </span>
      </div>

      <div className='flex shrink-0 items-baseline gap-1'>
        {selected && (
          <Check size={11} strokeWidth={3} className='text-lime-400' aria-hidden='true' />
        )}
        <span className='font-mono text-[7px] font-bold text-metallic-slate/35'>КОЭФ</span>
        <span
          className={`font-odds text-xs font-bold tabular-nums sm:text-sm ${
            isFlashing ? 'text-lime-300 font-black' : selected ? 'text-lime-400' : 'text-white'
          }`}
        >
          {formatDecimalOdds(liveOdds)}
        </span>
        <span className='hidden font-mono text-[7px] text-metallic-slate/60 sm:inline'>
          {formatAmericanOdds(liveOdds)}
        </span>
      </div>
    </button>
  );
});

export default function FootballMarketMatrix({
  match,
  selectedIds,
  oddsMap,
  flashingSelectionIds,
  onToggle,
  defaultTab = 'all',
}: FootballMarketMatrixProps) {
  const [activeTab, setActiveTab] = useState<FootballMarketTabKey>(defaultTab);
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);

  const isClosed = match.isExpired || !match.isBettingOpen || match.status === 'finished';

  // Filtrado por pestaña
  const tabFilteredMarkets = useMemo(() => {
    if (activeTab === 'all') return match.markets;

    return match.markets.filter((m) => {
      switch (activeTab) {
        case 'main':
          return (
            m.typeKey === 'match_result_1x2' ||
            m.typeKey === 'double_chance' ||
            m.typeKey === 'draw_no_bet'
          );
        case 'goals':
          return m.typeKey === 'total_goals';
        case 'btts':
          return m.typeKey === 'both_teams_to_score';
        case 'double_chance':
          return m.typeKey === 'double_chance';
        default:
          return true;
      }
    });
  }, [match.markets, activeTab]);

  // Filtrado local por término de búsqueda
  const filteredMarkets = useMemo(() => {
    const term = normalizeText(deferredSearchTerm);
    if (!term) return tabFilteredMarkets;

    return tabFilteredMarkets.filter((market) => {
      const marketNameNorm = normalizeText(market.name);
      const cyrillicTagNorm = normalizeText(market.cyrillicMeta.cyrillicTag);
      const cyrillicHintNorm = normalizeText(market.cyrillicMeta.cyrillicHint ?? '');

      if (
        marketNameNorm.includes(term) ||
        cyrillicTagNorm.includes(term) ||
        cyrillicHintNorm.includes(term)
      ) {
        return true;
      }

      return market.selections.some(
        (sel) =>
          normalizeText(sel.name).includes(term) ||
          normalizeText(sel.cyrillicLabel ?? '').includes(term) ||
          normalizeText(sel.code).includes(term),
      );
    });
  }, [tabFilteredMarkets, deferredSearchTerm]);

  return (
    <div className='border-t border-white/[0.08] bg-[#070707] p-3 sm:p-4'>
      {/* Barra de Filtros: Pestañas + Buscador */}
      <div className='flex flex-col gap-2.5 pb-3 border-b border-white/[0.06] sm:flex-row sm:items-center sm:justify-between'>
        {/* Pestañas de categorías estilo brutalista */}
        <div
          role='tablist'
          aria-label='Categorías de mercados de fútbol'
          className='flex flex-wrap items-center gap-1'
        >
          {TAB_OPTIONS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type='button'
                role='tab'
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-1.5 border px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider transition-colors duration-150 ${
                  isActive
                    ? 'border-lime-400 bg-lime-400/[0.12] text-lime-400 font-bold shadow-[0_0_12px_-4px_rgba(212,255,63,0.4)]'
                    : 'border-white/[0.07] bg-white/[0.02] text-metallic-slate hover:border-white/20 hover:text-white'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[7px] ${isActive ? 'text-lime-400/80' : 'text-metallic-slate/40'}`}
                >
                  {tab.cyrillic}
                </span>
              </button>
            );
          })}
        </div>

        {/* Buscador de cuotas con microbadge ruso */}
        <div className='relative w-full sm:w-64'>
          <Search
            size={12}
            className='pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-metallic-slate'
            aria-hidden='true'
          />
          <input
            type='search'
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder='Buscar mercados... (ej. goles, 2.5, sí)'
            aria-label='Buscar en mercados de fútbol'
            className='w-full border border-white/[0.08] bg-[#0A0A0A] py-1.5 pl-8 pr-16 font-mono text-[10px] text-white placeholder-metallic-slate/50 transition-colors focus:border-lime-400 focus:bg-[#0E0E0E] focus:outline-none'
          />
          {searchTerm ? (
            <button
              type='button'
              onClick={() => setSearchTerm('')}
              aria-label='Limpiar búsqueda'
              className='absolute right-2 top-1/2 -translate-y-1/2 text-metallic-slate hover:text-white'
            >
              <X size={12} />
            </button>
          ) : (
            <span
              aria-hidden='true'
              className='pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[7px] font-bold tracking-widest text-metallic-slate/30'
            >
              ПОИСК
            </span>
          )}
        </div>
      </div>

      {/* Listado de Familias de Mercados */}
      {filteredMarkets.length === 0 ? (
        <div className='py-6 text-center'>
          <p className='font-mono text-[10px] uppercase tracking-wide text-metallic-slate'>
            No se encontraron mercados coincidentes con &quot;{searchTerm}&quot;
          </p>
          <button
            type='button'
            onClick={() => {
              setSearchTerm('');
              setActiveTab('all');
            }}
            className='mt-2 inline-flex border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider text-lime-400 hover:border-lime-400/40'
          >
            Restablecer filtros
          </button>
        </div>
      ) : (
        <div className='mt-3 space-y-3'>
          {filteredMarkets.map((market) => {
            const hasCols3 = market.selections.length === 3;
            const gridColsClass = hasCols3
              ? 'grid-cols-1 sm:grid-cols-3'
              : market.selections.length === 2
                ? 'grid-cols-1 sm:grid-cols-2'
                : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4';

            return (
              <div
                key={market.id}
                className='border border-white/[0.05] bg-[#0A0A0A]/90 p-2.5'
              >
                {/* Cabecera de Mercado con Micro-Detalle Cirílico */}
                <div className='mb-2 flex items-center justify-between font-mono text-[8px] uppercase tracking-wider text-metallic-slate'>
                  <div className='flex items-center gap-1.5'>
                    <span className='h-1.5 w-1.5 bg-lime-400' aria-hidden='true' />
                    <span className='font-bold text-white'>{market.name}</span>
                    <span className='text-[7px] text-metallic-slate/40'>
                      · {market.cyrillicMeta.cyrillicTag}
                    </span>
                  </div>
                  {market.cyrillicMeta.cyrillicHint && (
                    <span className='text-[7px] text-metallic-slate/40'>
                      {market.cyrillicMeta.cyrillicHint}
                    </span>
                  )}
                </div>

                {/* Grilla de Fichas de Cuotas */}
                <div className={`grid gap-2 ${gridColsClass}`}>
                  {market.selections.map((sel) => {
                    const quote = oddsMap?.[sel.id];
                    const liveOdds =
                      quote && Number.isFinite(quote.odds) && quote.odds > 1
                        ? quote.odds
                        : sel.decimalOdds;
                    const isSelected = selectedIds.includes(sel.id);
                    const isFlashing = flashingSelectionIds?.has(sel.id) ?? false;

                    return (
                      <MarketTile
                        key={sel.id}
                        market={market}
                        selection={sel}
                        isSelected={isSelected}
                        liveOdds={liveOdds}
                        closed={isClosed}
                        isFlashing={isFlashing}
                        onToggle={onToggle}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
