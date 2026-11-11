#!/usr/bin/env node
/**
 * Prepara datos deterministas para el baseline HTTP de T1.
 *
 * - Registra N jugadores a <= AUTH_RATE req/s (el límite de /api/auth/* es por IP).
 * - Recarga saldo demo de cada jugador (solo Development).
 * - Crea una apuesta pendiente por jugador para el escenario de cash out.
 * - Guarda tokens y selecciones en loadtest/.runtime/ (ignorado por git).
 *
 * No imprime tokens ni secretos. Ejecutar contra el stack aislado de
 * loadtest/compose.bench.yml, nunca contra producción.
 */
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const runtimeDir = join(here, '.runtime');

const BASE_URL = (process.env.BASE_URL ?? 'http://localhost:15005').replace(/\/$/, '');
const USERS = Number(process.env.SEED_USERS ?? 200);
const AUTH_RATE = Number(process.env.AUTH_RATE ?? 4); // req/s, nunca > 4
const DEPOSIT = Number(process.env.SEED_DEPOSIT ?? 1000);
const BET_AMOUNT = Number(process.env.SEED_BET_AMOUNT ?? 10);
const RUN_ID = process.env.SEED_RUN_ID ?? `t1${Date.now().toString(36)}`;
const PASSWORD = 'LoadTest!2026';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(path, { method = 'GET', token, headers = {}, body } = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      accept: 'application/json',
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: response.status, body: parsed };
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;

  async function runner() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runner));
  return results;
}

async function loadSelections() {
  const { status, body } = await request('/api/v1/events?pageSize=200');
  if (status !== 200 || !Array.isArray(body?.items)) {
    throw new Error(`GET /events falló: ${status}`);
  }

  const selections = [];
  for (const event of body.items) {
    if (!event.isBettingOpen || event.status !== 'scheduled') continue;
    for (const market of event.markets ?? []) {
      if (market.status !== 'open') continue;
      const selection = (market.selections ?? []).find((item) => !item.settled);
      if (!selection) continue;
      selections.push({
        eventId: event.id,
        eventName: event.name,
        marketId: market.id,
        marketName: market.name,
        selectionId: selection.id,
        selectionName: selection.name,
        odds: Number(selection.decimalOdds),
      });
    }
  }

  if (selections.length < 10) {
    throw new Error(`Se esperaban >= 10 mercados abiertos; hay ${selections.length}`);
  }
  return selections;
}

async function register(index) {
  const suffix = `${RUN_ID}${String(index).padStart(3, '0')}`;
  const username = suffix.slice(0, 24);
  const email = `${suffix}@example.test`;

  // El rate limit es por IP: una petición cada 1000/AUTH_RATE ms.
  await sleep(1000 / AUTH_RATE);
  const result = await request('/api/auth/register', {
    method: 'POST',
    body: { username, email, password: PASSWORD, termsAccepted: true },
  });

  if (result.status === 201) {
    return { token: result.body.token, walletId: result.body.user.walletId, username };
  }

  if (result.status === 409) {
    await sleep(1000 / AUTH_RATE);
    const login = await request('/api/auth/login', {
      method: 'POST',
      body: { identifier: username, password: PASSWORD },
    });
    if (login.status === 200) {
      return { token: login.body.token, walletId: login.body.user.walletId, username };
    }
    throw new Error(`Login ${username} falló: ${login.status}`);
  }

  throw new Error(`Registro ${username} falló: ${result.status} ${JSON.stringify(result.body).slice(0, 200)}`);
}

async function deposit(user) {
  const { status, body } = await request('/api/v1/wallet/deposit', {
    method: 'POST',
    token: user.token,
    headers: { 'Idempotency-Key': randomUUID() },
    body: { amount: DEPOSIT, method: 'wallet' },
  });
  if (status !== 200) {
    throw new Error(`Depósito ${user.username} falló: ${status} ${JSON.stringify(body).slice(0, 200)}`);
  }
}

async function placeCashOutBet(user, selection) {
  const { status, body } = await request('/api/v1/bets/place', {
    method: 'POST',
    token: user.token,
    headers: { 'X-Idempotency-Key': randomUUID() },
    body: {
      walletId: user.walletId,
      selectionId: selection.selectionId,
      amount: BET_AMOUNT,
      description: `T1 cashout seed ${selection.eventName}`.slice(0, 500),
      expectedOdds: selection.odds,
      maxSlippagePercent: 10,
    },
  });
  if (status !== 201) {
    throw new Error(`Apuesta semilla ${user.username} falló: ${status} ${JSON.stringify(body).slice(0, 200)}`);
  }
  return body.betId;
}

async function main() {
  await mkdir(runtimeDir, { recursive: true });

  console.log(`[seed] base=${BASE_URL} users=${USERS} authRate=${AUTH_RATE}/s`);
  const selections = await loadSelections();
  const hot = selections[0];
  console.log(`[seed] mercados abiertos=${selections.length}; hot=${hot.eventName} / ${hot.marketName}`);

  const users = [];
  for (let index = 0; index < USERS; index++) {
    const user = await register(index);
    users.push(user);
    if ((index + 1) % 25 === 0) console.log(`[seed] registrados ${index + 1}/${USERS}`);
  }

  await mapLimit(users, 8, deposit);
  console.log(`[seed] depósitos acreditados=${users.length} (${DEPOSIT} c/u)`);

  const betIds = await mapLimit(users, 8, (user, index) =>
    placeCashOutBet(user, selections[index % selections.length]),
  );
  users.forEach((user, index) => {
    user.cashoutBetId = betIds[index];
  });
  console.log(`[seed] apuestas pendientes para cashout=${betIds.length}`);

  const meta = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    runId: RUN_ID,
    users: users.length,
    selections: selections.length,
    deposit: DEPOSIT,
    betAmount: BET_AMOUNT,
    hot,
  };

  await writeFile(join(runtimeDir, 'users.json'), JSON.stringify(users));
  await writeFile(join(runtimeDir, 'selections.json'), JSON.stringify(selections));
  await writeFile(join(runtimeDir, 'meta.json'), JSON.stringify(meta, null, 2));
  console.log(`[seed] listo: ${join(runtimeDir, 'users.json')}`);
}

main().catch((error) => {
  console.error(`[seed] ERROR: ${error.message}`);
  process.exit(1);
});
