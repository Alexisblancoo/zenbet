#!/usr/bin/env node
/**
 * Convierte los summary-export de k6 en una tabla Markdown.
 * Uso: node loadtest/summarize.mjs [directorio]
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const dir = process.argv[2] ?? 'loadtest/results';
const files = (await readdir(dir))
  .filter((name) => name.endsWith('.json') && !name.includes('-stats'))
  .sort();

const rows = [];
for (const file of files) {
  const data = JSON.parse(await readFile(join(dir, file), 'utf8'));
  const m = data.metrics ?? {};
  const duration = m.http_req_duration ?? {};
  const reqs = m.http_reqs ?? {};
  const failed = m.http_req_failed ?? {};
  const ok = m.ok_duration ?? {};
  const c429 = m.http_429?.count ?? 0;
  const c503 = m.http_503?.count ?? 0;
  const c5xx = m.http_5xx?.count ?? 0;
  const other = m.http_other_error?.count ?? 0;

  rows.push({
    scenario: file.replace(/\.json$/, ''),
    requests: reqs.count ?? 0,
    rps: reqs.rate ?? 0,
    p50: duration['p(50)'] ?? duration.med ?? 0,
    p95: duration['p(95)'] ?? 0,
    p99: duration['p(99)'] ?? 0,
    okP95: ok['p(95)'] ?? 0,
    failed: (failed.value ?? failed.rate ?? 0) * 100,
    c429,
    c503,
    c5xx,
    other,
  });
}

console.log('| Escenario | Reqs | req/s | p50 (ms) | p95 (ms) | p99 (ms) | p95 2xx (ms) | Error | 429 | 503 | 5xx | Otros 4xx |');
console.log('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
for (const r of rows) {
  console.log(
    `| ${r.scenario} | ${r.requests} | ${r.rps.toFixed(1)} | ${r.p50.toFixed(1)} | ${r.p95.toFixed(1)} | ${r.p99.toFixed(1)} | ${r.okP95.toFixed(1)} | ${r.failed.toFixed(2)}% | ${r.c429} | ${r.c503} | ${r.c5xx} | ${r.other} |`,
  );
}
