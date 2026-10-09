/** Public connection metadata. Credentials are write-only and never returned over IPC. */
export type ApiTransport = 'chat-completions' | 'responses' | 'anthropic-messages'
export type ApiProfile = 'openai-compatible' | 'codex-connector' | 'grok-connector-v1' | 'claude-connector-v1'
export interface ClaudeConnectionOptions {
  mode?: 'caller' | 'native'
  permissionMode?: 'manual' | 'plan' | 'acceptEdits' | 'dontAsk'
  nativeTools?: string[]
  maxTurns?: number
  maxTokens?: number
  thinking?: { type: 'adaptive' | 'enabled' | 'disabled'; budget_tokens?: number; display?: 'summarized' | 'omitted' }
  outputSchema?: Record<string, unknown>
  historyMode?: 'reject' | 'context'
}
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value))
const integer = (value: unknown, min: number, max: number) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max
function boundedClaudeSchema(value: unknown): value is Record<string, unknown> {
  if (!record(value)) return false
  let nodes = 0
  const visit = (item: unknown, depth: number): boolean => {
    if (++nodes > 20_000 || depth > 32) return false
    if (item === null || typeof item === 'string' || typeof item === 'boolean' || typeof item === 'number' && Number.isFinite(item)) return true
    if (Array.isArray(item)) return item.every(child => visit(child, depth + 1))
    if (!record(item)) return false
    return Object.entries(item).every(([key, child]) => !['__proto__', 'constructor', 'prototype'].includes(key) && visit(child, depth + 1))
  }
  try { return visit(value, 0) && new TextEncoder().encode(JSON.stringify(value)).byteLength <= 131_072 } catch { return false }
}
export function validClaudeConnectionOptions(value: unknown): value is ClaudeConnectionOptions {
  if (!record(value) || Object.keys(value).some(key => !['mode', 'permissionMode', 'nativeTools', 'maxTurns', 'maxTokens', 'thinking', 'outputSchema', 'historyMode'].includes(key))) return false
  if (value.mode !== undefined && (typeof value.mode !== 'string' || !['caller', 'native'].includes(value.mode)) || value.permissionMode !== undefined && (typeof value.permissionMode !== 'string' || !['manual', 'plan', 'acceptEdits', 'dontAsk'].includes(value.permissionMode)) || value.historyMode !== undefined && (typeof value.historyMode !== 'string' || !['reject', 'context'].includes(value.historyMode))) return false
  if (value.maxTurns !== undefined && !integer(value.maxTurns, 1, 100) || value.maxTokens !== undefined && !integer(value.maxTokens, 1, 128_000)) return false
  if (value.nativeTools !== undefined && (!Array.isArray(value.nativeTools) || value.nativeTools.length > 128 || value.nativeTools.some(tool => typeof tool !== 'string' || !/^[A-Za-z_][A-Za-z0-9_.:-]{0,149}$/.test(tool)) || new Set(value.nativeTools).size !== value.nativeTools.length)) return false
  if (value.outputSchema !== undefined && !boundedClaudeSchema(value.outputSchema)) return false
  if (value.thinking !== undefined) {
    const thinking = value.thinking
    if (!record(thinking) || Object.keys(thinking).some(key => !['type', 'budget_tokens', 'display'].includes(key)) || typeof thinking.type !== 'string' || !['adaptive', 'enabled', 'disabled'].includes(thinking.type)) return false
    if (thinking.display !== undefined && (thinking.type === 'disabled' || typeof thinking.display !== 'string' || !['summarized', 'omitted'].includes(thinking.display))) return false
    if (thinking.type === 'enabled' ? !integer(thinking.budget_tokens, 1024, ((value.maxTokens as number | undefined) ?? 4096) - 1) : thinking.budget_tokens !== undefined) return false
  }
  return true
}
/** Defaults are explicit so no omitted connector option enables native tools. */
export type NormalizedClaudeConnectionOptions = ClaudeConnectionOptions & Required<Pick<ClaudeConnectionOptions, 'mode' | 'permissionMode' | 'nativeTools' | 'maxTurns' | 'maxTokens' | 'historyMode'>>
export function normalizeClaudeConnectionOptions(value: ClaudeConnectionOptions = {}): NormalizedClaudeConnectionOptions {
  if (!validClaudeConnectionOptions(value)) throw new Error('Invalid Claude Connector settings')
  return structuredClone({ mode: value.mode ?? 'caller', permissionMode: value.permissionMode ?? 'manual', nativeTools: value.nativeTools ?? [], maxTurns: value.maxTurns ?? 30, maxTokens: value.maxTokens ?? 4096, historyMode: value.historyMode ?? 'reject', ...(value.thinking !== undefined ? { thinking: value.thinking } : {}), ...(value.outputSchema !== undefined ? { outputSchema: value.outputSchema } : {}) })
}
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
  /** Legacy Grok inspection payloads intentionally omit this discriminator. */
  provider?: 'grok'
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
export interface ClaudeCapabilityState { available: boolean; enabled: boolean; verified: boolean }
export interface ClaudeModelInspection {
  id: string
  label: string
  resolvedModel?: string
  reasoningEfforts: string[]
  supportsAdaptiveThinking: boolean | null
  supportsManualThinking: boolean | null
  maxOutputTokens: number | null
  contextWindows: number[]
  inputModalities: string[]
}
/** Allowlisted metadata only: no account, token hint, paths or session identifiers. */
export interface ClaudeConnectorInspection {
  provider: 'claude'
  version: 1
  fetchedAt: number
  cliVersion?: string
  sdkVersion?: string
  tools: Array<ClaudeCapabilityState & { name: string; reason?: string }>
  models: ClaudeModelInspection[]
  callerTools: ClaudeCapabilityState
  imageInput: ClaudeCapabilityState
  documentInput: ClaudeCapabilityState & { mediaTypes: string[] }
  artifacts: ClaudeCapabilityState
  thinking: { available: boolean; display: Array<'summarized' | 'omitted'> }
  history: { liveSessionContinuation: boolean; ownedIdleResume: boolean; restartResume: boolean }
  usage: {
    available: boolean
    experimental: boolean
    checkedAt: string | null
    windows: Array<{ name: string; usedPercent: number | null; remainingPercent: number | null; resetsAt: string | null }>
    subscriptionType?: string
    renewsAt: string | null
    renewalSource: 'manual' | 'unavailable'
  }
  status: {
    connected: boolean | null
    active: number | null
    queued: number | null
    nativeActive: number | null
    awaitingTools: number | null
    concurrency: number | null
    queueLimit: number | null
    ownedSessions: number | null
  }
  warnings: string[]
}
export type ApiConnectorInspection = GrokConnectorInspection | ClaudeConnectorInspection
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
  claude?: ClaudeConnectionOptions
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
  claude?: ClaudeConnectionOptions
}
export interface ApiConnectionsAPI {
  list(): Promise<ApiConnection[]>
  save(request: SaveApiConnection): Promise<ApiConnection>
  remove(request: { id: string }): Promise<void>
  inspect(request: { id: string }): Promise<ApiConnectorInspection>
}
