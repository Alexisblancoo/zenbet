import type { Page } from '@playwright/test';

interface SessionOptions {
  readonly roles?: readonly string[];
  readonly username?: string;
  readonly id?: string;
}

/**
 * Sesión sintética para los E2E: escribe token y usuario en `localStorage`,
 * que es de donde `AuthContext` hidrata la sesión antes del primer render.
 * No se usa ninguna credencial real.
 */
export async function signIn(page: Page, options: SessionOptions = {}): Promise<void> {
  const user = {
    id: options.id ?? 'e2e-user',
    username: options.username ?? 'e2e',
    email: `${options.username ?? 'e2e'}@zenbet.test`,
    roles: options.roles ?? ['player'],
    balance: 0,
  };

  await page.addInitScript((payload) => {
    window.localStorage.setItem('zenbet_token', 'e2e-token');
    window.localStorage.setItem('zenbet_user', JSON.stringify(payload));
  }, user);
}
