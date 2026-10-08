import { translate } from '../src/i18n-core'
import { EditorService } from './editor/EditorService'
import type { WorkflowAgentRunnerOptions } from './workflow/WorkflowAgentRunner'
import { ReviewTeamStore } from './workflow/ReviewTeamStore'
import { ControlService } from './control/ControlService'
import { NativeControlRunner } from './control/NativeControlRunner'
import { UpdateService } from './control/UpdateService'
import { TelegramBot } from './control/TelegramBot'
import { runAssistantTurn } from './control/runAssistant'
import { HelpAssistantEngine } from './control/HelpAssistantEngine'
import helpGuide from '../docs/help/en.json'
import { helpSourceSha256 } from '../src/components/helpSource.generated'
import { validateSpecialization } from '../shared/specializations'
import type { ControlRequest } from '../shared/control'
import type { EditorAPI } from '../shared/editor'
import type { AgentExecutionOptions } from '../shared/agent-models'
import { app, safeStorage, BrowserWindow, ipcMain, Menu, shell, dialog, screen, type MenuItemConstructorOptions } from 'electron'
import { protectedCredentialStorage } from './runtime/CredentialStorage'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
import { execSync, execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { StringDecoder } from 'string_decoder'
import { assertAdvertisedReasoningEffort, modelCatalogDirectory, queryAgentModelCatalog, shutdownModelDiscovery } from './agentModels'
import { DiagnosticLog, formatDiagnosticText } from './runtime/DiagnosticLog'
import { assertTrustedSender, canonicalChildDirectory, isAllowedExternalUrl, isTrustedRendererUrl } from './runtime/RendererSecurity'
import type { IPty, IDisposable } from 'node-pty'
import { RunService } from './runtime/RunService'
import { SessionRegistry } from './runtime/SessionRegistry'
import { captureWorkingDirectory, WorktreeRemovalGuard } from './runtime/WorktreeRemovalGuard'
import { PtyRetirement } from './runtime/PtyRetirement'
import { prepareProviderLaunch, resolveChatSelection, shutdownProviderLaunches } from './runtime/ProviderLaunch'
import type { PersistedAgentLaunch, TrustedAgentSessionConfig } from './runtime/SessionManager'
import { validateSessionCommand } from './runtime/AgentSessionValidation'
import { findStoredTaskContext, type StoredTaskContext } from './runtime/StoredTasks'
import { prepareFolderTask, registerWorkFolder, registerSelectedWorkFolder } from './runtime/FolderWorkspace'
import { WorkInputGrants } from './runtime/WorkInputGrants'
import { RecoveryStore } from './runtime/RecoveryStore'
import { TaskChatHistory } from './runtime/TaskChatHistory'
import { validateRecoveryRequest, validateRecoveryTarget, validateSavedPresets, validateSavedRepositories, validateSavedSettings, validateSavedTasks } from './runtime/StoredMetadataValidation'
import type { RecoveryDocument, RecoveryTarget } from '../shared/recovery'
import { CODE_TEMPLATES, WORK_TEMPLATES, createWorkflowTemplate } from './workflow/WorkflowTemplates'
import { loadCodePromptProfile } from './workflow/CodePromptProfile'
import { WorkflowGitFinalizer } from './workflow/WorkflowGitFinalizer'
import { ApiProviderStore } from './api/ApiProviderStore'
import { startCliDispatcher, type DispatcherRequest } from './runtime/CliDispatcher'
import { GitService } from './git/GitService'
import { gitBranch } from './git/GitValidation'
import type { GitAPI } from '../shared/git'
import { absolutePath, authorizeProjectPath, folderName, isWithin, projectDeletionTargets, updateRepositoryList } from './runtime/ProjectAccess'
import type { AgentSessionCreateRequest, AgentSessionsAPI, AgentSessionRef } from '../shared/agent-session'
import type { WorkflowAPI, WorkflowCustomAgentConfiguration } from '../shared/workflow'
import { createWorkflowHost } from './workflow/WorkflowHost'
import { createWorkFlowHost } from './workflow/WorkTaskHost'
import type { WorkFlowAPI, WorkFlowDefinition, WorkFlowSnapshot } from '../shared/work-flow'
import { validateWorkDefinition, validateWorkCommand } from './workflow/WorkTaskValidation'
import { loadWorkPromptProfile } from './workflow/WorkPromptProfile'
import { applyWorkflowRolePolicy, resolveWorkflowSelection } from './workflow/WorkflowAgentConfiguration'
import { validatePlan, validateWorkflowCommand, validateWorkflowResponseCheckpoint, validateWorkflowDiscussionCheckpoint, workflowId } from './workflow/WorkflowValidation'
import type {
  CreateTaskConfig, Preset, ProjectFile,
  Repository, Settings, StoredRepository, StoredTask, TodoStep,
} from '../shared/legacy-ipc'

// node-pty's declaration assumes UTF-8 even when encoding:null requests raw bytes.
type RawPty = Omit<IPty, 'onData'> & { onData(listener: (data: Buffer) => void): IDisposable }
type PtyModule = Omit<typeof import('node-pty'), 'spawn'> & {
  spawn: (...args: Parameters<typeof import('node-pty').spawn>) => RawPty
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

// E2E supplies its own environment and userData directory through its bootstrap.
const isE2E = !app.isPackaged && process.env.ZIAFORGE_E2E === '1'
const primaryInstance = isE2E || app.requestSingleInstanceLock()
if (!primaryInstance) app.quit()
const headlessDispatcher = process.argv.includes('--ziaf-headless')

const require = createRequire(import.meta.url)
const pty = require('node-pty') as PtyModule
import {
  ProcessSupervisor,
  getDescendants,
  getAllowedPtyPids,
  isPidAllowed,
  findMatchingDescendantPids,
  validateCwd,
  getSystemProcessList
} from './runtime/ProcessSupervisor'

let cachedShellEnv: Record<string, string | undefined> | null = null
function getShellEnv() {
  if (isE2E) return process.env
  if (cachedShellEnv) return cachedShellEnv
  try {
    if (process.platform === 'darwin') {
      const envStr = execSync('zsh -l -c "printenv"', { shell: '/bin/zsh', timeout: 3000 }).toString()
      const lines = envStr.split('\n')
      const env: Record<string, string | undefined> = {}
      for (const line of lines) {
        const idx = line.indexOf('=')
        if (idx !== -1) {
          const key = line.substring(0, idx)
          const val = line.substring(idx + 1)
          env[key] = val
        }
      }
      cachedShellEnv = env
      return env
    }
  } catch (e: unknown) {
    logToFile(`Failed to load shell environment; using process environment: ${errorMessage(e)}`)
  }
  cachedShellEnv = process.env
  return process.env
}


const __dirname = path.dirname(fileURLToPath(import.meta.url))

const APP_ROOT = path.join(__dirname, '..')
process.env.APP_ROOT = APP_ROOT

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(APP_ROOT, 'dist')

const VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(APP_ROOT, 'public') : RENDERER_DIST
process.env.VITE_PUBLIC = VITE_PUBLIC

let win: BrowserWindow | null = null
let controlService:ControlService|undefined
let helpAssistant:HelpAssistantEngine|undefined
let nativeControlRunner:NativeControlRunner|undefined
let updateService:UpdateService|undefined
let editorHasDirtyFiles = false
const commandHandlers=new Map<string,Parameters<typeof ipcMain.handle>[1]>()
function sendAppEvent(channel:string,...args:unknown[]){controlService?.publish(channel,args[0]);if(win&&!win.isDestroyed()&&isTrustedRendererUrl(win.webContents.getURL(),path.join(RENDERER_DIST,'index.html'),VITE_DEV_SERVER_URL))win.webContents.send(channel,...args)}

function handleIpc(channel: string, listener: Parameters<typeof ipcMain.handle>[1]) {
  commandHandlers.set(channel,listener)
  ipcMain.handle(channel, (event, ...args) => {
    assertTrustedSender(event, win?.webContents, event.senderFrame?.url || '', path.join(RENDERER_DIST, 'index.html'), VITE_DEV_SERVER_URL)
    return listener(event, ...args)
  })
}

function openExternalUrl(url: unknown) {
  if (!isAllowedExternalUrl(url)) throw new Error('Only http, https and mailto links can open externally')
  return shell.openExternal(url)
}
let currentLabels: Record<string, string> | null = null
const ptySessions = new Map<string, RawPty>()
const ptyDataHistory = new Map<string, string>()
const ptySessionCwds = new Map<string, string>()
const ptySessionGenerations = new Map<string, number>()
let projectMutationInProgress = false
const taskProjectOwners = new Map<string, string>()
const ptyRetirement = new PtyRetirement<RawPty>(() => new ProcessSupervisor())
const pendingProjectPtys = ptyRetirement.entries
const worktreeRemovalGuard = new WorktreeRemovalGuard(
  taskId => getAgentSessions().reserveWorktreeRemoval(taskId),
  () => [...ptySessionCwds.values(), ...[...pendingProjectPtys.values()].map(entry => entry.cwd)],
)
function retirePty(sessionId: string, process: RawPty, cwd: string, generation: number, options = { timeoutMs: 2000, force: false }, exitCode = 0) {
  return ptyRetirement.retire({ sessionId, process, cwd, generation }, () => {
    if (ptySessions.get(sessionId) !== process || ptySessionGenerations.get(sessionId) !== generation) return
    ptySessions.delete(sessionId)
    ptySessionCwds.delete(sessionId)
    ptyDataHistory.delete(sessionId)
  }, options).then(() => {
    if (!ptySessions.has(sessionId) && ptySessionGenerations.get(sessionId) === generation && win && !win.isDestroyed()) {
      sendAppEvent(`pty-exit-${sessionId}`, { exitCode, generation })
    }
  })
}
function assertNoProjectMutation() {
  if (isQuitting) throw new Error('The application is shutting down')
  if (projectMutationInProgress) throw new Error('Project removal is in progress; try again when it finishes')
  assertStorageHealthy()
}


function logToFile(message: string) {
  try {
    const settingsDir = path.join(app.getPath('userData'))
    const settingsFile = path.join(settingsDir, 'settings.json')
    let debugLogging = true
    let workspacePath = path.join(app.getPath('home'), 'ZIAForge-Workspace')
    if (fs.existsSync(settingsFile)) {
      try {
        const s = JSON.parse(fs.readFileSync(settingsFile, 'utf-8'))
        debugLogging = s.debugLogging !== false
        if (s.globalWorkspacePath) workspacePath = s.globalWorkspacePath
      } catch (_) { /* Keep logging defaults when saved settings cannot be read. */ }
    }
    if (!debugLogging) return
    const debugDir = path.join(workspacePath, 'debug')
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true })
    }
    const logFile = path.join(debugDir, 'ziaforge-app.log')
    const safeMessage = new DiagnosticLog({ filePath: logFile }).append(message)
    try { console.log(`[MAIN LOG] ${safeMessage}`) } catch (_) { /* Logging may fail when the parent pipe has closed. */ }
  } catch (err) {
    try { console.error('Failed to write main log:', formatDiagnosticText(errorMessage(err))) } catch (_) { /* Logging may fail when the parent pipe has closed. */ }
  }
}

function getLabel(key: string, fallback: string): string {
  if (currentLabels && currentLabels[key]) {
    return currentLabels[key]
  }
  const label = translate(loadSettings().uiLanguage || 'en', key)
  return label === key ? fallback : label
}

// Simple JSON storage for mockup settings
const settingsDir = path.join(app.getPath('userData'))
const settingsFile = path.join(settingsDir, 'settings.json')
const presetsFile = path.join(settingsDir, 'presets.json')
const reposFile = path.join(settingsDir, 'repositories.json')

const settingsStore = new RecoveryStore<Partial<Settings>>({ filename: settingsFile, validate: validateSavedSettings })
const presetStore = new RecoveryStore<Preset[]>({ filename: presetsFile, validate: validateSavedPresets })
const repositoryStore = new RecoveryStore<StoredRepository[]>({ filename: reposFile, validate: validateSavedRepositories })
const recoveryErrors = new Map<string, RecoveryDocument>()
function recoveryKey(target: RecoveryTarget) { return `${target.domain}:${'repoId' in target ? target.repoId : 'taskId' in target ? target.taskId : ''}:${'runId' in target ? target.runId : 'sessionId' in target ? target.sessionId : ''}` }
function notifyRecoveryChanged() {
  if (!win || !win.isDestroyed()) sendAppEvent('recovery:changed')
}
function recordRecoveryError(target: RecoveryTarget, error: unknown) {
  const document: RecoveryDocument = { target, state: 'unavailable', fingerprint: null, backups: [], invalidBackups: 0, error: errorMessage(error) }
  const key = recoveryKey(target)
  if (JSON.stringify(recoveryErrors.get(key)) !== JSON.stringify(document)) { recoveryErrors.set(key, document); notifyRecoveryChanged() }
}
function readDocument<T>(store: RecoveryStore<T>, target: RecoveryTarget): T | null {
  try { const value = store.read(); recoveryErrors.delete(recoveryKey(target)); return value }
  catch (error) { recordRecoveryError(target, error); throw error }
}
function writeDocument<T>(store: RecoveryStore<T>, target: RecoveryTarget, value: T): void {
  try { store.write(value); recoveryErrors.delete(recoveryKey(target)) }
  catch (error) { recordRecoveryError(target, error); throw error }
}
function assertStorageHealthy() {
  readDocument(settingsStore, { domain: 'settings' })
  readDocument(presetStore, { domain: 'presets' })
  readDocument(repositoryStore, { domain: 'repositories' })
}
function taskIndexStore(repo: StoredRepository) {
  const project = authorizeProjectPath(repo.path, [repo])
  const filename = authorizeProjectPath(path.join(project, 'tasks.json'), [repo])
  if (!isWithin(project, filename, false)) throw new Error('Task metadata must remain inside its registered project')
  return new RecoveryStore<StoredTask[]>({ filename, validate: (value): asserts value is StoredTask[] => validateSavedTasks(value, repo.id) })
}
function readTaskIndex(repo: StoredRepository) { return readDocument(taskIndexStore(repo), { domain: 'tasks', repoId: repo.id }) ?? [] }
function writeTaskIndex(repo: StoredRepository, tasks: StoredTask[]) { writeDocument(taskIndexStore(repo), { domain: 'tasks', repoId: repo.id }, tasks) }
function recoveryStore(target: Exclude<RecoveryTarget, { domain: 'workflow' | 'session' | 'session-index' | 'message-queue' }>) {
  if (target.domain === 'settings') return settingsStore
  if (target.domain === 'presets') return presetStore
  if (target.domain === 'repositories') return repositoryStore
  if (target.domain !== 'tasks') throw new Error('Invalid recovery domain')
  const repo = repositoryStore.read()?.find(item => item.id === target.repoId)
  if (!repo) throw new Error('The recovery project is not registered')
  return taskIndexStore(repo)
}
async function inspectRecovery(target: RecoveryTarget): Promise<RecoveryDocument> {
  validateRecoveryTarget(target)
  if (target.domain === 'workflow') {
    const { task } = storedTaskContext(target.taskId)
    return { target, ...await (task.workFlowVersion === 1 ? getWorkFlowHost().engine : getWorkflowHost().engine).inspectRecovery(target.taskId) }
  }
  if (target.domain === 'session') {
    storedTaskContext(target.taskId)
    return { target, ...getAgentSessions().inspectRecovery(target.taskId, target.runId) }
  }
  if (target.domain === 'message-queue') {
    storedTaskContext(target.taskId)
    return { target, ...getAgentSessions().inspectQueueRecovery(target.taskId, target.sessionId) }
  }
  if (target.domain === 'session-index') {
    storedTaskContext(target.taskId)
    await getAgentSessions().listRecovery(target.taskId)
    return { target, state: 'valid', fingerprint: null, backups: [], invalidBackups: 0 }
  }
  return { target, ...recoveryStore(target).inspect() }
}
async function listRecoveryDocuments(): Promise<RecoveryDocument[]> {
  const documents = new Map<string, RecoveryDocument>()
  const inspect = async (target: RecoveryTarget) => {
    try {
      const report = await inspectRecovery(target)
      if (report.state === 'corrupt') documents.set(recoveryKey(target), report)
      else recoveryErrors.delete(recoveryKey(target))
    } catch (error) { recordRecoveryError(target, error); documents.set(recoveryKey(target), recoveryErrors.get(recoveryKey(target))!) }
  }
  for (const domain of ['settings', 'presets', 'repositories'] as const) await inspect({ domain })
  let repos: StoredRepository[] = []
  try { repos = repositoryStore.read() ?? [] } catch { /* Recover the repository index before its project files. */ }
  for (const repo of repos) {
    await inspect({ domain: 'tasks', repoId: repo.id })
    let tasks: StoredTask[]
    try { tasks = taskIndexStore(repo).read() ?? [] }
    catch { continue } // Recover the project index before inspecting its sessions.
    for (const task of tasks) {
      await inspect({ domain: 'workflow', taskId: task.id })
      try {
        for (const document of await getAgentSessions().listRecovery(task.id)) documents.set(recoveryKey(document.target), document)
      } catch (error) {
        const target: RecoveryTarget = { domain: 'session-index', taskId: task.id }
        recordRecoveryError(target, error)
        documents.set(recoveryKey(target), recoveryErrors.get(recoveryKey(target))!)
      }
    }
  }
  return [...documents.values()]
}
handleIpc('recovery:list', () => listRecoveryDocuments())
handleIpc('recovery:inspect', (_, target: unknown) => { validateRecoveryTarget(target); return inspectRecovery(target) })
handleIpc('recovery:restore', async (_, request: unknown) => {
  validateRecoveryRequest(request)
  if (isQuitting || projectMutationInProgress) throw new Error('Wait for the current application operation before recovery')
  const { target, expectedFingerprint, backupId } = request
  let receipt: { fingerprint: string; preservedFingerprint: string }
  if (target.domain === 'session-index') throw new Error('The saved session directory cannot be restored as a document. Preserve its contents and repair the reported storage layout before retrying.')
  if (target.domain === 'workflow') {
    const { task } = storedTaskContext(target.taskId)
    receipt = await (task.workFlowVersion === 1 ? getWorkFlowHost().engine : getWorkflowHost().engine).restoreRecovery(target.taskId, { expectedFingerprint, backupId })
  } else if (target.domain === 'session') {
    storedTaskContext(target.taskId)
    receipt = getAgentSessions().restoreRecovery(target.taskId, target.runId, { expectedFingerprint, backupId })
  } else if (target.domain === 'message-queue') {
    storedTaskContext(target.taskId)
    receipt = getAgentSessions().restoreQueueRecovery(target.taskId, target.sessionId, { expectedFingerprint, backupId })
  } else {
    // Restoring ownership metadata must not strand an existing task process.
    // A fresh application with no launched tasks can recover without killing anything.
    if ((target.domain === 'repositories' || target.domain === 'tasks') && (taskProjectOwners.size || ptySessions.size || pendingProjectPtys.size)) throw new Error('Restart the application and restore this index before launching task sessions')
    receipt = recoveryStore(target).restore({ expectedFingerprint, backupId })
  }
  recoveryErrors.delete(recoveryKey(target)); notifyRecoveryChanged()
  return receipt
})

let agentRunService: RunService | undefined
function getAgentSessions() {
  if (!agentRunService) {
    agentRunService = new RunService({
      sessionRegistry: new SessionRegistry(),
      processSupervisor: new ProcessSupervisor(),
      baseStorageDir: path.join(settingsDir, 'agent-sessions'),
    })
    agentRunService.sessions.onEvent(update => {
      if (!win || !win.isDestroyed()) {
        sendAppEvent('agent-session:update', update)
      }
    })
  }
  return agentRunService.sessions
}

function storedTaskContext(taskId: string): StoredTaskContext {
  const context = findStoredTaskContext(taskId, loadRepositories())
  validateSavedTasks(context.projectTasks, context.repo.id)
  return context
}

let apiProviderStore: ApiProviderStore | undefined
function getApiProviderStore() {
  if (!app.isReady()) throw new Error('API credential storage is not ready')
  return apiProviderStore ??= new ApiProviderStore({ directory: path.join(settingsDir, 'api-connections'), secrets: {
    isEncryptionAvailable: () => protectedCredentialStorage(safeStorage),
    encryptString: value => safeStorage.encryptString(value),
    decryptString: value => safeStorage.decryptString(value),
  } })
}
handleIpc('api-connections:list', () => getApiProviderStore().list())
handleIpc('api-connections:save', (_, request) => { assertNoProjectMutation(); return getApiProviderStore().save(request) })
handleIpc('api-connections:remove', (_, request) => { assertNoProjectMutation(); return getApiProviderStore().remove(request) })

let gitService: GitService | undefined
function getGitService() {
  if (!gitService) gitService = new GitService({
    directory: path.join(settingsDir, 'git'),
    env: getShellEnv,
    async resolveTask(taskId) {
      assertNoProjectMutation()
      const context = storedTaskContext(taskId)
      const { task, repo } = context
      if (task.mode === 'work' || task.branchType === 'Folder' || repo.kind === 'folder') throw new Error('Work tasks use folders without Git')
      const projectPath = authorizeProjectPath(repo.path, [repo])
      const repoPath = authorizeProjectPath(repo.repoPath, [repo])
      const worktreePath = path.join(projectPath, 'worktrees', taskId)
      const branchAt = (cwd: string) => execFileSync(process.platform === 'win32' ? 'git.exe' : 'git', ['-C', cwd, 'symbolic-ref', '--quiet', '--short', 'HEAD'], { env: getShellEnv(), encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'pipe'] }).trim()
      let changed = false
      if (!task.mode) {
        // Previous versions made a linked worktree even for their Branch label.
        if (fs.existsSync(path.join(worktreePath, '.git'))) {
          if (fs.lstatSync(worktreePath).isSymbolicLink()) throw new Error('Legacy worktree must not be a symlink')
          task.branchName = branchAt(worktreePath)
          task.branchType = 'Worktree'
          task.gitAdoptExisting = true
        }
        task.mode = 'code'; changed = true
      }
      if (!task.baseBranch) { task.baseBranch = branchAt(repoPath); changed = true }
      if (changed) writeTaskIndex(context.repo, context.projectTasks)
      return { taskId, projectPath, repoPath, worktreePath, mode: task.branchType === 'Branch' ? 'branch' : 'worktree', branch: task.branchName || taskId, baseRef: task.baseBranch, createBranch: true, adoptExisting: task.gitAdoptExisting === true }
    },
  })
  return gitService
}
async function interactiveGitMutation<T>(taskId: string, operation: () => Promise<T>): Promise<T> {
  assertNoProjectMutation()
  if (getAgentSessions().hasActiveTask(taskId) || (await getWorkflowHost().engine.get(taskId))?.status === 'running') throw new Error('Wait for the task to become idle before changing Git history')
  return operation()
}
const gitCommands: GitAPI = {
  prepare: request => getGitService().prepare(request), status: request => getGitService().status(request),
  diff: request => getGitService().diff(request), commit: request => interactiveGitMutation(request.taskId, () => getGitService().commit(request)),
  push: request => interactiveGitMutation(request.taskId, () => getGitService().push(request)), merge: request => interactiveGitMutation(request.taskId, () => getGitService().merge(request)),
  removeWorktree: request => interactiveGitMutation(request.taskId, async () => {
    // Use the Git service's persisted binding, including a previously removed
    // worktree, so retrying an existing operation can still return its receipt.
    const status = await getGitService().status({ taskId: request.taskId })
    assertNoProjectMutation()
    return worktreeRemovalGuard.run(request.taskId, status.cwd, () => getGitService().removeWorktree(request))
  }),
}
handleIpc('git:prepare', (_, request) => gitCommands.prepare(request))
handleIpc('git:status', (_, request) => gitCommands.status(request))
handleIpc('git:diff', (_, request) => gitCommands.diff(request))
handleIpc('git:commit', (_, request) => gitCommands.commit(request))
handleIpc('git:push', (_, request) => gitCommands.push(request))
handleIpc('git:merge', (_, request) => gitCommands.merge(request))
handleIpc('git:remove-worktree', (_, request) => gitCommands.removeWorktree(request))
function freezePlanSpecializations(input:import('../shared/workflow').WorkflowPlan,task:StoredTask){
  const plan=structuredClone(input),presets=loadPresets()
  const selected=(name?:string)=>presets.find(p=>p.name===(name==='@task'?task.model:name))?.specialization
  plan.coderSpecialization??=selected(plan.coderPreset);plan.reviewerSpecialization??=selected(plan.reviewerPreset)
  const freeze=(source:import('../shared/workflow').WorkflowReviewSource)=>{source.specialization??=selected(source.presetName);if(source.specialization)validateSpecialization(source.specialization)}
  for(const source of [...(plan.reviewers??[]),...(plan.helpers??[]),...(plan.reviewTeam?.reviewers??[]),...(plan.codeFlow?.multi?.explorers??[]),...(plan.codeFlow?.multi?.designers??[]),...[plan.reviewTeam?.architect,plan.codeFlow?.planner,plan.codeFlow?.fixer,plan.codeFlow?.multi?.reviewCoordinator].filter((s):s is import('../shared/workflow').WorkflowReviewSource=>!!s)])freeze(source)
  if(plan.reviewTeam){const freezeTeam=(source:import('../shared/workflow').WorkflowReviewSource)=>{const selection=resolveWorkflowSelection(source.presetName,source.configuration,()=>taskSelection(task),source);const policy=resolveChatSelection(selection.presetName,presets,loadSettings().defaultCodingPreset,selection);return {...source,presetName:'@custom',configuration:{provider:policy.provider,model:policy.model??'auto',apiConnectionId:'apiConnectionId' in policy?policy.apiConnectionId:undefined,reasoningEffort:policy.reasoningEffort,permissions:policy.permissions}}};plan.reviewTeam.reviewers=plan.reviewTeam.reviewers.map(freezeTeam);plan.reviewTeam.architect=freezeTeam(plan.reviewTeam.architect)}
  for(const step of plan.steps)step.specialization??=step.presetName?selected(step.presetName):plan.coderSpecialization
  return plan
}
function taskSelection(task: StoredTask) {
  return { presetName: task.model ?? loadSettings().defaultCodingPreset, provider: task.agentProvider, model: task.providerModel, apiConnectionId: task.apiConnectionId, reasoningEffort: task.reasoningEffort, permissions: task.permissions }
}
function workflowSelection(taskId: string, name?: string, configuration?: WorkflowCustomAgentConfiguration, overrides?: AgentExecutionOptions) {
  return resolveWorkflowSelection(name, configuration, () => taskSelection(storedTaskContext(taskId).task), overrides)
}
function trustedTaskCwd(taskId: string) {
  assertNoProjectMutation()
  const { task, repo } = storedTaskContext(taskId)
  const root = authorizeProjectPath(repo.path, [repo])
  const target = task.worktreePath || path.join(root, 'worktrees', taskId)
  if (task.workFlowVersion === 1 && task.workFolderGrantId) {
    const grant = getWorkInputGrants().folder(task.workFolderGrantId)
    if (target !== grant.path || ![repo.sourcePath, ...(repo.workDirectories ?? [])].includes(grant.path)) throw new Error('Work task folder no longer matches its saved selection')
    return authorizeProjectPath(grant.path, [repo])
  }
  if (fs.lstatSync(target).isSymbolicLink()) throw new Error('Task folder must not be a symlink')
  if (task.mode === 'code' && task.branchType === 'Branch') {
    const source = authorizeProjectPath(repo.repoPath, [repo])
    if (fs.realpathSync(target) !== source) throw new Error('Task branch path changed')
    return source
  }
  return canonicalChildDirectory(root, target)
}

async function trustedSessionConfig(request: AgentSessionCreateRequest, frozen?: PersistedAgentLaunch): Promise<TrustedAgentSessionConfig> {
  assertNoProjectMutation()
  if (loadSettings().useMockData) throw new Error('Structured sessions require a real project')
  const context = storedTaskContext(request.taskId)
  const { task, repo } = context
  taskProjectOwners.set(task.id, repo.id)
  const presetName = frozen?.presetName ?? request.presetName ?? task.model ?? loadSettings().defaultCodingPreset
  const selection = request.presetName === undefined && request.provider === undefined && request.model === undefined && request.reasoningEffort === undefined && request.permissions === undefined && request.apiConnectionId === undefined ? taskSelection(task) : { provider: request.provider, model: request.model, apiConnectionId: request.apiConnectionId, reasoningEffort: request.reasoningEffort, permissions: request.permissions }
  const policy: Omit<PersistedAgentLaunch, 'presetName'> = frozen ?? resolveChatSelection(presetName, loadPresets(), loadSettings().defaultCodingPreset, selection)
  assertAdvertisedReasoningEffort({ codex: 'Codex', claude: 'Claude Code', antigravity: 'Google Antigravity', api: 'OpenAI-compatible API' }[policy.provider], policy.model, policy.reasoningEffort)
  const env = { ...getShellEnv() }
  const launch = policy.provider === 'api' ? { apiConnection: await getApiProviderStore().resolve('apiConnectionId' in policy?policy.apiConnectionId!:'') } : await prepareProviderLaunch(policy.provider, env, { preferNativeClaude: loadSettings().preferNativeClaude, reasoningEffort: policy.reasoningEffort })
  assertNoProjectMutation()
  const current = storedTaskContext(request.taskId)
  if (current.repo.id !== repo.id || path.resolve(current.repo.path) !== path.resolve(repo.path)) throw new Error('The selected project changed during startup; try again')
  if (!frozen && JSON.stringify(policy) !== JSON.stringify(resolveChatSelection(presetName, loadPresets(), loadSettings().defaultCodingPreset, selection))) throw new Error('The selected preset changed during startup; try again')
  if (!current.task.agentProvider) current.task.agentProvider = policy.provider
  const prepared = await prepareTask(task.id, current)
  if (!prepared.success) throw new Error(prepared.error || 'Cannot prepare task folder')
  const cwd = trustedTaskCwd(task.id)
  assertWorkSessionLease(task.id, request.chatId)
  const config: TrustedAgentSessionConfig = { taskId: task.id, chatId: request.chatId, presetName: presetName!, cwd, ...launch, env, ...policy, model: policy.model ?? ('apiConnection' in launch ? launch.apiConnection.model : undefined) }
  if (request.chatId === 'chat-helper') {
    if (config.provider === 'antigravity') throw new Error('Select Codex, Claude or API for the read-only project helper')
    config.permissions = 'Read only'
    if (config.provider === 'codex') { config.sandbox = 'read-only'; config.approvalPolicy = 'never' }
    if (config.provider === 'claude') config.claudePermissionMode = 'plan'
    if (config.provider === 'api') config.apiReadOnly = true
  }
  return config
}

async function interactiveSession(ref: AgentSessionRef) {
  assertNoProjectMutation()
  const snapshot = await getAgentSessions().snapshot(ref)
  storedTaskContext(snapshot.taskId)
  if (snapshot.chatId.startsWith('wf-')) throw new Error('Use the plan controls to manage a workflow-owned session')
  return snapshot
}

function rememberMainChatSelection(snapshot: Awaited<ReturnType<AgentSessionsAPI['create']>>) {
  if (snapshot.chatId !== 'chat-main') return
  const context = storedTaskContext(snapshot.taskId)
  context.task.model = snapshot.presetName
  context.task.agentProvider = snapshot.provider
  context.task.providerModel = snapshot.model || 'auto'
  context.task.apiConnectionId = snapshot.apiConnectionId
  context.task.reasoningEffort = snapshot.reasoningEffort
  context.task.permissions = snapshot.permissions
  return writeTaskIndex(context.repo, context.projectTasks)
}

const switchRequests = new Map<string, { signature: string; settled: boolean; promise: ReturnType<AgentSessionsAPI['reconfigure']> }>()
async function reconfigureSession(request: Parameters<AgentSessionsAPI['reconfigure']>[0]) {
  validateSessionCommand('reconfigure', request)
  assertNoProjectMutation()
  const key = request.requestId ? `${request.sessionId}:${request.requestId}` : undefined
  const signature = JSON.stringify([request.sessionId, request.runId, request.presetName, request.provider, request.model, request.apiConnectionId, { reasoningEffort: request.reasoningEffort }, request.permissions])
  const cached = key && switchRequests.get(key)
  if (cached) {
    if (cached.signature !== signature) throw new Error('Switch request identity was reused with different settings')
    const snapshot = await cached.promise
    storedTaskContext(snapshot.taskId)
    return snapshot
  }
  for (const [id, value] of switchRequests) if (switchRequests.size >= 256 && value.settled) switchRequests.delete(id)
  if (switchRequests.size >= 512) throw new Error('Too many pending session changes')
  const promise = (async () => {
    const current = await interactiveSession(request)
    if (current.queue?.items.length) throw new Error('Finish or cancel queued messages before changing the session configuration')
    const config = await trustedSessionConfig({ taskId: current.taskId, chatId: current.chatId, presetName: request.presetName, model: request.model, provider: request.provider, apiConnectionId: request.apiConnectionId, reasoningEffort: request.reasoningEffort, permissions: request.permissions })
    assertWorkSessionLease(current.taskId, current.chatId)
    const snapshot = await getAgentSessions().reconfigure(request, config)
    await rememberMainChatSelection(snapshot)
    return snapshot
  })()
  if (key) {
    const entry = { signature, settled: false, promise }
    switchRequests.set(key, entry)
    void promise.finally(() => { entry.settled = true }).catch(() => {})
  }
  return promise
}

const sessionCommands: Omit<AgentSessionsAPI, 'onEvent'> = {
  async create(request) {
    validateSessionCommand('create', request)
    assertNoProjectMutation()
    if (request.chatId.startsWith('wf-')) throw new Error('Workflow sessions are created by the plan engine')
    const { task } = storedTaskContext(request.taskId)
    const presetName = request.presetName ?? task.model ?? loadSettings().defaultCodingPreset
    const sessions = getAgentSessions()
    const existing = await sessions.attach({ taskId: request.taskId, chatId: request.chatId })
    assertNoProjectMutation()
    if (existing) {
      if (existing.presetName !== presetName || (request.model !== undefined && (existing.model ?? 'auto') !== request.model) || (request.provider && existing.provider !== request.provider) || (request.apiConnectionId !== undefined && existing.apiConnectionId !== request.apiConnectionId) || (request.reasoningEffort !== undefined && existing.reasoningEffort !== request.reasoningEffort) || (request.permissions !== undefined && existing.permissions !== request.permissions)) throw new Error('Apply the new chat settings explicitly before sending')
      if (existing.sessionStatus !== 'ready') throw new Error('Resume this session before sending')
      return existing
    }
    const config = await trustedSessionConfig(request)
    assertWorkSessionLease(request.taskId, request.chatId)
    const snapshot = await sessions.create(config)
    await rememberMainChatSelection(snapshot)
    return snapshot
  },
  async resume(request) {
    validateSessionCommand('resume', request)
    const current = await interactiveSession(request)
    const sessions = getAgentSessions()
    const config = await trustedSessionConfig(current, sessions.persistedLaunch(request))
    assertWorkSessionLease(current.taskId, current.chatId)
    return sessions.resume(request, config)
  },
  async reconfigure(request) {
    return reconfigureSession(request)
  },
  async attach(request) {
    validateSessionCommand('attach', request)
    storedTaskContext(request.taskId)
    return getAgentSessions().attach(request)
  },
  async snapshot(request) {
    validateSessionCommand('snapshot', request)
    return getAgentSessions().snapshot(request)
  },
  async send(request) {
    validateSessionCommand('send', request)
    const session = await interactiveSession(request)
    assertWorkSessionLease(session.taskId, session.chatId)
    return getAgentSessions().send(request)
  },
  async queue(request) {
    validateSessionCommand('queue', request)
    const session = await interactiveSession(request)
    assertWorkSessionLease(session.taskId, session.chatId)
    return getAgentSessions().queue(request)
  },
  async setQueuePaused(request) {
    validateSessionCommand('setQueuePaused', request)
    const session = await interactiveSession(request)
    assertWorkSessionLease(session.taskId, session.chatId)
    return getAgentSessions().setQueuePaused(request)
  },
  async cancelQueued(request) {
    validateSessionCommand('cancelQueued', request)
    await interactiveSession(request)
    return getAgentSessions().cancelQueued(request)
  },
  async interrupt(request) {
    validateSessionCommand('interrupt', request)
    await interactiveSession(request)
    return getAgentSessions().interrupt(request)
  },
  async terminate(request) {
    validateSessionCommand('terminate', request)
    await interactiveSession(request)
    return getAgentSessions().terminate(request)
  },
  async resolveApproval(request) {
    validateSessionCommand('resolveApproval', request)
    return getAgentSessions().resolveApproval(request)
  },
}

handleIpc('agent-session:create', async (_, request: Parameters<AgentSessionsAPI['create']>[0]) => {
  try { return await sessionCommands.create(request) } catch (error) { notifyRecoveryChanged(); throw error }
})
handleIpc('agent-session:resume', (_, request: Parameters<AgentSessionsAPI['resume']>[0]) => sessionCommands.resume(request))
handleIpc('agent-session:reconfigure', (_, request: Parameters<AgentSessionsAPI['reconfigure']>[0]) => sessionCommands.reconfigure(request))
handleIpc('agent-session:attach', async (_, request: Parameters<AgentSessionsAPI['attach']>[0]) => {
  try { return await sessionCommands.attach(request) } catch (error) { notifyRecoveryChanged(); throw error }
})
handleIpc('agent-session:snapshot', (_, request: Parameters<AgentSessionsAPI['snapshot']>[0]) => sessionCommands.snapshot(request))
handleIpc('agent-session:send', (_, request: Parameters<AgentSessionsAPI['send']>[0]) => sessionCommands.send(request))
handleIpc('agent-session:queue', async (_, request: Parameters<AgentSessionsAPI['queue']>[0]) => {
  try { return await sessionCommands.queue(request) } catch (error) { notifyRecoveryChanged(); throw error }
})
handleIpc('agent-session:set-queue-paused', async (_, request: Parameters<AgentSessionsAPI['setQueuePaused']>[0]) => {
  try { return await sessionCommands.setQueuePaused(request) } catch (error) { notifyRecoveryChanged(); throw error }
})
handleIpc('agent-session:cancel-queued', async (_, request: Parameters<AgentSessionsAPI['cancelQueued']>[0]) => {
  try { return await sessionCommands.cancelQueued(request) } catch (error) { notifyRecoveryChanged(); throw error }
})
handleIpc('agent-session:interrupt', (_, request: Parameters<AgentSessionsAPI['interrupt']>[0]) => sessionCommands.interrupt(request))
handleIpc('agent-session:terminate', (_, request: Parameters<AgentSessionsAPI['terminate']>[0]) => sessionCommands.terminate(request))
handleIpc('agent-session:resolve-approval', (_, request: Parameters<AgentSessionsAPI['resolveApproval']>[0]) => sessionCommands.resolveApproval(request))
handleIpc('agent-media:read', (_, request: import('../shared/agent-media').AgentMediaRequest) => getAgentSessions().readMedia(request))
handleIpc('agent-media:save', async (_, request: import('../shared/agent-media').AgentMediaRequest) => {
  const media = await getAgentSessions().readMedia(request)
  const extension = media.mime === 'image/jpeg' ? 'jpg' : media.mime === 'image/webp' ? 'webp' : 'png'
  const choice = await dialog.showSaveDialog({ defaultPath: `ZIAForge-image.${extension}`, filters: [{ name: 'Image', extensions: [extension] }] })
  if (choice.canceled || !choice.filePath) return { cancelled: true }
  // Dialog selection belongs to the human; recheck current session after the dialog.
  const current = await getAgentSessions().readMedia(request)
  const handle = await fs.promises.open(choice.filePath, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK, 0o600)
  try {
    if (!(await handle.stat()).isFile()) throw new Error('Image destination must be a regular file')
    await handle.truncate(0); await handle.writeFile(current.bytes); await handle.sync()
  } finally { await handle.close() }
  return { cancelled: false }
})

let workflowHost: ReturnType<typeof createWorkflowHost> | undefined
async function resolveReportArchitectLaunch(request: Parameters<WorkflowAgentRunnerOptions['resolveLaunch']>[0], frozen?: Parameters<WorkflowAgentRunnerOptions['resolveLaunch']>[1]) {
          storedTaskContext(request.taskId)
          const selection=workflowSelection(request.taskId,request.presetName,request.configuration,request)
          const policy=frozen??resolveChatSelection(selection.presetName,loadPresets(),loadSettings().defaultCodingPreset,selection)
          if(!['claude','api'].includes(policy.provider))throw new Error('Report-only architect requires Claude or API; this CLI cannot disable all tools')
          const cwd=path.join(settingsDir,'review-architect',request.taskId,request.chatId)
          fs.mkdirSync(cwd,{recursive:true,mode:0o700})
          const env={...getShellEnv()}
          const launch=policy.provider==='api'?{apiConnection:await getApiProviderStore().resolve('apiConnectionId' in policy?policy.apiConnectionId!:'')}:await prepareProviderLaunch(policy.provider,env,{preferNativeClaude:loadSettings().preferNativeClaude,reasoningEffort:policy.reasoningEffort})
          return applyWorkflowRolePolicy({taskId:request.taskId,chatId:request.chatId,presetName:selection.presetName??'',cwd,...policy,...launch,env,toolPolicy:'none'},'architect')
}

function getWorkflowHost() {
  if (!workflowHost) {
    workflowHost = createWorkflowHost({
      directory: path.join(settingsDir, 'workflows'),
      finalize: (request, signal, onReceipt) => new WorkflowGitFinalizer({
        directory: path.join(settingsDir, 'workflow-git'), git: getGitService(),
        validateTask(taskId) { assertNoProjectMutation(); if (storedTaskContext(taskId).task.mode === 'work') throw new Error('Work folders do not use Git finalization') },
      }).run(request, signal, onReceipt),
      sessions: getAgentSessions,
      beforeLaunch: request => assertWorkSessionLease(request.taskId, request.chatId),
      env: () => ({ ...getShellEnv() }),
      validateTask(taskId) { assertNoProjectMutation(); if (storedTaskContext(taskId).task.workFlowVersion === 1) throw new Error('Use the Work workflow controls for this task') },
      workspaceMode(taskId) { return storedTaskContext(taskId).task.mode === 'work' ? 'work' : 'code' },
      taskCwd: trustedTaskCwd,
      artifactRoot(taskId) {
        const { repo } = storedTaskContext(taskId)
        const root = authorizeProjectPath(path.join(repo.path, 'artifacts', 'worktrees', taskId), [repo])
        if (!isWithin(repo.path, root, false)) throw new Error('Invalid task artifact root')
        fs.mkdirSync(root, { recursive: true })
        return root
      },
      async resolveLaunch(request, frozen) {
        if(request.role==='architect')return resolveReportArchitectLaunch(request,frozen)
        const config = await trustedSessionConfig({ ...request, ...workflowSelection(request.taskId, request.presetName, request.configuration, request) }, frozen)
        return applyWorkflowRolePolicy(config, request.role)
      },
    })
    workflowHost.engine.onEvent(snapshot => {
      if (!win || !win.isDestroyed()) {
        sendAppEvent('workflow:update', snapshot)
        const context = storedTaskContext(snapshot.taskId)
        if (context.task.codeFlowVersion === 1) {
          const steps = snapshot.plan.steps.map(step => ({ id: step.id, text: step.title, description: step.instructions, done: snapshot.steps.find(item => item.id === step.id)?.status === 'completed' }))
          const status = snapshot.status === 'running' ? 'running' : snapshot.status === 'completed' ? 'done' : snapshot.status === 'blocked' ? 'error' : 'idle'
          if (context.task.status !== status || JSON.stringify(context.task.todoSteps) !== JSON.stringify(steps)) {
            context.task.status = status; context.task.todoSteps = steps
            writeTaskIndex(context.repo, context.projectTasks)
          }
          sendAppEvent('status-update', { taskId: snapshot.taskId, status })
          sendAppEvent('task-steps-update', { taskId: snapshot.taskId, steps, progress: steps.length ? Math.round(100 * steps.filter(step => step.done).length / steps.length) : 0 })
        }
      }
    })
  }
  return workflowHost
}
const pendingWorkflowResponses = new Map<string, Promise<Awaited<ReturnType<WorkflowAPI['respond']>>>>()
let workFlowHost: ReturnType<typeof createWorkFlowHost> | undefined
const workFolderLeases = new Map<string, string>()
function assertWorkFolderIdle(cwd: string) {
  if ([...workFolderLeases.keys()].some(root => isWithin(root, cwd) || isWithin(cwd, root))) throw new Error('A Work flow is using this folder. Pause it before changing task inputs.')
  for (const task of loadAllTasks()) if (task.worktreePath && (isWithin(task.worktreePath, cwd) || isWithin(cwd, task.worktreePath)) && getAgentSessions().hasActiveTask(task.id)) throw new Error('A chat is using this folder. Wait before changing task inputs.')
}
function prepareWorkInputs(ids: string[], cwd: string) {
  try { assertWorkFolderIdle(cwd) }
  catch (error) {
    // Batch copies may share already materialized immutable inputs. This path is read-only.
    const refs = getWorkInputGrants().list(ids).map(input => ({ ...input, relativePath: path.join('.ziaf-inputs', input.id, input.name) }))
    try { getWorkInputGrants().validate(refs, cwd); return refs } catch { throw error }
  }
  return getWorkInputGrants().materialize(ids, cwd)
}
function assertWorkSessionLease(taskId: string, chatId: string) {
  const task = storedTaskContext(taskId).task
  if (!task.worktreePath) return
  const owner = [...workFolderLeases].find(([cwd]) => isWithin(cwd, task.worktreePath!) || isWithin(task.worktreePath!, cwd))?.[1]
  if (owner && (owner !== taskId || !chatId.startsWith('wf-'))) throw new Error('A Work flow is using this folder. Pause it before starting another writer.')
}
function freezeWorkDefinition(definition: WorkFlowDefinition, selectedTask: () => ReturnType<typeof taskSelection>, previous?: WorkFlowDefinition): WorkFlowDefinition {
  const frozen = structuredClone(definition)
  const roleLabels: Record<string, string> = {}
  const freeze = <T extends import('../shared/workflow').WorkflowReviewSource>(source: T, role: string, prior?: T): T => {
    const key = `${role}:${source.id}`
    const selection = resolveWorkflowSelection(source.presetName, source.configuration, selectedTask, source)
    const policy = resolveChatSelection(selection.presetName, loadPresets(), loadSettings().defaultCodingPreset, selection)
    const preset = source.presetName === '@task' ? selectedTask().presetName : source.presetName
    roleLabels[key] = preset && preset !== '@custom' ? preset : JSON.stringify(prior) === JSON.stringify(source) ? previous?.roleLabels?.[key] ?? 'Custom' : 'Custom'
    return { ...source, specialization:source.specialization??loadPresets().find(p=>p.name===preset)?.specialization, presetName: '@custom', permissions: policy.permissions, reasoningEffort: policy.reasoningEffort,
      configuration: { provider: policy.provider, model: policy.model ?? 'auto', apiConnectionId: 'apiConnectionId' in policy ? policy.apiConnectionId : undefined, permissions: policy.permissions, reasoningEffort: policy.reasoningEffort } }
  }
  frozen.executor = freeze(frozen.executor, 'executor', previous?.executor)
  frozen.reviewers = frozen.reviewers.map(source => freeze(source, 'reviewer', previous?.reviewers.find(item => item.id === source.id)))
  if(frozen.reviewTeam){
    frozen.reviewTeam.reviewers=frozen.reviewTeam.reviewers.map(source=>freeze(source,'reviewer',previous?.reviewTeam?.reviewers.find(item=>item.id===source.id)))
    frozen.reviewTeam.architect=freeze(frozen.reviewTeam.architect,'architect',previous?.reviewTeam?.architect)
    if(!['claude','api'].includes(frozen.reviewTeam.architect.configuration!.provider))throw new Error('Report-only architect requires Claude or API')
  }
  if (frozen.deep) frozen.deep.workers = frozen.deep.workers.map(source => freeze(source, 'worker', previous?.deep?.workers.find(item => item.id === source.id)))
  if (frozen.helpers) frozen.helpers = frozen.helpers.map(source => freeze(source, 'helper', previous?.helpers?.find(item => item.id === source.id)))
  frozen.roleLabels = roleLabels
  return frozen
}
function getWorkFlowHost() {
  if (!workFlowHost) {
    workFlowHost = createWorkFlowHost({
      directory: path.join(settingsDir, 'work-flows'), sessions: getAgentSessions, env: () => ({ ...getShellEnv() }), taskCwd: trustedTaskCwd,
      beforeLaunch: request => assertWorkSessionLease(request.taskId, request.chatId),
      validateTask(taskId) {
        assertNoProjectMutation()
        const { task } = storedTaskContext(taskId)
        if (task.mode !== 'work' || task.workFlowVersion !== 1) throw new Error('This is not a versioned Work task')
      },
      artifactRoot(taskId) {
        const { repo } = storedTaskContext(taskId)
        const root = authorizeProjectPath(path.join(repo.path, 'artifacts', 'worktrees', taskId), [repo])
        if (!isWithin(repo.path, root, false)) throw new Error('Invalid Work artifact root')
        fs.mkdirSync(root, { recursive: true }); return root
      },
      validateInputs(taskId, refs) {
        getWorkInputGrants().validate(refs, trustedTaskCwd(taskId))
      },
      prepareDefinition(taskId, definition, previous) {
        const task = storedTaskContext(taskId).task
        const originalProfile = previous?.promptProfile ?? task.workStartup?.definition.promptProfile
        if (JSON.stringify(originalProfile) !== JSON.stringify(definition.promptProfile)) throw new Error('Work prompt profile is frozen for this task')
        const frozen = freezeWorkDefinition(definition, () => taskSelection(task), previous ?? task.workStartup?.definition)
        frozen.inputs = prepareWorkInputs(frozen.inputs.map(input => input.id), trustedTaskCwd(taskId))
        return frozen
      },
      acquireWorkspace(taskId) {
        const cwd = trustedTaskCwd(taskId), owner = [...workFolderLeases].find(([other]) => isWithin(other, cwd) || isWithin(cwd, other))?.[1]
        if (owner) throw new Error('Another Work flow is already using this folder. Pause it or wait for it to finish.')
        for (const task of loadAllTasks()) if (task.worktreePath && (isWithin(task.worktreePath, cwd) || isWithin(cwd, task.worktreePath)) && getAgentSessions().hasActiveTask(task.id)) throw new Error('Wait for the active chat in this folder before starting Work')
        workFolderLeases.set(cwd, taskId)
        return () => { if (workFolderLeases.get(cwd) === taskId) workFolderLeases.delete(cwd) }
      },
      async resolveLaunch(request, frozen) {
        if(request.role==='architect')return resolveReportArchitectLaunch(request,frozen)
        const selection = workflowSelection(request.taskId, request.presetName, request.configuration, request)
        return applyWorkflowRolePolicy(await trustedSessionConfig({ ...request, ...selection }, frozen), request.role)
      },
    })
    workFlowHost.engine.onEvent(snapshot => {
      const context = storedTaskContext(snapshot.taskId), progress = workTaskProgress(snapshot)
      Object.assign(context.task, progress)
      writeTaskIndex(context.repo, context.projectTasks)
      if (!win || !win.isDestroyed()) {
        sendAppEvent('work-flow:update', snapshot)
        sendAppEvent('status-update', { taskId: snapshot.taskId, status: progress.status })
        sendAppEvent('task-steps-update', { taskId: snapshot.taskId, steps: progress.todoSteps, progress: progress.todoSteps.length ? Math.round(progress.todoSteps.filter(step => step.done).length * 100 / progress.todoSteps.length) : 0 })
      }
    })
  }
  return workFlowHost
}
const workCommands: Omit<WorkFlowAPI, 'onEvent'> = {
  async get(request) {
    validateWorkCommand('get', request)
    const { task } = storedTaskContext(request.taskId)
    const engine = getWorkFlowHost().engine
    const current = await engine.get(request.taskId)
    if (!current && task.workStartup) {
      const recovery = await engine.inspectRecovery(request.taskId)
      if (task.workStartup.state === 'started' || recovery.backups.length || recovery.invalidBackups) throw new Error('Saved Work progress is missing. Restore its recovery data before continuing.')
      return engine.save(request.taskId, 0, task.workStartup.definition)
    }
    return current
  },
  async save(request) {
    validateWorkCommand('save', request)
    return getWorkFlowHost().engine.save(request.taskId, request.expectedRevision, request.definition)
  },
  async start(request) {
    validateWorkCommand('start', request)
    await workCommands.get({ taskId: request.taskId })
    const result = await getWorkFlowHost().engine.start(request)
    const context = storedTaskContext(request.taskId)
    if (context.task.startupError) Reflect.deleteProperty(context.task, 'startupError')
    if (context.task.workStartup) context.task.workStartup.state = 'started'
    writeTaskIndex(context.repo, context.projectTasks)
    return result
  },
  async respond(request) { validateWorkCommand('respond', request); return getWorkFlowHost().engine.respond(request) },
  async followUp(request) { validateWorkCommand('followUp', request); return getWorkFlowHost().engine.followUp(request) },
  async pause(request) { validateWorkCommand('pause', request); return getWorkFlowHost().engine.pause(request.taskId) },
  async readArtifact(request) {
    validateWorkCommand('readArtifact', request)
    const snapshot = await getWorkFlowHost().engine.get(request.taskId)
    const receipt = snapshot?.artifacts.find(item => item.id === request.artifactId)
    if (!receipt) throw new Error('Artifact is not part of this Work task')
    return getWorkFlowHost().artifacts.read(request.taskId, receipt)
  },
  async openArtifact(request) {
    validateWorkCommand('readArtifact', request)
    const snapshot = await getWorkFlowHost().engine.get(request.taskId)
    const receipt = snapshot?.artifacts.find(item => item.id === request.artifactId)
    if (!receipt) throw new Error('Artifact is not part of this Work task')
    const filename = await getWorkFlowHost().artifacts.verifiedPath(request.taskId, receipt)
    const extension = path.extname(receipt.name).toLowerCase()
    if (!['.md', '.txt', '.csv', '.tsv', '.json', '.yaml', '.yml', '.pdf', '.docx', '.xlsx', '.pptx', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(extension)) { shell.showItemInFolder(filename); return }
    const error = await shell.openPath(filename)
    if (error) throw new Error(error)
  },
}
handleIpc('work-flow:get', (_, request: Parameters<WorkFlowAPI['get']>[0]) => workCommands.get(request))
handleIpc('work-flow:save', (_, request: Parameters<WorkFlowAPI['save']>[0]) => workCommands.save(request))
handleIpc('work-flow:start', (_, request: Parameters<WorkFlowAPI['start']>[0]) => workCommands.start(request))
handleIpc('work-flow:respond', (_, request: Parameters<WorkFlowAPI['respond']>[0]) => workCommands.respond(request))
handleIpc('work-flow:follow-up', (_, request: Parameters<WorkFlowAPI['followUp']>[0]) => workCommands.followUp(request))
handleIpc('work-flow:pause', (_, request: Parameters<WorkFlowAPI['pause']>[0]) => workCommands.pause(request))
handleIpc('work-flow:read-artifact', (_, request: Parameters<WorkFlowAPI['readArtifact']>[0]) => workCommands.readArtifact(request))
handleIpc('work-flow:open-artifact', (_, request: Parameters<WorkFlowAPI['openArtifact']>[0]) => workCommands.openArtifact(request))
const workflowCommands: Omit<WorkflowAPI, 'onEvent'> = {
  async discuss(request) {
    validateWorkflowCommand('discuss', request)
    const previous = pendingWorkflowResponses.get(request.taskId)
    const operation = (async () => {
      await previous?.catch(() => {})
      const { task } = storedTaskContext(request.taskId)
      if (task.mode === 'work') throw new Error('Code discussion is unavailable for Work tasks')
      const current = await getWorkflowHost().engine.get(request.taskId)
      if (current?.codeFlow?.discussions?.some(item => item.commandId === request.commandId)) return getWorkflowHost().engine.discuss(request)
      // Reject stale UI commands before preparing a checkout or interrupting work.
      validateWorkflowDiscussionCheckpoint(current, request)
      if (current?.status !== 'running') {
        const prepared = await prepareTask(request.taskId)
        if (!prepared.success) throw new Error(prepared.error || 'Cannot prepare task workspace')
      }
      return getWorkflowHost().engine.discuss(request)
    })()
    pendingWorkflowResponses.set(request.taskId, operation)
    try { return await operation }
    finally { if (pendingWorkflowResponses.get(request.taskId) === operation) pendingWorkflowResponses.delete(request.taskId) }
  },
  async get(request) {
    validateWorkflowCommand('get', request)
    await pendingWorkflowResponses.get(request.taskId)?.catch(() => {})
    const current = await getWorkflowHost().engine.get(request.taskId)
    const { task } = storedTaskContext(request.taskId)
    if (!current && task.codeFlowVersion === 1 && task.codeStartup) {
      const recovery = await getWorkflowHost().engine.inspectRecovery(request.taskId)
      if (task.codeStartup.state === 'started' || recovery.backups.length || recovery.invalidBackups) throw new Error('The saved Code workflow is missing. Preserve its recovery files and restore the workflow before continuing; the initial plan will not replace existing progress.')
      return getWorkflowHost().engine.save(request.taskId, 0, task.codeStartup.plan)
    }
    return current
  },
  async readArtifact(request) {
    if (!request || Object.keys(request).some(key => !['taskId', 'artifactId'].includes(key))) throw new Error('Invalid artifact request')
    workflowId(request.taskId); workflowId(request.artifactId)
    const snapshot = await getWorkflowHost().engine.get(request.taskId)
    const receipt = snapshot?.codeFlow?.artifacts.find(item => item.id === request.artifactId)
    if (!receipt) throw new Error('Artifact is not part of this task')
    return getWorkflowHost().artifacts.read(request.taskId, receipt)
  },
  async respond(request) {
    validateWorkflowCommand('respond', request)
    const previous = pendingWorkflowResponses.get(request.taskId)
    const operation = (async () => {
      await previous?.catch(() => {})
      const current = await getWorkflowHost().engine.get(request.taskId)
      if (current?.codeFlow?.responses?.some(response => response.commandId === request.commandId)) return getWorkflowHost().engine.respond(request)
      validateWorkflowResponseCheckpoint(current, request)
      if (request.action !== 'cancel') {
        const prepared = await prepareTask(request.taskId)
        if (!prepared.success) throw new Error(prepared.error || 'Cannot prepare task workspace')
      }
      return getWorkflowHost().engine.respond(request)
    })()
    pendingWorkflowResponses.set(request.taskId, operation)
    try { return await operation }
    finally { if (pendingWorkflowResponses.get(request.taskId) === operation) pendingWorkflowResponses.delete(request.taskId) }
  },
  async save(request) {
    validateWorkflowCommand('save', request)
    request={...request,plan:freezePlanSpecializations(request.plan,storedTaskContext(request.taskId).task)}
    const presets = loadPresets()
    const resolve = (name?: string, configuration?: WorkflowCustomAgentConfiguration, options: AgentExecutionOptions = {}) => {
      const selection = workflowSelection(request.taskId, name, configuration, options)
      return resolveChatSelection(selection.presetName, presets, loadSettings().defaultCodingPreset, selection)
    }
    resolve(request.plan.coderPreset, request.plan.coderConfiguration, { reasoningEffort: request.plan.coderReasoningEffort, permissions: request.plan.coderPermissions })
    for (const step of request.plan.steps) resolve(step.presetName ?? request.plan.coderPreset, step.presetName ? step.configuration : request.plan.coderConfiguration, { reasoningEffort: step.reasoningEffort !== undefined ? step.reasoningEffort : step.presetName ? undefined : request.plan.coderReasoningEffort, permissions: step.permissions ?? (step.presetName ? undefined : request.plan.coderPermissions) })
    for (const source of [...(request.plan.reviewTeam?.reviewers || []), ...[request.plan.reviewTeam?.architect].filter((s):s is import('../shared/workflow').WorkflowReviewSource=>!!s), ...(request.plan.reviewers || []), ...(request.plan.helpers || []), ...(request.plan.codeFlow?.multi?.explorers || []), ...(request.plan.codeFlow?.multi?.designers || []), ...[request.plan.codeFlow?.planner, request.plan.codeFlow?.fixer, request.plan.codeFlow?.multi?.reviewCoordinator].filter((item): item is import('../shared/workflow').WorkflowReviewSource => Boolean(item))]) resolve(source.presetName, source.configuration, { reasoningEffort: source.reasoningEffort, permissions: source.permissions })
    if (storedTaskContext(request.taskId).task.mode === 'work' && request.plan.codeFlow) throw new Error('Code workflows are unavailable for Work tasks')
    if (storedTaskContext(request.taskId).task.mode === 'work' && request.plan.git && Object.values(request.plan.git).includes('after-plan')) throw new Error('Work folders do not use Git publication')
    if (request.plan.review && !request.plan.reviewers?.length) resolve(request.plan.reviewerPreset, request.plan.reviewerConfiguration, { reasoningEffort: request.plan.reviewerReasoningEffort })
    return getWorkflowHost().engine.save(request.taskId, request.expectedRevision, request.plan)
  },
  async start(request) {
    validateWorkflowCommand('start', request)
    const saved = await workflowCommands.get({ taskId: request.taskId })
    if (saved?.plan.codeFlow) {
      if (saved.commandIds.includes(request.commandId) || saved.status === 'completed' || saved.status === 'running') return getWorkflowHost().engine.start(request.taskId, request.revision, request.commandId)
      // Reject a stale click before preparing a branch or changing task status.
      if (saved.revision !== request.revision || saved.codeFlow?.pending) throw new Error('Resolve the current workflow checkpoint before starting')
      const prepared = await prepareTask(request.taskId)
      if (!prepared.success) throw new Error(prepared.error || 'Cannot prepare task workspace')
    }
    const result = await getWorkflowHost().engine.start(request.taskId, request.revision, request.commandId)
    const { task, repo, projectTasks } = storedTaskContext(request.taskId)
    if (task.startupError) { Reflect.deleteProperty(task, 'startupError'); writeTaskIndex(repo, projectTasks) }
    return result
  },
  async pause(request) { validateWorkflowCommand('pause', request); storedTaskContext(request.taskId); return getWorkflowHost().engine.pause(request.taskId) },
}
handleIpc('workflow:get', (_, request: Parameters<WorkflowAPI['get']>[0]) => workflowCommands.get(request))
handleIpc('workflow:save', (_, request: Parameters<WorkflowAPI['save']>[0]) => workflowCommands.save(request))
handleIpc('workflow:start', (_, request: Parameters<WorkflowAPI['start']>[0]) => workflowCommands.start(request))
handleIpc('workflow:respond', (_, request: Parameters<WorkflowAPI['respond']>[0]) => workflowCommands.respond(request))
handleIpc('workflow:discuss', (_, request: Parameters<WorkflowAPI['discuss']>[0]) => workflowCommands.discuss(request))
handleIpc('workflow:read-artifact', (_, request: Parameters<WorkflowAPI['readArtifact']>[0]) => workflowCommands.readArtifact(request))
handleIpc('workflow:pause', (_, request: Parameters<WorkflowAPI['pause']>[0]) => workflowCommands.pause(request))

function loadRepositories(): StoredRepository[] {
  let repos: StoredRepository[]
  try { repos = readDocument(repositoryStore, { domain: 'repositories' }) ?? [] }
  catch { return [] } // Read-only recovery shell; the mutation gate refuses all writes.
  let grantsChanged = false
  for (const repo of repos) {
    try {
      if (!repo.canonicalProjectPath) { repo.canonicalProjectPath = fs.realpathSync(repo.path); grantsChanged = true }
      if (!repo.sourcePath) { repo.sourcePath = fs.realpathSync(repo.repoPath); grantsChanged = true }
    } catch { /* Missing projects grant no filesystem access until restored. */ }
  }
  if (grantsChanged) {
    try { assertStorageHealthy(); saveRepositories(repos) }
    catch { /* Keep a read-only view while core metadata needs recovery. */ }
  }
  return repos
}

function saveRepositories(repos: Repository[]) {
  validateSavedRepositories(repos)
  writeDocument(repositoryStore, { domain: 'repositories' }, repos)
}

const mockPresets = [
  { name: 'Google Antigravity Default', agent: 'Google Antigravity', model: 'auto', permissions: 'CLI settings' },
  { name: 'Claude Code Pro', agent: 'Claude Code', model: 'auto', permissions: 'Read & Write' },
  { name: 'Codex Default', agent: 'Codex', model: 'auto', permissions: 'Workspace write' }
]

function loadSettings(): Settings {
  const defaults: Settings = {
    theme: 'system',
    language: 'en',
    uiLanguage: 'en',
    defaultIDE: 'VSCode',
    autoArchive: 'never',
    soundAlerts: true,
    soundType: 'Doorbell',
    desktopNotifications: true,
    launchAtLogin: false,
    preventSleep: true,
    defaultCodingPreset: 'Google Antigravity Default',
    defaultReviewPreset: 'Claude Code Pro',
    useMockData: false,
    debugLogging: false,
    globalWorkspacePath: path.join(app.getPath('home'), 'ZIAForge-Workspace')
  }
  try {
    const saved = readDocument(settingsStore, { domain: 'settings' })
    if (saved?.defaultCodingPreset === 'ZIAFCoder Default') saved.defaultCodingPreset = 'Google Antigravity Default'
    return { ...defaults, ...saved }
  } catch { return defaults } // Startup UI remains available, with execution and saving blocked.
}

const taskChatHistory = new TaskChatHistory(settingsDir)
handleIpc('get-chat-history', (_, taskId) => {
  if (!loadSettings().useMockData) storedTaskContext(taskId)
  return taskChatHistory.read(taskId)
})

handleIpc('save-chat-history', (_, data) => {
  try {
    assertNoProjectMutation()
    if (!loadSettings().useMockData) storedTaskContext(data?.taskId)
    taskChatHistory.save(data?.taskId, data)
    return { success: true }
  } catch (e: unknown) {
    console.error('Failed to save chat history:', e)
    return { success: false, error: errorMessage(e) }
  }
})

function loadPresets(): Preset[] {
  try { return readDocument(presetStore, { domain: 'presets' }) ?? mockPresets }
  catch { return [] } // Never replace a damaged preset list with example presets.
}

function savePresets(presets: Preset[]) {
  assertStorageHealthy()
  writeDocument(presetStore, { domain: 'presets' }, presets)
}

function updateAboutPanel(lang: string) {

  app.setAboutPanelOptions({
    applicationName: 'ZIAForge',
    applicationVersion: JSON.parse(fs.readFileSync(path.join(APP_ROOT, 'package.json'), 'utf8')).version,
    version: JSON.parse(fs.readFileSync(path.join(APP_ROOT, 'package.json'), 'utf8')).version,
    copyright: 'Copyright © 2026 ZIAForge',
    credits: `FORGE. DON'T VIBE.\n${translate(lang, 'native.aboutCredits')}\nhttps://ziaforge.studio/\nGitHub: https://github.com/ziaforge/ziaforge`,
    website: 'https://ziaforge.studio/',
    iconPath: path.join(VITE_PUBLIC, 'app-logo.jpeg')
  })
}

function saveSettings(settings: Settings) {
  assertStorageHealthy()
  writeDocument(settingsStore, { domain: 'settings' }, settings)
}

// Mock Data Store
const mockRepos = [
  { id: '1', name: 'LeadTracker' },
  { id: '2', name: '3D Mesh Generator' },
  { id: '3', name: 'SaaS Billing Portal' },
  { id: '4', name: 'Video Upload Optimizer' },
  { id: '5', name: 'Secure Mail Client' },
  { id: '6', name: 'app.deepaudit.ai' },
  { id: '7', name: 'Customer Engagement' },
  { id: '8', name: 'Storefront CMS' },
  { id: '9', name: 'mail-campaigner' },
  { id: '10', name: 'Secure Tunnel VPN' },
  { id: '11', name: 'ZIAForge AI Engine' },
  { id: '12', name: 'Game Arcade SDK' },
  { id: '13', name: 'Voice Synthesis API' }
]


let mockTasks: StoredTask[] = [
  { id: 'task-1', repoId: '9', name: 'Review recent campaign emails', status: 'running', logs: [] as string[] },
  { id: 'task-2', repoId: '1', name: 'Setup integrations with LeadTracker API', status: 'done', logs: ['All tasks completed successfully'] as string[] },
  { id: 'task-3', repoId: '6', name: 'FIX app.deepaudit.ai vulnerabilities', status: 'idle', logs: [] as string[] },
  { id: 'task-4', repoId: '8', name: 'Storefront CMS Initial Launch', status: 'running', logs: [] as string[] },
  { id: 'task-5', repoId: '10', name: 'Configure VPN routing rules', status: 'idle', logs: [] as string[] }
]

// Register IPC handlers
handleIpc('get-repositories', () => {
  const settings = loadSettings()
  if (settings.useMockData) {
    return mockRepos
  }
  const repos = loadRepositories()
  return repos.map((repo: StoredRepository) => {
    let repoPathExists = false
    try {
      if (fs.existsSync(repo.repoPath)) {
        const stats = fs.statSync(repo.repoPath)
        repoPathExists = stats.isDirectory() || stats.isSymbolicLink()
      }
    } catch (e) {
      repoPathExists = false
    }
    return {
      ...repo,
      isWorkspaceMissing: !fs.existsSync(repo.path),
      isRepoMissing: !repoPathExists
    }
  })
})
handleIpc('save-repositories', async (_, repos) => {
  assertNoProjectMutation()
  const current = loadRepositories()
  const updated = updateRepositoryList(repos, current)
  const removed = current.filter(repo => !updated.some(candidate => candidate.id === repo.id))
  if (removed.length) await removeProjectRegistrations(removed, [], updated)
  else saveRepositories(updated)
})
handleIpc('quit-app', () => {
  app.quit()
})
handleIpc('get-presets', () => loadPresets())
handleIpc('save-presets', (_, presets) => savePresets(presets))

handleIpc('reset-database', async () => {
  try {
    assertNoProjectMutation()
    await removeProjectRegistrations(loadRepositories(), [], [])
    mockTasks = []
    savePresets(mockPresets)
    return { success: true }
  } catch (err: unknown) {
    console.error('Failed to reset database:', err)
    return { success: false, error: errorMessage(err) }
  }
})

handleIpc('restore-factory-defaults', async () => {
  try {
    assertNoProjectMutation()
    await removeProjectRegistrations(loadRepositories(), [], [])
    mockTasks = []
    // Reset application configuration only. User project files require an explicit
    // deletion command bound to a registered repository.
    // Delete configuration files
    if (fs.existsSync(reposFile)) fs.unlinkSync(reposFile)
    if (fs.existsSync(presetsFile)) fs.unlinkSync(presetsFile)
    if (fs.existsSync(settingsFile)) fs.unlinkSync(settingsFile)

    return { success: true }
  } catch (err: unknown) {
    console.error('Failed to restore factory defaults:', err)
    return { success: false, error: errorMessage(err) }
  }
})

handleIpc('spawn-pty', async (_, config: { sessionId: string, cwd: string, cols?: number, rows?: number }) => {
  try {
    assertNoProjectMutation()
    const cwdValidation = validateCwd(config?.cwd)
    if (!cwdValidation.valid) {
      logToFile(`spawn-pty error: ${cwdValidation.error}`)
      return { success: false, error: cwdValidation.error }
    }
    const targetCwd = authorizeProjectPath(cwdValidation.resolvedCwd!, loadRepositories())
    worktreeRemovalGuard.assertTerminalAvailable(targetCwd)
    const revalidateCwd = captureWorkingDirectory(targetCwd)
    if (ptySessions.has(config.sessionId)) {
      const existingCwd = ptySessionCwds.get(config.sessionId)
      if (existingCwd && existingCwd !== targetCwd) {
        logToFile(`spawn-pty: sessionId=${config.sessionId} cwd changed (${existingCwd} -> ${targetCwd}). Terminating stale session.`)
        const oldPty = ptySessions.get(config.sessionId)!
        const oldGeneration = ptySessionGenerations.get(config.sessionId) || 0
        // Keep the old cwd owned while this synchronous replacement starts a
        // new generation. Failed cleanup remains visible to removal and Quit.
        void retirePty(config.sessionId, oldPty, existingCwd, oldGeneration)
          .catch(error => logToFile(`Retired PTY cleanup failed: ${errorMessage(error)}`))
        // Advance generation immediately so any delayed events from oldPty are discarded
        const nextGen = (ptySessionGenerations.get(config.sessionId) || 0) + 1
        ptySessionGenerations.set(config.sessionId, nextGen)
      } else {
        const existingGen = ptySessionGenerations.get(config.sessionId) || 0
        logToFile(`spawn-pty: sessionId=${config.sessionId} already exists (gen=${existingGen}). Reconnecting.`)
        return { 
          success: true, 
          reconnected: true, 
          history: ptyDataHistory.get(config.sessionId) || '',
          generation: existingGen
        }
      }
    }

    const currentGen = (ptySessionGenerations.get(config.sessionId) || 0) + 1
    ptySessionGenerations.set(config.sessionId, currentGen)

    // Programmatically ensure spawn-helper has executable permissions on macOS/Linux
    if (process.platform === 'darwin' || process.platform === 'linux') {
      try {
        const nodePtyDir = path.dirname(require.resolve('node-pty/package.json'))
        const archDir = process.arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64'
        const helperPaths = [
          path.join(nodePtyDir, 'prebuilds', archDir, 'spawn-helper'),
          path.join(nodePtyDir, 'build', 'Release', 'spawn-helper'),
          path.join(nodePtyDir, 'build', 'Debug', 'spawn-helper')
        ]
        for (const hp of helperPaths) {
          if (fs.existsSync(hp)) {
            const stats = fs.statSync(hp)
            // If not executable by user (0o100)
            if ((stats.mode & 0o100) === 0) {
              fs.chmodSync(hp, 0o755)
              console.log(`Successfully made spawn-helper executable at: ${hp}`)
            }
          }
        }
      } catch (chmodErr) {
        console.error('Failed to set spawn-helper permissions:', chmodErr)
      }
    }

    let shellCmd = process.env.SHELL
    if (!shellCmd || shellCmd.trim() === '') {
      shellCmd = process.platform === 'win32'
        ? 'powershell.exe'
        : (fs.existsSync('/bin/zsh') ? '/bin/zsh' : '/bin/bash')
    }

    const env = { ...getShellEnv(), ...process.env }
    
    // Set TERM for color support
    env.TERM = 'xterm-256color'
    env.COLORTERM = 'truecolor'
    env.GODEBUG = 'netdns=cgo'

    // Fix PATH for macOS GUI applications to ensure git, node, etc. are found
    if (process.platform === 'darwin') {
      const paths = [
        '/opt/homebrew/bin',
        '/usr/local/bin',
        env.PATH
      ].filter(Boolean)
      env.PATH = paths.join(path.delimiter)
    }

    // Force UTF-8 locale environment variables
    if (!env.LANG || env.LANG === 'C' || env.LANG === 'POSIX' || env.LANG.trim() === '') {
      env.LANG = 'en_US.UTF-8'
    } else if (!env.LANG.toLowerCase().includes('utf-8') && !env.LANG.toLowerCase().includes('utf8')) {
      env.LANG = `${env.LANG.split('.')[0]}.UTF-8`
    }
    env.LC_ALL = env.LANG
    env.LC_CTYPE = env.LANG

    // Everything above is synchronous, including shell environment discovery.
    // Recheck nevertheless: external filesystem changes must never cause a
    // native spawn to use a missing/replaced directory or a provider fallback.
    if (authorizeProjectPath(config.cwd, loadRepositories()) !== targetCwd) throw new Error('Terminal project path changed before startup')
    revalidateCwd()
    worktreeRemovalGuard.assertTerminalAvailable(targetCwd)
    const ptyProcess = pty.spawn(shellCmd, [], {
      name: 'xterm-256color',
      cols: config.cols || 80,
      rows: config.rows || 24,
      cwd: targetCwd,
      env,
      encoding: null
    })

    const decoder = new StringDecoder('utf8')
    ptyProcess.onData((data: Buffer) => {
      // Guard against stale callbacks from superseded or dead processes
      if (ptySessions.get(config.sessionId) !== ptyProcess || ptySessionGenerations.get(config.sessionId) !== currentGen) {
        return
      }
      const str = decoder.write(data)
      if (str) {
        let history = ptyDataHistory.get(config.sessionId) || ''
        history += str
        // Cap the history at 200k characters to prevent memory creep
        if (history.length > 200000) {
          history = history.slice(-200000)
        }
        ptyDataHistory.set(config.sessionId, history)

        if (win) {
          sendAppEvent(`pty-data-${config.sessionId}`, str, currentGen)
        }
      }
    })

    ptyProcess.onExit(({ exitCode }: { exitCode: number, signal?: number }) => {
      // Guard against stale exit callbacks from superseded processes
      if (ptySessions.get(config.sessionId) !== ptyProcess || ptySessionGenerations.get(config.sessionId) !== currentGen) {
        return
      }
      void retirePty(config.sessionId, ptyProcess, targetCwd, currentGen, { timeoutMs: 2000, force: false }, exitCode)
        .catch(error => logToFile(`Exited PTY cleanup failed: ${errorMessage(error)}`))
    })

    ptySessions.set(config.sessionId, ptyProcess)
    ptySessionCwds.set(config.sessionId, targetCwd)
    ptyRetirement.track({ sessionId: config.sessionId, process: ptyProcess, cwd: targetCwd, generation: currentGen })
    return { success: true, generation: currentGen }
  } catch (err: unknown) {
    console.error('Failed to spawn PTY:', err)
    return { success: false, error: errorMessage(err) }
  }
})

handleIpc('write-pty', async (_, config: { sessionId: string, data: string }) => {
  if (isQuitting) return { success: false, error: 'The application is shutting down' }
  if (projectMutationInProgress) return { success: false, error: 'Project removal is in progress' }
  const ptyProcess = ptySessions.get(config.sessionId)
  if (ptyProcess) {
    try {
      ptyProcess.write(config.data)
      return { success: true }
    } catch (err: unknown) {
      return { success: false, error: errorMessage(err) }
    }
  }
  return { success: false, error: 'PTY session not found' }
})

handleIpc('resize-pty', async (_, config: { sessionId: string, cols: number, rows: number }) => {
  const ptyProcess = ptySessions.get(config.sessionId)
  if (ptyProcess) {
    try {
      ptyProcess.resize(config.cols, config.rows)
      return { success: true }
    } catch (err: unknown) {
      return { success: false, error: errorMessage(err) }
    }
  }
  return { success: false, error: 'PTY session not found' }
})

handleIpc('kill-pty', async (_, config: { sessionId: string }) => {
  const ptyProcess = ptySessions.get(config.sessionId)
  try {
    const retiring = [...pendingProjectPtys.values()].filter(entry => entry.sessionId === config.sessionId)
    if (ptyProcess) {
      const cwd = ptySessionCwds.get(config.sessionId)
      if (!cwd) throw new Error('Terminal working directory ownership is unavailable; cleanup was not verified')
      retiring.push({ sessionId: config.sessionId, process: ptyProcess, cwd, generation: ptySessionGenerations.get(config.sessionId) || 0 })
    }
    const results = await Promise.allSettled(retiring.map(entry => retirePty(entry.sessionId, entry.process, entry.cwd, entry.generation)))
    const failure = results.find(result => result.status === 'rejected')
    if (failure?.status === 'rejected') throw failure.reason
    return { success: true }
  } catch (err: unknown) {
    return { success: false, error: errorMessage(err) }
  }
})

handleIpc('get-active-processes', async (_, config: { sessionId: string }) => {
  const { sessionId } = config
  if (!sessionId) return { success: false, error: 'Session ID is empty', processes: [] }
  
  const ptyProcess = ptySessions.get(sessionId)
  if (!ptyProcess) return { success: false, error: 'PTY session not found', processes: [] }
  
  const shellPid = ptyProcess.pid
  
  try {
    const processList = getSystemProcessList()
    const descendants = getDescendants(shellPid, processList)
    return { success: true, processes: descendants }
  } catch (err: unknown) {
    console.error('[IPC] Failed to list active processes:', err)
    return { success: false, error: errorMessage(err), processes: [] }
  }
})

handleIpc('kill-process-by-pid', async (_, config: { pid: number, sessionId?: string }) => {
  const pid = Number(config?.pid)
  if (!pid || !Number.isInteger(pid) || pid <= 100) {
    return { success: false, error: `Invalid or unsafe PID: ${config?.pid}` }
  }
  
  const processList = getSystemProcessList()
  const allowedPids = getAllowedPtyPids(ptySessions, processList, {
    targetSessionId: config.sessionId,
    includeRootShells: true
  })
  if (!isPidAllowed(pid, allowedPids)) {
    console.warn(`[IPC] Refused to kill PID ${pid}: process does not belong to target ZIAForge session`)
    return { success: false, error: `Refused to kill PID ${pid}: process does not belong to target ZIAForge session.` }
  }

  console.log(`[IPC] Request to safely kill process PID: ${pid}`)
  try {
    try {
      process.kill(pid, 'SIGTERM')
    } catch (e) {
      process.kill(pid, 'SIGKILL')
    }
    console.log(`[IPC] Successfully killed process PID: ${pid}`)
    return { success: true }
  } catch (err: unknown) {
    const msg = (err as Error)?.message || String(err)
    console.error(`[IPC] Failed to kill process PID: ${pid}:`, msg)
    return { success: false, error: msg }
  }
})

handleIpc('kill-process-by-command', async (_, config: { command: string, sessionId?: string }) => {
  const { command, sessionId } = config
  if (!command || typeof command !== 'string') return { success: false, error: 'Command is empty' }
  
  console.log(`[IPC] Safe kill-process-by-command for: "${command}" in session: ${sessionId || 'any'}`)
  try {
    const processList = getSystemProcessList()
    const matchingPids = findMatchingDescendantPids(command, ptySessions, processList, sessionId)

    if (matchingPids.length === 0) {
      console.log(`[IPC] No active session processes matching command pattern "${command}" found.`)
      return { success: true, killedCount: 0 }
    }

    console.log(`[IPC] Found ${matchingPids.length} matching descendant processes to kill:`, matchingPids)
    for (const pid of matchingPids) {
      try {
        process.kill(pid, 'SIGTERM')
      } catch (e) {
        try { process.kill(pid, 'SIGKILL') } catch (e2) { /* The process may already have exited. */ }
      }
    }
    
    return { success: true, killedCount: matchingPids.length }
  } catch (err: unknown) {
    const msg = (err as Error)?.message || String(err)
    console.error('[IPC] Failed to kill process by command safely:', msg)
    return { success: false, error: msg }
  }
})

handleIpc('update-menu', (_, labels) => {
  currentLabels = labels
  createMenu()
})
handleIpc('get-settings', () => loadSettings())
handleIpc('get-app-version', () => {
  try {
    const pkgPath = path.join(APP_ROOT, 'package.json')
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
    let build: { mode?: string; source?: { commit?: string } } | undefined
    if (app.isPackaged) {
      try { build = JSON.parse(fs.readFileSync(path.join(process.resourcesPath, 'build-identity.json'), 'utf8')) } catch { /* Older packages have no build identity. */ }
    }
    const isDev = !app.isPackaged || build?.mode === 'development'
    const commit = build?.source?.commit?.slice(0, 8)
    return {
      version: pkg.version,
      isDev,
      fullVersion: `${pkg.version}-${isDev ? 'dev' : 'release'}${commit ? `.${commit}` : ''}`
    }
  } catch (e) {
    return {
      version: 'unknown',
      isDev: !app.isPackaged,
      fullVersion: 'unknown'
    }
  }
})
function loadAllTasks() {
  const allTasks: StoredTask[] = []
  for (const repo of loadRepositories()) {
    try {
      const tasks = readTaskIndex(repo)
      let changed = false
      for (const task of tasks) if (!task.worktreePath) {
        const expected = path.join(repo.path, 'worktrees', task.id)
        if (fs.existsSync(expected)) { task.worktreePath = expected; changed = true }
      }
      if (changed) { assertStorageHealthy(); writeTaskIndex(repo, tasks) }
      allTasks.push(...tasks)
    } catch (error) { recordRecoveryError({ domain: 'tasks', repoId: repo.id }, error) }
  }
  return allTasks
}

handleIpc('save-settings', (_, settings) => {
  saveSettings(settings)
  updateAboutPanel(settings.uiLanguage || 'en')
  currentLabels = null
  createMenu()
})
handleIpc('get-tasks', () => {
  const settings = loadSettings()
  if (settings.useMockData) {
    return mockTasks
  }
  return loadAllTasks()
})
handleIpc('open-external', (_, url) => {
  return openExternalUrl(url)
})

const pickedDirectories = new Set<string>()
let workInputGrants: WorkInputGrants | undefined
function getWorkInputGrants() { return workInputGrants ??= new WorkInputGrants(path.join(settingsDir, 'work-inputs')) }
handleIpc('work-folders:pick', async () => {
  assertNoProjectMutation()
  if (!win) return null
  const result = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] })
  if (result.canceled || !result.filePaths.length) return null
  const grant = getWorkInputGrants().registerFolder(result.filePaths[0], app.getPath('home'))
  return { id: grant.id, path: grant.path, name: grant.name }
})
handleIpc('work-folders:assign', (_, request: { taskId: string; grantId?: string }) => {
  const operation = taskCreation.catch(() => {}).then(async () => {
    assertNoProjectMutation()
    if (!request || Object.keys(request).some(key => !['taskId', 'grantId'].includes(key))) throw new Error('Invalid Work folder assignment')
    workflowId(request.taskId)
    if (request.grantId !== undefined) workflowId(request.grantId)
    return getWorkFlowHost().engine.withDraftWorkspace(request.taskId, snapshot => {
      const current = storedTaskContext(request.taskId)
      const release = getAgentSessions().reserveWorktreeRemoval(request.taskId)
      try {
      const grant = request.grantId ? getWorkInputGrants().folder(request.grantId) : undefined
      const cwd = grant?.path ?? prepareFolderTask(current.repo, request.taskId)
      assertWorkFolderIdle(cwd)
      getWorkInputGrants().materialize(snapshot.definition.inputs.map(input => input.id), cwd)
      if (grant && current.repo.sourcePath !== grant.path && !current.repo.workDirectories?.includes(grant.path)) {
        const repos = loadRepositories(), repo = repos.find(repo => repo.id === current.repo.id)!
        repo.workDirectories = [...(repo.workDirectories ?? []), grant.path]
        saveRepositories(repos)
      }
      Object.assign(current.task, { workFolderGrantId: grant?.id, worktreePath: cwd })
      writeTaskIndex(current.repo, current.projectTasks)
      return current.task
      } finally { release() }
    })
  })
  taskCreation = operation
  return operation
})
handleIpc('work-inputs:pick', async () => {
  assertNoProjectMutation()
  if (!win) return []
  const result = await dialog.showOpenDialog(win, { properties: ['openFile', 'multiSelections'] })
  if (result.canceled) return []
  if (result.filePaths.length > 20) throw new Error('Choose up to 20 files')
  return result.filePaths.map(file => getWorkInputGrants().importFile(file))
})
handleIpc('work-inputs:list', (_, request: { ids: string[] }) => {
  if (!request || Object.keys(request).join(',') !== 'ids') throw new Error('Invalid Work input request')
  return getWorkInputGrants().list(request.ids)
})
handleIpc('select-directory', async () => {
  if (!win) return null
  const result = await dialog.showOpenDialog(win, {
    properties: ['openDirectory', 'createDirectory']
  })
  if (result.canceled || result.filePaths.length === 0) {
    return null
  }
  const selected = fs.realpathSync(result.filePaths[0])
  pickedDirectories.add(selected)
  return selected
})

handleIpc('list-workspace-folders', () => {
  try { assertStorageHealthy() } catch { return [] }
  const settings = loadSettings()
  const workspace = settings.globalWorkspacePath || path.join(app.getPath('home'), 'ZIAForge-Workspace')
  fs.mkdirSync(workspace, { recursive: true })
  const root = fs.realpathSync(workspace)
  const repos = loadRepositories()
  return fs.readdirSync(root).filter(name => {
    if (name.startsWith('.') || ['repo', 'worktrees', 'chats', 'artifacts', 'debug'].includes(name)) return false
    const folder = path.join(root, name)
    const stat = fs.lstatSync(folder)
    if (!stat.isDirectory() || stat.isSymbolicLink()) return false
    const registered = repos.find(repo => path.resolve(repo.path) === folder)
    return registered ? registered.kind === 'folder' : !fs.existsSync(path.join(folder, 'repo')) && !fs.existsSync(path.join(folder, 'tasks.json'))
  }).sort()
})

handleIpc('create-workspace-folder', (_, name) => {
  try {
    assertNoProjectMutation()
    const safeName = folderName(name)
    const settings = loadSettings()
    const workspace = settings.globalWorkspacePath || path.join(app.getPath('home'), 'ZIAForge-Workspace')
    fs.mkdirSync(workspace, { recursive: true })
    const folderPath = path.join(fs.realpathSync(workspace), safeName)
    fs.mkdirSync(folderPath)
    return { success: true, folderPath }
  } catch (error) { return { success: false, error: errorMessage(error) } }
})

handleIpc('register-project', async (_, { repoPath, projectName }) => {
  try {
    assertNoProjectMutation()
    repoPath = fs.realpathSync(absolutePath(repoPath))
    projectName = folderName(projectName)
    if (!pickedDirectories.has(repoPath)) throw new Error('Choose the source directory in the folder picker before registering it')
    try {
      execSync('git rev-parse --is-inside-work-tree', { cwd: repoPath })
    } catch (e) {
      try {
        execSync('git init', { cwd: repoPath })
        // Create an initial empty commit so there is a default branch
        execSync('git checkout -b main', { cwd: repoPath })
        execSync('git commit --allow-empty -m "Initial commit"', {
          cwd: repoPath,
          env: {
            ...process.env,
            GIT_AUTHOR_NAME: 'ZIAForge',
            GIT_AUTHOR_EMAIL: 'ziaforge@localhost',
            GIT_COMMITTER_NAME: 'ZIAForge',
            GIT_COMMITTER_EMAIL: 'ziaforge@localhost'
          }
        })
      } catch (initErr: unknown) {
        console.error('Failed to initialize git repository:', initErr)
        throw new Error('Not a valid Git repository and failed to initialize a new one: ' + errorMessage(initErr))
      }
    }

    const settings = loadSettings()
    const globalWorkspace = settings.globalWorkspacePath || path.join(app.getPath('home'), 'ZIAForge-Workspace')
    const repos = loadRepositories()
    
    // Check if this exact repoPath is already registered
    let projectDir = ''
    let uniqueProjectName = projectName
    let existingRepo: StoredRepository | null = null

    for (const r of repos) {
      if (!r.path) continue
      const repoLink = path.join(r.path, 'repo')
      try {
        if (fs.existsSync(repoLink) && fs.realpathSync(repoLink) === fs.realpathSync(repoPath)) {
          existingRepo = r
          break
        }
      } catch (err) { /* A stale repository link is not a match. */ }
    }

    if (existingRepo) {
      projectDir = existingRepo.path
      uniqueProjectName = existingRepo.name
    } else {
      let counter = 0
      let targetDir = path.join(globalWorkspace, uniqueProjectName)
      let foundExistingMatch = false
      if (fs.existsSync(targetDir)) {
        const repoLink = path.join(targetDir, 'repo')
        try {
          if (fs.existsSync(repoLink) && fs.realpathSync(repoLink) === fs.realpathSync(repoPath)) {
            foundExistingMatch = true
          }
        } catch (e) { /* A stale repository link is not a match. */ }
      }
      if (!foundExistingMatch) {
        while (fs.existsSync(targetDir) || repos.some((r: StoredRepository) => r.name.toLowerCase() === uniqueProjectName.toLowerCase())) {
          counter++
          uniqueProjectName = `${projectName}-${counter}`
          targetDir = path.join(globalWorkspace, uniqueProjectName)
        }
      }
      projectDir = targetDir
    }

    const repoLinkDir = path.join(projectDir, 'repo')

    fs.mkdirSync(projectDir, { recursive: true })
    fs.mkdirSync(path.join(projectDir, 'worktrees'), { recursive: true })
    fs.mkdirSync(path.join(projectDir, 'chats'), { recursive: true })
    fs.mkdirSync(path.join(projectDir, 'artifacts', 'chats'), { recursive: true })
    fs.mkdirSync(path.join(projectDir, 'artifacts', 'worktrees'), { recursive: true })

    if (fs.existsSync(repoLinkDir)) {
      if (fs.realpathSync(repoLinkDir) !== repoPath) throw new Error('The project repository entry points to another directory; choose a different project name')
    } else {
      fs.symlinkSync(repoPath, repoLinkDir, 'dir')
    }

    let registeredId = ''
    const existingStoreEntry = repos.find((r: StoredRepository) => r.path === projectDir)
    if (!existingStoreEntry) {
      registeredId = `repo-${Date.now()}`
      repos.push({
        id: registeredId,
        name: uniqueProjectName,
        path: projectDir,
        repoPath: repoLinkDir,
        canonicalProjectPath: fs.realpathSync(projectDir),
        sourcePath: repoPath
      })
      saveRepositories(repos)
    } else {
      registeredId = existingStoreEntry.id
    }

    return {
      success: true,
      projectPath: projectDir,
      repoPath: repoLinkDir,
      projectName: uniqueProjectName,
      projectId: registeredId
    }
  } catch (err: unknown) {
    console.error('Failed to register project:', err)
    return { success: false, error: errorMessage(err) }
  }
})

handleIpc('read-file', async (_, { filePath }) => {
  try {
    const allowed = authorizeProjectPath(filePath, loadRepositories())
    return fs.readFileSync(allowed, 'utf-8')
  } catch (err: unknown) {
    console.error('Failed to read file:', err)
    throw err
  }
})

handleIpc('write-file', async (_, { filePath, content }) => {
  try {
    assertNoProjectMutation()
    if (typeof content !== 'string' || Buffer.byteLength(content) > 10 * 1024 * 1024) throw new Error('Invalid or oversized file content')
    filePath = authorizeProjectPath(filePath, loadRepositories())
    const parentDir = path.dirname(filePath)
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true })
    }
    fs.writeFileSync(filePath, content, 'utf-8')
    return { success: true }
  } catch (err: unknown) {
    console.error('Failed to write file:', err)
    throw err
  }
})

handleIpc('create-directory', async (_, { dirPath }) => {
  try {
    assertNoProjectMutation()
    dirPath = authorizeProjectPath(dirPath, loadRepositories())
    fs.mkdirSync(dirPath, { recursive: true })
    return { success: true }
  } catch (err: unknown) {
    console.error('Failed to create directory:', err)
    throw err
  }
})

handleIpc('query-chat-completion', () => {
  throw new Error('Select a CLI or saved API connection in a task chat. Legacy implicit gateway routing is disabled.')
})

async function modelCatalog(agent: unknown, apiConnectionId?: string) {
  assertNoProjectMutation()
  if (agent === 'OpenAI-compatible API') {
    if (!apiConnectionId) throw new Error('Select an API connection before loading its models')
    return getApiProviderStore().catalog(apiConnectionId)
  }
  if (typeof agent !== 'string' || !['Codex', 'ZIAFCoder', 'Claude Code', 'Google Antigravity'].includes(agent)) throw new Error('Unknown model catalog provider')
  const provider = agent === 'Codex' || agent === 'ZIAFCoder' ? 'codex' : agent === 'Claude Code' ? 'claude' : 'antigravity'
  const env = { ...getShellEnv() }
  try {
    const launch = await prepareProviderLaunch(provider, env, { preferNativeClaude: loadSettings().preferNativeClaude })
    assertNoProjectMutation()
    const executable = 'codexBinPath' in launch ? launch.codexBinPath : 'claudeBinPath' in launch ? launch.claudeBinPath : launch.agyBinPath
    return await queryAgentModelCatalog({ agent, executable, env, cwd: modelCatalogDirectory(app.getPath('userData')) })
  } catch (error) {
    return { agent, models: [], status: 'unavailable' as const, source: 'cli' as const, command: provider, queriedAt: Date.now(), error: formatDiagnosticText(errorMessage(error)) }
  }
}

handleIpc('get-agent-model-catalog', (_, request: { agent: string; apiConnectionId?: string }) => modelCatalog(request?.agent, request?.apiConnectionId))
handleIpc('get-agent-models', async (_, request: { agent: string }) => (await modelCatalog(request?.agent)).models.map(model => model.id))

handleIpc('get-project-branches', async (_, { repoPath }) => {
  try {
    repoPath = authorizeProjectPath(repoPath, loadRepositories())
    const output = execSync('git branch --format="%(refname:short)"', { cwd: repoPath }).toString().trim()
    return output.split('\n').filter(Boolean)
  } catch (e: unknown) {
    console.error('Failed to get branches:', e)
    return []
  }
})

function scanDir(dirPath: string, rootDir: string): ProjectFile[] {
  const list: ProjectFile[] = []
  if (!fs.existsSync(dirPath)) return list

  const files = fs.readdirSync(dirPath)
  for (const file of files) {
    if (file === 'node_modules' || file === '.git' || file === 'release' || file === 'dist' || file === 'dist-electron' || file === '.DS_Store') {
      continue
    }
    
    const fullPath = path.join(dirPath, file)
    const relPath = path.relative(rootDir, fullPath)
    const stat = fs.lstatSync(fullPath)
    if (stat.isSymbolicLink()) continue
    
    if (stat.isDirectory()) {
      list.push({
        name: file,
        path: relPath,
        isDir: true,
        children: scanDir(fullPath, rootDir)
      })
    } else {
      list.push({
        name: file,
        path: relPath,
        isDir: false,
        sizeBytes: stat.size
      })
    }
  }
  return list
}

handleIpc('write-debug-log', (_, payload: unknown) => {
  try {
    if (!payload || typeof payload !== 'object' || !('message' in payload) || typeof payload.message !== 'string') return
    const message = payload.message
    const critical = 'critical' in payload && payload.critical === true
    const settings = loadSettings()
    if (!critical && !settings.debugLogging) return
    const os = require('os')
    const workspacePath = settings.globalWorkspacePath || path.join(os.homedir(), 'ZIAForge-Workspace')
    const debugDir = path.join(workspacePath, 'debug')
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true })
    }
    const logFile = path.join(debugDir, 'ziaforge-app.log')
    const safeMessage = new DiagnosticLog({ filePath: logFile }).append(message, critical ? 'Critical' : 'Renderer')
    try { console.log(`[DEBUG LOG] ${safeMessage}`) } catch (_) { /* EPIPE safe */ }
  } catch (err) {
    try { console.error('Failed to write debug log:', formatDiagnosticText(errorMessage(err))) } catch (_) { /* EPIPE safe */ }
  }
})

handleIpc('list-project-files', async (_, { projectPath }) => {
  try {
    const allowed = authorizeProjectPath(projectPath, loadRepositories())
    return scanDir(allowed, allowed)
  } catch (e: unknown) {
    console.error('Failed to list files:', e)
    return []
  }
})

let taskCreation: Promise<unknown> = Promise.resolve()
handleIpc('create-task', (_, config: CreateTaskConfig) => {
  const operation = taskCreation.catch(() => {}).then(() => createStoredTask(config))
  taskCreation = operation
  return operation
})
handleIpc('lookup-code-start', async (_, request: { repoId: string; createRequestId: string }) => {
  if (!request || Object.keys(request).sort().join(',') !== 'createRequestId,repoId') throw new Error('Invalid Code startup lookup')
  workflowId(request.repoId); workflowId(request.createRequestId)
  // This is an observation barrier for an uncertain Create ACK. Only a null
  // result after the serialized create has settled permits a fresh UI intent.
  await taskCreation.catch(() => {})
  const repo = loadRepositories().find(item => item.id === request.repoId)
  if (!repo) throw new Error('Registered project is unavailable')
  const existing = readTaskIndex(repo).find(task => task.codeStartup?.requestId === request.createRequestId)
  return existing ? projectCodeTask(existing.id) : null
})
handleIpc('lookup-work-start', async (_, request: { createRequestId: string }) => {
  if (!request || Object.keys(request).join(',') !== 'createRequestId') throw new Error('Invalid Work startup lookup')
  workflowId(request.createRequestId)
  await taskCreation.catch(() => {})
  const task = findWorkStartup(request.createRequestId)
  return task ? projectWorkTask(task.id) : null
})
function findWorkStartup(requestId: string): StoredTask | undefined {
  // Do not swallow a damaged project index: an uncertain Create must never duplicate its task.
  for (const repo of loadRepositories().filter(repo => repo.kind === 'folder')) {
    const task = readTaskIndex(repo).find(task => task.workStartup?.requestId === requestId)
    if (task) return task
  }
}
async function createStoredTask(config: CreateTaskConfig) {
  assertNoProjectMutation()
  const settings = loadSettings()
  const repos = loadRepositories()
  if (!config || typeof config.name !== 'string' || !config.name.trim() || config.name.length > 300 || typeof config.repoId !== 'string' || (config.description !== undefined && (typeof config.description !== 'string' || config.description.length > 18000 || config.description.includes('\0')))) throw new Error('Invalid task request')
  if (config.branchType !== undefined && !['Folder', 'Worktree', 'Branch'].includes(config.branchType)) throw new Error('Invalid task workspace mode')
  const isWork = config.branchType === 'Folder'
  if (config.workOptions !== undefined) {
    if (!isWork || settings.useMockData) throw new Error('Work workflows require a real folder task')
    return createStoredWorkTask(config)
  }
  if (config.createRequestId !== undefined) workflowId(config.createRequestId)
  if (config.startWorkflow !== undefined && typeof config.startWorkflow !== 'boolean') throw new Error('Invalid workflow startup intent')
  if (config.workflowOptions !== undefined) {
    const options = config.workflowOptions
    if (!options || typeof options !== 'object' || Array.isArray(options) || Object.keys(options).some(key => !['advance', 'review', 'reviewer', 'planner', 'fixer'].includes(key)) || !['auto', 'manual'].includes(options.advance) || typeof options.review !== 'boolean') throw new Error('Invalid Code workflow options')
  }
  const createSignature = createHash('sha256').update(JSON.stringify({ name: config.name, repoId: config.repoId, model: config.model, workflow: config.workflow, branchType: config.branchType, branchName: config.branchName, description: config.description, provider: config.provider, providerModel: config.providerModel, apiConnectionId: config.apiConnectionId, reasoningEffort: config.reasoningEffort, permissions: config.permissions, startWorkflow: config.startWorkflow, workflowOptions: config.workflowOptions }, (_key, value) => value && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))) : value)).digest('hex')
  if (!isWork && !settings.useMockData && config.createRequestId && repos.some(item => item.id === config.repoId)) {
    const existing = readTaskIndex(repos.find(item => item.id === config.repoId)!).find(task => task.codeStartup?.requestId === config.createRequestId)
    if (existing) {
      if (existing.codeStartup!.signature !== createSignature) throw new Error('Task creation identity was reused with different input')
      // Returning a retained task does not replay an uncertain first invocation.
      await workflowCommands.get({ taskId: existing.id })
      return projectCodeTask(existing.id)
    }
  }
  let selectedTaskPolicy: Omit<PersistedAgentLaunch, 'presetName'> | undefined
  if (!settings.useMockData) {
    selectedTaskPolicy = resolveChatSelection(config.model ?? settings.defaultCodingPreset, loadPresets(), settings.defaultCodingPreset, { provider: config.provider, model: config.providerModel, apiConnectionId: config.apiConnectionId, reasoningEffort: config.reasoningEffort, permissions: config.permissions })
    if (!isWork && config.branchName) gitBranch(config.branchName)
    const templates: readonly string[] = isWork ? WORK_TEMPLATES : CODE_TEMPLATES
    if (config.workflow && !templates.includes(config.workflow)) throw new Error('Unknown workflow template')
  }
  let repo = repos.find((r: StoredRepository) => r.id === config.repoId)
  if (isWork && !settings.useMockData) {
    const workspace = settings.globalWorkspacePath || path.join(app.getPath('home'), 'ZIAForge-Workspace')
    repo = registerWorkFolder(workspace, config.branchName || 'Work', repos)
    if (!repos.some(item => item.id === repo!.id)) { repos.push(repo); saveRepositories(repos) }
  }
  if (settings.useMockData) {
    const newTask: StoredTask = {
      id: `task-${Date.now()}`,
      repoId: config.repoId,
      name: config.name,
      status: 'idle',
      logs: [] as string[]
    }
    mockTasks.push(newTask)
    return newTask
  }

  // Real Mode task creation
  if (!repo) {
    throw new Error(`Project with repository ID ${config.repoId} not found`)
  }

  if (!isWork && repo.kind === 'folder') throw new Error('Choose a Git repository for Code mode')
  const projectDir = authorizeProjectPath(repo.path, [repo])
  const taskId = `task-${randomUUID()}`

  const tasksFile = authorizeProjectPath(path.join(projectDir, 'tasks.json'), [repo])
  if (!isWithin(projectDir, tasksFile, false)) throw new Error('Task metadata must remain inside its registered project')

  // 1. Create task artifacts directory under projectDir/artifacts/worktrees/[task-id]
  const taskArtifactsDir = authorizeProjectPath(path.join(projectDir, 'artifacts', 'worktrees', taskId), [repo])
  if (!isWithin(projectDir, taskArtifactsDir, false)) throw new Error('Task artifacts must remain inside their registered project')
  fs.mkdirSync(taskArtifactsDir, { recursive: true })

  // 2. Write user prompt to task's user_prompt.md
  const taskPromptPath = path.join(taskArtifactsDir, 'user_prompt.md')
  const promptContent = config.description
    ? `# Task: ${config.name}\n\n${config.description}\n`
    : `# User Prompt for Project\n\nWrite project notes, credentials, guidelines, or instructions here for the AI agent to read.\n`
  fs.writeFileSync(taskPromptPath, promptContent, 'utf-8')

  // Work keeps its existing documents. New Code artifacts are produced by real phases.
  if (isWork) {
  fs.writeFileSync(
    path.join(taskArtifactsDir, 'product_requirements.md'),
    `# Product Requirements (PRD): ${config.name}\n\n${config.description || 'Describe user requirements here.'}\n`,
    'utf-8'
  )
  fs.writeFileSync(
    path.join(taskArtifactsDir, 'technical_design.md'),
    `# Technical Design (Spec): ${config.name}\n\nDescribe the technical solution, DB schemas, and API design here.\n`,
    'utf-8'
  )
  fs.writeFileSync(
    path.join(taskArtifactsDir, 'execution_plan.md'),
    `# Execution Plan: ${config.name}\n\n- [ ] Initial Task Setup\n- [ ] Architecture & Implementation\n- [ ] Verification & Tests\n`,
    'utf-8'
  )
  fs.writeFileSync(
    path.join(taskArtifactsDir, 'context_memory.md'),
    `# Context Memory\n\nAI agent notes will be stored here.\n`,
    'utf-8'
  )

  }

  const initialTaskState = {
    taskId,
    status: 'idle',
    progress: 0,
    steps: isWork ? [
      { id: 's1', text: 'Initial Task Setup', done: false, description: 'Prepare directories and requirements' },
      { id: 's2', text: 'Architecture & Implementation', done: false, description: 'Write code according to spec' },
      { id: 's3', text: 'Verification & Tests', done: false, description: 'Run automated checks and tests' }
    ] : []
  }
  if (isWork) fs.writeFileSync(
    path.join(taskArtifactsDir, 'task_state.json'),
    JSON.stringify(initialTaskState, null, 2),
    'utf-8'
  )

  const newTask: StoredTask = {
    id: taskId,
    repoId: repo.id,
    name: config.name,
    mode: isWork ? 'work' : 'code',
    providerModel: selectedTaskPolicy ? selectedTaskPolicy.model ?? 'auto' : config.providerModel, apiConnectionId: selectedTaskPolicy?.apiConnectionId ?? config.apiConnectionId, reasoningEffort: selectedTaskPolicy ? selectedTaskPolicy.reasoningEffort : config.reasoningEffort, permissions: selectedTaskPolicy?.permissions ?? config.permissions,
    description: config.description || config.name,
    model: config.model ?? loadSettings().defaultCodingPreset ?? '',
    agentProvider: selectedTaskPolicy?.provider ?? config.provider ?? (() => {
      const agent = loadPresets().find(preset => preset.name === (config.model || settings.defaultCodingPreset))?.agent
      return agent === 'Codex' || agent === 'ZIAFCoder' ? 'codex' : agent === 'Claude Code' ? 'claude' : agent === 'Google Antigravity' ? 'antigravity' : undefined
    })(),
    workflow: config.workflow || 'Auto',
    branchType: config.branchType || 'Worktree',
    branchName: config.branchName || taskId,
    worktreePath: config.branchType === 'Branch' ? authorizeProjectPath(repo.repoPath, [repo]) : path.join(projectDir, 'worktrees', taskId),
    status: 'idle',
    logs: [] as string[],
    todoSteps: initialTaskState.steps,
    gitChanges: []
  }

  const presets = loadPresets()
  const reviewer = presets.find(item => item.name === settings.defaultReviewPreset && ['Codex', 'Claude Code', 'ZIAFCoder', 'Google Antigravity', 'OpenAI-compatible API'].includes(item.agent)) ?? presets.find(item => ['Codex', 'Claude Code', 'ZIAFCoder', 'Google Antigravity', 'OpenAI-compatible API'].includes(item.agent))
  {
    let verification: import('../shared/workflow').VerificationCommand | undefined
    if (!isWork) {
      try {
        const filename = authorizeProjectPath(path.join(repo.repoPath, 'package.json'), [repo])
        const pkg = JSON.parse(fs.readFileSync(filename, 'utf8'))
        if (typeof pkg.scripts?.test === 'string' && !pkg.scripts.test.includes('no test specified')) verification = { executable: 'npm', args: ['test'], timeoutMs: 120000 }
      } catch { /* No inferred check; the independent reviewer remains required. */ }
    }
    const plan = createWorkflowTemplate({ title: newTask.name, description: newTask.description || newTask.name, mode: isWork ? 'work' : 'code', template: config.workflow || (isWork ? 'Auto-Pilot' : 'Auto'), coderPreset: '@task', reviewerPreset: reviewer?.name || '@task', verification })
    if (plan.codeFlow) plan.codeFlow.promptProfile = loadCodePromptProfile(path.join(settingsDir, 'code-workflow-prompts.json'))
    if (isWork && !reviewer) { plan.review = false; delete plan.reviewerPreset }
    if (!isWork) {
      if (!plan.codeFlow) throw new Error('Code workflow definition is missing')
      const options = config.workflowOptions
      plan.advance = options?.advance ?? 'manual'
      plan.review = options?.review ?? true
      if (options?.reviewer) {
        plan.reviewerPreset = options.reviewer.presetName
        plan.reviewerConfiguration = options.reviewer.configuration
        plan.reviewerReasoningEffort = options.reviewer.reasoningEffort
      }
      plan.codeFlow.planner = options?.planner
      plan.codeFlow.fixer = options?.fixer
      validatePlan(plan)
      Object.assign(newTask, { codeFlowVersion: 1, codeStartup: { requestId: config.createRequestId ?? `create-${randomUUID()}`, signature: createSignature, state: 'saved', plan:freezePlanSpecializations(plan,newTask) } })
      newTask.todoSteps = plan.steps.map(step => ({ id: step.id, text: step.title, done: false, description: step.instructions }))
    }
    // Persist the complete startup intent first. A failed workflow save is
    // recoverable from this initial definition, without a duplicate task/send.
    const projectTasks = readTaskIndex(repo)
    projectTasks.push(newTask)
    writeTaskIndex(repo, projectTasks)
    if (isWork) await getWorkflowHost().engine.save(taskId, 0, plan)
    else {
      try {
        await workflowCommands.save({ taskId, expectedRevision: 0, plan })
        if (config.startWorkflow) {
          const saved = await getWorkflowHost().engine.get(taskId)
          await workflowCommands.start({ taskId, revision: saved!.revision, commandId: `initial-${taskId}` })
          const current = storedTaskContext(taskId)
          current.task.codeStartup!.state = 'started'
          writeTaskIndex(current.repo, current.projectTasks)
        }
      } catch (error) {
        const current = storedTaskContext(taskId)
        current.task.codeStartup!.state = 'failed'
        current.task.status = 'error'
        Object.assign(current.task, { startupError: errorMessage(error) })
        writeTaskIndex(current.repo, current.projectTasks)
      }
      return projectCodeTask(taskId)
    }
  }
  return newTask
}

async function projectCodeTask(taskId: string): Promise<StoredTask> {
  const { task } = storedTaskContext(taskId)
  const snapshot = await getWorkflowHost().engine.get(taskId)
  if (!snapshot || task.codeFlowVersion !== 1) return task
  return { ...task, status: snapshot.status === 'running' ? 'running' : snapshot.status === 'completed' ? 'done' : snapshot.status === 'blocked' || task.startupError ? 'error' : 'idle',
    todoSteps: snapshot.plan.steps.map(step => ({ id: step.id, text: step.title, description: step.instructions, done: snapshot.steps.find(item => item.id === step.id)?.status === 'completed' })) }
}

async function createStoredWorkTask(config: CreateTaskConfig): Promise<StoredTask> {
  const options = config.workOptions!
  if (!options || typeof options !== 'object' || Array.isArray(options) || Object.keys(options).some(key => !['kind', 'advance', 'review', 'reviewers', 'deep', 'inputIds', 'folderGrantId'].includes(key))) throw new Error('Invalid Work creation options')
  workflowId(config.createRequestId)
  if (typeof config.startWorkflow !== 'boolean') throw new Error('Work creation requires a saved Start or Draft intent')
  const signature = createHash('sha256').update(JSON.stringify(config, (_key, value) => value && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))) : value)).digest('hex')
  const existing = findWorkStartup(config.createRequestId)
  if (existing) {
    if (existing.workStartup!.signature !== signature) throw new Error('Work creation identity was reused with different input')
    await workCommands.get({ taskId: existing.id })
    return projectWorkTask(existing.id)
  }
  const settings = loadSettings(), presets = loadPresets(), repositories = loadRepositories()
  const policy = resolveChatSelection(config.model ?? settings.defaultCodingPreset, presets, settings.defaultCodingPreset, { provider: config.provider, model: config.providerModel, apiConnectionId: config.apiConnectionId, reasoningEffort: config.reasoningEffort, permissions: config.permissions })
  const inputs = getWorkInputGrants().list(options.inputIds)
  let definition: WorkFlowDefinition = {
    version: 1, kind: options.kind, request: config.description?.trim() || config.name, advance: options.advance, review: options.review,
    executor: { id: 'executor', presetName: '@custom', configuration: { provider: policy.provider, model: policy.model ?? 'auto', apiConnectionId: 'apiConnectionId' in policy ? policy.apiConnectionId : undefined, permissions: policy.permissions, reasoningEffort: policy.reasoningEffort } },
    reviewers: options.reviewers, deep: options.deep, inputs,
    limits: { maxTurns: 50, maxFailures: 3, maxFollowUps: 10 },
    promptProfile: loadWorkPromptProfile(path.join(settingsDir, 'work-workflow-prompts.json')),
  }
  validateWorkDefinition(definition)
  // Every selected role is pinned now, so a later preset edit cannot change the next round.
  definition = freezeWorkDefinition(definition, () => ({ presetName: config.model ?? settings.defaultCodingPreset, provider: policy.provider, model: policy.model, apiConnectionId: 'apiConnectionId' in policy ? policy.apiConnectionId : undefined, permissions: policy.permissions, reasoningEffort: policy.reasoningEffort }))
  if (config.model) definition.roleLabels!['executor:executor'] = config.model
  const workspace = settings.globalWorkspacePath || path.join(app.getPath('home'), 'ZIAForge-Workspace')
  const grant = options.folderGrantId ? getWorkInputGrants().folder(options.folderGrantId) : undefined
  const repo = grant ? registerSelectedWorkFolder(workspace, grant, repositories) : registerWorkFolder(workspace, config.branchName || 'Work', repositories)
  if (!repositories.some(item => item.id === repo.id)) { repositories.push(repo); saveRepositories(repositories) }
  const taskId = `work-${config.createRequestId}`
  workflowId(taskId)
  const cwd = grant?.path ?? prepareFolderTask(repo, taskId)
  definition.inputs = prepareWorkInputs(options.inputIds, cwd)
  const task: StoredTask = { id: taskId, repoId: repo.id, name: config.name, mode: 'work', branchType: 'Folder', branchName: repo.name,
    model: config.model ?? settings.defaultCodingPreset, agentProvider: policy.provider, providerModel: policy.model ?? 'auto', apiConnectionId: 'apiConnectionId' in policy ? policy.apiConnectionId : undefined,
    reasoningEffort: policy.reasoningEffort, permissions: policy.permissions, description: definition.request, workflow: definition.kind, worktreePath: cwd,
    status: 'idle', logs: [], todoSteps: [], gitChanges: [], workFlowVersion: 1, workFolderGrantId: grant?.id,
    workStartup: { requestId: config.createRequestId, signature, state: 'saved', definition } }
  const tasks = readTaskIndex(repo)
  if (tasks.some(item => item.id === taskId)) throw new Error('Work task identity already exists without a matching receipt')
  tasks.push(task); writeTaskIndex(repo, tasks)
  try {
    const saved = await workCommands.save({ taskId, expectedRevision: 0, definition })
    if (config.startWorkflow) {
      await workCommands.start({ taskId, revision: saved.revision, commandId: `initial-${taskId}` })
      const current = storedTaskContext(taskId)
      current.task.workStartup!.state = 'started'; writeTaskIndex(current.repo, current.projectTasks)
    }
  } catch (error) {
    const current = storedTaskContext(taskId)
    current.task.workStartup!.state = 'failed'; current.task.status = 'error'; Object.assign(current.task, { startupError: errorMessage(error) })
    writeTaskIndex(current.repo, current.projectTasks)
  }
  return projectWorkTask(taskId)
}
function workTaskProgress(snapshot: WorkFlowSnapshot) {
  return { status: snapshot.status === 'running' ? 'running' as const : snapshot.status === 'completed' ? 'done' as const : snapshot.status === 'blocked' ? 'error' as const : 'idle' as const,
    todoSteps: (snapshot.plan ?? []).map(step => ({ id: step.id, text: step.title, description: step.instructions, done: step.status === 'completed' })) }
}
async function projectWorkTask(taskId: string): Promise<StoredTask> {
  const { task } = storedTaskContext(taskId)
  const snapshot = await getWorkFlowHost().engine.get(taskId)
  return snapshot ? { ...task, ...workTaskProgress(snapshot), ...(task.startupError ? { status: 'error' as const } : {}) } : task
}

/** Hold task/process ownership until both disk deletion and saved grants have changed. */
async function removeProjectRegistrations(removed: StoredRepository[], targets: string[], updated: StoredRepository[]) {
  assertNoProjectMutation()
  const ids = new Set(removed.map(repo => repo.id))
  const taskIds = new Set([...taskProjectOwners].filter(([, repoId]) => ids.has(repoId)).map(([taskId]) => taskId))
  const roots = removed.flatMap(repo => [repo.canonicalProjectPath, repo.sourcePath, ...(repo.workDirectories ?? [])].filter((root): root is string => Boolean(root)))
  for (const repo of removed) {
    const tasksFile = path.join(repo.path, 'tasks.json')
    if (!fs.existsSync(tasksFile)) continue
    const parsed = readTaskIndex(repo)
    for (const task of parsed) if (task && typeof task.id === 'string' && /^[A-Za-z0-9_-]{1,160}$/.test(task.id) && task.repoId === repo.id) taskIds.add(task.id)
  }
  const removal = getAgentSessions().beginTaskRemoval([...taskIds])
  const gitRemoval = gitService?.beginTaskRemoval([...taskIds])
  projectMutationInProgress = true
  try {
    await gitRemoval?.finished
    await workflowHost?.engine.stopTasks([...taskIds])
    await workFlowHost?.engine.stopTasks([...taskIds])
    for (const taskId of taskIds) { watchers.get(taskId)?.close(); watchers.delete(taskId) }
    const ownedPtys = new Map([...pendingProjectPtys].filter(([, entry]) => roots.some(root => isWithin(root, entry.cwd))))
    for (const [sessionId, process] of ptySessions) {
      const cwd = ptySessionCwds.get(sessionId)
      const generation = ptySessionGenerations.get(sessionId) ?? 0
      if (cwd && roots.some(root => isWithin(root, cwd))) ownedPtys.set(`${sessionId}:${generation}`, { sessionId, process, cwd, generation })
    }
    const stopped = await Promise.allSettled([removal.terminated, ...[...ownedPtys.values()].map(entry => retirePty(entry.sessionId, entry.process, entry.cwd, entry.generation, { force: true, timeoutMs: 2000 }))])
    const failure = stopped.find(result => result.status === 'rejected')
    if (failure?.status === 'rejected') throw failure.reason
    for (const target of targets) fs.rmSync(target, { recursive: true, force: true })
    saveRepositories(updated)
    for (const taskId of taskIds) taskProjectOwners.delete(taskId)
  } finally {
    removal.release()
    gitRemoval?.release()
    projectMutationInProgress = false
  }
}

handleIpc('delete-project-files', async (_, config: unknown) => {
  try {
    assertNoProjectMutation()
    const settings = loadSettings()
    const repositories = loadRepositories()
    const workspace = settings.globalWorkspacePath || path.join(app.getPath('home'), 'ZIAForge-Workspace')
    const targets = projectDeletionTargets(config, repositories, workspace, app.getPath('home'))
    const repoId = (config as { repoId: string }).repoId
    const removed = repositories.filter(repo => repo.id === repoId)
    await removeProjectRegistrations(removed, targets, repositories.filter(repo => repo.id !== repoId))
    return { success: true }
  } catch (err: unknown) {
    return { success: false, error: errorMessage(err) }
  }
})

const watchers = new Map<string, fs.FSWatcher>()

function parseExecutionPlan(planPath: string, taskId: string) {
  if (!fs.existsSync(planPath)) return null
  const content = fs.readFileSync(planPath, 'utf-8')
  const lines = content.split('\n')
  const steps: TodoStep[] = []
  
  let index = 1
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('- [ ]') || trimmed.startsWith('- [/]') || trimmed.startsWith('- [x]') || trimmed.startsWith('- [X]')) {
      const done = trimmed.startsWith('- [x]') || trimmed.startsWith('- [X]')
      const active = trimmed.startsWith('- [/]')
      const text = trimmed.substring(5).trim()
      steps.push({
        id: `s${index}`,
        text,
        done,
        active,
        description: ''
      })
      index++
    }
  }
  
  const total = steps.length
  const completed = steps.filter(s => s.done).length
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0
  
  return {
    taskId,
    progress,
    steps
  }
}

function watchExecutionPlan(projectDir: string, taskId: string, tasksFile: string) {
  const planPath = path.join(projectDir, 'artifacts', 'worktrees', taskId, 'execution_plan.md')
  const statePath = path.join(projectDir, 'artifacts', 'worktrees', taskId, 'task_state.json')
  
  if (watchers.has(taskId)) {
    try {
      watchers.get(taskId)!.close()
    } catch (e) { /* The previous watcher may already be closed. */ }
    watchers.delete(taskId)
  }
  
  if (!fs.existsSync(planPath)) return

  const watcher = fs.watch(planPath, (eventType) => {
    if (eventType === 'change') {
      try {
        const parsed = parseExecutionPlan(planPath, taskId)
        if (parsed) {
          assertStorageHealthy()
          fs.writeFileSync(statePath, JSON.stringify(parsed, null, 2), 'utf-8')
          
          if (fs.existsSync(tasksFile)) {
            assertStorageHealthy()
            const context = storedTaskContext(taskId)
            const projectTasks = readTaskIndex(context.repo)
            const taskIndex = projectTasks.findIndex((t: StoredTask) => t.id === taskId)
            if (taskIndex !== -1) {
              projectTasks[taskIndex].todoSteps = parsed.steps
              writeTaskIndex(context.repo, projectTasks)
              
              win?.webContents.send('task-steps-update', {
                taskId,
                steps: parsed.steps,
                progress: parsed.progress
              })
            }
          }
        }
      } catch (e) {
        console.error('Failed to parse and update task execution plan:', e)
      }
    }
  })
  
  watchers.set(taskId, watcher)
}

let streamInterval: NodeJS.Timeout | null = null

async function prepareTask(taskId: string, context?: StoredTaskContext) {
  assertNoProjectMutation()
  const settings = loadSettings()
  let task: StoredTask | undefined = context?.task
  let projectTasks: StoredTask[] = context?.projectTasks || []
  let tasksFile = context?.tasksFile || ''

  if (!context && settings.useMockData) {
    task = mockTasks.find(t => t.id === taskId)
  } else if (!context) {
    try {
      const resolved = storedTaskContext(taskId)
      context = resolved
      task = resolved.task
      projectTasks = resolved.projectTasks
      tasksFile = resolved.tasksFile
    } catch (error) { return { success: false, error: errorMessage(error) } }
  }

  if (!/^[A-Za-z0-9_-]{1,160}$/.test(taskId)) return { success: false, error: 'Invalid task identity' }
  if (!task) return { success: false, error: `Task ${taskId} not found` }

  if (!settings.useMockData && context) {
    try {
      const cwd = task.mode === 'work' || task.branchType === 'Folder'
        ? task.workFlowVersion === 1 && task.workFolderGrantId ? trustedTaskCwd(taskId) : prepareFolderTask(context.repo, taskId)
        : (await getGitService().prepare({ taskId })).cwd
      const current = storedTaskContext(taskId)
      current.task.worktreePath = cwd
      if (task.codeFlowVersion !== 1 && task.workFlowVersion !== 1) current.task.status = 'running'
      writeTaskIndex(current.repo, current.projectTasks)
      task = current.task
      projectTasks = current.projectTasks
      tasksFile = current.tasksFile
      taskProjectOwners.set(taskId, context.repo.id)
      if (task.agentTransport === 'legacy-pty') watchExecutionPlan(context.repo.path, taskId, tasksFile)
    } catch (error) { return { success: false, error: errorMessage(error) } }
  }

  // A new Code workflow publishes status only after its engine accepts a
  // transition. Preparing a workspace does not mean an agent is running.
  if (task.codeFlowVersion !== 1 && task.workFlowVersion !== 1) {
    task.status = 'running'
    if (tasksFile && context) writeTaskIndex(context.repo, projectTasks)
    win?.webContents.send('status-update', { taskId, status: 'running' })
  }

  if (settings.useMockData) {
    if (streamInterval) clearInterval(streamInterval)

    const logLines = [
      '\r\n\x1b[34;1m[ZIAForge Orchestrator v1.0.0]\x1b[0m Starting task run...\r\n',
      '\x1b[32m✔\x1b[0m Reading planning.md... Done.\r\n',
      '\x1b[33m➔\x1b[0m Creating Git Worktree: \x1b[36mworktrees/ziaf-task-10\x1b[0m...\r\n',
      'Preparing isolation sandbox environment... [Done]\r\n',
      '\x1b[31;1m[ZIAF] 🛑 Stopping the vibe.\x1b[0m\r\n',
      '\r\n\x1b[35m[Step 10/18] Starting: "Audit of Blacklists and SpamCop module"\x1b[0m\r\n',
      '\x1b[36m[active-coder]\x1b[0m Invoking Claude 3.5 Sonnet CLI...\r\n',
      '\x1b[33;1mThinking:\x1b[0m Let\'s analyze files in src/spam/ and find existing validation rules. We\'ll run a search command...\r\n',
      '\x1b[90m$ git grep "SpamCop" src/\x1b[0m\r\n',
      'src/spam/blacklist.php:12:  // Check SpamCop server\r\n',
      'src/spam/validation.php:45:  $spamCop = new SpamCopValidator();\r\n',
      '\x1b[32m✔\x1b[0m Command executed. [Speed: 48.5 tokens/sec]\r\n',
      '\x1b[33;1mThinking:\x1b[0m Now we need to modify blacklist.php to improve timeout handling during server response checks. Let\'s write tests first.\r\n',
      '\x1b[90m$ phpunit tests/SpamCopTest.php\x1b[0m\r\n',
      'PHPUnit 10.2.1 by Sebastian Bergmann.\r\n',
      'F.. [Fail]\r\n',
      'TimeoutException: Server did not respond within 2000ms.\r\n',
      '\x1b[31m✖ Tests failed as expected (TDD Red Phase)\x1b[0m\r\n',
      '\x1b[36m[active-coder]\x1b[0m Writing code patches... [Speed: 52.1 tokens/sec]\r\n',
      '\x1b[32m✔\x1b[0m Applied patch to src/spam/blacklist.php\r\n',
      '\x1b[90m$ phpunit tests/SpamCopTest.php\x1b[0m\r\n',
      '.. [Success]\r\n',
      '\x1b[32m✔ All tests passed! (16 tests, 1.2s)\r\n',
      '\x1b[32m✔\x1b[0m Auto-committing changes: "fix(spam): increase timeout and add fallbacks for SpamCop"\r\n',
      'Destroying worktree worktrees/ziaf-task-10... [Done]\r\n',
      'Updating memory.md with new lessons learned... [Done]\r\n',
      '\r\n\x1b[32;1m✔ TASK COMPLETED SUCCESSFULLY! [Total Time: 15.4s]\x1b[0m\r\n'
    ]

    let index = 0
    streamInterval = setInterval(() => {
      if (index < logLines.length) {
        const line = logLines[index]
        task.logs.push(line)
        win?.webContents.send('log-stream', line)
        index++
      } else {
        if (streamInterval) clearInterval(streamInterval)
        task.status = 'done'
        win?.webContents.send('status-update', { taskId, status: 'done' })
      }
    }, 1000)
  }

  return { success: true, worktreePath: task.worktreePath }
}

handleIpc('start-task', (_, taskId: string) => {
  validateSessionCommand('attach', { taskId, chatId: 'chat-main' })
  return prepareTask(taskId)
})

let splash: BrowserWindow | null = null

function createSplashWindow() {
  const splashPath = VITE_DEV_SERVER_URL
    ? path.join(APP_ROOT, 'public', 'splash.html')
    : path.join(RENDERER_DIST, 'splash.html')

  splash = new BrowserWindow({
    width: 680,
    height: 420,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    center: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: '#00000000',
    hasShadow: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  splash.loadFile(splashPath)
  splash.once('closed', () => { splash = null })
}

function showMainWindow(window: BrowserWindow) {
  if (window.isDestroyed()) return
  if (window.isMinimized()) window.restore()
  // Zoom to the desktop work area; do not enter a native fullscreen Space.
  if (process.platform === 'darwin' && !window.isFullScreen()) window.maximize()
  window.show()
  window.focus()
}

function createMainWindow() {
  // Give the hidden window its final desktop size before its first paint.
  const initialBounds = process.platform === 'darwin'
    ? screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea
    : { width: 1280, height: 800 }
  win = new BrowserWindow({
    ...initialBounds,
    minWidth: 1024,
    minHeight: 700,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0b0c0e',
    show: false, // Don't show until ready
    icon: path.join(VITE_PUBLIC, 'app-logo.jpeg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true
    },
  })

  win.on('close', (event) => {
    if (process.platform === 'darwin' && !isQuitting) {
      event.preventDefault()
      win?.hide()
      logToFile('Window hidden (MacOS close-to-hide)')
    }
  })

  win.on('closed', () => {
    win = null
  })

  win.webContents.on('render-process-gone', (_, details) => {
    editorHasDirtyFiles = false
    logToFile(`Renderer process gone! Reason: ${details.reason}, Exit Code: ${details.exitCode}`)
    if (details.reason !== 'clean-exit' && details.reason !== 'killed') {
      logToFile('Automatically reloading window to recover state from crash...')
      setTimeout(() => {
        if (win && !win.isDestroyed()) {
          win.reload()
        }
      }, 1000)
    }
  })

  win.webContents.on('unresponsive', () => {
    logToFile('Renderer process became unresponsive!')
  })

  win.setMenuBarVisibility(false)

  win.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedRendererUrl(url, path.join(RENDERER_DIST, 'index.html'), VITE_DEV_SERVER_URL)) event.preventDefault()
  })
  win.webContents.on('will-attach-webview', event => event.preventDefault())

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) openExternalUrl(url).catch(err => console.error('Failed to open URL external:', err))
    return { action: 'deny' }
  })

  // Show main window when ready, close splash
  const mainWindow = win
  mainWindow.webContents.on('will-prevent-unload',()=>{dialog.showMessageBoxSync(mainWindow,{type:'info',message:translate(loadSettings().uiLanguage || 'en', 'native.closeDirty'),buttons:[translate(loadSettings().uiLanguage || 'en', 'native.ok')]})})
  mainWindow.once('ready-to-show', () => {
    setTimeout(() => {
      if (splash) splash.close()
      showMainWindow(mainWindow)
    }, isE2E ? 0 : 4500) // Keep splash visible for 4.5s on initial launch
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

let isQuitting = false

let quitCleanup: Promise<void> | undefined
let quitCleanupFinished = false
app.on('before-quit', event => {
  // Keep services alive so the owner can still save after a cancelled Quit.
  if (!isQuitting && editorHasDirtyFiles && win && !win.isDestroyed()) {
    event.preventDefault()
    win.show()
    dialog.showMessageBoxSync(win,{type:'info',message:translate(loadSettings().uiLanguage || 'en', 'native.quitDirty'),buttons:[translate(loadSettings().uiLanguage || 'en', 'native.ok')]})
    return
  }
  isQuitting = true
  if (quitCleanupFinished) return
  event.preventDefault()
  if (quitCleanup) return
  sendAppEvent('editor:closing')
  quitCleanup = (async () => {
    // Fence new commands immediately, then cancel owned work before draining callers.
    const closingServices = [
      ['Help assistant', helpAssistant?.close()], ['updates', updateService?.close()], ['remote control', controlService?.close()], ['native commands', nativeControlRunner?.dispose()], ['API discovery', apiProviderStore?.shutdown()], ['CLI dispatcher', cliDispatcher?.close()],
      ['provider discovery', shutdownProviderLaunches()], ['model discovery', shutdownModelDiscovery()],
      ['Git', gitService?.shutdown()], ['workflow', workflowHost?.shutdown()], ['Work workflow', workFlowHost?.shutdown()],
    ] as const
    await Promise.all(closingServices.map(async ([name, pending]) => { try { await pending } catch (error) { logToFile(`${name} shutdown failed: ${errorMessage(error)}`) } }))
    await agentRunService?.sessions.shutdown().catch(error => logToFile(`Agent shutdown failed: ${errorMessage(error)}`))
    for (const watcher of watchers.values()) watcher.close()
    watchers.clear()
    if (streamInterval) clearInterval(streamInterval)
    const owned = new Map(pendingProjectPtys)
    for (const [sessionId, process] of ptySessions) {
      const cwd = ptySessionCwds.get(sessionId)
      if (!cwd) { logToFile(`PTY working directory ownership missing for PID ${process.pid}`); continue }
      const generation = ptySessionGenerations.get(sessionId) ?? 0
      owned.set(`${sessionId}:${generation}`, { sessionId, process, cwd, generation })
    }
    const results = await Promise.allSettled([...owned.values()].map(entry => retirePty(entry.sessionId, entry.process, entry.cwd, entry.generation, { timeoutMs: 500, force: false })))
    for (const result of results) if (result.status === 'rejected') logToFile(`PTY shutdown failed: ${errorMessage(result.reason)}`)
    ptySessions.clear()
    pendingProjectPtys.clear()
  })().catch(error => {
    logToFile(`Quit cleanup failed: ${errorMessage(error)}`)
  }).finally(() => {
    quitCleanupFinished = true
    app.quit()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On macOS dock click: just show existing window, no splash
  if (win && !win.isDestroyed()) {
    showMainWindow(win)
    logToFile('App activated: window shown (restored from hide)')
  } else {
    createMainWindow()
  }
})

function createMenu() {
  const template: MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin' ? [{
      label: 'ZIAForge',
      submenu: [
        {
          label: getLabel('menu_about', 'About ZIAForge'),
          click: () => {
            if (win && !win.isDestroyed()) {
              sendAppEvent('open-about')
            }
          }
        },
        {
          label: getLabel('menu_preferences', 'Preferences...'),
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            if (win && !win.isDestroyed()) {
              sendAppEvent('navigate-to', 'settings')
            }
          }
        },
        { type: 'separator' as const },
        { role: 'services' as const },
        { type: 'separator' as const },
        { role: 'hide' as const },
        { role: 'hideOthers' as const },
        { role: 'unhide' as const },
        { type: 'separator' as const },
        {
          label: getLabel('menu_quit', 'Quit ZIAForge'),
          accelerator: 'CmdOrCtrl+Q',
          click: () => app.quit()
        }
      ]
    }] : []),
    {
      label: getLabel('menu_edit', 'Edit'),
      submenu: [
        { role: 'undo' as const, label: getLabel('menu_undo', 'Undo') },
        { role: 'redo' as const, label: getLabel('menu_redo', 'Redo') },
        { type: 'separator' as const },
        { role: 'cut' as const, label: getLabel('menu_cut', 'Cut') },
        { role: 'copy' as const, label: getLabel('menu_copy', 'Copy') },
        { role: 'paste' as const, label: getLabel('menu_paste', 'Paste') },
        { role: 'selectAll' as const, label: getLabel('menu_select_all', 'Select All') }
      ]
    },
    {
      label: getLabel('menu_view', 'View'),
      submenu: [
        { role: 'reload' as const },
        { role: 'forceReload' as const },
        { role: 'toggleDevTools' as const, label: getLabel('menu_toggle_developer_tools', 'Toggle Developer Tools') },
        { type: 'separator' as const },
        { role: 'resetZoom' as const },
        { role: 'zoomIn' as const },
        { role: 'zoomOut' as const },
        { type: 'separator' as const },
        { role: 'togglefullscreen' as const, label: getLabel('menu_fullscreen', 'Toggle Full Screen') }
      ]
    },
    {
      label: getLabel('menu_navigate', 'Navigate'),
      submenu: [
        {
          label: getLabel('menu_new_task', 'New Task'),
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            if (win && !win.isDestroyed()) {
              sendAppEvent('navigate-to', 'new-task')
            }
          }
        },
        {
          label: getLabel('menu_assistant', 'ZIAF Assistant'),
          accelerator: 'CmdOrCtrl+Shift+A',
          click: () => {
            if (win && !win.isDestroyed()) {
              sendAppEvent('navigate-to', 'assistant')
            }
          }
        },
        {
          label: getLabel('menu_connections', 'Connections'),
          accelerator: 'CmdOrCtrl+Shift+C',
          click: () => {
            if (win && !win.isDestroyed()) {
              sendAppEvent('navigate-to', 'connections')
            }
          }
        },
        {
          label: getLabel('menu_automations', 'Automations'),
          accelerator: 'CmdOrCtrl+Shift+U',
          click: () => {
            if (win && !win.isDestroyed()) {
              sendAppEvent('navigate-to', 'automations')
            }
          }
        }
      ]
    },
    {
      label: getLabel('menu_window', 'Window'),
      submenu: [
        { role: 'minimize' as const, label: getLabel('menu_minimize', 'Minimize') },
        { role: 'zoom' as const, label: getLabel('menu_zoom', 'Zoom') },
        ...(process.platform === 'darwin' ? [
          { type: 'separator' as const },
          { role: 'front' as const },
          { type: 'separator' as const },
          { role: 'window' as const }
        ] : [
          { role: 'close' as const, label: getLabel('menu_close', 'Close') }
        ])
      ]
    },
    {
      label: getLabel('menu_help', 'Help'),
      role: 'help' as const,
      submenu: [
        {
          label: `${getLabel('browser_preview_open', 'Open in browser')} · ziaforge.studio`,
          click: () => {
            openExternalUrl('https://ziaforge.studio/').catch(err => console.error('Failed to open project website:', err))
          }
        },
        {
          label: getLabel('menu_github', 'GitHub Repository'),
          click: () => {
            shell.openExternal('https://github.com/ziaforge/ziaforge').catch(err => console.error(err))
          }
        },
        ...(process.platform !== 'darwin' ? [
          { type: 'separator' as const },
          {
            label: getLabel('menu_about', 'About ZIAForge'),
            click: () => {
              if (win && !win.isDestroyed()) {
                sendAppEvent('open-about')
              }
            }
          }
        ] : [])
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

let cliDispatcher: Awaited<ReturnType<typeof startCliDispatcher>> | undefined
function dispatcherSummary(snapshot: import('../shared/workflow').WorkflowSnapshot | null) {
  return snapshot && { taskId: snapshot.taskId, revision: snapshot.revision, sequence: snapshot.sequence, status: snapshot.status, reason: snapshot.reason, completed: snapshot.steps.filter(step => step.status === 'completed').length, total: snapshot.steps.length, iterations: snapshot.iterations }
}
async function executeDispatcher(request: DispatcherRequest) {
  if (request.command === 'quit') { setImmediate(() => app.quit()); return { status: 'quitting' } }
  assertNoProjectMutation()
  if (request.command === 'list') {
    const tasks: Array<{ id: string; name: string; mode: string }> = []
    for (const repo of loadRepositories()) {
      try {
        const records: unknown = JSON.parse(fs.readFileSync(authorizeProjectPath(path.join(repo.path, 'tasks.json'), [repo]), 'utf8'))
        if (Array.isArray(records)) for (const task of records) if (task && task.repoId === repo.id && typeof task.id === 'string' && typeof task.name === 'string') tasks.push({ id: task.id, name: task.name, mode: task.mode === 'work' ? 'work' : 'code' })
      } catch { /* One missing project does not obscure the remaining registered tasks. */ }
    }
    return tasks
  }
  const taskId = request.taskId!
  if (request.command === 'pause') return dispatcherSummary(await workflowCommands.pause({ taskId }))
  let snapshot = await workflowCommands.get({ taskId })
  if (request.command === 'status') return dispatcherSummary(snapshot)
  if (!snapshot) throw new Error('Save a plan in ZIAForge before starting this task')
  if (request.untilSuccess && snapshot.plan.advance !== 'auto') snapshot = await workflowCommands.save({ taskId, expectedRevision: snapshot.revision, plan: { ...snapshot.plan, advance: 'auto' } })
  return dispatcherSummary(await workflowCommands.start({ taskId, revision: snapshot.revision, commandId: request.commandId! }))
}

let editorService:EditorService|undefined
function getEditorService(){
  return editorService??=new EditorService({draftsDirectory:path.join(settingsDir,'editor-drafts'),resolveRoot(scope){
    assertNoProjectMutation()
    const repo=loadRepositories().find(r=>r.id===scope.repoId)
    if(!repo)throw new Error('Select a registered project')
    if(scope.scope==='task'){
      if(!scope.taskId||storedTaskContext(scope.taskId).repo.id!==repo.id)throw new Error('The task does not belong to this project')
      return trustedTaskCwd(scope.taskId)
    }
    return authorizeProjectPath(repo.repoPath,[repo])
  }})
}
const editorMethods={editorCreate:'create',editorOpen:'open',editorRead:'read',editorSave:'save',editorSearch:'search',editorClose:'close',editorLoadDraft:'loadDraft',editorStoreDraft:'storeDraft'} as const
for(const [name,method]of Object.entries(editorMethods)){
  const channel='editor:'+name.replace(/^editor/,'').replace(/[A-Z]/g,(c,index)=>(index?'-':'')+c.toLowerCase())
  handleIpc(channel,(_,request)=>{const fn=getEditorService()[method as typeof editorMethods[keyof typeof editorMethods]] as (request:Parameters<EditorAPI['editorOpen']>[0])=>unknown;return fn.call(getEditorService(),request)})
}
handleIpc('editor:reveal',async(_,request)=>{const target=await getEditorService().revealPath(request);if(target.isFile)shell.showItemInFolder(target.path);else{const error=await shell.openPath(target.path);if(error)throw new Error(error)}})
handleIpc('editor:dirty-state',(_,request:unknown)=>{
  if(!request||typeof request!=='object'||Object.keys(request).some(k=>k!=='dirty')||typeof (request as {dirty?:unknown}).dirty!=='boolean')throw new Error('Invalid editor state')
  editorHasDirtyFiles=(request as {dirty:boolean}).dirty
})
let teamStore:ReviewTeamStore|undefined
function getReviewTeams(){return teamStore??=new ReviewTeamStore(settingsDir)}
handleIpc('review-teams:list',()=>getReviewTeams().list())
handleIpc('review-teams:save',(_,request)=>{
  assertStorageHealthy()
  if(!request?.team)throw new Error('A review team is required')
  const team=structuredClone(request.team) as import('../shared/review-team').ReviewTeamPreset
  const freeze=(source:import('../shared/workflow').WorkflowReviewSource)=>{
    if(source.presetName==='@task')throw new Error('Saved review teams require a preset or explicit Custom configuration')
    const selection=resolveWorkflowSelection(source.presetName,source.configuration,()=>{throw new Error('Task selection unavailable')},source)
    const policy=resolveChatSelection(selection.presetName,loadPresets(),loadSettings().defaultCodingPreset,selection)
    return {...source,specialization:source.specialization??loadPresets().find(p=>p.name===source.presetName)?.specialization,presetName:'@custom',configuration:{provider:policy.provider,model:policy.model??'auto',apiConnectionId:'apiConnectionId' in policy?policy.apiConnectionId:undefined,reasoningEffort:policy.reasoningEffort,permissions:policy.permissions}}
  }
  team.reviewers=team.reviewers.map(freeze);team.architect=freeze(team.architect)
  if(!['claude','api'].includes(team.architect.configuration!.provider))throw new Error('The report-only architect requires Claude or API')
  return getReviewTeams().save({team})
})
handleIpc('review-teams:remove',(_,request)=>getReviewTeams().remove(request))
async function controlSystem(method:string,args:unknown[]):Promise<unknown>{
  if(method==='system.commands')return getControlService().commands()
  if(method==='system.summary')return {version:await commandHandlers.get('get-app-version')!(null as never),repositories:loadRepositories(),tasks:loadAllTasks(),nativeComputer:getControlService().status().nativeComputer}
  if(method==='system.windows')return BrowserWindow.getAllWindows().map(w=>({id:w.id,title:w.getTitle(),visible:w.isVisible(),bounds:w.getBounds()}))
  if(method==='system.screenshot'){
    const request=args[0] as {windowId?:number}|undefined
    const target=request?.windowId===undefined?win:BrowserWindow.fromId(request.windowId)
    if(!target||target.isDestroyed())throw new Error('Window unavailable')
    const capture=await target.webContents.capturePage()
    return {windowId:target.id,dataUrl:capture.resize({width:Math.min(1600,capture.getSize().width)}).toDataURL()}
  }
  if(method==='system.context'){
    const request=args[0] as {taskId:string;chatId?:string}
    if(!request||typeof request.taskId!=='string')throw new Error('A task ID is required')
    const {task,repo}=storedTaskContext(request.taskId)
    const workflow=await(task.workFlowVersion===1?workCommands:workflowCommands).get({taskId:task.id})
    const chats=await commandHandlers.get('get-chat-history')!(null as never,task.id)
    const session=request.chatId?await getAgentSessions().attach({taskId:task.id,chatId:request.chatId}):undefined
    return {task,project:{id:repo.id,name:repo.name},workflow,chats,session}
  }
  if(method==='computer.run'){
    if(isQuitting)throw new Error('Application is closing')
    if(!getControlService().status().nativeComputer)throw new Error('Native access must be enabled locally by the owner')
    nativeControlRunner??=new NativeControlRunner({directory:path.join(settingsDir,'native-control'),defaultCwd:settingsDir,env:getShellEnv()})
    return nativeControlRunner.run(args[0])
  }
  throw new Error('Unknown system command')
}
function guardControlMutation(channel:string,args:unknown[]){
  const settings=loadSettings()
  if(channel==='save-settings'){
    const incoming=args[0] as Settings
    if(incoming?.globalWorkspacePath!==settings.globalWorkspacePath)throw new Error('Changing the workspace root requires local owner settings')
  }
  if(channel==='save-repositories'){
    const incoming=args[0] as StoredRepository[],current=loadRepositories()
    if(!Array.isArray(incoming)||incoming.some(r=>{const old=current.find(i=>i.id===r.id);return !old||['path','repoPath','sourcePath','canonicalProjectPath','workDirectories'].some(k=>JSON.stringify(r[k as keyof StoredRepository])!==JSON.stringify(old[k as keyof StoredRepository]))}))throw new Error('New filesystem grants require local owner configuration; use createWorkspaceFolder/registerProject for new projects')
  }
  if(channel==='register-project'){
    const r=args[0] as {repoPath:string}
    const root=settings.globalWorkspacePath||path.join(app.getPath('home'),'ZIAForge-Workspace')
    if(!r||typeof r.repoPath!=='string'||!isWithin(fs.realpathSync(root),fs.realpathSync(r.repoPath),false))throw new Error('Remote projects must be inside the configured workspace')
  }
}
function getControlService():ControlService{
  return controlService??=new ControlService({directory:settingsDir,renderer:RENDERER_DIST,getLanguage:()=>loadSettings().uiLanguage || 'en',
    async invoke(channel,args){assertNoProjectMutation();guardControlMutation(channel,args);const handler=commandHandlers.get(channel);if(!handler)throw new Error('Command unavailable');return handler(null as never,...args)},
    system:controlSystem,
    async runAssistant(prompt,signal){
      const config=getControlService().ownerConfig()
      const policy=resolveChatSelection(config.assistantPreset||loadSettings().defaultHelperPreset||loadSettings().defaultCodingPreset,loadPresets(),loadSettings().defaultCodingPreset)
      if(!config.nativeComputer&&!['claude','api'].includes(policy.provider))throw new Error('For application-only control select Claude or API. Native computer tools require the owner’s local permission.')
      const cwd=path.join(settingsDir,'application-architect');fs.mkdirSync(cwd,{recursive:true,mode:0o700})
      const env={...getShellEnv()}
      const launch=policy.provider==='api'?{apiConnection:await getApiProviderStore().resolve('apiConnectionId' in policy?policy.apiConnectionId!:'')}:await prepareProviderLaunch(policy.provider,env,{preferNativeClaude:loadSettings().preferNativeClaude,reasoningEffort:policy.reasoningEffort})
      return runAssistantTurn({taskId:'application-architect',worktreePath:cwd,agentProvider:policy.provider,...policy,...launch,env,toolPolicy:config.nativeComputer?undefined:'none',apiReadOnly:!config.nativeComputer,apiHistoryDirectory:path.join(settingsDir,'architect-api-history')},prompt,signal)
    },
    makeBot(config,service){return new TelegramBot({directory:settingsDir,token:config.telegramToken!,owner:config.telegramOwner,getLanguage:()=>loadSettings().uiLanguage || 'en',execute:r=>service.execute(r),assistant:text=>service.assistant.send({text}),screenshot:async()=>await controlSystem('system.screenshot',[]) as {dataUrl:string}})},
  })
}
function getUpdateService(){return updateService??=new UpdateService(settingsDir)}
function getHelpAssistant():HelpAssistantEngine {
  const policyFor = (name:string) => {
    if (!name) throw new Error('help.aiSelectPreset')
    const policy=resolveChatSelection(name,loadPresets(),loadSettings().defaultCodingPreset)
    if (!['claude','api'].includes(policy.provider) && !getControlService().ownerConfig().nativeComputer) throw new Error('help.aiNativeRequired')
    return policy
  }
  return helpAssistant??=new HelpAssistantEngine({ directory:settingsDir, guide:helpGuide, sourceSha256:helpSourceSha256,
    configuration:()=>({defaultPreset:loadSettings().defaultHelperPreset||loadSettings().defaultCodingPreset||'',nativeEnabled:getControlService().ownerConfig().nativeComputer}),
    validatePreset:name=>{policyFor(name)},
    async run(request,prompt,signal) {
      const policy=policyFor(request.presetName)
      const cwd=path.join(settingsDir,'help-assistant');fs.mkdirSync(cwd,{recursive:true,mode:0o700})
      const env={...getShellEnv()}
      const launch=policy.provider==='api'?{apiConnection:await getApiProviderStore().resolve('apiConnectionId' in policy?policy.apiConnectionId!:'')}:await prepareProviderLaunch(policy.provider,env,{preferNativeClaude:loadSettings().preferNativeClaude,reasoningEffort:policy.reasoningEffort})
      signal.throwIfAborted();if(JSON.stringify(policyFor(request.presetName))!==JSON.stringify(policy))throw new Error('help.aiPresetChanged')
      return runAssistantTurn({taskId:'help-assistant',worktreePath:cwd,agentProvider:policy.provider,...policy,...launch,env,
        toolPolicy:['claude','api'].includes(policy.provider)?'none':undefined,
        sandbox:'read-only',approvalPolicy:'untrusted',agyPermissionMode:'cli-settings',agyMode:'plan',apiReadOnly:true,
        apiHistoryDirectory:path.join(settingsDir,'help-api-history')},prompt,signal)
    },
  })
}
handleIpc('help-assistant:state',()=>getHelpAssistant().state())
handleIpc('help-assistant:send',(_,request)=>{if(isQuitting)throw new Error('Application is closing');return getHelpAssistant().send(request)})
handleIpc('help-assistant:stop',()=>getHelpAssistant().stop())
handleIpc('help-assistant:clear',()=>getHelpAssistant().clear())
handleIpc('control:status',()=>getControlService().status(true))
handleIpc('control:configure',async(_,config)=>{if(config?.nativeComputer===false&&getControlService().ownerConfig().nativeComputer)await helpAssistant?.close();return getControlService().configure(config)})
handleIpc('control:rotate-token',()=>getControlService().rotateToken())
handleIpc('control:execute',(_,request:ControlRequest)=>getControlService().execute(request))
handleIpc('control:remote',(_,request)=>getControlService().remote(request))
handleIpc('control:assistant-state',()=>getControlService().assistant.state())
handleIpc('control:assistant-send',async(_,request)=>{await getControlService().assistant.send(request);return getControlService().assistant.state()})
handleIpc('control:assistant-stop',()=>getControlService().assistant.stop())
handleIpc('updates:status',()=>getUpdateService().status())
handleIpc('updates:configure',(_,config)=>getUpdateService().configure(config))
handleIpc('updates:check',()=>getUpdateService().check())
handleIpc('updates:download',()=>getUpdateService().download())
handleIpc('updates:install',()=>getUpdateService().install())

// Splash only on very first launch
app.whenReady().then(async () => {
  if (!primaryInstance) return
  const settings = loadSettings()
  updateAboutPanel(settings.uiLanguage || 'en')
  createMenu()
  try { cliDispatcher = await startCliDispatcher({ directory: path.join(settingsDir, 'cli'), execute: executeDispatcher }) }
  catch (error) { logToFile(`CLI dispatcher startup failed: ${errorMessage(error)}`) }
  if (headlessDispatcher) { app.dock?.hide(); await getControlService().start();getUpdateService().start();return }
  if (!isE2E) createSplashWindow()
  createMainWindow()
  try{await getControlService().start();getUpdateService().start()}catch(error){logToFile(`Control startup failed: ${errorMessage(error)}`)}
})

app.on('second-instance', (_event, argv) => {
  if (argv.includes('--ziaf-headless') || !app.isReady()) return
  if (win && !win.isDestroyed()) showMainWindow(win)
  else { app.dock?.show(); createMainWindow() }
})
