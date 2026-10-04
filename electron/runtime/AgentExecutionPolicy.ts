import { isReasoningEffort } from '../../shared/agent-models'
import type { AgentSessionProvider } from '../../shared/agent-session'

/** Verified CLI flags; Codex and OpenAI-compatible APIs use extensible tokens. */
export const CLI_REASONING_EFFORTS = {
  claude: ['low', 'medium', 'high', 'xhigh', 'max'],
  antigravity: ['low', 'medium', 'high'],
} as const

export function validateReasoningEffort(provider: AgentSessionProvider, effort: unknown): void {
  if (effort === undefined || effort === null) return
  if (!isReasoningEffort(effort)) throw new Error('Invalid reasoning effort identifier')
  if ((provider === 'claude' || provider === 'antigravity') && !(CLI_REASONING_EFFORTS[provider] as readonly string[]).includes(effort)) {
    throw new Error(`${provider} CLI does not support reasoning effort ${effort}`)
  }
}

export const PERMISSION_LABELS = ['Read only', 'Workspace write', 'Read & Write', 'CLI settings', 'Danger full access', 'Dangerously skip permissions'] as const
export function isPermissionLabel(value: unknown): value is string {
  return typeof value === 'string' && (PERMISSION_LABELS as readonly string[]).includes(value)
}

/** Older sessions stored native policy fields without a display label. */
export function effectivePermissionLabel(launch: { provider?: string; permissions?: string; sandbox?: string; claudePermissionMode?: string; agyPermissionMode?: string; apiReadOnly?: boolean }): string | undefined {
  if (launch.permissions !== undefined) return launch.permissions
  const provider = launch.provider ?? 'codex'
  if (provider === 'codex') return launch.sandbox === 'read-only' ? 'Read only' : launch.sandbox === 'workspace-write' ? 'Workspace write' : launch.sandbox === 'danger-full-access' ? 'Danger full access' : undefined
  if (provider === 'claude') return launch.claudePermissionMode === 'plan' ? 'Read only' : launch.claudePermissionMode === 'bypassPermissions' ? 'Dangerously skip permissions' : launch.claudePermissionMode ? 'Read & Write' : undefined
  if (provider === 'antigravity') return launch.agyPermissionMode === 'cli-settings' ? 'CLI settings' : launch.agyPermissionMode === 'dangerously-skip' ? 'Dangerously skip permissions' : undefined
  if (provider === 'api') return launch.apiReadOnly === true ? 'Read only' : launch.apiReadOnly === false ? 'Workspace write' : undefined
}
