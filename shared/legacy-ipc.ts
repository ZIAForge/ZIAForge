import type { EditorAPI } from './editor'
import type { AgentExecutionOptions } from './agent-models'
import type { WorkflowReviewSource } from './workflow'
import type { WorkFlowAPI, WorkInputRef, WorkKind } from './work-flow'
import type { FeedItem, Preset, Repository, Settings, Task, TodoStep } from '../src/store'

// Describes the existing IPC payloads without loading the renderer store in main/preload.
// Runtime validation and the new agent IPC are separate from these legacy DTOs.
export type { FeedItem, Preset, Repository, Settings, Task, TodoStep }

export type NavigationTab = 'new-task' | 'workspace' | 'settings' | 'assistant' | 'connections' | 'automations' | 'help'

export interface ChatTab {
  id: string
  name: string
  type: 'chat' | 'file'
  filePath?: string
  baseDir?: string
}

export interface ChatHistory {
  centralTabs: ChatTab[]
  customTabFeeds: Record<string, FeedItem[]>
  activeTabId?: string
  recentTabs?: ChatTab[]
  drafts?: Record<string, string>
}

export interface ProjectFile {
  name: string
  path: string
  isDir: boolean
  children?: ProjectFile[]
  sizeBytes?: number
}

export interface ChatCompletionMessage {
  role: string
  content: string
}

export interface CreateTaskConfig extends AgentExecutionOptions {
  createRequestId?: string
  startWorkflow?: boolean
  workOptions?: {
    kind: WorkKind
    advance: 'auto' | 'manual'
    review: boolean
    reviewers: WorkflowReviewSource[]
    deep?: { workers: WorkflowReviewSource[] }
    inputIds: string[]
    folderGrantId?: string
  }
  workflowOptions?: {
    advance: 'auto' | 'manual'
    review: boolean
    reviewer?: WorkflowReviewSource
    planner?: WorkflowReviewSource
    fixer?: WorkflowReviewSource
  }
  name: string
  repoId: string
  model?: string
  workflow?: string
  branchType?: string
  branchName?: string
  description?: string
  provider?: import('./agent-session').AgentSessionProvider
  providerModel?: string
  apiConnectionId?: string
}

export type StoredTask = Pick<Task, 'id' | 'repoId' | 'name' | 'status' | 'logs'> &
  Partial<Omit<Task, 'id' | 'repoId' | 'name' | 'status' | 'logs'>>

export type StoredRepository = Repository & { path: string; repoPath: string; canonicalProjectPath?: string; sourcePath?: string; workDirectories?: string[] }

export type OperationResult = { success: boolean; error?: string }

export interface LegacyZiafAPI extends EditorAPI {
  helpAssistant: import('./help-assistant').HelpAssistantAPI
  reviewTeams: import('./review-team').ReviewTeamsAPI
  control: import('./control').ControlAPI
  updates: import('./control').UpdatesAPI
  recovery: import('./recovery').RecoveryAPI
  apiConnections: import('./api-provider').ApiConnectionsAPI
  git: import('./git').GitAPI
  workflows: import('./workflow').WorkflowAPI
  workFlows: WorkFlowAPI
  workFolders: { pick(): Promise<{ id: string; path: string; name: string } | null>; assign(request: { taskId: string; grantId?: string }): Promise<StoredTask> }
  workInputs: { pick(): Promise<WorkInputRef[]>; list(request: { ids: string[] }): Promise<WorkInputRef[]> }
  agentSessions: import('./agent-session').AgentSessionsAPI
  getRepositories(): Promise<Repository[]>
  saveRepositories(repos: Repository[]): Promise<void>
  getTasks(): Promise<Task[]>
  createTask(config: CreateTaskConfig): Promise<StoredTask>
  lookupCodeStart(config: { repoId: string; createRequestId: string }): Promise<StoredTask | null>
  lookupWorkStart(config: { createRequestId: string }): Promise<StoredTask | null>
  startTask(taskId: string): Promise<(OperationResult & { worktreePath?: string }) | void>
  getSettings(): Promise<Settings>
  saveSettings(settings: Settings): Promise<void>
  getAppVersion(): Promise<{ version: string; isDev: boolean; fullVersion: string }>
  getPresets(): Promise<Preset[]>
  savePresets(presets: Preset[]): Promise<void>
  onLogStream(callback: (data: string | { taskId?: string; line: string }) => void): () => void
  onStatusUpdate(callback: (data: { taskId: string; status: string }) => void): () => void
  onTaskStepsUpdate(callback: (data: { taskId: string; steps: TodoStep[]; progress: number }) => void): () => void
  onOpenAbout(callback: () => void): () => void
  onNavigate(callback: (tab: NavigationTab) => void): () => void
  updateMenu(labels: Record<string, string>): Promise<void>
  openExternal(url: string): Promise<void>
  selectDirectory(): Promise<string | null>
  registerProject(config: { repoPath: string; projectName: string }): Promise<OperationResult & {
    projectPath?: string; repoPath?: string; projectName?: string; projectId?: string
  }>
  getProjectBranches(config: { repoPath: string }): Promise<string[]>
  listProjectFiles(config: { projectPath: string }): Promise<ProjectFile[]>
  readFile(config: { filePath: string }): Promise<string>
  writeFile(config: { filePath: string; content: string }): Promise<{ success: boolean }>
  createDirectory(config: { dirPath: string }): Promise<{ success: boolean }>
  getAgentModels(config: { agent: string }): Promise<string[]>
  getAgentModelCatalog(config: { agent: string; apiConnectionId?: string }): Promise<import('./agent-models').AgentModelCatalog>
  queryChatCompletion(config: { model: string; messages: ChatCompletionMessage[] }): Promise<{ text: string }>
  writeDebugLog(config: { message: string; critical?: boolean }): Promise<void>
  getChatHistory(taskId: string): Promise<ChatHistory>
  saveChatHistory(data: ChatHistory & { taskId: string }): Promise<OperationResult>
  listWorkspaceFolders(): Promise<string[]>
  createWorkspaceFolder(name: string): Promise<OperationResult & { folderPath?: string }>
  deleteProjectFiles(config: { repoId: string; deleteWorkspaceDir: boolean; deleteSourceDir: boolean }): Promise<OperationResult>
  resetDatabase(): Promise<OperationResult>
  restoreFactoryDefaults(): Promise<OperationResult>
  spawnPty(config: { sessionId: string; cwd: string; cols?: number; rows?: number }): Promise<OperationResult & {
    reconnected?: boolean; history?: string; generation?: number
  }>
  writePty(config: { sessionId: string; data: string }): Promise<OperationResult>
  resizePty(config: { sessionId: string; cols: number; rows: number }): Promise<OperationResult>
  killPty(config: { sessionId: string }): Promise<OperationResult>
  killProcessByCommand(config: { command: string; sessionId?: string }): Promise<OperationResult & { killedCount?: number }>
  getActiveProcesses(config: { sessionId: string }): Promise<OperationResult & { processes: Array<{ pid: number; command: string }> }>
  killProcessByPid(config: { pid: number; sessionId?: string }): Promise<OperationResult>
  onPtyData(sessionId: string, callback: (data: string, meta?: { generation?: number }) => void): () => void
  onPtyExit(sessionId: string, callback: (res: { exitCode: number; generation?: number }) => void): () => void
  quitApp(): Promise<void>
}
