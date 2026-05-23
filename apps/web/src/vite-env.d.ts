/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_API_TOKEN?: string;
  readonly VITE_LOG_ENABLED?: string;
  readonly VITE_LOG_LEVEL?: string;
  readonly VITE_LOG_MAX_ENTRIES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
