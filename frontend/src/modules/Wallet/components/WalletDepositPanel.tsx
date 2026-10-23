import { useId, useState, type FormEvent } from 'react';
import {
  ArrowDownToLine,
  CheckCircle2,
  Info,
  Loader2,
  TriangleAlert,
  Wallet,
} from 'lucide-react';

import { BALANCE_UPDATED_EVENT } from '@/context/authState';
import { formatWalletMoney } from '@/domain/wallet';
import { walletService, type WalletDepositResult } from '@/services/walletService';

const MIN_DEPOSIT = 1;
const MAX_DEPOSIT = 10_000;
const AMOUNT_PRESETS = [10, 25, 50, 100] as const;

const METHODS = [
  { value: 'card', label: 'Tarjeta' },
  { value: 'crypto', label: 'Cripto' },
  { value: 'transfer', label: 'Transferencia' },
] as const;

type DepositMethod = (typeof METHODS)[number]['value'];

interface WalletDepositPanelProps {
  readonly onDeposited?: (newBalance: number) => void;
  readonly className?: string;
}

/**
 * Recarga de la billetera autenticada. En desarrollo el abono se aplica de
 * inmediato; la pasarela de pago real no forma parte de este entorno.
 */
export function WalletDepositPanel({
  onDeposited,
  className = '',
}: WalletDepositPanelProps) {
  const inputId = useId();
  const [amount, setAmount] = useState('25');
  const [method, setMethod] = useState<DepositMethod>('card');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<WalletDepositResult | null>(null);

  const parsedAmount = Number.parseFloat(amount);
  const isValidAmount =
    Number.isFinite(parsedAmount) &&
    parsedAmount >= MIN_DEPOSIT &&
    parsedAmount <= MAX_DEPOSIT;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isValidAmount || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    setReceipt(null);

    try {
      const result = await walletService.deposit(parsedAmount, method);

      setReceipt(result);
      setAmount('');
      window.dispatchEvent(
        new CustomEvent(BALANCE_UPDATED_EVENT, { detail: result.newBalance }),
      );
      onDeposited?.(result.newBalance);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'No pudimos procesar la recarga. Inténtalo de nuevo.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section
      aria-labelledby='wallet-deposit-title'
      className={`glass-panel relative overflow-hidden p-5 sm:p-6 ${className}`}
    >
      <div aria-hidden='true' className='pointer-events-none absolute inset-0'>
        <div className='absolute -right-24 -top-28 h-56 w-56 rounded-full bg-[#D4AF37]/[0.07] blur-3xl' />
        <div className='absolute -bottom-24 left-1/4 h-48 w-48 rounded-full bg-money/[0.07] blur-3xl' />
      </div>

      <div className='relative'>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div>
            <div className='inline-flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-ultra text-metallic-titanium'>
              <span className='grid h-5 w-5 place-items-center rounded-sm border border-[#D4AF37]/30 bg-[#D4AF37]/[0.06] text-[#FFD700]'>
                <ArrowDownToLine size={11} aria-hidden='true' />
              </span>
              <h2 id='wallet-deposit-title'>Recargar saldo</h2>
            </div>
            <p className='mt-2 max-w-xl text-[11px] leading-relaxed text-metallic-titanium'>
              Suma saldo a tu billetera para apostar. El movimiento queda registrado
              en tu historial.
            </p>
          </div>
          <span className='inline-flex items-center gap-1.5 rounded-sm border border-money/25 bg-money/[0.045] px-2 py-1 font-mono text-[8px] font-bold uppercase tracking-brutal text-money'>
            <Wallet size={10} aria-hidden='true' />
            Depósito
          </span>
        </div>

        <form onSubmit={handleSubmit} className='mt-5' noValidate>
          <div className='grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end'>
            <div>
              <label
                htmlFor={inputId}
                className='mb-1.5 block font-mono text-[9px] font-bold uppercase tracking-wide text-metallic-slate'
              >
                Monto a recargar
              </label>
              <div className='relative'>
                <span
                  aria-hidden='true'
                  className='pointer-events-none absolute inset-y-0 left-0 grid w-10 place-items-center border-r border-white/[0.08] font-mono text-sm font-bold text-[#FFD700]'
                >
                  $
                </span>
                <input
                  id={inputId}
                  type='number'
                  inputMode='decimal'
                  min={MIN_DEPOSIT}
                  max={MAX_DEPOSIT}
                  step='0.01'
                  value={amount}
                  onChange={(event) => {
                    setAmount(event.target.value);
                    setError(null);
                    setReceipt(null);
                  }}
                  placeholder='25.00'
                  aria-describedby={`${inputId}-hint`}
                  aria-invalid={!isValidAmount && amount.length > 0}
                  className='h-11 w-full border border-white/[0.1] bg-[#07090E]/80 pl-12 pr-16 font-mono text-sm font-bold text-white outline-none transition-colors placeholder:text-metallic-slate/60 focus:border-[#D4AF37]/55 focus:ring-1 focus:ring-[#D4AF37]/25'
                />
                <span
                  aria-hidden='true'
                  className='pointer-events-none absolute inset-y-0 right-0 grid w-14 place-items-center border-l border-white/[0.08] font-mono text-[9px] font-bold uppercase tracking-wide text-metallic-slate'
                >
                  USD
                </span>
              </div>
              <p
                id={`${inputId}-hint`}
                className='mt-1.5 font-mono text-[9px] text-metallic-slate'
              >
                Mínimo {formatWalletMoney(MIN_DEPOSIT)} · máximo{' '}
                {formatWalletMoney(MAX_DEPOSIT)}
              </p>
            </div>

            <div>
              <span className='mb-1.5 block font-mono text-[9px] font-bold uppercase tracking-wide text-metallic-slate'>
                Montos rápidos
              </span>
              <div className='flex flex-wrap gap-1.5'>
                {AMOUNT_PRESETS.map((preset) => {
                  const isSelected = parsedAmount === preset;

                  return (
                    <button
                      key={preset}
                      type='button'
                      aria-pressed={isSelected}
                      onClick={() => {
                        setAmount(String(preset));
                        setError(null);
                        setReceipt(null);
                      }}
                      className={`h-11 min-w-14 border px-3 font-mono text-[11px] font-bold tabular-nums transition-colors ${
                        isSelected
                          ? 'border-[#D4AF37]/60 bg-[#D4AF37]/[0.1] text-[#FFD700]'
                          : 'border-white/[0.1] bg-white/[0.02] text-metallic-platinum hover:border-[#D4AF37]/40 hover:text-white'
                      }`}
                    >
                      ${preset}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <fieldset className='mt-4'>
            <legend className='mb-1.5 font-mono text-[9px] font-bold uppercase tracking-wide text-metallic-slate'>
              Método de recarga
            </legend>
            <div className='flex flex-wrap gap-1.5'>
              {METHODS.map((option) => {
                const isSelected = method === option.value;

                return (
                  <button
                    key={option.value}
                    type='button'
                    aria-pressed={isSelected}
                    onClick={() => {
                      setMethod(option.value);
                      setError(null);
                      setReceipt(null);
                    }}
                    className={`border px-3 py-2 font-display text-[10px] font-bold uppercase tracking-wide transition-colors ${
                      isSelected
                        ? 'border-money/45 bg-money/[0.08] text-money'
                        : 'border-white/[0.1] bg-white/[0.02] text-metallic-titanium hover:border-white/25 hover:text-white'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className='mt-5 flex flex-col gap-3 border-t border-obsidian-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between'>
            <p className='flex max-w-xl items-start gap-2 text-[10px] leading-relaxed text-metallic-slate'>
              <Info size={12} className='mt-0.5 shrink-0 text-[#D4AF37]' aria-hidden='true' />
              En este entorno la recarga se acredita de inmediato y no procesa un pago
              real.
            </p>
            <button
              type='submit'
              disabled={!isValidAmount || isSubmitting}
              className='inline-flex min-h-10 items-center justify-center gap-2 rounded-sm border border-[#D4AF37]/55 bg-[#D4AF37]/[0.1] px-4 py-2 font-display text-[10px] font-bold uppercase tracking-wide text-[#FFD700] transition-colors hover:bg-[#D4AF37]/[0.16] disabled:cursor-not-allowed disabled:opacity-45 sm:shrink-0'
            >
              {isSubmitting ? (
                <Loader2 size={12} className='animate-spin' aria-hidden='true' />
              ) : (
                <ArrowDownToLine size={12} aria-hidden='true' />
              )}
              {isSubmitting ? 'Procesando' : 'Recargar saldo'}
            </button>
          </div>
        </form>

        <div aria-live='polite' className='mt-3 empty:hidden'>
          {receipt ? (
            <p className='flex items-start gap-2 border border-money/25 bg-money/[0.045] px-3 py-2 text-[11px] leading-relaxed text-money'>
              <CheckCircle2 size={13} className='mt-0.5 shrink-0' aria-hidden='true' />
              Recarga acreditada. Nuevo saldo: {formatWalletMoney(receipt.newBalance)}.
            </p>
          ) : null}
          {error ? (
            <p className='flex items-start gap-2 border border-odds-down/25 bg-odds-down/[0.045] px-3 py-2 text-[11px] leading-relaxed text-odds-down'>
              <TriangleAlert size={13} className='mt-0.5 shrink-0' aria-hidden='true' />
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
