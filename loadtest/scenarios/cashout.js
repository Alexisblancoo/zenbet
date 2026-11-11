import http from 'k6/http';
import { BASE_URL, users } from '../lib/data.js';
import { newGuid } from '../lib/ids.js';
import { record, summaryTrendStats } from '../lib/metrics.js';

export const options = {
  scenarios: {
    cashout: {
      executor: 'per-vu-iterations',
      vus: Number(__ENV.VUS ?? 200),
      iterations: 1,
      maxDuration: __ENV.MAX_DURATION ?? '90s',
    },
  },
  summaryTrendStats,
};

export default function () {
  const user = users[(__VU - 1) % users.length];

  const res = http.post(
    `${BASE_URL}/api/v1/bets/${user.cashoutBetId}/cashout`,
    null,
    {
      headers: {
        Authorization: `Bearer ${user.token}`,
        'Idempotency-Key': newGuid(),
      },
      tags: { name: 'POST /api/v1/bets/:id/cashout' },
    },
  );

  record(res, 200);
}
