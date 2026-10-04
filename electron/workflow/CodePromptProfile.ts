import fs from 'node:fs'
import { createHash } from 'node:crypto'
import type { CodePromptProfile } from '../../shared/code-flow'

const keys = new Set(['auto', 'fix-bug', 'spec-first', 'requirements-first', 'multi-model', 'planner', 'codebase-explorer', 'plan-designer', 'plan-orchestrator', 'implementer', 'review-worker', 'review-orchestrator', 'fixer'])
export function promptProfileHash(documents: Record<string, string>): string {
  return createHash('sha256').update(JSON.stringify(Object.fromEntries(Object.entries(documents).sort(([a], [b]) => a.localeCompare(b))))).digest('hex')
}
export function validateCodePromptProfile(value: unknown): asserts value is CodePromptProfile {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid local workflow prompt profile')
  const profile = value as CodePromptProfile
  if (Object.keys(profile).some(key => !['version', 'sha256', 'documents'].includes(key)) || profile.version !== 1 || !/^[a-f0-9]{64}$/.test(profile.sha256) || !profile.documents || typeof profile.documents !== 'object' || Array.isArray(profile.documents)) throw new Error('Invalid local workflow prompt profile fields')
  const entries = Object.entries(profile.documents)
  if (!entries.length || entries.length > keys.size || entries.some(([key, text]) => !keys.has(key) || typeof text !== 'string' || !text.trim() || text.includes('\0') || Buffer.byteLength(text) > 100000) || Buffer.byteLength(JSON.stringify(profile.documents)) > 512000) throw new Error('Invalid local workflow prompt documents')
  if (promptProfileHash(profile.documents) !== profile.sha256) throw new Error('Local workflow prompt profile hash does not match its documents')
}
/** Read once when a NEW task is created. Existing tasks keep their exact saved pack. */
export function loadCodePromptProfile(filename: string): CodePromptProfile | undefined {
  let descriptor: number
  try { descriptor = fs.openSync(filename, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW) }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw error }
  try {
    const stat = fs.fstatSync(descriptor)
    if (!stat.isFile() || stat.size > 520000) throw new Error('Local workflow prompt profile exceeds the size limit')
    const value: unknown = JSON.parse(fs.readFileSync(descriptor, 'utf8'))
    validateCodePromptProfile(value)
    return value
  } finally { fs.closeSync(descriptor) }
}
export function referenceInstructions(profile: CodePromptProfile | undefined, document: string): string {
  const text = profile?.documents[document]
  if (!text) return ''
  return `\nLocal workflow reference (${document}; frozen profile SHA256 ${profile.sha256}):\nThe following user-selected guide is preserved verbatim. Apply its workflow substance to THIS assigned phase using the native bindings below. Do not execute other phases or copy its suggested provider/model names over the user's selected settings.\n<workflow-reference>\n${text}\n</workflow-reference>\nNative bindings: the host owns the durable checklist, stage transitions, child sessions, permission decisions and Git operations. Guide get/create/update-plan operations mean returning the structured phase result; ask_user means status needs_input with questions. Spawn/subagent instructions describe host-owned stages, never additional nested model calls from this worker. Artifact Write/Done instructions mean returning full artifact content in the assigned structured result: the host writes and verifies it. Artifact paths come only from the supplied receipts. Do not create unassigned workflow directories, invent paths, change permissions, install skills or silently substitute providers. The output contract below and the user's actual role/access selections take precedence over conflicting tool names or output forms in this reference.\n`
}
