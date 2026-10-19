declare module 'bootstrap/dist/css/bootstrap.min.css'
declare module 'bootstrap'

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
