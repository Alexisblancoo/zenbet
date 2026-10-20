import { apiClient, ProblemDetailsException } from '@/api';
import {
  normalizeAuthUser,
  type AuthSession,
  type LoginCredentials,
  type RegisterPayload,
} from '@/domain/auth';

/**
 * Casos de uso de autenticación.
 * No conoce React: solo transforma HTTP en entidades de dominio.
 */

export const AUTH_ENDPOINTS = {
  login: '/auth/login',
  register: '/auth/register',
} as const;

/**
 * Override opcional para entornos donde auth vive fuera del prefijo `VITE_API_URL`
 * (p. ej. la API legacy expone `/api/auth/*` mientras la nueva expone `/api/v1/auth/*`).
 */
const AUTH_BASE_URL = (() => {
  const trimmed = import.meta.env.VITE_AUTH_URL?.trim();
  return trimmed ? trimmed.replace(/\/+$/, '') : undefined;
})();

function authRequestConfig(): { baseURL: string } | undefined {
  return AUTH_BASE_URL ? { baseURL: AUTH_BASE_URL } : undefined;
}

interface AuthApiResponse {
  readonly token?: unknown;
  readonly accessToken?: unknown;
  readonly access_token?: unknown;
  readonly user?: unknown;
}

function readToken(payload: AuthApiResponse): string | undefined {
  const candidate = payload.token ?? payload.accessToken ?? payload.access_token;
  return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : undefined;
}

function toAuthSession(payload: AuthApiResponse): AuthSession {
  const token = readToken(payload);
  const user = normalizeAuthUser(payload.user);

  if (!token || !user) {
    throw new ProblemDetailsException({
      status: 0,
      title: 'Respuesta de autenticación inválida',
      detail: 'El servidor no devolvió un token o un usuario válido.',
      code: 'INVALID_AUTH_RESPONSE',
    });
  }

  return { token, user };
}

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthSession> {
    const payload = await apiClient.post<AuthApiResponse, LoginCredentials>(
      AUTH_ENDPOINTS.login,
      credentials,
      authRequestConfig(),
    );

    return toAuthSession(payload);
  },

  async register(data: RegisterPayload): Promise<AuthSession> {
    const payload = await apiClient.post<AuthApiResponse, RegisterPayload>(
      AUTH_ENDPOINTS.register,
      data,
      authRequestConfig(),
    );

    return toAuthSession(payload);
  },
};
