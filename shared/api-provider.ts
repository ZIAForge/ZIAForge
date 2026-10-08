/** Public connection metadata. Credentials are write-only and never returned over IPC. */
export type ApiTransport = 'chat-completions' | 'responses'
export type ApiProfile = 'openai-compatible' | 'codex-connector' | 'grok-connector-v1'
export interface GrokConnectionOptions { contextWindow?: number; maxTurns?: number; autoApproveNativePermissions?: boolean }
export function validGrokConnectionOptions(value: unknown): value is GrokConnectionOptions {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const data = value as Record<string, unknown>
  return Object.keys(data).every(key => key === 'contextWindow' || key === 'maxTurns' || key === 'autoApproveNativePermissions')
    && (data.contextWindow === undefined || Number.isSafeInteger(data.contextWindow) && (data.contextWindow as number) > 0 && (data.contextWindow as number) <= 100_000_000)
    && (data.autoApproveNativePermissions === undefined || typeof data.autoApproveNativePermissions === 'boolean')
    && (data.maxTurns === undefined || Number.isSafeInteger(data.maxTurns) && (data.maxTurns as number) >= 1 && (data.maxTurns as number) <= 100)
}
/** Sanitized discovery; no account identifiers, credentials, raw provider payloads or inferred quota. */
export interface GrokConnectorInspection {
  fetchedAt: number
  version: 1
  cliVersion?: string
  tools: string[]
  imageInput: boolean
  imageGeneration: boolean
  imageEdit: boolean
  videoAvailable: boolean
  videoRestriction?: string
  interactiveQuestions: boolean
  reasoningSummaries: boolean
  contextWindows: number[]
  usage?: { tier?: string; creditUsagePercent: number | null; periodEnd: string | null }
  warnings: string[]
}
export interface ApiConnection {
  id: string
  name: string
  baseUrl: string
  model: string
  enabled: boolean
  hasApiKey: boolean
  /** Absent in legacy connections: Chat Completions. */
  transport?: ApiTransport
  profile?: ApiProfile
  allowCommands?: boolean
  grok?: GrokConnectionOptions
}
export interface SaveApiConnection {
  id?: string
  name: string
  baseUrl: string
  model: string
  enabled: boolean
  /** Omit to keep the existing key; an empty string explicitly removes it. */
  apiKey?: string
  transport?: ApiTransport
  profile?: ApiProfile
  allowCommands?: boolean
  grok?: GrokConnectionOptions
}
export interface ApiConnectionsAPI {
  list(): Promise<ApiConnection[]>
  save(request: SaveApiConnection): Promise<ApiConnection>
  remove(request: { id: string }): Promise<void>
  inspect(request: { id: string }): Promise<GrokConnectorInspection>
}
