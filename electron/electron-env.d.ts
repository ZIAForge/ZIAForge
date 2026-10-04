declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV?: 'development' | 'test' | 'production'
    VITE_DEV_SERVER_URL?: string
    /**
     * The built directory structure
     *
     * ```tree
     * ├─┬─┬ dist
     * │ │ └── index.html
     * │ │
     * │ ├─┬ dist-electron
     * │ │ ├── main.js
     * │ │ └── preload.js
     * │
     * ```
     */
    APP_ROOT?: string
    /** /dist/ or /public/ */
    VITE_PUBLIC?: string
  }
}

// Used in Renderer process, exposed by preload.ts.
interface Window {
  ziafAPI: import('../shared/legacy-ipc').LegacyZiafAPI
}
