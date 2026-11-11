import http from 'k6/http';
import { sleep } from 'k6';
import { BASE_URL, selections, users } from '../lib/data.js';
import { newGuid } from '../lib/ids.js';
import { record, summaryTrendStats } from '../lib/metrics.js';

export const options = {
  vus: Number(__ENV.VUS ?? 200),
  duration: __ENV.DURATION ?? '60s',
  summaryTrendStats,
};

const amount = Number(__ENV.AMOUNT ?? 1);

export default function () {
  const user = users[(__VU - 1) % users.length];
  // Un mercado distinto por VU (se repite solo cuando hay más VUs que mercados).
  const selection = selections[(__VU - 1) % selections.length];

  const res = http.post(
    `${BASE_URL}/api/v1/bets/place`,
    JSON.stringify({
      walletId: user.walletId,
      selectionId: selection.selectionId,
      amount,
      description: `T1 distinct ${selection.eventName}`.slice(0, 500),
      expectedOdds: selection.odds,
      maxSlippagePercent: 5,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user.token}`,
        'X-Idempotency-Key': newGuid(),
      },
      tags: { name: 'POST /api/v1/bets/place (distinct)' },
    },
  );

  record(res, 201);
  sleep(Number(__ENV.SLEEP ?? 0.25));
}
