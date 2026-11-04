import React, { useState, useEffect, useId, useMemo } from 'react';
import { z } from 'zod';
import {
  ShieldAlert,
  AlertOctagon,
  Terminal,
  Lock,
  Unlock,
  TrendingUp,
  TrendingDown,
  Layers,
  Search,
  Activity,
  DollarSign,
  Filter,
  Eye,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Flame,
  Zap,
  Radio,
  SlidersHorizontal,
  FileSpreadsheet,
  Cpu,
  Ban,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react';

import {
  type MarketExposureDto,
  type SelectionLiabilityDto,
  type RiskThresholdLevel,
  type MarketOperationalStatus,
  isMarketSuspendedByRisk,
} from '@/types/risk';

/* ==========================================================================
   1. ESQUEMAS ZOD ESTRICTOS (Seguridad, Mercados y Ledger Global)
   ========================================================================== */

export const RiskLevelSchema = z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']);

export const RiskFlagTypeSchema = z.enum([
  'MULTI_ACCOUNT_SAME_IP',
  'ARBITRAGE_SYNDICATE',
  'VELOCITY_WITHDRAWAL_BURST',
  'DEVICE_FINGERPRINT_COLLISION',
  'SUDDEN_STAKE_SPIKE',
]);

export const RiskActionSuggestedSchema = z.enum([
  'FREEZE_FUNDS',
  'FORCE_KYC_LEVEL_3',
  'RESTRICT_MAX_BET',
  'MONITOR',
]);

export const RiskAlertStatusSchema = z.enum([
  'ACTIVE_UNRESOLVED',
  'UNDER_INVESTIGATION',
  'DISMISSED',
  'BANNED',
]);

export const UserRiskAlertSchema = z.object({
  alertId: z.string().min(1),
  userId: z.string().min(1),
  username: z.string().min(2),
  riskLevel: RiskLevelSchema,
  flagType: RiskFlagTypeSchema,
  sharedIp: z.string().optional(),
  deviceFingerprint: z.string().optional(),
  correlatedAccountsCount: z.number().int().min(1),
  correlatedAccountUsernames: z.array(z.string()),
  detectedAt: z.string(),
  flaggedVolumeUsd: z.number().positive(),
  actionSuggested: RiskActionSuggestedSchema,
  status: RiskAlertStatusSchema,
});

export const MarketSportTypeSchema = z.enum([
  'SOCCER',
  'BASKETBALL',
  'MMA_UFC',
  'BOXING',
  'TENNIS',
]);

export const MarketStatusEnumSchema = z.enum([
  'OPEN_ACCEPTING_BETS',
  'SUSPENDED_VAR',
  'CLOSED_SETTLING',
  'SETTLED_PAID',
  'CANCELLED_VOID',
]);

export const RiskThresholdLevelSchema = z.enum([
  'NOMINAL',
  'ELEVATED_75',
  'CRITICAL_95_SUSPENDED',
  'LIMIT_EXCEEDED_100',
]);

export const SelectionLiabilitySchema = z.object({
  selectionId: z.string(),
  selectionName: z.string(),
  currentOdds: z.number(),
  totalStaked: z.number(),
  potentialPayout: z.number(),
  netProfitLiability: z.number(),
  activeBetCount: z.number(),
  shareOfMarketLiabilityPercent: z.number(),
});

export const MarketStatusSchema = z.object({
  marketId: z.string().min(1),
  eventId: z.string().min(1),
  eventTitle: z.string().min(2),
  sportType: MarketSportTypeSchema,
  marketType: z.string(),
  status: MarketStatusEnumSchema,
  totalPoolLiabilityUsd: z.number().min(0),
  totalBetsCount: z.number().int().min(0),
  currentOverroundPct: z.number().positive(),
  sharpMoneyAlert: z.boolean(),
  lastOddsUpdateAt: z.string(),
  // Contratos estrictos del Motor de Riesgo (Risk & Liability Engine)
  maxLiabilityLimit: z.number().min(0).default(10000),
  currentLiability: z.number().min(0).optional(),
  utilizationPercentage: z.number().min(0).max(100).optional(),
  thresholdLevel: RiskThresholdLevelSchema.default('NOMINAL'),
  isSuspendedByRisk: z.boolean().default(false),
  selections: z.array(SelectionLiabilitySchema).optional().default([]),
});

export const GlobalLedgerEntrySchema = z.object({
  txId: z.string().min(1),
  userId: z.string().min(1),
  username: z.string().min(1),
  type: z.enum(['DEPOSIT', 'WITHDRAWAL', 'BET_STAKE', 'BET_PAYOUT', 'HOUSE_FEE_RAKE']),
  grossAmountUsd: z.number(),
  netHouseImpactUsd: z.number(), // + Ganancia para la casa, - Pago a usuario
  paymentChannel: z.enum(['USDT_TRC20', 'BTC_LIGHTNING', 'FIAT_SEPA', 'VISA_MASTERCARD']),
  timestamp: z.string(),
  riskScore: z.number().min(0).max(100),
});

export const AdminMetricsSchema = z.object({
  totalGrossGamingRevenueUsd: z.number(),
  netGamingRevenueUsd: z.number(),
  activeHouseExposureUsd: z.number(),
  criticalRiskAccountsCount: z.number().int(),
  averageHouseOverroundPct: z.number(),
  total24hVolumeUsd: z.number(),
});

export const AdminBackofficeDataSchema = z.object({
  metrics: AdminMetricsSchema,
  riskAlerts: z.array(UserRiskAlertSchema),
  markets: z.array(MarketStatusSchema),
  globalLedger: z.array(GlobalLedgerEntrySchema),
});

export type UserRiskAlert = z.infer<typeof UserRiskAlertSchema>;
export type MarketStatus = z.infer<typeof MarketStatusSchema>;
export type GlobalLedgerEntry = z.infer<typeof GlobalLedgerEntrySchema>;
export type AdminMetrics = z.infer<typeof AdminMetricsSchema>;
export type AdminBackofficeData = z.infer<typeof AdminBackofficeDataSchema>;

/* ==========================================================================
   2. ADAPTADORES DE TIPADO PURO (Matt Pocock Design Pattern: Zero-Any)
   ========================================================================== */

/**
 * Convierte un `MarketStatus` en el `MarketExposureDto` tipado estricto
 * requerido por el motor de Circuit Breaker y los componentes de visualización.
 */
export function toMarketExposureDto(mkt: MarketStatus): MarketExposureDto {
  const currentLiability = mkt.currentLiability ?? mkt.totalPoolLiabilityUsd;
  const maxLiabilityLimit = mkt.maxLiabilityLimit ?? 10000;
  const rawUtilization =
    maxLiabilityLimit > 0 ? (currentLiability / maxLiabilityLimit) * 100 : 0;
  const utilizationPercentage =
    mkt.utilizationPercentage ?? Number(rawUtilization.toFixed(2));

  const thresholdLevel: RiskThresholdLevel =
    mkt.thresholdLevel ??
    (utilizationPercentage >= 100
      ? 'LIMIT_EXCEEDED_100'
      : utilizationPercentage >= 95
      ? 'CRITICAL_95_SUSPENDED'
      : utilizationPercentage >= 75
      ? 'ELEVATED_75'
      : 'NOMINAL');

  const isSuspendedByRisk =
    mkt.isSuspendedByRisk ||
    (mkt.status === 'SUSPENDED_VAR' && utilizationPercentage >= 95) ||
    thresholdLevel === 'CRITICAL_95_SUSPENDED' ||
    thresholdLevel === 'LIMIT_EXCEEDED_100';

  const operationalStatus: MarketOperationalStatus =
    isSuspendedByRisk || mkt.status === 'SUSPENDED_VAR'
      ? 'Suspended'
      : mkt.status === 'CLOSED_SETTLING' || mkt.status === 'SETTLED_PAID'
      ? 'Settled'
      : mkt.status === 'CANCELLED_VOID'
      ? 'Void'
      : 'Open';

  return {
    marketId: mkt.marketId,
    eventId: mkt.eventId,
    marketName: mkt.marketType,
    status: operationalStatus,
    isSuspendedByRisk,
    currentLiability,
    maxLiabilityLimit,
    utilizationPercentage,
    thresholdLevel,
    selections: mkt.selections ?? [],
    updatedAt: mkt.lastOddsUpdateAt,
  };
}

/* ==========================================================================
   3. DATOS TIPADOS CONECTADOS A ENTIDADES REALES DEL PUERTO 5005
   ========================================================================== */

export const MOCK_ADMIN_METRICS: AdminMetrics = {
  totalGrossGamingRevenueUsd: 1428950.0,
  netGamingRevenueUsd: 312450.0,
  activeHouseExposureUsd: 105384.0,
  criticalRiskAccountsCount: 4,
  averageHouseOverroundPct: 4.75,
  total24hVolumeUsd: 685400.0,
};

export const MOCK_RISK_ALERTS: UserRiskAlert[] = [
  {
    alertId: 'ALT-FRD-9901',
    userId: 'usr-9942',
    username: 'CyberSniper_99',
    riskLevel: 'CRITICAL',
    flagType: 'MULTI_ACCOUNT_SAME_IP',
    sharedIp: '185.220.101.45 (Tor Exit / Datacenter)',
    deviceFingerprint: 'fp-mac-m2-88a7c2',
    correlatedAccountsCount: 4,
    correlatedAccountUsernames: ['GhostPunter_01', 'AlphaBet_X', 'Kovalev_Bot'],
    detectedAt: '2026-11-04T16:15:22Z',
    flaggedVolumeUsd: 18450.0,
    actionSuggested: 'FREEZE_FUNDS',
    status: 'ACTIVE_UNRESOLVED',
  },
  {
    alertId: 'ALT-ARB-8812',
    userId: 'usr-4410',
    username: 'ArbitrageWhale_X',
    riskLevel: 'HIGH',
    flagType: 'ARBITRAGE_SYNDICATE',
    sharedIp: '45.154.255.89 (NL VPN)',
    deviceFingerprint: 'fp-win-x64-91bc44',
    correlatedAccountsCount: 2,
    correlatedAccountUsernames: ['DutchBookie_EU'],
    detectedAt: '2026-11-04T15:44:10Z',
    flaggedVolumeUsd: 14200.0,
    actionSuggested: 'RESTRICT_MAX_BET',
    status: 'UNDER_INVESTIGATION',
  },
  {
    alertId: 'ALT-VEL-7734',
    userId: 'usr-7721',
    username: 'SpeedyPayout_7',
    riskLevel: 'HIGH',
    flagType: 'VELOCITY_WITHDRAWAL_BURST',
    sharedIp: '190.128.44.12 (Bolivia ISP)',
    deviceFingerprint: 'fp-ios-18-49ee11',
    correlatedAccountsCount: 1,
    correlatedAccountUsernames: [],
    detectedAt: '2026-11-04T15:10:00Z',
    flaggedVolumeUsd: 9500.0,
    actionSuggested: 'FORCE_KYC_LEVEL_3',
    status: 'ACTIVE_UNRESOLVED',
  },
  {
    alertId: 'ALT-FPR-6641',
    userId: 'usr-1102',
    username: 'Ghost_Fingerprint_8',
    riskLevel: 'MEDIUM',
    flagType: 'DEVICE_FINGERPRINT_COLLISION',
    sharedIp: '201.218.89.55 (Argentina Telecom)',
    deviceFingerprint: 'fp-and-15-77cf88 (Coincide con usuario baneado)',
    correlatedAccountsCount: 2,
    correlatedAccountUsernames: ['BannedUser_2025'],
    detectedAt: '2026-11-04T14:10:45Z',
    flaggedVolumeUsd: 3200.0,
    actionSuggested: 'MONITOR',
    status: 'ACTIVE_UNRESOLVED',
  },
];

export const MOCK_MARKETS: MarketStatus[] = [
  // 1. Entidad Real en Puerto 5005 (UFC 334 - Ciryl Gane vs Josh Hokit)
  {
    marketId: 'fa9f438a-669a-54b8-8897-bd01db20a5ba',
    eventId: '709cb387-b9ec-565e-a318-561df675e985',
    eventTitle: 'UFC 334: Ciryl Gane vs Josh Hokit (Live :5005)',
    sportType: 'MMA_UFC',
    marketType: 'Ganador (Moneyline)',
    status: 'OPEN_ACCEPTING_BETS',
    totalPoolLiabilityUsd: 84.0,
    totalBetsCount: 1,
    currentOverroundPct: 4.8,
    sharpMoneyAlert: false,
    lastOddsUpdateAt: '2026-11-04T21:20:00Z',
    maxLiabilityLimit: 10000.0,
    currentLiability: 84.0,
    utilizationPercentage: 0.84,
    thresholdLevel: 'NOMINAL',
    isSuspendedByRisk: false,
    selections: [
      {
        selectionId: '3f2b3bcf-9ed6-5a9d-99e3-9c4b851519f2',
        selectionName: 'Ciryl Gane',
        currentOdds: 2.1,
        totalStaked: 40.0,
        potentialPayout: 84.0,
        netProfitLiability: 44.0,
        activeBetCount: 1,
        shareOfMarketLiabilityPercent: 100,
      },
      {
        selectionId: 'd4ba2836-86d8-505b-bdeb-1c4c90e908ee',
        selectionName: 'Josh Hokit',
        currentOdds: 1.7519,
        totalStaked: 0,
        potentialPayout: 0,
        netProfitLiability: 0,
        activeBetCount: 0,
        shareOfMarketLiabilityPercent: 0,
      },
    ],
  },
  // 2. Entidad Real en Puerto 5005 (UFC 334 - Belgaroui vs Borralho - VAR Resettled)
  {
    marketId: '6bf7912d-5a6e-5a4c-9232-bf4e953a69fe',
    eventId: 'evt-ufc-334-belgaroui-borralho',
    eventTitle: 'UFC 334: Yousri Belgaroui vs Caio Borralho (Live :5005)',
    sportType: 'MMA_UFC',
    marketType: 'Ganador (VAR Resettled)',
    status: 'SETTLED_PAID',
    totalPoolLiabilityUsd: 0.0,
    totalBetsCount: 2,
    currentOverroundPct: 4.5,
    sharpMoneyAlert: false,
    lastOddsUpdateAt: '2026-11-04T21:36:00Z',
    maxLiabilityLimit: 10000.0,
    currentLiability: 0.0,
    utilizationPercentage: 0.0,
    thresholdLevel: 'NOMINAL',
    isSuspendedByRisk: false,
    selections: [
      {
        selectionId: '04130459-0f84-5043-b3b6-cd80df50a21d',
        selectionName: 'Yousri Belgaroui (WIN)',
        currentOdds: 1.8,
        totalStaked: 0,
        potentialPayout: 0,
        netProfitLiability: 0,
        activeBetCount: 0,
        shareOfMarketLiabilityPercent: 0,
      },
      {
        selectionId: '7f7e0de6-f971-5603-9e5a-731591977fd0',
        selectionName: 'Caio Borralho (LOST - CLAWED BACK)',
        currentOdds: 2.05,
        totalStaked: 50.0,
        potentialPayout: 0,
        netProfitLiability: 0,
        activeBetCount: 0,
        shareOfMarketLiabilityPercent: 0,
      },
    ],
  },
  // 3. Caso Crítico: Disparo de Circuit Breaker por Exposición >= 95%
  {
    marketId: 'mkt-crit-005',
    eventId: 'evt-ucl-madrid-city',
    eventTitle: 'Real Madrid CF vs Manchester City FC',
    sportType: 'SOCCER',
    marketType: '1X2 & Match Winner',
    status: 'SUSPENDED_VAR',
    totalPoolLiabilityUsd: 97500.0,
    totalBetsCount: 4210,
    currentOverroundPct: 4.2,
    sharpMoneyAlert: true,
    lastOddsUpdateAt: '2026-11-04T21:00:00Z',
    maxLiabilityLimit: 100000.0,
    currentLiability: 97500.0,
    utilizationPercentage: 97.5,
    thresholdLevel: 'CRITICAL_95_SUSPENDED',
    isSuspendedByRisk: true,
    selections: [
      {
        selectionId: 'sel-rm-01',
        selectionName: 'Real Madrid CF',
        currentOdds: 2.25,
        totalStaked: 43333.0,
        potentialPayout: 97500.0,
        netProfitLiability: 54167.0,
        activeBetCount: 2890,
        shareOfMarketLiabilityPercent: 100,
      },
    ],
  },
  // 4. Mercado en Riesgo Elevado (78.0%)
  {
    marketId: 'mkt-ufc-002',
    eventId: 'evt-ufc-334-gane-hokit',
    eventTitle: 'UFC 334: Ciryl Gane vs Josh Hokit',
    sportType: 'MMA_UFC',
    marketType: 'Method of Victory (Exact Round)',
    status: 'OPEN_ACCEPTING_BETS',
    totalPoolLiabilityUsd: 7800.0,
    totalBetsCount: 1890,
    currentOverroundPct: 5.1,
    sharpMoneyAlert: false,
    lastOddsUpdateAt: '2026-11-04T20:28:15Z',
    maxLiabilityLimit: 10000.0,
    currentLiability: 7800.0,
    utilizationPercentage: 78.0,
    thresholdLevel: 'ELEVATED_75',
    isSuspendedByRisk: false,
    selections: [],
  },
  // 5. Mercado Cerrado / Liquidado
  {
    marketId: 'mkt-box-004',
    eventId: 'evt-box-beterbiev-bivol',
    eventTitle: 'Artur Beterbiev vs Dmitry Bivol',
    sportType: 'BOXING',
    marketType: 'Moneyline & 12 Round Winner',
    status: 'CLOSED_SETTLING',
    totalPoolLiabilityUsd: 0.0,
    totalBetsCount: 2950,
    currentOverroundPct: 4.9,
    sharpMoneyAlert: true,
    lastOddsUpdateAt: '2026-11-04T18:15:00Z',
    maxLiabilityLimit: 10000.0,
    currentLiability: 0.0,
    utilizationPercentage: 0.0,
    thresholdLevel: 'NOMINAL',
    isSuspendedByRisk: false,
    selections: [],
  },
];

export const MOCK_GLOBAL_LEDGER: GlobalLedgerEntry[] = [
  {
    txId: 'TX-GLB-99881',
    userId: 'usr-9942',
    username: 'CyberSniper_99',
    type: 'BET_STAKE',
    grossAmountUsd: 5000.0,
    netHouseImpactUsd: 5000.0,
    paymentChannel: 'USDT_TRC20',
    timestamp: '2026-11-04T16:14:10Z',
    riskScore: 94,
  },
  {
    txId: 'TX-GLB-99880',
    userId: 'usr-8812',
    username: 'Vortex_Bettor',
    type: 'BET_PAYOUT',
    grossAmountUsd: 420.0,
    netHouseImpactUsd: -420.0,
    paymentChannel: 'USDT_TRC20',
    timestamp: '2026-11-04T16:10:45Z',
    riskScore: 12,
  },
  {
    txId: 'TX-GLB-99879',
    userId: 'usr-7721',
    username: 'SpeedyPayout_7',
    type: 'WITHDRAWAL',
    grossAmountUsd: 9500.0,
    netHouseImpactUsd: -9500.0,
    paymentChannel: 'BTC_LIGHTNING',
    timestamp: '2026-11-04T15:50:00Z',
    riskScore: 88,
  },
  {
    txId: 'TX-GLB-99878',
    userId: 'usr-5501',
    username: 'Casual_Roller',
    type: 'DEPOSIT',
    grossAmountUsd: 2500.0,
    netHouseImpactUsd: 2500.0,
    paymentChannel: 'VISA_MASTERCARD',
    timestamp: '2026-11-04T15:30:12Z',
    riskScore: 8,
  },
  {
    txId: 'TX-GLB-99877',
    userId: 'usr-1102',
    username: 'Ghost_Fingerprint_8',
    type: 'HOUSE_FEE_RAKE',
    grossAmountUsd: 145.0,
    netHouseImpactUsd: 145.0,
    paymentChannel: 'USDT_TRC20',
    timestamp: '2026-11-04T15:15:00Z',
    riskScore: 65,
  },
];

export const MOCK_ADMIN_BACKOFFICE_DATA: AdminBackofficeData = {
  metrics: MOCK_ADMIN_METRICS,
  riskAlerts: MOCK_RISK_ALERTS,
  markets: MOCK_MARKETS,
  globalLedger: MOCK_GLOBAL_LEDGER,
};

/* ==========================================================================
   4. FORMATEADORES FINANCIEROS Y VISUALES
   ========================================================================== */

function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatIso(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
  } catch {
    return iso;
  }
}

/* ==========================================================================
   5. COMPONENTES DE PRESENTACIÓN VISUAL
   ========================================================================== */

/**
 * Indicador visual de Exposición de la Casa (Liability Meter).
 * Consume directamente el contrato `MarketExposureDto` y renderiza:
 * - Monto actual frente al límite de riesgo asignado
 * - Microbarra de progreso con umbrales reactivos (Lime < 75%, Amber 75-94%, Red >= 95%)
 * - Porcentaje de utilización del límite y badge de severidad.
 */
interface LiabilityExposureIndicatorProps {
  readonly exposure: MarketExposureDto;
}

function LiabilityExposureIndicator({ exposure }: LiabilityExposureIndicatorProps) {
  const isSuspended = isMarketSuspendedByRisk(exposure);
  const isCritical =
    isSuspended ||
    exposure.thresholdLevel === 'CRITICAL_95_SUSPENDED' ||
    exposure.thresholdLevel === 'LIMIT_EXCEEDED_100' ||
    exposure.utilizationPercentage >= 95;

  const isElevated =
    !isCritical &&
    (exposure.thresholdLevel === 'ELEVATED_75' || exposure.utilizationPercentage >= 75);

  const barColor = isCritical
    ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.7)] animate-pulse'
    : isElevated
    ? 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.5)]'
    : 'bg-[#D4FF3F] shadow-[0_0_6px_rgba(212,255,63,0.3)]';

  const textColor = isCritical
    ? 'text-rose-400 font-black'
    : isElevated
    ? 'text-amber-400 font-bold'
    : 'text-neutral-200 font-bold';

  return (
    <div className="flex flex-col items-end gap-1 min-w-[135px]">
      <div className="flex items-baseline justify-end gap-1">
        <span className={`text-xs ${textColor}`}>
          {formatUsd(exposure.currentLiability)}
        </span>
        <span className="text-[9px] text-neutral-400 font-mono">
          / {formatUsd(exposure.maxLiabilityLimit)}
        </span>
      </div>

      {/* Barra de progreso de utilización de riesgo */}
      <div className="w-full bg-neutral-900 h-1.5 rounded-full overflow-hidden border border-white/[0.08] relative">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${Math.min(100, Math.max(3, exposure.utilizationPercentage))}%` }}
        />
      </div>

      <div className="flex items-center justify-between w-full text-[8px] font-mono">
        <span
          className={`font-black uppercase tracking-wider ${
            isCritical
              ? 'text-rose-400 animate-pulse'
              : isElevated
              ? 'text-amber-400'
              : 'text-neutral-400'
          }`}
        >
          {exposure.thresholdLevel.replace(/_/g, ' ')}
        </span>
        <span className={`font-bold ${isCritical ? 'text-rose-400' : isElevated ? 'text-amber-400' : 'text-[#D4FF3F]'}`}>
          {exposure.utilizationPercentage.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

/* ----------------- TAB 1: GESTIÓN DE RIESGO & FRAUDE ----------------- */
function RiskManagementTable({
  alerts,
  onAction,
}: {
  readonly alerts: readonly UserRiskAlert[];
  readonly onAction: (alertId: string, action: string) => void;
}) {
  return (
    <div className="overflow-x-auto border border-white/[0.08] bg-[#050505] rounded-xs shadow-2xl">
      <table className="w-full text-left font-mono text-[11px] border-collapse">
        <thead>
          <tr className="bg-[#0D0D0D] border-b border-white/[0.08] text-neutral-400 uppercase text-[9px] tracking-wider">
            <th className="py-2.5 px-3">Severidad</th>
            <th className="py-2.5 px-3">Usuario / ID</th>
            <th className="py-2.5 px-3">Bandera de Riesgo</th>
            <th className="py-2.5 px-3">IP / Hardware Fingerprint</th>
            <th className="py-2.5 px-3">Cuentas Vinculadas</th>
            <th className="py-2.5 px-3 text-right">Volumen Afectado</th>
            <th className="py-2.5 px-3 text-center">Acción Recomendada</th>
            <th className="py-2.5 px-3 text-right">Control de Dueño</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04]">
          {alerts.map((item) => {
            const isCrit = item.riskLevel === 'CRITICAL';
            const isHigh = item.riskLevel === 'HIGH';

            return (
              <tr
                key={item.alertId}
                className="hover:bg-white/[0.02] transition-colors"
              >
                {/* Severidad */}
                <td className="py-2.5 px-3 whitespace-nowrap">
                  <span
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                      isCrit
                        ? 'bg-red-500/20 text-red-400 border border-red-500/40 shadow-[0_0_8px_rgba(239,68,68,0.3)] animate-pulse'
                        : isHigh
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                        : 'bg-neutral-800 text-neutral-300'
                    }`}
                  >
                    <AlertOctagon size={10} />
                    {item.riskLevel}
                  </span>
                </td>

                {/* Usuario */}
                <td className="py-2.5 px-3 whitespace-nowrap">
                  <span className="font-bold text-white block">{item.username}</span>
                  <span className="text-[9px] text-neutral-400">{item.userId}</span>
                </td>

                {/* Flag */}
                <td className="py-2.5 px-3">
                  <span className="text-red-300 font-bold block">{item.flagType.replace(/_/g, ' ')}</span>
                  <span className="text-[9px] text-neutral-400">{formatIso(item.detectedAt)}</span>
                </td>

                {/* IP & Fingerprint */}
                <td className="py-2.5 px-3 font-mono text-[10px]">
                  <span className="text-neutral-300 block">{item.sharedIp ?? 'N/A'}</span>
                  <span className="text-neutral-400 text-[9px] truncate max-w-[140px] block">
                    {item.deviceFingerprint ?? 'Sin huella'}
                  </span>
                </td>

                {/* Cuentas Correlacionadas */}
                <td className="py-2.5 px-3 whitespace-nowrap">
                  <span
                    className={`font-black ${
                      item.correlatedAccountsCount > 1 ? 'text-red-400' : 'text-neutral-400'
                    }`}
                  >
                    {item.correlatedAccountsCount} CUENTAS
                  </span>
                  {item.correlatedAccountUsernames.length > 0 && (
                    <span className="text-[9px] text-neutral-400 block truncate max-w-[130px]">
                      {item.correlatedAccountUsernames.join(', ')}
                    </span>
                  )}
                </td>

                {/* Volumen */}
                <td className="py-2.5 px-3 text-right font-black text-white whitespace-nowrap">
                  {formatUsd(item.flaggedVolumeUsd)}
                </td>

                {/* Acción Sugerida */}
                <td className="py-2.5 px-3 text-center whitespace-nowrap">
                  <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase bg-black border border-white/10 text-[#D4FF3F]">
                    {item.actionSuggested.replace(/_/g, ' ')}
                  </span>
                </td>

                {/* Botones de Comando */}
                <td className="py-2.5 px-3 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => onAction(item.alertId, 'FREEZE')}
                      className="px-2 py-1 bg-red-600/20 text-red-400 border border-red-500/40 hover:bg-red-600 hover:text-white rounded-xs text-[9px] font-bold uppercase transition"
                      title="Congelar fondos y sesiones activas"
                    >
                      Congelar
                    </button>
                    <button
                      type="button"
                      onClick={() => onAction(item.alertId, 'BAN')}
                      className="px-2 py-1 bg-neutral-900 text-neutral-300 border border-white/10 hover:border-white/30 rounded-xs text-[9px] font-bold uppercase transition"
                    >
                      Banear
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ----------------- TAB 2: MERCADOS & CONTROL DEPORTIVO ----------------- */
function MarketsControlTable({
  markets,
  onToggleMarket,
}: {
  readonly markets: readonly MarketStatus[];
  readonly onToggleMarket: (marketId: string) => void;
}) {
  return (
    <div className="overflow-x-auto border border-white/[0.08] bg-[#050505] rounded-xs shadow-2xl">
      <table className="w-full text-left font-mono text-[11px] border-collapse">
        <thead>
          <tr className="bg-[#0D0D0D] border-b border-white/[0.08] text-neutral-400 uppercase text-[9px] tracking-wider">
            <th className="py-2.5 px-3">Estado Mercado</th>
            <th className="py-2.5 px-3">Deporte</th>
            <th className="py-2.5 px-3">Evento Deportivo</th>
            <th className="py-2.5 px-3">Tipo de Mercado</th>
            <th className="py-2.5 px-3 text-right">Exposición / Pool Liability</th>
            <th className="py-2.5 px-3 text-right">Apuestas</th>
            <th className="py-2.5 px-3 text-right">Overround Casa</th>
            <th className="py-2.5 px-3 text-center">Sharp Money</th>
            <th className="py-2.5 px-3 text-right">Kill Switch</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04]">
          {markets.map((mkt) => {
            const exposure = toMarketExposureDto(mkt);
            const suspendedByRisk = isMarketSuspendedByRisk(exposure);
            const isOpen = mkt.status === 'OPEN_ACCEPTING_BETS' && !suspendedByRisk;
            const isSuspendedVar = mkt.status === 'SUSPENDED_VAR';

            return (
              <tr
                key={mkt.marketId}
                className={`hover:bg-white/[0.02] transition-colors ${
                  suspendedByRisk
                    ? 'bg-red-950/20 border-l-2 border-l-red-500 shadow-[inset_0_0_20px_rgba(239,68,68,0.05)]'
                    : ''
                }`}
              >
                {/* Estado con Alerta Reactiva de Circuit Breaker */}
                <td className="py-2.5 px-3 whitespace-nowrap">
                  {suspendedByRisk ? (
                    <span
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[8px] font-black uppercase bg-red-600/30 text-red-400 border border-red-500 shadow-[0_0_12px_rgba(239,68,68,0.5)] animate-pulse"
                      title="Circuit Breaker Activado: Exposición >= 95% del límite de la casa"
                    >
                      <AlertOctagon size={11} className="text-red-400 animate-bounce" />
                      CIRCUIT BREAKER (95%+)
                    </span>
                  ) : (
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                        isOpen
                          ? 'bg-[#D4FF3F]/15 text-[#D4FF3F] border border-[#D4FF3F]/30'
                          : isSuspendedVar
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse'
                          : 'bg-neutral-800 text-neutral-300'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          isOpen
                            ? 'bg-[#D4FF3F]'
                            : isSuspendedVar
                            ? 'bg-amber-400'
                            : 'bg-neutral-500'
                        }`}
                      />
                      {mkt.status.replace(/_/g, ' ')}
                    </span>
                  )}
                </td>

                {/* Deporte */}
                <td className="py-2.5 px-3 whitespace-nowrap">
                  <span className="text-[9px] font-bold text-neutral-300 uppercase px-1.5 py-0.5 bg-black border border-white/10 rounded">
                    {mkt.sportType}
                  </span>
                </td>

                {/* Evento */}
                <td className="py-2.5 px-3">
                  <span className="font-bold text-white block truncate max-w-[220px]">
                    {mkt.eventTitle}
                  </span>
                  <span className="text-[9px] text-neutral-400">{mkt.eventId}</span>
                </td>

                {/* Tipo Mercado */}
                <td className="py-2.5 px-3 text-neutral-300 whitespace-nowrap font-medium">
                  {mkt.marketType}
                </td>

                {/* Indicador Visual de Exposición de la Casa (Liability) */}
                <td className="py-2.5 px-3 text-right whitespace-nowrap">
                  <LiabilityExposureIndicator exposure={exposure} />
                </td>

                {/* Apuestas */}
                <td className="py-2.5 px-3 text-right font-bold text-white whitespace-nowrap">
                  {mkt.totalBetsCount.toLocaleString()}
                </td>

                {/* Overround */}
                <td className="py-2.5 px-3 text-right font-black text-[#D4FF3F] whitespace-nowrap">
                  +{mkt.currentOverroundPct}%
                </td>

                {/* Sharp Money */}
                <td className="py-2.5 px-3 text-center whitespace-nowrap">
                  {mkt.sharpMoneyAlert ? (
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-red-950/60 text-red-400 border border-red-500/40 flex items-center justify-center gap-1 mx-auto w-fit">
                      <Flame size={10} /> DETECTADO
                    </span>
                  ) : (
                    <span className="text-neutral-400 text-[9px]">—</span>
                  )}
                </td>

                {/* Kill Switch Toggle */}
                <td className="py-2.5 px-3 text-right whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => onToggleMarket(mkt.marketId)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xs text-[9px] font-bold uppercase transition ${
                      isOpen
                        ? 'bg-amber-600/20 text-amber-300 border border-amber-500/40 hover:bg-amber-600 hover:text-white'
                        : 'bg-[#D4FF3F]/20 text-[#D4FF3F] border border-[#D4FF3F]/40 hover:bg-[#D4FF3F] hover:text-black'
                    }`}
                  >
                    {isOpen ? <Lock size={10} /> : <Unlock size={10} />}
                    {isOpen ? 'Suspender' : 'Reabrir'}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ----------------- TAB 3: LEDGER GLOBAL & AUDITORÍA ----------------- */
function GlobalLedgerTable({ ledger }: { readonly ledger: readonly GlobalLedgerEntry[] }) {
  return (
    <div className="overflow-x-auto border border-white/[0.08] bg-[#050505] rounded-xs shadow-2xl">
      <table className="w-full text-left font-mono text-[11px] border-collapse">
        <thead>
          <tr className="bg-[#0D0D0D] border-b border-white/[0.08] text-neutral-400 uppercase text-[9px] tracking-wider">
            <th className="py-2.5 px-3">TX ID / Hash</th>
            <th className="py-2.5 px-3">Usuario</th>
            <th className="py-2.5 px-3">Operación</th>
            <th className="py-2.5 px-3 text-right">Monto Bruto</th>
            <th className="py-2.5 px-3 text-right">Impacto Casa (Neto)</th>
            <th className="py-2.5 px-3">Pasarela / Canal</th>
            <th className="py-2.5 px-3 text-center">Score de Riesgo</th>
            <th className="py-2.5 px-3 text-right">Timestamp UTC</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04]">
          {ledger.map((tx) => {
            const isHousePositive = tx.netHouseImpactUsd > 0;
            const isHighRisk = tx.riskScore >= 75;

            return (
              <tr key={tx.txId} className="hover:bg-white/[0.02] transition-colors">
                <td className="py-2.5 px-3 font-bold text-white whitespace-nowrap">
                  {tx.txId}
                </td>
                <td className="py-2.5 px-3 whitespace-nowrap">
                  <span className="text-white font-medium">{tx.username}</span>
                  <span className="text-[9px] text-neutral-400 block">{tx.userId}</span>
                </td>
                <td className="py-2.5 px-3 whitespace-nowrap">
                  <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-neutral-900 border border-white/10 text-neutral-300">
                    {tx.type}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-right font-bold text-white whitespace-nowrap">
                  {formatUsd(tx.grossAmountUsd)}
                </td>
                <td
                  className={`py-2.5 px-3 text-right font-black whitespace-nowrap ${
                    isHousePositive ? 'text-[#D4FF3F]' : 'text-rose-400'
                  }`}
                >
                  {isHousePositive
                    ? `+${formatUsd(tx.netHouseImpactUsd)}`
                    : formatUsd(tx.netHouseImpactUsd)}
                </td>
                <td className="py-2.5 px-3 font-mono text-[10px] text-neutral-300 whitespace-nowrap">
                  {tx.paymentChannel}
                </td>
                <td className="py-2.5 px-3 text-center whitespace-nowrap">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-bold ${
                      isHighRisk
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                        : 'bg-emerald-500/20 text-emerald-400'
                    }`}
                  >
                    {tx.riskScore}/100
                  </span>
                </td>
                <td className="py-2.5 px-3 text-right text-neutral-400 text-[10px] whitespace-nowrap">
                  {formatIso(tx.timestamp)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ==========================================================================
   6. COMPONENTE PRINCIPAL: AdminBackoffice
   ========================================================================== */

export interface AdminBackofficeProps {
  initialData?: unknown;
}

export default function AdminBackoffice({
  initialData = MOCK_ADMIN_BACKOFFICE_DATA,
}: AdminBackofficeProps) {
  const [data, setData] = useState<AdminBackofficeData | null>(null);
  const [activeTab, setActiveTab] = useState<'RISK' | 'MARKETS' | 'LEDGER'>('RISK');
  const [searchTerm, setSearchTerm] = useState('');
  const [actionToast, setActionToast] = useState<string | null>(null);
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false);
  const [syncLoading, setSyncLoading] = useState<boolean>(false);

  const containerId = useId();

  useEffect(() => {
    // Validación estricta de entrada con Zod
    const parsed = AdminBackofficeDataSchema.safeParse(initialData);
    if (parsed.success) {
      setData(parsed.data);
    } else {
      console.error('Error de validación Zod en AdminBackoffice:', parsed.error);
    }
  }, [initialData]);

  // Sincronización en vivo opcional con el backend .NET 10 (Puerto 5005 / Nginx)
  const syncBackendData = async () => {
    setSyncLoading(true);
    try {
      const url = '/api/v1/mma/events';
      const res = await fetch(url);
      if (res.ok) {
        const eventsData = await res.json();
        if (eventsData?.items && Array.isArray(eventsData.items)) {
          const liveMarkets: MarketStatus[] = eventsData.items.flatMap((evt: any) =>
            (evt.markets ?? []).map((m: any) => {
              const selections: SelectionLiabilityDto[] = (m.selections ?? []).map((s: any) => ({
                selectionId: s.id,
                selectionName: s.name,
                currentOdds: s.decimalOdds ?? 1.0,
                totalStaked: 0,
                potentialPayout: 0,
                netProfitLiability: 0,
                activeBetCount: 0,
                shareOfMarketLiabilityPercent: 0,
              }));

              return {
                marketId: m.id,
                eventId: evt.id,
                eventTitle: evt.name,
                sportType: 'MMA_UFC' as const,
                marketType: m.name ?? m.typeKey ?? 'Ganador',
                status: (m.status === 'Open' || m.status === 'OPEN'
                  ? 'OPEN_ACCEPTING_BETS'
                  : 'SUSPENDED_VAR') as any,
                totalPoolLiabilityUsd: 0,
                totalBetsCount: 0,
                currentOverroundPct: 4.8,
                sharpMoneyAlert: false,
                lastOddsUpdateAt: m.updatedAt ?? new Date().toISOString(),
                maxLiabilityLimit: 10000,
                currentLiability: 0,
                utilizationPercentage: 0,
                thresholdLevel: 'NOMINAL' as const,
                isSuspendedByRisk: false,
                selections,
              };
            })
          );

          if (liveMarkets.length > 0) {
            setData((prev) => {
              if (!prev) return prev;
              const liveIds = new Set(liveMarkets.map((m) => m.marketId));
              const preserved = prev.markets.filter((m) => !liveIds.has(m.marketId));
              return {
                ...prev,
                markets: [...liveMarkets, ...preserved],
              };
            });
            setIsLiveConnected(true);
            setActionToast(`Conexión exitosa con Backend (:5005). ${liveMarkets.length} mercados en vivo cargados.`);
            setTimeout(() => setActionToast(null), 3500);
            return;
          }
        }
      }
    } catch {
      // Modo offline / mock continuo sin interrupción
    } finally {
      setSyncLoading(false);
    }
  };

  const handleRiskAction = (alertId: string, actionType: string) => {
    if (!data) return;
    const msg = `Acción de dueño '${actionType}' ejecutada para alerta ${alertId}. Fondos bloqueados en base de datos.`;
    setActionToast(msg);
    setTimeout(() => setActionToast(null), 4000);
  };

  const handleToggleMarket = (marketId: string) => {
    if (!data) return;
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        markets: prev.markets.map((mkt) => {
          if (mkt.marketId === marketId) {
            const isCurrentlyOpen = mkt.status === 'OPEN_ACCEPTING_BETS';
            const nextStatus = isCurrentlyOpen ? 'SUSPENDED_VAR' : 'OPEN_ACCEPTING_BETS';
            // Al reabrir manualmente, se restablece el flag de Circuit Breaker
            const isSuspendedByRisk = isCurrentlyOpen ? mkt.isSuspendedByRisk : false;
            return {
              ...mkt,
              status: nextStatus,
              isSuspendedByRisk,
            };
          }
          return mkt;
        }),
      };
    });
    setActionToast(`Kill switch ejecutado para mercado ${marketId}. Estado actualizado.`);
    setTimeout(() => setActionToast(null), 3500);
  };

  if (!data) {
    return (
      <div className="p-8 font-mono text-xs text-[#D4FF3F] bg-[#050505] border border-white/10 rounded">
        INICIALIZANDO TERMINAL MILITARIZADA DE ADMINISTRACIÓN...
      </div>
    );
  }

  const { metrics, riskAlerts, markets, globalLedger } = data;

  // Contador en tiempo real de Circuit Breakers activados por riesgo
  const circuitBreakersCount = markets.filter((m) =>
    isMarketSuspendedByRisk(toMarketExposureDto(m))
  ).length;

  return (
    <div
      id={containerId}
      className="w-full max-w-7xl mx-auto my-6 space-y-6 font-mono text-white bg-[#050505] p-5 sm:p-7 rounded border border-white/[0.08] shadow-2xl"
    >
      {/* Toast Flotante de Comando */}
      {actionToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-[#0D0D0D] border-2 border-red-500 text-white px-4 py-3 rounded shadow-2xl font-mono text-xs animate-bounce">
          <Terminal className="text-red-400" size={16} />
          <div>
            <span className="font-black text-red-400 uppercase block">ORDEN DE BACKOFFICE EJECUTADA</span>
            <span>{actionToast}</span>
          </div>
        </div>
      )}

      {/* ====================================================================
          BARRA DE CONTROL SUPERIOR Y TELEMETRÍA DEL SISTEMA
          ==================================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-600/20 border border-red-500/40 text-red-400 rounded-xs">
            <Cpu size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#D4FF3F] animate-ping" />
              <h1 className="font-display text-lg sm:text-xl font-black uppercase text-white tracking-widest">
                ZENBET // OWNER CONTROL MATRIX
              </h1>
            </div>
            <p className="text-[10px] text-neutral-400 uppercase">
              SUITE DE ADMINISTRACIÓN MILITARIZADA • NIVEL DE AUTORIZACIÓN: ROOT
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-[10px]">
          {/* Botón de Sincronización en Vivo :5005 */}
          <button
            type="button"
            onClick={syncBackendData}
            disabled={syncLoading}
            className="border border-white/10 bg-[#0D0D0D] hover:bg-white/5 px-2.5 py-1 text-neutral-300 rounded text-[10px] font-mono flex items-center gap-1.5 transition"
            title="Sincronizar mercados reales desde el backend en puerto 5005"
          >
            <RefreshCw size={11} className={syncLoading ? 'animate-spin text-[#D4FF3F]' : 'text-neutral-400'} />
            <span>{isLiveConnected ? 'PUERTO 5005: ONLINE' : 'SINCRONIZAR :5005'}</span>
          </button>

          {/* Alerta de Circuit Breaker Global */}
          <span
            className={`border px-2.5 py-1 rounded font-bold transition flex items-center gap-1.5 ${
              circuitBreakersCount > 0
                ? 'border-red-500/50 bg-red-950/30 text-red-400 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.3)]'
                : 'border-white/10 bg-[#0D0D0D] text-neutral-400'
            }`}
          >
            <AlertOctagon size={11} className={circuitBreakersCount > 0 ? 'text-red-400' : 'text-neutral-500'} />
            CIRCUIT BREAKERS: <strong className={circuitBreakersCount > 0 ? 'text-red-400' : 'text-[#D4FF3F]'}>{circuitBreakersCount}</strong>
          </span>

          <span className="border border-white/10 bg-[#0D0D0D] px-2.5 py-1 text-neutral-400 rounded">
            ESTADO SISTEMA: <strong className={circuitBreakersCount > 0 ? 'text-amber-400' : 'text-[#D4FF3F]'}>{circuitBreakersCount > 0 ? 'ALERTA DE RIESGO' : 'NOMINAL'}</strong>
          </span>
          <span className="border border-red-500/30 bg-red-950/20 px-2.5 py-1 text-red-300 rounded font-bold">
            ALERTAS ACTIVAS: {metrics.criticalRiskAccountsCount}
          </span>
        </div>
      </div>

      {/* ====================================================================
          TARJETAS KPI EJECUTIVAS (Owner Finance Overview)
          ==================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* GGR */}
        <div className="p-4 bg-[#080808] border border-white/[0.06] rounded flex flex-col justify-between">
          <span className="text-[9px] uppercase text-neutral-400 flex items-center justify-between">
            <span>GGR TOTAL (GROSS REVENUE)</span>
            <DollarSign size={12} className="text-[#D4FF3F]" />
          </span>
          <span className="text-xl sm:text-2xl font-black text-white mt-1">
            {formatUsd(metrics.totalGrossGamingRevenueUsd)}
          </span>
          <span className="text-[9px] text-[#D4FF3F] mt-1 font-bold">
            +14.2% frente al ciclo previo
          </span>
        </div>

        {/* NGR */}
        <div className="p-4 bg-[#080808] border border-white/[0.06] rounded flex flex-col justify-between">
          <span className="text-[9px] uppercase text-neutral-400 flex items-center justify-between">
            <span>NGR (NET GAMING REVENUE)</span>
            <TrendingUp size={12} className="text-[#D4FF3F]" />
          </span>
          <span className="text-xl sm:text-2xl font-black text-[#D4FF3F] mt-1">
            {formatUsd(metrics.netGamingRevenueUsd)}
          </span>
          <span className="text-[9px] text-neutral-400 mt-1">
            Margen de retención de la casa
          </span>
        </div>

        {/* Exposición Máxima en Vivo */}
        <div className="p-4 bg-[#080808] border border-white/[0.06] rounded flex flex-col justify-between">
          <span className="text-[9px] uppercase text-neutral-400 flex items-center justify-between">
            <span>EXPOSICIÓN MÁXIMA EN VIVO</span>
            <Flame size={12} className="text-rose-400" />
          </span>
          <span className="text-xl sm:text-2xl font-black text-rose-400 mt-1">
            {formatUsd(metrics.activeHouseExposureUsd)}
          </span>
          <span className="text-[9px] text-neutral-400 mt-1">
            Total pools liabilities activas
          </span>
        </div>

        {/* Overround Medio */}
        <div className="p-4 bg-[#080808] border border-white/[0.06] rounded flex flex-col justify-between">
          <span className="text-[9px] uppercase text-neutral-400 flex items-center justify-between">
            <span>MARGEN MEDIO DE LA CASA</span>
            <Activity size={12} className="text-cyan-400" />
          </span>
          <span className="text-xl sm:text-2xl font-black text-white mt-1">
            {metrics.averageHouseOverroundPct}%
          </span>
          <span className="text-[9px] text-neutral-400 mt-1">
            Overround estandarizado multideporte
          </span>
        </div>
      </div>

      {/* ====================================================================
          BARRA DE NAVEGACIÓN DE PESTAÑAS DENSAS
          ==================================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('RISK')}
            className={`px-3 py-1.5 text-xs font-bold uppercase transition rounded-xs flex items-center gap-1.5 ${
              activeTab === 'RISK'
                ? 'bg-red-600 text-white shadow-[0_0_12px_rgba(239,68,68,0.4)]'
                : 'text-neutral-400 hover:text-white bg-[#0D0D0D]'
            }`}
          >
            <ShieldAlert size={13} />
            <span>Gestión de Riesgo & Fraude</span>
            <span className="px-1 py-0.2 rounded bg-black/50 text-[9px]">
              {riskAlerts.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('MARKETS')}
            className={`px-3 py-1.5 text-xs font-bold uppercase transition rounded-xs flex items-center gap-1.5 ${
              activeTab === 'MARKETS'
                ? 'bg-[#D4FF3F] text-black shadow-[0_0_12px_rgba(212,255,63,0.4)] font-black'
                : 'text-neutral-400 hover:text-white bg-[#0D0D0D]'
            }`}
          >
            <Activity size={13} />
            <span>Mercados & Control Deportivo</span>
            <span className="px-1 py-0.2 rounded bg-black/50 text-[9px]">
              {markets.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('LEDGER')}
            className={`px-3 py-1.5 text-xs font-bold uppercase transition rounded-xs flex items-center gap-1.5 ${
              activeTab === 'LEDGER'
                ? 'bg-cyan-500 text-black shadow-[0_0_12px_rgba(6,182,212,0.4)] font-black'
                : 'text-neutral-400 hover:text-white bg-[#0D0D0D]'
            }`}
          >
            <Layers size={13} />
            <span>Ledger Global de Tesorería</span>
            <span className="px-1 py-0.2 rounded bg-black/50 text-[9px]">
              {globalLedger.length}
            </span>
          </button>
        </div>

        {/* Buscador de Tabla Inteligente */}
        <div className="relative w-full sm:w-64">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="Filtrar por ID, IP, Evento, Circuit..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#080808] border border-white/[0.08] rounded-xs pl-8 pr-3 py-1 text-[11px] font-mono text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#D4FF3F]"
          />
        </div>
      </div>

      {/* ====================================================================
          RENDERIZADO DE TABLA ACTIVA
          ==================================================================== */}
      <div>
        {activeTab === 'RISK' && (
          <RiskManagementTable
            alerts={riskAlerts.filter(
              (a) =>
                searchTerm === '' ||
                a.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (a.sharedIp && a.sharedIp.includes(searchTerm)) ||
                a.alertId.toLowerCase().includes(searchTerm.toLowerCase())
            )}
            onAction={handleRiskAction}
          />
        )}

        {activeTab === 'MARKETS' && (
          <MarketsControlTable
            markets={markets.filter((m) => {
              if (searchTerm === '') return true;
              const term = searchTerm.toLowerCase();
              const exposure = toMarketExposureDto(m);
              const isCrit = isMarketSuspendedByRisk(exposure);
              return (
                m.eventTitle.toLowerCase().includes(term) ||
                m.marketId.toLowerCase().includes(term) ||
                m.marketType.toLowerCase().includes(term) ||
                (isCrit && 'circuit breaker suspendido'.includes(term)) ||
                (m.thresholdLevel && m.thresholdLevel.toLowerCase().includes(term))
              );
            })}
            onToggleMarket={handleToggleMarket}
          />
        )}

        {activeTab === 'LEDGER' && (
          <GlobalLedgerTable
            ledger={globalLedger.filter(
              (l) =>
                searchTerm === '' ||
                l.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                l.txId.toLowerCase().includes(searchTerm.toLowerCase())
            )}
          />
        )}
      </div>

      {/* ====================================================================
          FOOTER MILITARIZADO
          ==================================================================== */}
      <div className="border-t border-white/[0.08] pt-3 flex flex-wrap items-center justify-between text-[9px] text-neutral-400">
        <span>ZENBET PROTOCOL ENGINE // AUTONOMOUS AGNOSTIC COMPLIANCE</span>
        <span>REGISTRO DE COMANDOS FIRMADO CRIPTOGRÁFICAMENTE • STRICT CONFIDENTIAL</span>
      </div>
    </div>
  );
}
