/// <reference types="vite/client" />

declare module 'heic2any' {
  interface Heic2AnyOptions {
    blob: Blob
    toType?: string
    quality?: number
    multiple?: boolean
  }
  function heic2any(options: Heic2AnyOptions): Promise<Blob | Blob[]>
  export default heic2any
}

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string
  readonly VITE_FIREBASE_AUTH_DOMAIN: string
  readonly VITE_FIREBASE_PROJECT_ID: string
  readonly VITE_FIREBASE_STORAGE_BUCKET: string
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string
  readonly VITE_FIREBASE_APP_ID: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
