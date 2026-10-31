import { QueryClient } from '@tanstack/react-query';

/**
 * Cliente central de TanStack Query (React Query v5) para ZenBet.
 *
 * Configurado con retenciones agresivas para apuestas en vivo, evitando reintentos
 * redundantes ante fallos deterministas de contrato Zod (`ZodContractViolationError`).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minuto de vigencia por defecto
      gcTime: 1000 * 60 * 15, // 15 minutos en memoria inactiva
      retry: (failureCount, error) => {
        // No reintentar si el contrato Zod fue violado (es un error de esquema del backend)
        if (error?.name === 'ZodContractViolationError') {
          return false;
        }
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0, // Las apuestas y transacciones financieras no deben reintentarse automáticamente a ciegas
    },
  },
});

