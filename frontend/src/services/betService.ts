/**
 * Casos de uso del boleto de apuestas.
 *
 * Contrato real: `POST /api/v1/bets` (baseURL ya incluye `/api/v1`) exige
 * `walletId`, `selectionId`, `amount`, `description` e `idempotencyKey` GUID.
 * La UI nunca ve Axios: aquí se transforma todo fallo en `BetFailure`.
 */

import {
  apiClient,
  IDEMPOTENCY_HEADER,
  isProblemDetailsException,
  type ProblemDetailsException,
} from '@/api';
import type { AuthUser } from '@/domain/auth';
import {
  BetSlipError,
  EMPTY_GUID,
  isUuid,
  roundMoney,
  type BetFailure,
  type BetFailureCode,
  type BetFailureField,
  type BetSelection,
} from '@/domain/bets';

export const BET_ENDPOINTS = {
  place: '/bets',
} as const;

const MAX_DESCRIPTION_LENGTH = 240;

interface PlaceBetWireRequest {
  readonly walletId: string;
  readonly selectionId: string;
  readonly amount: number;
  readonly description: string;
  readonly idempotencyKey: string;
  readonly promoCode?: string;
}

interface PlaceBetWireResponse {
  readonly success?: unknown;
  readonly betId?: unknown;
  readonly transactionId?: unknown;
  readonly newBalance?: unknown;
  readonly idempotentReplay?: unknown;
}

export interface PlaceBetCommand {
  readonly walletId: string;
  readonly selection: BetSelection;
  readonly stake: number;
  readonly idempotencyKey: string;
  readonly promoCode?: string;
}

export interface PlacedBet {
  readonly betId: string;
  readonly transactionId: string;
  readonly newBalance: number | null;
  readonly idempotentReplay: boolean;
}

/* ==========================================================================
   Copy de errores (una sola fuente para store y UI)
   ========================================================================== */

const FAILURE_COPY: Readonly<Record<BetFailureCode, { title: string; message: string }>> = {
  SESSION_REQUIRED: {
    title: 'Sesión requerida',
    message: 'Inicia sesión para confirmar una apuesta.',
  },
  EMPTY_SLIP: {
    title: 'Boleto vacío',
    message: 'Agrega al menos una selección antes de apostar.',
  },
  COMBINED_NOT_SUPPORTED: {
    title: 'Combinadas no disponibles',
    message: 'Por ahora las apuestas se envían de una en una. Elige una selección para continuar.',
  },
  ODDS_CHANGED: {
    title: 'Cuotas desactualizadas',
    message: 'Acepta las nuevas cuotas antes de confirmar la apuesta.',
  },
  INVALID_STAKE: {
    title: 'Monto inválido',
    message: 'Ingresa un monto válido dentro de los límites permitidos.',
  },
  WALLET_NOT_LINKED: {
    title: 'Billetera no disponible',
    message: 'No encontramos tu billetera. Vuelve a iniciar sesión para continuar.',
  },
  INVALID_SELECTION: {
    title: 'Selección no disponible',
    message: 'Esta selección ya no está disponible. Actualiza la cartelera e inténtalo de nuevo.',
  },
  INSUFFICIENT_BALANCE: {
    title: 'Saldo insuficiente',
    message: 'Tu saldo no cubre el monto de esta apuesta.',
  },
  RATE_LIMITED: {
    title: 'Demasiadas solicitudes',
    message: 'Espera un momento antes de volver a intentar.',
  },
  NETWORK_ERROR: {
    title: 'Sin conexión',
    message: 'No se pudo contactar al servidor. Revisa tu red e inténtalo de nuevo.',
  },
  SERVER_ERROR: {
    title: 'No pudimos confirmar',
    message: 'Revisa tu historial antes de reintentar. No se hará un cargo duplicado.',
  },
  VALIDATION_ERROR: {
    title: 'No se pudo confirmar',
    message: 'Revisa los datos del boleto e inténtalo de nuevo.',
  },
  UNAUTHORIZED: {
    title: 'Sesión expirada',
    message: 'Tu sesión dejó de ser válida. Inicia sesión de nuevo para apostar.',
  },
  INVALID_RESPONSE: {
    title: 'Confirmación incompleta',
    message: 'El servidor no devolvió la confirmación de la apuesta. Revisa tu historial antes de reintentar.',
  },
  UNKNOWN: {
    title: 'Error inesperado',
    message: 'No se pudo procesar la apuesta. Inténtalo de nuevo.',
  },
};

export function createBetFailure(
  code: BetFailureCode,
  overrides: Partial<Omit<BetFailure, 'code'>> = {},
): BetFailure {
  const copy = FAILURE_COPY[code];

  return {
    code,
    status: 0,
    title: copy.title,
    message: copy.message,
    ...overrides,
  };
}

/* ==========================================================================
   Normalización de respuestas
   ========================================================================== */

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readNumber(value: unknown): number | null {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
        ? Number(value)
        : Number.NaN;

  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeGuid(value: unknown): string | null {
  const parsed = readString(value);
  return parsed && isUuid(parsed) ? parsed.toLowerCase() : null;
}

/* ==========================================================================
   Wallet de la sesión
   ========================================================================== */

/**
 * La API nueva exige `walletId` (GUID). Se toma del usuario normalizado
 * (`walletId`/`wallet.id`) o, solo en desarrollo, de `VITE_DEV_WALLET_ID`.
 */
export function resolveWalletId(user: AuthUser | null): string | null {
  const fromSession = user?.walletId?.trim();
  if (fromSession) return fromSession;

  if (import.meta.env.DEV) {
    const devFallback = import.meta.env.VITE_DEV_WALLET_ID?.trim();
    if (devFallback) return devFallback;
  }

  return null;
}

/* ==========================================================================
   Errores → BetFailure
   ========================================================================== */

const KNOWN_BACKEND_MESSAGES: readonly (readonly [RegExp, BetFailureCode, string])[] = [
  [
    /insufficient funds/i,
    'INSUFFICIENT_BALANCE',
    'Tu saldo no cubre el monto de esta apuesta. Reduce el monto o deposita fondos.',
  ],
  [/invalid transaction amount/i, 'INVALID_STAKE', 'El monto de la apuesta no es válido.'],
  [
    /wallet .* not found/i,
    'WALLET_NOT_LINKED',
    'La billetera no existe o no está activa. Verifica tu sesión.',
  ],
  [
    /selection .* not found/i,
    'INVALID_SELECTION',
    'La selección ya no está disponible en el mercado.',
  ],
];

function translateBackendMessage(detail: string | undefined): {
  code: BetFailureCode;
  message: string;
} | null {
  if (!detail) return null;

  for (const [pattern, code, message] of KNOWN_BACKEND_MESSAGES) {
    if (pattern.test(detail)) return { code, message };
  }

  return null;
}

function mapFieldErrors(problem: ProblemDetailsException): readonly BetFailureField[] {
  return problem.fieldErrors.map(({ field, messages }) => ({ field, messages }));
}

/** System.Text.Json puede registrar el campo como `$.walletId` o `walletId`. */
function hasPropertyError(problem: ProblemDetailsException, property: string): boolean {
  return (
    problem.hasFieldError(property) ||
    problem.fieldErrors.some(
      ({ field }) => field.endsWith(`.${property}`) || field.endsWith(`[${property}]`),
    )
  );
}

function fromProblemDetails(problem: ProblemDetailsException): BetFailure {
  const fieldErrors = mapFieldErrors(problem);
  const status = problem.status;

  if (problem.isRateLimited) {
    return createBetFailure('RATE_LIMITED', {
      status,
      ...(problem.retryAfterSeconds !== undefined
        ? { retryAfterSeconds: problem.retryAfterSeconds }
        : {}),
      ...(fieldErrors.length > 0 ? { fieldErrors } : {}),
    });
  }

  if (problem.isUnauthorized) {
    return createBetFailure('UNAUTHORIZED', { status });
  }

  if (problem.isNetworkError || problem.isTimeout) {
    return createBetFailure('NETWORK_ERROR', {
      status,
      message: problem.detail ?? FAILURE_COPY.NETWORK_ERROR.message,
    });
  }

  if (problem.isServerError) {
    return createBetFailure('SERVER_ERROR', { status });
  }

  if (hasPropertyError(problem, 'walletId')) {
    return createBetFailure('WALLET_NOT_LINKED', {
      status,
      title: 'Billetera inválida',
      message: 'La billetera de tu sesión no es válida. Vuelve a iniciar sesión.',
      ...(fieldErrors.length > 0 ? { fieldErrors } : {}),
    });
  }

  if (hasPropertyError(problem, 'selectionId')) {
    return createBetFailure('INVALID_SELECTION', {
      status,
      title: 'Selección inválida',
      message: 'La selección ya no está disponible.',
      ...(fieldErrors.length > 0 ? { fieldErrors } : {}),
    });
  }

  const known = translateBackendMessage(problem.detail);

  if (known) {
    return createBetFailure(known.code, {
      status,
      message: known.message,
      ...(fieldErrors.length > 0 ? { fieldErrors } : {}),
    });
  }

  return createBetFailure('VALIDATION_ERROR', {
    status,
    message:
      problem.firstFieldError() ??
      problem.detail ??
      FAILURE_COPY.VALIDATION_ERROR.message,
    ...(fieldErrors.length > 0 ? { fieldErrors } : {}),
  });
}

/** Convierte cualquier error del flujo en copy accionable para el boleto. */
export function describeBetError(error: unknown): BetFailure {
  if (error instanceof BetSlipError) {
    return createBetFailure(error.code, {
      title: error.title,
      message: error.message,
    });
  }

  if (isProblemDetailsException(error)) {
    return fromProblemDetails(error);
  }

  const message = error instanceof Error && error.message ? error.message : undefined;
  return createBetFailure('UNKNOWN', message ? { message } : {});
}

/** Un fallo de transporte sin respuesta puede reintentarse con la misma llave. */
export function isRetryableBetError(error: unknown): boolean {
  return (
    isProblemDetailsException(error) && (error.isNetworkError || error.isTimeout)
  );
}

/* ==========================================================================
   Caso de uso
   ========================================================================== */

function buildDescription(selection: BetSelection): string {
  return `${selection.eventName} · ${selection.selectionName}`.slice(0, MAX_DESCRIPTION_LENGTH);
}

export const betService = {
  async placeBet({
    walletId,
    selection,
    stake,
    idempotencyKey,
    promoCode,
  }: PlaceBetCommand): Promise<PlacedBet> {
    if (!isUuid(walletId)) {
      throw new BetSlipError(
        'WALLET_NOT_LINKED',
        'Billetera no vinculada',
        FAILURE_COPY.WALLET_NOT_LINKED.message,
      );
    }

    if (!isUuid(selection.selectionId)) {
      throw new BetSlipError(
        'INVALID_SELECTION',
        FAILURE_COPY.INVALID_SELECTION.title,
        FAILURE_COPY.INVALID_SELECTION.message,
      );
    }

    const amount = roundMoney(stake);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BetSlipError('INVALID_STAKE', FAILURE_COPY.INVALID_STAKE.title, FAILURE_COPY.INVALID_STAKE.message);
    }

    const response = await apiClient.post<PlaceBetWireResponse, PlaceBetWireRequest>(
      BET_ENDPOINTS.place,
      {
        walletId,
        selectionId: selection.selectionId,
        amount,
        description: buildDescription(selection),
        idempotencyKey,
        ...(promoCode ? { promoCode } : {}),
      },
      {
        headers: { [IDEMPOTENCY_HEADER]: idempotencyKey },
      },
    );

    if (!response || response.success !== true) {
      throw new BetSlipError(
        'INVALID_RESPONSE',
        FAILURE_COPY.INVALID_RESPONSE.title,
        FAILURE_COPY.INVALID_RESPONSE.message,
      );
    }

    const betId = normalizeGuid(response.betId);
    const transactionId = normalizeGuid(response.transactionId);
    const idempotentReplay =
      response.idempotentReplay === true || !betId || betId === EMPTY_GUID;

    return {
      betId: !betId || betId === EMPTY_GUID ? '' : betId,
      transactionId: transactionId === EMPTY_GUID ? '' : (transactionId ?? ''),
      newBalance: readNumber(response.newBalance),
      idempotentReplay,
    };
  },
};
