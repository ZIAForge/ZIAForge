import { ipcRenderer, contextBridge, type IpcRendererEvent } from 'electron'
import type { LegacyZiafAPI, NavigationTab, TodoStep } from '../shared/legacy-ipc'
import type { AgentSessionUpdate } from '../shared/agent-session'
import type { WorkflowSnapshot } from '../shared/workflow'
import type { WorkFlowSnapshot } from '../shared/work-flow'

const api: LegacyZiafAPI = {
  helpAssistant: { state: () => ipcRenderer.invoke('help-assistant:state'), send: request => ipcRenderer.invoke('help-assistant:send', request), stop: () => ipcRenderer.invoke('help-assistant:stop'), clear: () => ipcRenderer.invoke('help-assistant:clear') },
  editorDirtyState:r=>ipcRenderer.invoke('editor:dirty-state',r),
  editorOnClosing:callback=>{const listener=()=>callback();ipcRenderer.on('editor:closing',listener);return()=>ipcRenderer.off('editor:closing',listener)},
  editorCreate:r=>ipcRenderer.invoke('editor:create',r), editorOpen:r=>ipcRenderer.invoke('editor:open',r), editorRead:r=>ipcRenderer.invoke('editor:read',r), editorSave:r=>ipcRenderer.invoke('editor:save',r), editorSearch:r=>ipcRenderer.invoke('editor:search',r), editorClose:r=>ipcRenderer.invoke('editor:close',r), editorLoadDraft:r=>ipcRenderer.invoke('editor:load-draft',r), editorStoreDraft:r=>ipcRenderer.invoke('editor:store-draft',r), editorReveal:r=>ipcRenderer.invoke('editor:reveal',r),
  reviewTeams:{list:()=>ipcRenderer.invoke('review-teams:list'),save:r=>ipcRenderer.invoke('review-teams:save',r),remove:r=>ipcRenderer.invoke('review-teams:remove',r)},
  control:{status:()=>ipcRenderer.invoke('control:status'),configure:r=>ipcRenderer.invoke('control:configure',r),rotateToken:()=>ipcRenderer.invoke('control:rotate-token'),execute:r=>ipcRenderer.invoke('control:execute',r),remote:r=>ipcRenderer.invoke('control:remote',r),assistantState:()=>ipcRenderer.invoke('control:assistant-state'),assistantSend:r=>ipcRenderer.invoke('control:assistant-send',r),assistantStop:()=>ipcRenderer.invoke('control:assistant-stop')},
  updates:{status:()=>ipcRenderer.invoke('updates:status'),configure:r=>ipcRenderer.invoke('updates:configure',r),check:()=>ipcRenderer.invoke('updates:check'),download:()=>ipcRenderer.invoke('updates:download'),install:()=>ipcRenderer.invoke('updates:install')},
  recovery: {
    list: () => ipcRenderer.invoke('recovery:list'),
    inspect: target => ipcRenderer.invoke('recovery:inspect', target),
    restore: request => ipcRenderer.invoke('recovery:restore', request),
    onChanged: callback => {
      const listener = () => callback()
      ipcRenderer.on('recovery:changed', listener)
      return () => ipcRenderer.off('recovery:changed', listener)
    },
  },
  agentMedia: { read: request => ipcRenderer.invoke('agent-media:read', request), save: request => ipcRenderer.invoke('agent-media:save', request) },
  apiConnections: { list: () => ipcRenderer.invoke('api-connections:list'), save: request => ipcRenderer.invoke('api-connections:save', request), remove: request => ipcRenderer.invoke('api-connections:remove', request) },
  git: {
    prepare: request => ipcRenderer.invoke('git:prepare', request),
    status: request => ipcRenderer.invoke('git:status', request),
    diff: request => ipcRenderer.invoke('git:diff', request),
    commit: request => ipcRenderer.invoke('git:commit', request),
    push: request => ipcRenderer.invoke('git:push', request),
    merge: request => ipcRenderer.invoke('git:merge', request),
    removeWorktree: request => ipcRenderer.invoke('git:remove-worktree', request),
  },
  workflows: {
    discuss: request => ipcRenderer.invoke('workflow:discuss', request),
    respond: request => ipcRenderer.invoke('workflow:respond', request),
    readArtifact: request => ipcRenderer.invoke('workflow:read-artifact', request),
    get: request => ipcRenderer.invoke('workflow:get', request),
    save: request => ipcRenderer.invoke('workflow:save', request),
    start: request => ipcRenderer.invoke('workflow:start', request),
    pause: request => ipcRenderer.invoke('workflow:pause', request),
    onEvent: callback => {
      const listener = (_event: IpcRendererEvent, snapshot: WorkflowSnapshot) => callback(snapshot)
      ipcRenderer.on('workflow:update', listener)
      return () => ipcRenderer.off('workflow:update', listener)
    },
  },
  workFlows: {
    get: request => ipcRenderer.invoke('work-flow:get', request),
    save: request => ipcRenderer.invoke('work-flow:save', request),
    start: request => ipcRenderer.invoke('work-flow:start', request),
    respond: request => ipcRenderer.invoke('work-flow:respond', request),
    followUp: request => ipcRenderer.invoke('work-flow:follow-up', request),
    pause: request => ipcRenderer.invoke('work-flow:pause', request),
    readArtifact: request => ipcRenderer.invoke('work-flow:read-artifact', request),
    openArtifact: request => ipcRenderer.invoke('work-flow:open-artifact', request),
    onEvent: callback => {
      const listener = (_event: IpcRendererEvent, snapshot: WorkFlowSnapshot) => callback(snapshot)
      ipcRenderer.on('work-flow:update', listener)
      return () => ipcRenderer.off('work-flow:update', listener)
    },
  },
  agentSessions: {
    create: request => ipcRenderer.invoke('agent-session:create', request),
    resume: request => ipcRenderer.invoke('agent-session:resume', request),
    reconfigure: request => ipcRenderer.invoke('agent-session:reconfigure', request),
    attach: request => ipcRenderer.invoke('agent-session:attach', request),
    snapshot: request => ipcRenderer.invoke('agent-session:snapshot', request),
    send: request => ipcRenderer.invoke('agent-session:send', request),
    queue: request => ipcRenderer.invoke('agent-session:queue', request),
    setQueuePaused: request => ipcRenderer.invoke('agent-session:set-queue-paused', request),
    cancelQueued: request => ipcRenderer.invoke('agent-session:cancel-queued', request),
    interrupt: request => ipcRenderer.invoke('agent-session:interrupt', request),
    terminate: request => ipcRenderer.invoke('agent-session:terminate', request),
    resolveApproval: request => ipcRenderer.invoke('agent-session:resolve-approval', request),
    onEvent: callback => {
      const listener = (_event: IpcRendererEvent, update: AgentSessionUpdate) => callback(update)
      ipcRenderer.on('agent-session:update', listener)
      return () => ipcRenderer.off('agent-session:update', listener)
    },
  },
  getRepositories: () => ipcRenderer.invoke('get-repositories'),
  saveRepositories: (repos) => ipcRenderer.invoke('save-repositories', repos),
  getTasks: () => ipcRenderer.invoke('get-tasks'),
  createTask: (config) => ipcRenderer.invoke('create-task', config),
  lookupCodeStart: config => ipcRenderer.invoke('lookup-code-start', config),
  lookupWorkStart: config => ipcRenderer.invoke('lookup-work-start', config),
  workInputs: {
    pick: () => ipcRenderer.invoke('work-inputs:pick'),
    list: request => ipcRenderer.invoke('work-inputs:list', request),
  },
  workFolders: { pick: () => ipcRenderer.invoke('work-folders:pick'), assign: request => ipcRenderer.invoke('work-folders:assign', request) },
  startTask: (taskId: string) => ipcRenderer.invoke('start-task', taskId),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getPresets: () => ipcRenderer.invoke('get-presets'),
  savePresets: (presets) => ipcRenderer.invoke('save-presets', presets),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  registerProject: (config: { repoPath: string, projectName: string }) => ipcRenderer.invoke('register-project', config),
  getProjectBranches: (config: { repoPath: string }) => ipcRenderer.invoke('get-project-branches', config),
  listProjectFiles: (config: { projectPath: string }) => ipcRenderer.invoke('list-project-files', config),
  readFile: (config: { filePath: string }) => ipcRenderer.invoke('read-file', config),
  writeFile: (config: { filePath: string, content: string }) => ipcRenderer.invoke('write-file', config),
  createDirectory: (config: { dirPath: string }) => ipcRenderer.invoke('create-directory', config),
  getAgentModels: (config: { agent: string }) => ipcRenderer.invoke('get-agent-models', config),
  getAgentModelCatalog: config => ipcRenderer.invoke('get-agent-model-catalog', config),
  queryChatCompletion: (config) => ipcRenderer.invoke('query-chat-completion', config),
  writeDebugLog: (config: { message: string, critical?: boolean }) => ipcRenderer.invoke('write-debug-log', config),
  getChatHistory: (taskId) => ipcRenderer.invoke('get-chat-history', taskId),
  saveChatHistory: (data) => ipcRenderer.invoke('save-chat-history', data),
  listWorkspaceFolders: () => ipcRenderer.invoke('list-workspace-folders'),
  createWorkspaceFolder: (name: string) => ipcRenderer.invoke('create-workspace-folder', name),
  deleteProjectFiles: (config: { repoId: string, deleteWorkspaceDir: boolean, deleteSourceDir: boolean }) => ipcRenderer.invoke('delete-project-files', config),
  
  onLogStream: (callback: (data: string | { taskId?: string, line: string }) => void) => {
    const listener = (_event: IpcRendererEvent, data: string | { taskId?: string, line: string }) => callback(data)
    ipcRenderer.on('log-stream', listener)
    return () => ipcRenderer.off('log-stream', listener)
  },
  onStatusUpdate: (callback: (data: { taskId: string, status: string }) => void) => {
    const listener = (_event: IpcRendererEvent, data: { taskId: string, status: string }) => callback(data)
    ipcRenderer.on('status-update', listener)
    return () => ipcRenderer.off('status-update', listener)
  },
  onTaskStepsUpdate: (callback: (data: { taskId: string, steps: TodoStep[], progress: number }) => void) => {
    const listener = (_event: IpcRendererEvent, data: { taskId: string, steps: TodoStep[], progress: number }) => callback(data)
    ipcRenderer.on('task-steps-update', listener)
    return () => ipcRenderer.off('task-steps-update', listener)
  },
  onOpenAbout: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on('open-about', listener)
    return () => ipcRenderer.off('open-about', listener)
  },
  onNavigate: (callback: (tab: NavigationTab) => void) => {
    const listener = (_event: IpcRendererEvent, tab: NavigationTab) => callback(tab)
    ipcRenderer.on('navigate-to', listener)
    return () => ipcRenderer.off('navigate-to', listener)
  },
  updateMenu: (labels) => ipcRenderer.invoke('update-menu', labels),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  resetDatabase: () => ipcRenderer.invoke('reset-database'),
  restoreFactoryDefaults: () => ipcRenderer.invoke('restore-factory-defaults'),
  spawnPty: (config: { sessionId: string, cwd: string, cols?: number, rows?: number }) => ipcRenderer.invoke('spawn-pty', config),
  writePty: (config: { sessionId: string, data: string }) => ipcRenderer.invoke('write-pty', config),
  resizePty: (config: { sessionId: string, cols: number, rows: number }) => ipcRenderer.invoke('resize-pty', config),
  killPty: (config: { sessionId: string }) => ipcRenderer.invoke('kill-pty', config),
  killProcessByCommand: (config: { command: string, sessionId?: string }) => ipcRenderer.invoke('kill-process-by-command', config),
  getActiveProcesses: (config: { sessionId: string }) => ipcRenderer.invoke('get-active-processes', config),
  killProcessByPid: (config: { pid: number, sessionId?: string }) => ipcRenderer.invoke('kill-process-by-pid', config),
  onPtyData: (sessionId: string, callback: (data: string, meta?: { generation?: number }) => void) => {
    const listener = (_event: IpcRendererEvent, data: string, generation?: number) => callback(data, { generation })
    ipcRenderer.on(`pty-data-${sessionId}`, listener)
    return () => ipcRenderer.off(`pty-data-${sessionId}`, listener)
  },
  onPtyExit: (sessionId: string, callback: (res: { exitCode: number, generation?: number }) => void) => {
    const listener = (_event: IpcRendererEvent, res: { exitCode: number, generation?: number }) => callback(res)
    ipcRenderer.on(`pty-exit-${sessionId}`, listener)
    return () => ipcRenderer.off(`pty-exit-${sessionId}`, listener)
  },
  quitApp: () => ipcRenderer.invoke('quit-app')
}

contextBridge.exposeInMainWorld('ziafAPI', api)
