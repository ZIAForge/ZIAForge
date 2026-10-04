/** Public connection metadata. Credentials are write-only and never returned over IPC. */
export interface ApiConnection {
  id: string
  name: string
  baseUrl: string
  model: string
  enabled: boolean
  hasApiKey: boolean
}
export interface SaveApiConnection {
  id?: string
  name: string
  baseUrl: string
  model: string
  enabled: boolean
  /** Omit to keep the existing key; an empty string explicitly removes it. */
  apiKey?: string
}
export interface ApiConnectionsAPI {
  list(): Promise<ApiConnection[]>
  save(request: SaveApiConnection): Promise<ApiConnection>
  remove(request: { id: string }): Promise<void>
}
