/**
 * Contratos HTTP compartidos entre la infraestructura y la UI.
 * El backend .NET 10 publica errores como RFC 7807
 * (`application/problem+json`).
 */

export type ValidationErrors = Readonly<Record<string, readonly string[]>>;

/** Cuerpo RFC 7807 + extensiones usadas por la API de Zenbet. */
export interface ProblemDetails {
  /** URI que identifica el tipo de problema. */
  readonly type?: string;
  readonly title?: string;
  readonly status?: number;
  readonly detail?: string;
  readonly instance?: string;
  /** Extensión añadida por ASP.NET Core. */
  readonly traceId?: string;
  /** Código de negocio estable para la UI, si el endpoint lo provee. */
  readonly code?: string;
  /** Sólo presente en errores de validación (ValidationProblemDetails). */
  readonly errors?: ValidationErrors;
  /** Campos RFC 7807 adicionales. */
  readonly extensions?: Readonly<Record<string, unknown>>;
}

/** Initializer interno del error tipado consumido por la UI. */
export interface ProblemDetailsInit extends ProblemDetails {
  readonly raw?: unknown;
  readonly originalError?: unknown;
  readonly retryAfterSeconds?: number;
  readonly retryAt?: string;
  readonly isNetworkError?: boolean;
  readonly isTimeout?: boolean;
  readonly isCanceled?: boolean;
}

export interface ApiFieldError {
  readonly field: string;
  readonly messages: readonly string[];
}

export interface PaginatedResponse<T> {
  readonly items: readonly T[];
  readonly page: number;
  readonly pageSize: number;
  readonly totalCount: number;
}
