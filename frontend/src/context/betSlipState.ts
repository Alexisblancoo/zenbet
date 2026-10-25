import { createContext, useContext } from 'react';

import type {
  BetFailure,
  BetReceipt,
  EventLifecycle,
  LiveBetSelection,
  PlaceBetOutcome,
  SelectionInput,
} from '@/domain/bets';
import type { OddsQuote } from '@/domain/odds';
import type { OddsHubStatus } from '@/hooks/useOddsHub';

/**
 * Contrato público del boleto. Vive separado del provider para que el
 * fast-refresh de Vite no mezcle componentes y hooks en el mismo módulo.
 */
export interface BetSlipContextValue {
  /** Selecciones con la cuota viva del hub ya aplicada. */
  readonly selections: readonly LiveBetSelection[];
  readonly quotes: Readonly<Record<string, OddsQuote>>;
  readonly hubStatus: OddsHubStatus;
  readonly lastUpdateAt: number | null;
  readonly isPlacingBet: boolean;
  readonly error: BetFailure | null;
  readonly receipt: BetReceipt | null;
  /** Recibos confirmados en esta sesión, del más reciente al más antiguo. */
  readonly receipts: readonly BetReceipt[];

  /** Declara los mercados visibles para que el hub solo emita esos grupos. */
  setVisibleMarkets(markets: readonly string[]): void;
  /** Sincroniza el cierre/resultado del combate con los picks del boleto. */
  syncEventLifecycle(events: readonly EventLifecycle[]): void;
  addSelection(input: SelectionInput): void;
  removeSelection(selectionId: string): void;
  keepOnlySelection(selectionId: string): void;
  clearSelections(): void;
  /** Fija la cuota viva como cuota aceptada en todas las selecciones. */
  acceptLiveOdds(): void;
  clearError(): void;
  clearReceipt(): void;
  placeBet(stake: number, promoCode?: string): Promise<PlaceBetOutcome>;
}

export const BetSlipContext = createContext<BetSlipContextValue | null>(null);

export function useBetSlip(): BetSlipContextValue {
  const context = useContext(BetSlipContext);

  if (!context) {
    throw new Error('useBetSlip debe usarse dentro de <BetSlipProvider>.');
  }

  return context;
}
