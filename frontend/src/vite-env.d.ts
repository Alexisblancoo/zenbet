/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_AUTH_URL?: string;
  readonly VITE_HUB_URL?: string;
  /** Override del hub de estado de combates (por defecto `/fight-hub`). */
  readonly VITE_FIGHT_HUB_URL?: string;
  /** Override del hub de fútbol (por defecto `/football-hub`). */
  readonly VITE_FOOTBALL_HUB_URL?: string;
  /** Solo desarrollo: walletId (GUID) cuando el login legacy no lo entrega. */
  readonly VITE_DEV_WALLET_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
