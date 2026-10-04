import { uiText } from '../../uiText'
import type { Preset } from '../../store'
import type { AgentSessionProvider } from '../../../shared/agent-session'

export function resolveDefaultPreset(presets: Pick<Preset, 'name'>[], preferred?: string): string {
  return presets.find(preset => preset.name === preferred)?.name || presets[0]?.name || 'auto'
}

export function isCodexSelection(selection: string, presets: Preset[], customAgent?: string): boolean {
  const agent = presets.find(preset => preset.name === selection)?.agent || customAgent
  return agent === 'Codex' || agent === 'ZIAFCoder'
}

export function structuredProvider(selection: string, presets: Preset[]): AgentSessionProvider | undefined {
  const agent = presets.find(preset => preset.name === selection)?.agent
  if (agent === 'Codex' || agent === 'ZIAFCoder') return 'codex'
  if (agent === 'Claude Code') return 'claude'
  if (agent === 'Google Antigravity') return 'antigravity'
  if (agent === 'OpenAI-compatible API') return 'api'
}

/** Resolve presets to CLI arguments instead of inferring the provider from their name. */
export function buildAgentCommand(selection: string, presets: Preset[], customAgent: string): string {
  const preset = presets.find(item => item.name === selection)
  if (preset?.reasoningEffort != null) throw new Error(uiText("Reasoning effort is unsupported in legacy terminal transport. Use a native agent chat; your draft is preserved."))
  const model = (preset ? preset.model : selection).trim()
  const agent = preset?.agent || customAgent
  const command = agent === 'Claude Code' ? 'claude' : agent === 'Codex' || agent === 'ZIAFCoder' ? 'codex' : 'agy'
  if (!model || model === 'auto') return command
  // Model input is data, including quotes and shell metacharacters.
  const quotedModel = `'${model.replace(/'/g, `'"'"'`)}'`
  return `${command} --model ${quotedModel}`
}
