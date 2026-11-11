import { Counter, Trend } from 'k6/metrics';

export const okDuration = new Trend('ok_duration', true);
export const allDuration = new Trend('all_duration', true);
export const status429 = new Counter('http_429');
export const status5xx = new Counter('http_5xx');
export const status503 = new Counter('http_503');
export const otherErrors = new Counter('http_other_error');

/** Registra latencias separando respuestas exitosas de rechazos. */
export function record(res, expectedStatus) {
  allDuration.add(res.timings.duration);
  if (res.status === expectedStatus) {
    okDuration.add(res.timings.duration);
  }
  if (res.status === 429) status429.add(1);
  if (res.status === 503) status503.add(1);
  if (res.status >= 500) status5xx.add(1);
  if (res.status >= 400 && res.status !== 429 && res.status < 500 && res.status !== 503) {
    otherErrors.add(1);
  }
}

export const summaryTrendStats = ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'];
