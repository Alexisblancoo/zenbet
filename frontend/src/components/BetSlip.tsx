import { useCallback, useEffect, useId, useMemo, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Coins,
  HelpCircle,
  Loader2,
  LockKeyhole,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Tag,
  Ticket,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
  Zap,
} from 'lucide-react';

import { useAuthModal } from '@/context/authModalState';
import { useAuth } from '@/context/authState';
import { useBetSlip } from '@/context/betSlipState';
import {
  areOddsEqual,
  calculatePotentialPayout,
  calculatePromoBonus,
  calculateTotalOdds,
  countPendingOdds,
  DEFAULT_MAX_STAKE,
  DEFAULT_MIN_STAKE,
  getStakeIssue,
  isSelectionEventClosed,
  parseStakeInput,
  resolvePromoCode,
  roundMoney,
  type BetSlipTab,
  type PromoCodeDefinition,
} from '@/domain/bets';
import { formatDecimalOdds } from '@/domain/odds';

import BetSlipTour from './onboarding/BetSlipTour';

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
  readonly onClose?: () => void;
  /** Activa la guía de primera apertura en el drawer móvil. */
  readonly tourEnabled?: boolean;
  /**
   * `floating` es el panel de escritorio con elevación y resumen persistente;
   * `sheet` es el drawer móvil; `panel` conserva el contenedor base.
   */
  readonly variant?: 'panel' | 'floating' | 'sheet';
}

const QUICK_INCREMENTS = [10, 50] as const;
const TOUR_STORAGE_KEY = 'zenbet:bet-slip-tour:v1';

export default function BetSlip({
  className = '',
  minStake = DEFAULT_MIN_STAKE,
  maxStake = DEFAULT_MAX_STAKE,
  currency = 'USD',
  locale = 'es-MX',
  onClose,
  tourEnabled = false,
  variant = 'panel',
}: BetSlipProps) {
  const { isAuthenticated, user } = useAuth();
  const { openAuth } = useAuthModal();
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
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<PromoCodeDefinition | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [tourOpen, setTourOpen] = useState(false);
  const closeTour = useCallback(() => setTourOpen(false), []);

  // Si el usuario vacía el boleto mientras está contraído, el panel vuelve al
  // estado vacío expandido en el mismo render, sin un efecto intermedio.
  if (selections.length === 0 && isCollapsed) {
    setIsCollapsed(false);
  }

  useEffect(() => {
    if (!tourEnabled) return undefined;

    let seen = false;
    try {
      seen = Boolean(window.localStorage.getItem(TOUR_STORAGE_KEY));
    } catch {
      // localStorage puede estar bloqueado en modo privado; la guía sigue
      // funcionando en memoria y el botón de ayuda permite reabrirla.
    }

    if (seen) return undefined;

    // La marca se escribe cuando la guía realmente aparece. Así el doble
    // montaje de StrictMode en desarrollo no consume la primera apertura.
    const timer = window.setTimeout(() => {
      setTourOpen(true);
      try {
        window.localStorage.setItem(TOUR_STORAGE_KEY, 'seen');
      } catch {
        // Sin almacenamiento, la guía se muestra igualmente en esta sesión.
      }
    }, 520);

    return () => window.clearTimeout(timer);
  }, [tourEnabled]);

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

  /** Sello de emisión del recibo: fecha corta local, al pie del papel. */
  const formatReceiptStamp = (epochMs: number, stampLocale: string): string => {
    try {
      return new Intl.DateTimeFormat(stampLocale, {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(epochMs);
    } catch {
      return new Date(epochMs).toISOString().slice(0, 16).replace('T', ' · ');
    }
  };

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
  const closedSelections = selections.filter((selection) =>
    isSelectionEventClosed(selection),
  );
  const closedSelectionCount = closedSelections.length;
  const hasClosedSelections = closedSelectionCount > 0;
  const allClosedSuspended =
    hasClosedSelections &&
    closedSelections.every((selection) => selection.eventStatus === 'suspended');
  const allClosedMarketSettled =
    hasClosedSelections &&
    closedSelections.every((selection) => selection.marketSettled === true);

  const totalOdds = calculateTotalOdds(selections);
  const basePotentialPayout = calculatePotentialPayout(stake, selections);
  const promoBonus = appliedPromo
    ? calculatePromoBonus(basePotentialPayout, stake ?? 0, appliedPromo.bonusRate)
    : 0;
  const potentialPayout = roundMoney(basePotentialPayout + promoBonus);
  const hasPayout = stake !== null && stake > 0 && hasSelections;

  const balanceWarning =
    isAuthenticated && stake !== null && stake > 0 && walletBalance > 0 && stake > walletBalance;

  const canSubmit = Boolean(
    isAuthenticated &&
      isSingle &&
      activeTab === 'single' &&
      !hasClosedSelections &&
      !hasPendingOdds &&
      !isPlacingBet &&
      !receipt &&
      stake !== null &&
      stake > 0 &&
      stakeIssue === null &&
      termsAccepted,
  );

  // Un evento cerrado bloquea el CTA incluso sin sesión: no debe abrir el
  // registro como si la selección todavía fuera apostable.
  const primaryDisabled = hasClosedSelections || (isAuthenticated ? !canSubmit : false);

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

  const handleRemoveClosed = () => {
    for (const selection of selections) {
      if (isSelectionEventClosed(selection)) removeSelection(selection.selectionId);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit || stake === null) return;

    const outcome = await placeBet(stake, appliedPromo?.code);

    if (outcome.ok) {
      setStakeInput('');
      setTermsAccepted(false);
      setPreferredTab(null);
      setAppliedPromo(null);
      setPromoInput('');
      setPromoError(null);
      setPromoOpen(false);
    }
  };

  const handleApplyPromo = () => {
    const promo = resolvePromoCode(promoInput);

    if (!promo) {
      setPromoError('Código no válido. Prueba con SHIBUYA10.');
      return;
    }

    setAppliedPromo(promo);
    setPromoInput(promo.code);
    setPromoError(null);
    setPromoOpen(false);
    if (error) clearError();
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoInput('');
    setPromoError(null);
  };

  const handlePrimaryAction = () => {
    if (!isAuthenticated) {
      openAuth('register');
      return;
    }

    void handleSubmit();
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
      ? { label: 'En vivo', dot: 'bg-crimson', ping: true }
      : hubStatus === 'connecting'
        ? { label: 'Conectando', dot: 'bg-electric', ping: false }
        : hubStatus === 'reconnecting'
          ? { label: 'Reconectando', dot: 'bg-electric', ping: false }
          : { label: 'Snapshot', dot: 'bg-electric', ping: false };

  const promoSection = (
    <section
      data-tour='slip-promo'
      className='shrink-0 border-t border-obsidian-border/60 px-4 py-3'
    >
      {appliedPromo ? (
        <div className='flex items-center justify-between gap-3 border border-money/30 bg-money/[0.05] px-3 py-2.5'>
          <div className='flex min-w-0 items-center gap-2.5'>
            <span className='grid h-7 w-7 shrink-0 place-items-center border border-money/35 bg-money/10 text-money'>
              <Tag size={13} aria-hidden='true' />
            </span>
            <div className='min-w-0'>
              <p className='font-mono text-[10px] font-bold uppercase tracking-brutal text-money'>
                {appliedPromo.code}
              </p>
              <p className='truncate text-[10px] text-metallic-titanium'>
                {appliedPromo.label}
              </p>
            </div>
          </div>
          <button
            type='button'
            onClick={handleRemovePromo}
            disabled={isPlacingBet}
            className='shrink-0 font-mono text-[9px] font-bold uppercase tracking-brutal text-metallic-slate transition-colors duration-150 hover:text-crimson focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-crimson disabled:cursor-not-allowed disabled:opacity-40'
          >
            Quitar
          </button>
        </div>
      ) : (
        <>
          <button
            type='button'
            onClick={() => setPromoOpen((current) => !current)}
            aria-expanded={promoOpen}
            aria-controls={`${baseId}-promo`}
            className='flex w-full items-center justify-between gap-2 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-electric'
          >
            <span className='inline-flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-brutal text-metallic-slate'>
              <Tag size={12} aria-hidden='true' />
              Código promocional
            </span>
            <span className='inline-flex items-center gap-1 font-mono text-[9px] font-bold uppercase tracking-brutal text-lime-400'>
              <Sparkles size={11} aria-hidden='true' />
              {promoOpen ? 'Cerrar' : 'Agregar'}
            </span>
          </button>

          {promoOpen && (
            <div id={`${baseId}-promo`} className='mt-2 flex gap-2'>
              <input
                type='text'
                value={promoInput}
                onChange={(event) => {
                  setPromoInput(event.target.value.toUpperCase());
                  setPromoError(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleApplyPromo();
                  }
                }}
                maxLength={40}
                autoComplete='off'
                placeholder='Ej. SHIBUYA10'
                disabled={isPlacingBet}
                aria-label='Código promocional'
                aria-invalid={Boolean(promoError)}
                className='min-w-0 flex-1 border border-obsidian-border bg-obsidian-void px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-wide text-white placeholder:normal-case placeholder:tracking-normal placeholder:text-metallic-slate focus:border-lime-400 focus:outline-none focus:ring-1 focus:ring-lime-400/60 disabled:cursor-not-allowed disabled:opacity-60'
              />
              <button
                type='button'
                onClick={handleApplyPromo}
                disabled={isPlacingBet || !promoInput.trim()}
                className='shrink-0 border border-lime-400/50 bg-lime-400/10 px-3 py-2 font-display text-[10px] font-bold uppercase tracking-wide text-lime-400 transition-colors duration-150 hover:bg-lime-400/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lime-400 disabled:cursor-not-allowed disabled:opacity-40'
              >
                Aplicar
              </button>
            </div>
          )}

          {promoError && (
            <p role='alert' className='mt-1.5 text-[10px] font-medium text-crimson'>
              {promoError}
            </p>
          )}

          <p className='mt-1.5 text-[9px] leading-relaxed text-metallic-slate'>
            SHIBUYA10 suma 10% extra sobre las ganancias netas de una apuesta ganadora.
          </p>
        </>
      )}
    </section>
  );

  /* ---------------------------------------------------------------------- */
  /* Render                                                                 */
  /* ---------------------------------------------------------------------- */

  const variantShell =
    variant === 'floating'
      ? 'glass-float rounded-2xl shadow-float'
      : variant === 'sheet'
        ? 'glass-panel rounded-t-2xl rounded-b-none border-x-0 border-b-0'
        : 'glass-panel';

  return (
    <aside
      aria-label='Boleto de apuestas'
      aria-busy={isPlacingBet}
      data-variant={variant}
      className={`relative flex w-full flex-col overflow-hidden ${variantShell} ${className}`}
    >
      <div
        aria-hidden='true'
        className='pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-crimson/70 to-transparent'
      />

      {/* Cabecera */}
      <header className='flex shrink-0 items-center justify-between gap-3 px-4 py-3.5'>
        <div className='flex min-w-0 items-center gap-2.5'>
          <span className='grid h-8 w-8 shrink-0 place-items-center border border-crimson/35 bg-crimson/10 text-crimson'>
            <Ticket size={15} aria-hidden='true' />
          </span>
          <div className='min-w-0'>
            <h2 className='font-display text-[12px] font-bold uppercase tracking-wide text-white'>
              Boleto
            </h2>
            <p className='font-mono text-[9px] uppercase tracking-wide text-metallic-slate'>
              {receipt
                ? 'Operación cerrada'
                : `${selections.length} ${selections.length === 1 ? 'selección' : 'selecciones'}`}
            </p>
          </div>
        </div>

        <div className='flex shrink-0 items-center gap-2'>
          <span className='hidden items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-brutal text-metallic-slate min-[380px]:inline-flex'>
            <span
              className={`h-1.5 w-1.5 rounded-full ${hubPresentation.dot} ${
                hubStatus === 'connected'
                  ? 'animate-live-breathe'
                  : hubStatus === 'connecting' || hubStatus === 'reconnecting'
                    ? 'animate-pulse'
                    : ''
              }`}
              aria-hidden='true'
            />
            {hubPresentation.label}
          </span>

          {tourEnabled ? (
            <button
              type='button'
              onClick={() => setTourOpen(true)}
              aria-label='Abrir guía del boleto'
              className='border border-transparent p-1.5 text-metallic-slate transition-colors duration-150 hover:border-lime-400/40 hover:text-lime-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lime-400'
            >
              <HelpCircle size={13} aria-hidden='true' />
            </button>
          ) : null}

          {!receipt && hasSelections ? (
            <button
              type='button'
              data-tour='slip-collapse'
              onClick={() => setIsCollapsed((current) => !current)}
              aria-expanded={!isCollapsed}
              aria-controls={panelId}
              aria-label={isCollapsed ? 'Expandir boleto' : 'Contraer boleto'}
              className='border border-transparent p-1.5 text-metallic-slate transition-colors duration-150 hover:border-lime-400/40 hover:text-lime-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lime-400'
            >
              {isCollapsed ? (
                <ChevronDown size={14} aria-hidden='true' />
              ) : (
                <ChevronUp size={14} aria-hidden='true' />
              )}
            </button>
          ) : null}

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

          {onClose ? (
            <button
              type='button'
              onClick={onClose}
              aria-label='Cerrar boleto'
              className='border border-transparent p-1.5 text-metallic-slate transition-colors duration-150 hover:border-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-electric'
            >
              <X size={14} aria-hidden='true' />
            </button>
          ) : null}
        </div>
      </header>

      {variant === 'floating' && hasSelections && !receipt && !isCollapsed ? (
        <div className='flex shrink-0 items-center justify-between gap-3 border-y border-obsidian-border/60 bg-white/[0.018] px-4 py-2'>
          <span className='font-mono text-[8px] font-bold uppercase tracking-brutal text-metallic-slate'>
            Cuota total
          </span>
          <span className='font-odds text-lg font-bold tabular-nums text-money'>
            ×{formatDecimalOdds(totalOdds)}
          </span>
          <span className='min-w-0 truncate text-right font-mono text-[8px] uppercase tracking-wide text-metallic-slate'>
            {hasPayout ? formatMoney(potentialPayout) : 'Define tu monto'}
          </span>
        </div>
      ) : null}

      {receipt ? (
        /* ---------------------------------------------------------------- */
        /* Recibo de confirmación                                            */
        /* ---------------------------------------------------------------- */
        <div
          className='zb-receipt slip-confirm-in flex flex-col overflow-y-auto px-5 pb-8 pt-7'
          role='status'
          aria-live='polite'
        >
          <p aria-hidden='true' className='zb-receipt-brand mb-4 text-center'>
            Zenbet · Boleto digital
          </p>

          <span className='mx-auto grid h-12 w-12 place-items-center rounded-full border border-odds-up/40 bg-odds-up/10 text-odds-up'>
            <Check size={22} strokeWidth={2.5} aria-hidden='true' />
          </span>

          <h3 className='mt-4 text-center font-display text-sm font-bold uppercase tracking-wide text-white'>
            {receipt.idempotentReplay ? 'Apuesta ya registrada' : 'Apuesta confirmada'}
          </h3>
          <p className='mt-1.5 text-center text-[11px] leading-relaxed text-metallic-titanium'>
            {receipt.idempotentReplay
              ? 'La operación ya estaba registrada; no se debitó dos veces.'
              : 'Apuesta aceptada y saldo actualizado.'}
          </p>

          <dl className='mt-5 divide-y divide-obsidian-border/60 border-y border-obsidian-border/60'>
            <div className='flex items-center justify-between gap-3 py-2.5'>
              <dt className='text-[10px] uppercase tracking-wide text-metallic-slate'>Monto</dt>
              <dd className='font-mono text-sm font-bold tabular-nums text-money'>
                {formatMoney(receipt.stake)}
              </dd>
            </div>
            <div className='flex items-center justify-between gap-3 py-2.5'>
              <dt className='text-[10px] uppercase tracking-brutal text-metallic-slate'>Cuota</dt>
              <dd className='font-mono text-sm font-bold tabular-nums text-white'>
                ×{formatDecimalOdds(receipt.odds)}
              </dd>
            </div>
            <div className='flex items-center justify-between gap-3 py-2.5'>
              <dt className='text-[10px] uppercase tracking-brutal text-metallic-slate'>
                Retorno potencial
              </dt>
              <dd className='font-odds text-base font-extrabold tabular-nums text-money'>
                {formatMoney(receipt.potentialPayout)}
              </dd>
            </div>
            {receipt.promoCode ? (
              <div className='flex items-center justify-between gap-3 py-2.5'>
                <dt className='text-[10px] uppercase tracking-brutal text-metallic-slate'>
                  Código promo
                </dt>
                <dd className='inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-wide text-lime-400'>
                  <Tag size={11} aria-hidden='true' />
                  {receipt.promoCode}
                </dd>
              </div>
            ) : null}
            {receipt.promoBonus ? (
              <div className='flex items-center justify-between gap-3 py-2.5'>
                <dt className='text-[10px] uppercase tracking-brutal text-metallic-slate'>
                  Bono promocional
                </dt>
                <dd className='font-mono text-sm font-bold tabular-nums text-lime-400'>
                  +{formatMoney(receipt.promoBonus)}
                </dd>
              </div>
            ) : null}
            {receipt.newBalance !== null && (
              <div className='flex items-center justify-between gap-3 py-2.5'>
                <dt className='text-[10px] uppercase tracking-brutal text-metallic-slate'>
                  Saldo actualizado
                </dt>
                <dd className='font-mono text-sm font-bold tabular-nums text-money'>
                  {formatMoney(receipt.newBalance)}
                </dd>
              </div>
            )}
          </dl>

          <div aria-hidden='true' className='zb-receipt-perforation mt-6' />

          {receipt.betId && (
            <div data-tour='slip-receipt' className='mt-5 flex flex-col items-center gap-2.5'>
              <div aria-hidden='true' className='zb-receipt-barcode w-52' />
              <p className='zb-receipt-code'>{receipt.betId.slice(0, 12)}</p>
              <p className='zb-receipt-stamp'>Emitido {formatReceiptStamp(receipt.placedAt, locale)}</p>
            </div>
          )}

          <div className='mt-6 grid grid-cols-2 gap-2'>
            <button
              type='button'
              onClick={() => {
                clearReceipt();
                setIsCollapsed(false);
              }}
              className='flex items-center justify-center gap-2 border border-crimson/60 bg-crimson/10 px-3 py-3 font-display text-[11px] font-bold uppercase tracking-wide text-crimson transition-colors duration-150 hover:bg-crimson/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crimson/70'
            >
              <Plus size={14} aria-hidden='true' />
              Nueva
            </button>
            <Link
              to='/wallet'
              className='flex items-center justify-center gap-2 border border-obsidian-border bg-obsidian-surface/60 px-3 py-3 font-display text-[11px] font-bold uppercase tracking-wide text-metallic-platinum transition-colors duration-150 hover:border-electric/50 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric/60'
            >
              <Wallet size={14} aria-hidden='true' />
              Billetera
            </Link>
          </div>

          <div aria-hidden='true' className='zb-receipt-saw -mx-5 mt-7 shrink-0' />
        </div>
      ) : isCollapsed ? (
        <div className='flex min-h-0 flex-1 flex-col'>
          <div className='flex flex-1 flex-col items-center justify-center gap-3 px-6 py-8 text-center'>
            <span className='grid h-11 w-11 place-items-center border border-lime-400/35 bg-lime-400/10 text-lime-400'>
              <Ticket size={19} aria-hidden='true' />
            </span>
            <p className='font-display text-xs font-bold uppercase tracking-wide text-white'>
              Boleto contraído
            </p>
            <p className='max-w-[15rem] text-[11px] leading-relaxed text-metallic-slate'>
              Tu selección y tu cuota siguen guardadas. Expande el boleto para revisar el
              resumen o confirmar la apuesta.
            </p>
            <button
              type='button'
              data-tour='slip-expand'
              onClick={() => setIsCollapsed(false)}
              className='mt-1 inline-flex min-h-10 items-center gap-1.5 border border-lime-400/45 bg-lime-400/10 px-3.5 font-display text-[10px] font-bold uppercase tracking-wide text-lime-400 transition-colors duration-150 hover:bg-lime-400/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lime-400'
            >
              <ChevronDown size={13} aria-hidden='true' />
              Expandir boleto
            </button>
          </div>

          <div
            data-tour='slip-summary'
            className='shrink-0 border-t border-obsidian-border/70 px-4 py-3.5'
          >
            <div className='flex items-center justify-between gap-3'>
              <span className='text-[10px] font-bold uppercase tracking-brutal text-metallic-slate'>
                Cuota total
              </span>
              <span className='font-odds text-xl font-bold tabular-nums text-money'>
                ×{formatDecimalOdds(totalOdds)}
              </span>
            </div>
            <div className='mt-2 flex items-center justify-between gap-3 border-t border-obsidian-border/50 pt-2'>
              <span className='inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-brutal text-money'>
                <Coins size={11} aria-hidden='true' />
                Ganancia potencial
              </span>
              <span className='font-odds text-lg font-extrabold tabular-nums text-money'>
                {hasPayout ? formatMoney(potentialPayout) : '—'}
              </span>
            </div>
            {appliedPromo && promoBonus > 0 ? (
              <p className='mt-1.5 text-right font-mono text-[9px] uppercase tracking-wide text-lime-400'>
                Incluye +{formatMoney(promoBonus)} de {appliedPromo.code}
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <>
          {/* Tabs */}
          {hasSelections && (
            <div
              role='tablist'
              aria-label='Tipo de apuesta'
              className='shrink-0 border-b border-obsidian-border/70 px-3 py-2.5'
            >
              <div className='grid grid-cols-2 gap-1 rounded-full border border-white/[0.07] bg-white/[0.025] p-1'>
                <button
                  type='button'
                  role='tab'
                  id={singleTabId}
                  aria-controls={panelId}
                  aria-selected={activeTab === 'single'}
                  onClick={() => handleTabChange('single')}
                  className={`flex min-h-8 items-center justify-center gap-1.5 rounded-full px-2 font-display text-[10px] font-bold uppercase tracking-wide transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-crimson ${
                    activeTab === 'single'
                      ? 'bg-white text-[#0D0D0D] shadow-[0_8px_20px_-12px_rgba(255,255,255,0.55)]'
                      : 'text-metallic-slate hover:bg-white/[0.04] hover:text-white'
                  }`}
                >
                  Simple
                  <span
                    className={`font-mono text-[9px] font-bold tabular-nums ${
                      activeTab === 'single' ? 'text-black/55' : 'text-metallic-slate'
                    }`}
                  >
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
                  className={`flex min-h-8 items-center justify-center gap-1.5 rounded-full px-2 font-display text-[10px] font-bold uppercase tracking-wide transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-crimson disabled:cursor-not-allowed disabled:opacity-35 ${
                    activeTab === 'combined'
                      ? 'bg-white text-[#0D0D0D] shadow-[0_8px_20px_-12px_rgba(255,255,255,0.55)]'
                      : 'text-metallic-slate hover:bg-white/[0.04] hover:text-white'
                  }`}
                >
                  Combinada
                  <span
                    className={`font-mono text-[9px] font-bold tabular-nums ${
                      activeTab === 'combined' ? 'text-black/55' : 'text-metallic-slate'
                    }`}
                  >
                    {selections.length > 1 ? selections.length : '—'}
                  </span>
                </button>
              </div>
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
              <>
                <div
                  data-tour='slip-picks'
                  className='flex flex-col items-center justify-center gap-2 px-6 py-12 text-center'
                >
                  <Ticket size={26} className='text-metallic-slate' aria-hidden='true' />
                  <p className='font-display text-xs font-bold uppercase tracking-wide text-metallic-slate'>
                    Boleto vacío
                  </p>
                  <p className='max-w-[16rem] text-[11px] leading-relaxed text-metallic-slate'>
                    Haz clic en cualquier cuota para añadir tu selección al boleto de apuestas.
                  </p>
                </div>
                {promoSection}
              </>
            ) : (
              <>
                {/* Selecciones */}
                <ul
                  data-tour='slip-picks'
                  className='max-h-[min(46vh,380px)] min-h-0 flex-1 divide-y divide-obsidian-border/60 overflow-y-auto'
                >
                  {selections.map((selection) => {
                    const changed = !areOddsEqual(selection.odds, selection.liveOdds);
                    const direction = selection.liveOdds > selection.odds ? 'up' : 'down';
                    const closed = isSelectionEventClosed(selection);

                    return (
                      <li
                        key={selection.selectionId}
                        className={`flex items-start gap-3 px-4 py-3 ${
                          closed ? 'bg-[#050505] opacity-65 grayscale' : ''
                        }`}
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
                          {closed && (
                            <span className='mt-1 inline-flex border border-white/10 bg-white/[0.03] px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-wide text-metallic-slate'>
                              {selection.marketSettled
                                ? 'Mercado cerrado · sin apuestas'
                                : selection.eventStatus === 'suspended'
                                  ? 'Suspendido · sin apuestas'
                                  : 'Finalizado · sin apuestas'}
                            </span>
                          )}
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
                                  {formatDecimalOdds(selection.odds)}
                                </s>
                                <ArrowRight size={9} className='text-odds-live' aria-hidden='true' />
                                <span
                                  key={`${selection.selectionId}:${selection.liveOdds}`}
                                  className={`${
                                    direction === 'up' ? 'text-odds-up' : 'text-odds-down'
                                  } ${
                                    direction === 'up' ? 'zb-slip-tick-up' : 'zb-slip-tick-down'
                                  }`}
                                >
                                  {formatDecimalOdds(selection.liveOdds)}
                                </span>
                              </span>
                            ) : (
                              <span className='font-odds text-sm font-bold tabular-nums text-money'>
                                {formatDecimalOdds(selection.liveOdds)}
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

                {/* Alerta de combate finalizado */}
                {hasClosedSelections && (
                  <div
                    role='status'
                    className='shrink-0 border-y border-white/[0.08] bg-[#050505] px-4 py-3'
                  >
                    <div className='flex items-start gap-2'>
                      <LockKeyhole
                        size={13}
                        className='mt-0.5 shrink-0 text-metallic-slate'
                        aria-hidden='true'
                      />
                      <div className='min-w-0 flex-1'>
                        <p className='font-mono text-[10px] font-bold uppercase tracking-brutal text-metallic-titanium'>
                          {allClosedMarketSettled
                            ? closedSelectionCount === 1
                              ? 'El mercado se cerró'
                              : `${closedSelectionCount} mercados se cerraron`
                            : allClosedSuspended
                              ? closedSelectionCount === 1
                                ? 'El combate se suspendió'
                                : `${closedSelectionCount} combates suspendidos`
                              : closedSelectionCount === 1
                                ? 'El combate finalizó'
                                : `${closedSelectionCount} combates finalizaron`}
                        </p>
                        <p className='mt-1 text-[10px] leading-relaxed text-metallic-slate'>
                          Los mercados cerrados ya no aceptan apuestas. Quita las selecciones
                          cerradas para continuar.
                        </p>
                        <button
                          type='button'
                          onClick={handleRemoveClosed}
                          disabled={isPlacingBet}
                          className='mt-2 inline-flex items-center gap-1.5 border border-white/[0.12] bg-white/[0.03] px-2.5 py-1.5 font-mono text-[9px] font-bold uppercase tracking-brutal text-metallic-titanium transition-colors duration-150 hover:border-white/25 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40 disabled:cursor-not-allowed disabled:opacity-40'
                        >
                          <Trash2 size={11} aria-hidden='true' />
                          Quitar selecciones cerradas
                        </button>
                      </div>
                    </div>
                  </div>
                )}

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

                {promoSection}

                {/* Resumen + stake */}
                {activeTab === 'single' && selections.length > 1 ? (
                  <div className='shrink-0 border-t border-obsidian-border/70 px-4 py-3.5'>
                    <p className='flex items-start gap-2 text-[11px] leading-relaxed text-metallic-titanium'>
                      <ShieldCheck
                        size={13}
                        className='mt-0.5 shrink-0 text-metallic-slate'
                        aria-hidden='true'
                      />
                      Haz clic en cualquier cuota para añadir tu selección al boleto de apuestas.
                    </p>
                  </div>
                ) : (
                  <footer className='mt-auto shrink-0 border-t border-obsidian-border/70'>
                    <div data-tour='slip-summary'>
                      <div className='flex items-center justify-between px-4 py-3'>
                        <span className='text-[10px] font-bold uppercase tracking-brutal text-metallic-slate'>
                          {activeTab === 'combined' ? 'Cuota combinada' : 'Cuota total'}
                        </span>
                        <span className='font-odds text-2xl font-bold tabular-nums text-money'>
                          ×{formatDecimalOdds(totalOdds)}
                        </span>
                      </div>

                      <div className='flex items-center justify-between border-y border-obsidian-border/60 bg-linear-to-r from-money/10 via-transparent to-transparent px-4 py-3'>
                        <span className='inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-brutal text-money'>
                          <Coins size={12} aria-hidden='true' />
                          Ganancia potencial
                        </span>
                        <span className='font-odds text-xl font-extrabold tabular-nums text-money'>
                          {hasPayout ? formatMoney(potentialPayout) : '—'}
                        </span>
                      </div>
                      {appliedPromo && promoBonus > 0 ? (
                        <p className='border-b border-obsidian-border/60 bg-lime-400/[0.04] px-4 py-1.5 text-right font-mono text-[9px] uppercase tracking-wide text-lime-400'>
                          Incluye +{formatMoney(promoBonus)} de {appliedPromo.code}
                        </p>
                      ) : null}
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
                          className='pointer-events-none absolute inset-y-0 left-0 flex items-center border-r border-obsidian-border px-3 font-mono text-xs font-bold text-money'
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
                            if (event.key === 'Enter') handlePrimaryAction();
                          }}
                          disabled={isPlacingBet}
                          aria-invalid={Boolean(stakeError)}
                          aria-describedby={`${stakeInputId}-help`}
                          className={`w-full border bg-obsidian-void py-2.5 pl-12 pr-3 font-mono text-base font-bold tabular-nums text-white placeholder:text-metallic-slate focus:outline-none focus:ring-1 disabled:cursor-not-allowed disabled:opacity-60 ${
                            stakeError
                              ? 'border-crimson focus:ring-crimson'
                              : 'border-obsidian-border focus:border-electric focus:ring-electric/60'
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
                            className='border border-obsidian-border px-2 py-1 font-mono text-[10px] font-bold tabular-nums text-metallic-titanium transition-colors duration-150 hover:border-money/50 hover:text-money focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-electric disabled:cursor-not-allowed disabled:opacity-40'
                          >
                            +{formatCompact(increment)}
                          </button>
                        ))}
                        <button
                          type='button'
                          onClick={handleMax}
                          disabled={isPlacingBet}
                          className='border border-obsidian-border px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wide text-metallic-titanium transition-colors duration-150 hover:border-money/50 hover:text-money focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-electric disabled:cursor-not-allowed disabled:opacity-40'
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
                          Tu saldo registrado es menor al monto. Validaremos tu saldo antes de
                          confirmar la apuesta.
                        </p>
                      )}

                      <p
                        id={`${stakeInputId}-help`}
                        className='mt-2 text-[10px] leading-relaxed text-metallic-slate'
                      >
                        {hasPendingOdds
                          ? 'Acepta las nuevas cuotas para habilitar la confirmación.'
                          : 'La cuota total y la ganancia se recalculan antes de confirmar.'}
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
                            <p className='font-display text-[10px] font-bold uppercase tracking-wide text-crimson-200'>
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
                            Por ahora las apuestas se envían de una en una. Elige la cuota que
                            prefieras jugar.
                          </p>
                          <button
                            type='button'
                            onClick={() => handleTabChange('single')}
                            className='mt-2 inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase tracking-brutal text-odds-live transition-colors duration-150 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-electric'
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

                        <button
                          type='button'
                          data-tour='slip-submit'
                          onClick={handlePrimaryAction}
                          disabled={primaryDisabled}
                          aria-disabled={primaryDisabled}
                          aria-busy={isPlacingBet}
                          className={`mt-3.5 flex min-h-12 w-full items-center justify-center gap-2 px-4 py-3.5 font-display text-xs font-bold uppercase tracking-wide transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400/70 ${
                            isPlacingBet
                              ? 'cursor-wait bg-lime-500 text-[#0D0D0D] shadow-glow-lime'
                              : primaryDisabled
                                ? 'cursor-not-allowed border border-obsidian-border bg-obsidian-elevated text-metallic-slate'
                                : 'bg-lime-400 text-[#0D0D0D] shadow-glow-lime hover:bg-lime-500 active:translate-y-[1px]'
                          }`}
                        >
                          {isPlacingBet ? (
                            <>
                              <Loader2 size={15} className='animate-spin' aria-hidden='true' />
                              Confirmando…
                            </>
                          ) : hasClosedSelections ? (
                            <>
                              <LockKeyhole size={15} aria-hidden='true' />
                              {allClosedMarketSettled
                                ? 'Mercado cerrado'
                                : allClosedSuspended
                                  ? 'Combate suspendido'
                                  : 'Combate finalizado'}
                            </>
                          ) : !isAuthenticated ? (
                            <>
                              <LockKeyhole size={15} aria-hidden='true' />
                              Realizar apuesta
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

                        <p
                          className={`mt-2.5 text-center font-mono text-[9px] uppercase tracking-wide ${
                            !isAuthenticated ? 'text-electric/80' : 'text-metallic-slate'
                          }`}
                        >
                          {hasClosedSelections
                            ? 'Quita las selecciones cerradas para apostar'
                            : !isAuthenticated
                              ? 'Tu selección se conserva al iniciar sesión'
                              : 'Las cuotas pueden variar hasta que confirmes tu apuesta'}
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

      {tourEnabled && tourOpen && <BetSlipTour onClose={closeTour} />}
    </aside>
  );
}
