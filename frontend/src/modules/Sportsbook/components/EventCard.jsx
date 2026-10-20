import { useEffect, useState } from 'react';
import { CalendarClock, Check, Swords, TrendingDown, TrendingUp } from 'lucide-react';
import { Badge } from '../../../components/common/ui';

/**
 * Peleador dentro de un combate.
 *
 * @typedef {Object} Fighter
 * @property {string} id             Identificador único del peleador.
 * @property {string} name           Nombre completo.
 * @property {number} odds           Cuota decimal Moneyline (ej. 1.85).
 * @property {string} [record]       Récord (ej. "24-2-0").
 * @property {string} [country]      País o bandera textual (ej. "Sudáfrica").
 * @property {boolean} [suspended]   Deshabilita la cuota si el mercado está cerrado.
 */

/**
 * Combate / evento de MMA-UFC.
 *
 * @typedef {Object} FightEvent
 * @property {string} id                        Identificador del evento.
 * @property {string} title                     Título de la pelea (ej. "UFC 312: Du Plessis vs. Strickland").
 * @property {'live' | 'scheduled'} [status]    Estado del combate.
 * @property {string} [startTime]               Programación ("22:30" o ISO-8601). Se formatea si es fecha válida.
 * @property {string} [weightClass]             Categoría de peso (ej. "Peso Mediano").
 * @property {string} [rounds]                  Asaltos pactados (ej. "5 asaltos").
 * @property {Fighter[]} fighters               Los dos peleadores del combate.
 */

/** Id de selección determinista: el padre lo usa para marcar la cuota activa. */
export function buildSelectionId(eventId, fighterId) {
  return `${eventId}::${fighterId}`;
}

/** Duración del destello de movimiento de cuota; debe coincidir con `odds-flash-*` (design-system.css). */
const ODDS_FLASH_MS = 800;

/** Formatea ISO-8601 a "18 OCT, 04:00 P.M."; si no es fecha válida, devuelve el string tal cual. */
function formatEventTime(startTime, locale) {
  if (!startTime) return null;
  const date = new Date(startTime);
  if (Number.isNaN(date.getTime())) return String(startTime);
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
    .format(date)
    .replace(',', ' ·')
    .toUpperCase();
}

/**
 * Esquina de un peleador: nombre, récord y botón Moneyline con feed en vivo.
 *
 * @param {Object} props
 * @param {Fighter} props.fighter
 * @param {'left' | 'right'} props.side
 * @param {boolean} props.isSelected
 * @param {(fighter: Fighter) => void} props.onToggle
 * @param {import('@/domain/odds').OddsQuote} [props.quote] Última cotización recibida por SignalR.
 */
function FighterCorner({ fighter, side, isSelected, onToggle, quote }) {
  const sequence = quote?.sequence ?? 0;
  // El destello es estado local y temporal: no toca el layout ni el árbol de la página.
  const [flash, setFlash] = useState(() => ({ sequence, trend: null }));

  // Ajuste en render (no en efecto): cada tick del feed reinicia el destello.
  if (flash.sequence !== sequence) {
    setFlash({ sequence, trend: quote && quote.trend !== 'unchanged' ? quote.trend : null });
  }

  // Apagado diferido a 800ms; si llega otro tick, el cleanup cancela el timer previo.
  useEffect(() => {
    if (!flash.trend) return undefined;

    const timeoutId = window.setTimeout(() => {
      setFlash((previous) =>
        previous.sequence === flash.sequence ? { ...previous, trend: null } : previous,
      );
    }, ODDS_FLASH_MS);

    return () => window.clearTimeout(timeoutId);
  }, [flash]);

  const odds = Number(quote?.odds ?? fighter.odds);
  const oddsValid = Number.isFinite(odds) && odds > 1;
  const isDisabled = Boolean(fighter.suspended) || !oddsValid;
  const meta = [fighter.record, fighter.country].filter(Boolean).join(' · ');
  const alignment = side === 'right' ? 'items-end text-right' : 'items-start text-left';
  const trend = quote?.trend ?? 'unchanged';

  const stateStyles = isSelected
    ? 'border-crimson bg-crimson text-white shadow-glow-crimson'
    : isDisabled
      ? 'border-obsidian-border bg-obsidian-elevated text-metallic-chrome opacity-40'
      : 'border-obsidian-border bg-obsidian-elevated text-metallic-chrome hover:border-crimson/70 hover:bg-crimson/10 hover:text-crimson active:translate-y-[1px]';

  const flashClass =
    flash.trend === 'up' ? ' odds-flash-up' : flash.trend === 'down' ? ' odds-flash-down' : '';

  const trendLabel = trend === 'up' ? ', en alza' : trend === 'down' ? ', a la baja' : '';

  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${alignment}`}>
      <p className='w-full truncate font-sans text-sm font-semibold text-metallic-chrome'>
        {fighter.name}
      </p>
      <p className='w-full truncate font-mono text-[10px] uppercase tracking-wide text-metallic-slate'>
        {meta || '—'}
      </p>
      <button
        type='button'
        onClick={() => onToggle(fighter, odds)}
        disabled={isDisabled}
        aria-pressed={isSelected}
        aria-label={`Moneyline ${fighter.name}: cuota ${oddsValid ? odds.toFixed(2) : 'no disponible'}${trendLabel}`}
        className={`mt-1 flex w-full items-center justify-center gap-1.5 border px-3 py-2 font-mono text-sm font-bold tabular-nums transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crimson/60 ${
          isDisabled ? 'cursor-not-allowed' : ''
        } ${stateStyles}${flashClass}`}
      >
        {isSelected && <Check size={14} strokeWidth={3} aria-hidden='true' />}
        {oddsValid && trend !== 'unchanged' && (
          trend === 'up' ? (
            <TrendingUp
              size={13}
              className={isSelected ? 'text-white' : 'text-odds-up'}
              aria-hidden='true'
            />
          ) : (
            <TrendingDown
              size={13}
              className={isSelected ? 'text-white' : 'text-odds-down'}
              aria-hidden='true'
            />
          )
        )}
        {oddsValid ? odds.toFixed(2) : '—'}
      </button>
    </div>
  );
}

/**
 * EventCard — Tarjeta de combate MMA/UFC con cuotas Moneyline.
 *
 * Modo controlado: pasa `selectedIds` (ids generados con `buildSelectionId` o con el
 * `id` que entrega el payload de `onAddSelection`) para marcar las cuotas activas.
 * Modo no controlado: omite `selectedIds` y la tarjeta gestiona su propio estado visual.
 *
 * @param {Object} props
 * @param {FightEvent} props.event                     Datos del combate.
 * @param {(string[] | Set<string>)} [props.selectedIds] Ids de selecciones activas en el BetSlip.
 * @param {(selection: Object) => void} [props.onAddSelection]    Agrega la selección al BetSlip.
 * @param {(selectionId: string) => void} [props.onRemoveSelection] Elimina la selección del BetSlip (toggle).
 * @param {Record<string, import('@/domain/odds').OddsQuote>} [props.oddsMap] Cotizaciones en vivo por selectionId.
 * @param {string} [props.locale]                      Locale para el formateo de hora.
 * @param {string} [props.className]                   Clases extra para el contenedor.
 */
export default function EventCard({
  event,
  selectedIds,
  onAddSelection,
  onRemoveSelection,
  oddsMap,
  locale = 'es-MX',
  className = '',
}) {
  const [uncontrolledIds, setUncontrolledIds] = useState(() => new Set());

  if (!event) return null;

  const {
    id,
    title,
    status = 'scheduled',
    startTime,
    weightClass,
    rounds,
    fighters = [],
  } = event;

  const isLive = status === 'live';
  const formattedTime = formatEventTime(startTime, locale);
  const [fighterA, fighterB] = fighters ?? [];
  const isControlled = Array.isArray(selectedIds) || selectedIds instanceof Set;
  const activeIds = isControlled ? new Set(selectedIds) : uncontrolledIds;

  const handleToggle = (fighter, liveOdds) => {
    // La selección viaja con la cuota vigente del feed, no con el valor del render inicial.
    const odds = Number(liveOdds ?? fighter.odds);
    if (!Number.isFinite(odds) || odds <= 1) return;

    const selectionId = buildSelectionId(id, fighter.id);
    const isSelected = activeIds.has(selectionId);

    if (isSelected) {
      onRemoveSelection?.(selectionId);
    } else {
      onAddSelection?.({
        id: selectionId,
        selectionId,
        eventId: id,
        // En la cartelera mock el combate ES el mercado Moneyline.
        marketId: id,
        eventName: title,
        market: 'Moneyline',
        selection: fighter.name,
        fighterId: fighter.id,
        odds,
      });
    }

    if (!isControlled) {
      setUncontrolledIds((prev) => {
        const next = new Set(prev);
        if (next.has(selectionId)) next.delete(selectionId);
        else next.add(selectionId);
        return next;
      });
    }
  };

  return (
    <article
      className={`bg-technical-grid relative flex flex-col border border-obsidian-border bg-obsidian-card transition-colors duration-200 hover:border-crimson/40 ${className}`}
    >
      {/* Franja superior de estado */}
      <div className={`h-[3px] w-full ${isLive ? 'bg-crimson' : 'bg-obsidian-border'}`} aria-hidden='true' />

      {/* Cabecera: título + estado */}
      <header className='flex items-start justify-between gap-4 px-4 pb-4 pt-4'>
        <div className='min-w-0'>
          <h3 className='font-display text-base font-extrabold uppercase leading-snug tracking-tight text-white'>
            {title}
          </h3>
          <p className='mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] uppercase tracking-brutal text-metallic-titanium'>
            {weightClass && (
              <span className='inline-flex items-center gap-1'>
                <Swords size={11} className='text-crimson' aria-hidden='true' />
                {weightClass}
              </span>
            )}
            {rounds && <span>{rounds}</span>}
            {!isLive && formattedTime && (
              <span className='inline-flex items-center gap-1'>
                <CalendarClock size={11} aria-hidden='true' />
                {formattedTime}
              </span>
            )}
          </p>
        </div>

        {isLive ? (
          <Badge
            variant='live'
            className='inline-flex shrink-0 items-center gap-2 border border-crimson/60 bg-crimson/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-brutal text-crimson'
          >
            <span className='relative flex h-1.5 w-1.5' aria-hidden='true'>
              <span className='absolute inline-flex h-full w-full animate-ping rounded-full bg-crimson opacity-80' />
              <span className='relative inline-flex h-1.5 w-1.5 rounded-full bg-crimson' />
            </span>
            En vivo
          </Badge>
        ) : (
          <Badge
            variant='scheduled'
            className='inline-flex shrink-0 items-center gap-1.5 border border-obsidian-border bg-obsidian-elevated px-2.5 py-1 text-[10px] font-bold uppercase tracking-brutal text-metallic-titanium'
          >
            <CalendarClock size={11} aria-hidden='true' />
            Programado
          </Badge>
        )}
      </header>

      {/* Encabezado de mercado */}
      <div className='flex items-center justify-between px-4 pb-2'>
        <span className='text-[9px] font-bold uppercase tracking-ultra text-metallic-slate'>
          Ganador · Moneyline
        </span>
        <span className='text-[9px] font-bold uppercase tracking-ultra text-metallic-slate'>Cuota</span>
      </div>

      {/* Cuotas Moneyline */}
      <div className='grid grid-cols-[1fr_auto_1fr] items-start gap-3 border-t border-obsidian-border px-4 py-4'>
        {fighterA && (
          <FighterCorner
            fighter={fighterA}
            side='left'
            isSelected={activeIds.has(buildSelectionId(id, fighterA.id))}
            onToggle={handleToggle}
            quote={oddsMap?.[buildSelectionId(id, fighterA.id)]}
          />
        )}

        {fighterA && fighterB && (
          <div className='flex h-full items-center'>
            <span className='font-display text-[10px] font-black uppercase tracking-brutal text-metallic-slate'>
              VS
            </span>
          </div>
        )}

        {fighterB && (
          <FighterCorner
            fighter={fighterB}
            side='right'
            isSelected={activeIds.has(buildSelectionId(id, fighterB.id))}
            onToggle={handleToggle}
            quote={oddsMap?.[buildSelectionId(id, fighterB.id)]}
          />
        )}
      </div>
    </article>
  );
}
