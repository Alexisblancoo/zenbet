import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';
import { BASE_URL } from '../lib/data.js';
import { record, summaryTrendStats } from '../lib/metrics.js';

const compressed = new Counter('compressed_responses');
const encodings = new Counter('response_encodings');

export const options = {
  vus: Number(__ENV.VUS ?? 50),
  duration: __ENV.DURATION ?? '60s',
  summaryTrendStats,
  thresholds: {
    // Objetivo de lectura, no SLO de dinero. Se reporta, no aborta la corrida.
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/api/v1/events?pageSize=50`, {
    headers: { 'Accept-Encoding': 'gzip, br' },
    tags: { name: 'GET /api/v1/events' },
  });

  record(res, 200);

  const encoding = (res.headers['Content-Encoding'] ?? res.headers['content-encoding'] ?? '').toLowerCase();
  if (encoding) {
    compressed.add(1);
    encodings.add(1, { encoding });
  }

  check(res, {
    'status 200': (r) => r.status === 200,
    'json con items': (r) => {
      try {
        return Array.isArray(r.json('items'));
      } catch {
        return false;
      }
    },
    'respuesta comprimida': () => encoding === 'gzip' || encoding === 'br',
  });

  sleep(Number(__ENV.SLEEP ?? 0.25));
}
