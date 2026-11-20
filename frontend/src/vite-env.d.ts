/// <reference types="vite/client" />

declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}

interface ImportMetaEnv {
  readonly VITE_SENTRY_DSN?: string;
  /** Opt-in flag for developer tools in production-like preview builds. */
  readonly PUBLIC_ENABLE_DEBUG_TOOLS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
