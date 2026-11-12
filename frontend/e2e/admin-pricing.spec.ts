import { expect, test } from '@playwright/test';

import { eventsPage, referenceEvent } from './fixtures';

const pagePayload = eventsPage([referenceEvent]);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('zenbet_token', 'e2e-token');
    window.localStorage.setItem(
      'zenbet_user',
      JSON.stringify({
        id: 'admin-1',
        username: 'admin',
        email: 'admin@zenbet.test',
        roles: ['Admin'],
        balance: 0,
      }),
    );
  });

  await page.route('**/api/v1/events**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(pagePayload),
    }),
  );

  // La consola incluye la cola de depósitos: se mockea para que la prueba de
  // cotización no dependa de la red ni del estado de tesorería.
  await page.route('**/api/v1/admin/dep**/pendientes', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
});

test('cotiza el mercado contra el endpoint real y muestra el margen del servidor', async ({
  page,
}) => {
  let captured: Record<string, unknown> | null = null;

  await page.route('**/api/v1/admin/markets/*/pricing', async (route) => {
    captured = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        marketId: 'market-e2e-reference',
        overroundPercent: 8.11,
        idempotentReplay: false,
        selections: [
          { selectionId: 'sel-e2e-reference-red', fairProbability: 0.5, decimalOdds: 1.85 },
          { selectionId: 'sel-e2e-reference-blue', fairProbability: 0.5, decimalOdds: 1.85 },
        ],
      }),
    });
  });

  await page.goto('/admin');

  await expect(
    page.getByRole('heading', { name: 'Cotización de mercados' }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Cotizar y publicar' }).click();

  await expect(page.getByRole('status')).toContainText('Mercado cotizado');
  await expect(page.getByRole('status')).toContainText('8.11');

  expect(captured).not.toBeNull();
  const body = captured as unknown as {
    marginPercent: number;
    selections: { selectionId: string; fairProbability: number }[];
    idempotencyKey: string;
  };
  expect(body.marginPercent).toBe(8);
  expect(body.selections).toHaveLength(2);
  expect(
    body.selections.reduce((sum, selection) => sum + selection.fairProbability, 0),
  ).toBeCloseTo(1, 4);
  expect(body.idempotencyKey).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
});

test('un rechazo 422 del servidor se muestra sin sustituirse por la vista previa', async ({
  page,
}) => {
  await page.route('**/api/v1/admin/markets/*/pricing', (route) =>
    route.fulfill({
      status: 422,
      contentType: 'application/problem+json',
      body: JSON.stringify({
        status: 422,
        title: 'Margen insuficiente',
        detail: 'Las probabilidades deben sumar 1 (tolerancia 0.005).',
        code: 'INVALID_PRICING',
      }),
    }),
  );

  await page.goto('/admin');
  await page.getByRole('button', { name: 'Cotizar y publicar' }).click();

  const status = page.getByRole('alert');
  await expect(status).toContainText('422');
  await expect(status).toContainText('Margen insuficiente');
  await expect(status).toContainText('deben sumar 1');
});
