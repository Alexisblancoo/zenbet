import { useEffect, useState } from 'react';

import { SALDO_FLASH_EVENT } from '@/context/authState';

const FLASH_RESET_MS = 2_200;
const FLASH_CLASS = 'zb-saldo-flash';
const FLASH_TARGET_SELECTOR = '[data-saldo-flash-target]';

let domFlashTimer: number | undefined;

/**
 * Dispara `.zb-saldo-flash` de forma imperativa y síncrona sobre todos los
 * nodos marcados con `[data-saldo-flash-target]` en 0ms, forzando el reinicio
 * de la animación en el compositor sin esperar ni provocar re-renders pesados
 * en el árbol de React.
 */
export function triggerSaldoFlashElements(): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  const targets = document.querySelectorAll<HTMLElement>(FLASH_TARGET_SELECTOR);
  targets.forEach((element) => {
    element.classList.remove(FLASH_CLASS);
    // Fuerza reflow mínimo solo en el nodo del número para reiniciar keyframes
    void element.offsetWidth;
    element.classList.add(FLASH_CLASS);
  });

  if (domFlashTimer !== undefined) {
    window.clearTimeout(domFlashTimer);
  }

  domFlashTimer = window.setTimeout(() => {
    const activeTargets = document.querySelectorAll<HTMLElement>(FLASH_TARGET_SELECTOR);
    activeTargets.forEach((element) => {
      element.classList.remove(FLASH_CLASS);
    });
    domFlashTimer = undefined;
  }, FLASH_RESET_MS);
}

/**
 * Enciende el destello verde de "saldo actualizado en vivo" cuando el hub de
 * wallet empuja un `SaldoActualizado` (depósito acreditado por administración).
 * Devuelve `true` durante la ventana de animación.
 */
export function useSaldoFlash(): boolean {
  const [isFlashing, setIsFlashing] = useState(false);

  useEffect(() => {
    let timer: number | undefined;

    const handleFlash = () => {
      triggerSaldoFlashElements();
      setIsFlashing(true);
      if (timer !== undefined) window.clearTimeout(timer);
      timer = window.setTimeout(() => setIsFlashing(false), FLASH_RESET_MS);
    };

    window.addEventListener(SALDO_FLASH_EVENT, handleFlash);

    return () => {
      window.removeEventListener(SALDO_FLASH_EVENT, handleFlash);
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, []);

  return isFlashing;
}
