/**
 * Puerto de datos de la billetera.
 *
 * La UI depende de `WalletRepository`, no de un mock concreto. Hoy el backend
 * no expone consultas de billetera, así que el repositorio activo es
 * `demoWalletRepository`. Cuando existan los `GET`, se añade un
 * `httpWalletRepository` y se inyecta en `walletService` sin tocar la página.
 */

import type { WalletSnapshot } from '@/domain/wallet';

import { createDemoWalletSnapshot } from './walletDemoData';

export interface WalletRepository {
  loadSnapshot(signal?: AbortSignal): Promise<WalletSnapshot>;
}

const DEMO_LATENCY_MS = 360;

function abortError(): DOMException {
  return new DOMException('La carga de la billetera fue cancelada.', 'AbortError');
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }

    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(abortError());
      },
      { once: true },
    );
  });
}

export const demoWalletRepository: WalletRepository = {
  async loadSnapshot(signal) {
    await wait(DEMO_LATENCY_MS, signal);
    return createDemoWalletSnapshot();
  },
};

export interface WalletService {
  loadSnapshot(signal?: AbortSignal): Promise<WalletSnapshot>;
}

export function createWalletService(
  repository: WalletRepository = demoWalletRepository,
): WalletService {
  return {
    loadSnapshot(signal) {
      return repository.loadSnapshot(signal);
    },
  };
}

export const walletService = createWalletService();
