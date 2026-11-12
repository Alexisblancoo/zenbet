import { expect, test } from '@playwright/test';

import { signIn } from './session';

test('un jugador sin rol admin recibe 403 y no ve la consola', async ({ page }) => {
  await signIn(page, { roles: ['player'] });

  await page.goto('/admin');

  await expect(
    page.getByRole('heading', { name: 'Acceso Denegado (403 Forbidden)' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Cotización de mercados' })).toHaveCount(0);
});

test('sin sesión, /admin redirige al login', async ({ page }) => {
  await page.goto('/admin');

  await expect(page).toHaveURL(/\/login$/);
});
