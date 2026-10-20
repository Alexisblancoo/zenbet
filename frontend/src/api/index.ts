/**
 * API pública de la capa HTTP.
 *
 * Regla de dependencias:
 *   contracts  ← errors / client (todos dependen de los contratos)
 *   client     es la única pieza que conoce Axios
 *   La UI importa exclusivamente desde '@/api'.
 */

export {
  apiClient,
  http,
  API_BASE_URL,
  type ApiClient,
  type ApiRequestConfig,
} from './client';

export {
  ProblemDetailsException,
  isProblemDetailsException,
  normalizeApiError,
} from './errors';

export {
  authToken,
  emitUnauthorized,
  TOKEN_STORAGE_KEY,
  AUTH_TOKEN_CHANGED_EVENT,
  AUTH_UNAUTHORIZED_EVENT,
  type AuthTokenChangeDetail,
  type AuthTokenChangeReason,
} from './authToken';

export {
  createIdempotencyKey,
  createUuidV4,
  IDEMPOTENCY_HEADER,
  MUTATING_METHODS,
} from './idempotency';

export type {
  ApiFieldError,
  PaginatedResponse,
  ProblemDetails,
  ProblemDetailsInit,
  ValidationErrors,
} from './contracts';
