import type {
  ApiFieldError,
  ProblemDetails,
  ProblemDetailsInit,
  ValidationErrors,
} from './contracts';

/* ==========================================================================
   Normalización RFC 7807
   ========================================================================== */

const STANDARD_KEYS = new Set([
  'type',
  'title',
  'status',
  'detail',
  'instance',
  'traceId',
  'trace_id',
  'code',
  'errorCode',
  'errors',
  'message',
]);

const STATUS_TITLES: Readonly<Record<number, string>> = {
  0: 'No se pudo completar la solicitud',
  400: 'Solicitud inválida',
  401: 'Sesión no autorizada',
  403: 'Acción no permitida',
  404: 'Recurso no encontrado',
  409: 'Conflicto de estado',
  422: 'Operación no procesable',
  429: 'Demasiadas solicitudes',
  500: 'Error interno del servidor',
  502: 'Respuesta inválida del servidor',
  503: 'Servicio no disponible',
  504: 'Tiempo de espera del servidor agotado',
};

const STATUS_CODES: Readonly<Record<number, string>> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'UNPROCESSABLE_ENTITY',
  429: 'RATE_LIMITED',
  500: 'SERVER_ERROR',
  502: 'BAD_GATEWAY',
  503: 'SERVICE_UNAVAILABLE',
  504: 'GATEWAY_TIMEOUT',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readHeader(headers: unknown, name: string): string | undefined {
  if (!headers) return undefined;

  const target = name.toLowerCase();
  const getter = isRecord(headers) ? headers.get : undefined;

  if (typeof getter === 'function') {
    const value = (getter as (header: string) => unknown).call(headers, name);
    if (Array.isArray(value)) return readString(value[0]);
    return readString(value);
  }

  if (!isRecord(headers)) return undefined;

  const key = Object.keys(headers).find((candidate) => candidate.toLowerCase() === target);
  if (!key) return undefined;

  const value = headers[key];
  if (Array.isArray(value)) return readString(value[0]);
  return readString(value);
}

function parseBody(data: unknown): Record<string, unknown> | undefined {
  if (isRecord(data)) return data;
  if (typeof data !== 'string' || !data.trim().startsWith('{')) return undefined;

  try {
    const parsed: unknown = JSON.parse(data);
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function normalizeErrors(value: unknown): ValidationErrors | undefined {
  if (!isRecord(value)) return undefined;

  const entries = Object.entries(value)
    .map(([field, rawMessages]) => {
      const messages = (Array.isArray(rawMessages) ? rawMessages : [rawMessages])
        .map((message) => readString(message))
        .filter((message): message is string => Boolean(message));

      return [field, messages] as const;
    })
    .filter(([, messages]) => messages.length > 0);

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function extractExtensions(payload: Record<string, unknown> | undefined) {
  if (!payload) return undefined;

  const entries = Object.entries(payload).filter(([key]) => !STANDARD_KEYS.has(key));
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function parseRetryAfter(
  rawHeader: string | undefined,
  payload: Record<string, unknown> | undefined,
): Pick<ProblemDetailsInit, 'retryAfterSeconds' | 'retryAt'> {
  const bodyValue = readNumber(payload?.retryAfter) ?? readNumber(payload?.retry_after);
  let seconds = bodyValue;

  if (seconds === undefined && rawHeader) {
    const numeric = Number(rawHeader);
    if (Number.isFinite(numeric) && numeric >= 0) {
      seconds = numeric;
    } else {
      const date = Date.parse(rawHeader);
      if (Number.isFinite(date)) {
        seconds = Math.max(0, Math.ceil((date - Date.now()) / 1000));
      }
    }
  }

  if (seconds === undefined) return {};

  return {
    retryAfterSeconds: seconds,
    retryAt: new Date(Date.now() + seconds * 1000).toISOString(),
  };
}

/** Estado estructural mínimo de un error de Axios, sin acoplar este módulo. */
interface AxiosLikeError {
  isAxiosError?: boolean;
  code?: string;
  message?: string;
  response?: {
    status?: number;
    data?: unknown;
    headers?: unknown;
  };
  config?: {
    url?: string;
    method?: string;
    headers?: unknown;
  };
}

function asAxiosLikeError(error: unknown): AxiosLikeError | undefined {
  if (!isRecord(error)) return undefined;

  const candidate = error as AxiosLikeError;
  const looksLikeAxios =
    candidate.isAxiosError === true ||
    ('response' in candidate && typeof candidate.message === 'string');

  return looksLikeAxios ? candidate : undefined;
}

function fallbackMessage(init: ProblemDetailsInit): string {
  const status = init.status ?? 0;

  if (init.isCanceled) return 'La solicitud fue cancelada.';
  if (init.isTimeout) return 'La solicitud tardó más de lo esperado. Inténtalo de nuevo.';
  if (init.isNetworkError) {
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    return offline
      ? 'Sin conexión a internet. Revisa tu red e inténtalo de nuevo.'
      : 'No se pudo conectar con el servidor. Inténtalo de nuevo.';
  }

  return STATUS_TITLES[status] ?? 'Se produjo un error inesperado.';
}

/* ==========================================================================
   Error tipado para UI
   ========================================================================== */

export class ProblemDetailsException extends Error implements ProblemDetails {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail?: string;
  readonly instance?: string;
  readonly traceId?: string;
  readonly code: string;
  readonly errors?: ValidationErrors;
  readonly extensions?: Readonly<Record<string, unknown>>;

  readonly raw: unknown;
  readonly originalError: unknown;
  readonly retryAfterSeconds?: number;
  readonly retryAt?: string;

  readonly isNetworkError: boolean;
  readonly isTimeout: boolean;
  readonly isCanceled: boolean;

  constructor(init: ProblemDetailsInit) {
    const title = init.title ?? STATUS_TITLES[init.status ?? 0] ?? 'Error inesperado';
    super(init.detail ?? title);

    this.name = 'ProblemDetailsException';
    this.type = init.type ?? 'about:blank';
    this.title = title;
    this.status = init.status ?? 0;
    this.detail = init.detail;
    this.instance = init.instance;
    this.traceId = init.traceId;
    this.code = init.code ?? STATUS_CODES[this.status] ?? `HTTP_${this.status}`;
    this.errors = init.errors;
    this.extensions = init.extensions;

    this.raw = init.raw;
    this.originalError = init.originalError;
    this.retryAfterSeconds = init.retryAfterSeconds;
    this.retryAt = init.retryAt;

    this.isNetworkError = init.isNetworkError ?? false;
    this.isTimeout = init.isTimeout ?? false;
    this.isCanceled = init.isCanceled ?? false;

    Object.setPrototypeOf(this, new.target.prototype);
  }

  get isValidationError(): boolean {
    return this.status === 400 || Boolean(this.errors);
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isUnprocessableEntity(): boolean {
    return this.status === 422;
  }

  get isRateLimited(): boolean {
    return this.status === 429;
  }

  get isServerError(): boolean {
    return this.status >= 500;
  }

  get fieldErrors(): readonly ApiFieldError[] {
    if (!this.errors) return [];

    return Object.entries(this.errors).map(([field, messages]) => ({
      field,
      messages,
    }));
  }

  hasFieldError(field: string): boolean {
    return Boolean(this.errors?.[field]?.length);
  }

  firstFieldError(field?: string): string | undefined {
    if (field) return this.errors?.[field]?.[0];

    const first = Object.values(this.errors ?? {})[0];
    return first?.[0];
  }

  toJSON(): Readonly<Record<string, unknown>> {
    return {
      name: this.name,
      type: this.type,
      title: this.title,
      status: this.status,
      detail: this.detail,
      instance: this.instance,
      traceId: this.traceId,
      code: this.code,
      errors: this.errors,
      retryAfterSeconds: this.retryAfterSeconds,
      retryAt: this.retryAt,
    };
  }
}

export function isProblemDetailsException(error: unknown): error is ProblemDetailsException {
  return error instanceof ProblemDetailsException;
}

/* ==========================================================================
   Entrada pública: convierte cualquier fallo en ProblemDetailsException
   ========================================================================== */

export function normalizeApiError(error: unknown): ProblemDetailsException {
  if (isProblemDetailsException(error)) return error;

  const axiosError = asAxiosLikeError(error);
  const response = axiosError?.response;
  const payload = parseBody(response?.data);

  const status = readNumber(response?.status) ?? readNumber(payload?.status) ?? 0;
  const axiosCode = readString(axiosError?.code) ?? '';
  const tokenExpired = readHeader(response?.headers, 'token-expired')?.toLowerCase() === 'true';

  const isCanceled = axiosCode === 'ERR_CANCELED';
  const isTimeout = axiosCode === 'ECONNABORTED' || axiosCode === 'ETIMEDOUT';
  const isNetworkError = !response && !isCanceled && Boolean(axiosError);

  const detail = readString(payload?.detail) ?? readString(payload?.message);
  const fallbackCode = STATUS_CODES[status] ?? (axiosError ? `HTTP_${status}` : 'CLIENT_ERROR');

  const code =
    readString(payload?.code) ??
    readString(payload?.errorCode) ??
    (tokenExpired
      ? 'TOKEN_EXPIRED'
      : isCanceled
        ? 'REQUEST_CANCELLED'
        : isTimeout
          ? 'REQUEST_TIMEOUT'
          : isNetworkError
            ? 'NETWORK_ERROR'
            : fallbackCode);

  const init: ProblemDetailsInit = {
    type: readString(payload?.type) ?? 'about:blank',
    title: readString(payload?.title),
    status,
    detail,
    instance: readString(payload?.instance) ?? readString(axiosError?.config?.url),
    traceId:
      readString(payload?.traceId) ??
      readString(payload?.trace_id) ??
      readHeader(response?.headers, 'x-trace-id'),
    code,
    errors: normalizeErrors(payload?.errors),
    extensions: extractExtensions(payload),
    raw: response?.data ?? error,
    originalError: error,
    isNetworkError,
    isTimeout,
    isCanceled,
    ...parseRetryAfter(readHeader(response?.headers, 'retry-after'), payload),
  };

  const problem = new ProblemDetailsException(init);

  // Los fallos de red o cancelación no llegan como ProblemDetails del backend:
  // se construyen aquí para que la UI tenga un único tipo de error.
  if (isNetworkError || isTimeout || isCanceled || !response) {
    return new ProblemDetailsException({
      ...init,
      title: isCanceled
        ? 'Solicitud cancelada'
        : isTimeout
          ? 'Tiempo de espera agotado'
          : isNetworkError
            ? 'Sin conexión'
            : 'Error inesperado',
      detail: fallbackMessage(init),
    });
  }

  return problem;
}
