import React, { useState, useEffect, useId } from 'react';
import { z } from 'zod';
import {
  Brain,
  ShieldAlert,
  Swords,
  Clock,
  Terminal,
  Zap,
  AlertTriangle,
  RefreshCw,
  Trophy,
  Activity,
  Flame,
  ChevronRight,
  TrendingUp,
  Percent,
  Crosshair,
  Timer,
  CheckCircle2,
  Check,
} from 'lucide-react';

import type { SelectionInput } from '@/domain/bets';

/* ==========================================================================
   1. ESQUEMAS ZOD BASE Y POLIMÓRFICOS (Discriminated Unions)
   ========================================================================== */

export const LLMTelemetrySchema = z.object({
  modelIdentifier: z.string(),
  inferenceLatencyMs: z.number().positive(),
  generatedAt: z.string(),
});

export const ValueBetAngleSchema = z.object({
  marketType: z.string(),
  selectionName: z.string(),
  suggestedLine: z.string(),
  confidenceGrade: z.enum(['A+', 'A', 'B+', 'B', 'SPECULATIVE']),
  riskLevel: z.enum(['LOW', 'MODERATE', 'HIGH', 'DEGEN']),
  rationale: z.string().min(10),
});

// Esquema Base común a todos los eventos deportivos
export const BaseMatchAnalysisSchema = z.object({
  id: z.string().min(1),
  competition: z.string().min(1),
  scheduledStartTime: z.string(),
  venue: z.string(),
  status: z.enum(['UPCOMING', 'LIVE', 'FINISHED']),
  headline: z.string().min(5),
  summary: z.string().min(20),
  modelConfidence: z.enum(['HIGH', 'MEDIUM', 'SPECULATIVE']),
  recommendedBetAngle: ValueBetAngleSchema,
  llmTelemetry: LLMTelemetrySchema,
});

/* ----------------- FÚTBOL (SOCCER) ----------------- */
export const SoccerTeamSchema = z.object({
  name: z.string().min(1),
  logoUrl: z.string().url(),
  leaguePosition: z.string(),
  formLast5: z.array(z.enum(['W', 'D', 'L'])).min(1),
});

export const SoccerAnalysisSchema = BaseMatchAnalysisSchema.extend({
  sportType: z.literal('soccer'),
  homeTeam: SoccerTeamSchema,
  awayTeam: SoccerTeamSchema,
  metrics: z.object({
    possessionProjection: z.object({
      homePercent: z.number().min(0).max(100),
      awayPercent: z.number().min(0).max(100),
    }),
    shotsOnTarget: z.object({
      homeShots: z.number().min(0),
      awayShots: z.number().min(0),
    }),
    expectedGoals: z.object({
      homeXG: z.number().min(0),
      awayXG: z.number().min(0),
    }),
    bttsProbabilityPercent: z.number().min(0).max(100),
  }),
  odds1X2: z.object({
    home: z.number().gt(1),
    draw: z.number().gt(1),
    away: z.number().gt(1),
  }),
  probabilities: z.object({
    homeWin: z.number().min(0).max(100),
    draw: z.number().min(0).max(100),
    awayWin: z.number().min(0).max(100),
  }).refine(
    (d) => Math.abs(d.homeWin + d.draw + d.awayWin - 100) <= 1,
    { message: 'Las probabilidades de 1X2 deben sumar aproximadamente 100%' }
  ),
  tacticalKeys: z.array(z.string()).min(2),
});

/* ----------------- BÁSQUETBOL (BASKETBALL) ----------------- */
export const BasketballTeamSchema = z.object({
  name: z.string().min(1),
  logoUrl: z.string().url(),
  conferenceRank: z.string(),
  offensiveRatingRank: z.number().positive(),
});

export const BasketballAnalysisSchema = BaseMatchAnalysisSchema.extend({
  sportType: z.literal('basketball'),
  homeTeam: BasketballTeamSchema,
  awayTeam: BasketballTeamSchema,
  metrics: z.object({
    threePointPct: z.object({
      homePct: z.number().min(0).max(100),
      awayPct: z.number().min(0).max(100),
    }),
    projectedRebounds: z.object({
      homeRebounds: z.number().min(0),
      awayRebounds: z.number().min(0),
    }),
    paceRating: z.object({
      projectedPossessions: z.number().positive(),
      paceStyle: z.enum(['FAST_BREAK', 'HALF_COURT', 'BALANCED']),
    }),
    overUnderTotalLine: z.number().positive(),
  }),
  oddsMoneyline: z.object({
    home: z.number().gt(1),
    away: z.number().gt(1),
  }),
  spread: z.object({
    favoredTeam: z.enum(['home', 'away']),
    points: z.number(),
    decimal: z.number().gt(1),
  }),
  probabilities: z.object({
    homeWin: z.number().min(0).max(100),
    awayWin: z.number().min(0).max(100),
  }).refine(
    (d) => Math.abs(d.homeWin + d.awayWin - 100) <= 1,
    { message: 'Las probabilidades Moneyline deben sumar aproximadamente 100%' }
  ),
  tacticalKeys: z.array(z.string()).min(2),
});

/* ----------------- TENIS (TENNIS) ----------------- */
export const TennisPlayerSchema = z.object({
  name: z.string().min(1),
  country: z.string().min(2),
  atpRanking: z.number().positive(),
  photoUrl: z.string().url(),
  dominantHand: z.enum(['Right', 'Left']),
});

export const TennisAnalysisSchema = BaseMatchAnalysisSchema.extend({
  sportType: z.literal('tennis'),
  playerOne: TennisPlayerSchema,
  playerTwo: TennisPlayerSchema,
  surface: z.enum(['GRASS', 'CLAY', 'HARD', 'INDOOR_HARD']),
  metrics: z.object({
    firstServePct: z.object({
      playerOne: z.number().min(0).max(100),
      playerTwo: z.number().min(0).max(100),
    }),
    projectedAces: z.object({
      playerOne: z.number().min(0),
      playerTwo: z.number().min(0),
    }),
    breakPointConversionPct: z.object({
      playerOne: z.number().min(0).max(100),
      playerTwo: z.number().min(0).max(100),
    }),
  }),
  oddsWinner: z.object({
    playerOne: z.number().gt(1),
    playerTwo: z.number().gt(1),
  }),
  probabilities: z.object({
    playerOneWin: z.number().min(0).max(100),
    playerTwoWin: z.number().min(0).max(100),
  }).refine(
    (d) => Math.abs(d.playerOneWin + d.playerTwoWin - 100) <= 1,
    { message: 'Probabilidades de victoria en tenis deben sumar 100%' }
  ),
  projectedSets: z.string(),
  tacticalKeys: z.array(z.string()).min(2),
});

/* ----------------- BOXEO / MMA (BOXING) ----------------- */
export const BoxerProfileSchema = z.object({
  name: z.string().min(1),
  nickname: z.string().optional(),
  record: z.string().regex(/^\d+-\d+-\d+(?:,\s*\d+\s*NC)?$/),
  reachInches: z.number().positive(),
  photoUrl: z.string().url(),
  fighterStyle: z.enum(['STRIKER', 'GRAPPLER', 'OUT_BOXER', 'PRESSURE_FIGHTER']),
});

export const BoxingAnalysisSchema = BaseMatchAnalysisSchema.extend({
  sportType: z.literal('boxing'),
  redCorner: BoxerProfileSchema,
  blueCorner: BoxerProfileSchema,
  weightClass: z.string(),
  scheduledRounds: z.number().positive(),
  metrics: z.object({
    reachAdvantageInches: z.number(),
    takedownDefenseOrGuardPct: z.object({
      redCorner: z.number().min(0).max(100),
      blueCorner: z.number().min(0).max(100),
    }),
    significantStrikesPerMin: z.object({
      redCorner: z.number().min(0),
      blueCorner: z.number().min(0),
    }),
    clashDynamic: z.string(),
  }),
  oddsWinner: z.object({
    red: z.number().gt(1),
    blue: z.number().gt(1),
    draw: z.number().gt(1).optional(),
  }),
  probabilities: z.object({
    redWin: z.number().min(0).max(100),
    blueWin: z.number().min(0).max(100),
  }).refine(
    (d) => Math.abs(d.redWin + d.blueWin - 100) <= 1,
    { message: 'Probabilidades de victoria en boxeo deben sumar 100%' }
  ),
  projectedMethod: z.enum(['KO_TKO', 'DECISION', 'SUBMISSION', 'DRAW']),
  tacticalKeys: z.array(z.string()).min(2),
});

// Zod Discriminated Union Maestro
export const UniversalMatchAnalysisSchema = z.discriminatedUnion('sportType', [
  SoccerAnalysisSchema,
  BasketballAnalysisSchema,
  TennisAnalysisSchema,
  BoxingAnalysisSchema,
]);

export type UniversalMatchAnalysis = z.infer<typeof UniversalMatchAnalysisSchema>;
export type SoccerAnalysis = z.infer<typeof SoccerAnalysisSchema>;
export type BasketballAnalysis = z.infer<typeof BasketballAnalysisSchema>;
export type TennisAnalysis = z.infer<typeof TennisAnalysisSchema>;
export type BoxingAnalysis = z.infer<typeof BoxingAnalysisSchema>;
export type SportType = UniversalMatchAnalysis['sportType'];

/* ==========================================================================
   2. EFECTO CSS HALFTONE GRUNGE & LOGO CONTAINERS
   ========================================================================== */

/**
 * Contenedor de Logo de Equipo / Atleta.
 * Conserva el color auténtico del escudo pero aplica fondo de semitono risográfico
 * neón (#D4FF3F) y negro con gradientes para la vibra punk poster.
 */
function HalftoneLogoContainer({
  src,
  alt,
  className = '',
  size = 'md',
}: {
  src: string;
  alt: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeClasses = {
    sm: 'w-12 h-12 p-1.5',
    md: 'w-18 h-18 sm:w-20 sm:h-20 p-2.5',
    lg: 'w-24 h-24 sm:w-28 sm:h-28 p-3',
  }[size];

  return (
    <div
      className={`relative rounded border border-white/[0.08] bg-[#050505] flex items-center justify-center overflow-hidden group shadow-[0_4px_20px_rgba(0,0,0,0.8)] ${sizeClasses} ${className}`}
    >
      {/* Trama de Semitono Halftone Neón en el Fondo */}
      <div
        className="absolute inset-0 bg-[radial-gradient(#D4FF3F_1px,transparent_1px)] [background-size:6px_6px] opacity-15 pointer-events-none group-hover:opacity-25 transition-opacity"
        aria-hidden="true"
      />
      {/* Resplandor radial oscuro */}
      <div
        className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_40%,#050505_100%)] pointer-events-none"
        aria-hidden="true"
      />
      {/* Escudo/Logo con color original preservado */}
      <img
        src={src}
        alt={alt}
        className="relative z-10 w-full h-full object-contain filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] transition-transform duration-300 group-hover:scale-110"
        loading="lazy"
        onError={(e) => {
          // Fallback a escudo genérico si la imagen remota falla
          (e.currentTarget as HTMLImageElement).src =
            'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="%23D4FF3F" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>';
        }}
      />
    </div>
  );
}

/* ==========================================================================
   3. SUB-COMPONENTES DE LAYOUT POR DEPORTE (FACTORY PRODUCTS)
   ========================================================================== */

/* ----------------- A. SOCCER LAYOUT ----------------- */
function SoccerLayout({ data }: { data: SoccerAnalysis }) {
  const { homeTeam, awayTeam, metrics, probabilities, odds1X2 } = data;

  return (
    <div className="space-y-6">
      {/* Cara a Cara de Equipos con Escudos Halftone */}
      <div className="relative rounded border border-white/[0.08] bg-[#080808] p-4 sm:p-6 overflow-hidden">
        {/* Trama de fondo */}
        <div className="absolute inset-0 bg-[radial-gradient(#050505_1.5px,transparent_1.5px)] [background-size:4px_4px] opacity-40 mix-blend-overlay pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 items-center gap-4 text-center">
          {/* Local */}
          <div className="flex flex-col items-center">
            <HalftoneLogoContainer src={homeTeam.logoUrl} alt={homeTeam.name} size="lg" />
            <h3 className="mt-3 font-display text-base sm:text-lg font-black text-white uppercase tracking-tight">
              {homeTeam.name}
            </h3>
            <span className="font-mono text-[10px] text-neutral-400">{homeTeam.leaguePosition}</span>
            <div className="mt-1 flex gap-1">
              {homeTeam.formLast5.map((r, i) => (
                <span
                  key={i}
                  className={`w-4 h-4 rounded text-[9px] font-mono font-bold flex items-center justify-center ${
                    r === 'W' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : r === 'D' ? 'bg-amber-500/20 text-amber-400' : 'bg-rose-500/20 text-rose-400'
                  }`}
                >
                  {r}
                </span>
              ))}
            </div>
          </div>

          {/* Marcador Probabilístico / VS */}
          <div className="flex flex-col items-center py-2">
            <span className="font-mono text-[9px] uppercase tracking-widest text-[#D4FF3F] bg-black/60 px-2.5 py-1 rounded border border-[#D4FF3F]/30 mb-2">
              PROBABILIDAD 1X2
            </span>
            <div className="flex items-baseline gap-2 font-mono text-xl sm:text-2xl font-black text-white">
              <span className="text-[#D4FF3F]">{probabilities.homeWin}%</span>
              <span className="text-neutral-500 text-sm">/ {probabilities.draw}% /</span>
              <span className="text-cyan-400">{probabilities.awayWin}%</span>
            </div>
            <div className="mt-2 text-[10px] font-mono text-neutral-400">
              CUOTAS: {odds1X2.home} • {odds1X2.draw} • {odds1X2.away}
            </div>
          </div>

          {/* Visitante */}
          <div className="flex flex-col items-center">
            <HalftoneLogoContainer src={awayTeam.logoUrl} alt={awayTeam.name} size="lg" />
            <h3 className="mt-3 font-display text-base sm:text-lg font-black text-white uppercase tracking-tight">
              {awayTeam.name}
            </h3>
            <span className="font-mono text-[10px] text-neutral-400">{awayTeam.leaguePosition}</span>
            <div className="mt-1 flex gap-1">
              {awayTeam.formLast5.map((r, i) => (
                <span
                  key={i}
                  className={`w-4 h-4 rounded text-[9px] font-mono font-bold flex items-center justify-center ${
                    r === 'W' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : r === 'D' ? 'bg-amber-500/20 text-amber-400' : 'bg-rose-500/20 text-rose-400'
                  }`}
                >
                  {r}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Métricas Tácticas de Fútbol */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Posesión Proyectada */}
        <div className="rounded border border-white/[0.06] bg-[#050505] p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[9px] uppercase tracking-wider text-neutral-400">POSESIÓN ESTIMADA</span>
            <Activity size={12} className="text-[#D4FF3F]" />
          </div>
          <div className="flex justify-between font-mono text-sm font-bold text-white mb-1.5">
            <span className="text-[#D4FF3F]">{metrics.possessionProjection.homePercent}%</span>
            <span className="text-cyan-400">{metrics.possessionProjection.awayPercent}%</span>
          </div>
          <div className="h-1.5 w-full bg-neutral-900 rounded-full overflow-hidden flex">
            <div className="h-full bg-[#D4FF3F]" style={{ width: `${metrics.possessionProjection.homePercent}%` }} />
            <div className="h-full bg-cyan-400" style={{ width: `${metrics.possessionProjection.awayPercent}%` }} />
          </div>
        </div>

        {/* Tiros al Arco & xG */}
        <div className="rounded border border-white/[0.06] bg-[#050505] p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[9px] uppercase tracking-wider text-neutral-400">TIROS A PUERTA & xG</span>
            <Crosshair size={12} className="text-[#D4FF3F]" />
          </div>
          <div className="flex justify-between font-mono text-xs text-white">
            <span>{homeTeam.name.split(' ')[0]}: <strong className="text-[#D4FF3F]">{metrics.shotsOnTarget.homeShots}</strong> ({metrics.expectedGoals.homeXG} xG)</span>
          </div>
          <div className="flex justify-between font-mono text-xs text-white mt-1">
            <span>{awayTeam.name.split(' ')[0]}: <strong className="text-cyan-400">{metrics.shotsOnTarget.awayShots}</strong> ({metrics.expectedGoals.awayXG} xG)</span>
          </div>
        </div>

        {/* Probabilidad BTTS */}
        <div className="rounded border border-white/[0.06] bg-[#050505] p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[9px] uppercase tracking-wider text-neutral-400">AMBOS ANOTAN (BTTS)</span>
            <Flame size={12} className="text-amber-400" />
          </div>
          <div className="flex items-baseline justify-between font-mono">
            <span className="text-2xl font-black text-amber-400">{metrics.bttsProbabilityPercent}%</span>
            <span className="text-[10px] text-neutral-400 uppercase">TENDENCIA ALTA</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------- B. BASKETBALL / COURT LAYOUT ----------------- */
function CourtLayout({ data }: { data: BasketballAnalysis }) {
  const { homeTeam, awayTeam, metrics, probabilities, oddsMoneyline, spread } = data;

  return (
    <div className="space-y-6">
      {/* Cara a Cara de Cancha con Logotipos Halftone */}
      <div className="relative rounded border border-white/[0.08] bg-[#080808] p-4 sm:p-6 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(#050505_1.5px,transparent_1.5px)] [background-size:4px_4px] opacity-40 mix-blend-overlay pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 items-center gap-4 text-center">
          {/* Local */}
          <div className="flex flex-col items-center">
            <HalftoneLogoContainer src={homeTeam.logoUrl} alt={homeTeam.name} size="lg" />
            <h3 className="mt-3 font-display text-base sm:text-lg font-black text-white uppercase tracking-tight">
              {homeTeam.name}
            </h3>
            <span className="font-mono text-[10px] text-neutral-400">{homeTeam.conferenceRank}</span>
            <span className="mt-1 text-[9px] font-mono text-[#D4FF3F] bg-[#D4FF3F]/10 px-2 py-0.5 rounded">
              OFF RTG: #{homeTeam.offensiveRatingRank}
            </span>
          </div>

          {/* Moneyline & Spread */}
          <div className="flex flex-col items-center py-2">
            <span className="font-mono text-[9px] uppercase tracking-widest text-[#D4FF3F] bg-black/60 px-2.5 py-1 rounded border border-[#D4FF3F]/30 mb-2">
              MONEYLINE PROBABILITY
            </span>
            <div className="flex items-baseline gap-2 font-mono text-2xl font-black text-white">
              <span className="text-[#D4FF3F]">{probabilities.homeWin}%</span>
              <span className="text-neutral-500 text-sm">vs</span>
              <span className="text-cyan-400">{probabilities.awayWin}%</span>
            </div>
            <div className="mt-2 text-xs font-mono font-bold text-white bg-white/[0.04] px-3 py-1 rounded border border-white/[0.06]">
              SPREAD: {spread.favoredTeam === 'home' ? homeTeam.name.split(' ').pop() : awayTeam.name.split(' ').pop()} {spread.points} ({spread.decimal})
            </div>
            <span className="mt-1 font-mono text-[9px] text-neutral-400">O/U LÍNEA: {metrics.overUnderTotalLine} PTS</span>
          </div>

          {/* Visitante */}
          <div className="flex flex-col items-center">
            <HalftoneLogoContainer src={awayTeam.logoUrl} alt={awayTeam.name} size="lg" />
            <h3 className="mt-3 font-display text-base sm:text-lg font-black text-white uppercase tracking-tight">
              {awayTeam.name}
            </h3>
            <span className="font-mono text-[10px] text-neutral-400">{awayTeam.conferenceRank}</span>
            <span className="mt-1 text-[9px] font-mono text-cyan-400 bg-cyan-400/10 px-2 py-0.5 rounded">
              OFF RTG: #{awayTeam.offensiveRatingRank}
            </span>
          </div>
        </div>
      </div>

      {/* Métricas de Cancha: Triples, Rebotes, Ritmo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded border border-white/[0.06] bg-[#050505] p-3.5 flex flex-col justify-between">
          <span className="font-mono text-[9px] uppercase text-neutral-400 mb-1">EFECTIVIDAD TRIPLES (3PT%)</span>
          <div className="flex justify-between font-mono text-sm font-bold text-white">
            <span className="text-[#D4FF3F]">{metrics.threePointPct.homePct}%</span>
            <span className="text-cyan-400">{metrics.threePointPct.awayPct}%</span>
          </div>
          <div className="h-1.5 w-full bg-neutral-900 rounded-full overflow-hidden flex mt-2">
            <div className="h-full bg-[#D4FF3F]" style={{ width: `${metrics.threePointPct.homePct}%` }} />
            <div className="h-full bg-cyan-400" style={{ width: `${metrics.threePointPct.awayPct}%` }} />
          </div>
        </div>

        <div className="rounded border border-white/[0.06] bg-[#050505] p-3.5 flex flex-col justify-between">
          <span className="font-mono text-[9px] uppercase text-neutral-400 mb-1">PROYECCIÓN DE REBOTES</span>
          <div className="flex justify-between font-mono text-sm font-bold text-white">
            <span>{homeTeam.name.split(' ').pop()}: <strong className="text-[#D4FF3F]">{metrics.projectedRebounds.homeRebounds}</strong></span>
            <span>{awayTeam.name.split(' ').pop()}: <strong className="text-cyan-400">{metrics.projectedRebounds.awayRebounds}</strong></span>
          </div>
          <span className="text-[10px] text-neutral-400 mt-1 font-mono">Diferencial: +{Math.abs(metrics.projectedRebounds.homeRebounds - metrics.projectedRebounds.awayRebounds)} rebotes</span>
        </div>

        <div className="rounded border border-white/[0.06] bg-[#050505] p-3.5 flex flex-col justify-between">
          <span className="font-mono text-[9px] uppercase text-neutral-400 mb-1">RITMO & POSESIONES</span>
          <div className="flex items-baseline justify-between font-mono">
            <span className="text-xl font-black text-white">{metrics.paceRating.projectedPossessions}</span>
            <span className="text-[9px] font-bold text-[#D4FF3F] bg-[#D4FF3F]/10 px-2 py-0.5 rounded border border-[#D4FF3F]/30 uppercase">
              {metrics.paceRating.paceStyle}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------- C. TENNIS LAYOUT ----------------- */
function TennisLayout({ data }: { data: TennisAnalysis }) {
  const { playerOne, playerTwo, metrics, probabilities, oddsWinner, surface, projectedSets } = data;

  return (
    <div className="space-y-6">
      {/* Duelo de Tenistas en Superficie */}
      <div className="relative rounded border border-white/[0.08] bg-[#080808] p-4 sm:p-6 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(#050505_1.5px,transparent_1.5px)] [background-size:4px_4px] opacity-40 mix-blend-overlay pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 items-center gap-4 text-center">
          {/* Jugador 1 */}
          <div className="flex flex-col items-center">
            <HalftoneLogoContainer src={playerOne.photoUrl} alt={playerOne.name} size="lg" />
            <h3 className="mt-3 font-display text-base sm:text-lg font-black text-white uppercase tracking-tight">
              {playerOne.name}
            </h3>
            <span className="font-mono text-[10px] text-[#D4FF3F]">
              ATP #{playerOne.atpRanking} • {playerOne.country} ({playerOne.dominantHand})
            </span>
          </div>

          {/* Probabilidades & Superficie */}
          <div className="flex flex-col items-center py-2">
            <span className="font-mono text-[9px] uppercase tracking-widest text-black bg-[#D4FF3F] font-bold px-2.5 py-0.5 rounded shadow-[0_0_10px_rgba(212,255,63,0.5)] mb-2">
              PISTA: {surface}
            </span>
            <div className="flex items-baseline gap-2 font-mono text-2xl font-black text-white">
              <span className="text-[#D4FF3F]">{probabilities.playerOneWin}%</span>
              <span className="text-neutral-500 text-sm">vs</span>
              <span className="text-cyan-400">{probabilities.playerTwoWin}%</span>
            </div>
            <div className="mt-2 text-[10px] font-mono text-neutral-300">
              CUOTAS: {oddsWinner.playerOne} vs {oddsWinner.playerTwo}
            </div>
            <span className="mt-1 font-mono text-[10px] font-bold text-amber-400">{projectedSets}</span>
          </div>

          {/* Jugador 2 */}
          <div className="flex flex-col items-center">
            <HalftoneLogoContainer src={playerTwo.photoUrl} alt={playerTwo.name} size="lg" />
            <h3 className="mt-3 font-display text-base sm:text-lg font-black text-white uppercase tracking-tight">
              {playerTwo.name}
            </h3>
            <span className="font-mono text-[10px] text-cyan-400">
              ATP #{playerTwo.atpRanking} • {playerTwo.country} ({playerTwo.dominantHand})
            </span>
          </div>
        </div>
      </div>

      {/* Métricas de Saque, Aces y Puntos de Quiebre */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded border border-white/[0.06] bg-[#050505] p-3.5 flex flex-col justify-between">
          <span className="font-mono text-[9px] uppercase text-neutral-400 mb-1">1ER SERVICIO EFECTIVO (%)</span>
          <div className="flex justify-between font-mono text-sm font-bold text-white">
            <span className="text-[#D4FF3F]">{metrics.firstServePct.playerOne}%</span>
            <span className="text-cyan-400">{metrics.firstServePct.playerTwo}%</span>
          </div>
          <div className="h-1.5 w-full bg-neutral-900 rounded-full overflow-hidden flex mt-2">
            <div className="h-full bg-[#D4FF3F]" style={{ width: `${metrics.firstServePct.playerOne}%` }} />
            <div className="h-full bg-cyan-400" style={{ width: `${metrics.firstServePct.playerTwo}%` }} />
          </div>
        </div>

        <div className="rounded border border-white/[0.06] bg-[#050505] p-3.5 flex flex-col justify-between">
          <span className="font-mono text-[9px] uppercase text-neutral-400 mb-1">ACES PROYECTADOS</span>
          <div className="flex justify-between font-mono text-sm font-bold text-white">
            <span>{playerOne.name.split(' ').pop()}: <strong className="text-[#D4FF3F]">{metrics.projectedAces.playerOne}</strong></span>
            <span>{playerTwo.name.split(' ').pop()}: <strong className="text-cyan-400">{metrics.projectedAces.playerTwo}</strong></span>
          </div>
          <span className="text-[10px] text-neutral-400 mt-1 font-mono">Total de Aces: {metrics.projectedAces.playerOne + metrics.projectedAces.playerTwo}</span>
        </div>

        <div className="rounded border border-white/[0.06] bg-[#050505] p-3.5 flex flex-col justify-between">
          <span className="font-mono text-[9px] uppercase text-neutral-400 mb-1">CONVERSIÓN DE BREAK POINT</span>
          <div className="flex justify-between font-mono text-sm font-bold text-white">
            <span className="text-[#D4FF3F]">{metrics.breakPointConversionPct.playerOne}%</span>
            <span className="text-cyan-400">{metrics.breakPointConversionPct.playerTwo}%</span>
          </div>
          <span className="text-[9px] text-neutral-500 mt-1 font-mono">Bajo presión en deuce</span>
        </div>
      </div>
    </div>
  );
}

/* ----------------- D. BOXING / MMA RING LAYOUT ----------------- */
function RingLayout({ data }: { data: BoxingAnalysis }) {
  const { redCorner, blueCorner, metrics, probabilities, oddsWinner, weightClass, scheduledRounds, projectedMethod } = data;

  return (
    <div className="space-y-6">
      {/* Cara a Cara en Cuadrilátero con Fotos Halftone */}
      <div className="relative rounded border border-white/[0.08] bg-[#080808] p-4 sm:p-6 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(#050505_1.5px,transparent_1.5px)] [background-size:4px_4px] opacity-40 mix-blend-overlay pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 items-center gap-4 text-center">
          {/* Esquina Roja */}
          <div className="flex flex-col items-center">
            <HalftoneLogoContainer src={redCorner.photoUrl} alt={redCorner.name} size="lg" />
            <h3 className="mt-3 font-display text-base sm:text-lg font-black text-white uppercase tracking-tight">
              {redCorner.name}
            </h3>
            <span className="font-mono text-[10px] text-red-400 font-bold">
              {redCorner.record} • {redCorner.reachInches}" ALCANCE
            </span>
            <span className="mt-1 text-[9px] font-mono text-red-300 bg-red-950/40 px-2 py-0.5 rounded border border-red-500/30 uppercase">
              {redCorner.fighterStyle}
            </span>
          </div>

          {/* Probabilidad & Método */}
          <div className="flex flex-col items-center py-2">
            <span className="font-mono text-[9px] uppercase tracking-widest text-[#D4FF3F] bg-black/60 px-2.5 py-1 rounded border border-[#D4FF3F]/30 mb-2">
              {scheduledRounds} ASALTOS // {weightClass}
            </span>
            <div className="flex items-baseline gap-2 font-mono text-2xl font-black text-white">
              <span className="text-red-400">{probabilities.redWin}%</span>
              <span className="text-neutral-500 text-sm">vs</span>
              <span className="text-cyan-400">{probabilities.blueWin}%</span>
            </div>
            <div className="mt-2 text-xs font-mono font-bold text-[#D4FF3F] bg-white/[0.04] px-3 py-1 rounded border border-white/[0.06]">
              DESENLACE: {projectedMethod}
            </div>
            <span className="mt-1 font-mono text-[9px] text-neutral-400">
              CUOTAS: {oddsWinner.red} vs {oddsWinner.blue}
            </span>
          </div>

          {/* Esquina Azul */}
          <div className="flex flex-col items-center">
            <HalftoneLogoContainer src={blueCorner.photoUrl} alt={blueCorner.name} size="lg" />
            <h3 className="mt-3 font-display text-base sm:text-lg font-black text-white uppercase tracking-tight">
              {blueCorner.name}
            </h3>
            <span className="font-mono text-[10px] text-cyan-400 font-bold">
              {blueCorner.record} • {blueCorner.reachInches}" ALCANCE
            </span>
            <span className="mt-1 text-[9px] font-mono text-cyan-300 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-500/30 uppercase">
              {blueCorner.fighterStyle}
            </span>
          </div>
        </div>
      </div>

      {/* Métricas de Combate: Alcance, Golpes Significativos y Choque de Estilos */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded border border-white/[0.06] bg-[#050505] p-3.5 flex flex-col justify-between">
          <span className="font-mono text-[9px] uppercase text-neutral-400 mb-1">DIFERENCIAL DE ALCANCE</span>
          <div className="font-mono text-lg font-black text-[#D4FF3F]">
            {metrics.reachAdvantageInches > 0 ? `+${metrics.reachAdvantageInches}" Esquina Roja` : `${metrics.reachAdvantageInches}" Esquina Azul`}
          </div>
          <span className="text-[10px] text-neutral-400 font-mono">Control de distancia con jab</span>
        </div>

        <div className="rounded border border-white/[0.06] bg-[#050505] p-3.5 flex flex-col justify-between">
          <span className="font-mono text-[9px] uppercase text-neutral-400 mb-1">GOLPES SIGNIFICATIVOS / MIN</span>
          <div className="flex justify-between font-mono text-sm font-bold text-white">
            <span className="text-red-400">{metrics.significantStrikesPerMin.redCorner}</span>
            <span className="text-cyan-400">{metrics.significantStrikesPerMin.blueCorner}</span>
          </div>
          <div className="h-1.5 w-full bg-neutral-900 rounded-full overflow-hidden flex mt-2">
            <div className="h-full bg-red-500" style={{ width: `${(metrics.significantStrikesPerMin.redCorner / 12) * 100}%` }} />
            <div className="h-full bg-cyan-400" style={{ width: `${(metrics.significantStrikesPerMin.blueCorner / 12) * 100}%` }} />
          </div>
        </div>

        <div className="rounded border border-white/[0.06] bg-[#050505] p-3.5 flex flex-col justify-between">
          <span className="font-mono text-[9px] uppercase text-neutral-400 mb-1">DINÁMICA DEL CHOQUE</span>
          <p className="text-[11px] text-neutral-300 font-sans leading-tight">
            {metrics.clashDynamic}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   4. SKELETON LOADING Y ERROR BOUNDARY
   ========================================================================== */

function UniversalAnalysisSkeleton({ sport }: { sport: SportType }) {
  const steps = [
    `Cargando motor predictivo para ${sport.toUpperCase()}...`,
    'Normalizando variables biomecánicas y telemetría de eventos...',
    'Ejecutando simulaciones estocásticas Monte Carlo (10,000 iteraciones)...',
    'Calculando diferenciales de valor y desajustes de línea en las cuotas...',
  ];
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentStep((p) => (p < steps.length - 1 ? p + 1 : p));
    }, 1250);
    return () => clearInterval(timer);
  }, [steps.length]);

  return (
    <div
      className="relative overflow-hidden rounded-sm border border-white/[0.08] bg-[#050505] p-6 shadow-2xl"
      aria-busy="true"
    >
      {/* Barra de progreso Neón */}
      <div className="absolute top-0 inset-x-0 h-1 bg-white/[0.05]">
        <div className="h-full bg-[#D4FF3F] w-1/3 animate-pulse shadow-[0_0_12px_#D4FF3F]" />
      </div>

      <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-[#D4FF3F] animate-pulse" />
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-white">
            PROCESANDO ANÁLISIS DEPORTIVO MULTIDISCIPLINAR // {sport.toUpperCase()}
          </span>
        </div>
        <span className="font-mono text-[9px] text-[#D4FF3F] font-bold">LATENCIA ESTIMADA: 5.0s</span>
      </div>

      <div className="my-5 rounded bg-[#0D0D0D] border border-white/[0.06] p-3.5 font-mono text-xs">
        <div className="flex items-center gap-2 text-neutral-400 mb-2 text-[10px]">
          <Terminal size={12} className="text-[#D4FF3F]" />
          <span>LLM_INFERENCE_ORCHESTRATOR // AGNOSTIC_STREAM</span>
        </div>
        <p className="text-[#D4FF3F] font-bold text-[11px] flex items-center gap-2">
          <Clock size={12} className="animate-spin text-[#D4FF3F]" />
          {steps[currentStep]}
        </p>
      </div>

      {/* Placeholders animados */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 animate-pulse">
        <div className="h-44 rounded bg-white/[0.02] border border-white/[0.05] p-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="h-4 w-1/2 bg-white/[0.08] rounded" />
            <div className="h-3 w-3/4 bg-white/[0.04] rounded" />
          </div>
          <div className="h-10 w-full bg-[#D4FF3F]/10 rounded border border-[#D4FF3F]/20" />
        </div>
        <div className="h-44 rounded bg-white/[0.02] border border-white/[0.05] p-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="h-4 w-2/3 bg-white/[0.08] rounded" />
            <div className="h-3 w-5/6 bg-white/[0.04] rounded" />
          </div>
          <div className="h-10 w-full bg-white/[0.04] rounded" />
        </div>
      </div>
    </div>
  );
}

function UniversalAnalysisError({
  errorMessage,
  zodIssues,
  onRetry,
}: {
  errorMessage: string;
  zodIssues?: z.ZodIssue[];
  onRetry: () => void;
}) {
  return (
    <div className="rounded-sm border-2 border-red-500/40 bg-[#050505] p-6 shadow-[0_0_28px_rgba(239,68,68,0.15)] text-left">
      <div className="flex items-start gap-3.5">
        <div className="p-2.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded">
          <ShieldAlert size={24} />
        </div>
        <div className="flex-1">
          <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-red-400">
            ERROR DE DISCRIMINACIÓN ZOD // RECHAZO DE PAYLOAD
          </span>
          <h3 className="mt-1 font-display text-lg font-black uppercase text-white">
            Inconsistencia en Esquema Polimórfico
          </h3>
          <p className="mt-1 text-xs text-neutral-300 font-sans">{errorMessage}</p>

          {zodIssues && zodIssues.length > 0 && (
            <div className="mt-3 p-3 bg-red-950/20 border border-red-900/40 rounded font-mono text-[10px] text-red-300 space-y-1">
              <span className="font-bold text-red-200 block uppercase">Detalle de Violación Zod:</span>
              {zodIssues.map((issue, idx) => (
                <div key={idx} className="flex items-start gap-1">
                  <span>•</span>
                  <span><strong>[{issue.path.join('.') || 'root'}]:</strong> {issue.message}</span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#D4FF3F] text-black font-display font-black text-xs uppercase hover:bg-[#b8e82a] transition active:translate-y-px"
            >
              <RefreshCw size={13} /> Reintentar Inferencia Segura
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   5. COMPONENTE FACTORY PRINCIPAL: UniversalAnalysisCard
   ========================================================================== */

export interface UniversalAnalysisCardProps {
  /** Payload real de análisis. Sin dato no se renderiza tarjeta: nunca se rellena con mocks. */
  analysisData: unknown;
  /** Selector de deporte para demostración interactiva */
  selectedSport?: SportType;
  /** Latencia simulada en ms (5000ms según requerimiento) */
  simulatedDelayMs?: number;
  /** Forzar estado de error para testing */
  forceError?: boolean;
  /** Conexión con BetSlip para apostar el pick recomendado */
  onAddSelection?: (selection: SelectionInput) => void;
  onRemoveSelection?: (selectionId: string) => void;
  selectedIds?: readonly string[];
}

export default function UniversalAnalysisCard({
  analysisData,
  selectedSport: controlledSport,
  simulatedDelayMs = 5000,
  forceError = false,
  onAddSelection,
  onRemoveSelection,
  selectedIds,
}: UniversalAnalysisCardProps) {
  // Selector interno si no se provee por props
  const [internalSport, setInternalSport] = useState<SportType>('soccer');
  const activeSport = controlledSport ?? internalSport;

  const [loading, setLoading] = useState(true);
  const [validatedData, setValidatedData] = useState<UniversalMatchAnalysis | null>(null);
  const [errorState, setErrorState] = useState<{ message: string; issues?: z.ZodIssue[] } | null>(null);

  const containerId = useId();

  const rawPayload = analysisData;

  // Simulación asíncrona de 5s del LLM con validación Zod
  const executeInference = () => {
    setLoading(true);
    setErrorState(null);

    const timer = setTimeout(() => {
      if (forceError) {
        setErrorState({ message: 'Timeout o error de conectividad con el LLM agnóstico.' });
        setLoading(false);
        return;
      }

      // Validación con Zod Discriminated Union
      const parseResult = UniversalMatchAnalysisSchema.safeParse(rawPayload);

      if (!parseResult.success) {
        setErrorState({
          message: `El JSON recibido no cumple con la especificación del deporte '${activeSport}'.`,
          issues: parseResult.error.issues,
        });
        setLoading(false);
        return;
      }

      setValidatedData(parseResult.data);
      setLoading(false);
    }, simulatedDelayMs);

    return () => clearTimeout(timer);
  };

  useEffect(() => {
    return executeInference();
  }, [activeSport, rawPayload, forceError, simulatedDelayMs]);

  // Render Skeleton Loading
  if (loading) {
    return (
      <div className="w-full max-w-4xl mx-auto my-6">
        <UniversalAnalysisSkeleton sport={activeSport} />
      </div>
    );
  }

  // Render Error Boundary
  if (errorState || !validatedData) {
    return (
      <div className="w-full max-w-4xl mx-auto my-6">
        <UniversalAnalysisError
          errorMessage={errorState?.message ?? 'Error desconocido al validar payload de deportes.'}
          zodIssues={errorState?.issues}
          onRetry={executeInference}
        />
      </div>
    );
  }

  const selectionId = `val-${validatedData.id}-${validatedData.recommendedBetAngle.selectionName.replace(/\s+/g, '_')}`;
  const isPickSelected = selectedIds ? selectedIds.includes(selectionId) : false;

  const handleTogglePick = () => {
    if (isPickSelected) {
      onRemoveSelection?.(selectionId);
    } else {
      const parsedOdds = parseFloat(validatedData.recommendedBetAngle.suggestedLine.replace(/[^0-9.]/g, ''));
      const odds = !Number.isNaN(parsedOdds) && parsedOdds > 1 ? parsedOdds : 1.95;
      onAddSelection?.({
        selectionId,
        eventId: validatedData.id,
        marketId: `mkt-${validatedData.id}-${validatedData.recommendedBetAngle.marketType}`,
        eventName: validatedData.competition,
        marketLabel: validatedData.recommendedBetAngle.marketType,
        selectionName: validatedData.recommendedBetAngle.selectionName,
        odds,
        eventStatus: validatedData.status.toLowerCase(),
        eventIsBettingOpen: validatedData.status !== 'FINISHED',
      });
    }
  };

  // Factoría: Renderizado condicional mediante Switch Statement según sportType
  const renderSportSpecificLayout = (data: UniversalMatchAnalysis) => {
    switch (data.sportType) {
      case 'soccer':
        return <SoccerLayout data={data} />;
      case 'basketball':
        return <CourtLayout data={data} />;
      case 'tennis':
        return <TennisLayout data={data} />;
      case 'boxing':
        return <RingLayout data={data} />;
      default: {
        const _exhaustive: never = data;
        const fallback = _exhaustive as unknown as { sportType?: string };
        throw new Error(`Deporte no soportado en la factoría: ${fallback?.sportType ?? 'desconocido'}`);
      }
    }
  };

  return (
    <article
      id={containerId}
      className="w-full max-w-4xl mx-auto my-6 rounded-sm border border-white/[0.08] bg-[#0D0D0D] text-white shadow-2xl overflow-hidden font-sans"
      aria-label={`Análisis ZenBet para ${validatedData.competition}`}
    >
      {/* ====================================================================
          BARRA SUPERIOR: TELEMETRÍA, SELECTOR DEPORTIVO Y CONFIANZA
          ==================================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] bg-[#050505] px-4 py-2.5 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#D4FF3F] shadow-[0_0_8px_#D4FF3F]" />
          <span className="font-mono text-[10px] font-bold text-white uppercase tracking-widest">
            ZENBET // {validatedData.sportType.toUpperCase()} INTELLIGENCE UNIT
          </span>
          <span className="hidden sm:inline font-mono text-[9px] text-neutral-500">
            / {validatedData.llmTelemetry.modelIdentifier}
          </span>
        </div>

        {/* Selector interactivo de deporte */}
        <div className="flex items-center gap-2">
          <div className="flex bg-[#0D0D0D] rounded p-0.5 border border-white/[0.08]">
            {(['soccer', 'basketball', 'tennis', 'boxing'] as SportType[]).map((sport) => (
              <button
                key={sport}
                type="button"
                onClick={() => setInternalSport(sport)}
                className={`px-2 py-0.5 font-mono text-[9px] font-bold uppercase transition rounded-xs ${
                  activeSport === sport
                    ? 'bg-[#D4FF3F] text-black shadow-[0_0_8px_rgba(212,255,63,0.4)]'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                {sport === 'soccer' ? 'Fútbol' : sport === 'basketball' ? 'Basket' : sport === 'tennis' ? 'Tenis' : 'Boxeo'}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={executeInference}
            className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-neutral-400 hover:text-[#D4FF3F] transition p-1"
            title="Recalcular inferencia"
          >
            <RefreshCw size={11} />
          </button>
        </div>
      </div>

      {/* Header del Torneo y Venue */}
      <div className="px-4 py-2 bg-[#050505] border-b border-white/[0.04] flex flex-wrap justify-between items-center text-neutral-400 font-mono text-[10px]">
        <span className="text-[#D4FF3F] font-bold uppercase">{validatedData.competition}</span>
        <span>{validatedData.venue}</span>
      </div>

      {/* ====================================================================
          CUERPO POLIMÓRFICO: FACTORY SWITCH STATEMENT
          ==================================================================== */}
      <div className="p-4 sm:p-6 space-y-6">
        {renderSportSpecificLayout(validatedData)}

        {/* Resumen Ejecutivo del Modelo */}
        <div className="border-t border-white/[0.08] pt-5">
          <h2 className="font-display text-lg sm:text-xl font-black uppercase text-white tracking-tight">
            {validatedData.headline}
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-neutral-300 leading-relaxed font-sans">
            {validatedData.summary}
          </p>
        </div>

        {/* Factores Clave Tácticos */}
        <div className="rounded border border-white/[0.06] bg-[#050505] p-4">
          <span className="font-mono text-[9px] uppercase font-bold text-neutral-400 tracking-wider block mb-2">
            FACTORES TÁCTICOS DETERMINANTES
          </span>
          <ul className="space-y-1.5 text-xs text-neutral-300">
            {validatedData.tacticalKeys.map((key, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-[#D4FF3F] font-bold mt-0.5">▸</span>
                <span>{key}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* ====================================================================
            PICK DE VALOR DEPORTIVO (Value Bet Angle)
            ==================================================================== */}
        <div className="relative overflow-hidden rounded border-2 border-[#D4FF3F]/80 bg-gradient-to-r from-[#D4FF3F]/[0.08] to-transparent p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 font-mono text-[9px] font-black uppercase text-[#D4FF3F]">
              <Zap size={12} className="fill-[#D4FF3F]" />
              PICK DE VALOR RECOMENDADO // SPORTSBOOK ANGLE
            </span>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-black/60 border border-[#D4FF3F]/40 font-mono text-[9px] font-black text-[#D4FF3F]">
                GRADO {validatedData.recommendedBetAngle.confidenceGrade}
              </span>
              <span
                className={`px-2 py-0.5 rounded font-mono text-[9px] font-bold uppercase ${
                  validatedData.recommendedBetAngle.riskLevel === 'LOW'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : validatedData.recommendedBetAngle.riskLevel === 'MODERATE'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                }`}
              >
                RIESGO: {validatedData.recommendedBetAngle.riskLevel}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-baseline justify-between gap-2 mt-1">
            <div>
              <p className="font-mono text-[10px] text-neutral-400 uppercase">
                {validatedData.recommendedBetAngle.marketType}
              </p>
              <h3 className="font-display text-lg sm:text-xl font-black text-white uppercase tracking-tight">
                {validatedData.recommendedBetAngle.selectionName}
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm sm:text-base font-black text-[#D4FF3F] bg-black/70 px-2.5 py-1 rounded border border-[#D4FF3F]/30">
                {validatedData.recommendedBetAngle.suggestedLine}
              </span>
              {onAddSelection && (
                <button
                  type="button"
                  onClick={handleTogglePick}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 font-mono text-[10px] font-bold uppercase transition rounded ${
                    isPickSelected
                      ? 'border border-[#D4FF3F] bg-[#D4FF3F]/20 text-[#D4FF3F] shadow-[0_0_12px_rgba(212,255,63,0.3)]'
                      : 'border border-[#D4FF3F]/50 bg-[#D4FF3F]/10 text-white hover:bg-[#D4FF3F]/20 hover:border-[#D4FF3F]'
                  }`}
                >
                  {isPickSelected ? <Check size={12} className="text-[#D4FF3F]" /> : null}
                  {isPickSelected ? 'En Boleto' : '+ Añadir al Boleto'}
                </button>
              )}
            </div>
          </div>

          <p className="mt-2 text-xs text-neutral-300 leading-relaxed font-sans border-t border-white/[0.08] pt-2">
            <strong className="text-white">Tesis del Modelo:</strong> {validatedData.recommendedBetAngle.rationale}
          </p>
        </div>
      </div>

      {/* Footer Legal & Telemetría */}
      <div className="border-t border-white/[0.08] bg-[#050505] px-4 py-3 sm:px-6 flex flex-wrap items-center justify-between text-neutral-500 font-mono text-[9px]">
        <span>INFERENCIA: {validatedData.llmTelemetry.generatedAt}</span>
        <span>LATENCIA: {validatedData.llmTelemetry.inferenceLatencyMs}ms • MODELO AGNÓSTICO</span>
      </div>
    </article>
  );
}

