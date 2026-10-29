/**
 * Cliente SignalR de ZenBet.
 *
 * El backend publica dos hubs reales (`Program.cs`):
 *   - `/odds-hub`   → cuotas por mercado (`ReceiveOddsUpdate`).
 *   - `/fight-hub`  → ciclo de vida del combate (`ReceiveFightUpdate`).
 *
 * `/hubs/events` no existe en la API actual. Si un gateway lo expone, se puede
 * apuntar cada canal con `VITE_HUB_URL` y `VITE_FIGHT_HUB_URL` sin tocar código.
 *
 * El cliente mantiene una conexión por canal, gestiona grupos (join/leave),
 * reconexión con backoff y re-suscripción automática tras reconectar.
 */

import {
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
  type HubConnection,
  type IRetryPolicy,
} from '@microsoft/signalr';

import { API_BASE_URL, authToken } from '@/api';
import type { FightUpdateDto, MmaResultDto, OddsUpdateDto } from '@/types/zenbet';

/* ==========================================================================
   URLs y contratos del hub
   ========================================================================== */

export const ZENBET_ODDS_HUB_PATH = '/odds-hub';
export const ZENBET_FIGHT_HUB_PATH = '/fight-hub';

export const ZENBET_REALTIME_EVENTS = {
  oddsUpdate: 'ReceiveOddsUpdate',
  fightUpdate: 'ReceiveFightUpdate',
} as const;

export const ZENBET_REALTIME_METHODS = {
  joinMarket: 'JoinMarketGroup',
  leaveMarket: 'LeaveMarketGroup',
  joinEvent: 'JoinEventGroup',
  leaveEvent: 'LeaveEventGroup',
} as const;

function resolveHubUrl(path: string, override: string | undefined): string {
  const configured = override?.trim();
  if (configured) return configured.replace(/\/+$/, '');

  try {
    return new URL(path, API_BASE_URL).href;
  } catch {
    // API_BASE_URL relativa (p. ej. `/api/v1`): el hub vive en la raíz.
    return path;
  }
}

export const ZENBET_ODDS_HUB_URL = resolveHubUrl(
  ZENBET_ODDS_HUB_PATH,
  import.meta.env.VITE_HUB_URL,
);

export const ZENBET_FIGHT_HUB_URL = resolveHubUrl(
  ZENBET_FIGHT_HUB_PATH,
  import.meta.env.VITE_FIGHT_HUB_URL,
);

/* ==========================================================================
   Estado y opciones
   ========================================================================== */

export type ZenBetRealtimeStatus =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected';

type HubKind = 'odds' | 'fight';

export interface ZenBetRealtimeOptions {
  readonly oddsHubUrl?: string;
  readonly fightHubUrl?: string;
  /**
   * Se evalúa en cada (re)conexión: un token renovado se propaga sin recrear
   * el cliente.
   */
  readonly accessTokenFactory?: () => string | Promise<string>;
  readonly logLevel?: LogLevel;
}

const RECONNECT_BASE_DELAY_MS = 1_000;
const RECONNECT_MAX_DELAY_MS = 30_000;

/**
 * Backoff exponencial con jitter. Devuelve siempre un número: SignalR no debe
 * rendirse mientras el cliente siga montado.
 */
const reconnectPolicy: IRetryPolicy = {
  nextRetryDelayInMilliseconds({ previousRetryCount }) {
    const exponent = Math.min(Math.max(previousRetryCount, 0), 5);
    const delay = Math.min(
      RECONNECT_MAX_DELAY_MS,
      RECONNECT_BASE_DELAY_MS * 2 ** exponent,
    );
    const jitter = 0.85 + Math.random() * 0.3;

    return Math.round(delay * jitter);
  },
};

function buildConnection(
  url: string,
  options: ZenBetRealtimeOptions,
): HubConnection {
  const accessTokenFactory: () => string | Promise<string> =
    options.accessTokenFactory ?? (() => authToken.get() ?? '');

  return new HubConnectionBuilder()
    .withUrl(url, {
      accessTokenFactory,
      withCredentials: false,
    })
    .withAutomaticReconnect(reconnectPolicy)
    .configureLogging(
      options.logLevel ?? (import.meta.env.DEV ? LogLevel.Warning : LogLevel.Error),
    )
    .build();
}

/* ==========================================================================
   Normalización de payloads
   ========================================================================== */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

const TERMINAL_STATUSES = new Set([
  'finished',
  'cancelled',
  'canceled',
  'void',
  'finalizado',
  'cancelado',
  'anulado',
]);

function parseRealtimeResult(value: unknown): MmaResultDto | null {
  if (!isRecord(value)) return null;

  const winnerCorner = readString(value.winnerCorner);
  const winnerName = readString(value.winnerName);
  const method = readString(value.method);
  const methodLabel = readString(value.methodLabel);
  const round = readNumber(value.round);
  const recordedAt = readString(value.recordedAt);

  if (
    !winnerCorner ||
    !winnerName ||
    !method ||
    !methodLabel ||
    round === null ||
    !recordedAt
  ) {
    return null;
  }

  return { winnerCorner, winnerName, method, methodLabel, round, recordedAt };
}

/**
 * `ReceiveOddsUpdate` real:
 * `{ marketId, oddsUpdate: { selectionId, newOdd, marketId, timestamp } }`.
 */
export function parseOddsUpdatePayload(payload: unknown): OddsUpdateDto | null {
  if (!isRecord(payload)) return null;

  const nested = isRecord(payload.oddsUpdate) ? payload.oddsUpdate : payload;
  const selectionId =
    readString(nested.selectionId) ?? readString(nested.selection);
  const marketId =
    readString(nested.marketId) ?? readString(payload.marketId);
  const decimalOdds =
    readNumber(nested.newOdd) ??
    readNumber(nested.odds) ??
    readNumber(nested.price);

  if (!selectionId || !marketId || decimalOdds === null || decimalOdds <= 1) {
    return null;
  }

  const updatedAt =
    readString(nested.timestamp) ??
    readString(nested.occurredAt) ??
    readString(payload.timestamp);

  return { marketId, selectionId, decimalOdds, updatedAt };
}

/** `ReceiveFightUpdate` (`FightUpdateDto`) con tolerancia a alias. */
export function parseFightUpdatePayload(payload: unknown): FightUpdateDto | null {
  if (!isRecord(payload)) return null;

  const eventId = readString(payload.eventId);
  const status =
    readString(payload.effectiveStatus) ?? readString(payload.status);
  const startTime = readString(payload.startTime);
  const endsAt = readString(payload.endsAt);
  const updatedAt = readString(payload.updatedAt);

  if (!eventId || !status || !startTime || !endsAt || !updatedAt) return null;

  const terminal = TERMINAL_STATUSES.has(status.toLowerCase());
  const isExpired = readBoolean(payload.isExpired) ?? terminal;
  const isBettingOpen =
    readBoolean(payload.isBettingOpen) ??
    (!isExpired &&
      (status.toLowerCase() === 'scheduled' || status.toLowerCase() === 'live'));

  return {
    eventId,
    status,
    isExpired,
    isBettingOpen,
    startTime,
    endsAt,
    result: parseRealtimeResult(payload.result),
    updatedAt,
  };
}

function normalizeIds(ids: Iterable<string>): Set<string> {
  const normalized = new Set<string>();

  for (const id of ids) {
    const trimmed = id.trim();
    if (trimmed) normalized.add(trimmed);
  }

  return normalized;
}

/* ==========================================================================
   Cliente
   ========================================================================== */

export class ZenBetRealtimeClient {
  private readonly oddsConnection: HubConnection;
  private readonly fightConnection: HubConnection;

  private readonly oddsHandlers = new Set<(update: OddsUpdateDto) => void>();
  private readonly fightHandlers = new Set<(update: FightUpdateDto) => void>();
  private readonly statusHandlers = new Set<(status: ZenBetRealtimeStatus) => void>();
  private readonly errorHandlers = new Set<(error: unknown) => void>();

  private desiredMarkets = new Set<string>();
  private desiredEvents = new Set<string>();
  private subscribedMarkets = new Set<string>();
  private subscribedEvents = new Set<string>();

  private hubStatus: Record<HubKind, ZenBetRealtimeStatus> = {
    odds: 'disconnected',
    fight: 'disconnected',
  };

  private currentStatus: ZenBetRealtimeStatus = 'disconnected';
  private started = false;
  private stopped = false;

  private readonly reconnectTimers: Record<
    HubKind,
    ReturnType<typeof setTimeout> | null
  > = { odds: null, fight: null };

  private readonly reconnectAttempts: Record<HubKind, number> = {
    odds: 0,
    fight: 0,
  };

  private operationQueue: Promise<void> = Promise.resolve();

  constructor(options: ZenBetRealtimeOptions = {}) {
    this.oddsConnection = buildConnection(
      options.oddsHubUrl ?? ZENBET_ODDS_HUB_URL,
      options,
    );
    this.fightConnection = buildConnection(
      options.fightHubUrl ?? ZENBET_FIGHT_HUB_URL,
      options,
    );

    this.bindConnection('odds', this.oddsConnection);
    this.bindConnection('fight', this.fightConnection);
  }

  get status(): ZenBetRealtimeStatus {
    return this.currentStatus;
  }

  /** Abre ambos canales. La reconexión se gestiona internamente. */
  start(): void {
    if (this.started || this.stopped) return;

    this.started = true;
    void this.connectHub('odds');
    void this.connectHub('fight');
  }

  /** Cierra ambos canales y libera los timers de reconexión. */
  async stop(): Promise<void> {
    if (this.stopped) return;

    this.stopped = true;
    this.started = false;

    for (const kind of ['odds', 'fight'] as const) {
      const timer = this.reconnectTimers[kind];
      if (timer !== null) {
        clearTimeout(timer);
        this.reconnectTimers[kind] = null;
      }
    }

    this.subscribedMarkets.clear();
    this.subscribedEvents.clear();

    const stops: Promise<void>[] = [];

    if (this.oddsConnection.state !== HubConnectionState.Disconnected) {
      stops.push(this.oddsConnection.stop().catch(() => undefined));
    }

    if (this.fightConnection.state !== HubConnectionState.Disconnected) {
      stops.push(this.fightConnection.stop().catch(() => undefined));
    }

    await Promise.all(stops);

    this.hubStatus = { odds: 'disconnected', fight: 'disconnected' };
    this.publishStatus();
  }

  onOddsUpdate(handler: (update: OddsUpdateDto) => void): () => void {
    this.oddsHandlers.add(handler);
    return () => this.oddsHandlers.delete(handler);
  }

  onFightUpdate(handler: (update: FightUpdateDto) => void): () => void {
    this.fightHandlers.add(handler);
    return () => this.fightHandlers.delete(handler);
  }

  onStatusChange(
    handler: (status: ZenBetRealtimeStatus) => void,
  ): () => void {
    this.statusHandlers.add(handler);
    handler(this.currentStatus);

    return () => this.statusHandlers.delete(handler);
  }

  onError(handler: (error: unknown) => void): () => void {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }

  /**
   * Declara los mercados visibles. El cliente hace el diff contra los grupos
   * ya suscritos y re-suscribe todo tras una reconexión.
   */
  setMarketSubscriptions(marketIds: Iterable<string>): Promise<void> {
    this.desiredMarkets = normalizeIds(marketIds);
    return this.enqueue(() => this.syncMarkets());
  }

  /** Declara los combates visibles (`eventId` del hub de combates). */
  setEventSubscriptions(eventIds: Iterable<string>): Promise<void> {
    this.desiredEvents = normalizeIds(eventIds);
    return this.enqueue(() => this.syncEvents());
  }

  /* ---------------------------------------------------------------------- */
  /* Internos                                                               */
  /* ---------------------------------------------------------------------- */

  private bindConnection(kind: HubKind, connection: HubConnection): void {
    if (kind === 'odds') {
      connection.on(ZENBET_REALTIME_EVENTS.oddsUpdate, this.handleOddsUpdate);
    } else {
      connection.on(ZENBET_REALTIME_EVENTS.fightUpdate, this.handleFightUpdate);
    }

    connection.onreconnecting(() => {
      this.updateHubStatus(kind, 'reconnecting');
    });

    connection.onreconnected(() => {
      this.reconnectAttempts[kind] = 0;
      this.updateHubStatus(kind, 'connected');
      void this.resync(kind);
    });

    connection.onclose(() => {
      this.updateHubStatus(kind, 'disconnected');
      this.scheduleReconnect(kind);
    });
  }

  private readonly handleOddsUpdate = (payload: unknown): void => {
    const update = parseOddsUpdatePayload(payload);
    if (!update) return;

    for (const handler of this.oddsHandlers) {
      try {
        handler(update);
      } catch (error) {
        this.emitError(error);
      }
    }
  };

  private readonly handleFightUpdate = (payload: unknown): void => {
    const update = parseFightUpdatePayload(payload);
    if (!update) return;

    for (const handler of this.fightHandlers) {
      try {
        handler(update);
      } catch (error) {
        this.emitError(error);
      }
    }
  };

  private async connectHub(kind: HubKind): Promise<void> {
    const connection = this.connection(kind);

    if (
      !this.started ||
      this.stopped ||
      connection.state !== HubConnectionState.Disconnected
    ) {
      return;
    }

    this.updateHubStatus(kind, 'connecting');

    try {
      await connection.start();

      if (!this.started || this.stopped) {
        await connection.stop().catch(() => undefined);
        return;
      }

      this.reconnectAttempts[kind] = 0;
      this.updateHubStatus(kind, 'connected');
      await this.resync(kind);
    } catch (error) {
      this.updateHubStatus(kind, 'disconnected');
      this.emitError(error);
      this.scheduleReconnect(kind);
    }
  }

  private scheduleReconnect(kind: HubKind): void {
    if (!this.started || this.stopped || this.reconnectTimers[kind] !== null) {
      return;
    }

    const attempt = this.reconnectAttempts[kind]++;
    const exponent = Math.min(attempt, 5);
    const delay = Math.min(
      RECONNECT_MAX_DELAY_MS,
      RECONNECT_BASE_DELAY_MS * 2 ** exponent,
    );
    const jitter = 0.85 + Math.random() * 0.3;

    this.reconnectTimers[kind] = setTimeout(() => {
      this.reconnectTimers[kind] = null;
      void this.connectHub(kind);
    }, Math.round(delay * jitter));
  }

  private async resync(kind: HubKind): Promise<void> {
    if (kind === 'odds') {
      this.subscribedMarkets.clear();
      await this.syncMarkets();
      return;
    }

    this.subscribedEvents.clear();
    await this.syncEvents();
  }

  private async syncMarkets(): Promise<void> {
    const connection = this.oddsConnection;

    if (connection.state !== HubConnectionState.Connected) return;

    for (const marketId of [...this.subscribedMarkets]) {
      if (this.desiredMarkets.has(marketId)) continue;

      if (await this.invokeSafely(connection, ZENBET_REALTIME_METHODS.leaveMarket, marketId)) {
        this.subscribedMarkets.delete(marketId);
      }
    }

    for (const marketId of this.desiredMarkets) {
      if (this.subscribedMarkets.has(marketId)) continue;

      if (await this.invokeSafely(connection, ZENBET_REALTIME_METHODS.joinMarket, marketId)) {
        this.subscribedMarkets.add(marketId);
      }
    }
  }

  private async syncEvents(): Promise<void> {
    const connection = this.fightConnection;

    if (connection.state !== HubConnectionState.Connected) return;

    for (const eventId of [...this.subscribedEvents]) {
      if (this.desiredEvents.has(eventId)) continue;

      if (await this.invokeSafely(connection, ZENBET_REALTIME_METHODS.leaveEvent, eventId)) {
        this.subscribedEvents.delete(eventId);
      }
    }

    for (const eventId of this.desiredEvents) {
      if (this.subscribedEvents.has(eventId)) continue;

      if (await this.invokeSafely(connection, ZENBET_REALTIME_METHODS.joinEvent, eventId)) {
        this.subscribedEvents.add(eventId);
      }
    }
  }

  private async invokeSafely(
    connection: HubConnection,
    method: string,
    argument: string,
  ): Promise<boolean> {
    try {
      await connection.invoke(method, argument);
      return true;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn(`[zenbet/realtime] Falló ${method}(${argument}).`, error);
      }

      return false;
    }
  }

  private enqueue(task: () => Promise<void>): Promise<void> {
    const next = this.operationQueue.then(task, task);
    this.operationQueue = next.catch(() => undefined);
    return next;
  }

  private connection(kind: HubKind): HubConnection {
    return kind === 'odds' ? this.oddsConnection : this.fightConnection;
  }

  private updateHubStatus(kind: HubKind, status: ZenBetRealtimeStatus): void {
    if (this.hubStatus[kind] === status) return;

    this.hubStatus = { ...this.hubStatus, [kind]: status };
    this.publishStatus();
  }

  private publishStatus(): void {
    const { odds, fight } = this.hubStatus;

    let next: ZenBetRealtimeStatus;

    if (odds === 'disconnected' && fight === 'disconnected') {
      next = 'disconnected';
    } else if (odds === 'connected' && fight === 'connected') {
      next = 'connected';
    } else if (odds === 'reconnecting' || fight === 'reconnecting') {
      next = 'reconnecting';
    } else if (
      (odds === 'connected' && fight === 'disconnected') ||
      (fight === 'connected' && odds === 'disconnected')
    ) {
      // Un canal vivo y el otro esperando reintento: la sesión no está completa.
      next = 'reconnecting';
    } else {
      next = 'connecting';
    }

    if (next === this.currentStatus) return;

    this.currentStatus = next;

    for (const handler of this.statusHandlers) {
      try {
        handler(next);
      } catch (error) {
        this.emitError(error);
      }
    }
  }

  private emitError(error: unknown): void {
    for (const handler of this.errorHandlers) {
      try {
        handler(error);
      } catch {
        // Un handler de error nunca debe romper el ciclo de SignalR.
      }
    }
  }
}

export function createZenBetRealtimeClient(
  options: ZenBetRealtimeOptions = {},
): ZenBetRealtimeClient {
  return new ZenBetRealtimeClient(options);
}
