import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useBetSlip } from '@/context/betSlipState';
import {
  buildDailyActivity,
  calculateWalletMetrics,
  sumActivityNet,
  type DailyActivityPoint,
  type WalletMetrics,
  type WalletSnapshot,
} from '@/domain/wallet';
import { walletService } from '@/services/walletService';
import { WALLET_REFRESH_EVENT } from '@/context/authState';

export type WalletDashboardStatus = 'loading' | 'ready' | 'refreshing' | 'error';

export interface WalletDashboardValue {
  readonly snapshot: WalletSnapshot | null;
  readonly metrics: WalletMetrics;
  readonly activity: readonly DailyActivityPoint[];
  readonly activityNet: number;
  readonly status: WalletDashboardStatus;
  readonly error: string | null;
  readonly refresh: () => void;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

/**
 * Caso de uso del dashboard: lee `GET /wallet` y `GET /bets`. El saldo vivo
 * llega por `WalletHub` y vive en AuthContext.
 */
export function useWalletDashboard(): WalletDashboardValue {
  const { receipts } = useBetSlip();

  // Todo viene de la API: sin caché local ni movimientos construidos en el cliente.
  const [snapshot, setSnapshot] = useState<WalletSnapshot | null>(null);
  const [status, setStatus] = useState<WalletDashboardStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    walletService
      .loadSnapshot(controller.signal)
      .then((snapshot) => {
        if (controller.signal.aborted) return;
        setSnapshot(snapshot);
        setError(null);
        setStatus('ready');
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted || isAbortError(caught)) return;
        setError(
          caught instanceof Error && caught.message
            ? caught.message
            : 'No se pudo cargar la billetera.',
        );
        setStatus('error');
      });

    return () => controller.abort();
  }, [reloadToken]);

  const metrics = useMemo(
    () => calculateWalletMetrics(snapshot?.bets ?? []),
    [snapshot],
  );

  const activity = useMemo(
    () => buildDailyActivity(snapshot?.transactions ?? [], 7),
    [snapshot],
  );

  const activityNet = useMemo(() => sumActivityNet(activity), [activity]);

  // Cada empuje del servidor debe traducirse en una lectura nueva: no se
  // descarta ninguno aunque ya haya una en curso (el efecto cancela la previa).
  const refresh = useCallback(() => {
    setStatus((current) => (current === 'loading' ? current : 'refreshing'));
    setReloadToken((value) => value + 1);
  }, []);

  // Una apuesta confirmada por la API cambia historial y saldo: se vuelve a
  // pedir el snapshot en lugar de fabricar la fila en el cliente.
  const confirmedBets = receipts.length;
  const lastConfirmed = useRef(confirmedBets);
  useEffect(() => {
    if (confirmedBets === lastConfirmed.current) return;
    lastConfirmed.current = confirmedBets;
    setReloadToken((value) => value + 1);
  }, [confirmedBets]);

  // El hub de wallet empujó un SaldoActualizado: refresca el snapshot para
  // mostrar la transacción acreditada sin esperar la próxima recarga.
  useEffect(() => {
    window.addEventListener(WALLET_REFRESH_EVENT, refresh);
    return () => window.removeEventListener(WALLET_REFRESH_EVENT, refresh);
  }, [refresh]);

  return {
    snapshot,
    metrics,
    activity,
    activityNet,
    status,
    error,
    refresh,
  };
}
