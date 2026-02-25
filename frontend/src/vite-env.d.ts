/// <reference types="vite/client" />

declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}

interface ImportMetaEnv {
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_API_URL?: string;
  // Network-specific URL overrides (optional — sensible defaults are built in)
  readonly VITE_TESTNET_HORIZON_URL?: string;
  readonly VITE_TESTNET_RPC_URL?: string;
  readonly VITE_MAINNET_HORIZON_URL?: string;
  readonly VITE_MAINNET_RPC_URL?: string;
  // Legacy env vars kept for backwards compat with existing services
  readonly PUBLIC_STELLAR_HORIZON_URL?: string;
  readonly PUBLIC_STELLAR_RPC_URL?: string;
  readonly MODE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
