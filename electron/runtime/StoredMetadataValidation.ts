import { validateSpecialization } from '../../shared/specializations'
import { validatePlan } from '../workflow/WorkflowValidation'
import { validateWorkDefinition } from '../workflow/WorkTaskValidation'
import { isReasoningEffort } from '../../shared/agent-models'
import { isPermissionLabel, validateReasoningEffort } from './AgentExecutionPolicy'
import { presetProvider } from './ProviderLaunch'
import path from 'node:path'
import type { Preset, Settings, StoredRepository, StoredTask } from '../../shared/legacy-ipc'
import type { RecoveryTarget } from '../../shared/recovery'

function object(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected a saved metadata object')
}
function text(value: unknown, allowEmpty = false): asserts value is string {
  if (typeof value !== 'string' || !allowEmpty && !value.trim() || value.length > 1024 * 1024 || value.includes('\0')) throw new Error('Invalid saved text')
}
function id(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,160}$/.test(value)) throw new Error('Invalid saved identity')
}
function optionalFields(value: Record<string, unknown>, strings: string[], booleans: string[] = []): void {
  for (const key of strings) if (value[key] !== undefined) text(value[key], true)
  for (const key of booleans) if (value[key] !== undefined && typeof value[key] !== 'boolean') throw new Error('Invalid saved boolean')
}
/** Partial historical settings are valid; defaults are merged only after validation. */
export function validateSavedSettings(value: unknown): asserts value is Partial<Settings> {
  object(value)
  optionalFields(value, ['theme', 'language', 'uiLanguage', 'defaultIDE', 'autoArchive', 'soundType', 'defaultCodingPreset', 'defaultReviewPreset', 'defaultHelperPreset', 'globalWorkspacePath'], ['soundAlerts', 'desktopNotifications', 'launchAtLogin', 'preventSleep', 'useMockData', 'debugLogging', 'preferNativeClaude'])
  if (value.globalWorkspacePath !== undefined && (typeof value.globalWorkspacePath !== 'string' || !path.isAbsolute(value.globalWorkspacePath))) throw new Error('Invalid saved workspace path')
}
export function validateSavedPresets(value: unknown): asserts value is Preset[] {
  if (!Array.isArray(value) || value.length > 10000) throw new Error('Invalid saved preset list')
  const names = new Set<string>()
  for (const preset of value) {
    object(preset); text(preset.name); text(preset.agent); text(preset.model, true); text(preset.permissions, true)
    optionalFields(preset, ['apiConnectionId'])
    if (preset.reasoningEffort !== undefined && preset.reasoningEffort !== null && !isReasoningEffort(preset.reasoningEffort)) throw new Error('Invalid saved reasoning effort')
    if(preset.specialization!==undefined)validateSpecialization(preset.specialization)
    const provider = presetProvider(preset.agent)
    if (provider) validateReasoningEffort(provider, preset.reasoningEffort)
    if (names.has(preset.name)) throw new Error('Duplicate saved preset identity')
    names.add(preset.name)
  }
}
export function validateSavedRepositories(value: unknown): asserts value is StoredRepository[] {
  if (!Array.isArray(value) || value.length > 10000) throw new Error('Invalid saved repository list')
  const ids = new Set<string>()
  for (const repo of value) {
    object(repo); id(repo.id); text(repo.name)
    for (const key of ['path', 'repoPath']) { text(repo[key]); if (!path.isAbsolute(repo[key] as string)) throw new Error('Invalid saved project path') }
    for (const key of ['canonicalProjectPath', 'sourcePath']) if (repo[key] !== undefined) { text(repo[key]); if (!path.isAbsolute(repo[key] as string)) throw new Error('Invalid saved project grant') }
    if (repo.workDirectories !== undefined && (repo.kind !== 'folder' || !Array.isArray(repo.workDirectories) || repo.workDirectories.length > 200 || repo.workDirectories.some(root => typeof root !== 'string' || !path.isAbsolute(root) || root.includes('\0')))) throw new Error('Invalid saved Work directories')
    optionalFields(repo, ['currentBranch'], ['isWorkspaceMissing', 'isRepoMissing'])
    if (repo.kind !== undefined && !['git', 'folder'].includes(String(repo.kind))) throw new Error('Invalid saved project kind')
    if (repo.branches !== undefined && (!Array.isArray(repo.branches) || repo.branches.some(branch => typeof branch !== 'string'))) throw new Error('Invalid saved branches')
    if (ids.has(repo.id)) throw new Error('Duplicate saved repository identity')
    ids.add(repo.id)
  }
}
export function validateSavedTasks(value: unknown, repoId: string): asserts value is StoredTask[] {
  if (!Array.isArray(value) || value.length > 100000) throw new Error('Invalid saved task index')
  const ids = new Set<string>()
  for (const task of value) {
    object(task); id(task.id); text(task.name)
    if (task.repoId !== repoId || ids.has(task.id)) throw new Error('Saved task identity does not belong to this project or is duplicated')
    ids.add(task.id)
    if (!['idle', 'running', 'done', 'failed', 'error'].includes(String(task.status))) throw new Error('Invalid saved task status')
    if (!Array.isArray(task.logs) || task.logs.some(line => typeof line !== 'string')) throw new Error('Invalid saved task log')
    optionalFields(task, ['model', 'providerModel', 'apiConnectionId', 'description', 'workflow', 'branchType', 'branchName', 'baseBranch', 'worktreePath', 'browserUrl'], ['gitAdoptExisting'])
    if (task.codeFlowVersion !== undefined && (task.codeFlowVersion !== 1 || task.mode !== 'code')) throw new Error('Invalid saved Code workflow version')
    if (task.workFlowVersion !== undefined && (task.workFlowVersion !== 1 || task.mode !== 'work' || task.codeFlowVersion !== undefined)) throw new Error('Invalid saved Work workflow version')
    if (task.workFolderGrantId !== undefined) { id(task.workFolderGrantId); if (task.workFlowVersion !== 1) throw new Error('Invalid saved Work folder binding') }
    if (task.workStartup !== undefined) {
      object(task.workStartup)
      if (task.workFlowVersion !== 1 || Object.keys(task.workStartup).some(key => !['requestId', 'signature', 'state', 'definition'].includes(key))) throw new Error('Invalid Work startup intent')
      id(task.workStartup.requestId)
      if (typeof task.workStartup.signature !== 'string' || !/^[a-f0-9]{64}$/.test(task.workStartup.signature) || !['saved', 'started', 'failed'].includes(String(task.workStartup.state))) throw new Error('Invalid Work startup receipt')
      validateWorkDefinition(task.workStartup.definition)
    }
    if (task.startupError !== undefined) text(task.startupError)
    if (task.codeStartup !== undefined) {
      object(task.codeStartup)
      if (task.codeFlowVersion !== 1 || Object.keys(task.codeStartup).some(key => !['requestId', 'signature', 'state', 'plan'].includes(key))) throw new Error('Invalid Code startup intent')
      id(task.codeStartup.requestId)
      if (typeof task.codeStartup.signature !== 'string' || !/^[a-f0-9]{64}$/.test(task.codeStartup.signature) || !['saved', 'started', 'failed'].includes(String(task.codeStartup.state))) throw new Error('Invalid Code startup receipt')
      validatePlan(task.codeStartup.plan)
      if (!task.codeStartup.plan.codeFlow) throw new Error('Missing Code startup definition')
    }
    if (task.mode !== undefined && !['code', 'work'].includes(String(task.mode))) throw new Error('Invalid saved task mode')
    if (task.agentProvider !== undefined && !['codex', 'claude', 'antigravity', 'api'].includes(String(task.agentProvider))) throw new Error('Invalid saved task provider')
    if (task.reasoningEffort !== undefined && task.reasoningEffort !== null && !isReasoningEffort(task.reasoningEffort)) throw new Error('Invalid saved task reasoning effort')
    if (task.permissions !== undefined && !isPermissionLabel(task.permissions)) throw new Error('Invalid saved task access selection')
    if (task.agentTransport !== undefined && task.agentTransport !== 'legacy-pty') throw new Error('Invalid saved task transport')
    for (const key of ['feed', 'todoSteps', 'gitChanges']) if (task[key] !== undefined && (!Array.isArray(task[key]) || task[key].some(item => !item || typeof item !== 'object' || Array.isArray(item)))) throw new Error('Invalid saved task collection')
    if (task.terminalLogs !== undefined && (!Array.isArray(task.terminalLogs) || task.terminalLogs.some(line => typeof line !== 'string'))) throw new Error('Invalid saved terminal log')
  }
}
export function validateRecoveryTarget(value: unknown): asserts value is RecoveryTarget {
  object(value)
  if (!['settings', 'presets', 'repositories', 'tasks', 'workflow', 'session', 'session-index', 'message-queue'].includes(String(value.domain))) throw new Error('Invalid recovery domain')
  const expected = value.domain === 'message-queue' ? ['domain', 'taskId', 'sessionId'] : value.domain === 'session' ? ['domain', 'taskId', 'runId'] : value.domain === 'tasks' ? ['domain', 'repoId'] : ['workflow', 'session-index'].includes(String(value.domain)) ? ['domain', 'taskId'] : ['domain']
  if (Object.keys(value).length !== expected.length || Object.keys(value).some(key => !expected.includes(key))) throw new Error('Invalid recovery target fields')
  if (value.domain === 'tasks') id(value.repoId)
  if (value.domain === 'workflow' || value.domain === 'session' || value.domain === 'session-index' || value.domain === 'message-queue') id(value.taskId)
  if (value.domain === 'session') id(value.runId)
  if (value.domain === 'message-queue') id(value.sessionId)
}
export function validateRecoveryRequest(value: unknown): asserts value is { target: RecoveryTarget; expectedFingerprint: string; backupId: string } {
  object(value)
  if (Object.keys(value).sort().join(',') !== 'backupId,expectedFingerprint,target') throw new Error('Invalid recovery request fields')
  validateRecoveryTarget(value.target)
  for (const key of ['expectedFingerprint', 'backupId']) if (typeof value[key] !== 'string' || !/^[a-f0-9]{64}$/.test(value[key] as string)) throw new Error('Invalid recovery fingerprint')
}
