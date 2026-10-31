import React, { useState, useEffect, useId, useMemo } from 'react';
import { z } from 'zod';
import {
  Brain,
  Sparkles,
  Flame,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  TrendingUp,
  ShieldAlert,
  Swords,
  Scale,
  Zap,
  Clock,
  Terminal,
  Layers,
} from 'lucide-react';

/* ==========================================================================
   1. ESQUEMAS ZOD ESTRICTOS (Contrato Universal para LLMs Agnósticos)
   ========================================================================== */

export const FighterProfileSchema = z.object({
  name: z.string().min(1, 'El nombre del peleador es obligatorio'),
  nickname: z.string().optional(),
  record: z.string().regex(/^\d+-\d+-\d+(?:,\s*\d+\s*NC)?$/, 'Formato de récord inválido (ej: 14-2-0)'),
  division: z.string().min(1),
  stance: z.enum(['orthodox', 'southpaw', 'switch', 'unknown']),
  reachInches: z.number().positive('El alcance debe ser mayor a 0'),
  photoUrl: z.string().url('URL de imagen no válida'),
});

export const BoutContextSchema = z.object({
  id: z.string().min(1),
  competition: z.string().min(1),
  weightClass: z.string().min(1),
  scheduledRounds: z.union([z.literal(3), z.literal(5)]),
  isTitleFight: z.boolean(),
  venue: z.string(),
  redCorner: FighterProfileSchema,
  blueCorner: FighterProfileSchema,
  odds: z.object({
    redDecimal: z.number().gt(1, 'Las cuotas deben ser mayores a 1.00'),
    blueDecimal: z.number().gt(1, 'Las cuotas deben ser mayores a 1.00'),
  }),
});

export const TacticalFactorSchema = z.object({
  category: z.string().min(1),
  edge: z.enum(['red', 'blue', 'even']),
  confidence: z.number().min(0).max(100),
  analysis: z.string().min(10, 'El análisis táctico debe ser descriptivo'),
});

export const ValueBetAngleSchema = z.object({
  marketType: z.string(),
  selectionName: z.string(),
  suggestedLine: z.string(),
  confidenceGrade: z.enum(['A+', 'A', 'B+', 'B', 'SPECULATIVE']),
  riskLevel: z.enum(['LOW', 'MODERATE', 'HIGH', 'DEGEN']),
  rationale: z.string().min(10),
});

export const FightAnalysisSchema = z.object({
  headline: z.string().min(5, 'Titular demasiado corto'),
  summary: z.string().min(20, 'El resumen ejecutivo debe contener detalles técnicos'),
  winProbability: z.object({
    redCornerPercent: z.number().min(1).max(99),
    blueCornerPercent: z.number().min(1).max(99),
    modelConfidence: z.enum(['HIGH', 'MEDIUM', 'SPECULATIVE']),
  }).refine(
    (data) => Math.abs(data.redCornerPercent + data.blueCornerPercent - 100) <= 0.5,
    { message: 'Las probabilidades de victoria deben sumar 100%' }
  ),
  predictedOutcome: z.object({
    favoredCorner: z.enum(['red', 'blue']),
    method: z.enum(['KO_TKO', 'SUBMISSION', 'DECISION']),
    projectedRound: z.union([z.number().min(1).max(5), z.literal('DECISION')]),
    confidenceScore: z.number().min(1).max(100),
  }),
  tacticalClashes: z.array(TacticalFactorSchema).min(2, 'Debe incluir al menos 2 factores de choque de estilos'),
  criticalVulnerabilities: z.array(z.string().min(5)).min(1),
  recommendedBetAngle: ValueBetAngleSchema,
  llmTelemetry: z.object({
    modelIdentifier: z.string(),
    inferenceLatencyMs: z.number().positive(),
    generatedAt: z.string(),
  }),
});

export type BoutContext = z.infer<typeof BoutContextSchema>;
export type FightAnalysis = z.infer<typeof FightAnalysisSchema>;

/* ==========================================================================
   2. FIXTURES Y MOCKS SIMULADOS PARA PRUEBAS AISLADAS
   ========================================================================== */

export const SAMPLE_BOUT: BoutContext = {
  id: 'ufc-334-ciryl-gane-vs-josh-hokit',
  competition: 'UFC 334 // Madison Square Garden',
  weightClass: 'Heavyweight (265 lbs)',
  scheduledRounds: 5,
  isTitleFight: true,
  venue: 'Nueva York, EE. UU.',
  redCorner: {
    name: 'Ciryl Gane',
    nickname: 'Bon Gamin',
    record: '14-2-0',
    division: 'Heavyweight',
    stance: 'orthodox',
    reachInches: 81,
    photoUrl: 'https://a.espncdn.com/i/headshots/mma/players/full/4426000.png',
  },
  blueCorner: {
    name: 'Josh Hokit',
    nickname: 'The Animal',
    record: '6-0-0',
    division: 'Heavyweight',
    stance: 'southpaw',
    reachInches: 76,
    photoUrl: 'https://a.espncdn.com/i/headshots/mma/players/full/4049391.png',
  },
  odds: {
    redDecimal: 1.45,
    blueDecimal: 2.85,
  },
};

export const VALID_AI_RESPONSE: FightAnalysis = {
  headline: 'DISPARIDAD DE RITMO Y DISTANCIA EN LAS 265 LBS',
  summary:
    'Gane mantiene una superioridad abrumadora en volumen de golpeo técnico y gestión de ángulos (+5.2 golpes significativos por minuto). Hokit necesitará neutralizar el movimiento lateral en los primeros 7 minutos mediante derribos de doble pierna contra la reja si desea sobrevivir al castigo a media distancia.',
  winProbability: {
    redCornerPercent: 68,
    blueCornerPercent: 32,
    modelConfidence: 'HIGH',
  },
  predictedOutcome: {
    favoredCorner: 'red',
    method: 'KO_TKO',
    projectedRound: 3,
    confidenceScore: 78,
  },
  tacticalClashes: [
    {
      category: 'Control de Distancia & Striking',
      edge: 'red',
      confidence: 88,
      analysis: 'Ventaja de 5 pulgadas de alcance para Gane con fintas de pateo bajo que condicionan la guardia.',
    },
    {
      category: 'Iniciación de Lucha & Presión',
      edge: 'blue',
      confidence: 72,
      analysis: 'Hokit promedia 4.1 derribos por 15 min, pero su efectividad decae drásticamente tras el 2do asalto.',
    },
    {
      category: 'Cardio en Aguas Profundas (Rounds 4-5)',
      edge: 'red',
      confidence: 94,
      analysis: 'Gane ha disputado múltiples peleas estelares de 25 minutos con índice de output constante.',
    },
  ],
  criticalVulnerabilities: [
    'Hokit absorbe 3.8 golpes por minuto al cerrar la distancia sin cambio de nivel previo.',
    'Defensa de derribo de Gane (68%) ha mostrado fisuras ante wrestlers de poder explosivo en el primer asalto.',
  ],
  recommendedBetAngle: {
    marketType: 'Método de Victoria Exacto',
    selectionName: 'Ciryl Gane por KO/TKO o Descalificación',
    suggestedLine: 'Cuota 2.10 (+110)',
    confidenceGrade: 'A',
    riskLevel: 'MODERATE',
    rationale: 'La acumulación de castigo técnico abrirá una finalización por stoppage arbitral en los asaltos intermedios.',
  },
  llmTelemetry: {
    modelIdentifier: 'Agnostic-DeepReason-MMA-v2.4',
    inferenceLatencyMs: 6420,
    generatedAt: new Date().toISOString(),
  },
};

/* ==========================================================================
   3. SUBCOMPONENTES VISUALES: DUOTONO, SKELETON, FALLBACK
   ========================================================================== */

interface DuotonePosterFighterProps {
  photoUrl: string;
  name: string;
  corner: 'red' | 'blue';
  record: string;
  reachInches: number;
  stance: string;
}

/**
 * Componente "Punk Poster / High-Contrast Duotone".
 * Transforma fotos estándar en cartelería de imprenta underground (verde lima neón y negro)
 * empleando únicamente clases modernas de Tailwind CSS v4.
 */
export function DuotonePosterFighter({
  photoUrl,
  name,
  corner,
  record,
  reachInches,
  stance,
}: DuotonePosterFighterProps) {
  const isRed = corner === 'red';

  return (
    <div className="relative group w-full h-72 sm:h-80 overflow-hidden bg-[#D4FF3F] border border-white/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.8)]">
      {/* 
        CAPA 1: Imagen Original Procesada
        - grayscale: elimina tono cromático
        - contrast-[220%]: satura negros y quema blancos emulando fotocopia Xerox
        - brightness-90: estabiliza luces altas
        - mix-blend-multiply: fusiona con el fondo #D4FF3F haciendo que las luces se vuelvan neón y las sombras negro absoluto
      */}
      <img
        src={photoUrl}
        alt={name}
        className="w-full h-full object-cover object-top filter grayscale contrast-[220%] brightness-90 mix-blend-multiply transition-transform duration-700 ease-out group-hover:scale-105"
        loading="lazy"
      />

      {/* 
        CAPA 2: Trama Grunge de Puntos Halftone / Risógrafo (Puro CSS)
      */}
      <div
        className="absolute inset-0 bg-[radial-gradient(#050505_1.5px,transparent_1.5px)] [background-size:4px_4px] opacity-35 mix-blend-overlay pointer-events-none"
        aria-hidden="true"
      />

      {/* 
        CAPA 3: Degradado de Sombras para Legibilidad Tipográfica
      */}
      <div
        className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/40 to-transparent mix-blend-multiply pointer-events-none"
        aria-hidden="true"
      />

      {/* 
        CAPA 4: Resplandor de Ribete Punk en Esquinas
      */}
      <div
        className={`absolute top-0 ${isRed ? 'left-0 border-l-4 border-t-4 border-red-500' : 'right-0 border-r-4 border-t-4 border-cyan-400'} w-5 h-5 pointer-events-none opacity-80`}
        aria-hidden="true"
      />

      {/* Badge de Esquina */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5">
        <span
          className={`px-2 py-0.5 text-[9px] font-mono font-black uppercase tracking-widest ${
            isRed ? 'bg-red-600 text-white shadow-[0_0_12px_rgba(239,68,68,0.7)]' : 'bg-cyan-500 text-black shadow-[0_0_12px_rgba(6,182,212,0.7)]'
          }`}
        >
          {isRed ? 'Esquina Roja' : 'Esquina Azul'}
        </span>
      </div>

      {/* Metadata Tipográfica Superpuesta */}
      <div className="absolute bottom-3 inset-x-3 z-10 flex flex-col justify-end">
        <p className="font-mono text-[9px] font-semibold text-[#D4FF3F] tracking-widest uppercase">
          {record} • {reachInches}" REACH • {stance.toUpperCase()}
        </p>
        <h3 className="font-display text-xl sm:text-2xl font-black uppercase text-white tracking-tight leading-none drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
          {name}
        </h3>
      </div>
    </div>
  );
}

/**
 * Estado Visual: Skeleton Loading (Simulación de Inferencia LLM 5-10s)
 */
function FightAnalysisSkeleton() {
  const steps = [
    'Conectando al motor de inferencia LLM agnóstico...',
    'Escanenado biomecánica de golpeo y diferenciales de alcance...',
    'Corriendo 10,000 simulaciones estocásticas de intercambio en suelo...',
    'Extrayendo ineficiencias de mercado y ángulos de valor...',
  ];
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev < steps.length - 1 ? prev + 1 : prev));
    }, 1600);
    return () => clearInterval(interval);
  }, [steps.length]);

  return (
    <div
      className="relative overflow-hidden rounded-sm border border-white/[0.08] bg-[#050505] p-5 sm:p-7 shadow-[0_8px_32px_rgba(0,0,0,0.95)]"
      aria-busy="true"
      aria-label="Cargando análisis de IA para el combate"
    >
      {/* Barra de progreso de escaneo neón superior */}
      <div className="absolute top-0 inset-x-0 h-1 bg-white/[0.05] overflow-hidden">
        <div className="h-full bg-[#D4FF3F] w-1/3 animate-[shimmer_2s_infinite] shadow-[0_0_12px_#D4FF3F]" />
      </div>

      {/* Header Loading */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-[#D4FF3F] animate-pulse" aria-hidden="true" />
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-white">
            PROCESANDO TELEMETRÍA DE COMBATE CON IA
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#D4FF3F] animate-ping" />
          <span className="font-mono text-[9px] text-[#D4FF3F] uppercase font-bold">
            LATENCIA PROMEDIO: 6.4s
          </span>
        </div>
      </div>

      {/* Visualización de Terminal de Inferencia */}
      <div className="my-5 rounded bg-[#0D0D0D] border border-white/[0.06] p-3.5 font-mono text-xs">
        <div className="flex items-center gap-2 text-metallic-slate mb-2 text-[10px]">
          <Terminal size={12} className="text-[#D4FF3F]" />
          <span>LLM_REASONING_PIPELINE // EXEC_STREAM</span>
        </div>
        <p className="text-[#D4FF3F] font-bold text-[11px] flex items-center gap-2">
          <Clock size={12} className="animate-spin text-[#D4FF3F]" />
          {steps[currentStep]}
        </p>
      </div>

      {/* Grid de Esqueletos Placeholder */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <div className="h-64 rounded bg-white/[0.02] border border-white/[0.05] p-4 flex flex-col justify-between animate-pulse">
          <div className="space-y-2.5">
            <div className="h-4 w-3/4 bg-white/[0.08] rounded" />
            <div className="h-3 w-full bg-white/[0.04] rounded" />
            <div className="h-3 w-5/6 bg-white/[0.04] rounded" />
          </div>
          <div className="h-8 w-1/2 bg-[#D4FF3F]/10 rounded border border-[#D4FF3F]/20" />
        </div>
        <div className="h-64 rounded bg-white/[0.02] border border-white/[0.05] p-4 flex flex-col justify-between animate-pulse">
          <div className="space-y-2.5">
            <div className="h-4 w-2/3 bg-white/[0.08] rounded" />
            <div className="h-10 w-full bg-white/[0.04] rounded" />
            <div className="h-10 w-full bg-white/[0.04] rounded" />
          </div>
          <div className="h-8 w-1/3 bg-white/[0.06] rounded" />
        </div>
      </div>
    </div>
  );
}

/**
 * Estado Visual: Error / Fallback (Cuando falla validación Zod o red)
 */
interface FightAnalysisErrorProps {
  errorMessage: string;
  zodIssues?: z.ZodIssue[];
  onRetry: () => void;
}

function FightAnalysisError({ errorMessage, zodIssues, onRetry }: FightAnalysisErrorProps) {
  return (
    <div
      className="relative rounded-sm border-2 border-red-500/40 bg-[#050505] p-6 sm:p-8 text-left shadow-[0_0_28px_rgba(239,68,68,0.15)]"
      role="alert"
    >
      <div className="flex items-start gap-3.5">
        <div className="p-2.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded">
          <ShieldAlert size={24} />
        </div>
        <div className="flex-1">
          <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-red-400">
            ERROR DE VALIDACIÓN ZOD // RESPUESTA DE IA RECHAZADA
          </span>
          <h3 className="mt-1 font-display text-lg font-black uppercase text-white tracking-wide">
            Inconsistencia en el Payload del Modelo
          </h3>
          <p className="mt-1 text-xs text-neutral-300 leading-relaxed font-sans">
            {errorMessage}
          </p>

          {/* Si hay issues detallados de Zod, se listan para auditoría técnica */}
          {zodIssues && zodIssues.length > 0 && (
            <div className="mt-4 p-3 bg-red-950/20 border border-red-900/40 rounded font-mono text-[10px] text-red-300 space-y-1">
              <span className="font-bold uppercase tracking-wider block text-red-200">
                Reglas Zod vulneradas:
              </span>
              {zodIssues.map((issue, idx) => (
                <div key={idx} className="flex items-start gap-1.5">
                  <span className="text-red-400">•</span>
                  <span>
                    <strong>[{issue.path.join('.') || 'root'}]:</strong> {issue.message}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#D4FF3F] text-black font-display font-black text-xs uppercase tracking-wider hover:bg-[#b8e82a] transition duration-150 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4FF3F]"
            >
              <RefreshCw size={13} className="stroke-[2.5]" />
              Reintentar Inferencia Segura
            </button>
            <span className="font-mono text-[10px] text-neutral-500 uppercase">
              Regla de oro: Cero mocks inventados en producción
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   4. COMPONENTE PRINCIPAL: FightAnalysisCard
   ========================================================================== */

export interface FightAnalysisCardProps {
  bout?: BoutContext;
  /** Permite inyectar un payload crudo simulado para testear validación Zod */
  rawInjectedResponse?: unknown;
  /** Latencia simulada en ms (por defecto 6000ms según requerimiento 5-10s) */
  simulatedDelayMs?: number;
  /** Permite forzar error para testing de estado Fallback */
  forceError?: boolean;
}

/**
 * FightAnalysisCard — Componente totalmente desacoplado y autónomo para ZenBet.
 * Diseñado con estética Neo-Brutalista, Duotono Punk CSS y validación estricta Zod.
 */
export default function FightAnalysisCard({
  bout = SAMPLE_BOUT,
  rawInjectedResponse = VALID_AI_RESPONSE,
  simulatedDelayMs = 4500,
  forceError = false,
}: FightAnalysisCardProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [analysis, setAnalysis] = useState<FightAnalysis | null>(null);
  const [errorState, setErrorState] = useState<{
    message: string;
    issues?: z.ZodIssue[];
  } | null>(null);

  const containerId = useId();

  // Simulación del ciclo de vida asíncrono con el LLM agnóstico
  const executeInference = () => {
    setLoading(true);
    setErrorState(null);

    const timer = setTimeout(() => {
      if (forceError) {
        setErrorState({
          message: 'Fallo simulado: La API del LLM no respondió en el tiempo de corte estipulado.',
        });
        setLoading(false);
        return;
      }

      // Validación estricta con Zod en el borde del cliente
      const parseResult = FightAnalysisSchema.safeParse(rawInjectedResponse);

      if (!parseResult.success) {
        setErrorState({
          message: 'El JSON devuelto por la IA no cumple con las restricciones dimensionales y tipos del contrato.',
          issues: parseResult.error.issues,
        });
        setLoading(false);
        return;
      }

      setAnalysis(parseResult.data);
      setLoading(false);
    }, simulatedDelayMs);

    return () => clearTimeout(timer);
  };

  useEffect(() => {
    const cancel = executeInference();
    return cancel;
  }, [rawInjectedResponse, forceError, simulatedDelayMs]);

  // 1. Estado Visual: Skeleton Loading
  if (loading) {
    return (
      <div className="w-full max-w-4xl mx-auto my-6">
        <FightAnalysisSkeleton />
      </div>
    );
  }

  // 2. Estado Visual: Error / Fallback
  if (errorState || !analysis) {
    return (
      <div className="w-full max-w-4xl mx-auto my-6">
        <FightAnalysisError
          errorMessage={errorState?.message ?? 'Error indeterminado al procesar el análisis.'}
          zodIssues={errorState?.issues}
          onRetry={executeInference}
        />
      </div>
    );
  }

  // 3. Estado Visual: Success
  const { winProbability, predictedOutcome, recommendedBetAngle } = analysis;
  const isRedFavored = predictedOutcome.favoredCorner === 'red';

  return (
    <article
      id={containerId}
      className="w-full max-w-4xl mx-auto my-6 rounded-sm border border-white/[0.08] bg-[#0D0D0D] text-white shadow-[0_12px_48px_rgba(0,0,0,0.95)] overflow-hidden font-sans"
      aria-label={`Análisis de IA: ${bout.redCorner.name} vs ${bout.blueCorner.name}`}
    >
      {/* ====================================================================
          BARRA DE ESTADO SUPERIOR: TELEMETRÍA Y BRANDING
          ==================================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] bg-[#050505] px-4 py-2.5 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-[#D4FF3F] shadow-[0_0_8px_#D4FF3F]" />
          <span className="font-mono text-[10px] font-bold tracking-widest text-white uppercase">
            ZENBET // IA INTELLIGENCE UNIT
          </span>
          <span className="hidden sm:inline-block text-white/20 font-mono">/</span>
          <span className="hidden sm:inline-block font-mono text-[9px] text-metallic-slate">
            {analysis.llmTelemetry.modelIdentifier}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="border border-white/[0.08] bg-white/[0.02] px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-[#D4FF3F]">
            CONFIANZA: {winProbability.modelConfidence}
          </span>
          <button
            type="button"
            onClick={executeInference}
            className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-neutral-400 hover:text-[#D4FF3F] transition-colors"
            title="Recalcular análisis"
          >
            <RefreshCw size={10} />
            <span className="hidden sm:inline">Re-Simular</span>
          </button>
        </div>
      </div>

      {/* ====================================================================
          SECCIÓN HERO: COMBATE CON EFECTO DUOTONO PUNK POSTER
          ==================================================================== */}
      <div className="p-4 sm:p-6 bg-[#080808]">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-mono text-[10px] font-bold uppercase tracking-ultra text-[#D4FF3F]">
            {bout.competition}
          </span>
          <span className="font-mono text-[10px] uppercase text-neutral-400">
            {bout.scheduledRounds} ASALTOS • {bout.weightClass}
          </span>
        </div>

        {/* Galería Cara a Cara Duotono */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <DuotonePosterFighter
            photoUrl={bout.redCorner.photoUrl}
            name={bout.redCorner.name}
            corner="red"
            record={bout.redCorner.record}
            reachInches={bout.redCorner.reachInches}
            stance={bout.redCorner.stance}
          />
          <DuotonePosterFighter
            photoUrl={bout.blueCorner.photoUrl}
            name={bout.blueCorner.name}
            corner="blue"
            record={bout.blueCorner.record}
            reachInches={bout.blueCorner.reachInches}
            stance={bout.blueCorner.stance}
          />
        </div>
      </div>

      {/* ====================================================================
          BARRA DE PROBABILIDAD ESTOCÁSTICA DE VICTORIA
          ==================================================================== */}
      <div className="border-y border-white/[0.08] bg-[#050505] px-4 py-4 sm:px-6">
        <div className="flex items-center justify-between mb-2 font-mono text-xs font-bold uppercase">
          <span className="text-red-400 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 bg-red-500 rounded-full" />
            {bout.redCorner.name}: {winProbability.redCornerPercent}%
          </span>
          <span className="text-neutral-400 text-[10px] font-normal tracking-widest hidden sm:inline">
            PROBABILIDAD ASIGNADA POR IA
          </span>
          <span className="text-cyan-400 flex items-center gap-1.5">
            {bout.blueCorner.name}: {winProbability.blueCornerPercent}%
            <span className="h-1.5 w-1.5 bg-cyan-400 rounded-full" />
          </span>
        </div>

        {/* Barra Visual Proporcional Dual */}
        <div className="relative h-2.5 w-full bg-[#1A1A1A] overflow-hidden rounded-xs flex">
          <div
            className="h-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-1000 ease-out"
            style={{ width: `${winProbability.redCornerPercent}%` }}
          />
          <div
            className="h-full bg-gradient-to-r from-cyan-400 to-cyan-600 transition-all duration-1000 ease-out"
            style={{ width: `${winProbability.blueCornerPercent}%` }}
          />
        </div>
      </div>

      {/* ====================================================================
          CUERPO DEL ANÁLISIS TÁCTICO & RESULTADO PROYECTADO
          ==================================================================== */}
      <div className="p-4 sm:p-6 space-y-6">
        {/* Titular y Resumen */}
        <div>
          <h2 className="font-display text-xl sm:text-2xl font-black uppercase text-white tracking-tight leading-tight">
            {analysis.headline}
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-neutral-300 leading-relaxed font-sans">
            {analysis.summary}
          </p>
        </div>

        {/* Tarjeta de Pronóstico Arbitral / Finalización */}
        <div className="rounded border border-white/[0.08] bg-[#050505] p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#D4FF3F]/10 border border-[#D4FF3F]/30 text-[#D4FF3F] rounded">
              <Swords size={20} />
            </div>
            <div>
              <span className="font-mono text-[9px] uppercase font-bold text-neutral-400 tracking-wider">
                DESENLACE MÁS PROBABLE
              </span>
              <p className="font-display text-base font-bold text-white uppercase">
                {predictedOutcome.favoredCorner === 'red' ? bout.redCorner.name : bout.blueCorner.name} por{' '}
                <span className="text-[#D4FF3F]">{predictedOutcome.method.replace('_', '/')}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-right">
            <div>
              <span className="font-mono text-[9px] uppercase text-neutral-400 block">ASALTO PROYECTADO</span>
              <span className="font-mono text-sm font-black text-white">
                {predictedOutcome.projectedRound === 'DECISION' ? 'A LAS TARJETAS' : `ASALTO ${predictedOutcome.projectedRound}`}
              </span>
            </div>
            <div className="border-l border-white/[0.08] pl-4">
              <span className="font-mono text-[9px] uppercase text-neutral-400 block">PRECISIÓN</span>
              <span className="font-mono text-sm font-black text-[#D4FF3F]">
                {predictedOutcome.confidenceScore}%
              </span>
            </div>
          </div>
        </div>

        {/* Factores Clave de Choque de Estilos (Tactical Keys) */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Layers size={14} className="text-[#D4FF3F]" />
            <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-white">
              DINÁMICA DE ESTILOS & VENTAJA TÁCTICA
            </h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {analysis.tacticalClashes.map((clash, index) => {
              const edgeIsRed = clash.edge === 'red';
              const edgeIsBlue = clash.edge === 'blue';

              return (
                <div
                  key={index}
                  className="rounded border border-white/[0.06] bg-[#050505] p-3.5 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-display text-xs font-bold text-white uppercase">
                        {clash.category}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 text-[8px] font-mono font-bold uppercase rounded ${
                          edgeIsRed
                            ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                            : edgeIsBlue
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                            : 'bg-white/10 text-neutral-300 border border-white/20'
                        }`}
                      >
                        {edgeIsRed ? 'Borde Rojo' : edgeIsBlue ? 'Borde Azul' : 'Neutro'}
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-400 leading-normal">
                      {clash.analysis}
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-white/[0.04] flex items-center justify-between font-mono text-[9px] text-neutral-500">
                    <span>CONFIANZA DEL BORDE</span>
                    <span className="text-white font-bold">{clash.confidence}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Vulnerabilidades Críticas Identificadas */}
        <div className="rounded border border-white/[0.06] bg-[#050505] p-4">
          <div className="flex items-center gap-2 mb-2 text-amber-400 font-mono text-[10px] font-bold uppercase tracking-wider">
            <AlertTriangle size={13} />
            <span>VULNERABILIDADES TÉCNICAS DETERMINANTES</span>
          </div>
          <ul className="space-y-1.5 text-xs text-neutral-300">
            {analysis.criticalVulnerabilities.map((vuln, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-[#D4FF3F] font-bold leading-none mt-1">▸</span>
                <span>{vuln}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* ====================================================================
            PICK DE VALOR DE APUESTA (Recomendación con Nivel de Riesgo)
            ==================================================================== */}
        <div className="relative overflow-hidden rounded border-2 border-[#D4FF3F]/80 bg-gradient-to-r from-[#D4FF3F]/[0.08] to-transparent p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 font-mono text-[9px] font-black uppercase tracking-widest text-[#D4FF3F]">
              <Zap size={12} className="fill-[#D4FF3F]" />
              ÁNGULO DE VALOR SUGERIDO // SPORTSBOOK PICK
            </span>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-black/60 border border-[#D4FF3F]/40 font-mono text-[9px] font-black text-[#D4FF3F]">
                GRADO {recommendedBetAngle.confidenceGrade}
              </span>
              <span
                className={`px-2 py-0.5 rounded font-mono text-[9px] font-bold uppercase ${
                  recommendedBetAngle.riskLevel === 'LOW'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : recommendedBetAngle.riskLevel === 'MODERATE'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                }`}
              >
                RIESGO: {recommendedBetAngle.riskLevel}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-baseline justify-between gap-2 mt-1">
            <div>
              <p className="font-mono text-[10px] text-neutral-400 uppercase">
                {recommendedBetAngle.marketType}
              </p>
              <h3 className="font-display text-lg sm:text-xl font-black text-white uppercase tracking-tight">
                {recommendedBetAngle.selectionName}
              </h3>
            </div>
            <div className="text-right">
              <span className="font-mono text-sm sm:text-base font-black text-[#D4FF3F] bg-black/70 px-2.5 py-1 rounded border border-[#D4FF3F]/30">
                {recommendedBetAngle.suggestedLine}
              </span>
            </div>
          </div>

          <p className="mt-2 text-xs text-neutral-300 leading-relaxed font-sans border-t border-white/[0.08] pt-2">
            <strong className="text-white">Tesis del Modelo:</strong> {recommendedBetAngle.rationale}
          </p>
        </div>
      </div>

      {/* ====================================================================
          FOOTER LEGAL Y DE CONTROL DEL PROVEEDOR AGNOSTICO
          ==================================================================== */}
      <div className="border-t border-white/[0.08] bg-[#050505] px-4 py-3 sm:px-6 flex flex-wrap items-center justify-between text-neutral-500 font-mono text-[9px]">
        <span>MODEL_INFERENCE_TIMESTAMP: {analysis.llmTelemetry.generatedAt}</span>
        <span>NO ES ASESORAMIENTO FINANCIERO • PROBABILIDADES ESTIMADAS</span>
      </div>
    </article>
  );
}
