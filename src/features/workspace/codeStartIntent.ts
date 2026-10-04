import { uiText } from '../../uiText'
import type { CreateTaskConfig } from '../../../shared/legacy-ipc'

const key = 'ziaforge-code-start-intent-v1'
export type CodeStartIntent = CreateTaskConfig & { createRequestId: string; startWorkflow: true }

/** A lost Create acknowledgement must retry the saved payload, not create a new task. */
export function readCodeStartIntent(): CodeStartIntent | null {
  const text = localStorage.getItem(key)
  if (!text) return null
  if (text.length > 200000) throw new Error(uiText("Invalid saved Code start"))
  const value: unknown = JSON.parse(text)
  if (!value || typeof value !== 'object') throw new Error(uiText("Invalid saved Code start"))
  const item = value as Partial<CodeStartIntent>
  if (typeof item.createRequestId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(item.createRequestId) || item.startWorkflow !== true ||
      typeof item.name !== 'string' || typeof item.repoId !== 'string' || typeof item.description !== 'string' || item.branchType === 'Folder') {
    throw new Error(uiText("Invalid saved Code start"))
  }
  for (const value of [item.model, item.workflow, item.branchType, item.branchName, item.providerModel, item.apiConnectionId, item.permissions]) {
    if (value !== undefined && typeof value !== 'string') throw new Error(uiText("Invalid saved Code selection"))
  }
  if (item.provider !== undefined && !['codex', 'claude', 'antigravity', 'api'].includes(item.provider)) throw new Error(uiText("Invalid saved Code provider"))
  if (item.workflowOptions) {
    if (!['auto', 'manual'].includes(item.workflowOptions.advance) || typeof item.workflowOptions.review !== 'boolean') throw new Error(uiText("Invalid saved workflow options"))
    for (const role of [item.workflowOptions.reviewer, item.workflowOptions.planner, item.workflowOptions.fixer]) {
      if (!role) continue
      if (typeof role.id !== 'string' || typeof role.presetName !== 'string') throw new Error(uiText("Invalid saved workflow role"))
      if (role.configuration && (typeof role.configuration.model !== 'string' || !['codex', 'claude', 'antigravity', 'api'].includes(role.configuration.provider))) throw new Error(uiText("Invalid saved custom workflow role"))
    }
  }
  return item as CodeStartIntent
}

export function saveCodeStartIntent(value: CodeStartIntent): void {
  localStorage.setItem(key, JSON.stringify(value))
}

export function clearCodeStartIntent(requestId: string): void {
  // Another form instance must never clear a newer accepted user operation.
  if (readCodeStartIntent()?.createRequestId === requestId) localStorage.removeItem(key)
}
