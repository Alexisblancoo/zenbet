import { memo, useId, useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Clock, MapPin, Radio, Shield } from 'lucide-react';

import type { SelectionInput } from '@/domain/bets';
import { formatAmericanOdds, formatDecimalOdds, type OddsQuote } from '@/domain/odds';
import {
  formatFootballClockDisplay,
  formatFootballMatchTime,
  getFootballStatusDescriptor,
  getMatch1X2,
  toFootballSelectionInput,
  type FootballMarket,
  type FootballMatch,
  type FootballSelection,
  type FootballTeam,
} from '@/domain/football';

import FootballMarketMatrix from './FootballMarketMatrix';

export interface FootballMatchCardProps {
  readonly match: FootballMatch;
  readonly selectedIds: readonly string[];
  readonly oddsMap?: Readonly<Record<string, OddsQuote>>;
  readonly flashingSelectionIds?: ReadonlySet<string>;
  readonly onAddSelection: (selection: SelectionInput) => void;
  readonly onRemoveSelection: (selectionId: string) => void;
  readonly featured?: boolean;
}

/**
 * Emblema / Escudo de equipo de fútbol de alta definición.
 * Si la imagen de CDN o SVG falla, muestra el código de 3 letras estilizado.
 */
function TeamCrest({ team }: { readonly team: FootballTeam }) {
  const [failed, setFailed] = useState(false);

  return (
    <div className='relative grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-md border border-white/15 bg-white/[0.04] p-1 font-mono text-[10px] font-bold text-white shadow-inner sm:h-9 sm:w-9'>
      {team.logoUrl && !failed ? (
        <img
          src={team.logoUrl}
          alt={team.name}
          loading='lazy'
          className='h-full w-full object-contain'
          onError={() => setFailed(true)}
        />
      ) : (
        <span>{team.code || team.name.slice(0, 3).toUpperCase()}</span>
      )}
    </div>
  );
}

/**
 * Tarjeta de partido de fútbol Neo-Brutalista de alta densidad.
 *
 * Muestra por defecto la línea 1X2 (Local, Empate, Visitante) con cuotas en tiempo real
 * y el botón de expansión interactivo `[ + MERCADOS (N) ]` para abrir los mercados
 * secundarios con estética Shibuya Lime (#D4FF3F), destellos neón y microdetalles en cirílico.
 */
function FootballMatchCard({
  match,
  selectedIds,
  oddsMap,
  flashingSelectionIds,
  onAddSelection,
  onRemoveSelection,
  featured = false,
}: FootballMatchCardProps) {
  const headingId = useId();
  const [isExpanded, setIsExpanded] = useState(false);

  const isClosed = match.isExpired || !match.isBettingOpen || match.status === 'finished';
  const isLive = match.status === 'live';
  const statusDesc = useMemo(() => getFootballStatusDescriptor(match.status), [match.status]);
  const localTime = useMemo(
    () => formatFootballMatchTime(match.startTimeUTC),
    [match.startTimeUTC],
  );
  const clockDisplay = useMemo(
    () => formatFootballClockDisplay(match.clock),
    [match.clock],
  );

  // Línea 1X2 principal
  const { market: m1x2, home: homeSel, draw: drawSel, away: awaySel } = useMemo(
    () => getMatch1X2(match),
    [match],
  );

  const extraMarketsCount = useMemo(() => {
    return match.markets
      .filter((m) => m.typeKey !== 'match_result_1x2')
      .reduce((sum, m) => sum + m.selections.length, 0);
  }, [match.markets]);

  const handleToggle = (market: FootballMarket, selection: FootballSelection) => {
    if (isClosed) return;

    if (selectedIds.includes(selection.id)) {
      onRemoveSelection(selection.id);
      return;
    }

    const liveOdds =
      oddsMap?.[selection.id]?.odds && oddsMap[selection.id]!.odds > 1
        ? oddsMap[selection.id]!.odds
        : selection.decimalOdds;

    onAddSelection(toFootballSelectionInput(match, market, selection, liveOdds));
  };

  const getOdds = (sel: FootballSelection | undefined) => {
    if (!sel) return null;
    const quote = oddsMap?.[sel.id];
    return quote && quote.odds > 1 ? quote.odds : sel.decimalOdds;
  };

  const homeOdds = getOdds(homeSel);
  const drawOdds = getOdds(drawSel);
  const awayOdds = getOdds(awaySel);

  const isHomeSelected = homeSel ? selectedIds.includes(homeSel.id) : false;
  const isDrawSelected = drawSel ? selectedIds.includes(drawSel.id) : false;
  const isAwaySelected = awaySel ? selectedIds.includes(awaySel.id) : false;

  const isHomeFlashing = homeSel ? Boolean(flashingSelectionIds?.has(homeSel.id)) : false;
  const isDrawFlashing = drawSel ? Boolean(flashingSelectionIds?.has(drawSel.id)) : false;
  const isAwayFlashing = awaySel ? Boolean(flashingSelectionIds?.has(awaySel.id)) : false;

  return (
    <article
      aria-labelledby={headingId}
      data-featured={featured}
      data-closed={isClosed}
      data-live={isLive}
      className={`group relative min-w-0 overflow-hidden border transition-all duration-200 ${
        isClosed
          ? 'border-white/[0.055] bg-[#050505]'
          : featured
            ? 'border-lime-400/50 shadow-[0_0_0_1px_rgba(212,255,63,0.15),0_18px_60px_-38px_rgba(212,255,63,0.35)]'
            : isLive
              ? 'border-lime-400/35 bg-[#0A0A0A] shadow-[0_0_24px_-12px_rgba(212,255,63,0.2)]'
              : 'border-white/[0.08] bg-[#0A0A0A] hover:border-lime-400/30 hover:shadow-[0_18px_48px_-38px_rgba(0,0,0,0.9)]'
      }`}
    >
      {/* Franja superior de acento */}
      <div
        aria-hidden='true'
        className={`h-[2px] w-full ${
          isLive
            ? 'bg-linear-to-r from-transparent via-lime-400 to-transparent'
            : featured
              ? 'bg-linear-to-r from-transparent via-lime-400/70 to-transparent'
              : 'bg-linear-to-r from-transparent via-white/12 to-transparent'
        }`}
      />

      {/* CABECERA DEL PARTIDO: Liga, Jornada, Estado en vivo / Horario local */}
      <header className='flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.05] bg-[#0C0C0C] px-3 py-2 sm:px-4'>
        <div className='flex min-w-0 items-center gap-2'>
          <span className='grid h-5 px-1.5 place-items-center border border-white/10 bg-white/[0.03] font-mono text-[8px] font-bold uppercase text-white/90'>
            {match.league.shortName || match.league.countryCode}
          </span>
          <div className='min-w-0'>
            <span className='truncate font-mono text-[9px] font-bold uppercase tracking-wider text-white'>
              {match.league.name}
            </span>
            {match.league.matchday && (
              <span className='ml-1.5 hidden font-mono text-[8px] text-metallic-slate sm:inline'>
                · {match.league.matchday}
              </span>
            )}
          </div>
        </div>

        {/* Estado en vivo o fecha/hora local */}
        <div className='flex items-center gap-2 font-mono text-[9px]'>
          {isLive ? (
            <div className='flex items-center gap-1.5 border border-lime-400/40 bg-lime-400/[0.08] px-2 py-0.5 text-lime-400 shadow-[0_0_10px_rgba(212,255,63,0.2)]'>
              <span className='h-1.5 w-1.5 rounded-full bg-lime-400 motion-safe:animate-pulse' />
              <span className='font-bold uppercase tracking-wider'>LIVE {clockDisplay.text}</span>
              <span className='text-[7px] opacity-75'>· {clockDisplay.cyrillicPeriodText}</span>
            </div>
          ) : match.status === 'finished' ? (
            <div className='border border-white/10 bg-white/[0.03] px-2 py-0.5 font-bold uppercase tracking-wider text-metallic-slate'>
              FINAL · {statusDesc.cyrillic}
            </div>
          ) : (
            <div className='flex items-center gap-1.5 text-metallic-slate'>
              <Clock size={11} className='text-metallic-slate/70' aria-hidden='true' />
              <span className='font-bold text-white'>{localTime.time}</span>
              <span>({localTime.day})</span>
              <span className='text-[7px] text-metallic-slate/50'>
                {localTime.cyrillicDay} · {localTime.timeZoneAbbr}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* ARENA DE EQUIPOS & MARCADOR */}
      <div className='p-3 sm:p-4'>
        <div className='grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4'>
          {/* Equipo Local con Escudo */}
          <div className='flex min-w-0 items-center gap-2.5'>
            <TeamCrest team={match.homeTeam} />
            <div className='min-w-0'>
              <h3
                id={headingId}
                className='truncate font-display text-[13px] font-bold uppercase tracking-tight text-white sm:text-sm'
              >
                {match.homeTeam.name}
              </h3>
              {match.homeTeam.cyrillicName && (
                <span className='block truncate font-mono text-[7px] tracking-wider text-metallic-slate/40'>
                  {match.homeTeam.cyrillicName}
                </span>
              )}
            </div>
          </div>

          {/* Marcador Central / VS */}
          <div className='flex flex-col items-center justify-center px-2'>
            {isLive || match.status === 'finished' ? (
              <div className='flex flex-col items-center'>
                <div className='flex items-baseline gap-1 font-display text-lg font-black tabular-nums tracking-wider text-white sm:text-2xl'>
                  <span className={isLive ? 'text-lime-400' : 'text-white'}>
                    {match.scores.home}
                  </span>
                  <span className='text-white/30'>:</span>
                  <span className={isLive ? 'text-lime-400' : 'text-white'}>
                    {match.scores.away}
                  </span>
                </div>
                <span className='font-mono text-[7px] uppercase tracking-widest text-metallic-slate/60'>
                  {clockDisplay.periodText}
                </span>
              </div>
            ) : (
              <div className='flex flex-col items-center'>
                <span className='border border-white/10 bg-white/[0.02] px-2 py-0.5 font-mono text-[9px] font-bold text-metallic-slate'>
                  VS
                </span>
                <span className='mt-0.5 font-mono text-[7px] uppercase tracking-wider text-metallic-slate/40'>
                  ЛИНИЯ
                </span>
              </div>
            )}
          </div>

          {/* Equipo Visitante con Escudo */}
          <div className='flex min-w-0 items-center justify-end gap-2.5 text-right'>
            <div className='min-w-0'>
              <h3 className='truncate font-display text-[13px] font-bold uppercase tracking-tight text-white sm:text-sm'>
                {match.awayTeam.name}
              </h3>
              {match.awayTeam.cyrillicName && (
                <span className='block truncate font-mono text-[7px] tracking-wider text-metallic-slate/40'>
                  {match.awayTeam.cyrillicName}
                </span>
              )}
            </div>
            <TeamCrest team={match.awayTeam} />
          </div>
        </div>
      </div>

      {/* LÍNEA PRINCIPAL 1X2 (Local, Empate, Visitante) */}
      {m1x2 && homeSel && drawSel && awaySel && (
        <div className='border-t border-white/[0.06] bg-[#080808] p-2.5'>
          <div className='mb-1.5 flex items-center justify-between font-mono text-[8px] uppercase tracking-wider text-metallic-slate'>
            <div className='flex items-center gap-1.5'>
              <span className='h-1.5 w-1.5 bg-lime-400' aria-hidden='true' />
              <span className='font-bold text-white'>01 Resultado del Partido</span>
              <span className='text-[7px] opacity-35'>ИСХОД 1X2 · 3 VÍAS</span>
            </div>
            <span className='text-[7px] text-metallic-slate/50'>TIEMPO REGLAMENTARIO</span>
          </div>

          <div className='grid grid-cols-3 gap-1.5 sm:gap-2'>
            {/* Opción 1: Local */}
            <button
              type='button'
              onClick={() => handleToggle(m1x2, homeSel)}
              disabled={isClosed}
              aria-pressed={isHomeSelected}
              className={`flex items-center justify-between border p-2 text-left transition-all duration-150 ${
                isHomeFlashing ? 'zb-odds-lime-flash ring-1 ring-lime-400' : ''
              } ${
                isClosed
                  ? 'cursor-not-allowed border-white/[0.04] bg-[#050505] opacity-50'
                  : isHomeSelected
                    ? 'border-lime-400 bg-lime-400/[0.09] shadow-[0_0_16px_-6px_rgba(212,255,63,0.7)]'
                    : 'border-white/[0.08] bg-[#0D0D0D] hover:border-lime-400/40 hover:bg-[#141414]'
              }`}
            >
              <div className='min-w-0'>
                <div className='flex items-center gap-1'>
                  <span className='font-mono text-[8px] font-bold text-lime-400'>1</span>
                  <span className='truncate font-display text-[10px] font-bold uppercase text-white sm:text-[11px]'>
                    {match.homeTeam.code || match.homeTeam.shortName}
                  </span>
                </div>
                <span className='font-mono text-[7px] text-metallic-slate/50'>П1</span>
              </div>

              <div className='flex shrink-0 items-baseline gap-1'>
                {isHomeSelected && (
                  <Check size={11} strokeWidth={3} className='text-lime-400' aria-hidden='true' />
                )}
                <span className='font-mono text-[7px] font-bold text-metallic-slate/35'>КОЭФ</span>
                <span
                  className={`font-odds text-xs font-bold tabular-nums sm:text-sm ${
                    isHomeFlashing ? 'text-lime-300 font-black' : isHomeSelected ? 'text-lime-400' : 'text-white'
                  }`}
                >
                  {homeOdds !== null ? formatDecimalOdds(homeOdds) : '—'}
                </span>
              </div>
            </button>

            {/* Opción X: Empate */}
            <button
              type='button'
              onClick={() => handleToggle(m1x2, drawSel)}
              disabled={isClosed}
              aria-pressed={isDrawSelected}
              className={`flex items-center justify-between border p-2 text-left transition-all duration-150 ${
                isDrawFlashing ? 'zb-odds-lime-flash ring-1 ring-lime-400' : ''
              } ${
                isClosed
                  ? 'cursor-not-allowed border-white/[0.04] bg-[#050505] opacity-50'
                  : isDrawSelected
                    ? 'border-lime-400 bg-lime-400/[0.09] shadow-[0_0_16px_-6px_rgba(212,255,63,0.7)]'
                    : 'border-white/[0.08] bg-[#0D0D0D] hover:border-lime-400/40 hover:bg-[#141414]'
              }`}
            >
              <div className='min-w-0'>
                <div className='flex items-center gap-1'>
                  <span className='font-mono text-[8px] font-bold text-lime-400'>X</span>
                  <span className='truncate font-display text-[10px] font-bold uppercase text-white sm:text-[11px]'>
                    Empate
                  </span>
                </div>
                <span className='font-mono text-[7px] text-metallic-slate/50'>НИЧЬЯ</span>
              </div>

              <div className='flex shrink-0 items-baseline gap-1'>
                {isDrawSelected && (
                  <Check size={11} strokeWidth={3} className='text-lime-400' aria-hidden='true' />
                )}
                <span className='font-mono text-[7px] font-bold text-metallic-slate/35'>КОЭФ</span>
                <span
                  className={`font-odds text-xs font-bold tabular-nums sm:text-sm ${
                    isDrawFlashing ? 'text-lime-300 font-black' : isDrawSelected ? 'text-lime-400' : 'text-white'
                  }`}
                >
                  {drawOdds !== null ? formatDecimalOdds(drawOdds) : '—'}
                </span>
              </div>
            </button>

            {/* Opción 2: Visitante */}
            <button
              type='button'
              onClick={() => handleToggle(m1x2, awaySel)}
              disabled={isClosed}
              aria-pressed={isAwaySelected}
              className={`flex items-center justify-between border p-2 text-left transition-all duration-150 ${
                isAwayFlashing ? 'zb-odds-lime-flash ring-1 ring-lime-400' : ''
              } ${
                isClosed
                  ? 'cursor-not-allowed border-white/[0.04] bg-[#050505] opacity-50'
                  : isAwaySelected
                    ? 'border-lime-400 bg-lime-400/[0.09] shadow-[0_0_16px_-6px_rgba(212,255,63,0.7)]'
                    : 'border-white/[0.08] bg-[#0D0D0D] hover:border-lime-400/40 hover:bg-[#141414]'
              }`}
            >
              <div className='min-w-0'>
                <div className='flex items-center gap-1'>
                  <span className='font-mono text-[8px] font-bold text-lime-400'>2</span>
                  <span className='truncate font-display text-[10px] font-bold uppercase text-white sm:text-[11px]'>
                    {match.awayTeam.code || match.awayTeam.shortName}
                  </span>
                </div>
                <span className='font-mono text-[7px] text-metallic-slate/50'>П2</span>
              </div>

              <div className='flex shrink-0 items-baseline gap-1'>
                {isAwaySelected && (
                  <Check size={11} strokeWidth={3} className='text-lime-400' aria-hidden='true' />
                )}
                <span className='font-mono text-[7px] font-bold text-metallic-slate/35'>КОЭФ</span>
                <span
                  className={`font-odds text-xs font-bold tabular-nums sm:text-sm ${
                    isAwayFlashing ? 'text-lime-300 font-black' : isAwaySelected ? 'text-lime-400' : 'text-white'
                  }`}
                >
                  {awayOdds !== null ? formatDecimalOdds(awayOdds) : '—'}
                </span>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* BOTÓN DESPLEGABLE NEO-BRUTALISTA */}
      <button
        type='button'
        onClick={() => setIsExpanded((prev) => !prev)}
        aria-expanded={isExpanded}
        className='group/acc flex w-full items-center justify-between border-t border-b border-white/[0.08] bg-[#0B0B0B] px-3 py-2 font-mono text-[9px] uppercase tracking-wider transition-colors hover:border-lime-400/40 hover:bg-lime-400/[0.04]'
      >
        <div className='flex items-center gap-2'>
          <span className='font-bold text-lime-400 group-hover/acc:text-lime-300'>
            {isExpanded
              ? '[ − COLAPSAR MERCADOS ]'
              : `[ + MERCADOS (${extraMarketsCount > 0 ? `+${extraMarketsCount}` : `${match.markets.length}`}) ]`}
          </span>
          <span className='text-[7px] text-metallic-slate/40'>
            {isExpanded ? 'СВЕРНУТЬ' : 'РАСШИРЕННАЯ ЛИНИЯ'}
          </span>
        </div>

        <div className='flex items-center gap-1.5 text-[8px] text-metallic-slate'>
          <span>{isExpanded ? 'Ocultar familias' : 'Ver goles, BTTS y doble oportunidad'}</span>
          {isExpanded ? (
            <ChevronUp size={12} className='text-lime-400' aria-hidden='true' />
          ) : (
            <ChevronDown size={12} className='text-lime-400' aria-hidden='true' />
          )}
        </div>
      </button>

      {/* SECCIÓN EXPANDIDA: FootballMarketMatrix */}
      {isExpanded && (
        <div className='animate-in fade-in duration-150'>
          <FootballMarketMatrix
            match={match}
            selectedIds={selectedIds}
            oddsMap={oddsMap}
            flashingSelectionIds={flashingSelectionIds}
            onToggle={handleToggle}
            defaultTab='all'
          />
        </div>
      )}

      {/* PIE DE TARJETA BRUTALISTA */}
      <footer className='flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.04] bg-[#060606] px-3 py-2 sm:px-4'>
        <div className='flex min-w-0 flex-1 items-center gap-2'>
          <span className='inline-flex items-center gap-1 font-mono text-[8px] uppercase tracking-wide text-metallic-slate'>
            <Radio size={9} className={isLive ? 'text-lime-400' : 'text-metallic-slate/60'} />
            {isClosed
              ? 'Mercados cerrados'
              : isLive
                ? 'En directo · ПРЯМОЙ ЭФИР'
                : 'Línea oficial ZenBet · ЛИНИЯ'}
          </span>
        </div>

        <div className='flex shrink-0 items-center gap-2 font-mono text-[8px] uppercase tracking-wide text-metallic-slate/70'>
          {match.stadium && (
            <span className='inline-flex items-center gap-1'>
              <MapPin size={9} aria-hidden='true' />
              {match.stadium}
            </span>
          )}
          {match.city && <span>· {match.city}</span>}
        </div>
      </footer>
    </article>
  );
}

export default memo(FootballMatchCard);
