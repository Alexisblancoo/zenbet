import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';

const rootDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function loadDotEnv() {
  try {
    const contents = await readFile(resolve(rootDirectory, '.env'), 'utf8');
    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match || process.env[match[1]] !== undefined) continue;

      const value = match[2].replace(/^(["'])(.*)\1$/, '$2');
      process.env[match[1]] = value;
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

await loadDotEnv();

const databaseUrl = process.env.DATABASE_URL ?? `postgresql://${encodeURIComponent(process.env.POSTGRES_USER ?? 'zenbet')}:${encodeURIComponent(process.env.POSTGRES_PASSWORD ?? '')}@${process.env.PGHOST ?? 'localhost'}:${process.env.POSTGRES_PORT ?? '5432'}/${process.env.POSTGRES_DB ?? 'zenbet_events_markets'}`;
const oddsApiUrl = process.env.ODDS_API_URL ?? 'http://localhost:5005/api/v1/bets/odds';
const intervalMs = Number(process.env.ODDS_SIMULATOR_INTERVAL_MS ?? 10_000);

assert.ok(Number.isFinite(intervalMs) && intervalMs > 0, 'ODDS_SIMULATOR_INTERVAL_MS debe ser un número positivo.');

const pool = new Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 5_000 });
pool.on('error', (error) => log('WARN', `PostgreSQL desconectado: ${error.message}`));

let stopping = false;
let running = false;

function log(level, message) {
  console.log(`${new Date().toISOString()} ${level} ${message}`);
}

function nextOdd(currentOdd) {
  const change = 0.02 + Math.random() * 0.03;
  const multiplier = Math.random() < 0.5 ? 1 - change : 1 + change;
  return Math.max(1.01, Number((Number(currentOdd) * multiplier).toFixed(4)));
}

async function selectUpdates() {
  const { rows } = await pool.query(`
    WITH picked_markets AS (
      SELECT markets.id
      FROM events_markets.markets AS markets
      JOIN events_markets.events AS events ON events.id = markets.event_id
      WHERE markets.status = 1
        AND NOT markets.is_suspended_by_risk
        AND events.status IN (1, 2)
        AND events.sport_type = ANY($1::int[])
      ORDER BY random()
      LIMIT 3
    )
    SELECT DISTINCT ON (selections.market_id)
      selections.id AS "selectionId",
      selections.current_odds_value AS "currentOdd"
    FROM events_markets.selections AS selections
    JOIN picked_markets ON picked_markets.id = selections.market_id
    WHERE selections.current_odds_value > 1
    ORDER BY selections.market_id, random();
  `, [[1, 2, 3]]);

  return rows.map((row) => ({
    selectionId: row.selectionId,
    value: nextOdd(row.currentOdd),
    timestamp: new Date().toISOString(),
    provider: 'live-odds-simulator',
  }));
}

async function publishUpdates(updates) {
  const response = await fetch(oddsApiUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    signal: AbortSignal.timeout(8_000),
    body: JSON.stringify({ updates, idempotencyKey: crypto.randomUUID() }),
  });

  if (!response.ok) {
    throw new Error(`API respondió ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }

  const result = await response.json();
  if (result.failedCount > 0) {
    throw new Error(`API rechazó ${result.failedCount} actualización(es).`);
  }

  return result.processedCount;
}

async function tick() {
  if (running || stopping) return;
  running = true;

  try {
    const updates = await selectUpdates();
    if (updates.length === 0) {
      log('WARN', 'No hay mercados abiertos de fútbol, tenis o básquet/NBA.');
      return;
    }

    const processed = await publishUpdates(updates);
    log('INFO', `Cuotas actualizadas: ${processed} selección(es) en ${updates.length} mercado(s).`);
  } catch (error) {
    log('ERROR', `Ciclo omitido: ${error.message}`);
  } finally {
    running = false;
  }
}

async function stop(signal) {
  if (stopping) return;
  stopping = true;
  log('INFO', `${signal} recibido; cerrando worker.`);
  await pool.end();
  process.exit(0);
}

process.once('SIGINT', () => void stop('SIGINT'));
process.once('SIGTERM', () => void stop('SIGTERM'));

log('INFO', `Simulador iniciado; intervalo ${intervalMs / 1000}s; API ${oddsApiUrl}.`);
await tick();
setInterval(() => void tick(), intervalMs);
