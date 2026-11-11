import { SharedArray } from 'k6/data';

// k6 resuelve open()/SharedArray relativos al archivo que los invoca (lib/).
export const DATA_DIR = __ENV.DATA_DIR ?? '../.runtime';

export const users = new SharedArray('users', () =>
  JSON.parse(open(`${DATA_DIR}/users.json`)),
);

export const selections = new SharedArray('selections', () =>
  JSON.parse(open(`${DATA_DIR}/selections.json`)),
);

export const meta = JSON.parse(open(`${DATA_DIR}/meta.json`));
export const BASE_URL = (__ENV.BASE_URL ?? meta.baseUrl ?? 'http://localhost:15005').replace(/\/$/, '');
