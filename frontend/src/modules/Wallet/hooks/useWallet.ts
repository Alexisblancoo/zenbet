import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import axios from 'axios';
import { z } from 'zod';
import { http } from '@/api/client';
import { isProblemDetailsException, normalizeApiError } from '@/api/errors';
import { createIdempotencyKey } from '@/api/idempotency';
import {
  UserDashboardDataSchema,
  type UserDashboardData,
} from '@/modules/Wallet/components/UserDashboard';

/* ==========================================================================
   1. ERRORES DE CONTRATO ZOD (Para consumo por ErrorBoundary de React)
   ========================================================================== */

export class ZodContractViolationError extends Error {
  public readonly issues: z.ZodIssue[];
  public readonly rawPayload: unknown;

  constructor(message: string, issues: z.ZodIssue[], rawPayload: unknown) {
    super(message);
    this.name = 'ZodContractViolationError';
    this.issues = issues;
    this.rawPayload = rawPayload;
    Object.setPrototypeOf(this, ZodContractViolationError.prototype);
  }
}

export class PlaceBetError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status = 0,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'PlaceBetError';
    Object.setPrototypeOf(this, PlaceBetError.prototype);
  }
}

export class OddsChangedError extends Error {
  public readonly code = 'ODDS_CHANGED' as const;
  public readonly currentOdds: number;
  public readonly expectedOdds?: number;

  constructor(message: string, currentOdds: number, expectedOdds?: number) {
    super(message);
    this.name = 'OddsChangedError';
    this.currentOdds = currentOdds;
    this.expectedOdds = expectedOdds;
    Object.setPrototypeOf(this, OddsChangedError.prototype);
  }
}

export interface SlippagePromptState {
  readonly isOpen: boolean;
  readonly currentOdds: number;
  readonly expectedOdds?: number;
  readonly lastInput?: PlaceBetInput;
}

/* ==========================================================================
   2. ESQUEMAS ZOD PARA DISPARO DE APUESTAS Y RESPUESTA
   ========================================================================== */

export const PlaceBetInputSchema = z.object({
  walletId: z.string().optional(),
  selectionId: z.string().min(1, 'El ID de la selección es requerido'),
  marketId: z.string().optional(),
  eventId: z.string().optional(),
  stake: z.number().positive('El monto apostado (stake) debe ser mayor a 0'),
  oddsDecimal: z.number().gt(1, 'La cuota decimal debe ser superior a 1.0').optional(),
  expectedOdds: z.number().gt(1, 'La cuota esperada debe ser superior a 1.0').optional(),
  maxSlippagePercent: z.number().min(0).max(100, 'El porcentaje máximo de deslizamiento debe estar entre 0 y 100').optional(),
  minAcceptedOdds: z.number().gt(1, 'La cuota mínima aceptada debe ser superior a 1.0').optional(),
  description: z.string().optional(),
  promoCode: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

export type PlaceBetInput = z.infer<typeof PlaceBetInputSchema>;

export const PlaceBetAcceptedResponseSchema = z.object({
  success: z.boolean().default(true),
  status: z.enum(['CREATED', 'ACCEPTED_PROCESSING']).default('CREATED'),
  betId: z.string().min(1, 'El ID de apuesta es obligatorio'),
  transactionId: z.string().nullable().optional(),
  newBalance: z.number().nullable().optional(),
  idempotentReplay: z.boolean().default(false),
  selectionId: z.string().min(1),
  stake: z.number().positive(),
  potentialPayout: z.number().positive().optional(),
  receivedAt: z.string(),
  message: z.string().default('Apuesta registrada correctamente.'),
  newBalancePreview: z.number().optional(),
});

export type PlaceBetAcceptedResponse = z.infer<typeof PlaceBetAcceptedResponseSchema>;

const pendingIdempotencyKeys = new Map<string, string>();
const betSig = (i: PlaceBetInput) => `${i.walletId ?? ''}:${i.selectionId}:${i.stake}`;
function resolveBetIdempotencyKey(input: PlaceBetInput): string {
  const sig = betSig(input);
  const key = input.idempotencyKey?.trim() || pendingIdempotencyKeys.get(sig) || createIdempotencyKey();
  pendingIdempotencyKeys.set(sig, key);
  return key;
}

/* ==========================================================================
   3. DATA FETCHING: useGetUserProfile (Lectura del Saldo y Perfil)
   ========================================================================== */

/**
 * Consulta el perfil de usuario, saldo de billetera e historial (Ledger) con Axios,
 * aplicando safeParse estricto de Zod antes de entregar la data a TanStack Query.
 */
export async function fetchUserProfile(): Promise<UserDashboardData> {
  const response = await http.get('/wallet');
  const rawData: unknown = response.data;

  // REGLA DE ORO: safeParse estricto antes de entregar al frontend
  const parseResult = UserDashboardDataSchema.safeParse(rawData);

  if (!parseResult.success) {
    const errorDetails = parseResult.error.issues
      .map((issue) => `[${issue.path.join('.') || 'root'}]: ${issue.message}`)
      .join(' | ');

    throw new ZodContractViolationError(
      `[Zod Contract Failure] Los datos de perfil/billetera violan el contrato financiero: ${errorDetails}`,
      parseResult.error.issues,
      rawData
    );
  }

  return parseResult.data;
}

export interface UseGetUserProfileOptions {
  enabled?: boolean;
  refetchInterval?: number | false;
  staleTime?: number;
}

/**
 * Hook `useGetUserProfile`: Obtiene el perfil de usuario y estado de la billetera (incluyendo saldo disponible).
 * Valida la respuesta contra `UserDashboardDataSchema`.
 */
export function useGetUserProfile(
  options?: UseGetUserProfileOptions
): UseQueryResult<UserDashboardData, Error> {
  return useQuery<UserDashboardData, Error>({
    queryKey: ['wallet', 'profile'],
    queryFn: fetchUserProfile,
    staleTime: options?.staleTime ?? 1000 * 30, // 30 segundos de frescura
    refetchInterval: options?.refetchInterval ?? false,
    enabled: options?.enabled ?? true,
    retry: (failureCount, error) => {
      if (error instanceof ZodContractViolationError) {
        return false;
      }
      return failureCount < 2;
    },
  });
}

/**
 * Hook de conveniencia `useGetWalletBalance`: Acceso directo al saldo disponible
 * con estados de carga heredados del perfil.
 */
export function useGetWalletBalance(options?: UseGetUserProfileOptions) {
  const profileQuery = useGetUserProfile(options);

  return {
    ...profileQuery,
    balance: profileQuery.data?.wallet.available ?? 0,
    wallet: profileQuery.data?.wallet,
    user: profileQuery.data?.user,
  };
}

/* ==========================================================================
   4. DATA MUTATION: usePlaceBet (Disparo de Apuesta con 202 Accepted)
   ========================================================================== */

/**
 * Ejecuta el POST a la API o simula la respuesta 202 Accepted con validación Zod estricta.
 */
export async function placeBetRequest(input: PlaceBetInput): Promise<PlaceBetAcceptedResponse> {
  // Validación estricta del input de la apuesta
  const inputValidation = PlaceBetInputSchema.safeParse(input);
  if (!inputValidation.success) {
    const errorDetails = inputValidation.error.issues
      .map((issue) => `[${issue.path.join('.') || 'root'}]: ${issue.message}`)
      .join(' | ');
    throw new ZodContractViolationError(
      `[Zod Validation Failure] Entrada de apuesta inválida: ${errorDetails}`,
      inputValidation.error.issues,
      input
    );
  }

  const validatedInput = inputValidation.data;
  const idempotencyKey = resolveBetIdempotencyKey(validatedInput);
  let rawResponse: unknown;

  try {
    const expectedOdds = validatedInput.expectedOdds ?? validatedInput.oddsDecimal;
    const response = await http.post(
      '/bets/place',
      {
        walletId: validatedInput.walletId,
        selectionId: validatedInput.selectionId,
        amount: validatedInput.stake,
        description: validatedInput.description ?? `Apuesta a selección ${validatedInput.selectionId}`,
        promoCode: validatedInput.promoCode,
        expectedOdds,
        maxSlippagePercent: validatedInput.maxSlippagePercent,
        minAcceptedOdds: validatedInput.minAcceptedOdds,
      },
      {
        headers: { 'X-Idempotency-Key': idempotencyKey },
      }
    );

    if (response.status === 201 || response.status === 200 || response.status === 202) {
      const backendData = (response.data || {}) as Record<string, unknown>;
      const rawBetId = typeof backendData.betId === 'string' ? backendData.betId.trim() : '';
      if (!rawBetId) {
        throw new ZodContractViolationError(
          '[Zod Contract Failure] La respuesta 2xx no incluye betId del backend.',
          [{ code: 'custom', message: 'betId requerido', path: ['betId'] }],
          backendData
        );
      }
      rawResponse = {
        success: backendData.success === true,
        status: 'CREATED',
        betId: rawBetId,
        transactionId: typeof backendData.transactionId === 'string' ? backendData.transactionId : null,
        newBalance: typeof backendData.newBalance === 'number' ? backendData.newBalance : null,
        idempotentReplay: backendData.idempotentReplay === true,
        selectionId: validatedInput.selectionId,
        stake: validatedInput.stake,
        potentialPayout: validatedInput.oddsDecimal
          ? Math.round(validatedInput.stake * validatedInput.oddsDecimal * 100) / 100
          : undefined,
        receivedAt: new Date().toISOString(),
        message: 'Apuesta registrada correctamente.',
        newBalancePreview: typeof backendData.newBalance === 'number' ? backendData.newBalance : undefined,
      };
    } else {
      rawResponse = response.data;
    }
  } catch (error) {
    if (error instanceof ZodContractViolationError) {
      throw error;
    }

    const problem = normalizeApiError(error);
    const data = (axios.isAxiosError(error) ? error.response?.data : undefined) as Record<string, unknown> | undefined;
    const ext = (data?.extensions ?? problem.extensions) as Record<string, unknown> | undefined;
    const code = String(data?.code ?? ext?.code ?? (isProblemDetailsException(error) ? error.code : problem.code) ?? '');
    const status = (axios.isAxiosError(error) ? error.response?.status : undefined) ?? problem.status ?? 0;

    if (code === 'REFERENCE_LINE_NOT_BETTABLE') {
      throw new PlaceBetError('Cuotas próximamente', 'REFERENCE_LINE_NOT_BETTABLE', status || 422);
    }

    if (
      code === 'ODDS_CHANGED' ||
      code === 'SLIPPAGE_EXCEEDED' ||
      (typeof data?.type === 'string' && data.type.includes('odds-changed')) ||
      problem.type.includes('odds-changed')
    ) {
      const currentOdds = Number(data?.currentOdds ?? ext?.currentOdds) || 0;
      const expectedOdds = Number(data?.expectedOdds ?? ext?.expectedOdds) || validatedInput.oddsDecimal;
      const detail =
        typeof data?.detail === 'string'
          ? data.detail
          : problem.detail ?? 'La cuota cambió durante el procesamiento excediendo la tolerancia permitida.';
      throw new OddsChangedError(detail, currentOdds, expectedOdds);
    }

    if (status === 503 || code === 'SERVICE_BUSY') {
      const hdr = axios.isAxiosError(error) ? (error.response?.headers as Record<string, unknown> | undefined) : undefined;
      const retrySeconds = Math.max(1, Math.ceil(Number(hdr?.['retry-after'] ?? hdr?.['Retry-After'] ?? problem.retryAfterSeconds) || 1));
      throw new PlaceBetError(`Mucha demanda, reintenta en ${retrySeconds} s`, 'SERVICE_BUSY', 503, retrySeconds);
    }

    if (status === 404 || status === 0 || problem.isNetworkError || problem.isTimeout || (axios.isAxiosError(error) && !error.response)) {
      throw new PlaceBetError('No pudimos registrar tu apuesta. No se descontó saldo.', status === 404 ? 'ENDPOINT_NOT_FOUND' : 'NETWORK_ERROR', status);
    }

    throw new PlaceBetError(problem.detail || 'No pudimos registrar tu apuesta. No se descontó saldo.', code || 'PLACE_BET_FAILED', status);
  }

  // REGLA DE ORO: safeParse estricto de la respuesta antes de devolver al frontend
  const parseResult = PlaceBetAcceptedResponseSchema.safeParse(rawResponse);

  if (!parseResult.success) {
    const errorDetails = parseResult.error.issues
      .map((issue) => `[${issue.path.join('.') || 'root'}]: ${issue.message}`)
      .join(' | ');

    throw new ZodContractViolationError(
      `[Zod Contract Failure] La respuesta de aceptación de apuesta (202) no cumple el contrato: ${errorDetails}`,
      parseResult.error.issues,
      rawResponse
    );
  }

  pendingIdempotencyKeys.delete(betSig(validatedInput));
  return parseResult.data;
}

/** Contexto de mutación para Rollback Optimista */
interface PlaceBetMutationContext {
  previousProfile: UserDashboardData | undefined;
}

/**
 * Hook `usePlaceBet`: Dispara la mutación para colocar una apuesta simulando HTTP 202 Accepted.
 * Aplica actualización optimista inmediata en el caché de TanStack Query deduciendo el saldo disponible,
 * se revierte automáticamente ante fallo o cuota desactualizada (Slippage) y expone control
 * interactivo para que el usuario acepte la nueva cuota o cancele.
 */
export function usePlaceBet() {
  const queryClient = useQueryClient();
  const [slippagePrompt, setSlippagePrompt] = useState<SlippagePromptState | null>(null);

  const mutation = useMutation<PlaceBetAcceptedResponse, Error, PlaceBetInput, PlaceBetMutationContext>({
    mutationFn: placeBetRequest,
    onMutate: async (newBet) => {
      // 1. Cancelar cualquier consulta en curso del perfil para evitar colisiones
      await queryClient.cancelQueries({ queryKey: ['wallet', 'profile'] });

      // 2. Snapshot de los datos actuales para poder hacer rollback si falla
      const previousProfile = queryClient.getQueryData<UserDashboardData>(['wallet', 'profile']);

      // 3. Actualización Optimista: deducir saldo disponible y registrar en el ledger en estado PENDING
      if (previousProfile) {
        const updatedProfile: UserDashboardData = {
          ...previousProfile,
          wallet: {
            ...previousProfile.wallet,
            available: Math.max(0, previousProfile.wallet.available - newBet.stake),
            lockedInBets: previousProfile.wallet.lockedInBets + newBet.stake,
          },
          ledger: [
            {
              id: `tx-optimistic-${Date.now()}`,
              type: 'BET_PLACED',
              amount: -newBet.stake,
              currency: 'USD',
              description: newBet.description ?? `Apuesta en juego: Selección ${newBet.selectionId}`,
              selectionLabel: newBet.selectionId,
              oddsDecimal: newBet.oddsDecimal,
              timestamp: new Date().toISOString(),
              status: 'PENDING',
            },
            ...previousProfile.ledger,
          ],
        };

        queryClient.setQueryData<UserDashboardData>(['wallet', 'profile'], updatedProfile);
      }

      return { previousProfile };
    },
    onError: (err, newBet, context) => {
      // 4. Si la llamada falla, revertimos el saldo al snapshot previo
      if (context?.previousProfile) {
        queryClient.setQueryData<UserDashboardData>(['wallet', 'profile'], context.previousProfile);
      }

      // 5. Si la API aborta por deslizamiento de cuota, activamos el diálogo interactivo
      if (err instanceof OddsChangedError) {
        setSlippagePrompt({
          isOpen: true,
          currentOdds: err.currentOdds,
          expectedOdds: err.expectedOdds,
          lastInput: { ...newBet, idempotencyKey: resolveBetIdempotencyKey(newBet) },
        });
      }
    },
    onSettled: () => {
      // 6. Invalida la consulta del perfil para resincronizar con el saldo oficial del backend
      queryClient.invalidateQueries({ queryKey: ['wallet', 'profile'] });
    },
  });

  const acceptNewOdds = useCallback(() => {
    if (!slippagePrompt?.lastInput) return;
    const input = slippagePrompt.lastInput;
    const updatedOdds = slippagePrompt.currentOdds;
    setSlippagePrompt(null);

    // Reintenta con la nueva cuota y nuevo ticket de transacción
    mutation.mutate({
      ...input,
      oddsDecimal: updatedOdds,
      expectedOdds: updatedOdds,
      minAcceptedOdds: undefined,
      idempotencyKey: input.idempotencyKey ?? resolveBetIdempotencyKey(input),
    });
  }, [slippagePrompt, mutation]);

  const dismissSlippage = useCallback(() => {
    setSlippagePrompt(null);
  }, []);

  return {
    ...mutation,
    placeBet: mutation.mutate,
    placeBetAsync: mutation.mutateAsync,
    slippagePrompt,
    acceptNewOdds,
    dismissSlippage,
  };
}

