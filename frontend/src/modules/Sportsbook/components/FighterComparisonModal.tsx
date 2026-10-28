import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Activity,
  CalendarClock,
  MapPin,
  ShieldCheck,
  Swords,
  Target,
  X,
} from 'lucide-react';

import type { SelectionInput } from '@/domain/bets';
import type { OddsQuote } from '@/domain/odds';
import {
  fightResultLabel,
  fightStatusLabel,
  findEventSource,
  formatFightClock,
  formatFighterStance,
  formatFightDate,
  formatRank,
  formatWeightDivision,
  isTerminalEventStatus,
  type UfcEvent,
  type UfcFighter,
  type UfcFighterComparison,
  type UfcMarket,
  type UfcSelection,
} from '@/domain/ufc';
import { compareFighters, getCachedFighterComparison } from '@/services/ufcService';

import FighterAvatar from './FighterAvatar';
import MarketMatrix from './MarketMatrix';
import SourceBadge from './SourceBadge';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

type Corner = 'red' | 'blue';
type SyncState = 'loading' | 'ready' | 'error';

interface FighterComparisonModalProps {
  readonly event: UfcEvent;
  readonly selectedIds: readonly string[];
  readonly oddsMap: Readonly<Record<string, OddsQuote>>;
  readonly onAddSelection: (selection: SelectionInput) => void;
  readonly onRemoveSelection: (selectionId: string) => void;
  readonly onClose: () => void;
}

function formatPercent(value: number | null): string {
  if (value === null) return '—';
  return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}%`;
}

function formatReach(value: number | null): string {
  return value === null ? '—' : `${value}"`;
}

function metricRatio(value: number | null, min: number, max: number): number {
  if (value === null || max <= min) return 0;
  const ratio = ((value - min) / (max - min)) * 100;
  return Math.max(2, Math.min(100, ratio));
}

interface MetricBarsProps {
  readonly redValue: number | null;
  readonly blueValue: number | null;
  readonly min: number;
  readonly max: number;
}

function MetricBars({ redValue, blueValue, min, max }: MetricBarsProps) {
  const leader =
    redValue === null || blueValue === null
      ? null
      : redValue === blueValue
        ? 'tie'
        : redValue > blueValue
          ? 'red'
          : 'blue';

  return (
    <div className='mt-2 grid grid-cols-2 gap-1.5' aria-hidden='true'>
      <div className='h2h-track flex h-1.5 justify-end overflow-hidden'>
        <span
          className={`h-full ${leader === 'red' ? 'h2h-fill--lead' : 'h2h-fill'}`}
          style={{ width: `${metricRatio(redValue, min, max)}%` }}
        />
      </div>
      <div className='h2h-track flex h-1.5 overflow-hidden'>
        <span
          className={`h-full ${leader === 'blue' ? 'h2h-fill--lead' : 'h2h-fill'}`}
          style={{ width: `${metricRatio(blueValue, min, max)}%` }}
        />
      </div>
    </div>
  );
}

interface MetricRowProps {
  readonly label: string;
  readonly hint: string;
  readonly redDisplay: string;
  readonly blueDisplay: string;
  readonly redValue: number | null;
  readonly blueValue: number | null;
  readonly min: number;
  readonly max: number;
}

function MetricRow({
  label,
  hint,
  redDisplay,
  blueDisplay,
  redValue,
  blueValue,
  min,
  max,
}: MetricRowProps) {
  const leader =
    redValue === null || blueValue === null
      ? null
      : redValue === blueValue
        ? 'tie'
        : redValue > blueValue
          ? 'red'
          : 'blue';

  return (
    <div className='border-b border-white/[0.055] py-3 last:border-b-0'>
      <div className='grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-baseline gap-2 sm:gap-3'>
        <span
          className={`min-w-0 break-words text-right font-odds text-base font-bold tabular-nums sm:text-lg ${
            leader === 'red' ? 'text-lime-400' : 'text-white/90'
          }`}
        >
          {redDisplay}
        </span>
        <span className='max-w-[11ch] text-center'>
          <span className='block font-mono text-[8px] font-bold uppercase tracking-[0.14em] text-lime-400'>
            {label}
          </span>
          <span className='mt-0.5 hidden font-mono text-[7px] uppercase tracking-wide text-metallic-slate sm:block'>
            {hint}
          </span>
        </span>
        <span
          className={`min-w-0 break-words text-left font-odds text-base font-bold tabular-nums sm:text-lg ${
            leader === 'blue' ? 'text-lime-400' : 'text-white/90'
          }`}
        >
          {blueDisplay}
        </span>
      </div>
      <MetricBars redValue={redValue} blueValue={blueValue} min={min} max={max} />
    </div>
  );
}

interface FighterColumnProps {
  readonly fighter: UfcFighter;
  readonly corner: Corner;
}

function FighterColumn({ fighter, corner }: FighterColumnProps) {
  const isRed = corner === 'red';

  return (
    <div className='relative flex min-w-0 flex-col items-center text-center'>
      <span
        aria-hidden='true'
        className={`pointer-events-none absolute -top-6 h-24 w-24 rounded-full blur-3xl ${
          isRed ? 'bg-crimson/12' : 'bg-electric/10'
        }`}
      />
      <span
        className={`relative inline-flex items-center gap-1.5 font-mono text-[8px] font-bold uppercase tracking-ultra ${
          isRed ? 'text-crimson' : 'text-electric-soft'
        }`}
      >
        <span className={`h-1.5 w-1.5 ${isRed ? 'bg-crimson' : 'bg-electric'}`} aria-hidden='true' />
        {isRed ? 'Esquina roja' : 'Esquina azul'}
      </span>
      <FighterAvatar fighter={fighter} corner={corner} size='lg' priority className='relative mt-2' />
      <span
        className={`relative mt-2 border px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-wide ${
          fighter.rank === 'C'
            ? 'border-lime-400/45 bg-lime-400/[0.09] text-lime-400'
            : 'border-white/[0.1] bg-white/[0.025] text-metallic-titanium'
        }`}
      >
        {formatRank(fighter)}
      </span>
      <h3 className='mt-1.5 max-w-full break-words font-display text-[14px] font-bold uppercase leading-tight tracking-tight text-white sm:text-xl'>
        {fighter.name}
      </h3>
      <p className='mt-1 font-odds text-sm font-bold tabular-nums text-lime-400 sm:text-base'>
        {fighter.record}
      </p>
      <p className='mt-0.5 max-w-full truncate font-mono text-[8px] uppercase tracking-wide text-metallic-slate'>
        {fighter.countryCode || '—'} · {fighter.country || 'Sin país'}
      </p>
      <div className='mt-2 flex flex-wrap items-center justify-center gap-1.5 font-mono text-[8px] uppercase tracking-wide'>
        <span className='border border-white/[0.08] bg-white/[0.025] px-1.5 py-0.5 text-metallic-titanium'>
          {formatFighterStance(fighter.stance)}
        </span>
        <span className='border border-lime-400/20 bg-lime-400/[0.045] px-1.5 py-0.5 text-lime-400'>
          {formatPercent(fighter.winRate)} victorias
        </span>
      </div>
    </div>
  );
}

function StanceRow({ red, blue }: { readonly red: UfcFighter; readonly blue: UfcFighter }) {
  return (
    <div className='grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 border-b border-white/[0.055] py-3 sm:gap-3'>
      <span className='text-right font-odds text-sm font-bold uppercase tracking-wide text-white/90 sm:text-base'>
        {formatFighterStance(red.stance)}
      </span>
      <span className='max-w-[11ch] text-center'>
        <span className='block font-mono text-[8px] font-bold uppercase tracking-[0.14em] text-lime-400'>
          Guardia
        </span>
        <span className='mt-0.5 hidden font-mono text-[7px] uppercase tracking-wide text-metallic-slate sm:block'>
          Stance
        </span>
      </span>
      <span className='text-left font-odds text-sm font-bold uppercase tracking-wide text-white/90 sm:text-base'>
        {formatFighterStance(blue.stance)}
      </span>
    </div>
  );
}

/**
 * Ficha técnica Head-to-Head. Abre desde cualquier combate de la cartelera,
 * consulta `/fighters/compare` y permite añadir cuotas al boleto sin salir.
 * Si la consulta falla, conserva los perfiles que ya llegaron con el evento.
 */
export default function FighterComparisonModal({
  event,
  selectedIds,
  oddsMap,
  onAddSelection,
  onRemoveSelection,
  onClose,
}: FighterComparisonModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const cachedComparison = getCachedFighterComparison(event.id);
  const [comparison, setComparison] = useState<UfcFighterComparison | null>(() => cachedComparison);
  const [syncState, setSyncState] = useState<SyncState>(() => (cachedComparison ? 'ready' : 'loading'));

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const controller = new AbortController();

    void compareFighters(event.id, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setComparison(result);
        setSyncState('ready');
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setSyncState('error');
      });

    return () => controller.abort();
  }, [event.id]);

  useEffect(() => {
    const previousActiveElement = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 40);

    const handleKeyDown = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === 'Escape') {
        keyboardEvent.preventDefault();
        onCloseRef.current();
        return;
      }

      if (keyboardEvent.key !== 'Tab') return;

      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (!focusable || focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (keyboardEvent.shiftKey && document.activeElement === first) {
        keyboardEvent.preventDefault();
        last.focus();
      } else if (!keyboardEvent.shiftKey && document.activeElement === last) {
        keyboardEvent.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousActiveElement?.focus();
    };
  }, []);

  const red = comparison?.red ?? event.bout.red;
  const blue = comparison?.blue ?? event.bout.blue;
  const source = useMemo(() => findEventSource(event), [event]);
  const selectionCount = event.markets.reduce(
    (count, market) => count + market.selections.length,
    0,
  );
  const isFinished = event.isExpired || isTerminalEventStatus(event.status);
  const isClosed = isFinished || !event.isBettingOpen;
  const clockLabel = formatFightClock(event.clock);
  const statusLabel = isClosed
    ? isFinished
      ? 'FINALIZADO'
      : 'SUSPENDIDO'
    : clockLabel ?? fightStatusLabel(event);
  const resultLabel = fightResultLabel(event.result);

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

  const syncLabel =
    syncState === 'loading'
      ? 'Sincronizando'
      : syncState === 'error'
        ? 'Datos locales'
        : 'Ficha lista';

  return createPortal(
    <div
      className='fixed inset-0 z-modal overflow-y-auto bg-[#050505]/90 p-0 backdrop-blur-md sm:p-4'
      role='presentation'
      onMouseDown={(mouseEvent) => {
        if (mouseEvent.target === mouseEvent.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role='dialog'
        aria-modal='true'
        aria-labelledby={titleId}
        className='h2h-panel relative mx-auto flex h-dvh w-full max-w-[1120px] flex-col overflow-hidden sm:h-auto sm:max-h-[calc(100dvh_-_2rem)] sm:rounded-2xl'
      >
        <span className='h2h-accent-rule absolute inset-x-0 top-0 z-30 h-px' aria-hidden='true' />

        <header className='relative z-20 border-b border-lime-400/15 bg-[#0A0A0A]/95 px-4 py-3 backdrop-blur sm:px-6 sm:py-4'>
          <div className='flex items-start justify-between gap-4'>
            <div className='min-w-0'>
              <div className='flex flex-wrap items-center gap-2'>
                <span className='h-1.5 w-1.5 bg-lime-400' aria-hidden='true' />
                <p className='font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-lime-400'>
                  Zenbet // Ficha técnica
                </p>
                <span className='border border-lime-400/25 bg-lime-400/[0.06] px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-wide text-lime-400'>
                  Head to Head
                </span>
                <span
                  className={`inline-flex items-center gap-1 border px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-wide ${
                    isClosed
                      ? 'border-white/10 bg-white/[0.03] text-metallic-slate'
                      : event.status === 'live'
                        ? 'border-lime-400/35 bg-lime-400/[0.08] text-lime-400'
                        : 'border-white/[0.08] bg-white/[0.025] text-metallic-titanium'
                  }`}
                >
                  {!isClosed && event.status === 'live' && (
                    <span className='h-1.5 w-1.5 animate-pulse rounded-full bg-lime-400' aria-hidden='true' />
                  )}
                  {statusLabel}
                </span>
              </div>
              <h2
                id={titleId}
                className='mt-1.5 max-w-full break-words font-display text-[18px] font-bold uppercase leading-tight tracking-tight text-white sm:text-2xl'
              >
                {red.name} vs {blue.name}
              </h2>
              <p className='mt-1 font-mono text-[8px] uppercase tracking-wide text-metallic-slate sm:text-[9px]'>
                {event.competition ?? 'UFC'} · {formatFightDate(event.startTime)} ·{' '}
                {event.bout.billingLabel} · {event.bout.scheduledRounds} asaltos
              </p>
            </div>

            <div className='flex shrink-0 items-center gap-2'>
              <span
                className={`hidden border px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-wide sm:inline ${
                  syncState === 'error'
                    ? 'border-white/[0.1] bg-white/[0.025] text-metallic-slate'
                    : 'border-lime-400/25 bg-lime-400/[0.055] text-lime-400'
                }`}
              >
                {syncLabel}
              </span>
              <button
                ref={closeButtonRef}
                type='button'
                onClick={onClose}
                aria-label='Cerrar ficha Head-to-Head'
                className='grid h-9 w-9 place-items-center border border-white/[0.1] bg-white/[0.02] text-metallic-slate transition-colors duration-150 hover:border-lime-400/40 hover:bg-lime-400/[0.07] hover:text-lime-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lime-400'
              >
                <X size={16} aria-hidden='true' />
              </button>
            </div>
          </div>
        </header>

        {resultLabel && (
          <div className='border-b border-lime-400/12 bg-[#050505] px-4 py-2 font-mono text-[8px] font-bold uppercase tracking-wide text-metallic-titanium sm:px-6'>
            <span className='mr-2 text-lime-400/85'>Resultado final</span>{' '}
            {resultLabel}
          </div>
        )}

        <div className='min-h-0 flex-1 overflow-y-auto overscroll-contain'>
          <section className='relative overflow-hidden border-b border-lime-400/12 px-4 py-5 sm:px-6 sm:py-6'>
            <div className='shibuya-scan' aria-hidden='true' />
            <div
              aria-hidden='true'
              className='pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(239,68,68,0.075),transparent_38%,transparent_62%,rgba(56,189,248,0.06))]'
            />
            <span
              aria-hidden='true'
              className='pointer-events-none absolute right-2 top-1 select-none font-display text-[64px] font-black leading-none text-lime-400/[0.035] sm:text-[92px]'
            >
              渋谷
            </span>

            <div className='relative grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-2 sm:gap-5'>
              <FighterColumn fighter={red} corner='red' />

              <div className='flex h-full flex-col items-center justify-center gap-2 pt-7 sm:pt-10'>
                <span className='font-mono text-[8px] font-bold uppercase tracking-ultra text-lime-400'>
                  Main event
                </span>
                <span className='grid h-11 w-11 place-items-center rounded-full border border-lime-400/45 bg-[#0A0A0A] font-odds text-sm font-bold tracking-wide text-lime-400 shadow-[0_0_30px_-12px_rgba(212,255,63,0.75)] sm:h-14 sm:w-14 sm:text-base'>
                  VS
                </span>
                <span className='font-mono text-[8px] font-bold uppercase leading-tight tracking-wide text-metallic-titanium'>
                  {formatWeightDivision(event.bout)}
                </span>
                <span className='font-mono text-[8px] uppercase tracking-wide text-metallic-slate'>
                  {event.bout.scheduledRounds} asaltos
                </span>
                <span
                  className='h-12 w-px bg-linear-to-b from-lime-400/55 via-lime-400/20 to-transparent sm:h-16'
                  aria-hidden='true'
                />
              </div>

              <FighterColumn fighter={blue} corner='blue' />
            </div>

            <div className='relative mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 border-t border-white/[0.06] pt-3 font-mono text-[8px] uppercase tracking-wide text-metallic-titanium sm:text-[9px]'>
              <span className='inline-flex items-center gap-1.5'>
                <Swords size={10} className='text-lime-400' aria-hidden='true' />
                {formatWeightDivision(event.bout)}
              </span>
              <span className='inline-flex items-center gap-1.5'>
                <CalendarClock size={10} aria-hidden='true' />
                {formatFightDate(event.startTime)}
              </span>
              <span className='inline-flex min-w-0 items-center gap-1.5'>
                <MapPin size={10} aria-hidden='true' />
                <span className='truncate'>
                  {event.bout.venue || 'Sede por confirmar'} · {event.bout.location || '—'}
                </span>
              </span>
              {event.bout.isTitleFight && (
                <span className='inline-flex items-center gap-1 border border-lime-400/35 bg-lime-400/[0.08] px-1.5 py-0.5 text-lime-400'>
                  <ShieldCheck size={9} aria-hidden='true' />
                  Título
                </span>
              )}
            </div>
          </section>

          <section className='border-b border-lime-400/12 px-4 py-4 sm:px-6 sm:py-5'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
              <div className='flex items-center gap-2'>
                <Activity size={12} className='text-lime-400' aria-hidden='true' />
                <h3 className='font-display text-[11px] font-bold uppercase tracking-wide text-white sm:text-xs'>
                  Comparativa técnica
                </h3>
                <span className='border border-white/[0.08] bg-white/[0.025] px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wide text-metallic-slate'>
                  Tale of the tape
                </span>
              </div>
              <span className='inline-flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-wide text-metallic-slate'>
                <span className='h-1 w-3 h2h-fill--lead' aria-hidden='true' />
                Ventaja
              </span>
            </div>

            <div className='mt-2'>
              <MetricRow
                label='Récord'
                hint='W-L-D · % victorias'
                redDisplay={red.record}
                blueDisplay={blue.record}
                redValue={red.winRate}
                blueValue={blue.winRate}
                min={0}
                max={100}
              />
              <MetricRow
                label='Alcance'
                hint='Pulgadas'
                redDisplay={formatReach(red.reachInches)}
                blueDisplay={formatReach(blue.reachInches)}
                redValue={red.reachInches}
                blueValue={blue.reachInches}
                min={60}
                max={85}
              />
              <StanceRow red={red} blue={blue} />
              <MetricRow
                label='Defensa TD'
                hint='Derribos defendidos'
                redDisplay={formatPercent(red.takedownDefensePercent)}
                blueDisplay={formatPercent(blue.takedownDefensePercent)}
                redValue={red.takedownDefensePercent}
                blueValue={blue.takedownDefensePercent}
                min={0}
                max={100}
              />
              <MetricRow
                label='Precisión'
                hint='Golpeo significativo'
                redDisplay={formatPercent(red.strikingAccuracyPercent)}
                blueDisplay={formatPercent(blue.strikingAccuracyPercent)}
                redValue={red.strikingAccuracyPercent}
                blueValue={blue.strikingAccuracyPercent}
                min={0}
                max={100}
              />
            </div>

            <p className='mt-3 font-mono text-[8px] uppercase leading-relaxed tracking-wide text-metallic-slate'>
              Métricas técnicas de referencia del roster. No sustituyen el pesaje oficial ni la
              ficha de la comisión atlética.
            </p>
          </section>

          <section className='border-b border-lime-400/12 px-4 py-4 sm:px-6 sm:py-5'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
              <div className='flex items-center gap-2'>
                <Target size={12} className='text-lime-400' aria-hidden='true' />
                <h3 className='font-display text-[11px] font-bold uppercase tracking-wide text-white sm:text-xs'>
                  Cuotas del combate
                </h3>
              </div>
              <span className='font-mono text-[8px] uppercase tracking-wide text-metallic-slate'>
                {event.markets.length} mercados · {selectionCount} selecciones
              </span>
            </div>

            <div className='mt-3 border border-white/[0.07]'>
              <MarketMatrix
                event={event}
                selectedIds={selectedIds}
                oddsMap={oddsMap}
                onToggle={handleToggle}
              />
            </div>

            <div className='mt-3 flex flex-wrap items-center justify-between gap-2'>
              <SourceBadge source={source} />
              <p className='font-mono text-[8px] uppercase tracking-wide text-metallic-slate'>
                {isClosed
                  ? isFinished
                    ? 'Combate finalizado · mercados cerrados'
                    : 'Combate suspendido · mercados cerrados'
                  : 'Toca una cuota para añadirla al boleto · La ficha sigue abierta'}
              </p>
            </div>
          </section>

          <footer className='flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6'>
            <p className='font-mono text-[8px] uppercase tracking-wide text-metallic-slate'>
              ZenBet · Shibuya Night Edition · 渋谷夜市
            </p>
            <button
              type='button'
              onClick={onClose}
              className='border border-lime-400/30 bg-lime-400/[0.06] px-3 py-1.5 font-mono text-[8px] font-bold uppercase tracking-wide text-lime-400 transition-colors duration-150 hover:bg-lime-400/[0.12] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lime-400'
            >
              Volver a la cartelera
            </button>
          </footer>
        </div>
      </div>
    </div>,
    document.body,
  );
}
