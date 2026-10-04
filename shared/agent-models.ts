/** Codex advertises an extensible token, not a fixed cross-provider enum. */
export type ReasoningEffort = string
export interface AgentExecutionOptions {
  /** Missing inherits a preset; null explicitly selects the provider default. */
  reasoningEffort?: ReasoningEffort | null
  permissions?: string
}
export function isReasoningEffort(value: unknown): value is ReasoningEffort {
  return typeof value === 'string' && /^[a-z][a-z0-9_-]{0,63}$/.test(value)
}
/** A catalog returned by the selected installed client; never a hard-coded model fallback. */
export interface AgentModelCatalog {
  agent: string
  models: Array<{ id: string; label: string; supportedReasoningEfforts?: ReasoningEffort[]; defaultReasoningEffort?: ReasoningEffort }>
  /** CLI flag values, used only when the CLI exposes no per-model metadata. */
  reasoningEfforts?: ReasoningEffort[]
  /** The native/API contract accepts an explicit token for manually entered models. */
  manualReasoningEffort?: boolean
  status: 'ready' | 'unavailable'
  source: 'cli' | 'api'
  command: string
  queriedAt: number
  error?: string
}
