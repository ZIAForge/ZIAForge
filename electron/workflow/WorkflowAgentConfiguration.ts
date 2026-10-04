import type { AgentExecutionOptions } from '../../shared/agent-models'
import type { AgentSessionProvider } from '../../shared/agent-session'
import type { WorkflowCustomAgentConfiguration } from '../../shared/workflow'
import type { TrustedAgentSessionConfig } from '../runtime/SessionManager'
import { validateWorkflowConfiguration } from './WorkflowValidation'

export interface WorkflowAgentSelection extends AgentExecutionOptions {
  presetName?: string
  provider?: AgentSessionProvider
  model?: string
  apiConnectionId?: string
}

/** Only saved task selection or provider settings can cross this boundary. */
export function resolveWorkflowSelection(name: string | undefined, configuration: WorkflowCustomAgentConfiguration | undefined, taskSelection: () => WorkflowAgentSelection, overrides: AgentExecutionOptions = {}): WorkflowAgentSelection {
  let selection: WorkflowAgentSelection
  if (name === '@custom') {
    validateWorkflowConfiguration(configuration)
    selection = { presetName: '', ...configuration }
  } else {
    if (configuration !== undefined) throw new Error('Custom workflow configuration requires the Custom selector')
    selection = name === '@task' ? { ...taskSelection() } : { presetName: name }
  }
  // Omission inherits the selected configuration; null explicitly resets effort.
  if (overrides.reasoningEffort !== undefined) selection.reasoningEffort = overrides.reasoningEffort
  if (overrides.permissions !== undefined) selection.permissions = overrides.permissions
  return selection
}

/** Reviewers/helpers never inherit a preset's unrestricted permission policy. */
export function applyWorkflowRolePolicy(config: TrustedAgentSessionConfig, role: 'coder' | 'reviewer' | 'helper' | 'architect'): TrustedAgentSessionConfig {
  if (role === 'coder') return config
  if (role === 'architect') {
    if (config.provider !== 'claude' && config.provider !== 'api') throw new Error('The blind architect requires Claude or API with tools disabled')
    return { ...config, toolPolicy: 'none', permissions: 'Read only', ...(config.provider === 'claude' ? { claudePermissionMode: 'dontAsk' as const } : { apiReadOnly: true }) }
  }
  if (config.provider === 'antigravity') return {
    ...config, permissions: 'CLI settings', agyPermissionMode: 'cli-settings',
    launchNotice: [config.launchNotice, 'Workflow review/helper uses native CLI settings with terminal sandboxing. Antigravity does not enforce filesystem read-only access; workspace changes invalidate the result.'].filter(Boolean).join('\n'),
  }
  const restricted = { ...config, permissions: 'Read only' }
  if (config.provider === 'codex') { restricted.sandbox = 'read-only'; restricted.approvalPolicy = 'never' }
  if (config.provider === 'claude') restricted.claudePermissionMode = 'plan'
  if (config.provider === 'api') restricted.apiReadOnly = true
  return restricted
}
