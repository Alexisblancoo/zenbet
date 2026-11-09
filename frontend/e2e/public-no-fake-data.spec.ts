import { expect, test } from '@playwright/test';

import {
  eventsPage,
  expiredWithResult,
  expiredWithoutResult,
  referenceEvent,
} from './fixtures';

const pagePayload = eventsPage([referenceEvent, expiredWithoutResult, expiredWithResult]);

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/events**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(pagePayload),
    }),
  );
  await page.route('**/api/v1/football/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] }) }),
  );
});

test('oculta del listado un combate vencido sin resultado oficial', async ({ page }) => {
  await page.goto('/sportsbook');

  await expect(page.getByText('Ana Viva').first()).toBeVisible();
  await expect(page.getByText('Beto Vencido')).toHaveCount(0);
  await expect(page.getByText('Carla Resuelta').first()).toBeVisible();
  await expect(page.getByText('Finalizado').first()).toBeVisible();
});

test('una línea de referencia se muestra pero no se puede apostar', async ({ page }) => {
  await page.goto('/sportsbook');

  const card = page.locator('article', { hasText: 'Ana Viva' }).first();
  await expect(card).toBeVisible();

  const referenceTiles = card.getByRole('button', { name: /Cuota en revisión/ });
  await expect(referenceTiles).toHaveCount(2);
  await expect(referenceTiles.first()).toBeDisabled();
  await expect(referenceTiles.nth(1)).toBeDisabled();
});
