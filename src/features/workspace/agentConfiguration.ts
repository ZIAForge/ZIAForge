import type { AgentSessionProvider } from '../../../shared/agent-session'
import type { ReasoningEffort } from '../../../shared/agent-models'
import type { Preset } from '../../../shared/legacy-ipc'

export interface ChatConfiguration {
  presetName: string
  provider: AgentSessionProvider
  model: string
  apiConnectionId?: string
  permissions?: string
  reasoningEffort?: ReasoningEffort | null
}
export const providerAgents: Record<AgentSessionProvider, string> = {
  codex: 'Codex', claude: 'Claude Code', antigravity: 'Google Antigravity', api: 'OpenAI-compatible API',
}
export function presetProvider(preset?: Preset): AgentSessionProvider | undefined {
  if (preset?.agent === 'ZIAFCoder') return 'codex'
  return (Object.keys(providerAgents) as AgentSessionProvider[]).find(provider => providerAgents[provider] === preset?.agent)
}
export function defaultPermissions(provider: AgentSessionProvider): string {
  return provider === 'antigravity' ? 'CLI settings' : provider === 'claude' || provider === 'api' ? 'Read & Write' : 'Workspace write'
}
export const providerPermissions: Record<AgentSessionProvider, string[]> = {
  codex: ['Read only', 'Workspace write', 'Danger full access'],
  claude: ['Read only', 'Read & Write', 'Dangerously skip permissions'],
  antigravity: ['CLI settings', 'Dangerously skip permissions'],
  api: ['Read only', 'Read & Write'],
}
export function configurationFromPreset(preset: Preset): ChatConfiguration {
  return { presetName: preset.name, provider: presetProvider(preset) || 'codex', model: preset.model || 'auto', permissions: preset.permissions, reasoningEffort: preset.reasoningEffort, apiConnectionId: preset.apiConnectionId }
}
export function configurationForProvider(provider: AgentSessionProvider): ChatConfiguration {
  return { presetName: '', provider, model: 'auto', permissions: defaultPermissions(provider), reasoningEffort: null }
}

export function permissionLabelKey(value: string): string {
  if (value === 'CLI settings') return 'cli_settings'
  if (value === 'Read & Write') return 'read_write'
  return value.toLowerCase().replace(/ /g, '_').replace(/&/g, 'and').replace(/permissions$/, 'permission')
}

