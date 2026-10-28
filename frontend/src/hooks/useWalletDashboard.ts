import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/context/authState';
import { useBetSlip } from '@/context/betSlipState';
import {
  buildDailyActivity,
  calculateWalletMetrics,
  mergeSessionActivity,
  sumActivityNet,
  type DailyActivityPoint,
  type WalletMetrics,
  type WalletSnapshot,
} from '@/domain/wallet';
import { getCachedWalletSnapshot, walletService } from '@/services/walletService';
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
 * Caso de uso del dashboard: carga el snapshot histórico y lo cruza con los
 * recibos reales de la sesión. El saldo vivo sigue viviendo en AuthContext.
 */
export function useWalletDashboard(): WalletDashboardValue {
  const { user } = useAuth();
  const { receipts } = useBetSlip();

  const cached = getCachedWalletSnapshot();
  const [baseSnapshot, setBaseSnapshot] = useState<WalletSnapshot | null>(() => cached);
  const [status, setStatus] = useState<WalletDashboardStatus>(() => (cached ? 'ready' : 'loading'));
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    walletService
      .loadSnapshot(controller.signal)
      .then((snapshot) => {
        if (controller.signal.aborted) return;
        setBaseSnapshot(snapshot);
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

  const accountId = user ? String(user.id) : '';

  const snapshot = useMemo(
    () => (baseSnapshot ? mergeSessionActivity(baseSnapshot, receipts, accountId) : null),
    [baseSnapshot, receipts, accountId],
  );

  const metrics = useMemo(
    () => calculateWalletMetrics(snapshot?.bets ?? []),
    [snapshot],
  );

  const activity = useMemo(
    () => buildDailyActivity(snapshot?.transactions ?? [], 7),
    [snapshot],
  );

  const activityNet = useMemo(() => sumActivityNet(activity), [activity]);

  const refresh = useCallback(() => {
    if (status === 'loading' || status === 'refreshing') return;
    setStatus('refreshing');
    setReloadToken((value) => value + 1);
  }, [status]);

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
