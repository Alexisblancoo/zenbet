import { defineConfig, devices } from '@playwright/test';

/**
 * E2E de comportamiento, sin backend: cada spec intercepta la API y sirve
 * payloads controlados. El objetivo es probar la UI, no la persistencia.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'off',
    video: 'off',
  },
  webServer: {
    // Se sirve el bundle de producción: `vite dev` monta StrictMode y su doble
    // efecto aborta la carga inicial de la cartelera. El E2E debe probar lo que
    // se despliega, no el artefacto de desarrollo.
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 180_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
