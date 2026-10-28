import { memo, useId, useMemo, useState } from 'react';
import { BarChart3, Check, ChevronDown, ChevronUp } from 'lucide-react';

import type { SelectionInput } from '@/domain/bets';
import { formatDecimalOdds, type OddsQuote } from '@/domain/odds';
import {
  findEventSource,
  findMarket,
  findSelectionByCode,
  formatAmericanOdds,
  isTerminalEventStatus,
  shortFighterName,
  type UfcEvent,
  type UfcMarket,
  type UfcSelection,
} from '@/domain/ufc';
import { prefetchFighterComparison } from '@/services/ufcService';

import FightHeader from './FightHeader';
import MarketMatrix from './MarketMatrix';
import SourceBadge from './SourceBadge';

interface FightCardProps {
  readonly event: UfcEvent;
  readonly selectedIds: readonly string[];
  readonly onAddSelection: (selection: SelectionInput) => void;
  readonly onRemoveSelection: (selectionId: string) => void;
  readonly onOpenComparison: (event: UfcEvent) => void;
  readonly oddsMap: Readonly<Record<string, OddsQuote>>;
  readonly featured?: boolean;
}

/**
 * Tarjeta de combate Neo-Brutalista de alta densidad.
 *
 * Por defecto muestra únicamente las cuotas principales de Ganador (Línea Moneyline)
 * para eliminar la sobrecarga visual, con un botón brutalista desplegable
 * [ + MERCADOS () ] que abre la búsqueda en vivo y pestañas de categorías.
 */
function FightCard({
  event,
  selectedIds,
  onAddSelection,
  onRemoveSelection,
  onOpenComparison,
  oddsMap,
  featured = false,
}: FightCardProps) {
  const headingId = useId();
  const [isExpanded, setIsExpanded] = useState(false);

  const { bout } = event;
  const source = useMemo(() => findEventSource(event), [event]);

  const selectionIds = useMemo(
    () =>
      new Set(
        event.markets.flatMap((market) =>
          market.selections.map((selection) => selection.id),
        ),
      ),
    [event],
  );

  const selectedInEvent = selectedIds.filter((id) => selectionIds.has(id)).length;
  const selectionCount = event.markets.reduce(
    (count, market) => count + market.selections.length,
    0,
  );

  const isFinished = event.isExpired || isTerminalEventStatus(event.status);
  const isClosed = isFinished || !event.isBettingOpen;

  const moneyline = useMemo(() => findMarket(event, 'moneyline'), [event]);
  const redMoneyline = useMemo(() => findSelectionByCode(moneyline, 'red'), [moneyline]);
  const blueMoneyline = useMemo(() => findSelectionByCode(moneyline, 'blue'), [moneyline]);

  const extraSelectionsCount = useMemo(() => {
    return event.markets
      .filter((m) => m.typeKey !== 'moneyline')
      .reduce((sum, m) => sum + m.selections.length, 0);
  }, [event]);

  const handleToggle = (market: UfcMarket, selection: UfcSelection) => {
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
      marketLabel:
        market.line !== null ? `${market.name} ${market.line.toFixed(1)}` : market.name,
      selectionName: selection.name,
      odds: oddsMap[selection.id]?.odds ?? selection.decimalOdds,
      eventStatus: event.status,
      eventEndsAt: event.endsAt,
      eventIsExpired: event.isExpired,
      eventIsBettingOpen: event.isBettingOpen,
    });
  };

  const redOdds = redMoneyline
    ? oddsMap[redMoneyline.id]?.odds && oddsMap[redMoneyline.id]!.odds > 1
      ? oddsMap[redMoneyline.id]!.odds
      : redMoneyline.decimalOdds
    : null;

  const blueOdds = blueMoneyline
    ? oddsMap[blueMoneyline.id]?.odds && oddsMap[blueMoneyline.id]!.odds > 1
      ? oddsMap[blueMoneyline.id]!.odds
      : blueMoneyline.decimalOdds
    : null;

  const isRedSelected = redMoneyline ? selectedIds.includes(redMoneyline.id) : false;
  const isBlueSelected = blueMoneyline ? selectedIds.includes(blueMoneyline.id) : false;

  return (
    <article
      aria-labelledby={headingId}
      data-featured={featured}
      data-closed={isClosed}
      data-expired={event.isExpired}
      data-effective-status={event.status}
      className={`fight-card group relative min-w-0 overflow-hidden border transition-all duration-200 ${
        isClosed
          ? 'border-white/[0.055] bg-[#050505]'
          : featured
            ? 'border-crimson/40 shadow-[0_0_0_1px_rgb(255_42_85_/_0.1),0_18px_60px_-38px_rgb(255_42_85_/_0.42)]'
            : 'border-white/[0.08] hover:border-lime-400/30 hover:shadow-[0_18px_48px_-38px_rgb(0_0_0_/_0.9)]'
      }`}
    >
      <div
        aria-hidden='true'
        className={`h-[2px] w-full ${
          isClosed
            ? 'bg-linear-to-r from-transparent via-white/12 to-transparent'
            : featured
              ? 'bg-linear-to-r from-crimson/20 via-crimson to-crimson/20'
              : bout.isTitleFight
                ? 'bg-linear-to-r from-crimson/10 via-crimson to-crimson/10'
                : 'bg-linear-to-r from-transparent via-white/15 to-transparent'
        }`}
      />

      <span
        aria-hidden='true'
        className='pointer-events-none absolute -right-1 top-1 select-none font-display text-[76px] font-black leading-none tracking-tightest text-white/[0.018]'
      >
        {String(bout.billingOrder).padStart(2, '0')}
      </span>

      {/* Póster oficial de alta resolución como fondo ambiental cinemático */}
      {(event.posterUrl || bout.posterUrl) && (
        <div
          aria-hidden='true'
          className='pointer-events-none absolute inset-0 overflow-hidden opacity-[0.08] transition-opacity duration-300 group-hover:opacity-[0.14]'
        >
          <img
            src={event.posterUrl || bout.posterUrl || ''}
            alt=''
            loading='lazy'
            decoding='async'
            className='h-full w-full object-cover object-center saturate-75'
          />
          <div className='absolute inset-0 bg-gradient-to-b from-[#0A0A0A]/60 via-transparent to-[#0A0A0A]' />
        </div>
      )}

      <FightHeader
        event={event}
        headingId={headingId}
        selectedInEvent={selectedInEvent}
        selectionCount={selectionCount}
      />

      {/* LÍNEA PRINCIPAL DE GANADOR (MONEYLINE) - Visible por defecto */}
      {moneyline && redMoneyline && blueMoneyline && (
        <div className='border-t border-white/[0.06] bg-[#0A0A0A] p-2 sm:p-2.5'>
          <div className='mb-1.5 flex items-center justify-between font-mono text-[8px] uppercase tracking-wider text-metallic-slate'>
            <div className='flex items-center gap-1.5'>
              <span className='h-1.5 w-1.5 bg-crimson' aria-hidden='true' />
              <span className='font-bold text-metallic-platinum'>01 Ganador del combate</span>
              <span className='text-[7px] opacity-35'>ИСХОД · ЛИНИЯ</span>
            </div>
            <span className='text-[7px] text-metallic-slate/50'>2 VÍAS · SIN EMPATE</span>
          </div>

          <div className='grid grid-cols-2 gap-2'>
            {/* Esquina Roja */}
            <button
              type='button'
              onClick={() => handleToggle(moneyline, redMoneyline)}
              disabled={isClosed}
              aria-pressed={isRedSelected}
              className={`flex items-center justify-between border p-2 text-left transition-all duration-150 ${
                isClosed
                  ? 'cursor-not-allowed border-white/[0.05] bg-[#050505] opacity-50'
                  : isRedSelected
                    ? 'border-lime-400 bg-lime-400/[0.09] shadow-[0_0_16px_-6px_rgba(212,255,63,0.7)]'
                    : 'border-white/[0.08] bg-[#0E0E0E] hover:border-crimson/40 hover:bg-[#141414]'
              }`}
            >
              <div className='flex min-w-0 items-center gap-1.5'>
                <span className='grid h-4 w-4 shrink-0 place-items-center border border-crimson/50 bg-crimson/15 font-mono text-[7px] font-bold text-crimson'>
                  R
                </span>
                <div className='min-w-0'>
                  <span className='block truncate font-display text-[11px] font-bold uppercase text-white'>
                    {shortFighterName(bout.red.name)}
                  </span>
                  <span className='block truncate font-mono text-[7px] text-metallic-slate'>
                    {bout.red.record}
                  </span>
                </div>
              </div>

              <div className='flex shrink-0 items-baseline gap-1'>
                {isRedSelected && <Check size={11} strokeWidth={3} className='text-lime-400' />}
                <span className='font-mono text-[7px] font-bold text-metallic-slate/35'>КОЭФ</span>
                <span className={`font-odds text-sm font-bold tabular-nums ${isRedSelected ? 'text-lime-400' : 'text-white'}`}>
                  {redOdds !== null ? formatDecimalOdds(redOdds) : '—'}
                </span>
                <span className='hidden font-mono text-[7px] text-metallic-slate/60 sm:inline'>
                  {redOdds !== null ? formatAmericanOdds(redOdds) : ''}
                </span>
              </div>
            </button>

            {/* Esquina Azul */}
            <button
              type='button'
              onClick={() => handleToggle(moneyline, blueMoneyline)}
              disabled={isClosed}
              aria-pressed={isBlueSelected}
              className={`flex items-center justify-between border p-2 text-left transition-all duration-150 ${
                isClosed
                  ? 'cursor-not-allowed border-white/[0.05] bg-[#050505] opacity-50'
                  : isBlueSelected
                    ? 'border-lime-400 bg-lime-400/[0.09] shadow-[0_0_16px_-6px_rgba(212,255,63,0.7)]'
                    : 'border-white/[0.08] bg-[#0E0E0E] hover:border-sage/40 hover:bg-[#141414]'
              }`}
            >
              <div className='flex min-w-0 items-center gap-1.5'>
                <span className='grid h-4 w-4 shrink-0 place-items-center border border-sage/50 bg-sage/15 font-mono text-[7px] font-bold text-sage'>
                  B
                </span>
                <div className='min-w-0'>
                  <span className='block truncate font-display text-[11px] font-bold uppercase text-white'>
                    {shortFighterName(bout.blue.name)}
                  </span>
                  <span className='block truncate font-mono text-[7px] text-metallic-slate'>
                    {bout.blue.record}
                  </span>
                </div>
              </div>

              <div className='flex shrink-0 items-baseline gap-1'>
                {isBlueSelected && <Check size={11} strokeWidth={3} className='text-lime-400' />}
                <span className='font-mono text-[7px] font-bold text-metallic-slate/35'>КОЭФ</span>
                <span className={`font-odds text-sm font-bold tabular-nums ${isBlueSelected ? 'text-lime-400' : 'text-white'}`}>
                  {blueOdds !== null ? formatDecimalOdds(blueOdds) : '—'}
                </span>
                <span className='hidden font-mono text-[7px] text-metallic-slate/60 sm:inline'>
                  {blueOdds !== null ? formatAmericanOdds(blueOdds) : ''}
                </span>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* BOTÓN DESPLEGABLE ESTILO NEO-BRUTALISTA */}
      <button
        type='button'
        onClick={() => setIsExpanded((prev) => !prev)}
        aria-expanded={isExpanded}
        className='group/acc flex w-full items-center justify-between border-t border-b border-white/[0.08] bg-[#0C0C0C] px-3 py-2 font-mono text-[9px] uppercase tracking-wider transition-colors hover:border-lime-400/40 hover:bg-lime-400/[0.04]'
      >
        <div className='flex items-center gap-2'>
          <span className='font-bold text-lime-400 group-hover/acc:text-lime-300'>
            {isExpanded ? '[ − COLAPSAR MERCADOS ]' : `[ + MERCADOS (${extraSelectionsCount > 0 ? `+${extraSelectionsCount}` : `${event.markets.length}`}) ]`}
          </span>
          <span className='text-[7px] text-metallic-slate/40'>
            {isExpanded ? 'СВЕРНУТЬ' : 'РАСШИРЕННАЯ ЛИНИЯ'}
          </span>
        </div>

        <div className='flex items-center gap-1.5 text-[8px] text-metallic-slate'>
          <span>{isExpanded ? 'Ocultar familias' : 'Ver método, asaltos y tarjetas'}</span>
          {isExpanded ? (
            <ChevronUp size={12} className='text-lime-400' aria-hidden='true' />
          ) : (
            <ChevronDown size={12} className='text-lime-400' aria-hidden='true' />
          )}
        </div>
      </button>

      {/* SECCIÓN EXPANDIDA: Pestañas + Buscador + Matriz completa */}
      {isExpanded && (
        <div className='border-t border-white/[0.06] animate-in fade-in duration-150'>
          <MarketMatrix
            event={event}
            selectedIds={selectedIds}
            oddsMap={oddsMap}
            onToggle={handleToggle}
            defaultTab='all'
          />
        </div>
      )}

      {/* PIE DE TARJETA BRUTALISTA */}
      <footer className='flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.04] bg-[#070707] px-3 py-2 sm:px-4'>
        <div className='flex min-w-0 flex-1 items-center gap-2'>
          <SourceBadge source={source} />
          <p className='truncate font-mono text-[8px] uppercase tracking-wide text-metallic-slate'>
            {isClosed
              ? isFinished
                ? 'Combate finalizado · mercados cerrados'
                : 'Combate suspendido · mercados cerrados'
              : event.status === 'live'
                ? 'Cuotas en vivo · ПРЯМОЙ ЭФИР'
                : 'Línea oficial ZenBet · ЛИНИЯ'}
          </p>
        </div>

        <div className='flex shrink-0 items-center gap-2'>
          <button
            type='button'
            onClick={() => onOpenComparison(event)}
            onMouseEnter={() => prefetchFighterComparison(event.id)}
            onFocus={() => prefetchFighterComparison(event.id)}
            aria-label={`Abrir ficha técnica de ${bout.red.name} vs ${bout.blue.name}`}
            className='inline-flex items-center gap-1.5 border border-lime-400/30 bg-lime-400/[0.055] px-2 py-1 font-mono text-[8px] font-bold uppercase tracking-wide text-lime-400 transition-colors duration-150 hover:border-lime-400/55 hover:bg-lime-400/[0.12] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lime-400'
          >
            <BarChart3 size={10} aria-hidden='true' />
            Ficha H2H
          </button>
          <span className='font-mono text-[8px] uppercase tracking-wide text-metallic-slate/80'>
            {bout.venue || 'Sede por confirmar'}
          </span>
        </div>
      </footer>
    </article>
  );
}

function areFightCardPropsEqual(prev: FightCardProps, next: FightCardProps): boolean {
  if (prev.event !== next.event) return false;
  if (prev.featured !== next.featured) return false;
  if (prev.onAddSelection !== next.onAddSelection) return false;
  if (prev.onRemoveSelection !== next.onRemoveSelection) return false;
  if (prev.onOpenComparison !== next.onOpenComparison) return false;

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

export default memo(FightCard, areFightCardPropsEqual);
