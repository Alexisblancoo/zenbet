import { useId, useMemo, useState } from 'react';
import { AlertCircle, Coins, Loader2, Ticket, X, Zap } from 'lucide-react';

/**
 * Selección individual del boleto.
 *
 * @typedef {Object} BetSelection
 * @property {string|number} id   Identificador único de la selección.
 * @property {string} eventName   Nombre de la pelea / evento (ej. "UFC 312: Du Plessis vs. Strickland").
 * @property {string} selection   Pick del usuario (ej. "Dricus du Plessis").
 * @property {number} odds        Cuota decimal (ej. 1.85).
 * @property {string} [market]    Mercado de la cuota (ej. "Moneyline").
 */

const DEFAULT_MIN_STAKE = 1;
const DEFAULT_MAX_STAKE = 10000;
const QUICK_STAKES = [50, 100, 250, 500];

/** Convierte un valor (número o string, con coma o punto) en número positivo; null si es inválido. */
function toPositiveNumber(value) {
  const parsed = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/** Formatea un monto como divisa (con fallback si la divisa/locale es inválida). */
function formatMoney(value, locale, currency, { compact = false } = {}) {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: compact ? 0 : 2,
      maximumFractionDigits: compact ? 0 : 2,
    }).format(value);
  } catch {
    return `${Number(value).toFixed(compact ? 0 : 2)} ${currency}`;
  }
}

/** Símbolo de la divisa configurada (fallback al código ISO). */
function resolveCurrencySymbol(locale, currency) {
  try {
    const parts = new Intl.NumberFormat(locale, { style: 'currency', currency }).formatToParts(0);
    return parts.find((part) => part.type === 'currency')?.value ?? currency;
  } catch {
    return currency;
  }
}

/**
 * BetSlip — Boleto de apuestas (panel lateral o flotante).
 *
 * Controlado al 100% por el padre: recibe las selecciones y notifica altas/bajas.
 * El stake y el estado de envío son estado interno del componente.
 *
 * @param {Object} props
 * @param {BetSelection[]} [props.selections]      Selecciones activas del boleto.
 * @param {(selectionId: string|number) => void} [props.onRemoveSelection] Elimina una selección por id.
 * @param {(payload: { selections: BetSelection[], stake: number, totalOdds: number, potentialPayout: number }) => void | Promise<void>} [props.onPlaceBet] Ejecuta el envío de la apuesta.
 * @param {() => void} [props.onClose]             Muestra el botón de cierre cuando se define (modo flotante).
 * @param {number} [props.minStake]                Apuesta mínima permitida.
 * @param {number} [props.maxStake]                Apuesta máxima permitida.
 * @param {string} [props.currency]                Divisa ISO 4217 (ej. "USD").
 * @param {string} [props.locale]                  Locale para formateo (ej. "es-MX").
 * @param {boolean} [props.isSubmitting]           Fuerza el estado de envío desde el padre (útil con mutaciones externas).
 * @param {string} [props.className]               Clases extra para posicionar (ej. "fixed inset-y-0 right-0 z-50 max-w-sm h-full").
 */
export default function BetSlip({
  selections = [],
  onRemoveSelection,
  onPlaceBet,
  onClose,
  minStake = DEFAULT_MIN_STAKE,
  maxStake = DEFAULT_MAX_STAKE,
  currency = 'USD',
  locale = 'es-MX',
  isSubmitting: isSubmittingProp = false,
  className = '',
}) {
  const stakeInputId = useId();
  const [stakeInput, setStakeInput] = useState('');
  const [isSubmittingLocal, setIsSubmittingLocal] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const isSubmitting = isSubmittingProp || isSubmittingLocal;

  /* ------------------------------------------------------------------ */
  /* Derivados en tiempo real                                            */
  /* ------------------------------------------------------------------ */

  const totalOdds = useMemo(
    () =>
      selections.reduce((product, item) => {
        const odds = toPositiveNumber(item?.odds);
        return odds ? product * odds : product;
      }, 1),
    [selections],
  );

  const stake = useMemo(() => {
    const normalized = stakeInput.trim().replace(',', '.');
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }, [stakeInput]);

  const stakeError = useMemo(() => {
    if (stakeInput.trim() === '') return null;
    if (stake === null) return 'Ingresa un monto válido.';
    if (stake <= 0) return 'El monto debe ser mayor a 0.';
    if (stake < minStake) return `La apuesta mínima es ${formatMoney(minStake, locale, currency)}.`;
    if (stake > maxStake) return `La apuesta máxima es ${formatMoney(maxStake, locale, currency)}.`;
    return null;
  }, [stakeInput, stake, minStake, maxStake, locale, currency]);

  const quickStakes = useMemo(
    () => QUICK_STAKES.filter((value) => value >= minStake && value <= maxStake),
    [minStake, maxStake],
  );

  const hasSelections = selections.length > 0;
  const stakeIsValid = stake !== null && stakeError === null && stake > 0;
  const potentialPayout = stakeIsValid ? stake * totalOdds : 0;
  const canShowPayout = hasSelections && stakeIsValid;
  const canSubmit = hasSelections && stakeIsValid && !isSubmitting;
  const currencySymbol = useMemo(() => resolveCurrencySymbol(locale, currency), [locale, currency]);

  /* ------------------------------------------------------------------ */
  /* Handlers                                                            */
  /* ------------------------------------------------------------------ */

  /** Sanitiza la entrada: solo dígitos y un separador decimal (coma o punto). */
  const handleStakeChange = (event) => {
    const raw = event.target.value;
    if (/^\d*[.,]?\d*$/.test(raw)) {
      setStakeInput(raw);
      if (submitError) setSubmitError(null);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      setSubmitError(null);
      setIsSubmittingLocal(true);
      await onPlaceBet?.({
        selections,
        stake,
        totalOdds,
        potentialPayout,
      });
    } catch (error) {
      setSubmitError(error?.message || 'No se pudo procesar la apuesta. Inténtalo de nuevo.');
    } finally {
      setIsSubmittingLocal(false);
    }
  };

  const buttonStyles = isSubmitting
    ? 'cursor-wait bg-crimson-600 text-white'
    : canSubmit
      ? 'bg-crimson text-white shadow-glow-crimson hover:bg-crimson-600 active:translate-y-[1px]'
      : 'cursor-not-allowed border border-obsidian-border bg-obsidian-elevated text-metallic-slate';

  /* ------------------------------------------------------------------ */
  /* Render                                                              */
  /* ------------------------------------------------------------------ */

  return (
    <aside
      aria-label='Boleto de apuestas'
      className={`border-brutal-cold relative flex w-full flex-col ${className}`}
    >
      {/* Cabecera */}
      <header className='flex items-center justify-between gap-3 border-b border-obsidian-border px-4 py-3'>
        <div className='flex min-w-0 items-center gap-2'>
          <Ticket size={16} className='shrink-0 text-crimson' aria-hidden='true' />
          <h2 className='font-display text-sm font-extrabold uppercase tracking-brutal text-white'>
            Boleto
          </h2>
          {hasSelections && (
            <span className='border border-crimson/50 bg-crimson/10 px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums text-crimson'>
              {selections.length}
            </span>
          )}
        </div>
        <div className='flex items-center gap-2'>
          <span className='font-mono text-[10px] uppercase tracking-brutal text-metallic-slate'>
            {hasSelections ? (selections.length > 1 ? `Combinada ×${selections.length}` : 'Simple') : 'Vacío'}
          </span>
          {onClose && (
            <button
              type='button'
              onClick={onClose}
              aria-label='Cerrar boleto'
              className='border border-obsidian-border p-1 text-metallic-titanium transition-colors hover:border-crimson hover:text-crimson focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-crimson'
            >
              <X size={13} aria-hidden='true' />
            </button>
          )}
        </div>
      </header>

      {/* Selecciones / estado vacío */}
      {hasSelections ? (
        <ul className='min-h-0 flex-1 divide-y divide-obsidian-border overflow-y-auto'>
          {selections.map((item) => {
            const odds = toPositiveNumber(item?.odds);
            return (
              <li key={item.id} className='flex items-start justify-between gap-3 px-4 py-3'>
                <div className='min-w-0'>
                  <p className='truncate text-[10px] font-medium uppercase tracking-brutal text-metallic-slate'>
                    {item.eventName}
                  </p>
                  <p className='mt-1 truncate font-sans text-sm font-semibold text-white'>
                    {item.selection}
                  </p>
                  {item.market && (
                    <p className='mt-0.5 text-[10px] uppercase tracking-wide text-metallic-titanium'>
                      {item.market}
                    </p>
                  )}
                </div>
                <div className='flex shrink-0 items-center gap-2'>
                  <span className='font-mono text-sm font-bold tabular-nums text-crimson'>
                    {odds ? odds.toFixed(2) : '—'}
                  </span>
                  <button
                    type='button'
                    onClick={() => onRemoveSelection?.(item.id)}
                    aria-label={`Eliminar selección ${item.selection}`}
                    className='border border-transparent p-1 text-metallic-slate transition-colors hover:border-crimson/50 hover:text-crimson focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-crimson'
                  >
                    <X size={14} aria-hidden='true' />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className='flex flex-1 flex-col items-center justify-center gap-2 px-6 py-10 text-center'>
          <Ticket size={28} className='text-metallic-gunmetal' aria-hidden='true' />
          <p className='font-display text-xs font-bold uppercase tracking-brutal text-metallic-slate'>
            Boleto vacío
          </p>
          <p className='text-xs leading-relaxed text-metallic-slate'>
            Selecciona las cuotas de los combates para construir tu apuesta.
          </p>
        </div>
      )}

      {/* Resumen y envío */}
      <footer className='border-t border-obsidian-border'>
        <div className='flex items-center justify-between px-4 py-3'>
          <span className='text-[10px] font-bold uppercase tracking-brutal text-metallic-slate'>
            Cuota total
          </span>
          <span className='font-mono text-lg font-bold tabular-nums text-white'>
            {hasSelections ? `×${totalOdds.toFixed(2)}` : '—'}
          </span>
        </div>

        <div className='flex items-center justify-between border-t border-obsidian-border bg-obsidian-void/60 px-4 py-3'>
          <span className='inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-brutal text-gold'>
            <Coins size={12} aria-hidden='true' />
            Ganancia potencial
          </span>
          <span className='font-mono text-xl font-extrabold tabular-nums text-gold'>
            {canShowPayout ? formatMoney(potentialPayout, locale, currency) : '—'}
          </span>
        </div>

        <div className='border-t border-obsidian-border px-4 pb-4 pt-3'>
          {/* Stake */}
          <div className='flex items-center justify-between gap-2'>
            <label
              htmlFor={stakeInputId}
              className='text-[10px] font-bold uppercase tracking-brutal text-metallic-titanium'
            >
              Monto a apostar
            </label>
            <span className='font-mono text-[10px] tabular-nums text-metallic-slate'>
              Mín {formatMoney(minStake, locale, currency, { compact: true })} · Máx{' '}
              {formatMoney(maxStake, locale, currency, { compact: true })}
            </span>
          </div>

          <div className='relative mt-2'>
            <span
              aria-hidden='true'
              className='pointer-events-none absolute inset-y-0 left-0 flex items-center border-r border-obsidian-border px-3 font-mono text-xs font-bold text-crimson'
            >
              {currencySymbol}
            </span>
            <input
              id={stakeInputId}
              type='text'
              inputMode='decimal'
              autoComplete='off'
              maxLength={12}
              placeholder='0.00'
              value={stakeInput}
              onChange={handleStakeChange}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleSubmit();
              }}
              aria-invalid={Boolean(stakeError)}
              aria-describedby={`${stakeInputId}-help`}
              className={`w-full border bg-obsidian-void py-2.5 pl-14 pr-3 font-mono text-base font-bold tabular-nums text-white placeholder:text-metallic-gunmetal focus:outline-none focus:ring-1 ${
                stakeError
                  ? 'border-crimson focus:ring-crimson'
                  : 'border-obsidian-border focus:border-crimson focus:ring-crimson/60'
              }`}
            />
          </div>

          {quickStakes.length > 0 && (
            <div className='mt-2 flex flex-wrap gap-1.5'>
              {quickStakes.map((value) => {
                const isActive = stake === value;
                return (
                  <button
                    key={value}
                    type='button'
                    onClick={() => setStakeInput(String(value))}
                    className={`border px-2 py-1 font-mono text-[10px] font-bold tabular-nums transition-colors ${
                      isActive
                        ? 'border-crimson bg-crimson/10 text-crimson'
                        : 'border-obsidian-border text-metallic-titanium hover:border-crimson/50 hover:text-crimson'
                    }`}
                  >
                    {formatMoney(value, locale, currency, { compact: true })}
                  </button>
                );
              })}
            </div>
          )}

          {stakeError && (
            <p role='alert' className='mt-2 flex items-start gap-1.5 text-[11px] font-medium text-crimson'>
              <AlertCircle size={12} className='mt-0.5 shrink-0' aria-hidden='true' />
              {stakeError}
            </p>
          )}

          <p id={`${stakeInputId}-help`} className='mt-2 text-[11px] text-metallic-slate'>
            {hasSelections
              ? 'La cuota total y la ganancia se actualizan en tiempo real.'
              : 'Agrega selecciones para calcular tu apuesta.'}
          </p>

          {submitError && (
            <p
              role='alert'
              className='mt-3 flex items-start gap-1.5 border border-crimson/50 bg-crimson/10 px-3 py-2 text-[11px] text-crimson-200'
            >
              <AlertCircle size={12} className='mt-0.5 shrink-0' aria-hidden='true' />
              {submitError}
            </p>
          )}

          <button
            type='button'
            onClick={handleSubmit}
            disabled={!canSubmit}
            aria-busy={isSubmitting}
            className={`mt-4 flex w-full items-center justify-center gap-2 px-4 py-3.5 font-display text-sm font-extrabold uppercase tracking-brutal transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crimson/70 ${buttonStyles}`}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className='animate-spin' aria-hidden='true' />
                Procesando…
              </>
            ) : (
              <>
                <Zap size={16} aria-hidden='true' />
                Realizar Apuesta
              </>
            )}
          </button>

          <p className='mt-3 text-center text-[10px] uppercase tracking-wide text-metallic-slate'>
            Las cuotas pueden variar antes de confirmar
          </p>
        </div>
      </footer>
    </aside>
  );
}
