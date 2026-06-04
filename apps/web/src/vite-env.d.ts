/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LOG_ENABLED?: string;
  readonly VITE_LOG_LEVEL?: string;
  readonly VITE_LOG_MAX_ENTRIES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
