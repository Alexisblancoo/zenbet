import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import {
  AUTH_TOKEN_CHANGED_EVENT,
  AUTH_UNAUTHORIZED_EVENT,
  authToken,
  type AuthTokenChangeDetail,
} from '@/api';
import type { AuthUser, LoginCredentials, RegisterPayload } from '@/domain/auth';
import { authService } from '@/services/authService';
import { walletService } from '@/services/walletService';
import {
  clearStoredAuthUser,
  readStoredAuthUser,
  writeStoredAuthUser,
} from '@/services/sessionPersistence';
import {
  createWalletHubConnection,
  WALLET_HUB_EVENTS,
  type WalletBalanceUpdate,
} from '@/services/realtime/walletHub';
import { triggerSaldoFlashElements } from '@/hooks/useSaldoFlash';

import {
  AuthContext,
  BALANCE_UPDATED_EVENT,
  SALDO_FLASH_EVENT,
  WALLET_REFRESH_EVENT,
  type AuthContextValue,
} from './authState';

/**
 * Hidratación síncrona: localStorage está disponible antes del primer render,
 * así que no hay estado intermedio "cargando sesión" al montar la app.
 */
function readInitialUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;

  if (!authToken.has()) {
    // Limpia sesiones huérfanas: usuario persistido sin token válido.
    clearStoredAuthUser();
    return null;
  }

  return readStoredAuthUser();
}

function parseBalance(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(readInitialUser);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Puente entre la capa HTTP (authToken) y el estado global.
  useEffect(() => {
    const handleTokenChange = (event: Event) => {
      const detail = (event as CustomEvent<AuthTokenChangeDetail>).detail;

      if (!detail?.token) {
        clearStoredAuthUser();
        setUser(null);
      }
    };

    const handleUnauthorized = () => {
      clearStoredAuthUser();
      setUser(null);
    };

    const handleBalanceUpdate = (event: Event) => {
      const nextBalance = parseBalance((event as CustomEvent<unknown>).detail);
      if (nextBalance === null) return;

      setUser((previous) => {
        if (!previous || previous.walletBalance === nextBalance) return previous;

        const updated: AuthUser = { ...previous, walletBalance: nextBalance };
        writeStoredAuthUser(updated);
        return updated;
      });
    };

    window.addEventListener(AUTH_TOKEN_CHANGED_EVENT, handleTokenChange);
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    window.addEventListener(BALANCE_UPDATED_EVENT, handleBalanceUpdate);

    return () => {
      window.removeEventListener(AUTH_TOKEN_CHANGED_EVENT, handleTokenChange);
      window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
      window.removeEventListener(BALANCE_UPDATED_EVENT, handleBalanceUpdate);
    };
  }, []);

  // Canal privado de wallet (SignalR): mientras haya sesión, escucha
  // `SaldoActualizado` para reflejar el saldo que administración acredita
  // en vivo (depósitos aprobados), con destello verde y refresco del
  // dashboard.
  const isAuthenticated = Boolean(user);
  useEffect(() => {
    if (!isAuthenticated || !authToken.has()) return undefined;

    const connection = createWalletHubConnection();

    const applyBalance = (nextBalance: number) => {
      setUser((previous) => {
        if (!previous || previous.walletBalance === nextBalance) return previous;

        const updated: AuthUser = { ...previous, walletBalance: nextBalance };
        writeStoredAuthUser(updated);
        return updated;
      });
    };

    connection.on(WALLET_HUB_EVENTS.saldoActualizado, (update: WalletBalanceUpdate) => {
      const nextBalance = parseBalance(update?.newBalance);
      if (nextBalance === null) return;

      triggerSaldoFlashElements();
      applyBalance(nextBalance);
      window.dispatchEvent(
        new CustomEvent(SALDO_FLASH_EVENT, {
          detail: { amount: update.amount, newBalance: nextBalance },
        }),
      );
      window.dispatchEvent(new CustomEvent(WALLET_REFRESH_EVENT));
    });

    // El saldo guardado en localStorage es solo una pista: la fuente de verdad
    // es `GET /wallet`, que se consulta al abrir sesión y tras cada reconexión
    // (los empujes perdidos mientras el socket estaba caído no se reenvían).
    const controller = new AbortController();
    const syncBalance = () => {
      walletService
        .loadSnapshot(controller.signal)
        .then((snapshot) => {
          if (!controller.signal.aborted) applyBalance(snapshot.balance);
        })
        .catch(() => {
          // Sin respuesta de la API se conserva el último saldo confirmado.
        });
    };
    syncBalance();
    connection.onreconnected(syncBalance);

    connection
      .start()
      .catch(() => {
        // Sin conexión en vivo la app sigue funcionando: el saldo se
        // refresca manualmente o al recargar.
      });

    return () => {
      controller.abort();
      void connection.stop().catch(() => {
        // El socket puede ya estar cerrado durante el desmontaje.
      });
    };
  }, [isAuthenticated]);

  const login = useCallback(async (credentials: LoginCredentials): Promise<AuthUser> => {
    setIsSubmitting(true);

    try {
      const session = await authService.login(credentials);
      authToken.set(session.token);
      writeStoredAuthUser(session.user);
      setUser(session.user);
      return session.user;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const register = useCallback(async (payload: RegisterPayload): Promise<AuthUser> => {
    setIsSubmitting(true);

    try {
      const session = await authService.register(payload);
      authToken.set(session.token);
      writeStoredAuthUser(session.user);
      setUser(session.user);
      return session.user;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const logout = useCallback((): void => {
    authToken.clear('logout');
    clearStoredAuthUser();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading: isSubmitting,
      login,
      register,
      logout,
    }),
    [user, isSubmitting, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
