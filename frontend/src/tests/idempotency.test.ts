import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import { createUuidV4 } from '@/api/idempotency';
import { http } from '@/api/client';
import { placeBetRequest } from '@/modules/Wallet/hooks/useWallet';

function makeAxiosError(status: number, data: unknown = {}, headers: Record<string, string> = {}) {
  return new AxiosError('HTTP Error', 'ERR_BAD_RESPONSE', undefined, undefined, {
    data,
    status,
    statusText: String(status),
    headers,
    config: { headers: new AxiosHeaders() },
  });
}

describe('Idempotencia — Generación de UUID v4', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('dos llamadas seguidas devuelven claves distintas en el fallback sin crypto moderno', () => {
    // Simulamos entorno sin crypto.randomUUID ni crypto.getRandomValues
    vi.stubGlobal('crypto', undefined);
    // Congelamos el tiempo al mismo milisegundo para verificar que no depende solo de Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000);

    const key1 = createUuidV4();
    const key2 = createUuidV4();

    expect(key1).not.toBe(key2);
  });
});

describe('H1A: Firma betSig e Idempotencia en Apuestas', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('misma billetera, selección e importe con otras cuotas -> clave distinta; mismo envío exacto reintentado -> misma clave', async () => {
    const postSpy = vi.spyOn(http, 'post').mockImplementation(async () => {
      // Simula fallo 503 para que la apuesta quede en estado pendiente/reintentable
      throw makeAxiosError(503, { status: 503, extensions: { code: 'SERVICE_BUSY' } }, { 'retry-after': '2' });
    });

    const baseBet = {
      walletId: '11111111-2222-3333-4444-555555555555',
      selectionId: 'sel-ufc-1234',
      stake: 50,
      oddsDecimal: 2.10,
      expectedOdds: 2.10,
    };

    // Intento 1: baseBet
    await expect(placeBetRequest(baseBet)).rejects.toThrow();
    const keyAttempt1 = (postSpy.mock.calls[0]?.[2]?.headers as Record<string, string>)?.['X-Idempotency-Key'];
    expect(keyAttempt1).toBeTruthy();

    // Mismo envío exacto reintentado: DEBE reutilizar la misma clave
    await expect(placeBetRequest(baseBet)).rejects.toThrow();
    const keyRetry = (postSpy.mock.calls[1]?.[2]?.headers as Record<string, string>)?.['X-Idempotency-Key'];
    expect(keyRetry).toBe(keyAttempt1);

    // Misma billetera, selección e importe pero con cuota distinta: DEBE generar clave distinta
    const betWithDifferentOdds = {
      ...baseBet,
      oddsDecimal: 2.45,
      expectedOdds: 2.45,
    };
    await expect(placeBetRequest(betWithDifferentOdds)).rejects.toThrow();
    const keyDifferentOdds = (postSpy.mock.calls[2]?.[2]?.headers as Record<string, string>)?.['X-Idempotency-Key'];
    expect(keyDifferentOdds).toBeTruthy();
    expect(keyDifferentOdds).not.toBe(keyAttempt1);
  });
});

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
  removeAttribute?: (name: string) => void;
  ownerDocument?: MinimalDomDocument;
}

interface MinimalDomDocument extends MinimalDomNode {
  createElement: (tag: string) => MinimalDomNode;
  createTextNode: (text: string) => MinimalDomNode;
  defaultView?: {
    document: MinimalDomDocument;
    HTMLIFrameElement: new () => object;
    HTMLElement: new () => object;
    Element: new () => object;
  };
}

describe('H1B: Aceptación de Nuevas Cuotas y Clave de Idempotencia', () => {
  let cleanupDOM: () => void;

  beforeEach(() => {
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
    doc.defaultView = {
      document: doc,
      HTMLIFrameElement: FakeIFrame,
      HTMLElement: FakeElement,
      Element: FakeElement,
    };
    const prevScope = globalThis as unknown as Record<string, unknown>;
    const prevDoc = prevScope.document;
    const prevWin = prevScope.window;
    prevScope.document = doc;
    prevScope.window = doc.defaultView;
    prevScope.HTMLIFrameElement = FakeIFrame;
    prevScope.HTMLElement = FakeElement;
    prevScope.Element = FakeElement;
    prevScope.IS_REACT_ACT_ENVIRONMENT = true;

    cleanupDOM = () => {
      prevScope.document = prevDoc;
      prevScope.window = prevWin;
      delete prevScope.HTMLIFrameElement;
      delete prevScope.HTMLElement;
      delete prevScope.Element;
      delete prevScope.IS_REACT_ACT_ENVIRONMENT;
    };
  });

  afterEach(() => {
    cleanupDOM();
    vi.restoreAllMocks();
  });

  it('tras aceptar nuevas cuotas, la X-Idempotency-Key enviada difiere de la del intento rechazado', async () => {
    const React = await import('react');
    const ReactDOM = await import('react-dom/client');
    const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
    const { usePlaceBet } = await import('@/modules/Wallet/hooks/useWallet');

    const postSpy = vi.spyOn(http, 'post')
      // Primer intento rechazado por ODDS_CHANGED (cuota sube de 2.10 a 2.45)
      .mockRejectedValueOnce(
        makeAxiosError(422, {
          code: 'ODDS_CHANGED',
          currentOdds: 2.45,
          expectedOdds: 2.10,
          detail: 'La cuota cambió durante el procesamiento.',
        })
      )
      // Segundo intento (tras aceptar nueva cuota) aceptado 201
      .mockResolvedValueOnce({
        status: 201,
        data: {
          success: true,
          betId: 'bet-new-odds-success',
          transactionId: 'tx-new-odds',
          newBalance: 450,
          idempotentReplay: false,
        },
      });

    const hookHolder: { current?: ReturnType<typeof usePlaceBet> } = {};
    function Harness() {
      const hook = usePlaceBet();
      React.useEffect(() => {
        hookHolder.current = hook;
      }, [hook]);
      return null;
    }

    const scope = globalThis as unknown as Record<string, unknown>;
    const currentDoc = scope.document as MinimalDomDocument;
    const container: MinimalDomNode = {
      nodeType: 1,
      nodeName: 'DIV',
      tagName: 'DIV',
      addEventListener: () => {},
      removeEventListener: () => {},
      ownerDocument: currentDoc,
      appendChild: () => {},
      removeChild: () => {},
    };

    const root = ReactDOM.createRoot(container as unknown as Element);
    const queryClient = new QueryClient({
      defaultOptions: {
        mutations: { retry: false },
        queries: { retry: false },
      },
    });

    await React.act(async () => {
      root.render(
        React.createElement(
          QueryClientProvider,
          { client: queryClient },
          React.createElement(Harness)
        )
      );
    });

    expect(hookHolder.current).toBeDefined();
    if (!hookHolder.current) throw new Error('hookHolder no inicializado');
    const hook = hookHolder.current;

    // 1. Disparar apuesta inicial con cuota 2.10
    await React.act(async () => {
      hook.placeBet({
        walletId: '11111111-2222-3333-4444-555555555555',
        selectionId: 'sel-ufc-1234',
        stake: 50,
        oddsDecimal: 2.10,
        expectedOdds: 2.10,
      });
    });

    // Comprobamos que el intento 1 falló y activó slippagePrompt
    expect(postSpy).toHaveBeenCalledTimes(1);
    const keyAttempt1 = (postSpy.mock.calls[0]?.[2]?.headers as Record<string, string>)?.['X-Idempotency-Key'];
    expect(keyAttempt1).toBeTruthy();
    expect(hookHolder.current.slippagePrompt).not.toBeNull();
    expect(hookHolder.current.slippagePrompt?.currentOdds).toBe(2.45);

    // 2. Aceptar nuevas cuotas
    await React.act(async () => {
      hookHolder.current?.acceptNewOdds();
    });

    expect(postSpy).toHaveBeenCalledTimes(2);
    const keyAttempt2 = (postSpy.mock.calls[1]?.[2]?.headers as Record<string, string>)?.['X-Idempotency-Key'];
    expect(keyAttempt2).toBeTruthy();

    // Verificación central H1B: la clave enviada tras aceptar nuevas cuotas DEBE diferir de la rechazada
    expect(keyAttempt2).not.toBe(keyAttempt1);
  });
});

describe('H1C: Contrato de Red de Apuestas (Sin idempotencyKey en Body)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('betService.placeBet envía X-Idempotency-Key en cabeceras y NO en el body', async () => {
    const { betService, BET_ENDPOINTS } = await import('@/services/betService');
    const { apiClient, IDEMPOTENCY_HEADER } = await import('@/api');
    const { normalizeSelectionInput } = await import('@/domain/bets');

    let capturedUrl = '';
    let capturedBody: Record<string, unknown> | undefined;
    let capturedHeaders: Record<string, string> | undefined;

    vi.spyOn(apiClient, 'post').mockImplementation(async (url, body, config) => {
      capturedUrl = url;
      capturedBody = body as Record<string, unknown>;
      capturedHeaders = config?.headers as Record<string, string>;
      return {
        success: true,
        betId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
        transactionId: 'f1e2d3c4-b5a6-4987-8765-43210fedcba9',
        newBalance: 800,
        idempotentReplay: false,
      };
    });

    const selection = normalizeSelectionInput({
      selectionId: '22222222-3333-4444-5555-666666666666',
      selectionName: 'Ciryl Gane',
      eventId: 'event-ufc-334',
      eventName: 'UFC 334',
      marketLabel: 'Ganador',
      odds: 2.25,
      eventStatus: 'scheduled',
      eventEndsAt: '2026-11-15T04:00:00Z',
      eventIsExpired: false,
      eventIsBettingOpen: true,
    });
    expect(selection).not.toBeNull();

    const command = {
      walletId: '11111111-2222-3333-4444-555555555555',
      selection: selection!,
      stake: 100,
      idempotencyKey: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
    };

    const result = await betService.placeBet(command);

    expect(result.betId).toBe('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d');
    expect(capturedUrl).toBe(BET_ENDPOINTS.place);
    // Cabecera X-Idempotency-Key presente y correcta
    expect(capturedHeaders?.[IDEMPOTENCY_HEADER]).toBe('9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d');
    // Body NO debe incluir idempotencyKey (limpieza de contrato con el backend BetsEndpoints.cs:387)
    expect(capturedBody).toBeDefined();
    expect('idempotencyKey' in (capturedBody ?? {})).toBe(false);
  });
});
