/**
 * Almacén único del JWT. Prioriza memoria y sincroniza con localStorage para
 * sobrevivir recargas. Ningún componente debe manipular el token directamente.
 */

export const TOKEN_STORAGE_KEY = 'zenbet_token';
export const AUTH_TOKEN_CHANGED_EVENT = 'zenbet:auth-token-changed';
export const AUTH_UNAUTHORIZED_EVENT = 'zenbet:auth-unauthorized';

export type AuthTokenChangeReason =
  | 'login'
  | 'logout'
  | 'cleared'
  | 'expired'
  | 'unauthorized'
  | 'external';

export interface AuthTokenChangeDetail {
  readonly token: string | null;
  readonly reason: AuthTokenChangeReason;
}

let memoryToken: string | null = null;

function canUseWindow(): boolean {
  return typeof window !== 'undefined';
}

function readStoredToken(): string | null {
  if (!canUseWindow()) return null;

  try {
    const stored = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    return stored && stored.trim() ? stored : null;
  } catch {
    // Safari privado, políticas de terceros o almacenamiento bloqueado.
    return null;
  }
}

function writeStoredToken(token: string | null): void {
  if (!canUseWindow()) return;

  try {
    if (token) {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // El token sigue disponible en memoria durante esta pestaña.
  }
}

function emitTokenChange(reason: AuthTokenChangeReason): void {
  if (!canUseWindow()) return;

  window.dispatchEvent(
    new CustomEvent<AuthTokenChangeDetail>(AUTH_TOKEN_CHANGED_EVENT, {
      detail: { token: memoryToken, reason },
    }),
  );
}

/** Lee primero memoria; si aún no se hidrató, consulta localStorage. */
function getToken(): string | null {
  return memoryToken ?? readStoredToken();
}

function setToken(token: string): void {
  const normalized = token.trim();
  if (!normalized) {
    clearToken('cleared');
    return;
  }

  memoryToken = normalized;
  writeStoredToken(normalized);
  emitTokenChange('login');
}

function clearToken(reason: AuthTokenChangeReason = 'logout'): void {
  memoryToken = null;
  writeStoredToken(null);
  emitTokenChange(reason);
}

export const authToken = {
  get: getToken,
  set: setToken,
  clear: clearToken,
  has: (): boolean => Boolean(getToken()),
};

export function emitUnauthorized(error: unknown): void {
  if (!canUseWindow()) return;

  window.dispatchEvent(
    new CustomEvent(AUTH_UNAUTHORIZED_EVENT, {
      detail: { error },
    }),
  );
}

// Mantiene la sesión coherente entre pestañas abiertas del sportsbook.
if (canUseWindow()) {
  window.addEventListener('storage', (event) => {
    if (event.key !== TOKEN_STORAGE_KEY) return;

    memoryToken = event.newValue;
    emitTokenChange('external');
  });
}
