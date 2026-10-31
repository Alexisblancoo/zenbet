import { z } from 'zod';

/* ==========================================================================
   1. CONTEXTO GLOBAL DE TELEMETRÍA (Sesión, Dispositivo, Ruta)
   ========================================================================== */

export const TelemetryContextSchema = z.object({
  userId: z.string().optional(),
  walletId: z.string().optional(),
  sessionId: z.string().min(1),
  userAgent: z.string(),
  currentPath: z.string(),
  timestamp: z.string(),
});

export type TelemetryContext = z.infer<typeof TelemetryContextSchema>;

/* ==========================================================================
   2. EVENTOS DE NEGOCIO Y ANTI-FRAUDE (Discriminated Union)
   ========================================================================== */

/** Evento: El usuario intentó apostar pero la cuota varió durante la confirmación */
export const BetCancelledOddsChangedEvent = z.object({
  eventType: z.literal('BET_CANCELLED_ODDS_CHANGED'),
  payload: z.object({
    marketId: z.string(),
    selectionId: z.string(),
    initialOdds: z.number().gt(1),
    newOdds: z.number().gt(1),
    stake: z.number().positive(),
  }),
});

/** Evento: Clic / Interacción en una cartelera deportiva */
export const CardClickEvent = z.object({
  eventType: z.literal('CARD_CLICKED'),
  payload: z.object({
    sportType: z.enum(['soccer', 'basketball', 'tennis', 'boxing']),
    eventId: z.string(),
    componentOrigin: z.string(),
  }),
});

/** Evento: Intento de retiro bloqueado por KYC UNVERIFIED */
export const WithdrawalBlockedKycEvent = z.object({
  eventType: z.literal('WITHDRAWAL_ATTEMPT_BLOCKED_KYC'),
  payload: z.object({
    requestedAmount: z.number().positive(),
    currentKycStatus: z.string(),
  }),
});

/** Evento: Observación de parpadeo de cuota en vivo (SignalR live update) */
export const OddsFlashObservedEvent = z.object({
  eventType: z.literal('ODDS_FLASH_OBSERVED'),
  payload: z.object({
    selectionId: z.string(),
    direction: z.enum(['up', 'down', 'neutral']),
    newOdd: z.number().gt(1),
  }),
});

/** Evento: Simulación de depósito en Sandbox */
export const SandboxDepositSimulatedEvent = z.object({
  eventType: z.literal('SANDBOX_DEPOSIT_SIMULATED'),
  payload: z.object({
    amount: z.number().positive(),
    newBalance: z.number(),
  }),
});

/** Evento: Acción de riesgo ejecutada en Admin Backoffice */
export const AdminRiskActionTriggeredEvent = z.object({
  eventType: z.literal('ADMIN_RISK_ACTION_TRIGGERED'),
  payload: z.object({
    targetUserId: z.string(),
    actionType: z.string(),
    flagReason: z.string(),
  }),
});

export const TrackingEventSchema = z.discriminatedUnion('eventType', [
  BetCancelledOddsChangedEvent,
  CardClickEvent,
  WithdrawalBlockedKycEvent,
  OddsFlashObservedEvent,
  SandboxDepositSimulatedEvent,
  AdminRiskActionTriggeredEvent,
]);

export type TrackingEvent = z.infer<typeof TrackingEventSchema>;

export const TrackingEnvelopeSchema = z.object({
  context: TelemetryContextSchema,
  events: z.array(TrackingEventSchema),
});

export type TrackingEnvelope = z.infer<typeof TrackingEnvelopeSchema>;

