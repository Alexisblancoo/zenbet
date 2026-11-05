import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Banknote,
  Check,
  Loader2,
  ShieldAlert,
} from 'lucide-react';

import { useAuth } from '@/context/authState';
import { formatWalletMoney } from '@/domain/wallet';
import { walletService, type CashOutResult } from '@/services/walletService';
import {
  MARKET_SUSPENDED_BY_RISK_EVENT,
  type MarketSuspendedByRiskEventDto,
} from '@/types/risk';

export interface CashOutButtonProps {
  /** Identificador de la apuesta a liquidar anticipadamente */
  readonly betId: string;
  /** Monto monetario ofrecido para el Cash Out */
  readonly cashOutValue: number;
  /** Disponibilidad del Cash Out según el estado y tipo de apuesta */
  readonly cashOutAvailable: boolean;
  /** Suspensión activa por Circuit Breaker (Risk & Liability Engine) */
  readonly isSuspendedByRisk?: boolean;
  /** Identificador opcional del mercado para suscripción reactiva al Circuit Breaker */
  readonly marketId?: string;
  /** Callback opcional ejecutado al confirmar el cobro exitoso */
  readonly onSuccess?: (payout: number, result: CashOutResult) => void;
  /** Callback opcional ejecutado en caso de error en la liquidación */
  readonly onError?: (error: Error) => void;
  /** Clases CSS adicionales */
  readonly className?: string;
  /** Variante compacta para listas densas */
  readonly compact?: boolean;
}

/**
 * Dispara una respuesta háptica sutil si el dispositivo lo soporta.
 */
function triggerHapticFeedback(): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([15, 30, 20]);
    } catch {
      // Ignorar si el navegador bloquea la vibración sin interacción previa
    }
  }
}

/**
 * Botón reactivo de "Cash Out" con actualización optimista de saldo,
 * feedback háptico, estados de carga y bloqueo reactivo ante Circuit Breaker.
 */
export function CashOutButton({
  betId,
  cashOutValue,
  cashOutAvailable,
  isSuspendedByRisk = false,
  marketId,
  onSuccess,
  onError,
  className = '',
  compact = false,
}: CashOutButtonProps) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [riskSuspendedLive, setRiskSuspendedLive] = useState(false);

  // Escuchar eventos en vivo del Circuit Breaker (SignalR / Telemetría)
  useEffect(() => {
    function handleMarketSuspension(event: Event) {
      const customEvent = event as CustomEvent<MarketSuspendedByRiskEventDto>;
      if (!customEvent.detail) return;

      // Si coincide con el marketId de esta apuesta, suspender inmediatamente
      if (!marketId || customEvent.detail.marketId === marketId) {
        setRiskSuspendedLive(true);
      }
    }

    window.addEventListener(MARKET_SUSPENDED_BY_RISK_EVENT, handleMarketSuspension);
    return () => {
      window.removeEventListener(MARKET_SUSPENDED_BY_RISK_EVENT, handleMarketSuspension);
    };
  }, [marketId]);

  const suspended = isSuspendedByRisk || riskSuspendedLive;
  const isActionable = cashOutAvailable && !suspended && cashOutValue > 0 && !isLoading && !isSuccess;

  const handleCashOut = useCallback(async () => {
    if (!isActionable) return;

    triggerHapticFeedback();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const result = await walletService.executeCashOut({
        betId,
        amount: cashOutValue,
        currentBalance: user?.walletBalance,
      });

      setIsSuccess(true);
      triggerHapticFeedback();
      onSuccess?.(cashOutValue, result);
    } catch (err: unknown) {
      const parsedError =
        err instanceof Error ? err : new Error('No se pudo procesar el Cash Out.');
      setErrorMessage(parsedError.message);
      onError?.(parsedError);
    } finally {
      setIsLoading(false);
    }
  }, [isActionable, betId, cashOutValue, user?.walletBalance, onSuccess, onError]);

  // Si está suspendido por Circuit Breaker
  if (suspended) {
    return (
      <div
        className='relative inline-block w-full'
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
      >
        <button
          type='button'
          disabled
          aria-disabled='true'
          aria-describedby={`tooltip-suspended-${betId}`}
          className={`group flex w-full items-center justify-between gap-2 rounded-sm border border-odds-down/30 bg-[#14080A] px-3.5 py-2 font-mono text-xs font-bold text-metallic-slate opacity-75 cursor-not-allowed select-none transition-all duration-200 ${className}`}
        >
          <span className='flex items-center gap-1.5 text-odds-down'>
            <ShieldAlert size={14} className='shrink-0' aria-hidden='true' />
            <span className='font-display text-[10px] uppercase tracking-wider'>
              Mercado Suspendido
            </span>
          </span>
          <span className='font-mono text-[11px] tabular-nums text-metallic-slate'>
            {formatWalletMoney(cashOutValue)}
          </span>
        </button>

        {/* Tooltip flotante de advertencia */}
        {showTooltip && (
          <div
            id={`tooltip-suspended-${betId}`}
            role='tooltip'
            className='pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-sm border border-odds-down/40 bg-[#0A0506] px-3 py-1.5 shadow-[0_10px_25px_-5px_rgba(255,59,48,0.3)] animate-in fade-in duration-150'
          >
            <div className='flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase text-odds-down'>
              <ShieldAlert size={12} aria-hidden='true' />
              <span>Circuit Breaker Activo</span>
            </div>
            <p className='mt-0.5 font-sans text-[9px] text-metallic-titanium'>
              Límite de riesgo alcanzado. El cobro anticipado está bloqueado temporalmente.
            </p>
            <span
              aria-hidden='true'
              className='absolute -bottom-1 left-1/2 -translate-x-1/2 border-x-4 border-t-4 border-x-transparent border-t-odds-down/40'
            />
          </div>
        )}
      </div>
    );
  }

  // Si no está disponible
  if (!cashOutAvailable || cashOutValue <= 0) {
    return (
      <div
        className='relative inline-block w-full'
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <button
          type='button'
          disabled
          aria-disabled='true'
          className={`flex w-full items-center justify-between gap-2 rounded-sm border border-white/[0.08] bg-[#0A0A0A] px-3.5 py-2 font-mono text-xs font-semibold text-metallic-slate opacity-50 cursor-not-allowed select-none ${className}`}
        >
          <span className='font-display text-[10px] uppercase tracking-wider text-metallic-titanium'>
            Cash Out no disponible
          </span>
          <span className='font-mono text-[11px] tabular-nums text-metallic-slate'>—</span>
        </button>
      </div>
    );
  }

  // Estado de éxito tras liquidación
  if (isSuccess) {
    return (
      <div
        className={`flex w-full items-center justify-between gap-2 rounded-sm border border-lime-400/50 bg-lime-400/10 px-3.5 py-2 font-mono text-xs font-bold text-lime-400 animate-in fade-in zoom-in-95 duration-200 ${className}`}
      >
        <span className='flex items-center gap-1.5 font-display text-[11px] uppercase tracking-wider text-lime-400'>
          <Check size={14} className='shrink-0 stroke-[3]' aria-hidden='true' />
          ¡Cobrado con éxito!
        </span>
        <span className='font-mono text-xs font-extrabold tabular-nums text-white'>
          +{formatWalletMoney(cashOutValue)}
        </span>
      </div>
    );
  }

  return (
    <div className='relative w-full'>
      <button
        type='button'
        onClick={handleCashOut}
        disabled={isLoading}
        aria-busy={isLoading}
        aria-label={`Cobrar apuesta anticipadamente por ${formatWalletMoney(cashOutValue)}`}
        className={`group relative flex w-full items-center justify-between gap-3 overflow-hidden rounded-sm border border-lime-400 bg-lime-400 px-3.5 py-2 font-display text-[11px] font-black uppercase tracking-wider text-[#050505] shadow-[0_0_24px_rgba(212,255,63,0.22)] transition-all duration-150 hover:bg-[#c6f827] hover:shadow-[0_0_30px_rgba(212,255,63,0.35)] active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400/60 disabled:cursor-wait disabled:opacity-85 ${
          compact ? 'py-1.5 text-[10px]' : ''
        } ${className}`}
      >
        {/* Efecto de destello al interactuar */}
        <span
          aria-hidden='true'
          className='pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full'
        />

        <div className='flex items-center gap-1.5'>
          {isLoading ? (
            <Loader2 size={13} className='animate-spin text-[#050505]' aria-hidden='true' />
          ) : (
            <Banknote size={14} className='text-[#050505]' aria-hidden='true' />
          )}
          <span className='font-extrabold'>
            {isLoading ? 'Liquidando...' : 'Cash Out'}
          </span>
        </div>

        <div className='flex items-center gap-1.5'>
          <span className='font-mono text-xs font-black tabular-nums tracking-normal text-[#050505]'>
            {formatWalletMoney(cashOutValue)}
          </span>
        </div>
      </button>

      {/* Mensaje de error transitorio si la llamada falla */}
      {errorMessage && (
        <div
          role='alert'
          className='mt-2 flex items-center gap-1.5 rounded-sm border border-odds-down/40 bg-odds-down/10 px-2.5 py-1 font-mono text-[9px] text-odds-down'
        >
          <AlertCircle size={11} className='shrink-0' aria-hidden='true' />
          <span className='truncate'>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}

export default CashOutButton;

