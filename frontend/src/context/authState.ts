import { createContext, useContext } from 'react';

import type { AuthUser, LoginCredentials, RegisterPayload } from '@/domain/auth';

/** La página de apuestas emite este evento tras confirmar un ticket. */
export const BALANCE_UPDATED_EVENT = 'zenbet_balance_updated';

/** El hub de wallet empujó un SaldoActualizado: los saldos en pantalla pulsan. */
export const SALDO_FLASH_EVENT = 'zenbet_saldo_flash';

/** Señal para que los dashboards de billetera refresquen su snapshot. */
export const WALLET_REFRESH_EVENT = 'zenbet_wallet_refresh';

export interface AuthContextValue {
  readonly user: AuthUser | null;
  readonly isAuthenticated: boolean;
  readonly isLoading: boolean;
  login(credentials: LoginCredentials): Promise<AuthUser>;
  register(payload: RegisterPayload): Promise<AuthUser>;
  logout(): void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>.');
  }

  return context;
}
