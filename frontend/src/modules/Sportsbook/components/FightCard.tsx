import { useId, useMemo } from 'react';
import { BarChart3 } from 'lucide-react';

import type { SelectionInput } from '@/domain/bets';
import type { OddsQuote } from '@/domain/odds';
import {
  findEventSource,
  type UfcEvent,
  type UfcMarket,
  type UfcSelection,
} from '@/domain/ufc';

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
 * Tarjeta de combate de la cartelera densa. No hay pestañas: MarketMatrix
 * mantiene las cuatro familias visibles y la procedencia de la cuota queda
 * siempre a la vista.
 */
export default function FightCard({
  event,
  selectedIds,
  onAddSelection,
  onRemoveSelection,
  onOpenComparison,
  oddsMap,
  featured = false,
}: FightCardProps) {
  const headingId = useId();
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

  const handleToggle = (market: UfcMarket, selection: UfcSelection) => {
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
    });
  };

  return (
    <article
      aria-labelledby={headingId}
      data-featured={featured}
      className={`fight-card group relative min-w-0 overflow-hidden rounded-xl border transition-all duration-200 ${
        featured
          ? 'border-crimson/40 shadow-[0_0_0_1px_rgb(255_42_85_/_0.1),0_18px_60px_-38px_rgb(255_42_85_/_0.42)]'
          : 'border-white/[0.08] hover:-translate-y-0.5 hover:border-crimson/30 hover:shadow-[0_18px_48px_-38px_rgb(0_0_0_/_0.9)]'
      }`}
    >
      <div
        aria-hidden='true'
        className={`h-[2px] w-full ${
          featured
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

      <FightHeader
        event={event}
        headingId={headingId}
        selectedInEvent={selectedInEvent}
        selectionCount={selectionCount}
      />

      <div className='relative flex items-center justify-between gap-3 border-t border-white/[0.055] px-3 py-1.5 sm:px-4'>
        <div className='flex min-w-0 items-center gap-2'>
          <span className='shrink-0 font-mono text-[8px] font-bold uppercase tracking-ultra text-metallic-slate'>
            Mercados
          </span>
          <span className='h-3 w-px bg-white/10' aria-hidden='true' />
          <SourceBadge source={source} />
        </div>
        <span className='hidden shrink-0 font-mono text-[8px] uppercase tracking-wide text-metallic-slate sm:inline'>
          4 familias · cuotas 2 dec
        </span>
      </div>

      <MarketMatrix
        event={event}
        selectedIds={selectedIds}
        oddsMap={oddsMap}
        onToggle={handleToggle}
      />

      <footer className='flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.04] px-3 py-2 sm:px-4'>
        <p className='min-w-0 flex-1 font-mono text-[8px] uppercase leading-relaxed tracking-wide text-metallic-slate'>
          {source?.kind === 'model'
            ? 'Línea de referencia ZenBet · no ejecutable'
            : source?.kind === 'aggregator'
              ? 'Consenso snapshot · referencia, no cuota ejecutable'
              : 'Precio informativo · verifica la fuente antes de apostar'}
        </p>
        <div className='flex shrink-0 items-center gap-2'>
          <button
            type='button'
            onClick={() => onOpenComparison(event)}
            aria-label={`Abrir ficha técnica de ${bout.red.name} vs ${bout.blue.name}`}
            className='inline-flex items-center gap-1.5 border border-[#D4AF37]/30 bg-[#D4AF37]/[0.055] px-2 py-1 font-mono text-[8px] font-bold uppercase tracking-wide text-[#FFD700] transition-colors duration-150 hover:border-[#D4AF37]/55 hover:bg-[#D4AF37]/[0.11] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#D4AF37]'
          >
            <BarChart3 size={10} aria-hidden='true' />
            Ficha H2H
          </button>
          <span className='font-mono text-[8px] uppercase tracking-wide text-metallic-slate'>
            {bout.venue || 'Sede por confirmar'}
          </span>
        </div>
      </footer>
    </article>
  );
}
