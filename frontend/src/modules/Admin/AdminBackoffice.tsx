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
   2. DATOS MOCK HIPERREALISTAS (Backoffice / Owner Suite)
   ========================================================================== */

export const MOCK_ADMIN_METRICS: AdminMetrics = {
  totalGrossGamingRevenueUsd: 1428950.0,
  netGamingRevenueUsd: 312450.0,
  activeHouseExposureUsd: 438200.0,
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
    detectedAt: '2026-10-31T03:15:22Z',
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
    detectedAt: '2026-10-31T02:44:10Z',
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
    detectedAt: '2026-10-31T01:50:00Z',
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
    detectedAt: '2026-10-30T22:10:45Z',
    flaggedVolumeUsd: 3200.0,
    actionSuggested: 'MONITOR',
    status: 'ACTIVE_UNRESOLVED',
  },
];

export const MOCK_MARKETS: MarketStatus[] = [
  {
    marketId: 'mkt-ucl-001',
    eventId: 'evt-ucl-madrid-city',
    eventTitle: 'Real Madrid CF vs Manchester City FC',
    sportType: 'SOCCER',
    marketType: '1X2 & Match Winner',
    status: 'SUSPENDED_VAR',
    totalPoolLiabilityUsd: 380200.0,
    totalBetsCount: 4210,
    currentOverroundPct: 4.2,
    sharpMoneyAlert: true,
    lastOddsUpdateAt: '2026-10-31T03:30:00Z',
  },
  {
    marketId: 'mkt-ufc-002',
    eventId: 'evt-ufc-334-gane-hokit',
    eventTitle: 'UFC 334: Ciryl Gane vs Josh Hokit',
    sportType: 'MMA_UFC',
    marketType: 'Method of Victory (Exact Round)',
    status: 'OPEN_ACCEPTING_BETS',
    totalPoolLiabilityUsd: 142500.0,
    totalBetsCount: 1890,
    currentOverroundPct: 5.1,
    sharpMoneyAlert: false,
    lastOddsUpdateAt: '2026-10-31T03:28:15Z',
  },
  {
    marketId: 'mkt-nba-003',
    eventId: 'evt-nba-celtics-gsw',
    eventTitle: 'Boston Celtics vs Golden State Warriors',
    sportType: 'BASKETBALL',
    marketType: 'Point Spread (-5.5 Line)',
    status: 'OPEN_ACCEPTING_BETS',
    totalPoolLiabilityUsd: 98400.0,
    totalBetsCount: 1120,
    currentOverroundPct: 4.6,
    sharpMoneyAlert: false,
    lastOddsUpdateAt: '2026-10-31T03:25:00Z',
  },
  {
    marketId: 'mkt-box-004',
    eventId: 'evt-box-beterbiev-bivol',
    eventTitle: 'Artur Beterbiev vs Dmitry Bivol',
    sportType: 'BOXING',
    marketType: 'Moneyline & 12 Round Winner',
    status: 'CLOSED_SETTLING',
    totalPoolLiabilityUsd: 215000.0,
    totalBetsCount: 2950,
    currentOverroundPct: 4.9,
    sharpMoneyAlert: true,
    lastOddsUpdateAt: '2026-10-31T02:15:00Z',
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
    timestamp: '2026-10-31T03:14:10Z',
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
    timestamp: '2026-10-31T03:10:45Z',
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
    timestamp: '2026-10-31T02:50:00Z',
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
    timestamp: '2026-10-31T02:30:12Z',
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
    timestamp: '2026-10-31T02:15:00Z',
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
   3. FORMATEADORES FINANCIEROS Y DE ALERTA
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
   4. COMPONENTES DE PESTAÑAS DENSAS (Data Tables)
   ========================================================================== */

/* ----------------- TAB 1: GESTIÓN DE RIESGO & FRAUDE ----------------- */
function RiskManagementTable({
  alerts,
  onAction,
}: {
  alerts: UserRiskAlert[];
  onAction: (alertId: string, action: string) => void;
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
  markets: MarketStatus[];
  onToggleMarket: (marketId: string) => void;
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
            <th className="py-2.5 px-3 text-right">Riesgo / Pool Liability</th>
            <th className="py-2.5 px-3 text-right">Apuestas</th>
            <th className="py-2.5 px-3 text-right">Overround Casa</th>
            <th className="py-2.5 px-3 text-center">Sharp Money</th>
            <th className="py-2.5 px-3 text-right">Kill Switch</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04]">
          {markets.map((mkt) => {
            const isOpen = mkt.status === 'OPEN_ACCEPTING_BETS';
            const isSuspended = mkt.status === 'SUSPENDED_VAR';

            return (
              <tr key={mkt.marketId} className="hover:bg-white/[0.02] transition-colors">
                {/* Estado */}
                <td className="py-2.5 px-3 whitespace-nowrap">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                      isOpen
                        ? 'bg-[#D4FF3F]/15 text-[#D4FF3F] border border-[#D4FF3F]/30'
                        : isSuspended
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse'
                        : 'bg-neutral-800 text-neutral-300'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        isOpen ? 'bg-[#D4FF3F]' : isSuspended ? 'bg-amber-400' : 'bg-neutral-500'
                      }`}
                    />
                    {mkt.status.replace(/_/g, ' ')}
                  </span>
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

                {/* Liability */}
                <td className="py-2.5 px-3 text-right font-black text-rose-400 whitespace-nowrap">
                  {formatUsd(mkt.totalPoolLiabilityUsd)}
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
function GlobalLedgerTable({ ledger }: { ledger: GlobalLedgerEntry[] }) {
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
   5. COMPONENTE PRINCIPAL: AdminBackoffice
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

  const containerId = useId();

  useEffect(() => {
    // Validación de entrada con Zod
    const parsed = AdminBackofficeDataSchema.safeParse(initialData);
    if (parsed.success) {
      setData(parsed.data);
    } else {
      console.error('Error de validación Zod en AdminBackoffice:', parsed.error);
    }
  }, [initialData]);

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
            const nextStatus =
              mkt.status === 'OPEN_ACCEPTING_BETS' ? 'SUSPENDED_VAR' : 'OPEN_ACCEPTING_BETS';
            return { ...mkt, status: nextStatus };
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
          <span className="border border-white/10 bg-[#0D0D0D] px-2.5 py-1 text-neutral-400 rounded">
            ESTADO SISTEMA: <strong className="text-[#D4FF3F]">NOMINAL</strong>
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

        {/* Buscador de Tabla */}
        <div className="relative w-full sm:w-64">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="Filtrar por ID, IP, Evento..."
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
            markets={markets.filter(
              (m) =>
                searchTerm === '' ||
                m.eventTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
                m.marketId.toLowerCase().includes(searchTerm.toLowerCase())
            )}
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

