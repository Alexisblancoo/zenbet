/**
 * Entidades de autenticación de Zenbet.
 *
 * Capa de dominio: sin dependencias de React, Axios o localStorage.
 * Los adaptadores de infraestructura normalizan respuestas legacy
 * (`balance`, `userId`, etc.) hacia estos contratos.
 */

export type UserId = number | string;

export interface AuthUser {
  readonly id: UserId;
  readonly username: string;
  readonly email: string;
  readonly walletBalance: number;
  readonly roles: readonly string[];
  readonly createdAt?: string;
  /**
   * GUID de la billetera que exige `POST /api/v1/bets`. Puede no venir del
   * login legacy; en desarrollo se puede suplir con `VITE_DEV_WALLET_ID`.
   */
  readonly walletId?: string;
}

export interface LoginCredentials {
  readonly identifier: string;
  readonly password: string;
}

export interface RegisterPayload {
  readonly username: string;
  readonly email: string;
  readonly password: string;
  readonly initialBalance?: number;
  readonly termsAccepted: boolean;
}

export interface AuthSession {
  readonly token: string;
  readonly user: AuthUser;
}

const DEFAULT_ROLE = 'player';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function normalizeRoles(value: unknown): readonly string[] {
  if (Array.isArray(value)) {
    const roles = value
      .map((role) => readString(role))
      .filter((role): role is string => Boolean(role));

    return roles.length > 0 ? roles : [DEFAULT_ROLE];
  }

  if (typeof value === 'string') {
    const roles = value.split(/[,\s]+/).filter(Boolean);
    return roles.length > 0 ? roles : [DEFAULT_ROLE];
  }

  return [DEFAULT_ROLE];
}

/** Acepta `walletBalance` (nuevo) o `balance` (legacy) sin romper sesiones guardadas. */
export function normalizeAuthUser(raw: unknown): AuthUser | null {
  if (!isRecord(raw)) return null;

  const email = readString(raw.email) ?? '';
  const username = readString(raw.username) ?? '';
  const rawId = raw.id ?? raw.userId ?? raw.user_id;
  const resolvedId = readString(rawId) ?? readNumber(rawId) ?? readString(raw.email);

  // Se exige identidad estable (id o email); un usuario sin ella no es una sesión válida.
  if (resolvedId === undefined) return null;

  const wallet = isRecord(raw.wallet) ? raw.wallet : undefined;

  const walletId =
    readString(raw.walletId) ??
    readString(raw.wallet_id) ??
    readString(wallet?.id) ??
    readString(wallet?.walletId);

  const walletBalance =
    readNumber(raw.walletBalance) ??
    readNumber(raw.wallet_balance) ??
    readNumber(raw.balance) ??
    readNumber(wallet?.balance) ??
    readNumber(wallet?.walletBalance) ??
    0;

  const createdAt = readString(raw.createdAt) ?? readString(raw.created_at);

  return {
    id: resolvedId,
    username,
    email,
    walletBalance,
    roles: normalizeRoles(raw.roles),
    ...(createdAt ? { createdAt } : {}),
    ...(walletId ? { walletId } : {}),
  };
}

export function isUserInRole(user: AuthUser | null, role: string): boolean {
  return Boolean(user?.roles.includes(role));
}
