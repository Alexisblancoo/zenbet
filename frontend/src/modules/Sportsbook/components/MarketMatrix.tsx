import { useMemo, type ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Check, Minus } from 'lucide-react';

import { formatDecimalOdds, type OddsQuote } from '@/domain/odds';
import {
  findMarket,
  findSelectionByCode,
  formatAmericanOdds,
  shortFighterName,
  UFC_MARKET_FAMILIES,
  type UfcEvent,
  type UfcMarket,
  type UfcMarketTypeKey,
  type UfcSelection,
} from '@/domain/ufc';

interface MarketMatrixProps {
  readonly event: UfcEvent;
  readonly selectedIds: readonly string[];
  readonly oddsMap: Readonly<Record<string, OddsQuote>>;
  readonly onToggle: (market: UfcMarket, selection: UfcSelection) => void;
}

const MARKET_ACCENT: Record<
  UfcMarketTypeKey,
  { tick: string; text: string; border: string; bg: string }
> = {
  moneyline: {
    tick: 'bg-crimson',
    text: 'text-crimson-200',
    border: 'border-crimson/30',
    bg: 'bg-crimson/[0.06]',
  },
  method_of_victory: {
    tick: 'bg-electric',
    text: 'text-electric-soft',
    border: 'border-electric/30',
    bg: 'bg-electric/[0.07]',
  },
  total_rounds: {
    tick: 'bg-white/80',
    text: 'text-metallic-platinum',
    border: 'border-white/20',
    bg: 'bg-white/[0.04]',
  },
  go_to_decision: {
    tick: 'bg-metallic-titanium',
    text: 'text-metallic-titanium',
    border: 'border-white/15',
    bg: 'bg-white/[0.03]',
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
}

function MarketTile({
  market,
  selection,
  isSelected,
  quote,
  onToggle,
  label,
  hint,
  corner,
  method = false,
}: MarketTileProps) {
  const liveOdds =
    quote && Number.isFinite(quote.odds) && quote.odds > 1
      ? quote.odds
      : selection.decimalOdds;
  const trend = quote?.trend ?? 'unchanged';
  const disabled = selection.settled || market.status !== 'open';
  const trendTone =
    trend === 'up' ? 'text-odds-up' : trend === 'down' ? 'text-odds-down' : 'text-metallic-slate';

  return (
    <button
      type='button'
      onClick={() => onToggle(market, selection)}
      disabled={disabled}
      aria-pressed={isSelected}
      aria-label={`${selection.name}: ${formatDecimalOdds(liveOdds)} decimal, ${formatAmericanOdds(liveOdds)} americana${isSelected ? ', seleccionada' : ''}`}
      title={`${selection.name} · ${formatDecimalOdds(liveOdds)} (${formatAmericanOdds(liveOdds)})`}
      data-selected={isSelected}
      data-trend={trend}
      className={`market-tile group min-w-0 ${method ? 'market-tile--method' : ''} ${
        disabled ? 'cursor-not-allowed opacity-40' : ''
      }`}
    >
      {method ? (
        <>
          <span className='flex w-full min-w-0 items-center justify-between gap-1'>
            <span className='truncate font-sans text-[9px] font-semibold uppercase tracking-wide text-metallic-titanium'>
              {label}
            </span>
            {isSelected && (
              <Check size={10} strokeWidth={3} className='shrink-0 text-money' aria-hidden='true' />
            )}
          </span>
          <span className='odds-number text-[12px] text-white'>{formatDecimalOdds(liveOdds)}</span>
          <span className={`truncate font-mono text-[8px] font-semibold ${trendTone}`}>
            {formatAmericanOdds(liveOdds)}
          </span>
        </>
      ) : (
        <>
          <span className='flex min-w-0 items-center gap-1.5'>
            {corner && (
              <span
                className={`grid h-3.5 w-3.5 shrink-0 place-items-center border font-mono text-[7px] font-bold ${
                  corner === 'red'
                    ? 'border-crimson/45 bg-crimson/10 text-crimson'
                    : 'border-electric/45 bg-electric/10 text-electric-soft'
                }`}
                aria-hidden='true'
              >
                {corner === 'red' ? 'R' : 'B'}
              </span>
            )}
            {isSelected && !corner && (
              <Check size={11} strokeWidth={3} className='shrink-0 text-money' aria-hidden='true' />
            )}
            <span className='min-w-0'>
              <span className='block truncate font-display text-[10px] font-semibold uppercase tracking-normal text-white sm:text-[11px]'>
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
              <span className={trendTone}>{trendIcon(trend)}</span>
              <span className='odds-number text-[14px] text-white'>{formatDecimalOdds(liveOdds)}</span>
            </span>
            <span className='hidden font-mono text-[8px] font-semibold text-metallic-slate sm:block'>
              {formatAmericanOdds(liveOdds)}
            </span>
          </span>
        </>
      )}
    </button>
  );
}

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
      className='market-panel flex min-w-0 flex-col bg-[#0A0E16]'
    >
      <header className='flex min-w-0 items-start justify-between gap-2 border-b border-white/[0.055] px-2.5 py-2'>
        <div className='flex min-w-0 items-center gap-2'>
          <span
            className={`grid h-5 w-5 shrink-0 place-items-center border font-mono text-[8px] font-bold tabular-nums ${accent.border} ${accent.bg} ${accent.text}`}
          >
            {String(index + 1).padStart(2, '0')}
          </span>
          <div className='min-w-0'>
            <div className='flex items-center gap-1.5'>
              <span className={`h-1 w-1 shrink-0 ${accent.tick}`} aria-hidden='true' />
              <h4 className='truncate font-display text-[11px] font-bold uppercase tracking-wide text-white'>
                {family.label}
              </h4>
            </div>
            <p className='mt-0.5 hidden truncate font-mono text-[8px] uppercase tracking-wide text-metallic-slate sm:block'>
              {family.caption}
            </p>
          </div>
        </div>
        {line !== null ? (
          <>
            <span className='shrink-0 font-mono text-[8px] tabular-nums text-metallic-slate min-[1440px]:hidden'>
              {market?.selections.length ?? 0}
            </span>
            <span className='hidden shrink-0 border border-electric/25 bg-electric/[0.07] px-1 py-0.5 font-mono text-[8px] font-bold tabular-nums text-electric-soft min-[1440px]:inline'>
              L {line.toFixed(1)}
            </span>
          </>
        ) : (
          <span className='shrink-0 font-mono text-[8px] tabular-nums text-metallic-slate'>
            {market?.selections.length ?? 0}
          </span>
        )}
      </header>

      <div className='flex min-h-[112px] flex-1 flex-col p-2'>{children}</div>
    </section>
  );
}

function EmptyMarket({ label }: { label: string }) {
  return (
    <div className='flex min-h-[92px] flex-col items-center justify-center gap-1.5 border border-dashed border-white/[0.1] px-2 text-center'>
      <Minus size={12} className='text-metallic-slate' aria-hidden='true' />
      <p className='font-mono text-[8px] uppercase tracking-wide text-metallic-slate'>
        {label} no publicado
      </p>
    </div>
  );
}

function MarketNote({ children }: { children: ReactNode }) {
  return (
    <p className='mt-auto pt-2 font-mono text-[8px] uppercase tracking-wide text-metallic-slate'>
      {children}
    </p>
  );
}

/**
 * Matriz de cuatro familias. No hay pestañas: el usuario ve Moneyline, método,
 * total de asaltos y decisión en la misma retícula para comparar de un vistazo.
 */
export default function MarketMatrix({
  event,
  selectedIds,
  oddsMap,
  onToggle,
}: MarketMatrixProps) {
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
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

  const { bout } = event;

  return (
    <div className='market-matrix grid grid-cols-2 gap-px overflow-hidden border-y border-white/[0.07] bg-white/[0.06] md:grid-cols-4'>
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
                label={shortFighterName(bout.red.name)}
                hint={`${bout.red.record} · ${bout.red.countryCode || '—'}`}
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
                label={shortFighterName(bout.blue.name)}
                hint={`${bout.blue.record} · ${bout.blue.countryCode || '—'}`}
                corner='blue'
              />
            )}
            <MarketNote>Ganador · 2 vías</MarketNote>
          </div>
        ) : (
          <EmptyMarket label='Moneyline' />
        )}
      </MarketColumn>

      <MarketColumn family={markets[1].family} index={1} market={methodMarket}>
        {methodMarket ? (
          <div className='flex flex-1 flex-col gap-2'>
            {(
              [
                ['red', bout.red],
                ['blue', bout.blue],
              ] as const
            ).map(([corner, fighter]) => {
              const selections = methodSelections(corner);
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
                          label={METHOD_LABEL[suffix] ?? selection.code ?? '—'}
                          method
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
            <MarketNote>6 vías · sin empate</MarketNote>
          </div>
        ) : (
          <EmptyMarket label='Método' />
        )}
      </MarketColumn>

      <MarketColumn family={markets[2].family} index={2} market={roundsMarket}>
        {roundsMarket && (over || under) ? (
          <div className='flex flex-1 flex-col gap-1.5'>
            <div className='mb-0.5 flex items-center justify-between border border-white/[0.08] bg-white/[0.025] px-1.5 py-1'>
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
                label={`Más de ${roundsMarket.line ?? ''}`}
                hint='Over'
              />
            )}
            {under && (
              <MarketTile
                market={roundsMarket}
                selection={under}
                isSelected={selectedSet.has(under.id)}
                quote={oddsMap[under.id]}
                onToggle={onToggle}
                label={`Menos de ${roundsMarket.line ?? ''}`}
                hint='Under'
              />
            )}
            <MarketNote>Asaltos completados</MarketNote>
          </div>
        ) : (
          <EmptyMarket label='Total de asaltos' />
        )}
      </MarketColumn>

      <MarketColumn family={markets[3].family} index={3} market={decisionMarket}>
        {decisionMarket && (yes || no) ? (
          <div className='flex flex-1 flex-col gap-1.5'>
            <div className='mb-0.5 flex items-center justify-between border border-white/[0.08] bg-white/[0.025] px-1.5 py-1'>
              <span className='font-mono text-[8px] uppercase tracking-wide text-metallic-slate'>
                Distancia
              </span>
              <span className='font-mono text-[8px] font-bold uppercase text-electric-soft'>
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
                label='Sí'
                hint='Llega a decisión'
              />
            )}
            {no && (
              <MarketTile
                market={decisionMarket}
                selection={no}
                isSelected={selectedSet.has(no.id)}
                quote={oddsMap[no.id]}
                onToggle={onToggle}
                label='No'
                hint='Termina antes'
              />
            )}
            <MarketNote>Tarjetas · 2 vías</MarketNote>
          </div>
        ) : (
          <EmptyMarket label='Decisión' />
        )}
      </MarketColumn>
    </div>
  );
}
