import { create } from 'zustand'
import { translateText } from './i18n-core'
import type { AgentExecutionOptions } from '../shared/agent-models'
import type { CreateTaskConfig, StoredTask } from '../shared/legacy-ipc'

export type CodeTaskStartOptions = Pick<CreateTaskConfig, 'createRequestId' | 'startWorkflow' | 'workflowOptions'>

export interface Repository {
  id: string
  name: string
  path?: string
  repoPath?: string
  currentBranch?: string
  branches?: string[]
  isWorkspaceMissing?: boolean
  isRepoMissing?: boolean
  kind?: 'git' | 'folder'
}

export interface Preset extends AgentExecutionOptions {
  specialization?: import('../shared/specializations').SpecializationSelection
  apiConnectionId?: string
  name: string
  agent: string
  model: string
  permissions: string
}

export interface ToolItem {
  id?: string
  type: 'ran' | 'thinking' | 'prompt'
  title?: string
  content?: string
  text?: string
  isRunning?: boolean
  promptActions?: Array<{ id: string, label: string, payload?: string }>
}

export interface FeedItem {
  id: string
  // Conversation turn, independent of PTY process generations and timestamps.
  turnIndex?: number
  type: 'ai' | 'tools' | 'prompt' | 'commit' | 'user'
  text?: string
  toolStats?: string
  tools?: ToolItem[]
  promptActions?: Array<{ id: string, label: string, payload?: string }>
  commitTitle?: string
  commitBranch?: string
  changedFiles?: Array<{ filename: string, directory: string, additions: number, deletions: number, isNew?: boolean }>
  committedFiles?: Array<{ filename: string, directory: string, additions: number, deletions: number, isNew?: boolean }>
  totalAdditions?: number
  totalDeletions?: number
  commitHash?: string
}

export interface TodoStep {
  id: string
  text: string
  done: boolean
  active?: boolean
  description?: string
  preset?: string
  startNewChat?: boolean
  stopAfterCompletion?: boolean
}

export interface GitChange {
  id: string
  filename: string
  path: string
  directory?: string
  status?: 'modified' | 'added' | 'deleted'
  additions: number
  deletions: number
  diff: string
}

export interface Task extends AgentExecutionOptions {
  readonly workFlowVersion?: 1
  readonly workStartup?: { requestId: string; signature: string; state: 'saved' | 'started' | 'failed'; definition: import('../shared/work-flow').WorkFlowDefinition }
  readonly workFolderGrantId?: string
  /** Backend-owned marker: the initial description belongs to the Code workflow. */
  readonly codeFlowVersion?: 1
  readonly startupError?: string
  readonly codeStartup?: { requestId: string; signature: string; state: 'saved' | 'started' | 'failed'; plan: import('../shared/workflow').WorkflowPlan }
  id: string
  repoId: string
  name: string
  status: 'idle' | 'running' | 'done' | 'failed' | 'error'
  logs: string[]
  feed: FeedItem[]
  browserUrl?: string
  terminalLogs?: string[]
  todoSteps: TodoStep[]
  gitChanges: GitChange[]
  model?: string
  agentProvider?: import('../shared/agent-session').AgentSessionProvider
  providerModel?: string
  apiConnectionId?: string
  mode?: 'code' | 'work'
  baseBranch?: string
  gitAdoptExisting?: boolean
  /** Explicit compatibility transport for existing terminal sessions and regression fixtures. */
  agentTransport?: 'legacy-pty'
  description?: string
  workflow?: string
  branchType?: string
  branchName?: string
  worktreePath?: string
}

export interface Settings {
  theme: string
  language: string
  uiLanguage: string
  defaultIDE: string
  autoArchive: string
  soundAlerts: boolean
  soundType: string
  desktopNotifications: boolean
  launchAtLogin: boolean
  preventSleep: boolean
  defaultCodingPreset?: string
  defaultReviewPreset?: string
  defaultHelperPreset?: string
  useMockData?: boolean
  preferNativeClaude?: boolean
  debugLogging?: boolean
  globalWorkspacePath?: string
}

export interface Connection {
  id: string
  name: string
  type: string
  status: 'connected' | 'testing' | 'disconnected'
  url?: string
  apiKey?: string
  config?: string
}

export interface Automation {
  id: string
  name: string
  type: 'workspace' | 'task'
  status: 'active' | 'paused' | 'completed'
  schedule?: string
  description: string
  targetProject: string
  runsCount: number
}

export interface AssistantMessage {
  id: string
  sender: 'user' | 'assistant'
  text: string
  timestamp: string
}

export interface SidebarGroup {
  id: string
  name: string
  collapsed: boolean
  children: SidebarGroup[]
  repoIds: string[]
  color?: string
}

// Sidebar Groups Helper Functions
const addGroupHelper = (groups: SidebarGroup[], parentId: string | null, newGroup: SidebarGroup): SidebarGroup[] => {
  if (!parentId) return [...groups, newGroup];
  return groups.map(g => g.id === parentId 
    ? { ...g, children: [...g.children, newGroup], collapsed: false } 
    : { ...g, children: addGroupHelper(g.children, parentId, newGroup) }
  );
};

const toggleGroupHelper = (groups: SidebarGroup[], groupId: string): SidebarGroup[] => {
  return groups.map(g => g.id === groupId 
    ? { ...g, collapsed: !g.collapsed } 
    : { ...g, children: toggleGroupHelper(g.children, groupId) }
  );
};

const findGroupById = (groups: SidebarGroup[], id: string): SidebarGroup | null => {
  for (const g of groups) {
    if (g.id === id) return g
    const found = findGroupById(g.children, id)
    if (found) return found
  }
  return null
}

const getGroupRepoIdsRecursive = (group: SidebarGroup): string[] => {
  let ids = [...group.repoIds]
  for (const child of group.children) {
    ids = [...ids, ...getGroupRepoIdsRecursive(child)]
  }
  return ids
}

const deleteGroupHelper = (groups: SidebarGroup[], groupId: string): SidebarGroup[] => {
  return groups.filter(g => g.id !== groupId)
    .map(g => ({ ...g, children: deleteGroupHelper(g.children, groupId) }));
};

const renameGroupHelper = (groups: SidebarGroup[], groupId: string, newName: string): SidebarGroup[] => {
  return groups.map(g => g.id === groupId 
    ? { ...g, name: newName } 
    : { ...g, children: renameGroupHelper(g.children, groupId, newName) }
  );
};

const changeGroupColorHelper = (groups: SidebarGroup[], groupId: string, color: string): SidebarGroup[] => {
  return groups.map(g => g.id === groupId 
    ? { ...g, color } 
    : { ...g, children: changeGroupColorHelper(g.children, groupId, color) }
  );
};

const removeRepoFromGroupHelper = (groups: SidebarGroup[], repoId: string): SidebarGroup[] => {
  return groups.map(g => ({
    ...g,
    repoIds: g.repoIds.filter(id => id !== repoId),
    children: removeRepoFromGroupHelper(g.children, repoId)
  }));
};

const addRepoToGroupHelper = (groups: SidebarGroup[], repoId: string, groupId: string): SidebarGroup[] => {
  return groups.map(g => g.id === groupId 
    ? { ...g, repoIds: [...g.repoIds.filter(id => id !== repoId), repoId] }
    : { ...g, children: addRepoToGroupHelper(g.children, repoId, groupId) }
  );
};

const taskStartupTokens: Record<string, number> = {}

interface AppState {
  activeTab: 'new-task' | 'workspace' | 'settings' | 'assistant' | 'connections' | 'automations' | 'help'
  repositories: Repository[]
  presets: Preset[]
  tasks: Task[]
  activeTaskId: string | null
  settings: Settings | null
  activeRepoId: string | null
  activeLogs: string[]
  activeFeed: FeedItem[]
  answeredPromptIds: Record<string, string>
  groups: SidebarGroup[]
  rightPanelTab: 'todo' | 'files' | 'git' | 'terminal' | 'automations' | 'browser' | null
  connections: Connection[]
  automations: Automation[]
  assistantMessages: AssistantMessage[]
  mockFileContents: Record<string, string>
  appVersion: { version: string, isDev: boolean, fullVersion: string } | null
  promptDialog: {
    title: string
    defaultValue: string
    submitText?: string
    cancelText?: string
    onSubmit: (value: string) => void
  } | null
  showPrompt(title: string, defaultValue: string, onSubmit: (value: string) => void, submitText?: string, cancelText?: string): void
  closePrompt(): void
  favoriteColors: string[]
  setFavoriteColors(colors: string[]): void
  
  loadInitialData(): Promise<void>
  setActiveTab(tab: 'new-task' | 'workspace' | 'settings' | 'assistant' | 'connections' | 'automations' | 'help'): void
  setRightPanelTab(tab: 'todo' | 'files' | 'git' | 'terminal' | 'automations' | 'browser' | null): void
  selectTask(taskId: string): void
  acceptWorkTasks(tasks: StoredTask[], activateId?: string): Promise<void>
  createTask(name: string, repoId: string, model: string, workflow: string, branchType: string, branchName: string, description?: string, selection?: AgentExecutionOptions & { provider?: import('../shared/agent-session').AgentSessionProvider; providerModel?: string; apiConnectionId?: string }, codeStart?: CodeTaskStartOptions): Promise<Task>
  startTask(taskId: string): Promise<void>
  saveSettings(settings: Settings): Promise<void>
  appendLog(line: string, taskId?: string): void
  appendFeedItem(item: FeedItem, taskId?: string): void
  updateFeedItem(itemId: string, updates: Partial<FeedItem>, taskId?: string): void
  updateTaskStatus(taskId: string, status: Task['status']): void
  updateTaskSteps(taskId: string, steps: TodoStep[]): void
  respondToPrompt(actionId: string): void
  recordAnsweredPrompt(promptId: string, answer: string): void
  
  deleteRepoDialog: {
    repoId: string
    repoName: string
    onConfirm: (options: { deleteWorkspaceDir: boolean, deleteSourceDir: boolean }) => void
  } | null
  showDeleteRepoDialog(repoId: string, repoName: string, onConfirm: (options: { deleteWorkspaceDir: boolean, deleteSourceDir: boolean }) => void): void
  closeDeleteRepoDialog(): void
  brokenReposList: Repository[]
  resolveBrokenRepos(action: 'cleanup' | 'ignore'): Promise<void>
  deleteGroupDialog: {
    groupId: string
    groupName: string
    projectsCount: number
    onConfirm: (action: 'keep' | 'delete_list' | 'delete_all') => void
  } | null
  showDeleteGroupDialog(groupId: string, groupName: string, projectsCount: number, onConfirm: (action: 'keep' | 'delete_list' | 'delete_all') => void): void
  closeDeleteGroupDialog(): void
  
  // Sidebar Groups
  setGroups(groups: SidebarGroup[]): void
  addGroup(name: string, parentId?: string | null): void
  toggleGroup(groupId: string): void
  deleteGroup(groupId: string): void
  renameGroup(groupId: string, newName: string): void
  changeGroupColor(groupId: string, color: string): void
  moveRepoToGroup(repoId: string, groupId: string | null): void
  setActiveRepoId(repoId: string | null): void
  addRepositoryInteractive(): Promise<string | null>
  deleteRepository(repoId: string, options?: { deleteWorkspaceDir: boolean, deleteSourceDir: boolean }): Promise<void>

  // Connection Actions
  updateConnection(id: string, updates: Partial<Connection>): void
  testConnection(id: string): Promise<void>
  addConnection(conn: Omit<Connection, 'id' | 'status'>): void
  deleteConnection(id: string): void

  // Automation Actions
  updateAutomationStatus(id: string, status: Automation['status']): void
  addAutomation(automation: Omit<Automation, 'id' | 'runsCount'>): void
  runAutomationNow(id: string): void

  // Presets Actions
  addPreset(preset: Preset): Promise<void>
  updatePreset(oldName: string, preset: Preset): Promise<void>
  deletePreset(name: string): Promise<void>

  // Assistant Actions
  sendAssistantMessage(text: string): void

  // Todo checklist Actions
  updateTodoStep(taskId: string, stepId: string, updates: Partial<TodoStep>): void
  addTodoStep(taskId: string, text: string): void
  deleteTodoStep(taskId: string, stepId: string): void
  toggleTodoStep(taskId: string, stepId: string): void

  // File System Mock Editor Actions
  editFileContent(path: string, content: string): void
  createNewFile(path: string, content: string): void
  commitGitChanges(taskId: string, commitMsg: string): void
}

export const useStore = create<AppState>((set, get) => {
  if (typeof window !== 'undefined' && window.ziafAPI) {
    window.ziafAPI.onLogStream?.((payload) => {
      if (typeof payload === 'string') {
        get().appendLog(payload)
      } else if (payload && typeof payload === 'object') {
        get().appendLog(payload.line, payload.taskId)
      }
    })

    window.ziafAPI.onStatusUpdate?.(({ taskId, status }) => {
      get().updateTaskStatus(taskId, status as Task['status'])
    })

    window.ziafAPI.onTaskStepsUpdate?.(({ taskId, steps }) => {
      get().updateTaskSteps(taskId, steps as TodoStep[])
    })
  }

  return {
    activeTab: 'new-task',
    repositories: [],
    presets: [],
    tasks: [],
    activeTaskId: null,
    settings: null,
    activeRepoId: null,
    activeLogs: [],
    activeFeed: [],
    answeredPromptIds: {},
    groups: [],
    rightPanelTab: 'todo',
    appVersion: null,
    promptDialog: null,
    deleteRepoDialog: null,
    deleteGroupDialog: null,
    brokenReposList: [],
    favoriteColors: (() => {
      try {
        const saved = localStorage.getItem('ziaf_favorite_colors')
        if (saved) return JSON.parse(saved)
      } catch {
        // ignore
      }
      return [
        '#f43f5e', '#ff6b00', '#eab308', '#84cc16', '#10b981', '#06b6d4',
        '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#ec4899', '#94a3b8'
      ]
    })(),
    
    connections: [
      { id: 'conn-1', name: 'LiteLLM Model Gateway', type: 'gateway', status: 'connected', url: 'http://127.0.0.1:4000/v1', apiKey: '••••••••••••••••••••••••••••••••' },
      { id: 'conn-2', name: 'Ollama (Local Models)', type: 'local', status: 'connected', url: 'http://127.0.0.1:11434' },
      { id: 'conn-3', name: 'Git MCP Server', type: 'mcp', status: 'connected', url: 'npx', config: '["-y", "@modelcontextprotocol/server-git"]' },
      { id: 'conn-4', name: 'Filesystem MCP Server', type: 'mcp', status: 'connected', url: 'npx', config: '["-y", "@modelcontextprotocol/server-filesystem", "/Users/developer"]' }
    ],
    
    automations: [
      { id: 'auto-1', name: 'Jira Standup Brief', type: 'workspace', status: 'active', schedule: 'Every weekday, 09:00', description: 'Every morning, search Jira for updates and write a 5-bullet summary automatically.', targetProject: 'ZIAForge', runsCount: 14 },
      { id: 'auto-2', name: 'Sync Linear Sprint to Notion', type: 'workspace', status: 'paused', schedule: 'Every 4 hours', description: 'Sync Linear sprint progress to a Notion dashboard table.', targetProject: 'app.deepaudit.ai', runsCount: 42 },
      { id: 'auto-3', name: 'OAuth refresh test for §4.11 DoD', type: 'task', status: 'paused', description: 'Goal: verify that refresh token remains valid after 24h+ of continuous run.', targetProject: 'Big Brain', runsCount: 3 },
      { id: 'auto-4', name: 'Storefront CMS Production Sync', type: 'task', status: 'completed', description: 'Goal: synchronize production deployment for Storefront CMS (domains: storefront.com, checkout-gateway.net, etc.)', targetProject: 'Storefront CMS', runsCount: 1 }
    ],

    assistantMessages: [
      { id: 'msg-1', sender: 'assistant', text: 'Hello! I am your ZIAF assistant. I can help you analyze repositories, start code audits, configure integrations, or automate routine development workflows. What would you like to build today?', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
    ],

    mockFileContents: {
      'data/crm/companies/1-progress-3214263.md': `# 1-progress-3214263\n\n* **Source**: LeadTracker / Campaign\n* **LeadTracker Employer ID**: 1437541\n* **LeadTracker URL**: [leadtracker.net/employer/1437541](https://leadtracker.net/employer/1437541)\n* **Status**: discovered\n\n## Identified Vacancies\n* Content Manager (TikTok/Instagram) - active\n\n## Discovery Log\n* 2026-05-23: Discovered by assistant during regular LeadTracker search queries.`,
      'src/spam/blacklist.php': `<?php\n\nnamespace Ziaf\\Spam;\n\nclass BlacklistManager {\n    protected string $provider = 'SpamCop';\n    protected int $cacheTimeout = 3600;\n    \n    public function isBlacklisted(string $ip): bool {\n        $validator = new SpamCopValidator();\n        return $validator->validate($ip);\n    }\n    \n    public function clearCache(): void {\n        // Clears memory lookup tables\n    }\n}`,
      'src/spam/validation.php': `<?php\n\nnamespace Ziaf\\Spam;\n\nclass SpamCopValidator {\n    public function validate(string $ip): bool {\n        // ZIAForge: Increased timeout to 5s with fallback check to avoid thread lock\n        $timeout = 5;\n        $socket = @fsockopen("bl.spamcop.net", 80, $errno, $errstr, $timeout);\n        if (!$socket) {\n            // Fallback to local DNS lookup cache\n            return $this->localLookup($ip);\n        }\n        \n        $response = fgets($socket, 128);\n        fclose($socket);\n        return str_contains($response, '127.0.0.2');\n    }\n    \n    protected function localLookup(string $ip): bool {\n        return false;\n    }\n}`,
      'package.json': `{\n  "name": "ziaforge",\n  "private": true,\n  "version": "2.3.2-prototype",\n  "type": "module",\n  "dependencies": {\n    "lucide-react": "^1.24.0",\n    "react": "^18.2.0",\n    "xterm": "^5.3.0"\n  }\n}`
    },

    loadInitialData: async () => {
      const repositories = await window.ziafAPI.getRepositories()
      const presets = await window.ziafAPI.getPresets()
      const settings = await window.ziafAPI.getSettings()
      const tasks = await window.ziafAPI.getTasks()
      const appVersion = await window.ziafAPI.getAppVersion()
      const useMockData = settings.useMockData === true
      
      const enrichedTasks: Task[] = tasks.map((t: Task) => {
        const steps: TodoStep[] = t.todoSteps ?? (useMockData ? [
          { id: 's1', text: 'Design assistant database schema', done: t.status === 'done', description: 'Design PostgreSQL tables for storing sessions, logs and task configurations' },
          { id: 's2', text: 'Setup Node.js/Playwright framework', done: t.status === 'done', description: 'Initialize repository, install packages, and prepare test configs' },
          { id: 's3', text: 'Implement core Playwright test flows', done: t.status === 'done', description: 'Develop login sequence automation and candidate crawling scripts' },
          { id: 's4', text: 'Step 10: Audit blocklists and SpamCop module', done: t.status === 'done', active: t.status === 'running', description: 'Detect memory leaks and increase response timeouts to 5000ms' },
          { id: 's5', text: 'Step 11: Audit newsletter sign-up forms', done: false, description: 'Verify CSRF protection and check input sanity checks on lead forms' },
          { id: 's6', text: 'Step 12: Audit landing page funnels', done: false, description: 'Inspect redirect rules and check query parameters vulnerability' }
        ] : [])

        const gitChanges: GitChange[] = t.gitChanges ?? (useMockData ? [
          { id: 'g1', filename: 'README.md', path: 'data/crm/companies/1-progress-3214263.md', additions: 21, deletions: 0, diff: '@@ -0,0 +1,21 @@\n+# 1-progress-3214263\n+* Source: LeadTracker / Campaign\n+* LeadTracker employer ID: 1437541\n+* LeadTracker URL: https://leadtracker.net/employer/1437541\n+* Status: discovered\n+## Identified Vacancies\n+* Content Manager (TikTok/Instagram) - active\n+## Discovery Log\n+* 2026-05-23: Discovered by assistant' },
          { id: 'g2', filename: 'validation.php', path: 'src/spam/validation.php', additions: 15, deletions: 3, diff: '@@ -42,8 +42,20 @@\n class SpamCopValidator {\n   public function validate($ip) {\n-    $socket = fsockopen("bl.spamcop.net", 80, $errno, $errstr, 2);\n+    // ZIAForge: Increased timeout to 5s with fallback check\n+    $timeout = 5;\n+    $socket = @fsockopen("bl.spamcop.net", 80, $errno, $errstr, $timeout);\n+    if (!$socket) {\n+        // Fallback to local DNS lookup cache\n+        return $this->localLookup($ip);\n+    }\n+    // check response...' }
        ] : [])

        const targetRepo = (repositories as unknown as Repository[]).find(r => r.id === t.repoId)
        const effectiveWorktree = t.worktreePath || (t.id && targetRepo?.path ? `${targetRepo.path}/worktrees/${t.id}` : undefined)

        return {
          ...t,
          worktreePath: effectiveWorktree,
          todoSteps: steps,
          gitChanges: gitChanges,
          logs: t.logs || [],
          feed: t.feed || [],
          browserUrl: t.browserUrl ?? (useMockData ? 'https://www.google.com/' : undefined),
          terminalLogs: t.terminalLogs ?? (useMockData ? [`-> ziaforge git:(main) `] : [])
        }
      })

      // Load groups from localStorage or compute defaults
      let savedGroups: SidebarGroup[] | undefined
      try {
        const str = localStorage.getItem('ziaf_sidebar_groups')
        if (str) {
          const parsed: unknown = JSON.parse(str)
          if (Array.isArray(parsed)) savedGroups = parsed
        }
      } catch (err) {
        console.error('Failed to parse groups', err)
      }

      if (savedGroups === undefined) {
        // Demonstration grouping must never silently archive real projects.
        const splitIdx = Math.ceil(repositories.length * 0.7)
        savedGroups = useMockData ? [
          { id: 'g1', name: 'Active Projects', collapsed: false, children: [], repoIds: repositories.slice(0, splitIdx).map(r => r.id) },
          { id: 'g2', name: 'Archived', collapsed: true, children: [
            { id: 'g2-1', name: 'Legacy', collapsed: true, children: [], repoIds: [] }
          ], repoIds: repositories.slice(splitIdx).map(r => r.id) }
        ] : [
          { id: 'g1', name: 'Active Projects', collapsed: false, children: [], repoIds: repositories.map(r => r.id) }
        ]
        localStorage.setItem('ziaf_sidebar_groups', JSON.stringify(savedGroups))
      }

      const broken = repositories.filter((r: Repository) => Boolean(r.isWorkspaceMissing || r.isRepoMissing))

      set({
        repositories,
        presets,
        settings,
        tasks: enrichedTasks,
        activeRepoId: repositories[0]?.id || null,
        groups: savedGroups,
        appVersion,
        brokenReposList: broken
      })
    },

    resolveBrokenRepos: async (action) => {
      const broken = get().brokenReposList
      if (action === 'cleanup') {
        const brokenIds = broken.map(r => r.id)
        const updatedRepos = get().repositories.filter(r => !brokenIds.includes(r.id))
        let cleanedGroups = get().groups
        for (const id of brokenIds) {
          cleanedGroups = removeRepoFromGroupHelper(cleanedGroups, id)
        }
        
        const currentActive = get().activeRepoId
        const newActiveId = currentActive && brokenIds.includes(currentActive)
          ? (updatedRepos[0]?.id || null)
          : currentActive

        set({
          repositories: updatedRepos,
          groups: cleanedGroups,
          activeRepoId: newActiveId,
          brokenReposList: []
        })
        localStorage.setItem('ziaf_sidebar_groups', JSON.stringify(cleanedGroups))
        if (!get().settings?.useMockData) {
          await window.ziafAPI.saveRepositories(updatedRepos)
        }
      } else {
        set({ brokenReposList: [] })
      }
    },

    setActiveTab: (tab) => set({ activeTab: tab }),
    
    showPrompt: (title, defaultValue, onSubmit, submitText, cancelText) => set({
      promptDialog: { title, defaultValue, onSubmit, submitText, cancelText }
    }),

    closePrompt: () => set({ promptDialog: null }),

    showDeleteRepoDialog: (repoId, repoName, onConfirm) => set({
      deleteRepoDialog: { repoId, repoName, onConfirm }
    }),

    closeDeleteRepoDialog: () => set({ deleteRepoDialog: null }),

    showDeleteGroupDialog: (groupId, groupName, projectsCount, onConfirm) => set({
      deleteGroupDialog: { groupId, groupName, projectsCount, onConfirm }
    }),

    closeDeleteGroupDialog: () => set({ deleteGroupDialog: null }),

    setFavoriteColors: (colors) => {
      set({ favoriteColors: colors })
      localStorage.setItem('ziaf_favorite_colors', JSON.stringify(colors))
    },
    
    setRightPanelTab: (tab) => set({ rightPanelTab: tab }),

    setGroups: (groups) => {
      set({ groups })
      localStorage.setItem('ziaf_sidebar_groups', JSON.stringify(groups))
    },

    addGroup: (name, parentId = null) => {
      const newGroup: SidebarGroup = {
        id: `g-${Date.now()}`,
        name,
        collapsed: false,
        children: [],
        repoIds: []
      }
      const updated = addGroupHelper(get().groups, parentId, newGroup)
      set({ groups: updated })
      localStorage.setItem('ziaf_sidebar_groups', JSON.stringify(updated))
    },

    toggleGroup: (groupId) => {
      const updated = toggleGroupHelper(get().groups, groupId)
      set({ groups: updated })
      localStorage.setItem('ziaf_sidebar_groups', JSON.stringify(updated))
    },

    deleteGroup: (groupId) => {
      const group = findGroupById(get().groups, groupId)
      if (!group) return

      const repoIds = getGroupRepoIdsRecursive(group)
      const lang = get().settings?.uiLanguage || 'en'
      if (repoIds.length === 0) {
        const confirmMsg = translateText(lang, 'Delete this group?')
        if (confirm(confirmMsg)) {
          const updated = deleteGroupHelper(get().groups, groupId)
          set({ groups: updated })
          localStorage.setItem('ziaf_sidebar_groups', JSON.stringify(updated))
        }
        return
      }

      get().showDeleteGroupDialog(groupId, group.name, repoIds.length, async (action) => {
        try {
          if (action === 'delete_list') {
            for (const id of repoIds) await get().deleteRepository(id, { deleteWorkspaceDir: false, deleteSourceDir: false })
          } else if (action === 'delete_all') {
            const lang = get().settings?.uiLanguage || 'en'
            const message = translateText(lang, 'This deletes the source files and Git history for {count} projects in this group. Continue?', { count: repoIds.length })
            if (!confirm(message)) return
            for (const id of repoIds) await get().deleteRepository(id, { deleteWorkspaceDir: true, deleteSourceDir: true })
          }
          const updatedGroups = deleteGroupHelper(get().groups, groupId)
          set({ groups: updatedGroups })
          localStorage.setItem('ziaf_sidebar_groups', JSON.stringify(updatedGroups))
        } catch (error) {
          alert(error instanceof Error ? error.message : String(error))
        }
      })
    },

    renameGroup: (groupId, newName) => {
      const updated = renameGroupHelper(get().groups, groupId, newName)
      set({ groups: updated })
      localStorage.setItem('ziaf_sidebar_groups', JSON.stringify(updated))
    },

    changeGroupColor: (groupId, color) => {
      const updated = changeGroupColorHelper(get().groups, groupId, color)
      set({ groups: updated })
      localStorage.setItem('ziaf_sidebar_groups', JSON.stringify(updated))
    },

    moveRepoToGroup: (repoId, groupId) => {
      // Remove from old group list
      let cleaned = removeRepoFromGroupHelper(get().groups, repoId)
      // Add to target group
      if (groupId) {
        cleaned = addRepoToGroupHelper(cleaned, repoId, groupId)
      }
      set({ groups: cleaned })
      localStorage.setItem('ziaf_sidebar_groups', JSON.stringify(cleaned))
    },

    setActiveRepoId: (repoId) => set({ activeRepoId: repoId }),

    addRepositoryInteractive: async () => {
      try {
        const repoPath = await window.ziafAPI.selectDirectory()
        if (!repoPath) return null

        const nameParts = repoPath.split(/[/\\]/)
        const projectName = nameParts[nameParts.length - 1] || 'New-Project'

        const res = await window.ziafAPI.registerProject({ repoPath, projectName })
        if (!res.success) {
          alert(translateText(get().settings?.uiLanguage, 'Failed to add repository: {error}', { error: res.error ?? '' }))
          return null
        }

        const targetId = res.projectId || `repo-${Date.now()}`
        const existingRepo = get().repositories.find(r => r.id === targetId || r.path === res.projectPath)
        const lang = get().settings?.uiLanguage || 'en'

        if (existingRepo) {
          set({ activeRepoId: existingRepo.id })
          alert(translateText(lang, 'This repository is already in the project list.'))
          return existingRepo.id
        }

        const branches = await window.ziafAPI.getProjectBranches({ repoPath: res.repoPath || repoPath })

        const newRepo: Repository = {
          id: targetId,
          name: res.projectName || projectName,
          path: res.projectPath,
          repoPath: res.repoPath,
          currentBranch: branches[0] || 'main',
          branches: branches
        }

        const updatedRepos = [...get().repositories, newRepo]
        set({
          repositories: updatedRepos,
          activeRepoId: newRepo.id
        })

        const currentGroups = get().groups
        const updatedGroups = findGroupById(currentGroups, 'g1')
          ? addRepoToGroupHelper(currentGroups, newRepo.id, 'g1')
          : [
            { id: 'g1', name: 'Active Projects', collapsed: false, children: [], repoIds: [newRepo.id] },
            ...currentGroups
          ]
        set({ groups: updatedGroups })
        localStorage.setItem('ziaf_sidebar_groups', JSON.stringify(updatedGroups))

        alert(translateText(lang, 'Project “{name}” added successfully.', { name: newRepo.name }))
        return newRepo.id
      } catch (err: unknown) {
        console.error('Error adding repository interactively:', err)
        const message = err instanceof Error ? err.message : String(err)
        alert(translateText(get().settings?.uiLanguage, 'Error adding repository: {error}', { error: message }))
        return null
      }
    },

    deleteRepository: async (repoId, options) => {
      const targetRepo = get().repositories.find(r => r.id === repoId)
      if (!targetRepo) return
      const updatedRepos = get().repositories.filter(r => r.id !== repoId)
      if (!get().settings?.useMockData) {
        if (options && (options.deleteWorkspaceDir || options.deleteSourceDir)) {
          const result = await window.ziafAPI.deleteProjectFiles({ repoId, ...options })
          if (!result.success) throw new Error(result.error || translateText(get().settings?.uiLanguage, 'Project deletion failed'))
        }
        await window.ziafAPI.saveRepositories(updatedRepos)
      }
      const cleanedGroups = removeRepoFromGroupHelper(get().groups, repoId)
      const remainingTasks = get().tasks.filter(task => task.repoId !== repoId)
      const activeTaskRemoved = get().tasks.some(task => task.id === get().activeTaskId && task.repoId === repoId)
      set({
        repositories: updatedRepos,
        groups: cleanedGroups,
        tasks: remainingTasks,
        ...(activeTaskRemoved ? { activeTaskId: null, activeLogs: [], activeFeed: [] } : {}),
        activeRepoId: get().activeRepoId === repoId ? (updatedRepos[0]?.id || null) : get().activeRepoId
      })
      localStorage.setItem('ziaf_sidebar_groups', JSON.stringify(cleanedGroups))
    },

    selectTask: (taskId) => {
      window.ziafAPI.writeDebugLog({ message: `selectTask: selected taskId="${taskId}"` }).catch(() => {})
      const task = get().tasks.find(t => t.id === taskId)
      const targetRepoId = task?.repoId || get().activeRepoId
      set({ 
        activeTaskId: taskId, 
        activeRepoId: targetRepoId,
        activeTab: 'workspace',
        activeLogs: task ? [...task.logs] : [],
        activeFeed: task && task.feed ? [...task.feed] : []
      })
    },

    acceptWorkTasks: async (incoming, activateId) => {
      const previousView = { tab: get().activeTab, taskId: get().activeTaskId }
      const tasks: Task[] = incoming.map(task => ({ ...task, feed: task.feed ?? [], logs: task.logs ?? [], todoSteps: task.todoSteps ?? [], gitChanges: task.gitChanges ?? [], terminalLogs: task.terminalLogs ?? [] }))
      set(state => ({ tasks: [...state.tasks.filter(task => !tasks.some(item => item.id === task.id)), ...tasks] }))
      try { set({ repositories: await window.ziafAPI.getRepositories() }) } catch { /* Tasks are already durably accepted; refresh can retry repository loading. */ }
      if (activateId && tasks.some(task => task.id === activateId) && get().activeTab === previousView.tab && get().activeTaskId === previousView.taskId) {
        get().selectTask(activateId)
        set({ rightPanelTab: 'todo' })
      }
    },

    createTask: async (name, repoId, model, workflow, branchType, branchName, description, selection, codeStart) => {
      const task = await window.ziafAPI.createTask({
        name,
        repoId,
        model,
        workflow,
        branchType,
        branchName,
        description: description || name,
        ...selection,
        ...(branchType !== 'Folder' ? codeStart : undefined),
      })
      
      const isWorkMode = branchType === 'Folder'
      const steps = isWorkMode 
        ? [
            { id: 's1', text: `Initialize workspace loop: ${workflow}`, done: false },
            { id: 's2', text: `Setup task folder inside ${branchName}`, done: false },
            { id: 's3', text: 'Gather documents and web search references', done: false },
            { id: 's4', text: 'Draft planning spec and outline briefs', done: false },
            { id: 's5', text: 'Forge final draft document deliverables', done: false }
          ]
        : [
            { id: 's1', text: `Initialize workflow ${workflow}`, done: false },
            { id: 's2', text: `Create branch ${branchName} (${branchType})`, done: false },
            { id: 's3', text: 'Perform codebase architecture analysis', done: false },
            { id: 's4', text: 'Generate task implementation checklist', done: false },
            { id: 's5', text: 'Trigger autonomous coding pipeline loop', done: false }
          ]

      const terminalLogs = isWorkMode 
        ? [`-> ziaforge-work: [${branchName}] `]
        : [`-> new-task-branch git:(${branchName}) `]

      const enrichedTask: Task = {
        id: task.id,
        repoId: task.repoId || repoId,
        name: task.name || name,
        description: description || name,
        model: model,
        agentProvider: task.agentProvider,
        providerModel: task.providerModel, apiConnectionId: task.apiConnectionId, permissions: task.permissions, reasoningEffort: task.reasoningEffort,
        mode: task.mode,
        workflow: workflow,
        branchType: branchType,
        branchName: branchName,
        worktreePath: task.worktreePath,
        status: 'idle',
        logs: [],
        feed: [],
        browserUrl: 'https://www.google.com/',
        terminalLogs: terminalLogs,
        todoSteps: task.todoSteps || steps,
        gitChanges: []
      }

      // New Code startup is backend-owned; do not turn its accepted running/error
      // receipt into an idle task or replace real steps with display placeholders.
      if (task.codeFlowVersion === 1) Object.assign(enrichedTask, task, {
        feed: task.feed ?? [], todoSteps: task.todoSteps ?? [], gitChanges: task.gitChanges ?? [],
        terminalLogs: task.terminalLogs ?? [], browserUrl: task.browserUrl,
      })
      
      set((state) => ({
        tasks: [...state.tasks.filter(item => item.id !== enrichedTask.id), enrichedTask],
        activeTaskId: task.id,
        activeRepoId: task.repoId,
        activeLogs: enrichedTask.logs,
        activeFeed: enrichedTask.feed,
        activeTab: 'workspace',
        rightPanelTab: 'todo'
      }))
      
      if (branchType === 'Folder') set({ repositories: await window.ziafAPI.getRepositories() })
      return enrichedTask
    },

    startTask: async (taskId) => {
      window.ziafAPI.writeDebugLog({ message: `startTask: starting taskId="${taskId}", useMockData=${get().settings?.useMockData}` }).catch(() => {})
      if (get().activeTaskId === taskId) {
        const existingUserMessages = get().activeFeed.filter(it => it.type === 'user')
        set({ activeLogs: [], activeFeed: existingUserMessages })
      }
      set((state) => ({
        tasks: state.tasks.map(t => t.id === taskId ? { ...t, logs: [] } : t)
      }))
      
      const isMock = Boolean(get().settings?.useMockData)
      if (isMock) {
        set((state) => ({
          tasks: state.tasks.map(t => {
            if (t.id === taskId) {
              return {
                ...t,
                status: 'running',
                worktreePath: t.worktreePath || `worktrees/${taskId}`,
                todoSteps: t.todoSteps.map((step, idx) => idx === 0 ? { ...step, active: true } : step)
              }
            }
            return t
          })
        }))

        get().appendFeedItem({
          id: 'stop-vibe',
          type: 'ai',
          text: '[ZIAF] 🛑 Stopping the vibe.'
        })

        get().appendFeedItem({
          id: 'init-ai',
          type: 'ai',
          text: 'Initializing ZIAForge workspace. Preparing Git Worktree for safe, isolated audit...'
        })

        setTimeout(() => {
        set((state) => ({
          tasks: state.tasks.map(t => {
            if (t.id === taskId) {
              return {
                ...t,
                todoSteps: t.todoSteps.map((step, idx) => 
                  idx === 0 ? { ...step, done: true, active: false } :
                  idx === 1 ? { ...step, active: true } : step
                )
              }
            }
            return t
          })
        }))
        
        get().appendFeedItem({
          id: 'init-tools',
          type: 'tools',
          toolStats: '2 thoughts, 1 tool',
          tools: [
            { type: 'thinking', title: 'Thinking', content: 'Creating clean isolated workspace tree. We need to avoid dirtying the current checkout.' },
            { type: 'ran', title: 'Ran', content: '$ git worktree add worktrees/ziaf-task-10 main\nPreparing worktree (checking out \'main\')\nHEAD is now at aa03497 feat: initial ZIAForge UI prototype application' }
          ]
        })
      }, 2000)

      setTimeout(() => {
        set((state) => ({
          tasks: state.tasks.map(t => {
            if (t.id === taskId) {
              return {
                ...t,
                todoSteps: t.todoSteps.map((step, idx) => 
                  idx === 1 ? { ...step, done: true, active: false } :
                  idx === 2 ? { ...step, active: true } : step
                )
              }
            }
            return t
          })
        }))

        get().appendFeedItem({
          id: 'audit-ai',
          type: 'ai',
          text: 'Login successful, but transitions to `/servers/detail` were unexpected... Clarifying actual server list markup and SpamCop timeout handling.'
        })
      }, 4000)

      setTimeout(() => {
        set((state) => ({
          tasks: state.tasks.map(t => {
            if (t.id === taskId) {
              return {
                ...t,
                todoSteps: t.todoSteps.map((step, idx) => 
                  idx === 2 ? { ...step, done: true, active: false } :
                  idx === 3 ? { ...step, active: true } : step
                )
              }
            }
            return t
          })
        }))

        get().appendFeedItem({
          id: 'audit-tools',
          type: 'tools',
          toolStats: '4 thoughts, 2 tools',
          tools: [
            { type: 'thinking', title: 'Thinking', content: 'Let\'s run phpunit tests to verify if the SpamCop server is responding within timeout limits.' },
            { type: 'ran', title: 'Ran', content: '$ phpunit tests/SpamCopTest.php\nPHPUnit 10.2.1 by Sebastian Bergmann.\nF.. [Fail]\nTimeoutException: Server did not respond within 2000ms.' }
          ]
        })
      }, 6000)

      setTimeout(() => {
        set((state) => ({
          tasks: state.tasks.map(t => {
            if (t.id === taskId) {
              return {
                ...t,
                todoSteps: t.todoSteps.map((step, idx) => 
                  idx === 3 ? { ...step, done: true, active: false } :
                  idx === 4 ? { ...step, active: true } : step
                )
              }
            }
            return t
          })
        }))

        get().appendFeedItem({
          id: 'prompt-patch',
          type: 'prompt',
          text: 'Proposed patch for `blacklist.php` adds 3s fallback handling. Apply patch to worktree branch?',
          promptActions: [
            { id: 'apply', label: 'Apply Patch' },
            { id: 'skip', label: 'Skip Step' },
            { id: 'abort', label: 'Abort' }
          ]
        })
      }, 8000)

      setTimeout(() => {
        set((state) => ({
          tasks: state.tasks.map(t => {
            if (t.id === taskId) {
              return {
                ...t,
                todoSteps: t.todoSteps.map((step, idx) => 
                  idx === 4 ? { ...step, done: true, active: false } : step
                )
              }
            }
            return t
          })
        }))

        get().appendFeedItem({
          id: 'commit-ai',
          type: 'ai',
          text: 'Changes verified locally. Preparing auto-commit for git worktree...'
        })

        get().appendFeedItem({
          id: 'git-commit-card',
          type: 'commit',
          commitTitle: 'fix(spam): increase timeout and add fallbacks for SpamCop',
          commitBranch: 'worktrees/ziaf-task-10',
          changedFiles: [
            { filename: 'blacklist.php', directory: 'src/spam/', additions: 14, deletions: 3, isNew: false },
            { filename: 'SpamCopTest.php', directory: 'tests/', additions: 56, deletions: 17, isNew: false },
            { filename: 'routes.php', directory: 'config/', additions: 5, deletions: 2, isNew: false },
            { filename: 'AuthTest.php', directory: 'tests/Unit/', additions: 31, deletions: 0, isNew: true },
          ],
          totalAdditions: 106,
          totalDeletions: 22,
          commitHash: '8dc95e7'
        })
      }, 9000)
      } else {
        // Real Mode: do not set status: running until backend finishes worktree setup!
        const startupToken = (taskStartupTokens[taskId] || 0) + 1
        taskStartupTokens[taskId] = startupToken
        try {
          const res = await window.ziafAPI.startTask(taskId)
          if (taskStartupTokens[taskId] !== startupToken) {
            console.log(`[Store] startTask for taskId=${taskId} was cancelled while in-flight, discarding stale startup result`)
            return
          }
          if (res && typeof res === 'object' && res.success && res.worktreePath) {
            set((state) => ({
              tasks: state.tasks.map(t => {
                if (t.id === taskId) {
                  return {
                    ...t,
                    status: 'running',
                    worktreePath: res.worktreePath,
                    todoSteps: t.todoSteps.map((step, idx) => idx === 0 ? { ...step, active: true } : step)
                  }
                }
                return t
              })
            }))
          } else {
            const errMsg = (res && typeof res === 'object' && 'error' in res && res.error) ? res.error : 'Failed to start task'
            set((state) => ({
              tasks: state.tasks.map(t => t.id === taskId ? { ...t, status: 'error' } : t)
            }))
            get().appendFeedItem({
              id: `err-start-task-${Date.now()}`,
              type: 'ai',
              text: `⚠️ Error starting task: ${errMsg}`
            }, taskId)
          }
        } catch (err: unknown) {
          if (taskStartupTokens[taskId] !== startupToken) {
            console.log(`[Store] startTask for taskId=${taskId} threw error but startup was already cancelled, discarding stale error`)
            return
          }
          const errMsg = err instanceof Error ? err.message : String(err)
          set((state) => ({
            tasks: state.tasks.map(t => t.id === taskId ? { ...t, status: 'error' } : t)
          }))
          get().appendFeedItem({
            id: `err-start-task-${Date.now()}`,
            type: 'ai',
            text: `⚠️ Error starting task: ${errMsg}`
          }, taskId)
        }
      }
    },

    saveSettings: async (settings) => {
      await window.ziafAPI.saveSettings(settings)
      const repositories = await window.ziafAPI.getRepositories()
      set({ 
        settings, 
        repositories,
        activeRepoId: repositories.find(r => r.id === get().activeRepoId) ? get().activeRepoId : (repositories[0]?.id || null)
      })
    },

    appendLog: (line, taskId?: string) => {
      set((state) => {
        const targetTaskId = taskId || state.activeTaskId
        const MAX_LOG_ENTRIES = 2000
        let incomingLines = line.includes('\n') ? line.split(/(?<=\n)/) : [line]
        if (incomingLines.length > MAX_LOG_ENTRIES) {
          incomingLines = incomingLines.slice(-1000)
        }

        const updatedTasks = state.tasks.map(t => {
          if (t.id === targetTaskId) {
            let newLogs = [...t.logs, ...incomingLines]
            if (newLogs.length > MAX_LOG_ENTRIES) {
              newLogs = newLogs.slice(-1000)
            }
            return { ...t, logs: newLogs }
          }
          return t
        })

        let nextActiveLogs = state.activeLogs
        if (targetTaskId === state.activeTaskId) {
          nextActiveLogs = [...state.activeLogs, ...incomingLines]
          if (nextActiveLogs.length > MAX_LOG_ENTRIES) {
            nextActiveLogs = nextActiveLogs.slice(-1000)
          }
        }

        return {
          activeLogs: nextActiveLogs,
          tasks: updatedTasks
        }
      })
    },

    appendFeedItem: (item, taskId?: string) => {
      set((state) => {
        const targetTaskId = taskId || state.activeTaskId
        const updatedTasks = state.tasks.map(t => {
          if (t.id === targetTaskId) {
            return { ...t, feed: [...(t.feed || []), item] }
          }
          return t
        })
        return {
          activeFeed: targetTaskId === state.activeTaskId ? [...state.activeFeed, item] : state.activeFeed,
          tasks: updatedTasks
        }
      })
    },

    updateFeedItem: (itemId, updates, taskId?: string) => {
      set((state) => {
        const targetTaskId = taskId || state.activeTaskId
        const updatedTasks = state.tasks.map(t => {
          if (t.id === targetTaskId) {
            return {
              ...t,
              feed: (t.feed || []).map(item => item.id === itemId ? { ...item, ...updates } : item)
            }
          }
          return t
        })
        return {
          activeFeed: targetTaskId === state.activeTaskId 
            ? state.activeFeed.map(item => item.id === itemId ? { ...item, ...updates } : item)
            : state.activeFeed,
          tasks: updatedTasks
        }
      })
    },

    updateTaskStatus: (taskId, status) => {
      if (status === 'idle' || status === 'error' || status === 'done') {
        taskStartupTokens[taskId] = (taskStartupTokens[taskId] || 0) + 1
      }
      set((state) => ({
        tasks: state.tasks.map(t => t.id === taskId ? { ...t, status } : t)
      }))
    },

    updateTaskSteps: (taskId, steps) => {
      set((state) => ({
        tasks: state.tasks.map(t => t.id === taskId ? { ...t, todoSteps: steps } : t)
      }))
    },

    recordAnsweredPrompt: (promptId, answer) => {
      set((state) => ({
        answeredPromptIds: { ...state.answeredPromptIds, [promptId]: answer }
      }))
    },

    respondToPrompt: (actionId) => {
      const activeId = get().activeTaskId
      if (!activeId) return

      set((state) => {
        const cleanedFeed = state.activeFeed.filter(item => item.id !== 'prompt-patch')
        return {
          activeFeed: cleanedFeed
        }
      })

      if (actionId === 'apply-patch') {
        get().appendFeedItem({
          id: 'patch-ai-running',
          type: 'ai',
          text: 'Applying patch to `src/spam/blacklist.php` and restarting tests...'
        })

        set((state) => ({
          tasks: state.tasks.map(t => {
            if (t.id === activeId) {
              return {
                ...t,
                todoSteps: t.todoSteps.map((step, idx) => 
                  idx === 3 ? { ...step, done: true, active: false } :
                  idx === 4 ? { ...step, active: true } : step
                )
              }
            }
            return t
          })
        }))

        setTimeout(() => {
          get().appendFeedItem({
            id: 'patch-tools',
            type: 'tools',
            toolStats: '2 thoughts, 2 tools',
            tools: [
              { type: 'thinking', title: 'Thinking', content: 'Writing timeout changes to source file and executing phpunit verify step.' },
              { type: 'ran', title: 'Ran', content: '$ phpunit tests/SpamCopTest.php\n.. [Success]\n✔ All tests passed! (16 tests, 1.2s)' }
            ]
          })
          
          get().appendFeedItem({
            id: 'patch-ai-done',
            type: 'ai',
            text: 'Done: patch applied successfully, tests passed. Branch merged to main, temporary files removed.'
          })

          set((state) => ({
            tasks: state.tasks.map(t => {
              if (t.id === activeId) {
                return {
                  ...t,
                  status: 'done',
                  todoSteps: t.todoSteps.map(step => ({ ...step, done: true, active: false }))
                }
              }
              return t
            })
          }))
        }, 2000)
      } else {
        get().appendFeedItem({
          id: 'patch-ai-skipped',
          type: 'ai',
          text: 'Skipping patch as requested. Continuing audit of other SpamCop modules...'
        })
      }
    },
    
    // Connection Methods
    updateConnection: (id, updates) => {
      set((state) => ({
        connections: state.connections.map(c => c.id === id ? { ...c, ...updates } : c)
      }))
    },
    
    testConnection: async (id) => {
      set((state) => ({
        connections: state.connections.map(c => c.id === id ? { ...c, status: 'testing' } : c)
      }))
      
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      set((state) => ({
        connections: state.connections.map(c => c.id === id ? { ...c, status: 'connected' } : c)
      }))
    },

    addConnection: (conn) => {
      set((state) => ({
        connections: [
          ...state.connections,
          {
            ...conn,
            id: `conn-${Date.now()}`,
            status: 'connected'
          }
        ]
      }))
    },

    deleteConnection: (id) => {
      set((state) => ({
        connections: state.connections.filter(c => c.id !== id)
      }))
    },
    
    // Automation Methods
    updateAutomationStatus: (id, status) => {
      set((state) => ({
        automations: state.automations.map(a => a.id === id ? { ...a, status } : a)
      }))
    },
    
    addAutomation: (automation) => {
      set((state) => ({
        automations: [
          ...state.automations,
          {
            ...automation,
            id: `auto-${Date.now()}`,
            runsCount: 0
          }
        ]
      }))
    },

    runAutomationNow: (id) => {
      set((state) => ({
        automations: state.automations.map(a => 
          a.id === id 
            ? { ...a, runsCount: (a.runsCount || 0) + 1, status: 'active' } 
            : a
        )
      }))
    },
    
    // Assistant Methods
    sendAssistantMessage: (text) => {
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      const userMsg: AssistantMessage = { id: `msg-${Date.now()}`, sender: 'user', text, timestamp }
      
      set((state) => ({
        assistantMessages: [...state.assistantMessages, userMsg]
      }))
      
      setTimeout(() => {
        let reply = 'I have processed your query. '
        const lowerText = text.toLowerCase()
        if (lowerText.includes('vibe')) {
          reply = "Sorry, vibe coding is disabled in ZIAForge by configuration rule #1. We only forge here. Would you like me to generate a strict TDD checklist for your task instead?"
        } else if (lowerText.includes('hello') || lowerText.includes('hi')) {
          reply += 'Hello! How can I help you with the ZIAForge project today?'
        } else if (lowerText.includes('status') || lowerText.includes('task')) {
          reply += `Currently, you have ${get().tasks.length} tasks configured. Out of these, ${get().tasks.filter(t => t.status === 'running').length} are active.`
        } else if (lowerText.includes('connection') || lowerText.includes('api')) {
          const tableLines = get().connections.map(c => `| ${c.name} | ${c.type} | ${c.status} |`).join('\n')
          reply += `\nHere is the active connections inventory:\n\n| Integration | Type | Status |\n|---|---|---|\n${tableLines}`
        } else {
          reply += 'I am ready to help you with code audits, automatic bug fixing, and test generation. Select a task from the sidebar to launch or track execution.'
        }
        
        const assistantMsg: AssistantMessage = {
          id: `msg-${Date.now() + 1}`,
          sender: 'assistant',
          text: reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
        
        set((state) => ({
          assistantMessages: [...state.assistantMessages, assistantMsg]
        }))
      }, 1000)
    },
    
    // To-do Methods
    updateTodoStep: (taskId, stepId, updates) => {
      set((state) => ({
        tasks: state.tasks.map(t => {
          if (t.id === taskId) {
            return {
              ...t,
              todoSteps: t.todoSteps.map(s => s.id === stepId ? { ...s, ...updates } : s)
            }
          }
          return t
        })
      }))
    },
    
    addTodoStep: (taskId, text) => {
      set((state) => ({
        tasks: state.tasks.map(t => {
          if (t.id === taskId) {
            const newStep: TodoStep = {
              id: `step-${Date.now()}`,
              text,
              done: false,
              description: 'Added manually by user'
            }
            return {
              ...t,
              todoSteps: [...t.todoSteps, newStep]
            }
          }
          return t
        })
      }))
    },
    
    deleteTodoStep: (taskId, stepId) => {
      set((state) => ({
        tasks: state.tasks.map(t => {
          if (t.id === taskId) {
            return {
              ...t,
              todoSteps: t.todoSteps.filter(s => s.id !== stepId)
            }
          }
          return t
        })
      }))
    },

    toggleTodoStep: (taskId, stepId) => {
      set((state) => ({
        tasks: state.tasks.map(t => {
          if (t.id === taskId) {
            return {
              ...t,
              todoSteps: t.todoSteps.map(s => s.id === stepId ? { ...s, done: !s.done } : s)
            }
          }
          return t
        })
      }))
    },
    
    // File System Editor Methods
    editFileContent: (path, content) => {
      set((state) => ({
        mockFileContents: {
          ...state.mockFileContents,
          [path]: content
        }
      }))
    },

    createNewFile: (path, content) => {
      set((state) => ({
        mockFileContents: {
          ...state.mockFileContents,
          [path]: content
        }
      }))
    },
    
    // Git Methods
    commitGitChanges: (taskId, commitMsg) => {
      set((state) => {
        const updatedTasks = state.tasks.map(t => {
          if (t.id === taskId) {
            return {
              ...t,
              gitChanges: [],
              logs: [...t.logs, `\r\n\x1b[32m✔\x1b[0m Committed: "${commitMsg}"\r\n\x1b[35m➔\x1b[0m Pushing branch to origin...\r\n\x1b[32m✔\x1b[0m Pushed to remote branch.\r\n`]
            }
          }
          return t
        })
        return {
          tasks: updatedTasks,
          activeLogs: get().activeTaskId === taskId ? [...get().activeLogs, `\r\n\x1b[32m✔\x1b[0m Committed: "${commitMsg}"\r\n\x1b[35m➔\x1b[0m Pushing branch to origin...\r\n\x1b[32m✔\x1b[0m Pushed to remote branch.\r\n`] : get().activeLogs
        }
      })
    },

    // Presets Methods
    addPreset: async (preset) => {
      const updated = [...get().presets, preset]
      await window.ziafAPI.savePresets(updated)
      set({ presets: updated })
    },
    updatePreset: async (oldName, preset) => {
      const updated = get().presets.map(p => p.name === oldName ? preset : p)
      await window.ziafAPI.savePresets(updated)
      set({ presets: updated })
    },
    deletePreset: async (name) => {
      const updated = get().presets.filter(p => p.name !== name)
      await window.ziafAPI.savePresets(updated)
      set({ presets: updated })
    }
  }
})
