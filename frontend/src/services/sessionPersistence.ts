import { normalizeAuthUser, type AuthUser } from '@/domain/auth';

/** Se conserva la clave histórica para no invalidar sesiones existentes. */
export const USER_STORAGE_KEY = 'zenbet_user';

function canUseStorage(): boolean {
  return typeof window !== 'undefined';
}

export function readStoredAuthUser(): AuthUser | null {
  if (!canUseStorage()) return null;

  try {
    const raw = window.localStorage.getItem(USER_STORAGE_KEY);
    if (!raw) return null;

    return normalizeAuthUser(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export function writeStoredAuthUser(user: AuthUser): void {
  if (!canUseStorage()) return;

  try {
    window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } catch {
    // La sesión sigue viva en memoria durante esta pestaña.
  }
}

export function clearStoredAuthUser(): void {
  if (!canUseStorage()) return;

  try {
    window.localStorage.removeItem(USER_STORAGE_KEY);
  } catch {
    // No-op: almacenamiento bloqueado por el navegador.
  }
}
