import { memo, useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  Check,
  Clock,
  Database,
  Flame,
  Radio,
  RefreshCw,
  Search,
  Trophy,
  X,
} from 'lucide-react';

import type { SelectionInput } from '@/domain/bets';
import type { OddsQuote } from '@/domain/odds';
import type { FootballMatch } from '@/domain/football';
import { useFootballEvents } from '@/hooks/useFootballEvents';
import FootballMatchCard from './FootballMatchCard';

export interface FootballEventsSectionProps {
  readonly selectedIds: readonly string[];
  readonly onAddSelection: (selection: SelectionInput) => void;
  readonly onRemoveSelection: (selectionId: string) => void;
  readonly oddsMap?: Readonly<Record<string, OddsQuote>>;
  readonly activeLeagueId?: string | null;
  readonly onSelectLeague?: (id: string) => void;
}

type FootballFilterStatus = 'all' | 'live' | 'upcoming' | 'finished';

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function matchMatchesSearch(match: FootballMatch, term: string): boolean {
  if (!term) return true;
  const parts = term.split(/\s+/);
  const haystack = [
    match.homeTeam.name,
    match.homeTeam.shortName,
    match.homeTeam.code,
    match.awayTeam.name,
    match.awayTeam.shortName,
    match.awayTeam.code,
    match.league.name,
    match.league.shortName,
    match.league.country,
    match.city ?? '',
    match.stadium ?? '',
  ]
    .map(normalize)
    .join(' | ');

  return parts.every((p) => haystack.includes(p));
}

export default function FootballEventsSection({
  selectedIds,
  onAddSelection,
  onRemoveSelection,
  oddsMap,
  activeLeagueId,
  onSelectLeague,
}: FootballEventsSectionProps) {
  const {
    matches,
    liveMatches,
    upcomingMatches,
    finishedMatches,
    leagues,
    flashingSelectionIds,
    isLoading,
    isRevalidating,
    error,
    reload,
  } = useFootballEvents();

  const [selectedLeagueId, setSelectedLeagueId] = useState<string>(activeLeagueId || 'all');

  useEffect(() => {
    if (activeLeagueId !== undefined) {
      setSelectedLeagueId(activeLeagueId || 'all');
    }
  }, [activeLeagueId]);
  const [statusFilter, setStatusFilter] = useState<FootballFilterStatus>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const deferredSearchTerm = useDeferredValue(searchTerm);

  const normalizedSearch = useMemo(() => normalize(deferredSearchTerm), [deferredSearchTerm]);

  // Filtrado compuesto
  const filteredMatches = useMemo(() => {
    let pool: readonly FootballMatch[] = matches;

    if (statusFilter === 'live') {
      pool = liveMatches;
    } else if (statusFilter === 'upcoming') {
      pool = upcomingMatches;
    } else if (statusFilter === 'finished') {
      pool = finishedMatches;
    }

    if (selectedLeagueId !== 'all') {
      pool = pool.filter((m) => m.league.id === selectedLeagueId);
    }

    if (normalizedSearch) {
      pool = pool.filter((m) => matchMatchesSearch(m, normalizedSearch));
    }

    return pool;
  }, [
    matches,
    liveMatches,
    upcomingMatches,
    finishedMatches,
    statusFilter,
    selectedLeagueId,
    normalizedSearch,
  ]);

  const handleResetFilters = useCallback(() => {
    setSelectedLeagueId('all');
    setStatusFilter('all');
    setSearchTerm('');
  }, []);

  return (
    <section aria-label='Módulo de Fútbol Profesional' className='flex flex-col gap-4'>
      {/* CABECERA EDITORIAL DE FÚTBOL CON ESTÉTICA SHIBUYA LIME */}
      <div className='flex flex-col gap-3 rounded-xl border border-white/[0.08] bg-[#0A0A0A] p-3.5 sm:p-4'>
        <div className='flex flex-wrap items-end justify-between gap-3 border-b border-white/[0.06] pb-3'>
          <div>
            <div className='flex items-center gap-2'>
              <span className='font-mono text-[9px] font-bold uppercase tracking-widest text-lime-400'>
                / FOOTBALL & CALCIO
              </span>
              <span className='text-[8px] font-mono text-metallic-slate/40'>
                ЛИНИЯ ФУТБОЛА · ZENBET PRO
              </span>
            </div>
            <h1 className='mt-1 font-display text-lg font-bold uppercase tracking-tight text-white sm:text-xl'>
              Fútbol Profesional
            </h1>
            <p className='mt-0.5 text-[11px] leading-relaxed text-metallic-slate'>
              Líneas principales 1X2, hándicaps, totales de goles y micro-cuotas en vivo para las mejores ligas del mundo.
            </p>
          </div>

          <div className='flex items-center gap-2'>
            {/* Indicador de estado en vivo */}
            <div className='flex items-center gap-1.5 border border-white/[0.08] bg-white/[0.02] px-2.5 py-1 font-mono text-[8px] uppercase tracking-wider text-metallic-slate'>
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  liveMatches.length > 0 ? 'bg-lime-400 motion-safe:animate-pulse' : 'bg-neutral-600'
                }`}
                aria-hidden='true'
              />
              <span className='font-bold text-white'>{liveMatches.length}</span>
              <span>En vivo</span>
              <span className='text-[7px] text-metallic-slate/50'>ПРЯМОЙ ЭФИР</span>
            </div>

            {/* Botón de recarga */}
            <button
              type='button'
              onClick={() => reload()}
              disabled={isRevalidating}
              aria-label='Actualizar partidos y cuotas'
              className='inline-flex items-center gap-1.5 border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider text-metallic-slate transition-colors hover:border-lime-400/40 hover:text-white disabled:opacity-50'
            >
              <RefreshCw
                size={11}
                className={isRevalidating ? 'animate-spin text-lime-400' : ''}
                aria-hidden='true'
              />
              <span className='hidden sm:inline'>Actualizar</span>
            </button>
          </div>
        </div>

        {/* SELECTOR DE LIGAS (Píldoras Horizontales con Scroll) */}
        <div className='flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none'>
          <button
            type='button'
            onClick={() => setSelectedLeagueId('all')}
            className={`shrink-0 border px-3 py-1 font-mono text-[9px] uppercase tracking-wider transition-all duration-150 ${
              selectedLeagueId === 'all'
                ? 'border-lime-400 bg-lime-400/[0.12] font-bold text-lime-400 shadow-[0_0_12px_-4px_rgba(212,255,63,0.4)]'
                : 'border-white/[0.07] bg-white/[0.02] text-metallic-slate hover:border-white/20 hover:text-white'
            }`}
          >
            Todas las Ligas ({matches.length})
          </button>
          {leagues.map((league) => {
            const isSelected = selectedLeagueId === league.id;
            const leagueMatchCount = matches.filter((m) => m.league.id === league.id).length;
            return (
              <button
                key={league.id}
                type='button'
                onClick={() => setSelectedLeagueId(league.id)}
                className={`shrink-0 border px-3 py-1 font-mono text-[9px] uppercase tracking-wider transition-all duration-150 ${
                  isSelected
                    ? 'border-lime-400 bg-lime-400/[0.12] font-bold text-lime-400 shadow-[0_0_12px_-4px_rgba(212,255,63,0.4)]'
                    : 'border-white/[0.07] bg-white/[0.02] text-metallic-slate hover:border-white/20 hover:text-white'
                }`}
              >
                <span>{league.name}</span>
                <span className='ml-1 text-[8px] opacity-60'>({leagueMatchCount})</span>
              </button>
            );
          })}
        </div>

        {/* BARRA DE FILTROS: Pestañas de Estado + Buscador */}
        <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
          {/* Pestañas de estado (Todos, En Vivo, Próximos, Finalizados) */}
          <div className='flex items-center gap-1'>
            <button
              type='button'
              onClick={() => setStatusFilter('all')}
              className={`border px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider transition-colors ${
                statusFilter === 'all'
                  ? 'border-white/30 bg-white/10 font-bold text-white'
                  : 'border-white/[0.06] bg-transparent text-metallic-slate hover:text-white'
              }`}
            >
              Todos ({matches.length})
            </button>
            <button
              type='button'
              onClick={() => setStatusFilter('live')}
              className={`inline-flex items-center gap-1 border px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider transition-colors ${
                statusFilter === 'live'
                  ? 'border-lime-400 bg-lime-400/[0.12] font-bold text-lime-400'
                  : 'border-white/[0.06] bg-transparent text-metallic-slate hover:text-white'
              }`}
            >
              <span className='h-1.5 w-1.5 rounded-full bg-lime-400 motion-safe:animate-pulse' />
              <span>En Vivo ({liveMatches.length})</span>
            </button>
            <button
              type='button'
              onClick={() => setStatusFilter('upcoming')}
              className={`border px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider transition-colors ${
                statusFilter === 'upcoming'
                  ? 'border-white/30 bg-white/10 font-bold text-white'
                  : 'border-white/[0.06] bg-transparent text-metallic-slate hover:text-white'
              }`}
            >
              Próximos ({upcomingMatches.length})
            </button>
            <button
              type='button'
              onClick={() => setStatusFilter('finished')}
              className={`border px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider transition-colors ${
                statusFilter === 'finished'
                  ? 'border-white/30 bg-white/10 font-bold text-white'
                  : 'border-white/[0.06] bg-transparent text-metallic-slate hover:text-white'
              }`}
            >
              Finalizados ({finishedMatches.length})
            </button>
          </div>

          {/* Buscador de equipos / ligas */}
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
              placeholder='Buscar equipo o liga...'
              aria-label='Buscar partidos de fútbol'
              className='w-full border border-white/[0.08] bg-[#080808] py-1.5 pl-8 pr-16 font-mono text-[10px] text-white placeholder-metallic-slate/50 transition-colors focus:border-lime-400 focus:bg-[#0E0E0E] focus:outline-none'
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
      </div>

      {/* ERROR STATE */}
      {error && (
        <div className='flex items-center justify-between border border-crimson/30 bg-crimson/[0.08] p-3 text-xs text-white'>
          <div className='flex items-center gap-2'>
            <AlertTriangle size={14} className='text-crimson' aria-hidden='true' />
            <span>Error al conectar con el servicio de fútbol: {error}</span>
          </div>
          <button
            type='button'
            onClick={() => reload()}
            className='border border-crimson/50 bg-crimson/20 px-2 py-0.5 font-mono text-[9px] uppercase text-white hover:bg-crimson/30'
          >
            Reintentar
          </button>
        </div>
      )}

      {/* LISTA DE PARTIDOS DE FÚTBOL */}
      {filteredMatches.length === 0 ? (
        <div className='flex flex-col items-center justify-center rounded-xl border border-white/[0.06] bg-[#0A0A0A] p-8 text-center'>
          <Database size={24} className='text-metallic-slate/40' aria-hidden='true' />
          <h3 className='mt-2 font-display text-sm font-bold uppercase tracking-wider text-white'>
            No se encontraron partidos
          </h3>
          <p className='mt-1 max-w-sm font-mono text-[10px] text-metallic-slate'>
            No hay partidos que coincidan con los filtros seleccionados o el término de búsqueda.
          </p>
          <button
            type='button'
            onClick={handleResetFilters}
            className='mt-3 inline-flex border border-lime-400/40 bg-lime-400/[0.08] px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-wider text-lime-400 hover:bg-lime-400/[0.15]'
          >
            Restablecer Filtros
          </button>
        </div>
      ) : (
        <div className='flex flex-col gap-3'>
          {filteredMatches.map((match) => (
            <FootballMatchCard
              key={match.id}
              match={match}
              featured={match.status === 'live'}
              selectedIds={selectedIds}
              onAddSelection={onAddSelection}
              onRemoveSelection={onRemoveSelection}
              oddsMap={oddsMap}
              flashingSelectionIds={flashingSelectionIds}
            />
          ))}
        </div>
      )}
    </section>
  );
}

