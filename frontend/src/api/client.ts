import axios, {
  AxiosHeaders,
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
} from 'axios';

import { authToken, emitUnauthorized } from './authToken';
import { normalizeApiError } from './errors';
import { createIdempotencyKey, IDEMPOTENCY_HEADER, MUTATING_METHODS } from './idempotency';

const FALLBACK_API_URL = 'http://localhost:5000/api/v1';

function normalizeBaseUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed.replace(/\/+$/, '');
}

/**
 * URL base de la Web API .NET 10.
 * Se prefiere `VITE_API_URL`; `VITE_API_BASE_URL` queda como compatibilidad.
 */
export const API_BASE_URL =
  normalizeBaseUrl(import.meta.env.VITE_API_URL) ??
  normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL) ??
  FALLBACK_API_URL;

if (import.meta.env.DEV && !normalizeBaseUrl(import.meta.env.VITE_API_URL)) {
  console.warn(
    `[zenbet/api] VITE_API_URL no está definida. Usando ${API_BASE_URL} como fallback.`,
  );
}

export const http: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
  headers: {
    Accept: 'application/json',
  },
});

/* --------------------------------------------------------------------------
   Request: Bearer JWT + idempotencia de operaciones mutativas
   -------------------------------------------------------------------------- */

http.interceptors.request.use((config) => {
  const headers = AxiosHeaders.from(config.headers);
  const token = authToken.get();

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const method = (config.method ?? 'get').toUpperCase();

  if (MUTATING_METHODS.has(method) && !headers.has(IDEMPOTENCY_HEADER)) {
    headers.set(IDEMPOTENCY_HEADER, createIdempotencyKey());
  }

  config.headers = headers;
  return config;
});

/* --------------------------------------------------------------------------
   Response: error único ProblemDetailsException para toda la UI
   -------------------------------------------------------------------------- */

http.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const problem = normalizeApiError(error);

    // Un 401 con token en memoria significa que la sesión dejó de ser válida.
    // No se redirige desde la capa HTTP: la app escucha y decide en el router.
    if (problem.status === 401 && authToken.has()) {
      authToken.clear(problem.code === 'TOKEN_EXPIRED' ? 'expired' : 'unauthorized');
      emitUnauthorized(problem);
    }

    return Promise.reject(problem);
  },
);

/* --------------------------------------------------------------------------
   Fachada tipada: la UI recibe `T` (cuerpo), nunca AxiosResponse.
   -------------------------------------------------------------------------- */

export type ApiRequestConfig<D = unknown> = Omit<AxiosRequestConfig<D>, 'url' | 'method' | 'data'>;

async function unwrap<T>(request: Promise<AxiosResponse<T>>): Promise<T> {
  const response = await request;
  return response.data;
}

export interface ApiClient {
  readonly instance: AxiosInstance;
  get<T = unknown>(url: string, config?: ApiRequestConfig): Promise<T>;
  post<T = unknown, D = unknown>(url: string, data?: D, config?: ApiRequestConfig<D>): Promise<T>;
  put<T = unknown, D = unknown>(url: string, data?: D, config?: ApiRequestConfig<D>): Promise<T>;
  patch<T = unknown, D = unknown>(url: string, data?: D, config?: ApiRequestConfig<D>): Promise<T>;
  delete<T = unknown>(url: string, config?: ApiRequestConfig): Promise<T>;
  head<T = unknown>(url: string, config?: ApiRequestConfig): Promise<T>;
  request<T = unknown, D = unknown>(config: AxiosRequestConfig<D>): Promise<T>;
}

export const apiClient: ApiClient = {
  instance: http,

  get<T = unknown>(url: string, config?: ApiRequestConfig) {
    return unwrap<T>(http.get<T>(url, config));
  },

  post<T = unknown, D = unknown>(url: string, data?: D, config?: ApiRequestConfig<D>) {
    return unwrap<T>(http.post<T>(url, data, config));
  },

  put<T = unknown, D = unknown>(url: string, data?: D, config?: ApiRequestConfig<D>) {
    return unwrap<T>(http.put<T>(url, data, config));
  },

  patch<T = unknown, D = unknown>(url: string, data?: D, config?: ApiRequestConfig<D>) {
    return unwrap<T>(http.patch<T>(url, data, config));
  },

  delete<T = unknown>(url: string, config?: ApiRequestConfig) {
    return unwrap<T>(http.delete<T>(url, config));
  },

  head<T = unknown>(url: string, config?: ApiRequestConfig) {
    return unwrap<T>(http.head<T>(url, config));
  },

  request<T = unknown, D = unknown>(config: AxiosRequestConfig<D>) {
    return unwrap<T>(http.request<T, AxiosResponse<T>, D>(config));
  },
};

export default apiClient;
