/**
 * Cliente HTTP tipado de ZenBet.
 *
 * Reglas de diseño:
 * - `fetch` nativo, sin Axios ni interceptores ocultos.
 * - Los DTO de `@/types/zenbet` se validan en el borde: una respuesta
 *   incompleta se convierte en `INVALID_RESPONSE`, nunca en datos "parciales"
 *   que la UI pueda interpretar como reales.
 * - `API_BASE_URL` ya incluye `/api/v1`; los paths son relativos a esa base.
 * - Todo fallo HTTP se normaliza a `ZenBetApiError` (409, 400, 422, 401, …).
 */

import { API_BASE_URL, authToken, emitUnauthorized, IDEMPOTENCY_HEADER } from '@/api';
import {
  PromotionTier,
  type BetResponse,
  type FightingEventDto,
  type FightEventDto,
  type FighterDto,
  type MarketDto,
  type MarketSourceDto,
  type MmaBoutDto,
  type MmaResultDto,
  type PlaceBetRequest,
  type PromotionDto,
  type SelectionDto,
  type UpcomingEventsResponse,
} from '@/types/zenbet';

/* ==========================================================================
   Endpoints
   ========================================================================== */

export const ZENBET_ENDPOINTS = {
  promotions: '/promotions',
  upcomingEvents: '/events/upcoming',
  placeBet: '/bets/place',
} as const;

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_PROMO_CODE_LENGTH = 40;

const GUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ==========================================================================
   Error tipado
   ========================================================================== */

export type ZenBetErrorCode =
  | 'ABORTED'
  | 'NETWORK'
  | 'TIMEOUT'
  | 'VALIDATION'
  | 'CONFLICT'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'UNPROCESSABLE'
  | 'BET_REJECTED'
  | 'SERVER'
  | 'INVALID_RESPONSE'
  | 'UNKNOWN';

export interface ZenBetApiErrorInit {
  readonly code: ZenBetErrorCode;
  readonly status: number;
  readonly title: string;
  readonly detail?: string;
  readonly fieldErrors?: Readonly<Record<string, readonly string[]>>;
  readonly retryAfterSeconds?: number;
  readonly isIdempotencyConflict?: boolean;
  readonly originalError?: unknown;
}

export class ZenBetApiError extends Error {
  readonly code: ZenBetErrorCode;
  readonly status: number;
  readonly title: string;
  readonly detail: string | undefined;
  readonly fieldErrors: Readonly<Record<string, readonly string[]>>;
  readonly retryAfterSeconds: number | undefined;
  /** `true` cuando el 409 proviene de reutilizar `X-Idempotency-Key`. */
  readonly isIdempotencyConflict: boolean;
  readonly originalError: unknown;

  constructor(init: ZenBetApiErrorInit) {
    super(init.detail ?? init.title);
    this.name = 'ZenBetApiError';
    this.code = init.code;
    this.status = init.status;
    this.title = init.title;
    this.detail = init.detail;
    this.fieldErrors = init.fieldErrors ?? {};
    this.retryAfterSeconds = init.retryAfterSeconds;
    this.isIdempotencyConflict = init.isIdempotencyConflict ?? false;
    this.originalError = init.originalError;

    Object.setPrototypeOf(this, new.target.prototype);
  }

  get isValidationError(): boolean {
    return this.code === 'VALIDATION' || this.status === 400;
  }

  get isNetworkError(): boolean {
    return this.code === 'NETWORK' || this.code === 'TIMEOUT';
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isRateLimited(): boolean {
    return this.status === 429;
  }

  get isServerError(): boolean {
    return this.status >= 500;
  }

  firstFieldError(field?: string): string | undefined {
    if (field) return this.fieldErrors[field]?.[0];

    const first = Object.values(this.fieldErrors)[0];
    return first?.[0];
  }
}

export function isZenBetApiError(error: unknown): error is ZenBetApiError {
  return error instanceof ZenBetApiError;
}

/** Convierte cualquier fallo (incluido uno de red) en `ZenBetApiError`. */
export function toZenBetApiError(error: unknown): ZenBetApiError {
  if (isZenBetApiError(error)) return error;

  const detail =
    error instanceof Error && error.message
      ? error.message
      : 'Ocurrió un error inesperado.';

  return new ZenBetApiError({
    code: 'UNKNOWN',
    status: 0,
    title: 'Error inesperado',
    detail,
    originalError: error,
  });
}

/* ==========================================================================
   ProblemDetails (RFC 7807 / ValidationProblemDetails)
   ========================================================================== */

interface ParsedProblemDetails {
  readonly title?: string;
  readonly detail?: string;
  readonly code?: string;
  readonly errors?: Readonly<Record<string, readonly string[]>>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function parseValidationErrors(
  value: unknown,
): Readonly<Record<string, readonly string[]>> | undefined {
  if (!isRecord(value)) return undefined;

  const entries = Object.entries(value)
    .map(([field, rawMessages]) => {
      const messages = (Array.isArray(rawMessages) ? rawMessages : [rawMessages])
        .map(readOptionalString)
        .filter((message): message is string => message !== undefined);

      return [field, messages] as const;
    })
    .filter(([, messages]) => messages.length > 0);

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function parseProblemDetails(payload: unknown): ParsedProblemDetails | null {
  if (!isRecord(payload)) return null;

  return {
    title: readOptionalString(payload.title),
    detail: readOptionalString(payload.detail),
    code: readOptionalString(payload.code) ?? readOptionalString(payload.errorCode),
    errors: parseValidationErrors(payload.errors),
  };
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return undefined;

  return Math.max(0, Math.ceil((timestamp - Date.now()) / 1000));
}

function defaultTitleForStatus(status: number): string {
  switch (status) {
    case 400:
      return 'Solicitud inválida';
    case 401:
      return 'Sesión no autorizada';
    case 403:
      return 'Acción no permitida';
    case 404:
      return 'Recurso no encontrado';
    case 409:
      return 'Conflicto de idempotencia';
    case 422:
      return 'Apuesta rechazada';
    case 429:
      return 'Demasiadas solicitudes';
    default:
      return status >= 500 ? 'Error del servidor' : 'Error inesperado';
  }
}

function codeForStatus(status: number): ZenBetErrorCode {
  switch (status) {
    case 400:
      return 'VALIDATION';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 422:
      return 'UNPROCESSABLE';
    case 429:
      return 'RATE_LIMITED';
    default:
      return status >= 500 ? 'SERVER' : 'UNKNOWN';
  }
}

/* ==========================================================================
   Transporte
   ========================================================================== */

interface RawApiResponse {
  readonly status: number;
  readonly ok: boolean;
  readonly payload: unknown;
  readonly headers: Headers;
}

function buildHttpError(response: RawApiResponse): ZenBetApiError {
  const problem = parseProblemDetails(response.payload);
  const fieldErrors = problem?.errors ?? {};
  const code = codeForStatus(response.status);
  const retryAfterSeconds = parseRetryAfter(response.headers.get('Retry-After'));
  const firstFieldError = Object.values(fieldErrors)[0]?.[0];

  if (response.status === 409) {
    return new ZenBetApiError({
      code,
      status: response.status,
      title: problem?.title ?? defaultTitleForStatus(response.status),
      detail:
        problem?.detail ??
        'La clave X-Idempotency-Key ya se usó con una solicitud distinta. Genera una clave nueva antes de reintentar.',
      fieldErrors,
      retryAfterSeconds,
      isIdempotencyConflict: true,
    });
  }

  return new ZenBetApiError({
    code,
    status: response.status,
    title: problem?.title ?? defaultTitleForStatus(response.status),
    detail: problem?.detail ?? firstFieldError,
    fieldErrors,
    retryAfterSeconds,
  });
}

function invalidResponse(context: string, detail: string): ZenBetApiError {
  return new ZenBetApiError({
    code: 'INVALID_RESPONSE',
    status: 0,
    title: 'Respuesta inválida',
    detail: `${context}: ${detail}`,
  });
}

function abortedError(): ZenBetApiError {
  return new ZenBetApiError({
    code: 'ABORTED',
    status: 0,
    title: 'Solicitud cancelada',
    detail: 'La solicitud fue cancelada antes de completarse.',
  });
}

function timeoutError(): ZenBetApiError {
  return new ZenBetApiError({
    code: 'TIMEOUT',
    status: 0,
    title: 'Tiempo de espera agotado',
    detail: 'El servidor tardó más de lo esperado. Inténtalo de nuevo.',
  });
}

function networkError(originalError: unknown): ZenBetApiError {
  return new ZenBetApiError({
    code: 'NETWORK',
    status: 0,
    title: 'Sin conexión',
    detail: 'No se pudo conectar con el servidor. Revisa tu red e inténtalo de nuevo.',
    originalError,
  });
}

function isAbortException(error: unknown): boolean {
  return (
    typeof DOMException !== 'undefined' &&
    error instanceof DOMException &&
    error.name === 'AbortError'
  );
}

async function requestJson(
  path: string,
  init: RequestInit,
  signal?: AbortSignal,
): Promise<RawApiResponse> {
  const controller = new AbortController();
  let timedOut = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const onCallerAbort = () => controller.abort();

  if (signal?.aborted) controller.abort();
  else if (signal) {
    signal.addEventListener('abort', onCallerAbort, { once: true });
  }

  timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');

  if (!headers.has('Content-Type') && init.body !== undefined && init.body !== null) {
    headers.set('Content-Type', 'application/json');
  }

  const token = authToken.get();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
    });

    const text = await response.text();
    let payload: unknown = null;

    if (text.trim()) {
      try {
        payload = JSON.parse(text) as unknown;
      } catch {
        if (response.ok) {
          throw invalidResponse(path, 'el cuerpo de éxito no es JSON válido.');
        }

        payload = text;
      }
    }

    return {
      status: response.status,
      ok: response.ok,
      payload,
      headers: response.headers,
    };
  } catch (error) {
    if (isZenBetApiError(error)) throw error;
    if (signal?.aborted) throw abortedError();
    if (timedOut) throw timeoutError();
    if (isAbortException(error)) throw abortedError();
    if (error instanceof TypeError) throw networkError(error);
    throw toZenBetApiError(error);
  } finally {
    if (timeoutId !== null) clearTimeout(timeoutId);
    signal?.removeEventListener('abort', onCallerAbort);
  }
}

/* ==========================================================================
   Validación de entrada
   ========================================================================== */

function validationError(field: string, message: string): ZenBetApiError {
  return new ZenBetApiError({
    code: 'VALIDATION',
    status: 400,
    title: 'Solicitud inválida',
    detail: message,
    fieldErrors: { [field]: [message] },
  });
}

function validateGuid(value: string, field: string): void {
  if (!GUID_PATTERN.test(value.trim())) {
    throw validationError(field, 'Debe ser un GUID válido.');
  }
}

function validatePlaceBetRequest(request: PlaceBetRequest): void {
  validateGuid(request.walletId, 'walletId');
  validateGuid(request.selectionId, 'selectionId');

  if (!Number.isFinite(request.amount) || request.amount <= 0) {
    throw validationError('amount', 'El monto debe ser mayor que cero.');
  }

  const description = request.description.trim();
  if (!description) {
    throw validationError('description', 'La descripción es obligatoria.');
  }

  if (description.length > MAX_DESCRIPTION_LENGTH) {
    throw validationError(
      'description',
      `La descripción no puede superar ${MAX_DESCRIPTION_LENGTH} caracteres.`,
    );
  }

  if (
    request.promoCode !== undefined &&
    request.promoCode.trim().length > MAX_PROMO_CODE_LENGTH
  ) {
    throw validationError(
      'promoCode',
      `El código promocional no puede superar ${MAX_PROMO_CODE_LENGTH} caracteres.`,
    );
  }
}

function validateIdempotencyKey(idempotencyKey: string): void {
  if (!GUID_PATTERN.test(idempotencyKey.trim())) {
    throw validationError(
      'X-Idempotency-Key',
      'Envía una clave GUID válida en el header X-Idempotency-Key.',
    );
  }
}

/* ==========================================================================
   Normalización de respuestas
   ========================================================================== */

function requiredString(
  record: Record<string, unknown>,
  key: string,
  context: string,
): string {
  const value = record[key];

  if (typeof value !== 'string' || value.trim() === '') {
    throw invalidResponse(context, `"${key}" debe ser un string no vacío.`);
  }

  return value;
}

function nullableString(
  record: Record<string, unknown>,
  key: string,
  context: string,
): string | null {
  const value = record[key];
  if (value === null || value === undefined) return null;

  if (typeof value !== 'string') {
    throw invalidResponse(context, `"${key}" debe ser un string o null.`);
  }

  return value;
}

function requiredNumber(
  record: Record<string, unknown>,
  key: string,
  context: string,
): number {
  const value = record[key];

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw invalidResponse(context, `"${key}" debe ser un número finito.`);
  }

  return value;
}

function nullableNumber(
  record: Record<string, unknown>,
  key: string,
  context: string,
): number | null {
  const value = record[key];
  if (value === null || value === undefined) return null;

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw invalidResponse(context, `"${key}" debe ser un número finito o null.`);
  }

  return value;
}

function requiredBoolean(
  record: Record<string, unknown>,
  key: string,
  context: string,
): boolean {
  const value = record[key];

  if (typeof value !== 'boolean') {
    throw invalidResponse(context, `"${key}" debe ser boolean.`);
  }

  return value;
}

function requiredArray(
  record: Record<string, unknown>,
  key: string,
  context: string,
): readonly unknown[] {
  const value = record[key];

  if (!Array.isArray(value)) {
    throw invalidResponse(context, `"${key}" debe ser un array.`);
  }

  return value;
}

function asRecord(value: unknown, context: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw invalidResponse(context, 'se esperaba un objeto.');
  }

  return value;
}

function isPromotionTier(value: number): value is PromotionTier {
  return (
    value === PromotionTier.Global ||
    value === PromotionTier.Regional ||
    value === PromotionTier.Niche ||
    value === PromotionTier.AmateurOrDevelopmental
  );
}

const TIER_BY_NAME: Readonly<Record<string, PromotionTier>> = {
  global: PromotionTier.Global,
  regional: PromotionTier.Regional,
  niche: PromotionTier.Niche,
  amateurodevelopmental: PromotionTier.AmateurOrDevelopmental,
  amateur: PromotionTier.AmateurOrDevelopmental,
  developmental: PromotionTier.AmateurOrDevelopmental,
};

function parsePromotionTier(value: unknown, context: string): PromotionTier {
  if (typeof value === 'number' && isPromotionTier(value)) return value;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    const numeric = Number(trimmed);

    if (Number.isInteger(numeric) && isPromotionTier(numeric)) return numeric;

    const byName = TIER_BY_NAME[trimmed.toLowerCase()];
    if (byName !== undefined) return byName;
  }

  throw invalidResponse(context, 'tier desconocido.');
}

function parsePromotion(value: unknown, context: string): PromotionDto {
  const record = asRecord(value, context);

  return {
    id: requiredString(record, 'id', context),
    name: requiredString(record, 'name', context),
    slug: requiredString(record, 'slug', context),
    tier: parsePromotionTier(record.tier, `${context}.tier`),
    countryCode: requiredString(record, 'countryCode', context),
  };
}

function parseSelection(value: unknown, context: string): SelectionDto {
  const record = asRecord(value, context);

  return {
    id: requiredString(record, 'id', context),
    code: nullableString(record, 'code', context),
    name: requiredString(record, 'name', context),
    decimalOdds: requiredNumber(record, 'decimalOdds', context),
    americanOdds: requiredString(record, 'americanOdds', context),
    displayOrder: requiredNumber(record, 'displayOrder', context),
    settled: requiredBoolean(record, 'settled', context),
    provider: nullableString(record, 'provider', context),
    updatedAt: nullableString(record, 'updatedAt', context),
  };
}

function parseMarketSource(value: unknown, context: string): MarketSourceDto {
  const record = asRecord(value, context);

  return {
    kind: requiredString(record, 'kind', context),
    name: requiredString(record, 'name', context),
    url: nullableString(record, 'url', context),
    observedAt: requiredString(record, 'observedAt', context),
    note: nullableString(record, 'note', context),
  };
}

function parseMarket(value: unknown, context: string): MarketDto {
  const record = asRecord(value, context);

  const sourceValue = record.source;
  const source =
    sourceValue === null || sourceValue === undefined
      ? null
      : parseMarketSource(sourceValue, `${context}.source`);

  return {
    id: requiredString(record, 'id', context),
    type: requiredString(record, 'type', context),
    typeKey: requiredString(record, 'typeKey', context),
    name: requiredString(record, 'name', context),
    line: nullableNumber(record, 'line', context),
    displayOrder: requiredNumber(record, 'displayOrder', context),
    status: requiredString(record, 'status', context),
    provider: nullableString(record, 'provider', context),
    updatedAt: nullableString(record, 'updatedAt', context),
    source,
    selections: requiredArray(record, 'selections', context).map((selection, index) =>
      parseSelection(selection, `${context}.selections[${index}]`),
    ),
  };
}

function parseMmaResult(value: unknown, context: string): MmaResultDto {
  const record = asRecord(value, context);

  return {
    winnerCorner: requiredString(record, 'winnerCorner', context),
    winnerName: requiredString(record, 'winnerName', context),
    method: requiredString(record, 'method', context),
    methodLabel: requiredString(record, 'methodLabel', context),
    round: requiredNumber(record, 'round', context),
    recordedAt: requiredString(record, 'recordedAt', context),
  };
}

function parseFighter(value: unknown, context: string): FighterDto {
  const record = asRecord(value, context);

  return {
    id: requiredString(record, 'id', context),
    name: requiredString(record, 'name', context),
    countryCode: requiredString(record, 'countryCode', context),
    country: requiredString(record, 'country', context),
    record: requiredString(record, 'record', context),
    rank: nullableString(record, 'rank', context),
    division: requiredString(record, 'division', context),
    divisionLabel: requiredString(record, 'divisionLabel', context),
    imageUrl: nullableString(record, 'imageUrl', context),
    wins: requiredNumber(record, 'wins', context),
    losses: requiredNumber(record, 'losses', context),
    draws: requiredNumber(record, 'draws', context),
    winRate: requiredNumber(record, 'winRate', context),
    reachInches: nullableNumber(record, 'reachInches', context),
    stance: nullableString(record, 'stance', context),
    takedownDefensePercent: nullableNumber(record, 'takedownDefensePercent', context),
    strikingAccuracyPercent: nullableNumber(record, 'strikingAccuracyPercent', context),
  };
}

function parseMmaBout(value: unknown, context: string): MmaBoutDto {
  const record = asRecord(value, context);

  return {
    weightDivision: requiredString(record, 'weightDivision', context),
    weightDivisionLabel: requiredString(record, 'weightDivisionLabel', context),
    weightLimitLbs: requiredNumber(record, 'weightLimitLbs', context),
    scheduledRounds: requiredNumber(record, 'scheduledRounds', context),
    isTitleFight: requiredBoolean(record, 'isTitleFight', context),
    billing: requiredString(record, 'billing', context),
    billingLabel: requiredString(record, 'billingLabel', context),
    billingOrder: requiredNumber(record, 'billingOrder', context),
    venue: requiredString(record, 'venue', context),
    location: requiredString(record, 'location', context),
    red: parseFighter(record.red, `${context}.red`),
    blue: parseFighter(record.blue, `${context}.blue`),
    fighter1ImageUrl: nullableString(record, 'fighter1ImageUrl', context),
    fighter2ImageUrl: nullableString(record, 'fighter2ImageUrl', context),
  };
}

function parseFightEvent(value: unknown, context: string): FightEventDto {
  const record = asRecord(value, context);

  const boutValue = record.bout;
  const bout =
    boutValue === null || boutValue === undefined
      ? null
      : parseMmaBout(boutValue, `${context}.bout`);

  const resultValue = record.result;
  const result =
    resultValue === null || resultValue === undefined
      ? null
      : parseMmaResult(resultValue, `${context}.result`);

  return {
    id: requiredString(record, 'id', context),
    name: requiredString(record, 'name', context),
    sport: requiredString(record, 'sport', context),
    sportKey: requiredString(record, 'sportKey', context),
    status: requiredString(record, 'status', context),
    startTime: requiredString(record, 'startTime', context),
    competition: nullableString(record, 'competition', context),
    bout,
    markets: requiredArray(record, 'markets', context).map((market, index) =>
      parseMarket(market, `${context}.markets[${index}]`),
    ),
    oddsUpdatedAt: nullableString(record, 'oddsUpdatedAt', context),
    endsAt: requiredString(record, 'endsAt', context),
    isExpired: requiredBoolean(record, 'isExpired', context),
    isBettingOpen: requiredBoolean(record, 'isBettingOpen', context),
    result,
  };
}

function parseFightingEvent(value: unknown, context: string): FightingEventDto {
  const record = asRecord(value, context);

  return {
    id: requiredString(record, 'id', context),
    name: requiredString(record, 'name', context),
    slug: requiredString(record, 'slug', context),
    startTime: requiredString(record, 'startTime', context),
    promotion: parsePromotion(record.promotion, `${context}.promotion`),
    fights: requiredArray(record, 'fights', context).map((fight, index) =>
      parseFightEvent(fight, `${context}.fights[${index}]`),
    ),
  };
}

function parseUpcomingEvents(payload: unknown): UpcomingEventsResponse {
  const record = asRecord(payload, 'events/upcoming');

  return {
    events: requiredArray(record, 'events', 'events/upcoming').map((event, index) =>
      parseFightingEvent(event, `events[${index}]`),
    ),
    fights: requiredArray(record, 'fights', 'events/upcoming').map((fight, index) =>
      parseFightEvent(fight, `fights[${index}]`),
    ),
  };
}

function parseBetResponse(payload: unknown): BetResponse {
  const record = asRecord(payload, 'bets/place');

  return {
    success: requiredBoolean(record, 'success', 'bets/place'),
    betId: nullableString(record, 'betId', 'bets/place'),
    transactionId: nullableString(record, 'transactionId', 'bets/place'),
    newBalance: nullableNumber(record, 'newBalance', 'bets/place'),
    idempotentReplay: requiredBoolean(record, 'idempotentReplay', 'bets/place'),
  };
}

/* ==========================================================================
   API pública
   ========================================================================== */

/**
 * `GET /api/v1/promotions[?tier=N]`.
 * El backend acepta el enum numérico o su nombre como query string.
 */
export async function getPromotions(tier?: number): Promise<readonly PromotionDto[]> {
  if (tier !== undefined && !isPromotionTier(tier)) {
    throw validationError('tier', 'El tier debe ser un valor de PromotionTier (1–4).');
  }

  const query = tier === undefined ? '' : `?tier=${tier}`;
  const response = await requestJson(`${ZENBET_ENDPOINTS.promotions}${query}`, {
    method: 'GET',
  });

  if (!response.ok) throw buildHttpError(response);

  if (!Array.isArray(response.payload)) {
    throw invalidResponse('promotions', 'se esperaba un array de promotoras.');
  }

  return response.payload.map((promotion, index) =>
    parsePromotion(promotion, `promotions[${index}]`),
  );
}

/**
 * `GET /api/v1/events/upcoming` — carteleras y lista plana de combates.
 *
 * El backend devuelve ambos niveles (`UpcomingEventsDto`): `events` agrupa los
 * combates por cartelera y `fights` los repite en plano. Se conservan los dos
 * para no perder información ni obligar a reconstruirla en el cliente.
 */
export async function getUpcomingEvents(): Promise<UpcomingEventsResponse> {
  const response = await requestJson(ZENBET_ENDPOINTS.upcomingEvents, {
    method: 'GET',
  });

  if (!response.ok) throw buildHttpError(response);

  return parseUpcomingEvents(response.payload);
}

/**
 * `POST /api/v1/bets/place`.
 *
 * La clave de idempotencia es obligatoria y debe ser un GUID: el backend la
 * valida antes de tocar la billetera. Un 409 significa que la clave ya fue
 * usada con otra solicitud; se expone como `isIdempotencyConflict`.
 */
export async function placeBet(
  request: PlaceBetRequest,
  idempotencyKey: string,
): Promise<BetResponse> {
  validatePlaceBetRequest(request);
  validateIdempotencyKey(idempotencyKey);

  const response = await requestJson(ZENBET_ENDPOINTS.placeBet, {
    method: 'POST',
    headers: {
      [IDEMPOTENCY_HEADER]: idempotencyKey,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = buildHttpError(response);

    if (response.status === 401) {
      authToken.clear('unauthorized');
      emitUnauthorized(error);
    }

    throw error;
  }

  const bet = parseBetResponse(response.payload);

  if (!bet.success) {
    throw new ZenBetApiError({
      code: 'BET_REJECTED',
      status: response.status,
      title: 'Apuesta rechazada',
      detail: 'El servidor respondió sin confirmar la apuesta.',
    });
  }

  return bet;
}

export const zenbetClient = {
  getPromotions,
  getUpcomingEvents,
  placeBet,
} as const;

export default zenbetClient;
