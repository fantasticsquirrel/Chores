/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_API_PROXY_TARGET?: string;
  readonly VITE_PASSWORD_RESET_TRUSTED_ORIGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
