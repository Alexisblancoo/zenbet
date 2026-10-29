/**
 * Contratos de la Web API de ZenBet.
 *
 * Fuente de verdad: backend .NET 10
 * (`Zenbet.EventsMarkets.Application/DTOs` y `Endpoints/BetsEndpoints.cs`).
 * No se declaran campos que la API no publique ni se usan `any`.
 */

/** Alcance competitivo de una promotora de MMA (valores del backend). */
export enum PromotionTier {
  Global = 1,
  Regional = 2,
  Niche = 3,
  AmateurOrDevelopmental = 4,
}

/**
 * Promotora publicada por `GET /api/v1/promotions`.
 *
 * En el wire, `tier` viaja como nombre (`"Global"`, `"Regional"`, …) porque el
 * backend serializa `PromotionTier.ToString()`. `zenbetClient` lo normaliza al
 * enum numérico para que la UI compare siempre contra `PromotionTier`.
 */
export interface PromotionDto {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly tier: PromotionTier;
  readonly countryCode: string;
}

/** Selección apostable de un mercado. */
export interface SelectionDto {
  readonly id: string;
  readonly code: string | null;
  readonly name: string;
  /** Cuota decimal vigente (siempre > 1). */
  readonly decimalOdds: number;
  /** Representación americana ya formateada por el backend (`+120`, `-145`). */
  readonly americanOdds: string;
  readonly displayOrder: number;
  readonly settled: boolean;
  readonly provider: string | null;
  readonly updatedAt: string | null;
}

/** Procedencia editorial de una cuota. */
export interface MarketSourceDto {
  readonly kind: string;
  readonly name: string;
  readonly url: string | null;
  readonly observedAt: string;
  readonly note: string | null;
}

/** Mercado de un combate. */
export interface MarketDto {
  readonly id: string;
  readonly type: string;
  readonly typeKey: string;
  readonly name: string;
  readonly line: number | null;
  readonly displayOrder: number;
  readonly status: string;
  readonly provider: string | null;
  readonly updatedAt: string | null;
  readonly source: MarketSourceDto | null;
  readonly selections: readonly SelectionDto[];
}

/** Resultado oficial de un combate. */
export interface MmaResultDto {
  readonly winnerCorner: string;
  readonly winnerName: string;
  readonly method: string;
  readonly methodLabel: string;
  readonly round: number;
  readonly recordedAt: string;
}

/** Perfil de un peleador. */
export interface FighterDto {
  readonly id: string;
  readonly name: string;
  readonly countryCode: string;
  readonly country: string;
  readonly record: string;
  readonly rank: string | null;
  readonly division: string;
  readonly divisionLabel: string;
  readonly imageUrl: string | null;
  readonly wins: number;
  readonly losses: number;
  readonly draws: number;
  readonly winRate: number;
  readonly reachInches: number | null;
  readonly stance: string | null;
  readonly takedownDefensePercent: number | null;
  readonly strikingAccuracyPercent: number | null;
}

/** Contexto y esquinas de un combate. */
export interface MmaBoutDto {
  readonly weightDivision: string;
  readonly weightDivisionLabel: string;
  readonly weightLimitLbs: number;
  readonly scheduledRounds: number;
  readonly isTitleFight: boolean;
  readonly billing: string;
  readonly billingLabel: string;
  readonly billingOrder: number;
  readonly venue: string;
  readonly location: string;
  readonly red: FighterDto;
  readonly blue: FighterDto;
  readonly fighter1ImageUrl: string | null;
  readonly fighter2ImageUrl: string | null;
}

/**
 * Combate individual (`EventDto` en el backend).
 *
 * El endpoint de próximos eventos entrega un `EventDto` por pelea, aunque la
 * cartelera los agrupa dentro de `FightingEventDto.fights`.
 */
export interface FightEventDto {
  readonly id: string;
  readonly name: string;
  readonly sport: string;
  readonly sportKey: string;
  readonly status: string;
  readonly startTime: string;
  readonly competition: string | null;
  readonly bout: MmaBoutDto | null;
  readonly markets: readonly MarketDto[];
  readonly oddsUpdatedAt: string | null;
  readonly endsAt: string;
  readonly isExpired: boolean;
  readonly isBettingOpen: boolean;
  readonly result: MmaResultDto | null;
}

/**
 * Cartelera próxima (`UpcomingFightingEventDto` en el backend).
 * Es la unidad que devuelve `GET /api/v1/events/upcoming` dentro de `events`.
 */
export interface FightingEventDto {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly startTime: string;
  readonly promotion: PromotionDto;
  readonly fights: readonly FightEventDto[];
}

/** Cuerpo exacto de `GET /api/v1/events/upcoming`. */
export interface UpcomingEventsResponse {
  readonly events: readonly FightingEventDto[];
  /**
   * Lista plana de todos los combates de la respuesta. Se mantiene para
   * consumidores que solo necesitan peleas, sin duplicar el tipado.
   */
  readonly fights: readonly FightEventDto[];
}

/** Cuerpo exacto de `POST /api/v1/bets/place`. */
export interface PlaceBetRequest {
  readonly walletId: string;
  readonly selectionId: string;
  readonly amount: number;
  readonly description: string;
  readonly promoCode?: string;
}

/** Respuesta exacta de `POST /api/v1/bets/place`. */
export interface BetResponse {
  readonly success: boolean;
  readonly betId: string | null;
  readonly transactionId: string | null;
  readonly newBalance: number | null;
  /** `true` cuando el servidor devolvió el resultado de la misma clave. */
  readonly idempotentReplay: boolean;
}

/**
 * Evento `ReceiveOddsUpdate` del hub de cuotas, ya normalizado.
 * El wire real es `{ marketId, oddsUpdate: { selectionId, newOdd, … } }`.
 */
export interface OddsUpdateDto {
  readonly marketId: string;
  readonly selectionId: string;
  readonly decimalOdds: number;
  readonly updatedAt: string | null;
}

/** Evento `ReceiveFightUpdate` del hub de combates (`FightUpdateDto`). */
export interface FightUpdateDto {
  readonly eventId: string;
  readonly status: string;
  readonly isExpired: boolean;
  readonly isBettingOpen: boolean;
  readonly startTime: string;
  readonly endsAt: string;
  readonly result: MmaResultDto | null;
  readonly updatedAt: string;
}
