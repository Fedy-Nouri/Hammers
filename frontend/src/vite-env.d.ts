/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Absolute origin of the backend API (e.g. https://api.example.com). Leave empty for
   * same-origin deployments where nginx reverse-proxies /api to the backend.
   */
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
