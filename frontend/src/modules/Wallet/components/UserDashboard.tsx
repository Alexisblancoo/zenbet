import React, { useState, useEffect, useId, useMemo } from 'react';
import { z } from 'zod';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Trophy,
  Ticket,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Flame,
  Search,
  Filter,
  Layers,
  Copy,
  Check,
  Terminal,
  Zap,
} from 'lucide-react';

/* ==========================================================================
   1. ESQUEMAS ZOD ESTRICTOS (Perfil, Billetera y Ledger Contable)
   ========================================================================== */

export const UserTierSchema = z.enum(['ROOKIE', 'PRO', 'VIP_CYBER', 'HIGH_ROLLER']);

export const UserProfileSchema = z.object({
  id: z.string().min(1, 'ID de usuario requerido'),
  username: z.string().min(3, 'El username debe tener al menos 3 caracteres'),
  email: z.string().email('Formato de correo no válido'),
  tier: UserTierSchema,
  avatarUrl: z.string().url('URL de avatar inválida'),
  joinedDate: z.string(),
  isVerified: z.boolean(),
  kycStatus: z.enum(['VERIFIED', 'PENDING', 'UNVERIFIED']),
});

export const WalletBalanceSchema = z.object({
  currency: z.literal('USD'),
  available: z.number().min(0, 'El saldo disponible no puede ser negativo'),
  lockedInBets: z.number().min(0, 'El saldo retenido no puede ser negativo'),
  totalDeposited: z.number().min(0),
  totalWon: z.number().min(0),
  netPnL: z.number(),
});

export const LedgerEntryTypeSchema = z.enum([
  'DEPOSIT',
  'BET_PLACED',
  'BET_WON',
  'BET_LOST',
  'WITHDRAWAL',
]);

export const LedgerEntrySchema = z.object({
  id: z.string().min(1),
  type: LedgerEntryTypeSchema,
  amount: z.number(), // Positivo (ingreso / premio) o Negativo (apuesta / retiro)
  currency: z.literal('USD').default('USD'),
  description: z.string().min(3),
  referenceTicket: z.string().optional(),
  eventTitle: z.string().optional(),
  selectionLabel: z.string().optional(),
  oddsDecimal: z.number().gt(1).optional(),
  timestamp: z.string(),
  status: z.enum(['COMPLETED', 'PENDING', 'SETTLED', 'FAILED']),
});

export const UserDashboardDataSchema = z.object({
  user: UserProfileSchema,
  wallet: WalletBalanceSchema,
  ledger: z.array(LedgerEntrySchema),
});

export type UserTier = z.infer<typeof UserTierSchema>;
export type UserProfile = z.infer<typeof UserProfileSchema>;
export type WalletBalance = z.infer<typeof WalletBalanceSchema>;
export type LedgerEntryType = z.infer<typeof LedgerEntryTypeSchema>;
export type LedgerEntry = z.infer<typeof LedgerEntrySchema>;
export type UserDashboardData = z.infer<typeof UserDashboardDataSchema>;

/* ==========================================================================
   2. FIXTURES Y MOCKS HIPERREALISTAS (Saldo, 3 Apuestas y 1 Depósito)
   ========================================================================== */

export const MOCK_USER_PROFILE: UserProfile = {
  id: 'usr-zen-9942',
  username: 'Vortex_Bettor',
  email: 'vortex.bettor@zenbet.io',
  tier: 'VIP_CYBER',
  avatarUrl:
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=250&auto=format&fit=crop',
  joinedDate: '2025-08-14T10:00:00Z',
  isVerified: true,
  kycStatus: 'VERIFIED',
};

export const MOCK_WALLET_BALANCE: WalletBalance = {
  currency: 'USD',
  available: 2845.5,
  lockedInBets: 350.0,
  totalDeposited: 4500.0,
  totalWon: 6195.5,
  netPnL: 1695.5,
};

export const MOCK_LEDGER_ENTRIES: LedgerEntry[] = [
  {
    id: 'tx-win-8812',
    type: 'BET_WON',
    amount: 420.0,
    currency: 'USD',
    description: 'Liquidación Ganadora: Ciryl Gane por KO/TKO en Round 3',
    referenceTicket: 'TKT-UFC-9481',
    eventTitle: 'UFC 334: Ciryl Gane vs Josh Hokit',
    selectionLabel: 'Ciryl Gane (KO/TKO o DQ)',
    oddsDecimal: 2.1,
    timestamp: '2026-10-30T23:15:00Z',
    status: 'SETTLED',
  },
  {
    id: 'tx-bet-7741',
    type: 'BET_PLACED',
    amount: -150.0,
    currency: 'USD',
    description: 'Apuesta Simple: Ambos Equipos Anotan & Más de 2.5 Goles',
    referenceTicket: 'TKT-UCL-4109',
    eventTitle: 'Real Madrid CF vs Manchester City FC',
    selectionLabel: 'BTTS: Sí & Over 2.5 Goles',
    oddsDecimal: 1.95,
    timestamp: '2026-10-31T01:45:00Z',
    status: 'PENDING',
  },
  {
    id: 'tx-bet-6623',
    type: 'BET_PLACED',
    amount: -200.0,
    currency: 'USD',
    description: 'Apuesta Handicap: Boston Celtics -5.5 Puntos',
    referenceTicket: 'TKT-NBA-3012',
    eventTitle: 'Boston Celtics vs Golden State Warriors',
    selectionLabel: 'Boston Celtics -5.5 Spread',
    oddsDecimal: 1.92,
    timestamp: '2026-10-31T03:10:00Z',
    status: 'PENDING',
  },
  {
    id: 'tx-dep-5501',
    type: 'DEPOSIT',
    amount: 500.0,
    currency: 'USD',
    description: 'Depósito Instantáneo Sandbox // Red USDT TRC-20',
    referenceTicket: 'DEP-SNBX-1049',
    timestamp: '2026-10-29T18:30:00Z',
    status: 'COMPLETED',
  },
];

export const MOCK_INITIAL_DASHBOARD_DATA: UserDashboardData = {
  user: MOCK_USER_PROFILE,
  wallet: MOCK_WALLET_BALANCE,
  ledger: MOCK_LEDGER_ENTRIES,
};

/* ==========================================================================
   3. FORMATEADORES Y UTILIDADES FINANCIERAS
   ========================================================================== */

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return isoString;
  }
}

/* ==========================================================================
   4. ESTADOS VISUALES: SKELETON LOADING Y ERROR BOUNDARY
   ========================================================================== */

function UserDashboardSkeleton() {
  return (
    <div
      className="relative overflow-hidden rounded-sm border border-white/[0.08] bg-[#050505] p-6 sm:p-8 shadow-2xl animate-pulse"
      aria-busy="true"
    >
      {/* Barra scanline superior neón */}
      <div className="absolute top-0 inset-x-0 h-1 bg-white/[0.05]">
        <div className="h-full bg-[#D4FF3F] w-1/4 animate-[shimmer_2s_infinite] shadow-[0_0_12px_#D4FF3F]" />
      </div>

      <div className="flex items-center justify-between border-b border-white/[0.08] pb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded bg-white/[0.06]" />
          <div className="space-y-2">
            <div className="h-4 w-36 bg-white/[0.08] rounded" />
            <div className="h-3 w-48 bg-white/[0.04] rounded" />
          </div>
        </div>
        <div className="h-8 w-24 bg-white/[0.06] rounded" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-6">
        <div className="h-28 rounded bg-white/[0.03] border border-white/[0.05] p-4" />
        <div className="h-28 rounded bg-white/[0.03] border border-white/[0.05] p-4" />
        <div className="h-28 rounded bg-white/[0.03] border border-white/[0.05] p-4" />
      </div>

      <div className="space-y-3 mt-8">
        <div className="h-4 w-32 bg-white/[0.08] rounded" />
        <div className="h-20 rounded bg-white/[0.02] border border-white/[0.04]" />
        <div className="h-20 rounded bg-white/[0.02] border border-white/[0.04]" />
      </div>
    </div>
  );
}

function UserDashboardError({
  errorMessage,
  zodIssues,
  onRetry,
}: {
  errorMessage: string;
  zodIssues?: z.ZodIssue[];
  onRetry: () => void;
}) {
  return (
    <div className="rounded-sm border-2 border-red-500/40 bg-[#050505] p-6 sm:p-8 text-left shadow-[0_0_32px_rgba(239,68,68,0.15)]">
      <div className="flex items-start gap-4">
        <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded">
          <AlertTriangle size={24} />
        </div>
        <div className="flex-1">
          <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-red-400">
            ERROR DE VALIDACIÓN ZOD // CONTRATO FINANCIERO VIOLADO
          </span>
          <h3 className="mt-1 font-display text-lg font-black uppercase text-white tracking-wide">
            Fallo de Integridad en el Perfil o Billetera
          </h3>
          <p className="mt-1 text-xs text-neutral-300 font-sans">{errorMessage}</p>

          {zodIssues && zodIssues.length > 0 && (
            <div className="mt-4 p-3 bg-red-950/20 border border-red-900/40 rounded font-mono text-[10px] text-red-300 space-y-1">
              <span className="font-bold text-red-200 uppercase block">Campos no conformes:</span>
              {zodIssues.map((issue, idx) => (
                <div key={idx}>
                  • <strong>[{issue.path.join('.') || 'root'}]:</strong> {issue.message}
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={onRetry}
            className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-[#D4FF3F] text-black font-display font-black text-xs uppercase hover:bg-[#b8e82a] transition active:translate-y-px"
          >
            <RefreshCw size={13} /> Reintentar Carga Segura
          </button>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   5. FILA DEL HISTORIAL CONTABLE (LedgerTransactionCard)
   ========================================================================== */

function LedgerTransactionCard({ entry }: { entry: LedgerEntry }) {
  const isPositive = entry.amount > 0;
  const isDeposit = entry.type === 'DEPOSIT';
  const isWin = entry.type === 'BET_WON';
  const isBet = entry.type === 'BET_PLACED';

  // Configuración de ícono e identidad visual por tipo
  const typeConfig = useMemo(() => {
    if (isDeposit) {
      return {
        icon: <ArrowDownLeft size={18} className="text-[#D4FF3F]" />,
        badgeBg: 'bg-[#D4FF3F]/10 border-[#D4FF3F]/30 text-[#D4FF3F]',
        label: 'DEPÓSITO SANDBOX',
        amountColor: 'text-[#D4FF3F]',
      };
    }
    if (isWin) {
      return {
        icon: <Trophy size={18} className="text-[#D4FF3F]" />,
        badgeBg: 'bg-[#D4FF3F]/15 border-[#D4FF3F]/40 text-[#D4FF3F]',
        label: 'PREMIO GANADO',
        amountColor: 'text-[#D4FF3F]',
      };
    }
    if (isBet) {
      return {
        icon: <Ticket size={18} className="text-cyan-400" />,
        badgeBg: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400',
        label: 'APUESTA EN JUEGO',
        amountColor: 'text-neutral-300',
      };
    }
    return {
      icon: <ArrowUpRight size={18} className="text-rose-400" />,
      badgeBg: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
      label: 'TRANSACCIÓN',
      amountColor: 'text-rose-400',
    };
  }, [isDeposit, isWin, isBet]);

  return (
    <div className="relative group overflow-hidden rounded border border-white/[0.06] bg-[#050505] p-4 transition-all duration-200 hover:border-white/[0.15] hover:bg-[#080808]">
      {/* Trama de semitono en hover */}
      <div
        className="absolute inset-0 bg-[radial-gradient(#D4FF3F_1px,transparent_1px)] [background-size:6px_6px] opacity-0 group-hover:opacity-10 transition-opacity pointer-events-none"
        aria-hidden="true"
      />

      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Lado Izquierdo: Ícono y Detalles */}
        <div className="flex items-start gap-3.5">
          <div
            className={`p-2.5 rounded border ${typeConfig.badgeBg} flex items-center justify-center shrink-0`}
          >
            {typeConfig.icon}
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase tracking-wider border ${typeConfig.badgeBg}`}
              >
                {typeConfig.label}
              </span>

              {entry.referenceTicket && (
                <span className="font-mono text-[9px] text-neutral-400 flex items-center gap-1">
                  <span className="text-neutral-600">REF:</span> {entry.referenceTicket}
                </span>
              )}

              {entry.oddsDecimal && (
                <span className="font-mono text-[9px] text-[#D4FF3F] bg-black/60 px-1.5 py-0.2 rounded border border-[#D4FF3F]/20">
                  @{entry.oddsDecimal.toFixed(2)}
                </span>
              )}
            </div>

            <h4 className="mt-1 font-display text-xs sm:text-sm font-bold text-white uppercase tracking-tight">
              {entry.description}
            </h4>

            {entry.eventTitle && (
              <p className="text-[11px] text-neutral-400 font-sans mt-0.5">
                {entry.eventTitle} {entry.selectionLabel ? `• [${entry.selectionLabel}]` : ''}
              </p>
            )}

            <div className="mt-1 flex items-center gap-3 font-mono text-[9px] text-neutral-400">
              <span>{formatDate(entry.timestamp)}</span>
              <span>•</span>
              <span
                className={`uppercase font-bold ${
                  entry.status === 'SETTLED' || entry.status === 'COMPLETED'
                    ? 'text-emerald-400'
                    : 'text-amber-400'
                }`}
              >
                {entry.status}
              </span>
            </div>
          </div>
        </div>

        {/* Lado Derecho: Importe Financiero */}
        <div className="sm:text-right font-mono flex sm:flex-col items-baseline sm:items-end justify-between border-t border-white/[0.04] sm:border-0 pt-2 sm:pt-0">
          <span className="sm:hidden text-[10px] text-neutral-400 uppercase">Monto:</span>
          <span className={`text-base sm:text-lg font-black tracking-tight ${typeConfig.amountColor}`}>
            {isPositive ? `+${formatMoney(entry.amount)}` : formatMoney(entry.amount)}
          </span>
          <span className="text-[9px] text-neutral-400 uppercase hidden sm:block">
            {entry.currency} NETO
          </span>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   6. COMPONENTE PRINCIPAL: UserDashboard
   ========================================================================== */

export interface UserDashboardProps {
  initialData?: unknown;
  /** Latencia simulada en ms de la carga inicial */
  simulatedInitialDelayMs?: number;
  /** Callback opcional al completar un depósito */
  onDepositSuccess?: (newAmount: number, newBalance: number) => void;
}

export default function UserDashboard({
  initialData = MOCK_INITIAL_DASHBOARD_DATA,
  simulatedInitialDelayMs = 1200,
  onDepositSuccess,
}: UserDashboardProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<UserDashboardData | null>(null);
  const [errorState, setErrorState] = useState<{ message: string; issues?: z.ZodIssue[] } | null>(
    null
  );

  // Estados interactivos para el Depósito Sandbox
  const [isDepositing, setIsDepositing] = useState<boolean>(false);
  const [depositAmount, setDepositAmount] = useState<number>(250);
  const [depositToast, setDepositToast] = useState<string | null>(null);

  // Filtros del Ledger
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const containerId = useId();

  // Validación y Carga Inicial con Zod
  const loadDashboard = () => {
    setLoading(true);
    setErrorState(null);

    const timer = setTimeout(() => {
      const parseResult = UserDashboardDataSchema.safeParse(initialData);

      if (!parseResult.success) {
        setErrorState({
          message: 'Los datos del usuario o la billetera no coinciden con las reglas del sistema.',
          issues: parseResult.error.issues,
        });
        setLoading(false);
        return;
      }

      setData(parseResult.data);
      setLoading(false);
    }, simulatedInitialDelayMs);

    return () => clearTimeout(timer);
  };

  useEffect(() => {
    return loadDashboard();
  }, [initialData, simulatedInitialDelayMs]);

  // Manejador del Botón "Depósito de Prueba (Sandbox)" (Simula llamada de 2 seg)
  const handleSandboxDeposit = () => {
    if (isDepositing || !data) return;

    setIsDepositing(true);

    setTimeout(() => {
      const addedAmount = depositAmount;
      const newTxId = `tx-dep-snbx-${Date.now().toString(36).toUpperCase()}`;
      const newTicket = `DEP-SNBX-${Math.floor(1000 + Math.random() * 9000)}`;

      const newLedgerEntry: LedgerEntry = {
        id: newTxId,
        type: 'DEPOSIT',
        amount: addedAmount,
        currency: 'USD',
        description: `Depósito Sandbox Instantáneo (+${formatMoney(addedAmount)})`,
        referenceTicket: newTicket,
        timestamp: new Date().toISOString(),
        status: 'COMPLETED',
      };

      // Actualización atómica del estado local
      setData((prev) => {
        if (!prev) return prev;
        const updatedAvailable = prev.wallet.available + addedAmount;
        const updatedDeposited = prev.wallet.totalDeposited + addedAmount;

        return {
          ...prev,
          wallet: {
            ...prev.wallet,
            available: updatedAvailable,
            totalDeposited: updatedDeposited,
          },
          ledger: [newLedgerEntry, ...prev.ledger],
        };
      });

      setIsDepositing(false);
      setDepositToast(`+$${addedAmount}.00 USD acreditados en billetera sandbox.`);

      if (onDepositSuccess) {
        onDepositSuccess(addedAmount, (data?.wallet.available ?? 0) + addedAmount);
      }

      // Desvanecer notificación toast tras 4 segundos
      setTimeout(() => {
        setDepositToast(null);
      }, 4000);
    }, 2000);
  };

  // Filtrado reactivo de transacciones
  const filteredLedger = useMemo(() => {
    if (!data) return [];
    return data.ledger.filter((entry) => {
      // Filtro por píldora de tipo
      const matchesType =
        filterType === 'ALL'
          ? true
          : filterType === 'DEPOSITS'
          ? entry.type === 'DEPOSIT'
          : filterType === 'BETS'
          ? entry.type === 'BET_PLACED'
          : filterType === 'WINS'
          ? entry.type === 'BET_WON'
          : true;

      // Filtro por término de búsqueda
      const matchesSearch =
        searchQuery.trim() === ''
          ? true
          : entry.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (entry.referenceTicket &&
              entry.referenceTicket.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (entry.eventTitle &&
              entry.eventTitle.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchesType && matchesSearch;
    });
  }, [data, filterType, searchQuery]);

  if (loading) {
    return (
      <div className="w-full max-w-4xl mx-auto my-6">
        <UserDashboardSkeleton />
      </div>
    );
  }

  if (errorState || !data) {
    return (
      <div className="w-full max-w-4xl mx-auto my-6">
        <UserDashboardError
          errorMessage={errorState?.message ?? 'Error indeterminado.'}
          zodIssues={errorState?.issues}
          onRetry={loadDashboard}
        />
      </div>
    );
  }

  const { user, wallet } = data;

  return (
    <div
      id={containerId}
      className="w-full max-w-4xl mx-auto my-6 space-y-6 font-sans text-white"
      aria-label="Panel de Usuario y Billetera ZenBet"
    >
      {/* Toast Flotante de Depósito Exitoso */}
      {depositToast && (
        <div
          role="status"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-[#050505] border-2 border-[#D4FF3F] text-white px-4 py-3 rounded shadow-[0_0_24px_rgba(212,255,63,0.35)] font-mono text-xs animate-bounce"
        >
          <Sparkles className="text-[#D4FF3F] shrink-0" size={18} />
          <div>
            <span className="font-black text-[#D4FF3F] uppercase block">DEPÓSITO EXITOSO</span>
            <span>{depositToast}</span>
          </div>
        </div>
      )}

      {/* ====================================================================
          1. HEADER DEL PERFIL: AVATAR, NIVEL Y KYC STATUS
          ==================================================================== */}
      <section className="relative overflow-hidden rounded-sm border border-white/[0.08] bg-[#050505] p-5 sm:p-7 shadow-[0_8px_32px_rgba(0,0,0,0.9)]">
        {/* Trama Grunge Halftone de Fondo */}
        <div
          className="absolute inset-0 bg-[radial-gradient(#D4FF3F_1px,transparent_1px)] [background-size:6px_6px] opacity-10 pointer-events-none"
          aria-hidden="true"
        />

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
          {/* Avatar e Identidad */}
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded bg-[#D4FF3F] p-0.5 border border-white/20 overflow-hidden shadow-[0_0_16px_rgba(212,255,63,0.25)] shrink-0">
              <img
                src={user.avatarUrl}
                alt={user.username}
                className="w-full h-full object-cover rounded filter grayscale contrast-[140%]"
              />
              <div className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-[#D4FF3F] border-2 border-black" />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-xl sm:text-2xl font-black uppercase text-white tracking-tight">
                  {user.username}
                </h1>
                <span className="px-2 py-0.5 rounded bg-[#D4FF3F] text-black font-mono text-[9px] font-black uppercase tracking-wider">
                  {user.tier}
                </span>
              </div>

              <p className="font-mono text-xs text-neutral-400 mt-0.5">{user.email}</p>

              <div className="mt-2 flex flex-wrap items-center gap-3 font-mono text-[10px] text-neutral-400">
                <span className="flex items-center gap-1 text-emerald-400 font-bold">
                  <ShieldCheck size={12} />
                  KYC {user.kycStatus}
                </span>
                <span>•</span>
                <span>MIEMBRO DESDE: {new Date(user.joinedDate).toLocaleDateString('es-ES')}</span>
              </div>
            </div>
          </div>

          {/* UID & Indicador de Red */}
          <div className="sm:text-right font-mono text-[10px] text-neutral-400 bg-black/50 p-2.5 rounded border border-white/[0.06] w-full sm:w-auto">
            <span className="text-neutral-400 block uppercase">IDENTIFICADOR DE CUENTA</span>
            <span className="font-bold text-white text-xs">{user.id}</span>
            <div className="mt-1 flex items-center gap-1.5 sm:justify-end text-[#D4FF3F]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#D4FF3F] animate-pulse" />
              <span>ZENBET MAINNET // PROTOCOL ACTIVE</span>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          2. HERO DE SALDO FINANCIERO Y ACCIÓN DE DEPÓSITO SANDBOX
          ==================================================================== */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Tarjeta de Saldo Disponible Principal */}
        <div className="lg:col-span-2 relative overflow-hidden rounded-sm border-2 border-[#D4FF3F]/80 bg-[#080808] p-5 sm:p-7 shadow-[0_0_32px_rgba(212,255,63,0.1)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-[#D4FF3F]">
                <Wallet size={14} />
                BILLETERA // SALDO DISPONIBLE PARA APUESTAS
              </span>
              <span className="font-mono text-[9px] text-neutral-400 uppercase">DIVISA: USD</span>
            </div>

            <div className="font-mono text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight flex items-baseline gap-2">
              <span className="text-[#D4FF3F]">$</span>
              <span>
                {wallet.available.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
              <span className="text-xs text-neutral-400 font-normal">USD</span>
            </div>
          </div>

          {/* Métricas Secundarias de Billetera */}
          <div className="mt-6 pt-4 border-t border-white/[0.08] grid grid-cols-3 gap-2 font-mono text-left">
            <div>
              <span className="text-[9px] text-neutral-400 uppercase block">RETENIDO EN JUEGO</span>
              <span className="text-sm font-bold text-cyan-400">
                {formatMoney(wallet.lockedInBets)}
              </span>
            </div>
            <div>
              <span className="text-[9px] text-neutral-400 uppercase block">TOTAL DEPOSITADO</span>
              <span className="text-sm font-bold text-neutral-200">
                {formatMoney(wallet.totalDeposited)}
              </span>
            </div>
            <div>
              <span className="text-[9px] text-neutral-400 uppercase block">BENEFICIO NETO (PnL)</span>
              <span
                className={`text-sm font-bold flex items-center gap-0.5 ${
                  wallet.netPnL >= 0 ? 'text-[#D4FF3F]' : 'text-rose-400'
                }`}
              >
                <TrendingUp size={12} />
                {wallet.netPnL >= 0 ? `+${formatMoney(wallet.netPnL)}` : formatMoney(wallet.netPnL)}
              </span>
            </div>
          </div>
        </div>

        {/* Panel Interactivo: Depósito de Prueba (Sandbox) */}
        <div className="relative overflow-hidden rounded-sm border border-white/[0.08] bg-[#050505] p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Zap size={14} className="text-[#D4FF3F]" />
              <h3 className="font-display text-sm font-black uppercase text-white tracking-wide">
                Depósito Sandbox
              </h3>
            </div>
            <p className="text-xs text-neutral-400 font-sans leading-relaxed">
              Inyecta crédito simulado para testear apuestas de alto valor en tiempo real.
            </p>

            {/* Selector de Monto Rápido */}
            <div className="mt-4 grid grid-cols-3 gap-2 font-mono text-xs">
              {[100, 250, 500].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setDepositAmount(amt)}
                  className={`py-1.5 px-2 rounded border font-bold transition ${
                    depositAmount === amt
                      ? 'bg-[#D4FF3F] text-black border-[#D4FF3F]'
                      : 'bg-[#0D0D0D] text-white border-white/[0.08] hover:border-white/20'
                  }`}
                >
                  +${amt}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <button
              type="button"
              disabled={isDepositing}
              onClick={handleSandboxDeposit}
              className={`w-full py-3 px-4 font-display font-black text-xs uppercase tracking-wider rounded transition flex items-center justify-center gap-2 active:translate-y-px ${
                isDepositing
                  ? 'bg-neutral-800 text-neutral-400 cursor-not-allowed border border-white/[0.08]'
                  : 'bg-[#D4FF3F] text-black hover:bg-[#b8e82a] shadow-[0_0_16px_rgba(212,255,63,0.3)]'
              }`}
            >
              {isDepositing ? (
                <>
                  <RefreshCw size={14} className="animate-spin text-[#D4FF3F]" />
                  <span>Procesando Red Sandbox (2s)...</span>
                </>
              ) : (
                <>
                  <ArrowDownLeft size={16} className="stroke-[2.5]" />
                  <span>Cargar +${depositAmount} USD al Saldo</span>
                </>
              )}
            </button>
            <span className="font-mono text-[9px] text-neutral-400 text-center block mt-2 uppercase">
              Simulación Instantánea • Cero Cargo a Tarjeta
            </span>
          </div>
        </div>
      </section>

      {/* ====================================================================
          3. HISTORIAL CONTABLE DE TRANSACCIONES (LEDGER)
          ==================================================================== */}
      <section className="rounded-sm border border-white/[0.08] bg-[#080808] p-5 sm:p-7 shadow-[0_12px_36px_rgba(0,0,0,0.95)]">
        {/* Barra de Filtros y Búsqueda */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-[#D4FF3F]" />
            <h2 className="font-display text-base font-black uppercase text-white tracking-wide">
              Historial de Transacciones (Ledger)
            </h2>
            <span className="font-mono text-[10px] text-neutral-400 bg-black/60 px-2 py-0.5 rounded border border-white/[0.08]">
              {filteredLedger.length} REGISTROS
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            {/* Buscador */}
            <div className="relative flex-1 md:w-48">
              <Search
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400"
              />
              <input
                type="text"
                placeholder="Buscar ticket o evento..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#050505] border border-white/[0.08] rounded pl-8 pr-3 py-1.5 text-xs font-mono text-white placeholder:text-neutral-400 focus:outline-none focus:border-[#D4FF3F]"
              />
            </div>

            {/* Píldoras de Filtro */}
            <div className="flex items-center gap-1 bg-[#050505] p-1 rounded border border-white/[0.08]">
              {[
                { id: 'ALL', label: 'Todas' },
                { id: 'DEPOSITS', label: 'Depósitos' },
                { id: 'BETS', label: 'Apuestas' },
                { id: 'WINS', label: 'Premios' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterType(tab.id)}
                  className={`px-2.5 py-1 text-[9px] font-mono font-bold uppercase rounded-xs transition ${
                    filterType === tab.id
                      ? 'bg-[#D4FF3F] text-black shadow-[0_0_8px_rgba(212,255,63,0.3)]'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Lista de Tarjetas del Ledger */}
        <div className="mt-5 space-y-3">
          {filteredLedger.length > 0 ? (
            filteredLedger.map((entry) => (
              <LedgerTransactionCard key={entry.id} entry={entry} />
            ))
          ) : (
            <div className="text-center py-12 border border-dashed border-white/[0.08] rounded bg-[#050505]">
              <Ticket size={28} className="mx-auto text-neutral-400 mb-2" />
              <p className="font-display text-sm font-bold uppercase text-white">
                No se encontraron transacciones
              </p>
              <p className="text-xs text-neutral-400 font-mono mt-1">
                Prueba ajustando el término de búsqueda o cambiando el filtro de estado.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Footer Legal & Seguridad */}
      <footer className="border-t border-white/[0.08] py-4 flex flex-wrap items-center justify-between text-neutral-400 font-mono text-[9px]">
        <span>REGISTRO CRIPTOGRÁFICO DE TRANSACCIONES // COMPLIANCE AUDITABLE</span>
        <span>TODAS LAS APUESTAS ESTÁN SUJETAS A LAS CONDICIONES DE MERCADO DE ZENBET</span>
      </footer>
    </div>
  );
}

