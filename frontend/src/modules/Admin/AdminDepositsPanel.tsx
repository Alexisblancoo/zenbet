/**
 * Cola de depósitos pendientes para administración.
 *
 * Solo se muestra lo que devuelve la API. Las reglas de negocio viven en el
 * servidor: un 403 (rol insuficiente o auto-aprobación) y un 404 (depósito
 * inexistente) se muestran tal cual, sin reintentos silenciosos.
 */

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, Loader2, RefreshCw } from 'lucide-react';

import { isProblemDetailsException } from '@/api';
import {
  approveDeposit,
  listPendingDeposits,
  type AdminPendingDeposit,
} from '@/services/adminDepositService';

function describeFailure(error: unknown, action: 'cargar' | 'aprobar'): string {
  if (isProblemDetailsException(error)) {
    if (error.status === 401) return 'Tu sesión expiró. Vuelve a iniciar sesión.';
    if (error.status === 403) return error.detail ?? 'No puedes aprobar tu propio depósito.';
    if (error.status === 404) return error.detail ?? 'El depósito ya no existe.';

    const parts = [error.title, error.detail, error.code].filter(
      (part): part is string => typeof part === 'string' && part.trim().length > 0,
    );
    return `${error.status} · ${parts.join(' — ') || 'Sin detalle del servidor'}`;
  }

  if (error instanceof Error && error.message) return error.message;
  return action === 'cargar'
    ? 'No se pudo cargar la cola de depósitos.'
    : 'No se pudo aprobar el depósito.';
}

function formatAmount(amount: number): string {
  return amount.toFixed(2);
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'short' });
}

export function AdminDepositsPanel() {
  const [deposits, setDeposits] = useState<readonly AdminPendingDeposit[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    listPendingDeposits(controller.signal)
      .then((items) => {
        setDeposits(items);
      })
      .catch((failure: unknown) => {
        if (controller.signal.aborted) return;
        setDeposits(null);
        setLoadError(describeFailure(failure, 'cargar'));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [reloadToken]);

  const reload = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    setReloadToken((token) => token + 1);
  }, []);

  const onApprove = useCallback(async (deposit: AdminPendingDeposit) => {
    setApprovingId(deposit.id);
    setActionError(null);
    setNotice(null);

    try {
      const result = await approveDeposit(deposit.id);
      setDeposits((previous) => previous?.filter((item) => item.id !== deposit.id) ?? previous);
      setNotice(
        result.alreadyApproved
          ? 'El depósito ya estaba aprobado: no se acreditó dos veces.'
          : `Depósito aprobado. Nuevo saldo: ${formatAmount(result.newBalance)}.`,
      );
    } catch (failure: unknown) {
      setActionError(describeFailure(failure, 'aprobar'));
      if (isProblemDetailsException(failure) && failure.status === 404) {
        setDeposits((previous) => previous?.filter((item) => item.id !== deposit.id) ?? previous);
      }
    } finally {
      setApprovingId(null);
    }
  }, []);

  return (
    <section aria-labelledby='admin-deposits-title' className='mt-10'>
      <header className='flex flex-wrap items-end justify-between gap-3 border-b border-white/[0.08] pb-3'>
        <div>
          <p className='font-mono text-[9px] uppercase tracking-ultra text-lime-400'>
            ZenBet · Tesorería
          </p>
          <h2
            id='admin-deposits-title'
            className='mt-1 font-display text-lg font-black uppercase tracking-tight text-white'
          >
            Depósitos pendientes
          </h2>
          <p className='mt-1 max-w-2xl text-[11px] leading-relaxed text-metallic-slate'>
            El jugador sube el comprobante y el saldo solo se acredita aquí. Nadie puede aprobar su
            propio depósito, ni siquiera un administrador.
          </p>
        </div>
        <button
          type='button'
          onClick={reload}
          disabled={loading}
          className='flex items-center gap-1.5 border border-white/15 px-3 py-1.5 font-mono text-[9px] uppercase tracking-wide text-metallic-titanium transition-colors hover:border-lime-400/50 hover:text-lime-300 disabled:opacity-40'
        >
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} aria-hidden='true' />
          Recargar
        </button>
      </header>

      {notice && (
        <p
          role='status'
          className='mt-3 flex items-start gap-1.5 border border-lime-400/40 bg-lime-400/[0.06] px-2 py-1.5 text-[10px] leading-relaxed text-lime-200'
        >
          <CheckCircle2 size={11} className='mt-0.5 shrink-0' aria-hidden='true' />
          {notice}
        </p>
      )}

      {actionError && (
        <p
          role='alert'
          className='mt-3 flex items-start gap-1.5 border border-crimson/40 bg-crimson/[0.06] px-2 py-1.5 text-[10px] leading-relaxed text-crimson-300'
        >
          <AlertTriangle size={11} className='mt-0.5 shrink-0' aria-hidden='true' />
          {actionError}
        </p>
      )}

      {loadError && !loading && (
        <p
          role='alert'
          className='mt-3 flex items-start gap-1.5 border border-crimson/40 bg-crimson/[0.06] px-2 py-1.5 text-[10px] leading-relaxed text-crimson-300'
        >
          <AlertTriangle size={11} className='mt-0.5 shrink-0' aria-hidden='true' />
          {loadError}
        </p>
      )}

      {loading && (
        <p className='mt-4 font-mono text-[11px] uppercase tracking-wide text-metallic-slate'>
          Cargando depósitos reales…
        </p>
      )}

      {!loading && deposits?.length === 0 && (
        <p className='mt-4 font-mono text-[11px] uppercase tracking-wide text-metallic-slate'>
          No hay depósitos pendientes de revisión.
        </p>
      )}

      {!loading && deposits && deposits.length > 0 && (
        <ul className='mt-4 space-y-2'>
          {deposits.map((deposit) => (
            <li
              key={deposit.id}
              className='flex flex-wrap items-center justify-between gap-3 border border-white/[0.08] bg-white/[0.02] px-3 py-2'
            >
              <div className='min-w-0'>
                <p className='truncate text-[12px] font-semibold text-white'>
                  {deposit.username}{' '}
                  <span className='font-mono text-[10px] font-normal text-metallic-slate'>
                    {deposit.email}
                  </span>
                </p>
                <p className='mt-0.5 flex flex-wrap items-center gap-2 font-mono text-[10px] text-metallic-slate'>
                  <span className='flex items-center gap-1'>
                    <Clock3 size={10} aria-hidden='true' />
                    {formatDate(deposit.createdAt)}
                  </span>
                  <span>{deposit.method}</span>
                  <span>ref. {deposit.reference || 'sin referencia'}</span>
                </p>
              </div>
              <div className='flex items-center gap-3'>
                <span className='font-mono text-sm text-lime-300'>
                  {formatAmount(deposit.amount)}
                </span>
                <button
                  type='button'
                  onClick={() => void onApprove(deposit)}
                  disabled={approvingId !== null}
                  className='flex items-center gap-1.5 border border-lime-400/50 px-3 py-1 font-mono text-[9px] uppercase tracking-wide text-lime-300 transition-colors hover:bg-lime-400/10 disabled:opacity-40'
                >
                  {approvingId === deposit.id ? (
                    <Loader2 size={11} className='animate-spin' aria-hidden='true' />
                  ) : (
                    <CheckCircle2 size={11} aria-hidden='true' />
                  )}
                  Aprobar depósito de {deposit.username}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default AdminDepositsPanel;
