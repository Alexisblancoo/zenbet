import React from 'react';
import ReactDOM from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient, IDEMPOTENCY_HEADER, ProblemDetailsException } from '@/api';
import type { AuthUser } from '@/domain/auth';
import { normalizeSelectionInput, type BetSelection } from '@/domain/bets';
import { AuthContext, type AuthContextValue } from '@/context/authState';
import { FightHubContext, type FightHubContextValue } from '@/context/fightHubState';
import { BetSlipProvider } from '@/context/BetSlipContext';
import { useBetSlip } from '@/context/betSlipState';
import type { BetSlipContextValue } from '@/context/betSlipState';
import { betIdempotencySignature } from '@/services/betService';

vi.mock('@/hooks/useOddsHub', () => ({
  useOddsHub: () => ({
    status: 'disconnected',
    isConnected: false,
    quotes: {},
    settledMarkets: new Set<string>(),
  }),
}));

const WALLET_A = '11111111-1111-4111-8111-111111111111';
const WALLET_B = '22222222-2222-4222-8222-222222222222';
const SELECTION_ID = '33333333-3333-4333-8333-333333333333';

function makeSelection(overrides: Partial<Parameters<typeof normalizeSelectionInput>[0]> = {}): BetSelection {
  const normalized = normalizeSelectionInput({
    selectionId: SELECTION_ID,
    selectionName: 'Alex Pereira',
    eventId: 'event-ufc-320',
    eventName: 'UFC 320 · Main Event',
    marketLabel: 'Ganador',
    odds: 2.101,
    eventStatus: 'scheduled',
    eventEndsAt: '2027-11-15T04:00:00Z',
    eventIsExpired: false,
    eventIsBettingOpen: true,
    ...overrides,
  });
  if (!normalized) throw new Error('Selection fixture inválida');
  return normalized;
}

function makeUser(walletId: string): AuthUser {
  return {
    id: 'user-1',
    username: 'cmendoza',
    email: 'bettor@zenbet.bo',
    roles: ['player'],
    walletId,
    walletBalance: 1000,
  };
}

interface MinimalDomNode {
  readonly nodeType: number;
  readonly nodeName: string;
  readonly tagName?: string;
  nodeValue?: string;
  readonly style?: Record<string, unknown>;
  addEventListener: (name: string, handler: unknown, options?: unknown) => void;
  removeEventListener: (name: string, handler: unknown, options?: unknown) => void;
  appendChild: (child: unknown) => void;
  removeChild: (child: unknown) => void;
  setAttribute?: (name: string, value: unknown) => void;
  removeAttribute?: (name: string, value: unknown) => void;
  ownerDocument?: MinimalDomDocument;
}

interface MinimalDomDocument extends MinimalDomNode {
  createElement: (tag: string) => MinimalDomNode;
  createTextNode: (text: string) => MinimalDomNode;
  defaultView?: Record<string, unknown>;
}

describe('betIdempotencySignature (firma pura alineada al hash del backend)', () => {
  it('propiedad: dos entradas con el mismo wire producen exactamente la misma firma', () => {
    const selectionA = makeSelection({ odds: 2.101 });
    const selectionB = makeSelection({ odds: 2.101 });

    // stake 50.123 y 50.124 redondean ambos a amount = 50.12; promoCode '' y undefined omiten promoCode en wire;
    // expectedOdds undefined usa selection.odds (2.101) en wire.
    const sig1 = betIdempotencySignature({
      walletId: WALLET_A,
      selection: selectionA,
      stake: 50.123,
      promoCode: undefined,
      expectedOdds: undefined,
    });
    const sig2 = betIdempotencySignature({
      walletId: WALLET_A,
      selection: selectionB,
      stake: 50.124,
      promoCode: '',
      expectedOdds: 2.101,
    });

    expect(sig1).toBe(sig2);
  });

  it('cambia la firma si cambia la cuota sin redondear (2.101 -> 2.104)', () => {
    const base = {
      walletId: WALLET_A,
      selection: makeSelection({ odds: 2.101 }),
      stake: 50,
    };
    const changed = {
      walletId: WALLET_A,
      selection: makeSelection({ odds: 2.104 }),
      stake: 50,
    };

    expect(betIdempotencySignature(changed)).not.toBe(betIdempotencySignature(base));
  });

  it('cambia la firma si cambia eventName o selectionName (description en el wire)', () => {
    const base = {
      walletId: WALLET_A,
      selection: makeSelection(),
      stake: 50,
    };
    const diffEvent = {
      walletId: WALLET_A,
      selection: makeSelection({ eventName: 'UFC 321 · Co-Main' }),
      stake: 50,
    };
    const diffSelection = {
      walletId: WALLET_A,
      selection: makeSelection({ selectionName: 'Magomed Ankalaev' }),
      stake: 50,
    };

    expect(betIdempotencySignature(diffEvent)).not.toBe(betIdempotencySignature(base));
    expect(betIdempotencySignature(diffSelection)).not.toBe(betIdempotencySignature(base));
  });

  it('cambia la firma si cambia walletId, promoCode, amount, maxSlippagePercent o minAcceptedOdds', () => {
    const base = {
      walletId: WALLET_A,
      selection: makeSelection(),
      stake: 50,
      promoCode: 'BONO10',
      maxSlippagePercent: 2,
      minAcceptedOdds: 2.05,
    };

    expect(betIdempotencySignature({ ...base, walletId: WALLET_B })).not.toBe(betIdempotencySignature(base));
    expect(betIdempotencySignature({ ...base, promoCode: 'BONO20' })).not.toBe(betIdempotencySignature(base));
    expect(betIdempotencySignature({ ...base, stake: 75 })).not.toBe(betIdempotencySignature(base));
    expect(betIdempotencySignature({ ...base, maxSlippagePercent: 5 })).not.toBe(betIdempotencySignature(base));
    expect(betIdempotencySignature({ ...base, minAcceptedOdds: 1.95 })).not.toBe(betIdempotencySignature(base));
  });
});

describe('Flujo real BetSlipProvider -> betService.placeBet (idempotencia en el boleto)', () => {
  let cleanupDOM: () => void;

  beforeEach(() => {
    const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
    const doc: MinimalDomDocument = {
      nodeType: 9,
      nodeName: '#document',
      addEventListener: () => {},
      removeEventListener: () => {},
      appendChild: () => {},
      removeChild: () => {},
      createElement: (tag: string): MinimalDomNode => ({
        nodeType: 1,
        nodeName: tag.toUpperCase(),
        tagName: tag.toUpperCase(),
        addEventListener: () => {},
        removeEventListener: () => {},
        appendChild: () => {},
        removeChild: () => {},
        style: {},
        setAttribute: () => {},
        removeAttribute: () => {},
      }),
      createTextNode: (text: string): MinimalDomNode => ({
        nodeType: 3,
        nodeName: '#text',
        nodeValue: text,
        addEventListener: () => {},
        removeEventListener: () => {},
        appendChild: () => {},
        removeChild: () => {},
      }),
    };
    class FakeIFrame {}
    class FakeElement {}
    const fakeWindow: Record<string, unknown> = {
      document: doc,
      HTMLIFrameElement: FakeIFrame,
      HTMLElement: FakeElement,
      Element: FakeElement,
      addEventListener: (type: string, fn: (...args: unknown[]) => void) => {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type)!.add(fn);
      },
      removeEventListener: (type: string, fn: (...args: unknown[]) => void) => {
        listeners.get(type)?.delete(fn);
      },
      dispatchEvent: () => true,
      setInterval: globalThis.setInterval.bind(globalThis),
      clearInterval: globalThis.clearInterval.bind(globalThis),
    };
    doc.defaultView = fakeWindow;

    const scope = globalThis as unknown as Record<string, unknown>;
    const prevDoc = scope.document;
    const prevWin = scope.window;
    const prevCustomEvent = scope.CustomEvent;
    scope.document = doc;
    scope.window = fakeWindow;
    scope.HTMLIFrameElement = FakeIFrame;
    scope.HTMLElement = FakeElement;
    scope.Element = FakeElement;
    scope.IS_REACT_ACT_ENVIRONMENT = true;
    if (!scope.CustomEvent) {
      scope.CustomEvent = class FakeCustomEvent {
        readonly type: string;
        readonly detail: unknown;
        constructor(type: string, init?: { detail?: unknown }) {
          this.type = type;
          this.detail = init?.detail;
        }
      };
    }

    cleanupDOM = () => {
      scope.document = prevDoc;
      scope.window = prevWin;
      scope.CustomEvent = prevCustomEvent;
      delete scope.HTMLIFrameElement;
      delete scope.HTMLElement;
      delete scope.Element;
      delete scope.IS_REACT_ACT_ENVIRONMENT;
    };
  });

  afterEach(() => {
    cleanupDOM();
    vi.restoreAllMocks();
  });

  async function mountBetSlip(initialWalletId = WALLET_A) {
    const scope = globalThis as unknown as Record<string, unknown>;
    const doc = scope.document as MinimalDomDocument;
    const container: MinimalDomNode = {
      nodeType: 1,
      nodeName: 'DIV',
      tagName: 'DIV',
      addEventListener: () => {},
      removeEventListener: () => {},
      ownerDocument: doc,
      appendChild: () => {},
      removeChild: () => {},
    };

    const slipHolder: { current?: BetSlipContextValue } = {};
    let currentUser = makeUser(initialWalletId);
    let setUserState: React.Dispatch<React.SetStateAction<AuthUser>> | null = null;

    function Consumer() {
      const slip = useBetSlip();
      React.useEffect(() => {
        slipHolder.current = slip;
      }, [slip]);
      return null;
    }

    const fightHubValue: FightHubContextValue = {
      status: 'disconnected',
      isConnected: false,
      updates: {},
      clocks: {},
      cardUpdates: {},
      lastUpdateAt: null,
      reconnectCount: 0,
      watchEvents: () => {},
      unwatchEvents: () => {},
      watchCards: () => {},
      unwatchCards: () => {},
    };

    function TestRoot() {
      const [user, setUser] = React.useState<AuthUser>(currentUser);
      React.useEffect(() => {
        setUserState = setUser;
      }, []);

      const authValue: AuthContextValue = {
        user,
        isAuthenticated: true,
        isLoading: false,
        login: async () => user,
        register: async () => user,
        logout: () => {},
      };

      return React.createElement(
        AuthContext.Provider,
        { value: authValue },
        React.createElement(
          FightHubContext.Provider,
          { value: fightHubValue },
          React.createElement(BetSlipProvider, null, React.createElement(Consumer)),
        ),
      );
    }

    const root = ReactDOM.createRoot(container as unknown as Element);
    await React.act(async () => {
      root.render(React.createElement(TestRoot));
    });

    return {
      getSlip: () => {
        if (!slipHolder.current) throw new Error('BetSlipContext no inicializado');
        return slipHolder.current;
      },
      setWalletId: async (nextWalletId: string) => {
        currentUser = makeUser(nextWalletId);
        await React.act(async () => {
          setUserState?.(currentUser);
        });
      },
      unmount: async () => {
        await React.act(async () => {
          root.unmount();
        });
      },
    };
  }

  it('reintento tras error reintentable (red, timeout, 503) reutiliza clave; error no reintentable la descarta', async () => {
    const postSpy = vi
      .spyOn(apiClient, 'post')
      .mockRejectedValueOnce(new ProblemDetailsException({ status: 0, title: 'Sin red', isNetworkError: true }))
      .mockRejectedValueOnce(new ProblemDetailsException({ status: 0, title: 'Timeout', isTimeout: true }))
      .mockRejectedValueOnce(new ProblemDetailsException({ status: 503, title: 'Ocupado', retryAfterSeconds: 2 }))
      .mockRejectedValueOnce(new ProblemDetailsException({ status: 422, title: 'Cuota cambiada', code: 'ODDS_CHANGED' }))
      .mockResolvedValueOnce({
        success: true,
        betId: '44444444-4444-4444-8444-444444444444',
        transactionId: '55555555-5555-4555-8555-555555555555',
        newBalance: 950,
        idempotentReplay: false,
      });

    const harness = await mountBetSlip();

    await React.act(async () => {
      harness.getSlip().addSelection(makeSelection());
    });

    // Intento 1: error de red (reintentable)
    await React.act(async () => {
      await harness.getSlip().placeBet(50);
    });
    // Intento 2: timeout (reintentable) -> misma clave
    await React.act(async () => {
      await harness.getSlip().placeBet(50);
    });
    // Intento 3: 503 (reintentable) -> misma clave
    await React.act(async () => {
      await harness.getSlip().placeBet(50);
    });
    // Intento 4: 422 no reintentable -> misma clave en este envío, pero descarta attemptRef al fallar
    await React.act(async () => {
      await harness.getSlip().placeBet(50);
    });
    // Intento 5: tras error no reintentable -> DEBE generar clave nueva
    await React.act(async () => {
      await harness.getSlip().placeBet(50);
    });

    expect(postSpy).toHaveBeenCalledTimes(5);
    const keys = postSpy.mock.calls.map(
      (call) => (call[2]?.headers as Record<string, string>)?.[IDEMPOTENCY_HEADER],
    );

    expect(keys[0]).toBeTruthy();
    expect(keys[1]).toBe(keys[0]);
    expect(keys[2]).toBe(keys[0]);
    expect(keys[3]).toBe(keys[0]);
    expect(keys[4]).toBeTruthy();
    expect(keys[4]).not.toBe(keys[0]);

    await harness.unmount();
  });

  it('cambia la clave si cambia cuota 2.101->2.104, eventName, selectionName, walletId, promo o stake', async () => {
    const postSpy = vi
      .spyOn(apiClient, 'post')
      .mockRejectedValue(new ProblemDetailsException({ status: 503, title: 'Ocupado', retryAfterSeconds: 1 }));

    const harness = await mountBetSlip(WALLET_A);

    const setSelAndPlace = async (
      selOverrides: Partial<Parameters<typeof normalizeSelectionInput>[0]>,
      stake: number,
      promoCode?: string,
    ) => {
      await React.act(async () => {
        harness.getSlip().clearSelections();
        harness.getSlip().addSelection(makeSelection(selOverrides));
      });
      await React.act(async () => {
        await harness.getSlip().placeBet(stake, promoCode);
      });
    };

    // 0: base (2.101)
    await setSelAndPlace({ odds: 2.101 }, 50, 'PROMO1');
    // 1: cuota 2.104 (mismo .toFixed(2) = '2.10', pero distinto wire!)
    await setSelAndPlace({ odds: 2.104 }, 50, 'PROMO1');
    // 2: cambia eventName (description distinta)
    await setSelAndPlace({ odds: 2.104, eventName: 'UFC 320 · Prelim' }, 50, 'PROMO1');
    // 3: cambia selectionName (description distinta)
    await setSelAndPlace({ odds: 2.104, eventName: 'UFC 320 · Prelim', selectionName: 'Khalil Rountree' }, 50, 'PROMO1');
    // 4: cambia promoCode
    await setSelAndPlace({ odds: 2.104, eventName: 'UFC 320 · Prelim', selectionName: 'Khalil Rountree' }, 50, 'PROMO2');
    // 5: cambia importe (stake)
    await setSelAndPlace({ odds: 2.104, eventName: 'UFC 320 · Prelim', selectionName: 'Khalil Rountree' }, 75, 'PROMO2');
    // 6: cambia walletId sin limpiar el boleto (attemptRef sigue activo!)
    await harness.setWalletId(WALLET_B);
    await React.act(async () => {
      await harness.getSlip().placeBet(75, 'PROMO2');
    });

    expect(postSpy).toHaveBeenCalledTimes(7);
    const keys = postSpy.mock.calls.map(
      (call) => (call[2]?.headers as Record<string, string>)?.[IDEMPOTENCY_HEADER],
    );

    for (let i = 1; i < keys.length; i++) {
      expect(keys[i]).toBeTruthy();
      expect(keys[i]).not.toBe(keys[i - 1]);
    }

    await harness.unmount();
  });
});
