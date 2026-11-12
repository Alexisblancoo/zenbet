import { expect, test, type Page } from '@playwright/test';

import { eventsPage, referenceEvent } from './fixtures';
import { signIn } from './session';

/**
 * Cola de depósitos: los tres resultados de autorización viven en el servidor
 * (403 por rol, 403 por auto-aprobación, 404 por depósito inexistente). Aquí se
 * comprueba que la UI los muestra sin inventar éxito y sin ocultar el motivo.
 */

const pendingDeposits = [
  {
    id: 'dep-1',
    walletId: 'wallet-1',
    userId: 'user-1',
    username: 'jugador1',
    email: 'jugador1@zenbet.test',
    amount: 150,
    method: 'qr_transfer',
    reference: 'REF-001',
    status: 'pending',
    createdAt: '2026-11-11T18:00:00Z',
  },
  {
    id: 'dep-2',
    walletId: 'wallet-2',
    userId: 'user-2',
    username: 'jugador2',
    email: 'jugador2@zenbet.test',
    amount: 40,
    method: 'usdt',
    reference: 'REF-002',
    status: 'pending',
    createdAt: '2026-11-11T18:05:00Z',
  },
];

async function mockAdminPage(page: Page, deposits: readonly unknown[] = pendingDeposits) {
  await page.route('**/api/v1/events**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(eventsPage([referenceEvent])),
    }),
  );

  await page.route('**/api/v1/admin/dep**/pendientes', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(deposits),
    }),
  );
}

function problem(status: number, detail: string) {
  return {
    status,
    contentType: 'application/problem+json',
    body: JSON.stringify({
      type: 'about:blank',
      title: 'No se pudo aprobar el depósito.',
      status,
      detail,
    }),
  };
}

test.beforeEach(async ({ page }) => {
  await signIn(page, { roles: ['admin'], username: 'operador', id: 'admin-1' });
});

test('un admin aprueba el depósito de otro jugador y la fila desaparece', async ({
  page,
}) => {
  await mockAdminPage(page);

  let approveRequest: { method: string; path: string } | null = null;
  await page.route('**/api/v1/admin/dep**/aprobar', async (route) => {
    const url = new URL(route.request().url());
    approveRequest = { method: route.request().method(), path: url.pathname };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        transactionId: 'dep-1',
        status: 'approved',
        alreadyApproved: false,
        newBalance: 1150,
        atRiskBalance: 0,
        approvedBy: 'operador',
      }),
    });
  });

  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Depósitos pendientes' })).toBeVisible();

  await page.getByRole('button', { name: 'Aprobar depósito de jugador1' }).click();

  await expect(
    page.getByRole('status').filter({ hasText: 'Nuevo saldo: 1150.00' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Aprobar depósito de jugador1' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Aprobar depósito de jugador2' })).toBeVisible();

  expect(approveRequest?.method).toBe('POST');
  expect(approveRequest?.path.endsWith('/dep-1/aprobar')).toBe(true);
});

test('la auto-aprobación devuelve 403 y la fila sigue pendiente', async ({ page }) => {
  await mockAdminPage(page);
  await page.route('**/api/v1/admin/dep**/aprobar', (route) =>
    route.fulfill(problem(403, 'No puedes aprobar tu propio depósito.')),
  );

  await page.goto('/admin');
  await page.getByRole('button', { name: 'Aprobar depósito de jugador1' }).click();

  await expect(
    page.getByRole('alert').filter({ hasText: 'No puedes aprobar tu propio depósito.' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Aprobar depósito de jugador1' })).toBeVisible();
});

test('un depósito inexistente devuelve 404 y se retira de la cola', async ({ page }) => {
  await mockAdminPage(page);
  await page.route('**/api/v1/admin/dep**/aprobar', (route) =>
    route.fulfill(problem(404, 'El depósito no existe.')),
  );

  await page.goto('/admin');
  await page.getByRole('button', { name: 'Aprobar depósito de jugador1' }).click();

  await expect(
    page.getByRole('alert').filter({ hasText: 'El depósito no existe.' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Aprobar depósito de jugador1' })).toHaveCount(0);
});

test('un 401 cierra la sesión y devuelve al login', async ({ page }) => {
  await mockAdminPage(page);
  await page.route('**/api/v1/admin/dep**/aprobar', (route) =>
    route.fulfill(problem(401, 'La sesión expiró.')),
  );

  await page.goto('/admin');
  await page.getByRole('button', { name: 'Aprobar depósito de jugador1' }).click();

  await expect(page).toHaveURL(/\/login$/);
});

test('sin depósitos pendientes muestra el estado vacío, no datos de ejemplo', async ({
  page,
}) => {
  await mockAdminPage(page, []);

  await page.goto('/admin');

  await expect(page.getByText('No hay depósitos pendientes de revisión.')).toBeVisible();
});
