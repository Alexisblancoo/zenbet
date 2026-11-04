/**
 * Contratos estrictos (Zero-Any) del Motor de Riesgo y Exposición (Risk & Liability Engine)
 * para el Panel de Administración y telemetría SignalR de ZenBet.
 */

export type MarketOperationalStatus = 'Open' | 'Suspended' | 'Settled' | 'Void';

export type RiskThresholdLevel =
  | 'NOMINAL'
  | 'ELEVATED_75'
  | 'CRITICAL_95_SUSPENDED'
  | 'LIMIT_EXCEEDED_100';

/**
 * Exposición financiera acumulada por selección individual (SelectionLiability).
 */
export interface SelectionLiabilityDto {
  readonly selectionId: string;
  readonly selectionName: string;
  readonly currentOdds: number;
  readonly totalStaked: number;
  readonly potentialPayout: number;
  readonly netProfitLiability: number;
  readonly activeBetCount: number;
  readonly shareOfMarketLiabilityPercent: number;
}

/**
 * DTO principal de exposición agregada y estado del Circuit Breaker por mercado.
 */
export interface MarketExposureDto {
  readonly marketId: string;
  readonly eventId: string;
  readonly marketName: string;
  readonly status: MarketOperationalStatus;
  readonly isSuspendedByRisk: boolean;
  readonly currentLiability: number;
  readonly maxLiabilityLimit: number;
  readonly utilizationPercentage: number;
  readonly thresholdLevel: RiskThresholdLevel;
  readonly selections: readonly SelectionLiabilityDto[];
  readonly updatedAt: string;
}

/**
 * Utility Type: Vista compacta de estado de suspensión por riesgo (Circuit Breaker)
 * para cabeceras y badges de monitoreo en tiempo real.
 * // TODO: Reserved for future implementation
 */
export type MarketRiskSuspensionStateDto = Pick<
  MarketExposureDto,
  | 'marketId'
  | 'status'
  | 'isSuspendedByRisk'
  | 'currentLiability'
  | 'maxLiabilityLimit'
  | 'utilizationPercentage'
  | 'thresholdLevel'
>;

/**
 * Utility Type: Resumen ligero de tabla de mercados sin el arreglo anidado de selecciones.
 * // TODO: Reserved for future implementation
 */
export type MarketExposureSummaryDto = Omit<MarketExposureDto, 'selections'> & {
  readonly selectionCount: number;
};

/**
 * Tipo refinado (Narrowed Type) para mercados donde el Circuit Breaker del 95% se disparó.
 */
export type SuspendedByRiskMarketDto = Omit<
  MarketExposureDto,
  'status' | 'isSuspendedByRisk' | 'thresholdLevel'
> & {
  readonly status: Extract<MarketOperationalStatus, 'Suspended'>;
  readonly isSuspendedByRisk: true;
  readonly thresholdLevel: Extract<
    RiskThresholdLevel,
    'CRITICAL_95_SUSPENDED' | 'LIMIT_EXCEEDED_100'
  >;
};

/**
 * Evento en tiempo real emitido cuando un mercado alcanza >= 95% de MaxLiabilityLimit
 * (`MarketSuspendedByRiskDomainEvent`).
 */
export interface MarketSuspendedByRiskEventDto {
  readonly marketId: string;
  readonly eventId: string;
  readonly triggeringSelectionId: string;
  readonly currentLiability: number;
  readonly maxLiabilityLimit: number;
  readonly utilizationPercentage: number;
  readonly isSuspendedByRisk: true;
  readonly occurredAt: string;
}

/**
 * Type Guard estricto para identificar mercados suspendidos automáticamente por el Circuit Breaker.
 * // TODO: Reserved for future implementation
 */
export function isMarketSuspendedByRisk(
  market: MarketExposureDto
): market is SuspendedByRiskMarketDto {
  return (
    market.isSuspendedByRisk &&
    market.status === 'Suspended' &&
    (market.thresholdLevel === 'CRITICAL_95_SUSPENDED' ||
      market.thresholdLevel === 'LIMIT_EXCEEDED_100')
  );
}

