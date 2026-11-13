import { API_BASE_URL, apiClient, ProblemDetailsException } from '@/api';
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
 * El backend (`AuthEndpoints.cs`) expone `/api/auth/login` y `/api/auth/register`
 * (sin `/v1`). Por defecto derivamos `/api` quitando el sufijo `/v1` de `VITE_API_URL`.
 */
export function resolveAuthBaseUrl(
  apiUrl: string = API_BASE_URL,
  authUrl: string | undefined = import.meta.env.VITE_AUTH_URL,
  legacyBaseUrl: string | undefined = import.meta.env.VITE_API_BASE_URL,
): string {
  const explicit = authUrl?.trim().replace(/\/+$/, '');
  if (explicit) return explicit;

  const legacyBase = legacyBaseUrl?.trim().replace(/\/+$/, '');
  if (legacyBase) return legacyBase.replace(/\/v\d+$/i, '') || '/api';

  const normalizedApi = apiUrl.trim().replace(/\/+$/, '');
  return normalizedApi.replace(/\/v\d+$/i, '') || '/api';
}

export const AUTH_BASE_URL = resolveAuthBaseUrl();

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
