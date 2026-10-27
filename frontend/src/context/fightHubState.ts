import { createContext, useContext } from 'react';

import type { UfcCardUpdate, UfcFightClock, UfcFightUpdate } from '@/domain/ufc';
import type { FightHubStatus } from '@/hooks/useFightHub';

/**
 * Contrato del canal compartido de combates. El provider es el único dueño de
 * la conexión `/fight-hub`; las páginas y el boleto registran los grupos que
 * necesitan en lugar de abrir conexiones propias.
 */
export interface FightHubContextValue {
  readonly status: FightHubStatus;
  readonly isConnected: boolean;
  readonly updates: Readonly<Record<string, UfcFightUpdate>>;
  readonly clocks: Readonly<Record<string, UfcFightClock>>;
  readonly cardUpdates: Readonly<Record<string, UfcCardUpdate>>;
  readonly lastUpdateAt: number | null;
  readonly reconnectCount: number;

  /** Registra (o reemplaza) los combates que observa un consumidor. */
  watchEvents(ownerId: string, eventIds: readonly string[]): void;
  unwatchEvents(ownerId: string): void;
  /** Registra (o reemplaza) las carteleras que observa un consumidor. */
  watchCards(ownerId: string, cardKeys: readonly string[]): void;
  unwatchCards(ownerId: string): void;
}

export const FightHubContext = createContext<FightHubContextValue | null>(null);

export function useFightHubState(): FightHubContextValue {
  const context = useContext(FightHubContext);

  if (!context) {
    throw new Error('useFightHubState debe usarse dentro de <FightHubProvider>.');
  }

  return context;
}
