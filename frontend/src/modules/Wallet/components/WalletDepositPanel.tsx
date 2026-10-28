import { useEffect, useId, useState, type FormEvent } from 'react';
import {
  ArrowDownToLine,
  Check,
  Clock3,
  Coins,
  Copy,
  Info,
  Landmark,
  Loader2,
  QrCode,
  TriangleAlert,
  X,
} from 'lucide-react';
import QRCode from 'qrcode';

import { createIdempotencyKey } from '@/api';
import { formatRelativeTime } from '@/domain/wallet';
import {
  getCachedPendingDeposits,
  walletService,
  type WalletDepositMethod,
  type WalletDepositRequestResult,
  type WalletPendingDeposit,
} from '@/services/walletService';

/** Límites por solicitud (los valida también el backend: 1…10 000). */
const MAX_DEPOSIT = 10_000;
const MIN_BY_METHOD: Record<WalletDepositMethod, number> = {
  qr_transfer: 10,
  usdt: 5,
};

const AMOUNT_PRESETS: Record<WalletDepositMethod, readonly number[]> = {
  qr_transfer: [10, 20, 50, 100],
  usdt: [5, 10, 20, 50],
};

/** Cuenta corporativa de recepción (datos fijos de la casa). */
const BOB_ACCOUNT = {
  bank: 'Banco Giro Zenbet',
  account: '10000045678',
  beneficiary: 'Zenbet Bolivia S.A.',
  nit: '10234567890',
} as const;

const USDT_ADDRESS = 'TQn9Y2khDD95J42FQtQTdwVVRZq5uZsVf3';
const USDT_NETWORK = 'TRON (TRC20)';

const METHOD_OPTIONS: readonly {
  value: WalletDepositMethod;
  label: string;
  hint: string;
}[] = [
  { value: 'qr_transfer', label: 'QR / Transferencia', hint: 'Bolivianos (Bs)' },
  { value: 'usdt', label: 'Cripto', hint: 'USDT · TRC20' },
];

interface WalletDepositPanelProps {
  /** La solicitud quedó en revisión: el padre puede refrescar su snapshot. */
  readonly onSubmitted?: () => void;
  readonly className?: string;
}

function formatDepositMoney(amount: number, method: WalletDepositMethod): string {
  const value = amount.toFixed(2);
  return method === 'usdt' ? `${value} USDT` : `Bs ${value}`;
}

/**
 * Depósito con verificación real: el jugador envía monto + número de
 * comprobante y la solicitud queda EN REVISIÓN. El saldo se acredita cuando
 * administración aprueba el pago y el hub de wallet empuja el nuevo saldo.
 */
export function WalletDepositPanel({
  onSubmitted,
  className = '',
}: WalletDepositPanelProps) {
  const amountId = useId();
  const referenceId = useId();

  const [method, setMethod] = useState<WalletDepositMethod>('qr_transfer');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<WalletDepositRequestResult | null>(null);

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrFailed, setQrFailed] = useState(false);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [pending, setPending] = useState<readonly WalletPendingDeposit[] | null>(() => getCachedPendingDeposits());
  const [pendingReload, setPendingReload] = useState(0);

  const parsedAmount = Number.parseFloat(amount);
  const minDeposit = MIN_BY_METHOD[method];
  const isValidAmount =
    Number.isFinite(parsedAmount) &&
    parsedAmount >= minDeposit &&
    parsedAmount <= MAX_DEPOSIT;
  const isValidReference = reference.trim().length >= 4 && reference.trim().length <= 100;
  const canSubmit = isValidAmount && isValidReference && !isSubmitting;

  // QR del canal elegido; se regenera con el monto para que el cajero lo lea
  // con el importe exacto. Módulos oscuros sobre papel claro: legible en físico.
  useEffect(() => {
    let cancelled = false;
    const qrAmount = Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : 0;
    const payload =
      method === 'usdt'
        ? USDT_ADDRESS
        : [
            'ZENBET-DEPOSITO',
            `BANCO:${BOB_ACCOUNT.bank}`,
            `CUENTA:${BOB_ACCOUNT.account}`,
            `BENEFICIARIO:${BOB_ACCOUNT.beneficiary}`,
            qrAmount > 0 ? `MONTO:${qrAmount.toFixed(2)} Bs` : 'MONTO:0.00 Bs',
          ].join('|');

    QRCode.toDataURL(payload, {
      margin: 1,
      width: 320,
      errorCorrectionLevel: 'M',
      color: { dark: '#0D0D0Dff', light: '#E8E8E8ff' },
    })
      .then((url) => {
        if (cancelled) return;
        setQrDataUrl(url);
        setQrFailed(false);
      })
      .catch(() => {
        if (cancelled) return;
        setQrDataUrl(null);
        setQrFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [method, parsedAmount]);

  // Cola propia en revisión (se recarga tras cada envío).
  useEffect(() => {
    const controller = new AbortController();

    walletService
      .listPendingDeposits(controller.signal)
      .then((deposits) => {
        if (!controller.signal.aborted) setPending(deposits);
      })
      .catch(() => {
        if (!controller.signal.aborted) setPending([]);
      });

    return () => controller.abort();
  }, [pendingReload]);

  const copyValue = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), 1_600);
    } catch {
      // Sin permiso de portapapeles: los datos siguen visibles para copiar a mano.
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSubmit) return;

    setIsSubmitting(true);
    setError(null);
    setConfirmation(null);

    const idempotencyKey = createIdempotencyKey();
    const optimisticPending: WalletPendingDeposit = {
      transactionId: `temp-${idempotencyKey.slice(0, 8)}`,
      amount: parsedAmount,
      method,
      reference: reference.trim(),
      createdAt: new Date().toISOString(),
    };

    // Actualización optimista instantánea en la cola visible
    setPending((prev) => [optimisticPending, ...(prev ?? [])]);

    try {
      const result = await walletService.requestDeposit(
        parsedAmount,
        method,
        reference.trim(),
        idempotencyKey,
      );

      setConfirmation(result);
      setAmount('');
      setReference('');
      setPendingReload((value) => value + 1);
      onSubmitted?.();
    } catch (caught) {
      // Revertir optimistic si la llamada fue rechazada
      setPending((prev) =>
        prev ? prev.filter((item) => item.transactionId !== optimisticPending.transactionId) : prev,
      );
      setError(
        caught instanceof Error
          ? caught.message
          : 'No pudimos registrar la solicitud. Inténtalo de nuevo.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const currencySuffix = method === 'usdt' ? 'USDT' : 'Bs';
  const accountRows: readonly { key: string; label: string; value: string }[] =
    method === 'usdt'
      ? [
          { key: 'address', label: 'Dirección USDT', value: USDT_ADDRESS },
          { key: 'network', label: 'Red', value: USDT_NETWORK },
        ]
      : [
          { key: 'bank', label: 'Banco', value: BOB_ACCOUNT.bank },
          { key: 'account', label: 'Cuenta corriente', value: BOB_ACCOUNT.account },
          { key: 'beneficiary', label: 'Beneficiario', value: BOB_ACCOUNT.beneficiary },
          { key: 'nit', label: 'NIT', value: BOB_ACCOUNT.nit },
        ];

  return (
    <section
      aria-labelledby='wallet-deposit-title'
      className={`glass-panel relative overflow-hidden p-5 sm:p-6 ${className}`}
    >
      <div aria-hidden='true' className='pointer-events-none absolute inset-0'>
        <div className='absolute -right-24 -top-28 h-56 w-56 rounded-full bg-lime-400/[0.07] blur-3xl' />
        <div className='absolute -bottom-24 left-1/4 h-48 w-48 rounded-full bg-money/[0.07] blur-3xl' />
      </div>

      <div className='relative'>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div>
            <div className='inline-flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-ultra text-metallic-titanium'>
              <span className='grid h-5 w-5 place-items-center rounded-sm border border-lime-400/30 bg-lime-400/[0.06] text-lime-400'>
                <ArrowDownToLine size={11} aria-hidden='true' />
              </span>
              <h2 id='wallet-deposit-title'>Depositar saldo</h2>
            </div>
            <p className='mt-2 max-w-xl text-[11px] leading-relaxed text-metallic-titanium'>
              Envía tu pago con QR, transferencia bancaria (Bs) o USDT y registra el
              número de comprobante. Administración verifica y acredita tu saldo en vivo.
            </p>
          </div>
          <span className='inline-flex items-center gap-1.5 rounded-sm border border-money/25 bg-money/[0.045] px-2 py-1 font-mono text-[8px] font-bold uppercase tracking-brutal text-money'>
            <Clock3 size={10} aria-hidden='true' />
            Revisión admin
          </span>
        </div>

        <form onSubmit={handleSubmit} className='mt-5' noValidate>
          {/* Método */}
          <fieldset>
            <legend className='mb-1.5 font-mono text-[9px] font-bold uppercase tracking-wide text-metallic-slate'>
              Método de depósito
            </legend>
            <div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
              {METHOD_OPTIONS.map((option) => {
                const isSelected = method === option.value;
                const OptionIcon = option.value === 'usdt' ? Coins : QrCode;

                return (
                  <button
                    key={option.value}
                    type='button'
                    aria-pressed={isSelected}
                    onClick={() => {
                      setMethod(option.value);
                      setError(null);
                      setConfirmation(null);
                    }}
                    className={`flex items-center gap-3 border px-3 py-2.5 text-left transition-colors ${
                      isSelected
                        ? 'border-lime-400/55 bg-lime-400/[0.08]'
                        : 'border-white/[0.1] bg-white/[0.02] hover:border-white/25'
                    }`}
                  >
                    <span
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-sm border font-mono ${
                        isSelected
                          ? 'border-lime-400/40 bg-lime-400/10 text-lime-400'
                          : 'border-white/10 bg-white/[0.03] text-metallic-titanium'
                      }`}
                    >
                      <OptionIcon size={14} aria-hidden='true' />
                    </span>
                    <span className='min-w-0'>
                      <span
                        className={`block truncate font-display text-[11px] font-bold uppercase tracking-wide ${
                          isSelected ? 'text-white' : 'text-metallic-platinum'
                        }`}
                      >
                        {option.label}
                      </span>
                      <span className='block truncate font-mono text-[9px] uppercase tracking-wide text-metallic-slate'>
                        {option.hint}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* Monto + rápidos */}
          <div className='mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end'>
            <div>
              <label
                htmlFor={amountId}
                className='mb-1.5 block font-mono text-[9px] font-bold uppercase tracking-wide text-metallic-slate'
              >
                Monto a depositar
              </label>
              <div className='relative'>
                <span
                  aria-hidden='true'
                  className='pointer-events-none absolute inset-y-0 left-0 grid w-10 place-items-center border-r border-white/[0.08] font-mono text-sm font-bold text-lime-400'
                >
                  {method === 'usdt' ? '₮' : 'Bs'}
                </span>
                <input
                  id={amountId}
                  type='number'
                  inputMode='decimal'
                  min={minDeposit}
                  max={MAX_DEPOSIT}
                  step='0.01'
                  value={amount}
                  onChange={(event) => {
                    setAmount(event.target.value);
                    setError(null);
                    setConfirmation(null);
                  }}
                  placeholder={method === 'usdt' ? '10.00' : '20.00'}
                  aria-describedby={`${amountId}-hint`}
                  aria-invalid={!isValidAmount && amount.length > 0}
                  className='h-11 w-full border border-white/[0.1] bg-[#0D0D0D]/80 pl-12 pr-16 font-mono text-sm font-bold text-white outline-none transition-colors placeholder:text-metallic-slate/60 focus:border-lime-400/55 focus:ring-1 focus:ring-lime-400/25'
                />
                <span
                  aria-hidden='true'
                  className='pointer-events-none absolute inset-y-0 right-0 grid w-14 place-items-center border-l border-white/[0.08] font-mono text-[9px] font-bold uppercase tracking-wide text-metallic-slate'
                >
                  {currencySuffix}
                </span>
              </div>
              <p
                id={`${amountId}-hint`}
                className='mt-1.5 font-mono text-[9px] text-metallic-slate'
              >
                Mínimo {formatDepositMoney(minDeposit, method)} · máximo{' '}
                {formatDepositMoney(MAX_DEPOSIT, method)}
              </p>
            </div>

            <div>
              <span className='mb-1.5 block font-mono text-[9px] font-bold uppercase tracking-wide text-metallic-slate'>
                Montos rápidos
              </span>
              <div className='flex flex-wrap gap-1.5'>
                {AMOUNT_PRESETS[method].map((preset) => {
                  const isSelected = parsedAmount === preset;

                  return (
                    <button
                      key={preset}
                      type='button'
                      aria-pressed={isSelected}
                      onClick={() => {
                        setAmount(String(preset));
                        setError(null);
                        setConfirmation(null);
                      }}
                      className={`h-11 min-w-14 border px-3 font-mono text-[11px] font-bold tabular-nums transition-colors ${
                        isSelected
                          ? 'border-lime-400/60 bg-lime-400/[0.1] text-lime-400'
                          : 'border-white/[0.1] bg-white/[0.02] text-metallic-platinum hover:border-lime-400/40 hover:text-white'
                      }`}
                    >
                      {method === 'usdt' ? `${preset}₮` : `${preset} Bs`}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Canal de pago: QR + datos de cuenta */}
          <div className='mt-5 border border-white/[0.08] bg-[#0A0A0A]/80'>
            <div className='grid gap-4 p-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start'>
              <div className='mx-auto w-fit sm:mx-0'>
                <div className='grid h-36 w-36 place-items-center border border-white/10 bg-[#E8E8E8]'>
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt={
                        method === 'usdt'
                          ? `Código QR con la dirección USDT ${USDT_ADDRESS}`
                          : `Código QR de depósito a la cuenta ${BOB_ACCOUNT.account} de ${BOB_ACCOUNT.beneficiary}`
                      }
                      width={128}
                      height={128}
                      className='h-32 w-32'
                    />
                  ) : qrFailed ? (
                    <span className='grid place-items-center gap-1 px-3 text-center font-mono text-[8px] uppercase tracking-wide text-[#0D0D0D]'>
                      <TriangleAlert size={14} aria-hidden='true' />
                      QR no disponible
                    </span>
                  ) : (
                    <Loader2
                      size={16}
                      className='animate-spin text-[#0D0D0D]/60'
                      aria-hidden='true'
                    />
                  )}
                </div>
                <p className='mt-1.5 text-center font-mono text-[8px] uppercase tracking-brutal text-metallic-slate'>
                  {method === 'usdt' ? 'Escanea la dirección' : 'Escanea para pagar'}
                </p>
              </div>

              <div className='min-w-0'>
                <p className='mb-2 inline-flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-wide text-metallic-titanium'>
                  {method === 'usdt' ? (
                    <Coins size={11} className='text-lime-400' aria-hidden='true' />
                  ) : (
                    <Landmark size={11} className='text-lime-400' aria-hidden='true' />
                  )}
                  {method === 'usdt' ? 'Datos de la wallet' : 'Datos de la cuenta'}
                </p>
                <dl className='divide-y divide-white/[0.06] border border-white/[0.06]'>
                  {accountRows.map((row) => (
                    <div
                      key={row.key}
                      className='flex items-center justify-between gap-2 px-2.5 py-2'
                    >
                      <dt className='shrink-0 font-mono text-[9px] uppercase tracking-wide text-metallic-slate'>
                        {row.label}
                      </dt>
                      <dd className='flex min-w-0 items-center gap-1.5'>
                        <span
                          className={`truncate font-mono text-[11px] font-bold text-white ${
                            row.key === 'account' || row.key === 'address'
                              ? 'tabular-nums tracking-tight'
                              : ''
                          }`}
                        >
                          {row.value}
                        </span>
                        <button
                          type='button'
                          onClick={() => void copyValue(row.key, row.value)}
                          aria-label={`Copiar ${row.label}: ${row.value}`}
                          className='shrink-0 border border-white/10 p-1 text-metallic-titanium transition-colors hover:border-lime-400/50 hover:text-lime-400'
                        >
                          {copiedKey === row.key ? (
                            <Check size={10} className='text-money' aria-hidden='true' />
                          ) : (
                            <Copy size={10} aria-hidden='true' />
                          )}
                        </button>
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className='mt-2 font-mono text-[8px] uppercase tracking-wide text-metallic-slate'>
                  {method === 'usdt'
                    ? 'Envía solo USDT por la red indicada; otra red pierde el fondo.'
                    : 'Paga con QR bancario o transferencia a la cuenta corriente.'}
                </p>
              </div>
            </div>
          </div>

          {/* Comprobante obligatorio */}
          <div className='mt-4'>
            <label
              htmlFor={referenceId}
              className='mb-1.5 block font-mono text-[9px] font-bold uppercase tracking-wide text-metallic-slate'
            >
              Número de comprobante / Referencia de transferencia{' '}
              <span aria-hidden='true' className='text-lime-400'>
                *
              </span>
            </label>
            <input
              id={referenceId}
              type='text'
              required
              value={reference}
              onChange={(event) => {
                setReference(event.target.value);
                setError(null);
                setConfirmation(null);
              }}
              placeholder='Ej. 000123456789 o hash de la transacción'
              aria-describedby={`${referenceId}-hint`}
              aria-invalid={reference.length > 0 && !isValidReference}
              autoComplete='off'
              maxLength={100}
              className='h-11 w-full border border-white/[0.1] bg-[#0D0D0D]/80 px-3 font-mono text-sm font-bold text-white outline-none transition-colors placeholder:text-metallic-slate/60 focus:border-lime-400/55 focus:ring-1 focus:ring-lime-400/25'
            />
            <p
              id={`${referenceId}-hint`}
              className='mt-1.5 font-mono text-[9px] text-metallic-slate'
            >
              Copia el número que imprime tu banco o la wallet; sin él no podemos
              verificar el pago.
            </p>
          </div>

          <div className='mt-5 flex flex-col gap-3 border-t border-obsidian-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between'>
            <p className='flex max-w-xl items-start gap-2 text-[10px] leading-relaxed text-metallic-slate'>
              <Info size={12} className='mt-0.5 shrink-0 text-lime-400' aria-hidden='true' />
              Tu saldo se acredita cuando administración verifica el pago. Recibirás el
              aviso en vivo en esta pantalla.
            </p>
            <button
              type='submit'
              disabled={!canSubmit}
              className='inline-flex min-h-10 items-center justify-center gap-2 rounded-sm border border-lime-400 bg-lime-400 px-4 py-2 font-display text-[10px] font-bold uppercase tracking-wide text-[#0D0D0D] transition-colors hover:bg-lime-500 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.06] disabled:text-metallic-slate sm:shrink-0'
            >
              {isSubmitting ? (
                <Loader2 size={12} className='animate-spin' aria-hidden='true' />
              ) : (
                <ArrowDownToLine size={12} aria-hidden='true' />
              )}
              {isSubmitting ? 'Enviando' : 'Enviar solicitud de depósito'}
            </button>
          </div>
        </form>

        <div aria-live='polite' className='mt-3 empty:hidden'>
          {confirmation ? (
            <div className='relative border border-money/30 bg-money/[0.05] px-4 py-3'>
              <button
                type='button'
                onClick={() => setConfirmation(null)}
                aria-label='Cerrar confirmación'
                className='absolute right-2 top-2 border border-transparent p-1 text-money/70 transition-colors hover:border-money/30 hover:text-money'
              >
                <X size={12} aria-hidden='true' />
              </button>
              <p className='flex items-center gap-2 font-display text-[11px] font-bold uppercase tracking-wide text-money'>
                <Clock3 size={13} className='shrink-0' aria-hidden='true' />
                Depósito en revisión
              </p>
              <p className='mt-1.5 text-[11px] leading-relaxed text-metallic-platinum'>
                Registramos tu solicitud de{' '}
                <strong className='font-mono text-white'>
                  {formatDepositMoney(confirmation.amount, method)}
                </strong>{' '}
                con el comprobante{' '}
                <strong className='font-mono text-lime-400'>{confirmation.reference}</strong>
                . Te avisamos aquí mismo en cuanto el pago esté verificado.
              </p>
            </div>
          ) : null}
          {error ? (
            <p className='flex items-start gap-2 border border-odds-down/25 bg-odds-down/[0.045] px-3 py-2 text-[11px] leading-relaxed text-odds-down'>
              <TriangleAlert size={13} className='mt-0.5 shrink-0' aria-hidden='true' />
              {error}
            </p>
          ) : null}
        </div>

        {/* Cola propia en revisión */}
        {pending && pending.length > 0 ? (
          <div className='mt-4 border-t border-obsidian-border/60 pt-3'>
            <p className='mb-2 font-mono text-[9px] font-bold uppercase tracking-wide text-metallic-slate'>
              Tus depósitos en revisión ({pending.length})
            </p>
            <ul className='flex flex-col gap-1.5'>
              {pending.map((item) => (
                <li
                  key={item.transactionId}
                  className='flex flex-wrap items-center justify-between gap-2 border border-white/[0.07] bg-white/[0.02] px-2.5 py-1.5'
                >
                  <span className='flex min-w-0 items-center gap-2'>
                    <Clock3 size={11} className='shrink-0 text-money' aria-hidden='true' />
                    <span className='truncate font-mono text-[10px] font-bold text-white'>
                      {item.reference}
                    </span>
                  </span>
                  <span className='flex shrink-0 items-center gap-2.5 font-mono text-[9px] uppercase tracking-wide text-metallic-titanium'>
                    <span>{item.method === 'usdt' ? 'USDT' : 'QR/Transf.'}</span>
                    <span className='text-money'>
                      {formatDepositMoney(item.amount, item.method === 'usdt' ? 'usdt' : 'qr_transfer')}
                    </span>
                    <span>{formatRelativeTime(item.createdAt)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
