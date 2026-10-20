import { useId, useMemo, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Check,
  Coins,
  Loader2,
  LockKeyhole,
  Plus,
  RefreshCw,
  ShieldCheck,
  Ticket,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';

import { useAuth } from '@/context/authState';
import { useBetSlip } from '@/context/betSlipState';
import {
  areOddsEqual,
  calculatePotentialPayout,
  calculateTotalOdds,
  countPendingOdds,
  DEFAULT_MAX_STAKE,
  DEFAULT_MIN_STAKE,
  getStakeIssue,
  parseStakeInput,
  type BetSlipTab,
} from '@/domain/bets';

/**
 * BetSlip — panel de apuestas de Zenbet.
 *
 * Consume el store global (`useBetSlip`): el provider es dueño del canal
 * SignalR y cruza la cuota viva con la aceptada. Este componente solo presenta
 * el estado y captura stake/consentimiento; nunca habla HTTP directamente.
 */

interface BetSlipProps {
  readonly className?: string;
  readonly minStake?: number;
  readonly maxStake?: number;
  readonly currency?: string;
  readonly locale?: string;
}

const QUICK_INCREMENTS = [10, 50] as const;

function formatOdds(value: number): string {
  return value.toFixed(2);
}

export default function BetSlip({
  className = '',
  minStake = DEFAULT_MIN_STAKE,
  maxStake = DEFAULT_MAX_STAKE,
  currency = 'USD',
  locale = 'es-MX',
}: BetSlipProps) {
  const { isAuthenticated, user } = useAuth();
  const {
    selections,
    hubStatus,
    isPlacingBet,
    error,
    receipt,
    clearSelections,
    removeSelection,
    keepOnlySelection,
    acceptLiveOdds,
    clearError,
    clearReceipt,
    placeBet,
  } = useBetSlip();

  const baseId = useId();
  const stakeInputId = `${baseId}-stake`;
  const consentId = `${baseId}-consent`;
  const singleTabId = `${baseId}-tab-single`;
  const combinedTabId = `${baseId}-tab-combined`;
  const panelId = `${baseId}-panel`;

  const [stakeInput, setStakeInput] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [preferredTab, setPreferredTab] = useState<BetSlipTab | null>(null);

  /* ---------------------------------------------------------------------- */
  /* Formato                                                                */
  /* ---------------------------------------------------------------------- */

  const formatters = useMemo(() => {
    try {
      const money = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      const compact = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
      });

      return {
        money,
        compact,
        symbol:
          money.formatToParts(0).find((part) => part.type === 'currency')?.value ?? currency,
      };
    } catch {
      return { money: null, compact: null, symbol: currency };
    }
  }, [locale, currency]);

  const formatMoney = (value: number): string =>
    formatters.money ? formatters.money.format(value) : `${value.toFixed(2)} ${currency}`;

  const formatCompact = (value: number): string =>
    formatters.compact ? formatters.compact.format(value) : `${Math.round(value)} ${currency}`;

  /* ---------------------------------------------------------------------- */
  /* Derivados                                                              */
  /* ---------------------------------------------------------------------- */

  const walletBalance = user?.walletBalance ?? 0;
  const hasSelections = selections.length > 0;
  const isSingle = selections.length === 1;
  const activeTab: BetSlipTab =
    selections.length <= 1 ? 'single' : (preferredTab ?? 'combined');

  const stake = parseStakeInput(stakeInput);
  const stakeIssue =
    stakeInput.trim() === '' ? null : getStakeIssue(stake, minStake, maxStake);

  const pendingCount = countPendingOdds(selections);
  const hasPendingOdds = pendingCount > 0;

  const totalOdds = calculateTotalOdds(selections);
  const potentialPayout = calculatePotentialPayout(stake, selections);
  const hasPayout = stake !== null && stake > 0 && hasSelections;

  const balanceWarning =
    isAuthenticated && stake !== null && stake > 0 && walletBalance > 0 && stake > walletBalance;

  const canSubmit = Boolean(
    isAuthenticated &&
      isSingle &&
      activeTab === 'single' &&
      !hasPendingOdds &&
      !isPlacingBet &&
      !receipt &&
      stake !== null &&
      stake > 0 &&
      stakeIssue === null &&
      termsAccepted,
  );

  let stakeError: string | null = null;
  if (stakeIssue === 'invalid') stakeError = 'Ingresa un monto válido.';
  else if (stakeIssue === 'below-min') stakeError = `La apuesta mínima es ${formatMoney(minStake)}.`;
  else if (stakeIssue === 'above-max') stakeError = `La apuesta máxima es ${formatMoney(maxStake)}.`;

  const maxQuickStake =
    walletBalance > 0 ? Math.min(maxStake, walletBalance) : maxStake;

  /* ---------------------------------------------------------------------- */
  /* Handlers                                                               */
  /* ---------------------------------------------------------------------- */

  const handleStakeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;
    if (!/^\d*[.,]?\d*$/.test(raw)) return;

    setStakeInput(raw);
    if (error) clearError();
  };

  const applyStake = (value: number) => {
    const clamped = Math.min(maxStake, Math.max(0, value));
    setStakeInput(clamped > 0 ? String(Math.round(clamped * 100) / 100) : '');
    if (error) clearError();
  };

  const handleIncrement = (increment: number) => {
    applyStake((stake ?? 0) + increment);
  };

  const handleMax = () => applyStake(maxQuickStake);

  const handleSubmit = async () => {
    if (!canSubmit || stake === null) return;

    const outcome = await placeBet(stake);

    if (outcome.ok) {
      setStakeInput('');
      setTermsAccepted(false);
      setPreferredTab(null);
    }
  };

  const handleTabChange = (tab: BetSlipTab) => {
    if (tab === 'combined' && selections.length < 2) return;
    setPreferredTab(tab);
  };

  /* ---------------------------------------------------------------------- */
  /* Presentación del hub                                                   */
  /* ---------------------------------------------------------------------- */

  const hubPresentation =
    hubStatus === 'connected'
      ? { label: 'En vivo', dot: 'bg-odds-up', ping: true }
      : hubStatus === 'connecting'
        ? { label: 'Conectando', dot: 'bg-odds-live', ping: false }
        : hubStatus === 'reconnecting'
          ? { label: 'Reconectando', dot: 'bg-odds-live', ping: false }
          : { label: 'Sin feed', dot: 'bg-metallic-gunmetal', ping: false };

  /* ---------------------------------------------------------------------- */
  /* Render                                                                 */
  /* ---------------------------------------------------------------------- */

  return (
    <aside
      aria-label='Boleto de apuestas'
      aria-busy={isPlacingBet}
      className={`glass-panel relative flex w-full flex-col overflow-hidden ${className}`}
    >
      <div
        aria-hidden='true'
        className='pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-crimson/70 to-transparent'
      />

      {/* Cabecera */}
      <header className='flex shrink-0 items-center justify-between gap-3 px-4 py-3.5'>
        <div className='flex min-w-0 items-center gap-2.5'>
          <span className='grid h-8 w-8 shrink-0 place-items-center border border-crimson/35 bg-crimson/10 text-crimson'>
            <Ticket size={15} aria-hidden='true' />
          </span>
          <div className='min-w-0'>
            <h2 className='font-display text-[11px] font-extrabold uppercase tracking-ultra text-white'>
              Boleto
            </h2>
            <p className='font-mono text-[9px] uppercase tracking-brutal text-metallic-slate'>
              {receipt
                ? 'Operación cerrada'
                : `${selections.length} ${selections.length === 1 ? 'selección' : 'selecciones'}`}
            </p>
          </div>
        </div>

        <div className='flex shrink-0 items-center gap-2'>
          <span className='inline-flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-brutal text-metallic-slate'>
            <span className='relative flex h-1.5 w-1.5' aria-hidden='true'>
              {hubPresentation.ping && (
                <span
                  className={`absolute inline-flex h-full w-full animate-ping rounded-full ${hubPresentation.dot} opacity-70`}
                />
              )}
              <span
                className={`relative inline-flex h-1.5 w-1.5 rounded-full ${hubPresentation.dot} ${
                  hubStatus === 'connecting' || hubStatus === 'reconnecting'
                    ? 'animate-pulse'
                    : ''
                }`}
              />
            </span>
            {hubPresentation.label}
          </span>

          {!receipt && hasSelections && (
            <button
              type='button'
              onClick={clearSelections}
              disabled={isPlacingBet}
              aria-label='Vaciar boleto'
              className='border border-transparent p-1.5 text-metallic-slate transition-colors duration-150 hover:border-crimson/40 hover:text-crimson focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-crimson disabled:cursor-not-allowed disabled:opacity-40'
            >
              <Trash2 size={13} aria-hidden='true' />
            </button>
          )}
        </div>
      </header>

      {receipt ? (
        /* ---------------------------------------------------------------- */
        /* Recibo de confirmación                                            */
        /* ---------------------------------------------------------------- */
        <div className='slip-confirm-in flex flex-col overflow-y-auto px-5 py-7' role='status' aria-live='polite'>
          <span className='mx-auto grid h-12 w-12 place-items-center rounded-full border border-odds-up/40 bg-odds-up/10 text-odds-up'>
            <Check size={22} strokeWidth={2.5} aria-hidden='true' />
          </span>

          <h3 className='mt-4 text-center font-display text-sm font-extrabold uppercase tracking-brutal text-white'>
            {receipt.idempotentReplay ? 'Apuesta ya registrada' : 'Apuesta confirmada'}
          </h3>
          <p className='mt-1.5 text-center text-[11px] leading-relaxed text-metallic-titanium'>
            {receipt.idempotentReplay
              ? 'El servidor reconoció la operación idempotente: no se debitó dos veces.'
              : 'El servidor aceptó la apuesta y actualizó tu billetera.'}
          </p>

          <dl className='mt-5 divide-y divide-obsidian-border/60 border-y border-obsidian-border/60'>
            <div className='flex items-center justify-between gap-3 py-2.5'>
              <dt className='text-[10px] uppercase tracking-brutal text-metallic-slate'>Monto</dt>
              <dd className='font-mono text-sm font-bold tabular-nums text-white'>
                {formatMoney(receipt.stake)}
              </dd>
            </div>
            <div className='flex items-center justify-between gap-3 py-2.5'>
              <dt className='text-[10px] uppercase tracking-brutal text-metallic-slate'>Cuota</dt>
              <dd className='font-mono text-sm font-bold tabular-nums text-white'>
                ×{formatOdds(receipt.odds)}
              </dd>
            </div>
            <div className='flex items-center justify-between gap-3 py-2.5'>
              <dt className='text-[10px] uppercase tracking-brutal text-metallic-slate'>
                Retorno potencial
              </dt>
              <dd className='font-odds text-base font-extrabold tabular-nums text-gold'>
                {formatMoney(receipt.potentialPayout)}
              </dd>
            </div>
            {receipt.newBalance !== null && (
              <div className='flex items-center justify-between gap-3 py-2.5'>
                <dt className='text-[10px] uppercase tracking-brutal text-metallic-slate'>
                  Saldo actualizado
                </dt>
                <dd className='font-mono text-sm font-bold tabular-nums text-metallic-chrome'>
                  {formatMoney(receipt.newBalance)}
                </dd>
              </div>
            )}
          </dl>

          {receipt.betId && (
            <p className='mt-3 text-center font-mono text-[9px] uppercase tracking-brutal text-metallic-slate'>
              Ticket {receipt.betId.slice(0, 8)}
            </p>
          )}

          <button
            type='button'
            onClick={clearReceipt}
            className='mt-5 flex w-full items-center justify-center gap-2 border border-crimson/60 bg-crimson/10 px-4 py-3 font-display text-xs font-extrabold uppercase tracking-brutal text-crimson transition-colors duration-150 hover:bg-crimson/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crimson/70'
          >
            <Plus size={14} aria-hidden='true' />
            Nueva apuesta
          </button>
        </div>
      ) : (
        <>
          {/* Tabs */}
          {hasSelections && (
            <div
              role='tablist'
              aria-label='Tipo de apuesta'
              className='grid shrink-0 grid-cols-2 border-y border-obsidian-border/70'
            >
              <button
                type='button'
                role='tab'
                id={singleTabId}
                aria-controls={panelId}
                aria-selected={activeTab === 'single'}
                onClick={() => handleTabChange('single')}
                className={`flex items-center justify-center gap-2 border-b-2 py-2.5 font-display text-[10px] font-extrabold uppercase tracking-brutal transition-colors duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-crimson ${
                  activeTab === 'single'
                    ? 'border-crimson bg-white/[0.02] text-white'
                    : 'border-transparent text-metallic-slate hover:text-metallic-chrome'
                }`}
              >
                Simple
                <span className='font-mono text-[9px] font-bold tabular-nums text-metallic-gunmetal'>
                  {isSingle ? '1' : hasSelections ? '—' : '0'}
                </span>
              </button>

              <button
                type='button'
                role='tab'
                id={combinedTabId}
                aria-controls={panelId}
                aria-selected={activeTab === 'combined'}
                disabled={selections.length < 2}
                onClick={() => handleTabChange('combined')}
                className={`flex items-center justify-center gap-2 border-b-2 py-2.5 font-display text-[10px] font-extrabold uppercase tracking-brutal transition-colors duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-crimson disabled:cursor-not-allowed disabled:opacity-40 ${
                  activeTab === 'combined'
                    ? 'border-crimson bg-white/[0.02] text-white'
                    : 'border-transparent text-metallic-slate hover:text-metallic-chrome'
                }`}
              >
                Combinada
                <span className='font-mono text-[9px] font-bold tabular-nums text-metallic-gunmetal'>
                  {selections.length > 1 ? selections.length : '—'}
                </span>
              </button>
            </div>
          )}

          {/* Contenido */}
          <div
            role={hasSelections ? 'tabpanel' : undefined}
            id={hasSelections ? panelId : undefined}
            aria-labelledby={
              hasSelections ? (activeTab === 'single' ? singleTabId : combinedTabId) : undefined
            }
            className='flex min-h-0 flex-1 flex-col overflow-y-auto'
          >
            {!hasSelections ? (
              <div className='flex flex-col items-center justify-center gap-2 px-6 py-12 text-center'>
                <Ticket size={26} className='text-metallic-gunmetal' aria-hidden='true' />
                <p className='font-display text-xs font-bold uppercase tracking-brutal text-metallic-slate'>
                  Boleto vacío
                </p>
                <p className='max-w-[16rem] text-[11px] leading-relaxed text-metallic-slate'>
                  Selecciona una cuota del mercado para comenzar. Las cuotas se actualizan en
                  vivo.
                </p>
              </div>
            ) : (
              <>
                {/* Selecciones */}
                <ul className='max-h-[min(46vh,380px)] min-h-0 flex-1 divide-y divide-obsidian-border/60 overflow-y-auto'>
                  {selections.map((selection) => {
                    const changed = !areOddsEqual(selection.odds, selection.liveOdds);
                    const direction = selection.liveOdds > selection.odds ? 'up' : 'down';

                    return (
                      <li
                        key={selection.selectionId}
                        className='flex items-start gap-3 px-4 py-3'
                      >
                        <div className='min-w-0 flex-1'>
                          <p className='truncate font-mono text-[9px] uppercase tracking-brutal text-metallic-slate'>
                            {selection.eventName}
                          </p>
                          <p className='mt-0.5 truncate font-sans text-[13px] font-semibold text-white'>
                            {selection.selectionName}
                          </p>
                          <p className='mt-0.5 text-[10px] uppercase tracking-wide text-metallic-titanium'>
                            {selection.marketLabel}
                          </p>
                          {activeTab === 'single' && selections.length > 1 && (
                            <button
                              type='button'
                              onClick={() => {
                                keepOnlySelection(selection.selectionId);
                                setPreferredTab('single');
                              }}
                              disabled={isPlacingBet}
                              className='mt-1.5 inline-flex items-center gap-1 font-mono text-[9px] font-bold uppercase tracking-brutal text-crimson transition-colors duration-150 hover:text-crimson-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-crimson disabled:cursor-not-allowed disabled:opacity-40'
                            >
                              Apostar solo esta
                              <ArrowRight size={10} aria-hidden='true' />
                            </button>
                          )}
                        </div>

                        <div className='flex shrink-0 flex-col items-end gap-1.5'>
                          <div className='flex items-center gap-1'>
                            {changed ? (
                              <span className='flex items-baseline gap-1 font-odds text-sm font-bold tabular-nums'>
                                <s className='text-[11px] font-medium text-metallic-slate'>
                                  {formatOdds(selection.odds)}
                                </s>
                                <ArrowRight size={9} className='text-odds-live' aria-hidden='true' />
                                <span
                                  className={
                                    direction === 'up'
                                      ? 'text-odds-up'
                                      : 'text-odds-down'
                                  }
                                >
                                  {formatOdds(selection.liveOdds)}
                                </span>
                              </span>
                            ) : (
                              <span className='font-odds text-sm font-bold tabular-nums text-white'>
                                {formatOdds(selection.liveOdds)}
                              </span>
                            )}

                            {!changed && selection.trend === 'up' && (
                              <TrendingUp size={11} className='text-odds-up' aria-hidden='true' />
                            )}
                            {!changed && selection.trend === 'down' && (
                              <TrendingDown size={11} className='text-odds-down' aria-hidden='true' />
                            )}
                          </div>

                          {changed && (
                            <span className='border border-odds-live/40 bg-odds-live/10 px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-brutal text-odds-live'>
                              Cuota actualizada
                            </span>
                          )}
                        </div>

                        <button
                          type='button'
                          onClick={() => removeSelection(selection.selectionId)}
                          disabled={isPlacingBet}
                          aria-label={`Eliminar selección ${selection.selectionName}`}
                          className='mt-0.5 border border-transparent p-1 text-metallic-slate transition-colors duration-150 hover:border-crimson/40 hover:text-crimson focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-crimson disabled:cursor-not-allowed disabled:opacity-40'
                        >
                          <X size={13} aria-hidden='true' />
                        </button>
                      </li>
                    );
                  })}
                </ul>

                {/* Alerta de cuota cambiada */}
                {hasPendingOdds && (
                  <div
                    role='status'
                    className='shrink-0 border-y border-odds-live/30 bg-odds-live/[0.06] px-4 py-3'
                  >
                    <div className='flex items-start gap-2'>
                      <AlertTriangle
                        size={13}
                        className='mt-0.5 shrink-0 text-odds-live'
                        aria-hidden='true'
                      />
                      <div className='min-w-0 flex-1'>
                        <p className='font-mono text-[10px] font-bold uppercase tracking-brutal text-odds-live'>
                          {pendingCount === 1
                            ? '1 cuota cambió'
                            : `${pendingCount} cuotas cambiaron`}
                        </p>
                        <p className='mt-1 text-[10px] leading-relaxed text-metallic-titanium'>
                          Revisa la nueva cuota antes de confirmar. El boleto queda bloqueado
                          hasta que la aceptes.
                        </p>
                        <button
                          type='button'
                          onClick={acceptLiveOdds}
                          disabled={isPlacingBet}
                          className='mt-2 inline-flex items-center gap-1.5 border border-odds-live/50 bg-odds-live/10 px-2.5 py-1.5 font-mono text-[9px] font-bold uppercase tracking-brutal text-odds-live transition-colors duration-150 hover:bg-odds-live/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-odds-live disabled:cursor-not-allowed disabled:opacity-40'
                        >
                          <RefreshCw size={11} aria-hidden='true' />
                          Aceptar nuevas cuotas
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Resumen + stake */}
                {activeTab === 'single' && selections.length > 1 ? (
                  <div className='shrink-0 border-t border-obsidian-border/70 px-4 py-3.5'>
                    <p className='flex items-start gap-2 text-[11px] leading-relaxed text-metallic-titanium'>
                      <ShieldCheck
                        size={13}
                        className='mt-0.5 shrink-0 text-metallic-slate'
                        aria-hidden='true'
                      />
                      La API registra una apuesta por selección. Elige “Apostar solo esta” en la
                      cuota que quieras enviar.
                    </p>
                  </div>
                ) : (
                  <footer className='mt-auto shrink-0 border-t border-obsidian-border/70'>
                    <div className='flex items-center justify-between px-4 py-3'>
                      <span className='text-[10px] font-bold uppercase tracking-brutal text-metallic-slate'>
                        {activeTab === 'combined' ? 'Cuota combinada' : 'Cuota total'}
                      </span>
                      <span className='font-odds text-2xl font-bold tabular-nums text-white'>
                        ×{formatOdds(totalOdds)}
                      </span>
                    </div>

                    <div className='flex items-center justify-between border-y border-obsidian-border/60 bg-gradient-to-r from-gold/10 via-transparent to-transparent px-4 py-3'>
                      <span className='inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-brutal text-gold'>
                        <Coins size={12} aria-hidden='true' />
                        Ganancia potencial
                      </span>
                      <span className='font-odds text-xl font-extrabold tabular-nums text-gold'>
                        {hasPayout ? formatMoney(potentialPayout) : '—'}
                      </span>
                    </div>

                    <div className='px-4 pb-1 pt-3.5'>
                      <div className='flex items-center justify-between gap-2'>
                        <label
                          htmlFor={stakeInputId}
                          className='text-[10px] font-bold uppercase tracking-brutal text-metallic-chrome'
                        >
                          Monto a apostar
                        </label>
                        <span className='font-mono text-[10px] tabular-nums text-metallic-slate'>
                          {isAuthenticated ? `Saldo ${formatMoney(walletBalance)}` : 'Sin sesión'}
                        </span>
                      </div>

                      <div className='relative mt-2'>
                        <span
                          aria-hidden='true'
                          className='pointer-events-none absolute inset-y-0 left-0 flex items-center border-r border-obsidian-border px-3 font-mono text-xs font-bold text-crimson'
                        >
                          {formatters.symbol}
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
                            if (event.key === 'Enter') void handleSubmit();
                          }}
                          disabled={isPlacingBet}
                          aria-invalid={Boolean(stakeError)}
                          aria-describedby={`${stakeInputId}-help`}
                          className={`w-full border bg-obsidian-void py-2.5 pl-12 pr-3 font-mono text-base font-bold tabular-nums text-white placeholder:text-metallic-gunmetal focus:outline-none focus:ring-1 disabled:cursor-not-allowed disabled:opacity-60 ${
                            stakeError
                              ? 'border-crimson focus:ring-crimson'
                              : 'border-obsidian-border focus:border-crimson focus:ring-crimson/60'
                          }`}
                        />
                      </div>

                      <div className='mt-2 flex flex-wrap items-center gap-1.5'>
                        {QUICK_INCREMENTS.map((increment) => (
                          <button
                            key={increment}
                            type='button'
                            onClick={() => handleIncrement(increment)}
                            disabled={isPlacingBet}
                            className='border border-obsidian-border px-2 py-1 font-mono text-[10px] font-bold tabular-nums text-metallic-titanium transition-colors duration-150 hover:border-crimson/50 hover:text-crimson focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-crimson disabled:cursor-not-allowed disabled:opacity-40'
                          >
                            +{formatCompact(increment)}
                          </button>
                        ))}
                        <button
                          type='button'
                          onClick={handleMax}
                          disabled={isPlacingBet}
                          className='border border-obsidian-border px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wide text-metallic-titanium transition-colors duration-150 hover:border-crimson/50 hover:text-crimson focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-crimson disabled:cursor-not-allowed disabled:opacity-40'
                        >
                          Max
                        </button>
                        <span className='ml-auto font-mono text-[9px] tabular-nums text-metallic-slate'>
                          Mín {formatCompact(minStake)} · Máx {formatCompact(maxStake)}
                        </span>
                      </div>

                      {stakeError && (
                        <p
                          role='alert'
                          className='mt-2 flex items-start gap-1.5 text-[11px] font-medium text-crimson'
                        >
                          <AlertCircle
                            size={12}
                            className='mt-0.5 shrink-0'
                            aria-hidden='true'
                          />
                          {stakeError}
                        </p>
                      )}

                      {!stakeError && balanceWarning && (
                        <p className='mt-2 flex items-start gap-1.5 text-[10px] leading-relaxed text-odds-live'>
                          <AlertTriangle
                            size={11}
                            className='mt-0.5 shrink-0'
                            aria-hidden='true'
                          />
                          Tu saldo registrado es menor al monto. El servidor validará el saldo
                          final de la billetera.
                        </p>
                      )}

                      <p
                        id={`${stakeInputId}-help`}
                        className='mt-2 text-[10px] leading-relaxed text-metallic-slate'
                      >
                        {hasPendingOdds
                          ? 'Acepta las nuevas cuotas para habilitar la confirmación.'
                          : 'La cuota total y la ganancia se recalculan con el feed en vivo.'}
                      </p>
                    </div>

                    {error && (
                      <div
                        role='alert'
                        className='mx-4 mb-3 border border-crimson/45 bg-crimson/10 px-3 py-2.5'
                      >
                        <div className='flex items-start gap-2'>
                          <AlertCircle
                            size={13}
                            className='mt-0.5 shrink-0 text-crimson'
                            aria-hidden='true'
                          />
                          <div className='min-w-0 flex-1'>
                            <p className='font-display text-[10px] font-extrabold uppercase tracking-brutal text-crimson-200'>
                              {error.title}
                            </p>
                            <p className='mt-1 text-[11px] leading-relaxed text-metallic-titanium'>
                              {error.message}
                            </p>
                            {error.retryAfterSeconds !== undefined && (
                              <p className='mt-1 font-mono text-[10px] tabular-nums text-odds-live'>
                                Reintenta en ~{Math.ceil(error.retryAfterSeconds)}s.
                              </p>
                            )}
                          </div>
                          <button
                            type='button'
                            onClick={clearError}
                            aria-label='Descartar error'
                            className='border border-transparent p-1 text-metallic-slate transition-colors duration-150 hover:border-crimson/40 hover:text-crimson focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-crimson'
                          >
                            <X size={12} aria-hidden='true' />
                          </button>
                        </div>
                      </div>
                    )}

                    {activeTab === 'combined' ? (
                      <div className='px-4 pb-4'>
                        <div className='border border-odds-live/35 bg-odds-live/[0.06] px-3 py-2.5'>
                          <p className='flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-brutal text-odds-live'>
                            <LockKeyhole size={11} aria-hidden='true' />
                            Combinada no disponible
                          </p>
                          <p className='mt-1 text-[10px] leading-relaxed text-metallic-titanium'>
                            La API actual registra una selección por apuesta. Elige una cuota
                            para enviarla como simple.
                          </p>
                          <button
                            type='button'
                            onClick={() => handleTabChange('single')}
                            className='mt-2 inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase tracking-brutal text-odds-live transition-colors duration-150 hover:text-gold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-odds-live'
                          >
                            Elegir una simple
                            <ArrowRight size={11} aria-hidden='true' />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className='px-4 pb-4'>
                        <div className='border-t border-obsidian-border/60 pt-3'>
                          <div className='flex items-start gap-2.5'>
                            <input
                              id={consentId}
                              type='checkbox'
                              checked={termsAccepted}
                              onChange={(event) => setTermsAccepted(event.target.checked)}
                              disabled={isPlacingBet}
                              aria-required='true'
                              aria-labelledby={`${consentId}-text`}
                              className='mt-0.5 h-3.5 w-3.5 cursor-pointer border-obsidian-border bg-obsidian-void text-crimson focus:ring-crimson disabled:cursor-not-allowed disabled:opacity-40'
                            />
                            <p
                              id={`${consentId}-text`}
                              className='text-[11px] leading-tight text-metallic-slate'
                            >
                              <label
                                htmlFor={consentId}
                                className='cursor-pointer select-none'
                              >
                                Acepto los
                              </label>{' '}
                              <Link
                                to='/terms'
                                target='_blank'
                                rel='noreferrer'
                                className='text-metallic-platinum underline underline-offset-2 transition-colors duration-150 hover:text-crimson'
                              >
                                Términos
                              </Link>{' '}
                              y la{' '}
                              <Link
                                to='/privacy'
                                target='_blank'
                                rel='noreferrer'
                                className='text-metallic-platinum underline underline-offset-2 transition-colors duration-150 hover:text-crimson'
                              >
                                Privacidad
                              </Link>
                              .
                            </p>
                          </div>
                        </div>

                        {isAuthenticated ? (
                          <button
                            type='button'
                            onClick={() => void handleSubmit()}
                            disabled={!canSubmit}
                            aria-disabled={!canSubmit}
                            aria-busy={isPlacingBet}
                            className={`mt-3.5 flex w-full items-center justify-center gap-2 px-4 py-3.5 font-display text-xs font-extrabold uppercase tracking-brutal transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crimson/70 ${
                              isPlacingBet
                                ? 'cursor-wait bg-crimson text-white shadow-glow-crimson'
                                : canSubmit
                                  ? 'bg-crimson text-white shadow-glow-crimson hover:bg-crimson-600 active:translate-y-[1px]'
                                  : 'cursor-not-allowed border border-obsidian-border bg-obsidian-elevated text-metallic-slate'
                            }`}
                          >
                            {isPlacingBet ? (
                              <>
                                <Loader2 size={15} className='animate-spin' aria-hidden='true' />
                                Confirmando…
                              </>
                            ) : hasPendingOdds ? (
                              <>
                                <RefreshCw size={15} aria-hidden='true' />
                                Acepta las nuevas cuotas
                              </>
                            ) : (
                              <>
                                <Zap size={15} aria-hidden='true' />
                                Realizar apuesta
                              </>
                            )}
                          </button>
                        ) : (
                          <Link
                            to='/login'
                            className='mt-3.5 flex w-full items-center justify-center gap-2 border border-crimson/60 bg-crimson/10 px-4 py-3.5 font-display text-xs font-extrabold uppercase tracking-brutal text-crimson transition-colors duration-150 hover:bg-crimson/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crimson/70'
                          >
                            <LockKeyhole size={15} aria-hidden='true' />
                            Inicia sesión para apostar
                          </Link>
                        )}

                        <p className='mt-2.5 text-center font-mono text-[9px] uppercase tracking-wide text-metallic-slate'>
                          Las cuotas pueden variar hasta la confirmación del servidor
                        </p>
                      </div>
                    )}
                  </footer>
                )}
              </>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
