import http from 'k6/http';
import { sleep } from 'k6';
import { BASE_URL, meta, users } from '../lib/data.js';
import { newGuid } from '../lib/ids.js';
import { record, summaryTrendStats } from '../lib/metrics.js';

export const options = {
  vus: Number(__ENV.VUS ?? 200),
  duration: __ENV.DURATION ?? '30s',
  summaryTrendStats,
};

const amount = Number(__ENV.AMOUNT ?? 1);
const hot = meta.hot;

export default function () {
  const user = users[(__VU - 1) % users.length];

  const res = http.post(
    `${BASE_URL}/api/v1/bets/place`,
    JSON.stringify({
      walletId: user.walletId,
      selectionId: hot.selectionId,
      amount,
      description: 'T1 hot market',
      expectedOdds: hot.odds,
      maxSlippagePercent: 5,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user.token}`,
        'X-Idempotency-Key': newGuid(),
      },
      tags: { name: 'POST /api/v1/bets/place (hot)' },
    },
  );

  record(res, 201);
  sleep(Number(__ENV.SLEEP ?? 0.25));
}
