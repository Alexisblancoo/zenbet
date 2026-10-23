import { createContext, useContext } from 'react';

export type AuthMode = 'login' | 'register';

export interface AuthModalContextValue {
  readonly openAuth: (mode?: AuthMode) => void;
  readonly closeAuth: () => void;
}

export const AuthModalContext = createContext<AuthModalContextValue | null>(null);

export function useAuthModal(): AuthModalContextValue {
  const context = useContext(AuthModalContext);

  if (!context) {
    throw new Error('useAuthModal debe usarse dentro de <AuthModalProvider>.');
  }

  return context;
}
