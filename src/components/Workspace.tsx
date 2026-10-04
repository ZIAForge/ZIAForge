import { uiText } from '../uiText'
import { WorkflowRuns } from '../features/workspace/WorkflowRuns'
import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useStore, TodoStep, type FeedItem, type ToolItem, type Task, type Repository } from '../store'
import { useTranslation } from '../i18n'
import { buildAgentCommand, structuredProvider, resolveDefaultPreset } from '../features/workspace/modelSelection'
import { GitPanel } from '../features/workspace/GitPanel'
import { BrowserPreview } from '../features/workspace/BrowserPreview'
import { ExecutablePlanPanel } from '../features/workspace/ExecutablePlanPanel'
import { WorkFlowPanel } from '../features/workspace/WorkFlowPanel'
import { useWorkFlow, useWorkFlowChats, workStatusTitle } from '../features/workspace/useWorkFlow'
import { useWorkflowProgress } from '../features/workspace/useWorkflowProgress'
import { StructuredChat } from '../features/workspace/StructuredChat'
import { CodeDialogue, CODE_DIALOGUE_TAB } from '../features/workspace/CodeDialogue'
import { useTaskChatHistory } from '../features/workspace/useTaskChatHistory'
import { useWorkflowChats } from '../features/workspace/useWorkflowChats'
import { ChatHistoryDropdown } from '../features/workspace/ChatHistoryDropdown'
import { agentActivity } from '../features/workspace/agentActivity'
import { PtyAgentReadiness } from '../features/workspace/agentReadiness'
import { mergeFeeds, withFeedTurns } from '../features/workspace/mergeFeeds'
import { updateTerminalScreen } from '../features/workspace/terminalScreen'
import { isInteractivePrompt, parsePromptOption, promptActionsForText, type PromptAction } from '../features/workspace/terminalPrompts'
import {
  WorkspaceShell,
  PlanPanel,
  ConversationFeed,
  Composer,
  TerminalPane,
  type ComposerAttachment,
  type ActiveProcessItem,
} from '../features/workspace'
import { FileEditor, FolderActions } from '../features/workspace/FileEditor'
import type { EditorOpenRequest } from '../../shared/editor'
import { 
  Play, 
  Check, 
  Terminal as TerminalIcon, 
  ChevronDown,
  ChevronRight,
  PlayCircle,
  Globe,
  GitBranch,
  Folder,
  FileText,
  Plus,
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Search,
  MessageSquare,
  X,
  Copy,
  GitMerge,
  Columns,
  Settings,
  Bookmark,
} from 'lucide-react'

const GithubIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
  </svg>
)

interface CentralTab {
  id: string
  name: string
  type: 'chat' | 'file'
  filePath?: string
  baseDir?: string
}

const mockRecentTabs: CentralTab[] = [
  { id: 'recent-1', name: 'Analyze project codebase. In docs...', type: 'chat' },
  { id: 'recent-2', name: 'TODO Step 5.C: Add new features...', type: 'chat' },
  { id: 'recent-3', name: 'TODO Step 9.F: Prepare release...', type: 'chat' },
  { id: 'recent-4', name: 'Step 13: Audit tracking module...', type: 'chat' },
]

function readRecentChats(key: string): CentralTab[] {
  if (key === 'mock') return mockRecentTabs
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) || '[]')
    if (!Array.isArray(value)) return []
    const seen = new Set<string>()
    return value.flatMap((tab: unknown) => {
      if (!tab || typeof tab !== 'object' || !('id' in tab) || typeof tab.id !== 'string' ||
          !/^[A-Za-z0-9_-]{1,160}$/.test(tab.id) || seen.has(tab.id) ||
          !('name' in tab) || typeof tab.name !== 'string' || !('type' in tab) || tab.type !== 'chat') return []
      seen.add(tab.id)
      return [{ id: tab.id, name: tab.name, type: 'chat' as const }]
    })
  } catch {
    return []
  }
}

interface FileTreeNode {
  name: string
  path: string
  isDir?: boolean
  children?: FileTreeNode[]
}

// Module-scoped tracking to survive component unmount/remount (e.g. switching to Settings and back)
const globalLaunchedSessions = new Set<string>()
const globalLaunchedAgentSessions = new Set<string>()
const globalAgentReadySessions = new Set<string>()
interface QueuedChatMessage {
  attemptId: string
  text: string
}
type QueueItem = string | QueuedChatMessage

function getQueueItemText(item: QueueItem): string {
  return typeof item === 'string' ? item : item.text
}

function getQueueItemAttemptId(item: QueueItem): string | undefined {
  return typeof item === 'string' ? undefined : item.attemptId
}

const globalPendingMessagesQueue: Record<string, QueueItem[]> = {}
const globalPendingFirstInput: Record<string, string> = {}
const globalSessionLastSnapshot: Record<string, string> = {}
const globalSessionTerminalLogs: Record<string, string[]> = {}
const globalCustomTabFeeds: Record<string, FeedItem[]> = {}
const globalCustomTabScreens: Record<string, string[]> = {}
const globalPtyScreenState: Record<string, { cursorRow: number, cursorCol: number, savedRow: number, savedCol: number, trailing: string }> = {}
const globalAccumulatedOutputBySession: Record<string, string> = {}
const globalActivePromptIdBySession: Record<string, string> = {}
const sessionDeliveryLocks: Record<string, number> = {}
const globalSessionGenerations: Record<string, number> = {}
const globalAgentAwaitingReadySessions = new Set<string>()
const globalSessionFrontendGenerations: Record<string, number> = {}
const globalAgentBootBuffers: Record<string, string> = {}
const globalSessionTaskOwners: Record<string, string | undefined> = {}
const globalSessionVerifyingLiveness = new Set<string>()
const globalFirstInputVersions: Record<string, number> = {}
const globalAgentReadyFrontendGenerations: Record<string, number> = {}
const globalSessionCancellationVersions: Record<string, number> = {}
const globalStoppedSessions = new Set<string>()

interface InFlightStartupSend {
  tabId: string
  taskId?: string
  sessionId: string
  firstKey: string
  userMsg: string
  attemptId: string
}

const globalInFlightStartupSends = new Map<string, InFlightStartupSend>()
const globalDeliveredAttemptIds = new Set<string>()
const globalCancelledAttemptIds = new Set<string>()
const globalInFlightWritePromises = new Map<string, Promise<{ success: boolean; error?: string }>>()
const globalSessionActiveWriteAttempts = new Map<string, string>()
const globalPendingFirstAttemptId: Record<string, string> = {}

function syncSessionQueuedInput(sessionId: string) {
  const keys = new Set([...Object.keys(globalPendingFirstInput), ...Object.keys(globalPendingMessagesQueue)])
  agentActivity.setQueued(sessionId, [...keys].some(key =>
    (key === sessionId || key.startsWith(`${sessionId}:`)) &&
    (Boolean(globalPendingFirstInput[key]) || (globalPendingMessagesQueue[key]?.length || 0) > 0)
  ))
}

async function writeAgentInput(sessionId: string, data: string) {
  const generation = globalSessionFrontendGenerations[sessionId] || 0
  const cancellation = globalSessionCancellationVersions[sessionId] || 0
  const completeInput = agentActivity.beginInput(sessionId)
  agentActivity.startTurn(sessionId)
  try {
    const result = await window.ziafAPI.writePty({ sessionId, data })
      .catch((err: Error) => ({ success: false, error: err?.message || String(err) }))
    if (!result.success && generation === (globalSessionFrontendGenerations[sessionId] || 0) &&
      cancellation === (globalSessionCancellationVersions[sessionId] || 0)) agentActivity.failTurn(sessionId)
    return result
  } finally {
    completeInput()
  }
}

function recordDeliveredAttempt(attemptId?: string): void {
  if (!attemptId) return
  globalDeliveredAttemptIds.add(attemptId)
  if (globalDeliveredAttemptIds.size > 1000) {
    const oldest = globalDeliveredAttemptIds.values().next().value
    if (oldest) globalDeliveredAttemptIds.delete(oldest)
  }
}

function recordCancelledAttempt(attemptId?: string): void {
  if (!attemptId) return
  globalCancelledAttemptIds.add(attemptId)
  if (globalCancelledAttemptIds.size > 1000) {
    const oldest = globalCancelledAttemptIds.values().next().value
    if (oldest) globalCancelledAttemptIds.delete(oldest)
  }
}

function bumpSessionCancellation(sessionId?: string): void {
  if (sessionId) {
    globalSessionCancellationVersions[sessionId] = (globalSessionCancellationVersions[sessionId] || 0) + 1
  }
}

function markSessionStopped(sessionId?: string): void {
  if (sessionId) {
    globalStoppedSessions.add(sessionId)
    bumpSessionCancellation(sessionId)
  }
}

function clearSessionStopped(sessionId?: string): void {
  if (sessionId) {
    globalStoppedSessions.delete(sessionId)
  }
}

function abortPendingTabSend(previousTabId?: string, currentTaskId?: string): void {
  if (!previousTabId) return
  const isMain = previousTabId === 'feed' || previousTabId === 'chat-main'
  const sessionId = isMain && currentTaskId ? `term-task-${currentTaskId}-0` : previousTabId
  const queueKey = currentTaskId ? `${sessionId}:${currentTaskId}` : sessionId

  const inFlight = globalInFlightStartupSends.get(sessionId) ||
    globalInFlightStartupSends.get(queueKey) ||
    globalInFlightStartupSends.get(previousTabId) ||
    (currentTaskId ? globalInFlightStartupSends.get(currentTaskId) : undefined)

  const activeWriteAttempt = globalSessionActiveWriteAttempts.get(sessionId) ||
    (currentTaskId ? globalSessionActiveWriteAttempts.get(currentTaskId) : undefined) ||
    globalSessionActiveWriteAttempts.get(queueKey) ||
    globalSessionActiveWriteAttempts.get(previousTabId)

  if (activeWriteAttempt) {
    recordCancelledAttempt(activeWriteAttempt)
  }

  if (inFlight?.attemptId) {
    recordCancelledAttempt(inFlight.attemptId)
  }

  const pendingAttempt = (currentTaskId ? globalPendingFirstAttemptId[queueKey] : undefined) ||
    globalPendingFirstAttemptId[sessionId] ||
    globalPendingFirstAttemptId[previousTabId]
  if (pendingAttempt) {
    recordCancelledAttempt(pendingAttempt)
  }

  for (const k of Object.keys(globalPendingFirstAttemptId)) {
    if (k === sessionId || k === previousTabId || k.startsWith(`${sessionId}:`) || k.startsWith(`${previousTabId}:`)) {
      const attId = globalPendingFirstAttemptId[k]
      if (attId) recordCancelledAttempt(attId)
    }
  }

  if (!inFlight && !activeWriteAttempt && !pendingAttempt) {
    return
  }

  // If this specific attempt was already confirmed delivered, do not abort
  if (inFlight && globalDeliveredAttemptIds.has(inFlight.attemptId)) {
    return
  }

  bumpSessionCancellation(previousTabId)
  bumpSessionCancellation(sessionId)
  if (inFlight?.taskId || currentTaskId) {
    bumpSessionCancellation(inFlight?.taskId || currentTaskId)
  }
  delete globalPendingFirstInput[sessionId]
  delete globalPendingFirstInput[previousTabId]
  delete globalPendingFirstAttemptId[sessionId]
  delete globalPendingFirstAttemptId[previousTabId]
  globalFirstInputVersions[sessionId] = (globalFirstInputVersions[sessionId] || 0) + 1
  globalFirstInputVersions[previousTabId] = (globalFirstInputVersions[previousTabId] || 0) + 1
  if (currentTaskId) {
    delete globalPendingFirstInput[queueKey]
    delete globalPendingFirstAttemptId[queueKey]
    globalFirstInputVersions[queueKey] = (globalFirstInputVersions[queueKey] || 0) + 1
  }
  for (const k of Object.keys(globalPendingFirstInput)) {
    if (k.startsWith(`${sessionId}:`) || k.startsWith(`${previousTabId}:`)) {
      delete globalPendingFirstInput[k]
      delete globalPendingFirstAttemptId[k]
      globalFirstInputVersions[k] = (globalFirstInputVersions[k] || 0) + 1
    }
  }
}

function isSessionAgentReady(sessionId: string): boolean {
  if (!globalAgentReadySessions.has(sessionId)) return false
  const currentGen = globalSessionFrontendGenerations[sessionId] || 0
  const readyGen = globalAgentReadyFrontendGenerations[sessionId]
  return readyGen !== undefined ? readyGen === currentGen : true
}

function resolveTaskCwd(task: Task | null | undefined, activeRepo: Repository | null | undefined): string {
  if (task?.worktreePath) return task.worktreePath
  if (task?.id && (activeRepo?.path || activeRepo?.repoPath)) {
    return `${activeRepo?.path || activeRepo?.repoPath}/worktrees/${task.id}`
  }
  return activeRepo?.repoPath || activeRepo?.path || ''
}

function isCustomChatTab(tabId: string, tabs?: CentralTab[]): boolean {
  if (!tabId || tabId === 'feed' || tabId === 'chat-main') return false
  if (tabId.startsWith('chat-') || tabId.startsWith('recent-')) return true
  if (tabs?.some(t => t.id === tabId && t.type === 'chat')) return true
  if (globalCustomTabFeeds[tabId]) return true
  return false
}

function getQueueKey(sessionId: string, targetTaskId?: string): string {
  return targetTaskId ? `${sessionId}:${targetTaskId}` : sessionId
}

function appendToSessionLogs(sessionId: string, chunk: string) {
  if (!globalSessionTerminalLogs[sessionId]) {
    globalSessionTerminalLogs[sessionId] = []
  }
  let logs = globalSessionTerminalLogs[sessionId]
  let incomingLines = chunk.includes('\n') ? chunk.split(/(?<=\n)/) : [chunk]
  if (incomingLines.length > 2000) {
    incomingLines = incomingLines.slice(-1000)
  }
  logs = logs.concat(incomingLines)
  if (logs.length > 2000) {
    logs = logs.slice(-1000)
  }
  globalSessionTerminalLogs[sessionId] = logs
}

function extractUnseenHistory(fullHistory: string, sessionId: string): string {
  const lastSnap = globalSessionLastSnapshot[sessionId]
  let unseen = fullHistory
  if (lastSnap) {
    if (fullHistory === lastSnap) {
      unseen = ''
    } else if (fullHistory.startsWith(lastSnap)) {
      // Direct extension: new data was appended to existing snapshot without buffer rollover
      unseen = fullHistory.slice(lastSnap.length)
    } else {
      // Buffer rolled over (Electron ring buffer sliced at 200k chars): match tail from end
      const matchLengths = [500, 200, 100, 50, 20]
      let foundIndex = -1
      for (const len of matchLengths) {
        if (lastSnap.length >= len) {
          const tail = lastSnap.slice(-len)
          const idx = fullHistory.lastIndexOf(tail)
          if (idx !== -1) {
            foundIndex = idx + tail.length
            break
          }
        }
      }
      if (foundIndex !== -1) {
        unseen = fullHistory.slice(foundIndex)
      } else {
        unseen = fullHistory
      }
    }
  }
  globalSessionLastSnapshot[sessionId] = fullHistory
  return unseen
}

function isTextAlreadyInFeed(feed: FeedItem[], text: string): boolean {
  if (!text) return true
  const clean = text.trim()
  if (!clean) return true
  const cleanLower = clean.toLowerCase()

  const nonUserItems = feed.filter(item => item.type !== 'user')

  // 1. Direct match or existing item already covers the entire incoming text
  const singleItemMatch = nonUserItems.some(item => {
    if (item.text) {
      const itemTrimmed = item.text.trim()
      if (itemTrimmed) {
        const itemLower = itemTrimmed.toLowerCase()
        if (itemLower === cleanLower || itemLower.includes(cleanLower)) {
          return true
        }
      }
    }
    if (item.tools && Array.isArray(item.tools)) {
      for (const t of item.tools) {
        const c = (t.content || '').trim().toLowerCase()
        if (c && (c === cleanLower || c.includes(cleanLower))) {
          return true
        }
      }
    }
    return false
  })
  if (singleItemMatch) return true

  // 2. Line-by-line coverage: if every meaningful line of text is already represented in non-user feed items
  const cleanLines = clean.split('\n').map(l => l.trim()).filter(l => l.length > 2)
  if (cleanLines.length > 0 && cleanLines.every(cl => {
    const clLower = cl.toLowerCase()
    return nonUserItems.some(item => {
      if (item.text && item.text.toLowerCase().includes(clLower)) return true
      if (item.tools && Array.isArray(item.tools)) {
        return item.tools.some(t => (t.content || '').toLowerCase().includes(clLower))
      }
      return false
    })
  })) {
    return true
  }

  return false
}

export const Workspace: React.FC = () => {
  const taskId = useStore(state => state.activeTaskId)
  const repoId = useStore(state => state.activeRepoId)
  return <TaskWorkspace key={`${repoId || 'none'}:${taskId || 'none'}`} />
}

const TaskWorkspace: React.FC = () => {
  const { t } = useTranslation()
  const { 
    activeTaskId, 
    tasks, 
    repositories, 
    activeLogs, 
    activeFeed,
    startTask,
    updateTaskStatus,
    respondToPrompt,
    updateFeedItem,
    answeredPromptIds,
    recordAnsweredPrompt,
    
    // Expanded Zustand States & Methods
    rightPanelTab,
    setRightPanelTab,
    updateTodoStep,
    addTodoStep,
    deleteTodoStep,
    toggleTodoStep,
    mockFileContents,
    editFileContent,
    createNewFile,
    commitGitChanges,
    settings,
    activeRepoId,
    presets
  } = useStore()

  const task = tasks.find(t => t.id === activeTaskId)
  const repo = repositories.find(r => r.id === task?.repoId)
  const activeRepo = repositories.find(r => r.id === activeRepoId)
  const workState = useWorkFlow(task?.workFlowVersion === 1 && settings?.useMockData !== true ? task.id : undefined)
  const workArtifactIdentity = workState.snapshot?.artifacts.map(item => item.id).join(',')

  const [realFiles, setRealFiles] = useState<FileTreeNode[]>([])

  // Scan real files when repository, task worktree, or mock mode changes
  useEffect(() => {
    let current = true
    const scanDir = resolveTaskCwd(task, activeRepo) || activeRepo?.repoPath
    if (settings?.useMockData === false && scanDir) {
      window.ziafAPI.listProjectFiles({ projectPath: scanDir })
        .then(files => { if (current) setRealFiles(files) })
        .catch(err => console.error('Failed to list files:', err))
    }
    return () => { current = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.worktreePath, task?.id, activeRepo?.repoPath, activeRepo?.path, settings?.useMockData, workArtifactIdentity])
  
  // Model selector state dynamically loaded from presets
  const taskPreset = task?.model ?? resolveDefaultPreset(presets, settings?.defaultCodingPreset)
  const taskProvider = task?.agentProvider || structuredProvider(taskPreset, presets)
  const usesStructuredAgent = Boolean(task && settings?.useMockData !== true && task.agentTransport !== 'legacy-pty' && taskProvider)
  const workflowProgress = useWorkflowProgress(usesStructuredAgent && task?.workFlowVersion !== 1 ? task?.id : undefined)
  // Older tasks acquire their provider binding before Settings can mutate a
  // preset. Main persists the same binding when the first session is created.
  useEffect(() => {
    if (!task?.id || task.agentProvider || !usesStructuredAgent) return
    const taskId = task.id
    useStore.setState(state => ({ tasks: state.tasks.map(item => item.id === taskId && !item.agentProvider
      ? { ...item, agentProvider: taskProvider } : item) }))
  }, [task?.id, task?.agentProvider, usesStructuredAgent, taskProvider])
  const [modelSelection, setModelSelection] = useState<{ taskId?: string; model: string } | null>(null)
  const selectedModel = modelSelection && modelSelection.taskId === task?.id
    ? modelSelection.model
    : taskPreset
  const setSelectedModel = (model: string) => setModelSelection({ taskId: task?.id, model })
  const legacyReasoningUnsupported = !usesStructuredAgent && (task?.reasoningEffort != null || presets.find(preset => preset.name === selectedModel)?.reasoningEffort != null)

  const modelOptions = presets.length > 0
    ? presets.map(p => ({
        id: p.name,
        label: p.name,
        icon: p.agent.toLowerCase().includes('claude') ? '🔥' : '⚙'
      }))
    : [
        { id: 'auto', label: 'auto', icon: '⚙' }
      ]

  const [todoWidth, setTodoWidth] = useState(380)

  // Chat direct agent/model/permission selector states
  const [customAgentSelection, setCustomAgentSelection] = useState<{ taskId?: string; agent: string } | null>(null)
  const chatCustomAgent = customAgentSelection && customAgentSelection.taskId === task?.id
    ? customAgentSelection.agent
    : presets.find(preset => preset.name === selectedModel)?.agent || (/^claude[- ]/i.test(selectedModel) ? 'Claude Code' : 'Google Antigravity')
  const setChatCustomAgent = (agent: string) => setCustomAgentSelection({ taskId: task?.id, agent })
  const [chatCustomModels, setChatCustomModels] = useState<string[]>([])
  const [chatCustomPermissions, setChatCustomPermissions] = useState('Dangerously skip permissions')
  const [isLoadingChatModels, setIsLoadingChatModels] = useState(false)

  // Fetch models dynamically for custom agent select in chat
  useEffect(() => {
    let cancelled = false
    setIsLoadingChatModels(true)
    setChatCustomModels([])
    window.ziafAPI.getAgentModels({ agent: chatCustomAgent })
      .then(models => {
        if (cancelled) return
        setChatCustomModels(models)
        setIsLoadingChatModels(false)
      })
      .catch(err => {
        if (cancelled) return
        console.error(err)
        setIsLoadingChatModels(false)
      })
    return () => { cancelled = true }
  }, [chatCustomAgent])

  const pendingFirstInputBySession = useRef<Record<string, string>>(globalPendingFirstInput)
  const pendingFirstAttemptBySession = useRef<Record<string, string>>(globalPendingFirstAttemptId)
  const launchedSessionsRef = useRef<Set<string>>(new Set())
  const launchedAgentSessionsRef = useRef<Set<string>>(new Set())
  const launchingSessionsRef = useRef<Set<string>>(new Set())
  const activePromptIdBySession = useRef<Record<string, string>>(globalActivePromptIdBySession)
  const sessionPtyLogsRef = useRef<Record<string, string[]>>(globalSessionTerminalLogs)
  const accumulatedOutputBySession = useRef<Record<string, string>>(globalAccumulatedOutputBySession)
  const submittingPromptIds = useRef<Set<string>>(new Set())
  const [promptError, setPromptError] = useState<string | null>(null)

  // Auto-start toggle
  const [autoStartEnabled, setAutoStartEnabled] = useState(true)
  const [telemetryCollapsed, setTelemetryCollapsed] = useState(false)
  const [telemetryHeight, setTelemetryHeight] = useState(112) // ~7 lines
  const isResizingTelemetry = useRef(false)
  const telemetryScrollRef = useRef<HTMLPreElement>(null)

  const startResizingTelemetry = (e: React.MouseEvent) => {
    e.preventDefault()
    isResizingTelemetry.current = true
    const startY = e.clientY
    const startHeight = telemetryHeight
    const onMove = (ev: MouseEvent) => {
      if (!isResizingTelemetry.current) return
      const delta = ev.clientY - startY
      setTelemetryHeight(Math.max(40, startHeight + delta))
    }
    const onUp = () => {
      isResizingTelemetry.current = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const recentTabsKey = settings?.useMockData === true ? 'mock' : `ziaf-recent-chats:${task?.id || 'none'}`
  const history = useTaskChatHistory(task?.id, readRecentChats(recentTabsKey))
  const { centralTabs, setCentralTabs, activeTabId, setActiveTabId, recentTabs, customTabFeeds, setCustomTabFeeds } = history
  const workflowRussian = (settings?.uiLanguage || settings?.language || 'en').startsWith('ru')
  const codeChats = useWorkflowChats(task?.id, usesStructuredAgent && task?.codeFlowVersion === 1 && task.mode !== 'work', history, workflowRussian)
  const workChats = useWorkFlowChats(task?.workFlowVersion === 1 ? task.id : undefined, workState.snapshot, history, workflowRussian)
  const workflowChats = task?.workFlowVersion === 1 ? workChats : codeChats
  const chatMessage = history.drafts[activeTabId] || ''
  const setChatMessage = (value: string) => history.setDrafts(previous => ({ ...previous, [activeTabId]: value }))
  const tabHistoryTransaction = useRef(false)
  const persistChatHistoryRef = useRef(history.save)
  persistChatHistoryRef.current = () => { if (!tabHistoryTransaction.current) history.save() }
  const setRecentTabs = (update: (previous: CentralTab[]) => CentralTab[]) => {
    history.setRecentTabs(previous => {
      const tabs = update(previous)
      if (settings?.useMockData !== true && task?.id) {
        try { localStorage.setItem(recentTabsKey, JSON.stringify(tabs)) } catch { /* Disk-backed history remains authoritative. */ }
      }
      return tabs
    })
  }
  const activitySessionId = (activeTabId === 'feed' || activeTabId === 'chat-main')
    ? (task?.id ? `term-task-${task.id}-0` : (activeRepo ? `term-${activeRepo.id}-0` : 'term-default-0'))
    : activeTabId
  const isAgentRunning = useSyncExternalStore(agentActivity.subscribe, () => agentActivity.isRunning(activitySessionId))
  const activeTabIdRef = useRef<string>(activeTabId)
  activeTabIdRef.current = activeTabId
  const isMountedRef = useRef(true)
  const taskRef = useRef(task)
  taskRef.current = task

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      abortPendingTabSend(activeTabIdRef.current, taskRef.current?.id)
    }
  }, [])
  const [_customTabScreens, setCustomTabScreens] = useState<Record<string, string[]>>(() => ({ ...globalCustomTabScreens }))
  const ptyScreenState = useRef<Record<string, { cursorRow: number, cursorCol: number, savedRow: number, savedCol: number, trailing: string }>>(globalPtyScreenState)
  // Ref mirrors for reading current state in flushPtyBuffer without nesting setState calls
  const customTabScreensRef = useRef<Record<string, string[]>>(globalCustomTabScreens)
  const customTabFeedsRef = useRef<Record<string, FeedItem[]>>(customTabFeeds)
  const centralTabsRef = useRef<CentralTab[]>(centralTabs)
  const [customTabPids, setCustomTabPids] = useState<Record<string, Array<{ pid: number, command: string }>>>({})

  useEffect(() => {
    centralTabsRef.current = centralTabs
  }, [centralTabs])

  const updateCustomTabFeed = useCallback((tabId: string, updater: (prev: FeedItem[]) => FeedItem[]) => {
    const current = customTabFeedsRef.current[tabId] || []
    const next = withFeedTurns(updater(current), tabId)
    globalCustomTabFeeds[tabId] = next
    customTabFeedsRef.current[tabId] = next
    setCustomTabFeeds(prev => ({
      ...prev,
      [tabId]: next
    }))
    return next
  }, [setCustomTabFeeds])

  // Hydrated feeds belong only to this task; backend sessions stay alive across view switches.
  customTabFeedsRef.current = customTabFeeds
  useEffect(() => { Object.assign(globalCustomTabFeeds, customTabFeeds) }, [customTabFeeds])

  // File explorer new file input state
  const [showNewFileInput, setShowNewFileInput] = useState(false)
  const [newFilePath, setNewFilePath] = useState('')
  const [showNewFolderInput, setShowNewFolderInput] = useState(false)
  const [newFolderPath, setNewFolderPath] = useState('')

  // Git Commit form state
  const [commitMessage, setCommitMessage] = useState('')
  const [gitStatusAlert, setGitStatusAlert] = useState(false)

  // PlanPanel draft state (preserved across tab/panel switching)
  const [todoDraft, setTodoDraft] = useState('')
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([])

  const logDebug = (message: string) => {
    window.ziafAPI.writeDebugLog({ message }).catch(err => console.error('writeDebugLog failed:', err))
  }

  const isTerminalNoise = useCallback((line: unknown, allUserMsgs?: string[]): boolean => {
    if (!line || typeof line !== 'string') return true;
    
    // Decode percent-encoding (Russian paths, etc.)
    let clean = line;
    try {
      clean = decodeURIComponent(clean);
    } catch { /* ignore */ }

    // Strip ANSI escape sequences explicitly
    // eslint-disable-next-line no-control-regex
    clean = clean.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');

    // Strip all non-printable control characters
    // eslint-disable-next-line no-control-regex
    clean = clean.replace(/[\x00-\x1F\x7F-\x9F]/g, "").trim();

    if (!clean || clean.length <= 1) return true;
    
    // Terminal escape codes, title settings, color codes, backspace, spinner artifacts
    if (clean.includes(']2;') || clean.includes(']1;') || clean.includes('1uW4;2m1;1u') || clean.includes('[?u') || clean.includes('4m0;1u') || clean.includes('[m')) return true;
    
    // ASCII Art (Antigravity CLI logo blocks)
    if (clean.includes('▄') || clean.includes('▀') || clean.includes('▄▀▀') || clean.includes('▀▀▄')) return true;
    
    // Echoed inputs from shell (filter echoes including wrapped lines from long messages)
    if (allUserMsgs) {
      const msgs = Array.isArray(allUserMsgs) ? allUserMsgs : [allUserMsgs];
      const normalize = (s: string) => s.toLowerCase().replace(/[^a-zа-яё0-9]/g, '');
      const cleanNorm = normalize(clean);
      if (cleanNorm.length > 2) {
        if (msgs.some(uMsg => {
          const uNorm = normalize(uMsg);
          if (!uNorm) return false;
          // Exact match
          if (cleanNorm === uNorm) return true;
          // Short echo: very close in length (within 4 chars)
          if (Math.abs(cleanNorm.length - uNorm.length) <= 4 && (uNorm.includes(cleanNorm) || cleanNorm.includes(uNorm))) return true;
          // Wrapped/truncated echo: terminal line is a contiguous substring of user message
          // Only match if the fragment is long enough (>10 chars) to avoid false positives
          if (cleanNorm.length > 10 && uNorm.length > cleanNorm.length && uNorm.includes(cleanNorm)) return true;
          return false;
        })) return true;
      }
    }

    // Diagnostic lines (errors, warnings, failure, permission, missing config) are NEVER noise
    const isDiagnosticLine = /\b(error|warning|fatal|failed|failure|aborted|invalid|required|rejected|eacces|enoent|cannot|denied)\b/i.test(clean);
    if (isDiagnosticLine) {
      return false;
    }
    if (isInteractivePrompt(clean) || parsePromptOption(clean)) return false;

    // Echoed shell setup and model status bars are UI chrome, not assistant replies.
    const shellLine = clean.replace(/^(?:.*?[$%❯›>]\s+|->\s+\S+\s+)/, '')
    if (/^(?:export\s+(?:LANG|LC_ALL|LC_CTYPE)=|clear(?:\s|;|$))/.test(shellLine)) return true;
    if (/^(?:agy|claude|codex)(?:\s+--[\w-]+(?:[ =].*)?)?$/.test(shellLine)) return true;
    if (/\b(?:Gemini|Claude|GPT|OpenAI Codex)\b.*·\s*(?:high|medium|low|auto|thinking)/i.test(clean)) return true;
    if (/^(?:Gemini|Claude|GPT|OpenAI Codex)\b[^·|]*[·|]\s*(?:high|medium|low|auto|thinking)\b(?:\s*[·|].*)?$/i.test(clean)) return true;
    if (clean.includes('Google AI Ultra')) return true;

    // Terminal separators (horizontal lines / dividers)
    if (/^[_\-=*─═\s]{3,}$/.test(clean) || clean.includes('____') || clean.includes('====') || clean.includes('****') || clean.includes('───') || clean.includes('═══')) return true;
    if (/^-{4,}$/.test(clean)) return true;

    // Interactive choices themselves (so we don't display choices as static text since we render UI buttons instead)
    if (/^(?:[>❯›▸*•○-]\s*)?(?:\d+[.)]\s*)?(?:Yes,\s*run\s*command|Yes,\s*and\s*always|No,\s*cancel|Yes,\s*I\s*trust|No,\s*exit|Allow\s*once|Allow\s*always|Deny)/i.test(clean)) return true;
    if (clean.includes('Yes, run command') || clean.includes('No, cancel') || clean.includes('Yes, I trust') || clean.includes('No, exit') || clean.includes('Allow once') || clean.includes('Allow always')) return true;

    // Tool calls marker lines are NEVER noise; other ●/○ lines (like status indicators) are noise
    if (clean.startsWith('●') || clean.startsWith('○')) {
      if (/^[●○]\s*[a-zA-Z0-9_]+\s*\(/.test(clean)) return false;
      return true;
    }

    // Spinner loaders and CLI indicators (> is the shell prompt, ? is interactive selector)
    if (clean === '>' || (clean.startsWith('> ') && clean.length < 5) || clean.startsWith('? ') || /^[\u2800-\u28FF]/.test(clean)) return true;
    
    // Startup banner and CLI header stats
    if (/^Welcome to (?:the )?Antigravity CLI/i.test(clean) || clean.includes('Signing in...') || clean.includes('Accessing workspace:')) return true;
    if (/^Antigravity CLI [\d.]+/.test(clean) || clean.includes('Welcome to Claude Code') || /^claude(\s+code|\s+\d|\s+opus|\s+sonnet|\s+haiku)?\s*(\(v[\d.]+\)|v[\d.]+|[─━┌┐╭╮│]+|$)/i.test(clean) || clean.includes('@gmail.com') || clean.includes('for shortcuts')) return true;
    if (clean.includes('Process exited with code')) return true;
    // Only filter short standalone workspace path mentions (not AI responses referencing paths)
    if (clean.includes('ZIAForge-Workspace') && clean.length < 60 && !clean.startsWith('●') && !clean.startsWith('○') && !clean.startsWith('•')) return true;
    // CLI tips and hints
    if (/^[└\s*•○-]*Tip\s*:/i.test(clean) || /^Tip\s*:\s*/i.test(clean) || clean === 'Tip:' || clean === 'Tip :' || clean === 'Подсказка:') return true;
    
    // agy TUI status bar lines
    if (clean.includes('to cancel') || clean.includes('Generating...') || /Still processing/i.test(clean)) return true;
    if (clean === 'Command' || clean === 'command') return true;
    if (clean.includes('Navigate') && (clean.includes('Confirm') || clean.includes('Amend') || clean.includes('enter') || clean.includes('tab') || clean.includes('ctrl'))) return true;
    if (clean.includes('edit/expand command')) return true;
    if (clean.startsWith('> ') && clean.length < 3) return true;
    
    // agy TUI boot/shell prompts and inputs
    if (clean.startsWith('-> repo') || (clean.startsWith('->') && clean.length < 30) || clean === 'pp' || clean === 'p' || clean === 'y' || clean === 'n') return true;

    // Command invocations
    const commandLower = clean.toLowerCase();
    if (commandLower === 'agy' || commandLower === 'claude' || commandLower === 'aagy' || commandLower === 'gy' || commandLower === 'gy gy' || commandLower === ' привет') return true;
    if (commandLower.startsWith('repo ') && (commandLower.includes('agy') || commandLower.includes('claude'))) return true;
    
    return false;
  }, [])

  const extractMeaningfulText = useCallback((rawText: string, allUserMsgs?: string[]): string => {
    if (!rawText) return ''
    // eslint-disable-next-line no-control-regex
    const clean = rawText.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '')
    const lines = clean.split('\n').map(l => l.trim()).filter(l => l && !isTerminalNoise(l, allUserMsgs || []))
    return lines.join('\n')
  }, [isTerminalNoise])

  /**
   * Parse virtual screen lines into structured feed items:
   * - Thinking text (reasoning lines before/between tool calls)
   * - Tool calls (● ListDir, ● Read, etc.)
   * - AI response text (final message after all tools)
   */
  const parseScreenToStructuredFeed = (rawLines: string[], allUserMsgs?: string[], tabId?: string, runningCmds: string[] = []): FeedItem[] => {
    const gen = tabId && globalSessionGenerations[tabId] !== undefined ? `-g${globalSessionGenerations[tabId]}` : ''
    const idBase = tabId ? `${tabId}${gen}` : 'pty'
    // Sanitize: ensure every element is a string (guards ALL downstream .trim() calls)
    const lines = rawLines.map(l => (l != null && typeof l === 'string') ? l : '')
    if (lines.length === 0 || !allUserMsgs || allUserMsgs.length === 0) return []

    // 1. Split lines into turns based on user echoes
    interface Turn {
      userMsg: string
      aiLines: string[]
      uIdx: number
    }
    const turns: Turn[] = []

    // Helper to check if a line is a user prompt echo
    const isUserEchoLine = (line: unknown, uMsg: unknown): boolean => {
      if (!line || typeof line !== 'string' || !uMsg || typeof uMsg !== 'string') return false
      const cleanLine = line.trim().toLowerCase().replace(/^>\s*/, '').trim()
      const cleanMsg = uMsg.trim().toLowerCase()
      if (!cleanLine) return false
      // Exact match or contains
      if (cleanLine === cleanMsg) return true
      if (cleanLine.length > 3 && cleanMsg.includes(cleanLine)) return true
      if (cleanMsg.length > 3 && cleanLine.includes(cleanMsg)) return true
      return false
    }

    // Find the line index of each visible user message echo in order
    const echoPositions: { uIdx: number; lineIdx: number }[] = []
    let searchStart = 0
    const normalize = (s: string) => s ? s.toLowerCase().replace(/[^a-zа-яё0-9]/g, '') : '';
    for (let uIdx = 0; uIdx < allUserMsgs.length; uIdx++) {
      const uMsg = allUserMsgs[uIdx]
      let foundIdx = -1
      for (let i = searchStart; i < lines.length; i++) {
        if (isUserEchoLine(lines[i], uMsg)) {
          foundIdx = i
          break
        }
      }
      if (foundIdx !== -1) {
        echoPositions.push({ uIdx, lineIdx: foundIdx })
        // Skip all subsequent wrapped/continuation lines that are substrings of the user message
        const uNorm = normalize(uMsg)
        let skipEnd = foundIdx + 1
        while (skipEnd < lines.length) {
          const rawLine = lines[skipEnd]
          if (!rawLine || typeof rawLine !== 'string') {
            skipEnd++
            continue
          }
          const lineNorm = normalize(rawLine.trim())
          if (lineNorm.length > 5 && uNorm.includes(lineNorm)) {
            skipEnd++
          } else {
            break
          }
        }
        searchStart = skipEnd
      }
    }

    if (echoPositions.length === 0) {
      // No echoes visible: treat the entire screen as the latest message's response
      const latestUIdx = allUserMsgs.length - 1
      turns.push({
        userMsg: allUserMsgs[latestUIdx],
        aiLines: lines,
        uIdx: latestUIdx
      })
    } else {
      // 1. Before the first visible echo
      const first = echoPositions[0]
      if (first.lineIdx > 0 && first.uIdx > 0) {
        turns.push({
          userMsg: allUserMsgs[first.uIdx - 1],
          aiLines: lines.slice(0, first.lineIdx),
          uIdx: first.uIdx - 1
        })
      }

      // 2. Between visible echoes
      for (let k = 0; k < echoPositions.length - 1; k++) {
        const curr = echoPositions[k]
        const next = echoPositions[k + 1]
        turns.push({
          userMsg: allUserMsgs[curr.uIdx],
          aiLines: lines.slice(curr.lineIdx + 1, next.lineIdx),
          uIdx: curr.uIdx
        })
      }

      // 3. After the last visible echo
      const last = echoPositions[echoPositions.length - 1]
      turns.push({
        userMsg: allUserMsgs[last.uIdx],
        aiLines: lines.slice(last.lineIdx + 1),
        uIdx: last.uIdx
      })
    }

    // 2. Parse each turn into structured feed items
    const feedItems: FeedItem[] = []
    
    for (const turn of turns) {
      const tIdx = turn.uIdx

      // Clean up lines for this turn's AI response
      const cleanLines = turn.aiLines
        .map(line => {
          let l = line
          try { l = decodeURIComponent(l) } catch { /* ignore */ }
          return l
        })
        .filter(line => {
          if (!line || typeof line !== 'string') return false
          const trimmed = line.trim()
          return trimmed && !isTerminalNoise(trimmed, allUserMsgs)
        })

      if (cleanLines.length === 0) continue

      // Identify segments within this turn
      const segments: { type: 'thinking' | 'tool' | 'response', text: string }[] = []
      let currentThinking: string[] = []
      let lastToolIdx = -1

      // Tool call regex matches "● Name(Args)" or "○ Name(Args)" or "• Name(Args)"
      const toolCallRegex = /^[●○]\s*[a-zA-Z0-9_]+\s*\(/

      for (let i = 0; i < cleanLines.length; i++) {
        if (toolCallRegex.test(cleanLines[i].trim())) lastToolIdx = i
      }

      for (let i = 0; i < cleanLines.length; i++) {
        const trimmed = cleanLines[i].trim()
        
        if (toolCallRegex.test(trimmed)) {
          if (currentThinking.length > 0) {
            segments.push({ type: 'thinking', text: currentThinking.join('\n') })
            currentThinking = []
          }
          segments.push({ type: 'tool', text: trimmed })
        } else if (lastToolIdx >= 0 && i > lastToolIdx) {
          const responseLines = cleanLines.slice(i).map(l => l.trim()).join('\n')
          segments.push({ type: 'response', text: responseLines })
          break
        } else {
          currentThinking.push(trimmed)
        }
      }

      if (lastToolIdx === -1 && currentThinking.length > 0) {
        segments.push({ type: 'response', text: currentThinking.join('\n') })
        currentThinking = []
      }

      if (currentThinking.length > 0) {
        segments.push({ type: 'thinking', text: currentThinking.join('\n') })
      }

      // Build structured items for this turn
      const toolItems: ToolItem[] = []
      let thinkingCount = 0
      let toolCount = 0
      let lastToolCall = ''
      let promptCounter = 0

      for (const seg of segments) {
        if (seg.type === 'tool') {
          const toolText = seg.text.replace(/\s*\(ctrl\+o to expand\)\s*$/, '')
          if (toolText === lastToolCall) continue
          lastToolCall = toolText
          const normalizedTool = normalizeCommandLine(toolText)
          const isRunning = runningCmds.some(cmd => {
            const normalizedCmd = normalizeCommandLine(cmd)
            return normalizedTool.includes(normalizedCmd) || normalizedCmd.includes(normalizedTool)
          })
          toolItems.push({ type: 'ran', title: uiText("Tool"), content: toolText, isRunning })
          toolCount++
          continue
        }

        // Handle thinking and response segments, parsing prompts inline
        const lines = seg.text.split('\n')
        let currentTextLines: string[] = []
        
        let i = 0
        while (i < lines.length) {
          const line = lines[i]
          const cleanLine = line.trim().replace(/^[*•○\-\s]+/, '')
          const isPromptStart = isInteractivePrompt(cleanLine)
          
          if (isPromptStart) {
            // Push any accumulated preceding text
            if (currentTextLines.length > 0) {
              const text = currentTextLines.join('\n').trim()
              if (text) {
                if (seg.type === 'thinking') {
                  toolItems.push({ type: 'thinking', title: uiText("Thinking"), content: text })
                  thinkingCount++
                } else if (seg.type === 'response') {
                  feedItems.push({
                    id: `ai-custom-pty-${idBase}-${tIdx}`,
                    type: 'ai' as const,
                    text: text
                  })
                }
              }
              currentTextLines = []
            }
            
            // Parse prompt lines and options
            const promptTextLines: string[] = []
            const promptActions: PromptAction[] = []
            let inPrompt = true
            const startPromptIdx = i
              
              while (i < lines.length && inPrompt) {
                const t = lines[i].trim()
                const cleanT = t.replace(/^[*•○\-\s▸◂▪▫]+/, '')
                
                const isToolLine = i > startPromptIdx && (t.startsWith('●') || t.startsWith('○') || t.startsWith('•'))
                const isThinkingLine = cleanT.startsWith('Thought for') || 
                                       cleanT.toLowerCase().startsWith('thinking') || 
                                       cleanT.toLowerCase().startsWith('мышление') || 
                                       cleanT.includes('ии-ассистент') ||
                                       cleanT.toLowerCase().startsWith('pensamiento') ||
                                       cleanT.toLowerCase().startsWith('pensando') ||
                                       cleanT.toLowerCase().startsWith('pensée') ||
                                       cleanT.toLowerCase().startsWith('gedanke') ||
                                       cleanT.toLowerCase().startsWith('denken')
                const isDivider = t.includes('───') || t.includes('===') || t.includes('___')
                const isOption = parsePromptOption(t)
                const isNavLine = /↑\/↓\s*Navigate|Navigate\s*·|enter\s*Confirm/i.test(t)
                const isNewPromptStart = i > startPromptIdx && !isNavLine && isInteractivePrompt(cleanT)
              
              const hasInlineActions = promptActionsForText(promptTextLines.join('\n')).length > 0
              if (isToolLine || isThinkingLine || isDivider || isNewPromptStart || ((promptActions.length > 0 || hasInlineActions) && !isOption && !isNavLine)) {
                inPrompt = false
                if (i > startPromptIdx) {
                  i-- // Step back to process this line in the next outer iteration
                }
                break
              }
              
              const optionMatch = parsePromptOption(t)
              if (optionMatch) {
                promptActions.push({
                  id: optionMatch.id,
                  label: optionMatch.label
                })
              } else {
                promptTextLines.push(lines[i])
              }
              i++
            }
            
            if (promptTextLines.length > 0 || promptActions.length > 0) {
              const pIdx = promptCounter++
              const fullText = promptTextLines.join('\n')
              const actionsFromText = promptActionsForText(fullText)
              const isNav = /↑\/↓\s*Navigate|Navigate\s*·|enter\s*Confirm/i.test(fullText)
              const baseActions = actionsFromText.length ? actionsFromText : promptActions
              const resolvedActions = baseActions.map((act, idx) => ({
                ...act,
                payload: act.payload ?? (isNav ? (idx === 0 ? '\r' : '\u001b[B'.repeat(idx) + '\r') : (act.id + '\r'))
              }))
              toolItems.push({
                type: 'prompt',
                id: `prompt-custom-pty-${idBase}-${tIdx}-${pIdx}`,
                text: fullText,
                promptActions: resolvedActions.length ? resolvedActions : undefined
              })
            }
          } else {
            currentTextLines.push(line)
          }
          i++
        }
        
        // Push any remaining text
        if (currentTextLines.length > 0) {
          const text = currentTextLines.join('\n').trim()
          if (text) {
            if (seg.type === 'thinking') {
              toolItems.push({ type: 'thinking', title: uiText("Thinking"), content: text })
              thinkingCount++
            } else if (seg.type === 'response') {
              feedItems.push({
                id: `ai-custom-pty-${idBase}-${tIdx}`,
                type: 'ai' as const,
                text: text
              })
            }
          }
        }
      }

      if (toolItems.length > 0) {
        const promptStats = promptCounter > 0 ? ` · ${uiText("Permissions: {count}", { count: promptCounter })}` : ''
        feedItems.push({
          id: `tools-custom-pty-${idBase}-${tIdx}`,
          type: 'tools' as const,
          toolStats: `${uiText("Thinking: {thinking} · Tools: {tools}", { thinking: thinkingCount, tools: toolCount })}${promptStats}`,
          tools: toolItems
        })
      }
    }

    return feedItems
  }

  const activeCustomPtySessions = useRef<Set<string>>(new Set())
  // Cleanup functions for per-tab PTY resources (onPtyData listener, processCheckInterval, ptyFlushTimer)
  const ptyTabCleanups = useRef<Record<string, () => void>>({})
  const chatScrollRef = useRef<HTMLDivElement>(null)
  
  const [terminalTabs, setTerminalTabs] = useState<string[]>(['zsh 1'])
  const [activeTermTabIdx, setActiveTermTabIdx] = useState(0)

  // Browser State
  const [browserUrlInput, setBrowserUrlInput] = useState('https://www.google.com/')
  const [browserActiveUrl, setBrowserActiveUrl] = useState('https://www.google.com/')
  const [browserResultsHtml, setBrowserResultsHtml] = useState<string>('google')
  const [browserSearchQuery, setBrowserSearchQuery] = useState('')

  // Git diff expanded list
  const [gitExpandedDiffs, setGitExpandedDiffs] = useState<Record<string, boolean>>({
    'g2': true // default expand validation.php diff
  })

  // File explorer collapsible folders
  const [folderOpenStates, setFolderOpenStates] = useState<Record<string, boolean>>({
    'src': true,
    'src/spam': true,
    'data': true,
    'data/crm': true
  })

  const activeTab = centralTabs.find(t => t.id === activeTabId) || centralTabs[0]

  const getTaskAgentSessionId = useCallback((taskId?: string) => {
    return taskId
      ? `term-task-${taskId}-0`
      : (activeRepo ? `term-${activeRepo.id}-0` : 'term-default-0')
  }, [activeRepo])

  const getSessionIdForTab = useCallback((tabId: string) => {
    if (tabId === 'feed' || tabId === 'chat-main' || tabId.startsWith('file-') || tabId.startsWith('browser-')) {
      return getTaskAgentSessionId(task?.id)
    }
    return tabId
  }, [task?.id, getTaskAgentSessionId])

  const clearSessionLifecycleState = useCallback((
    sessionId: string, 
    targetTaskId?: string, 
    options?: { preservePendingInputs?: boolean; preserveGeneration?: boolean }
  ) => {
    if (options?.preservePendingInputs) agentActivity.boot(sessionId)
    else agentActivity.finish(sessionId)
    if (!options?.preserveGeneration) {
      globalSessionFrontendGenerations[sessionId] = (globalSessionFrontendGenerations[sessionId] || 0) + 1
    }
    globalLaunchedSessions.add(sessionId)
    globalLaunchedAgentSessions.delete(sessionId)
    globalAgentReadySessions.delete(sessionId)
    delete globalAgentReadyFrontendGenerations[sessionId]
    globalAgentAwaitingReadySessions.add(sessionId)
    globalSessionVerifyingLiveness.add(sessionId)
    const isCustomSession = !sessionId.startsWith('term-') ||
      Boolean(globalCustomTabFeeds[sessionId] || customTabFeedsRef.current[sessionId] || centralTabsRef.current?.some(t => t.id === sessionId))
    let allUserMsgs: string[] = []
    if (isCustomSession) {
      const currentFeed = customTabFeedsRef.current[sessionId] || globalCustomTabFeeds[sessionId] || []
      allUserMsgs = currentFeed.filter(item => item.type === 'user').map(item => item.text).filter((t): t is string => Boolean(t))
    } else {
      const taskFeed = useStore.getState().tasks.find(t => t.id === targetTaskId)?.feed || useStore.getState().activeFeed || []
      allUserMsgs = taskFeed.filter(item => item.type === 'user').map(item => item.text).filter((t): t is string => Boolean(t))
    }
    const leftover = extractMeaningfulText(accumulatedOutputBySession.current[sessionId] || '', allUserMsgs)
    if (leftover) {
      if (isCustomSession) {
        updateCustomTabFeed(sessionId, current => {
          if (isTextAlreadyInFeed(current, leftover)) {
            return current
          }
          const lastItem = current[current.length - 1]
          if (lastItem && lastItem.type === 'ai' && lastItem.text && leftover.startsWith(lastItem.text)) {
            return [
              ...current.slice(0, -1),
              { ...lastItem, text: leftover }
            ]
          }
          return [
            ...current,
            {
              id: `ai-custom-log-${Date.now()}-${Math.random()}`,
              type: 'ai' as const,
              text: leftover
            }
          ]
        })
      } else {
        const taskFeed = useStore.getState().tasks.find(t => t.id === targetTaskId)?.feed || useStore.getState().activeFeed || []
        if (!isTextAlreadyInFeed(taskFeed, leftover)) {
          const lastItem = taskFeed[taskFeed.length - 1]
          if (lastItem && lastItem.type === 'ai' && lastItem.text && leftover.startsWith(lastItem.text)) {
            useStore.getState().updateFeedItem(lastItem.id, { text: leftover }, targetTaskId)
          } else {
            useStore.getState().appendFeedItem({
              id: `ai-pty-log-${Date.now()}-${Math.random()}`,
              type: 'ai',
              text: leftover
            }, targetTaskId)
          }
        }
      }
    }
    delete globalAgentBootBuffers[sessionId]
    accumulatedOutputBySession.current[sessionId] = ''
    globalAccumulatedOutputBySession[sessionId] = ''
    delete globalPtyScreenState[sessionId]
    delete globalCustomTabScreens[sessionId]
    launchingSessionsRef.current.delete(sessionId)
    delete sessionDeliveryLocks[sessionId]
    if (!options?.preservePendingInputs) {
      bumpSessionCancellation(sessionId)
      delete globalPendingMessagesQueue[sessionId]
      delete globalPendingFirstInput[sessionId]
      delete pendingFirstInputBySession.current[sessionId]
      delete pendingFirstAttemptBySession.current[sessionId]
      globalFirstInputVersions[sessionId] = (globalFirstInputVersions[sessionId] || 0) + 1
      if (targetTaskId) {
        const queueKey = getQueueKey(sessionId, targetTaskId)
        delete globalPendingMessagesQueue[queueKey]
        delete globalPendingFirstInput[queueKey]
        globalFirstInputVersions[queueKey] = (globalFirstInputVersions[queueKey] || 0) + 1
      }
      for (const k of Object.keys(globalPendingMessagesQueue)) {
        if (k.startsWith(`${sessionId}:`)) {
          delete globalPendingMessagesQueue[k]
        }
      }
      for (const k of Object.keys(globalPendingFirstInput)) {
        if (k.startsWith(`${sessionId}:`)) {
          delete globalPendingFirstInput[k]
          delete globalPendingFirstAttemptId[k]
          globalFirstInputVersions[k] = (globalFirstInputVersions[k] || 0) + 1
        }
      }
      delete globalPendingFirstAttemptId[sessionId]
      if (targetTaskId) {
        delete globalPendingFirstAttemptId[`${sessionId}:${targetTaskId}`]
        delete globalPendingFirstAttemptId[getQueueKey(sessionId, targetTaskId)]
      }
    }
    delete globalSessionLastSnapshot[sessionId]
    delete activePromptIdBySession.current[sessionId]
    delete globalActivePromptIdBySession[sessionId]

    launchedSessionsRef.current.delete(sessionId)
    launchedAgentSessionsRef.current.delete(sessionId)
  }, [extractMeaningfulText, updateCustomTabFeed])

  const deliverFirstAndQueuedMessages = useCallback(async (
    sessionId: string,
    targetTaskId?: string
  ) => {
    if (sessionDeliveryLocks[sessionId] !== undefined) {
      logDebug(`deliverFirstAndQueuedMessages: delivery already in progress for sessionId=${sessionId}, new messages will be processed in order by active pump`)
      return
    }
    if (globalStoppedSessions.has(sessionId)) {
      logDebug(`deliverFirstAndQueuedMessages: sessionId=${sessionId} is stopped, aborting pump`)
      return
    }
    if (targetTaskId && globalStoppedSessions.has(targetTaskId)) {
      logDebug(`deliverFirstAndQueuedMessages: targetTaskId=${targetTaskId} is stopped, aborting pump`)
      return
    }
    if (globalSessionVerifyingLiveness.has(sessionId) || globalAgentAwaitingReadySessions.has(sessionId)) {
      logDebug(`deliverFirstAndQueuedMessages: agent liveness check or readiness pending for sessionId=${sessionId}, deferring pump`)
      return
    }
    if (globalLaunchedSessions.has(sessionId) && !isSessionAgentReady(sessionId)) {
      logDebug(`deliverFirstAndQueuedMessages: session ${sessionId} is not ready in current generation, deferring pump`)
      return
    }
    if (targetTaskId && globalSessionTaskOwners[sessionId] && globalSessionTaskOwners[sessionId] !== targetTaskId) {
      logDebug(`deliverFirstAndQueuedMessages: task owner changed for sessionId=${sessionId}, aborting pump`)
      return
    }
    const currentPumpGen = globalSessionFrontendGenerations[sessionId] || 0
    const queueKey = getQueueKey(sessionId, targetTaskId)
    const pumpToken = Math.random()
    sessionDeliveryLocks[sessionId] = pumpToken
    let pumpHadWriteFailure = false

    try {
      const firstMsgKey = getQueueKey(sessionId, targetTaskId)
      const capturedFirstVer = globalFirstInputVersions[firstMsgKey] || 0
      const capturedSessionVer = globalFirstInputVersions[sessionId] || 0
      const firstMsg = targetTaskId 
        ? globalPendingFirstInput[firstMsgKey]
        : (globalPendingFirstInput[firstMsgKey] || globalPendingFirstInput[sessionId] || pendingFirstInputBySession.current[sessionId])
      const attemptId = globalPendingFirstAttemptId[firstMsgKey] || globalPendingFirstAttemptId[sessionId] || pendingFirstAttemptBySession.current[sessionId]

      if (firstMsg) {
        if (targetTaskId && globalSessionTaskOwners[sessionId] && globalSessionTaskOwners[sessionId] !== targetTaskId) {
          logDebug(`deliverFirstAndQueuedMessages: task owner changed before first message write for sessionId=${sessionId}, aborting pump`)
          return
        }

        // Immediately delete from globalPendingFirstInput as soon as the pump captures it for delivery!
        // This guarantees handleSendChatMessage will not duplicate it into the queue if writePty response is delayed.
        if (attemptId) {
          if (globalPendingFirstAttemptId[firstMsgKey] === attemptId) {
            delete globalPendingFirstInput[firstMsgKey]
            delete globalPendingFirstAttemptId[firstMsgKey]
          }
          if (globalPendingFirstAttemptId[sessionId] === attemptId) {
            delete globalPendingFirstInput[sessionId]
            delete globalPendingFirstAttemptId[sessionId]
          }
          if (pendingFirstAttemptBySession.current[sessionId] === attemptId) {
            delete pendingFirstInputBySession.current[sessionId]
            delete pendingFirstAttemptBySession.current[sessionId]
          }
        } else {
          if ((globalFirstInputVersions[firstMsgKey] || 0) === capturedFirstVer && globalPendingFirstInput[firstMsgKey] === firstMsg) {
            delete globalPendingFirstInput[firstMsgKey]
            delete globalPendingFirstAttemptId[firstMsgKey]
          }
          if ((globalFirstInputVersions[sessionId] || 0) === capturedSessionVer && globalPendingFirstInput[sessionId] === firstMsg) {
            delete globalPendingFirstInput[sessionId]
            delete globalPendingFirstAttemptId[sessionId]
          }
          if (pendingFirstInputBySession.current[sessionId] === firstMsg) {
            delete pendingFirstInputBySession.current[sessionId]
          }
        }

        const isCancelledBeforeWrite = attemptId ? globalCancelledAttemptIds.has(attemptId) : false
        const isStoppedBeforeWrite = globalStoppedSessions.has(sessionId) || (targetTaskId ? globalStoppedSessions.has(targetTaskId) : false)
        if (isCancelledBeforeWrite || isStoppedBeforeWrite) {
          logDebug(`Background PTY manager: attemptId=${attemptId} is cancelled/stopped before writePty for sessionId=${sessionId}, aborting delivery`)
          return
        }

        logDebug(`Background PTY manager: delivering pending first input chars=${firstMsg.length}, attemptId=${attemptId}, sessionId=${sessionId}`)
        const writePromise = writeAgentInput(sessionId, `${firstMsg}\r`)
          .catch((err: Error) => ({ success: false, error: err?.message || String(err) }))

        if (attemptId) {
          globalInFlightWritePromises.set(attemptId, writePromise)
          globalSessionActiveWriteAttempts.set(sessionId, attemptId)
          if (targetTaskId) {
            globalSessionActiveWriteAttempts.set(targetTaskId, attemptId)
            globalSessionActiveWriteAttempts.set(`${sessionId}:${targetTaskId}`, attemptId)
          }
        }

        const writeRes = await writePromise

        if (attemptId) {
          globalInFlightWritePromises.delete(attemptId)
          if (globalSessionActiveWriteAttempts.get(sessionId) === attemptId) {
            globalSessionActiveWriteAttempts.delete(sessionId)
          }
          if (targetTaskId) {
            if (globalSessionActiveWriteAttempts.get(targetTaskId) === attemptId) {
              globalSessionActiveWriteAttempts.delete(targetTaskId)
            }
            const qKey = `${sessionId}:${targetTaskId}`
            if (globalSessionActiveWriteAttempts.get(qKey) === attemptId) {
              globalSessionActiveWriteAttempts.delete(qKey)
            }
          }
        }

        if (writeRes?.success) {
          if (attemptId) {
            recordDeliveredAttempt(attemptId)
          }
        } else {
          pumpHadWriteFailure = true
          const isCancelled = attemptId ? globalCancelledAttemptIds.has(attemptId) : false
          if (!isCancelled) {
            if (attemptId) {
              if (!globalPendingFirstAttemptId[firstMsgKey] || globalPendingFirstAttemptId[firstMsgKey] === attemptId) {
                globalPendingFirstAttemptId[firstMsgKey] = attemptId
                globalPendingFirstInput[firstMsgKey] = firstMsg
              }
              if (!globalPendingFirstAttemptId[sessionId] || globalPendingFirstAttemptId[sessionId] === attemptId) {
                globalPendingFirstAttemptId[sessionId] = attemptId
                globalPendingFirstInput[sessionId] = firstMsg
                pendingFirstInputBySession.current[sessionId] = firstMsg
                pendingFirstAttemptBySession.current[sessionId] = attemptId
              }
            }
          }
          const errMsg = writeRes?.error || 'Failed to deliver first message to agent'
          logDebug(`Background PTY manager: write pending first message failed: ${errMsg} (isCancelled=${isCancelled})`)
          useStore.getState().appendFeedItem({
            id: `err-msg-delivery-${Date.now()}`,
            type: 'ai',
            text: `⚠️ Error delivering message to terminal: ${errMsg}. Pending message has been retained.`
          }, targetTaskId)
          if (isCustomChatTab(sessionId, centralTabsRef.current)) {
            updateCustomTabFeed(sessionId, current => [
              ...current,
              {
                id: `ai-custom-err-${Date.now()}`,
                type: 'ai' as const,
                text: `⚠️ Error delivering message to terminal: ${errMsg}. Pending message has been retained.`
              }
            ])
          }
          // Stop delivery of subsequent messages on first message error
          return
        }

        if (globalStoppedSessions.has(sessionId) || (targetTaskId && globalStoppedSessions.has(targetTaskId))) {
          logDebug(`deliverFirstAndQueuedMessages: session ${sessionId} stopped after writing first message, aborting pump`)
          return
        }
        if ((globalSessionFrontendGenerations[sessionId] || 0) !== currentPumpGen) {
          logDebug(`deliverFirstAndQueuedMessages: generation changed after writing first message, aborting pump`)
          return
        }
      }

      while (globalPendingMessagesQueue[queueKey] && globalPendingMessagesQueue[queueKey].length > 0) {
        if (targetTaskId && globalSessionTaskOwners[sessionId] && globalSessionTaskOwners[sessionId] !== targetTaskId) {
          logDebug(`deliverFirstAndQueuedMessages: task owner changed during queue loop for sessionId=${sessionId}, aborting pump`)
          return
        }
        const queueRef = globalPendingMessagesQueue[queueKey]
        const rawItem = queueRef?.[0]
        if (!rawItem) break
        const qMsg = getQueueItemText(rawItem)
        const qAttemptId = getQueueItemAttemptId(rawItem)
        const isQCancelled = qAttemptId ? globalCancelledAttemptIds.has(qAttemptId) : false
        const isQDelivered = qAttemptId ? globalDeliveredAttemptIds.has(qAttemptId) : false
        if (isQCancelled || isQDelivered) {
          logDebug(`deliverFirstAndQueuedMessages: skipping cancelled/delivered queued message attemptId=${qAttemptId}`)
          const currentQueue = globalPendingMessagesQueue[queueKey]
          if (currentQueue) {
            const idx = qAttemptId
              ? currentQueue.findIndex(item => getQueueItemAttemptId(item) === qAttemptId)
              : currentQueue.indexOf(rawItem)
            if (idx !== -1) {
              currentQueue.splice(idx, 1)
            }
          }
          if (queueRef !== currentQueue && queueRef && queueRef[0] === rawItem) {
            queueRef.shift()
          }
          continue
        }
        logDebug(`Background PTY manager: delivering queued input chars=${qMsg.length}, attemptId=${qAttemptId}, sessionId=${sessionId}`)
        const qRes = await writeAgentInput(sessionId, `${qMsg}\r`)
          .catch((err: Error) => ({ success: false, error: err?.message || String(err) }))
        if (qRes?.success) {
          if (qAttemptId) {
            recordDeliveredAttempt(qAttemptId)
          }
          const currentQueue = globalPendingMessagesQueue[queueKey]
          if (currentQueue) {
            const idx = qAttemptId
              ? currentQueue.findIndex(item => getQueueItemAttemptId(item) === qAttemptId)
              : currentQueue.indexOf(rawItem)
            if (idx !== -1) {
              currentQueue.splice(idx, 1)
            }
          }
          if (queueRef !== currentQueue && queueRef && queueRef[0] === rawItem) {
            queueRef.shift()
          }
        }
        if ((globalSessionFrontendGenerations[sessionId] || 0) !== currentPumpGen) {
          logDebug(`deliverFirstAndQueuedMessages: generation changed after writing queued message, aborting pump`)
          return
        }
        if (!qRes?.success) {
          pumpHadWriteFailure = true
          const errMsg = qRes?.error || 'Failed to deliver queued message to agent'
          useStore.getState().appendFeedItem({
            id: `err-queued-msg-${Date.now()}`,
            type: 'ai',
            text: `⚠️ Error delivering message to terminal: ${errMsg}. Queued messages have been retained.`
          }, targetTaskId)
          if (isCustomChatTab(sessionId, centralTabsRef.current)) {
            updateCustomTabFeed(sessionId, current => [
              ...current,
              {
                id: `ai-custom-err-${Date.now()}`,
                type: 'ai' as const,
                text: `⚠️ Error delivering message to terminal: ${errMsg}. Queued messages have been retained.`
              }
            ])
          }
          break
        }
      }

      // Drain unkeyed legacy queue entries ONLY when targetTaskId is not specified
      if (!pumpHadWriteFailure && !targetTaskId && queueKey !== sessionId && globalPendingMessagesQueue[sessionId] && globalPendingMessagesQueue[sessionId].length > 0) {
        while (globalPendingMessagesQueue[sessionId] && globalPendingMessagesQueue[sessionId].length > 0) {
          const legacyQueueRef = globalPendingMessagesQueue[sessionId]
          const rawItem = legacyQueueRef?.[0]
          if (!rawItem) break
          const qMsg = getQueueItemText(rawItem)
          const qAttemptId = getQueueItemAttemptId(rawItem)
          const isQCancelled = qAttemptId ? globalCancelledAttemptIds.has(qAttemptId) : false
          const isQDelivered = qAttemptId ? globalDeliveredAttemptIds.has(qAttemptId) : false
          if (isQCancelled || isQDelivered) {
            logDebug(`deliverFirstAndQueuedMessages: skipping cancelled/delivered legacy queued message attemptId=${qAttemptId}`)
            const currentQueue = globalPendingMessagesQueue[sessionId]
            if (currentQueue) {
              const idx = qAttemptId
                ? currentQueue.findIndex(item => getQueueItemAttemptId(item) === qAttemptId)
                : currentQueue.indexOf(rawItem)
              if (idx !== -1) {
                currentQueue.splice(idx, 1)
              }
            }
            if (legacyQueueRef !== currentQueue && legacyQueueRef && legacyQueueRef[0] === rawItem) {
              legacyQueueRef.shift()
            }
            continue
          }
          logDebug(`Background PTY manager: delivering queued input chars=${qMsg.length}, attemptId=${qAttemptId}, sessionId=${sessionId}`)
          const qRes = await writeAgentInput(sessionId, `${qMsg}\r`)
            .catch((err: Error) => ({ success: false, error: err?.message || String(err) }))
          if (qRes?.success) {
            if (qAttemptId) {
              recordDeliveredAttempt(qAttemptId)
            }
            const currentQueue = globalPendingMessagesQueue[sessionId]
            if (currentQueue) {
              const idx = qAttemptId
                ? currentQueue.findIndex(item => getQueueItemAttemptId(item) === qAttemptId)
                : currentQueue.indexOf(rawItem)
              if (idx !== -1) {
                currentQueue.splice(idx, 1)
              }
            }
            if (legacyQueueRef !== currentQueue && legacyQueueRef && legacyQueueRef[0] === rawItem) {
              legacyQueueRef.shift()
            }
          }
          if ((globalSessionFrontendGenerations[sessionId] || 0) !== currentPumpGen) {
            logDebug(`deliverFirstAndQueuedMessages: generation changed after writing queued message, aborting pump`)
            return
          }
          if (!qRes?.success) {
            pumpHadWriteFailure = true
            break
          }
        }
      }

      // Mark agent ready strictly after all pending first and queued messages have finished delivering without failures
      const hasPendingFirst = targetTaskId
        ? Boolean(globalPendingFirstInput[firstMsgKey])
        : Boolean(globalPendingFirstInput[firstMsgKey] || globalPendingFirstInput[sessionId])
      const hasPendingQueue = targetTaskId
        ? (Boolean(globalPendingMessagesQueue[queueKey]) && globalPendingMessagesQueue[queueKey].length > 0)
        : ((Boolean(globalPendingMessagesQueue[queueKey]) && globalPendingMessagesQueue[queueKey].length > 0) ||
           (Boolean(globalPendingMessagesQueue[sessionId]) && globalPendingMessagesQueue[sessionId].length > 0))
      if ((globalSessionFrontendGenerations[sessionId] || 0) === currentPumpGen && !pumpHadWriteFailure && !hasPendingFirst && !hasPendingQueue) {
        globalAgentReadySessions.add(sessionId)
        globalAgentReadyFrontendGenerations[sessionId] = currentPumpGen
      }
    } finally {
      syncSessionQueuedInput(sessionId)
      if (sessionDeliveryLocks[sessionId] === pumpToken) {
        delete sessionDeliveryLocks[sessionId]
      }
      const firstKey = getQueueKey(sessionId, targetTaskId)
      const hasPendingFirst = targetTaskId
        ? Boolean(globalPendingFirstInput[firstKey])
        : Boolean(globalPendingFirstInput[firstKey] || globalPendingFirstInput[sessionId])
      const hasPendingQueue = (Boolean(globalPendingMessagesQueue[queueKey]) && globalPendingMessagesQueue[queueKey].length > 0) ||
                             (Boolean(globalPendingMessagesQueue[sessionId]) && globalPendingMessagesQueue[sessionId].length > 0)
      if (!pumpHadWriteFailure && (hasPendingFirst || hasPendingQueue) && sessionDeliveryLocks[sessionId] === undefined) {
        if (!targetTaskId || !globalSessionTaskOwners[sessionId] || globalSessionTaskOwners[sessionId] === targetTaskId) {
          if (!globalLaunchedSessions.has(sessionId) || isSessionAgentReady(sessionId)) {
            const scheduledGen = globalSessionFrontendGenerations[sessionId] || 0
            setTimeout(() => {
              if (globalSessionVerifyingLiveness.has(sessionId) || globalAgentAwaitingReadySessions.has(sessionId)) {
                return
              }
              if (globalLaunchedSessions.has(sessionId) && !isSessionAgentReady(sessionId)) {
                return
              }
              if ((globalSessionFrontendGenerations[sessionId] || 0) !== scheduledGen) {
                return
              }
              if (targetTaskId && globalSessionTaskOwners[sessionId] && globalSessionTaskOwners[sessionId] !== targetTaskId) {
                return
              }
              deliverFirstAndQueuedMessages(sessionId, targetTaskId)
            }, 50)
          }
        }
      }
    }
  }, [updateCustomTabFeed])

  // 1. Permanent background PTY process manager (runs always, regardless of rightPanelTab)
  useEffect(() => {
    if (usesStructuredAgent || settings?.useMockData === true || legacyReasoningUnsupported) return
    const isRealModel = task?.model?.toLowerCase().includes('claude') || 
                        task?.model?.toLowerCase().includes('antigravity') || 
                        task?.model?.toLowerCase().includes('codex') ||
                        task?.name?.toLowerCase().includes('claude') || 
                        task?.name?.toLowerCase().includes('agy') ||
                        selectedModel?.toLowerCase().includes('antigravity') || 
                        selectedModel?.toLowerCase().includes('claude') ||
                        selectedModel?.toLowerCase().includes('codex')
    const isRealRepo = activeRepo && activeRepo.path && !['1','2','3','4','5','6','7','8','9','10','11','12','13'].includes(activeRepo.id)
    const isRealMode = settings?.useMockData === false || isRealModel || isRealRepo
    const currentTaskId = activeTaskId || task?.id
    const sessionId = getTaskAgentSessionId(currentTaskId)

    const targetCwd = resolveTaskCwd(task, activeRepo)

    logDebug(`Background PTY manager triggered: isRealMode=${isRealMode}, sessionId=${sessionId}, targetCwd=${targetCwd}`)

    if (!isRealMode) {
      logDebug(`Background PTY manager: bypassing spawn, isRealMode is false`)
      return
    }

    if (task && task.status !== 'running') {
      logDebug(`Background PTY manager: task ${task.id} is not running (status=${task.status}), skipping PTY spawn`)
      return
    }

    if (task && !targetCwd && !settings?.useMockData) {
      logDebug(`Background PTY manager: task ${task.id} has no targetCwd yet, skipping PTY spawn`)
      return
    }

    let cleanupData = () => {}
    let cleanupExit = () => {}
    let isCancelled = false
    const activeTimers: ReturnType<typeof setTimeout>[] = []
    const agentReadiness = new PtyAgentReadiness()

    const processChunkToFeed = (targetSessionId: string, targetTaskId: string | undefined, rawChunk: string) => {
      // eslint-disable-next-line no-control-regex
      const cleanChunk = rawChunk.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '')
      const buffer = (accumulatedOutputBySession.current[targetSessionId] || '') + cleanChunk
      const lines = buffer.split('\n')
      const remaining = lines.pop() || ''
      accumulatedOutputBySession.current[targetSessionId] = remaining

      const processLine = (line: string, partial = false) => {
        const trimmed = line.trim()
        if (!trimmed) return
        const state = useStore.getState()
        const feed = targetTaskId ? state.tasks.find(item => item.id === targetTaskId)?.feed || [] : state.activeFeed
        const allUserMsgs = feed.filter(item => item.type === 'user').map(item => item.text || '')
        const promptId = activePromptIdBySession.current[targetSessionId]
        const existing = promptId && !state.answeredPromptIds[promptId] && !submittingPromptIds.current.has(promptId)
          ? feed.find(item => item.id === promptId) : undefined
        const isOption = Boolean(parsePromptOption(trimmed))
        const isNavOption = Boolean(existing && /^(?:[>❯›▸*•○-]\s*)?(?:Yes|No|Allow|Deny|Continue|Cancel|Exit)\b/i.test(trimmed))
        const isPrompt = isInteractivePrompt(trimmed) || isOption || isNavOption

        // Keep partial lines buffered. Only preview identifiable interactive prompts/options.
        if (partial && !isPrompt && !(existing && (isOption || isNavOption))) return
        if (!isPrompt && isTerminalNoise(trimmed, allUserMsgs)) return

        const isDiagnostic = /\b(error|warning|fatal|failed|failure|aborted|invalid|required|rejected|eacces|enoent|cannot|denied)\b/i.test(trimmed)
        const hasUserInteracted = allUserMsgs.length > 0 || Object.keys(state.answeredPromptIds).length > 0
        if (existing || isPrompt) {
          const oldText = existing?.text || ''
          const previousLines = oldText.split('\n')
          const lastLine = previousLines[previousLines.length - 1]
          if (lastLine && trimmed.startsWith(lastLine)) previousLines.pop()
          const text = [...previousLines.filter(Boolean), trimmed].join('\n')
          const promptActions = promptActionsForText(text)
          if (existing) {
            updateFeedItem(existing.id, { text, promptActions }, targetTaskId)
          } else {
            const id = 'prompt-pty-' + targetSessionId + '-' + Date.now() + '-' + Math.random()
            activePromptIdBySession.current[targetSessionId] = id
            state.appendFeedItem({ id, type: 'prompt', text, promptActions }, targetTaskId)
          }
        } else if (hasUserInteracted || isDiagnostic) {
          state.appendFeedItem({
            id: 'ai-pty-log-' + Date.now() + '-' + Math.random(),
            type: 'ai',
            text: trimmed,
          }, targetTaskId)
        }
      }

      lines.forEach(line => processLine(line))
      processLine(remaining, true)
    }

    const previousTaskOwner = globalSessionTaskOwners[sessionId]
    const isTaskChanged = previousTaskOwner !== undefined && previousTaskOwner !== currentTaskId
    globalSessionTaskOwners[sessionId] = currentTaskId
    globalLaunchedSessions.add(sessionId)
    launchedSessionsRef.current.add(sessionId)

    if (isTaskChanged) {
      clearSessionLifecycleState(sessionId, currentTaskId, { preservePendingInputs: false })
    } else {
      globalSessionFrontendGenerations[sessionId] = (globalSessionFrontendGenerations[sessionId] || 0) + 1
      globalAgentReadySessions.delete(sessionId)
      delete globalAgentReadyFrontendGenerations[sessionId]
    }
    globalSessionVerifyingLiveness.add(sessionId)
    globalAgentAwaitingReadySessions.add(sessionId)
    agentActivity.boot(sessionId)
    const launchGen = globalSessionFrontendGenerations[sessionId]

    let isSpawnPending = true
    const pendingEventsBuffer: Array<{ type: 'data' | 'exit', data?: string, exitCode?: number, generation?: number }> = []
    let isVerifyingLiveness = false

    const handlePtyData = (data: string, meta?: { generation?: number }) => {
      if (meta?.generation !== undefined && globalSessionGenerations[sessionId] !== undefined && meta.generation !== globalSessionGenerations[sessionId]) {
        logDebug(`Background PTY manager onPtyData: ignoring data from obsolete backend generation ${meta.generation} (current: ${globalSessionGenerations[sessionId]})`)
        return
      }
      agentActivity.output(sessionId, data)
      agentReadiness.output(data)
      logDebug(`Background PTY manager onPtyData: received ${data.length} bytes for sessionId=${sessionId}`)
      const currentSnap = (globalSessionLastSnapshot[sessionId] || '') + data
      globalSessionLastSnapshot[sessionId] = currentSnap.slice(-200000)
      appendToSessionLogs(sessionId, data)
      useStore.getState().appendLog(data, currentTaskId)

      // Confirm or reject agent startup when awaiting readiness (strictly gated during in-flight liveness check and once already ready!)
      if (!isVerifyingLiveness && !globalAgentReadySessions.has(sessionId) && globalAgentAwaitingReadySessions.has(sessionId)) {
        const currentBootBuf = ((globalAgentBootBuffers[sessionId] || '') + data).slice(-4000)
        globalAgentBootBuffers[sessionId] = currentBootBuf

        const isCommandNotFound = /command not found|no such file or directory|not recognized as an internal or external command/i.test(currentBootBuf)
        if (isCommandNotFound) {
          agentActivity.finish(sessionId)
          logDebug(`Background PTY manager: detected shell command failure for sessionId=${sessionId}, bootChars=${currentBootBuf.length}`)
          globalAgentAwaitingReadySessions.delete(sessionId)
          launchingSessionsRef.current.delete(sessionId)
          globalLaunchedAgentSessions.delete(sessionId)
          globalAgentReadySessions.delete(sessionId)
          delete globalAgentReadyFrontendGenerations[sessionId]
          processChunkToFeed(sessionId, currentTaskId, data)
          useStore.getState().appendFeedItem({
            id: `err-launch-agent-${Date.now()}`,
            type: 'ai',
            text: `⚠️ Agent launch failed: command not found or failed in shell.`
          }, currentTaskId)
          return
        }

        if (!isCommandNotFound && agentReadiness.isReady()) {
          logDebug(`Background PTY manager: confirmed agent startup from current input prompt for sessionId=${sessionId}`)
          globalAgentAwaitingReadySessions.delete(sessionId)
          globalSessionVerifyingLiveness.delete(sessionId)
          globalLaunchedAgentSessions.add(sessionId)
          launchedAgentSessionsRef.current.add(sessionId)
          launchingSessionsRef.current.delete(sessionId)
          globalAgentReadySessions.add(sessionId)
          globalAgentReadyFrontendGenerations[sessionId] = globalSessionFrontendGenerations[sessionId] || 0
          deliverFirstAndQueuedMessages(sessionId, currentTaskId)
        }
      }

      processChunkToFeed(sessionId, currentTaskId, data)
    }

    const handlePtyExit = (exitCode: number, generation?: number) => {
      if (generation !== undefined && globalSessionGenerations[sessionId] !== undefined && generation !== globalSessionGenerations[sessionId]) {
        logDebug(`Background PTY manager onPtyExit: ignoring exit from obsolete backend generation ${generation} (current: ${globalSessionGenerations[sessionId]})`)
        return
      }
      agentReadiness.reset()
      clearSessionLifecycleState(sessionId, currentTaskId)
      useStore.getState().appendLog(`\r\n\x1b[31m✖ [Process exited with code ${exitCode}]\x1b[0m\r\n`, currentTaskId)
    }

    cleanupData = window.ziafAPI.onPtyData(sessionId, (data: string, meta?: { generation?: number }) => {
      if (isSpawnPending) {
        pendingEventsBuffer.push({ type: 'data', data, generation: meta?.generation })
        return
      }
      handlePtyData(data, meta)
    })

    cleanupExit = window.ziafAPI.onPtyExit(sessionId, ({ exitCode, generation }: { exitCode: number, generation?: number }) => {
      if (isSpawnPending) {
        pendingEventsBuffer.push({ type: 'exit', exitCode, generation })
        return
      }
      handlePtyExit(exitCode, generation)
    })

    logDebug(`Background PTY manager: spawning PTY sessionId=${sessionId} at cwd=${targetCwd}`)
    window.ziafAPI.spawnPty({ sessionId, cwd: targetCwd, cols: 250, rows: 24 })
      .then(res => {
        if (isCancelled || (globalSessionFrontendGenerations[sessionId] || 0) !== launchGen) return
        isSpawnPending = false
        if (res.success) {
          clearSessionStopped(sessionId)
          if (currentTaskId) {
            clearSessionStopped(currentTaskId)
          }
          logDebug(`Background PTY manager PTY spawned successfully for sessionId=${sessionId}, reconnected=${Boolean(res.reconnected)}, gen=${res.generation}`)
          const resGen = res.generation
          const isGenerationChanged = resGen !== undefined && globalSessionGenerations[sessionId] !== undefined && globalSessionGenerations[sessionId] !== resGen
          if (resGen !== undefined) {
            globalSessionGenerations[sessionId] = resGen
          }

          if (!res.reconnected || isGenerationChanged) {
            clearSessionLifecycleState(sessionId, currentTaskId, { preservePendingInputs: true, preserveGeneration: true })
          }

          // Immediately reset ready status so that during asynchronous reconnect/liveness check,
          // messages are queued and never leaked to an unverified shell
          globalAgentReadySessions.delete(sessionId)
          delete globalAgentReadyFrontendGenerations[sessionId]
          globalAgentAwaitingReadySessions.add(sessionId)
          globalSessionVerifyingLiveness.add(sessionId)
          delete globalAgentBootBuffers[sessionId]
          isVerifyingLiveness = Boolean(res.reconnected)

          globalLaunchedSessions.add(sessionId)
          launchedSessionsRef.current.add(sessionId)

          const fullHistory = res.history || ''
          if (fullHistory) agentActivity.output(sessionId, fullHistory)
          agentReadiness.output(fullHistory)
          const unseen = extractUnseenHistory(fullHistory, sessionId)
          if (unseen) {
            appendToSessionLogs(sessionId, unseen)
            if (currentTaskId === activeTaskId) {
              useStore.getState().appendLog(unseen, currentTaskId)
            }
            processChunkToFeed(sessionId, currentTaskId, unseen)
          }

          // Concatenate all buffered data events for current authoritative generation
          const matchingDataEvents = pendingEventsBuffer.filter(
            evt => evt.type === 'data' && (evt.generation === undefined || resGen === undefined || evt.generation === resGen)
          )
          const allBufferedData = matchingDataEvents.map(evt => evt.data || '').join('')

          // Reconcile snapshot and buffered stream: determine unseen portion of buffered data
          let unseenBufferedData = ''
          if (!fullHistory) {
            unseenBufferedData = allBufferedData
          } else if (allBufferedData) {
            if (fullHistory.endsWith(allBufferedData)) {
              unseenBufferedData = ''
            } else if (allBufferedData.startsWith(fullHistory)) {
              unseenBufferedData = allBufferedData.slice(fullHistory.length)
            } else {
              const maxOverlap = Math.min(fullHistory.length, allBufferedData.length)
              let overlap = 0
              for (let len = maxOverlap; len > 0; len--) {
                if (fullHistory.endsWith(allBufferedData.slice(0, len))) {
                  overlap = len
                  break
                }
              }
              unseenBufferedData = allBufferedData.slice(overlap)
            }
          }

          if (unseenBufferedData) {
            handlePtyData(unseenBufferedData, { generation: resGen })
          }

          // Drain exit events matching authoritative generation
          for (const evt of pendingEventsBuffer) {
            if (evt.generation !== undefined && resGen !== undefined && evt.generation !== resGen) {
              continue
            }
            if (evt.type === 'exit' && evt.exitCode !== undefined) {
              handlePtyExit(evt.exitCode, evt.generation)
            }
          }
          pendingEventsBuffer.length = 0

          const agentCmd = buildAgentCommand(selectedModel, presets, chatCustomAgent)

          const checkAndLaunchTaskAgent = async () => {
            if (res.reconnected) {
              isVerifyingLiveness = true
              globalSessionVerifyingLiveness.add(sessionId)
              globalAgentReadySessions.delete(sessionId)
              delete globalAgentReadyFrontendGenerations[sessionId]
              try {
                const procRes = await window.ziafAPI.getActiveProcesses({ sessionId })
                if (isCancelled || (globalSessionFrontendGenerations[sessionId] || 0) !== launchGen) return
                const procs = procRes?.processes || []
                // Check if ANY agent process is active in this session (Claude or Antigravity)
                const existingAgentProc = procs.find(p => {
                  const cmd = (p.command || '').toLowerCase()
                  return cmd.includes('claude') || cmd.includes('agy') || cmd.includes('antigravity') || cmd.includes('codex')
                })
                if (existingAgentProc) {
                  logDebug(`Background PTY manager: confirmed existing active agent pid=${existingAgentProc.pid} on reconnect for sessionId=${sessionId}`)
                  isVerifyingLiveness = false
                  globalSessionVerifyingLiveness.delete(sessionId)
                  globalLaunchedAgentSessions.add(sessionId)
                  launchedAgentSessionsRef.current.add(sessionId)
                  launchingSessionsRef.current.delete(sessionId)
                  if (!agentReadiness.isReady()) {
                    logDebug(`Background PTY manager: existing agent is awaiting a current input prompt for sessionId=${sessionId}`)
                    return
                  }
                  globalAgentAwaitingReadySessions.delete(sessionId)
                  globalAgentReadySessions.add(sessionId)
                  globalAgentReadyFrontendGenerations[sessionId] = globalSessionFrontendGenerations[sessionId] || 0
                  // Do not clear accumulatedOutputBySession here to preserve unfinished task line across same-generation reconnect
                  await deliverFirstAndQueuedMessages(sessionId, currentTaskId)
                  return
                } else {
                  // Negative liveness result! Agent exited, so clear cached launched and ready flags
                  logDebug(`Background PTY manager: negative liveness check on reconnect for sessionId=${sessionId}`)
                  globalLaunchedAgentSessions.delete(sessionId)
                  launchedAgentSessionsRef.current.delete(sessionId)
                  globalAgentReadySessions.delete(sessionId)
                  delete globalAgentReadyFrontendGenerations[sessionId]
                  globalAgentAwaitingReadySessions.add(sessionId)
                  globalSessionVerifyingLiveness.add(sessionId)
                  const taskFeed = useStore.getState().tasks.find(t => t.id === currentTaskId)?.feed || useStore.getState().activeFeed || []
                  const allUserMsgs = taskFeed.filter(item => item.type === 'user').map(item => item.text).filter((t): t is string => Boolean(t))
                  const leftover = extractMeaningfulText(accumulatedOutputBySession.current[sessionId] || '', allUserMsgs)
                  if (leftover) {
                    if (!isTextAlreadyInFeed(taskFeed, leftover)) {
                      const lastItem = taskFeed[taskFeed.length - 1]
                      if (lastItem && lastItem.type === 'ai' && lastItem.text && leftover.startsWith(lastItem.text)) {
                        useStore.getState().updateFeedItem(lastItem.id, { text: leftover }, currentTaskId)
                      } else {
                        useStore.getState().appendFeedItem({
                          id: `ai-pty-log-${Date.now()}-${Math.random()}`,
                          type: 'ai',
                          text: leftover
                        }, currentTaskId)
                      }
                    }
                  }
                  delete globalAgentBootBuffers[sessionId]
                  accumulatedOutputBySession.current[sessionId] = ''
                  globalAccumulatedOutputBySession[sessionId] = ''
                }
              } catch (procErr) {
                if (isCancelled || (globalSessionFrontendGenerations[sessionId] || 0) !== launchGen) return
                logDebug(`Background PTY manager getActiveProcesses on reconnect error: ${procErr}`)
                globalLaunchedAgentSessions.delete(sessionId)
                launchedAgentSessionsRef.current.delete(sessionId)
                globalAgentReadySessions.delete(sessionId)
                delete globalAgentReadyFrontendGenerations[sessionId]
                globalAgentAwaitingReadySessions.add(sessionId)
                globalSessionVerifyingLiveness.add(sessionId)
                const taskFeed = useStore.getState().tasks.find(t => t.id === currentTaskId)?.feed || useStore.getState().activeFeed || []
                const allUserMsgs = taskFeed.filter(item => item.type === 'user').map(item => item.text).filter((t): t is string => Boolean(t))
                const leftover = extractMeaningfulText(accumulatedOutputBySession.current[sessionId] || '', allUserMsgs)
                if (leftover) {
                  if (!isTextAlreadyInFeed(taskFeed, leftover)) {
                    const lastItem = taskFeed[taskFeed.length - 1]
                    if (lastItem && lastItem.type === 'ai' && lastItem.text && leftover.startsWith(lastItem.text)) {
                      useStore.getState().updateFeedItem(lastItem.id, { text: leftover }, currentTaskId)
                    } else {
                      useStore.getState().appendFeedItem({
                        id: `ai-pty-log-${Date.now()}-${Math.random()}`,
                        type: 'ai',
                        text: leftover
                      }, currentTaskId)
                    }
                  }
                }
                delete globalAgentBootBuffers[sessionId]
                accumulatedOutputBySession.current[sessionId] = ''
                globalAccumulatedOutputBySession[sessionId] = ''
              } finally {
                isVerifyingLiveness = false
                if ((globalSessionFrontendGenerations[sessionId] || 0) === launchGen && !globalAgentAwaitingReadySessions.has(sessionId)) {
                  globalSessionVerifyingLiveness.delete(sessionId)
                }
              }
            }

            if (isCancelled || (globalSessionFrontendGenerations[sessionId] || 0) !== launchGen) return

            if (task && task.status === 'running' && !globalLaunchedAgentSessions.has(sessionId) && !launchingSessionsRef.current.has(sessionId)) {
              launchingSessionsRef.current.add(sessionId)
              delete globalAgentBootBuffers[sessionId]
              agentReadiness.reset()
              accumulatedOutputBySession.current[sessionId] = ''
              globalAccumulatedOutputBySession[sessionId] = ''
              logDebug(`Background PTY manager: task is running, auto-writing agent command chars=${agentCmd.length} after delay`)
              const t1 = setTimeout(() => {
                if (isCancelled || (globalSessionFrontendGenerations[sessionId] || 0) !== launchGen) return
                window.ziafAPI.writePty({ sessionId, data: `export LANG=en_US.UTF-8; export LC_ALL=en_US.UTF-8; clear\n` }).then(() => {
                  if (isCancelled || (globalSessionFrontendGenerations[sessionId] || 0) !== launchGen) return
                  window.ziafAPI.writePty({ sessionId, data: `${agentCmd}\n` }).then((cmdRes) => {
                    if (isCancelled || (globalSessionFrontendGenerations[sessionId] || 0) !== launchGen) return
                    if (!cmdRes?.success) {
                      agentActivity.finish(sessionId)
                      logDebug(`Background PTY manager: agent command write failed for sessionId=${sessionId}`)
                      launchingSessionsRef.current.delete(sessionId)
                      useStore.getState().appendFeedItem({
                        id: `err-launch-agent-${Date.now()}`,
                        type: 'ai',
                        text: `⚠️ Failed to launch agent command "${agentCmd}": ${cmdRes?.error || 'Unknown write error'}`
                      }, currentTaskId)
                      return
                    }
                    // Output may establish readiness before the command-write ACK.
                    // Do not re-block an input already delivered by that callback.
                    if (isSessionAgentReady(sessionId)) return
                    globalAgentAwaitingReadySessions.add(sessionId)
                    if (agentReadiness.isReady()) {
                      globalAgentAwaitingReadySessions.delete(sessionId)
                      globalSessionVerifyingLiveness.delete(sessionId)
                      globalLaunchedAgentSessions.add(sessionId)
                      launchedAgentSessionsRef.current.add(sessionId)
                      launchingSessionsRef.current.delete(sessionId)
                      globalAgentReadySessions.add(sessionId)
                      globalAgentReadyFrontendGenerations[sessionId] = launchGen
                      deliverFirstAndQueuedMessages(sessionId, currentTaskId)
                      return
                    }

                    // A live process is necessary here, but cannot establish input readiness by itself.
                    const t2 = setTimeout(async () => {
                      if (isCancelled || (globalSessionFrontendGenerations[sessionId] || 0) !== launchGen) return
                      if (!globalAgentAwaitingReadySessions.has(sessionId)) return

                      try {
                        const procRes = await window.ziafAPI.getActiveProcesses({ sessionId })
                        if (isCancelled || (globalSessionFrontendGenerations[sessionId] || 0) !== launchGen) return
                        const procs = procRes?.processes || []
                        const existingAgentProc = procs.find(p => {
                          const cmd = (p.command || '').toLowerCase()
                          return cmd.includes('claude') || cmd.includes('agy') || cmd.includes('antigravity') || cmd.includes('codex')
                        })
                        if (existingAgentProc) {
                          if (!agentReadiness.isReady()) {
                            logDebug(`Background PTY manager: live agent is awaiting a current input prompt for sessionId=${sessionId}`)
                            return
                          }
                          logDebug(`Background PTY manager: confirmed agent startup from active processes for sessionId=${sessionId}`)
                          globalAgentAwaitingReadySessions.delete(sessionId)
                          globalSessionVerifyingLiveness.delete(sessionId)
                          globalLaunchedAgentSessions.add(sessionId)
                          launchedAgentSessionsRef.current.add(sessionId)
                          launchingSessionsRef.current.delete(sessionId)
                          globalAgentReadySessions.add(sessionId)
                          globalAgentReadyFrontendGenerations[sessionId] = globalSessionFrontendGenerations[sessionId] || 0
                          await deliverFirstAndQueuedMessages(sessionId, currentTaskId)
                        } else {
                          agentActivity.finish(sessionId)
                          logDebug(`Background PTY manager: agent process not found in fallback check for sessionId=${sessionId}`)
                          launchingSessionsRef.current.delete(sessionId)
                          globalLaunchedAgentSessions.delete(sessionId)
                          globalAgentReadySessions.delete(sessionId)
                          delete globalAgentReadyFrontendGenerations[sessionId]
                          globalAgentAwaitingReadySessions.add(sessionId)
                          globalSessionVerifyingLiveness.add(sessionId)
                          useStore.getState().appendFeedItem({
                            id: `err-agent-not-found-${Date.now()}`,
                            type: 'ai',
                            text: `⚠️ Failed to confirm agent startup: command "${agentCmd}" terminated or was not found in shell.`
                          }, currentTaskId)
                        }
                      } catch (procErr) {
                        logDebug(`Background PTY manager: getActiveProcesses error: ${procErr}`)
                      }
                    }, 12000)
                    activeTimers.push(t2)
                  }).catch((cmdErr: Error) => {
                    if (isCancelled || (globalSessionFrontendGenerations[sessionId] || 0) !== launchGen) return
                    launchingSessionsRef.current.delete(sessionId)
                    globalLaunchedAgentSessions.delete(sessionId)
                    globalAgentReadySessions.delete(sessionId)
                    delete globalAgentReadyFrontendGenerations[sessionId]
                    globalAgentAwaitingReadySessions.add(sessionId)
                    globalSessionVerifyingLiveness.add(sessionId)
                    const errMsg = cmdErr?.message || String(cmdErr)
                    agentActivity.finish(sessionId)
                    logDebug(`Background PTY manager: agent command write rejected: ${errMsg}`)
                    useStore.getState().appendFeedItem({
                      id: `err-launch-agent-${Date.now()}`,
                      type: 'ai',
                      text: `⚠️ Failed to launch agent command "${agentCmd}": ${errMsg}`
                    }, currentTaskId)
                  })
                }).catch((setupErr: Error) => {
                  if (isCancelled || (globalSessionFrontendGenerations[sessionId] || 0) !== launchGen) return
                  launchingSessionsRef.current.delete(sessionId)
                  globalLaunchedAgentSessions.delete(sessionId)
                  globalAgentReadySessions.delete(sessionId)
                  delete globalAgentReadyFrontendGenerations[sessionId]
                  globalAgentAwaitingReadySessions.add(sessionId)
                  globalSessionVerifyingLiveness.add(sessionId)
                  const errMsg = setupErr?.message || String(setupErr)
                  agentActivity.finish(sessionId)
                  logDebug(`Background PTY manager: setup write rejected: ${errMsg}`)
                  useStore.getState().appendFeedItem({
                    id: `err-setup-write-${Date.now()}`,
                    type: 'ai',
                    text: `⚠️ Failed to setup environment: ${errMsg}`
                  }, currentTaskId)
                })
              }, 1200)
              activeTimers.push(t1)
            } else if (globalLaunchedAgentSessions.has(sessionId) && isSessionAgentReady(sessionId)) {
              logDebug(`Background PTY manager: agent already running and verified ready for sessionId=${sessionId}, delivering any pending messages`)
              deliverFirstAndQueuedMessages(sessionId, currentTaskId)
            }
          }

          checkAndLaunchTaskAgent()
        } else {
          const errMsg = res.error || 'Unknown spawn error'
          agentActivity.finish(sessionId)
          logDebug(`Background PTY manager: spawn PTY failed for sessionId=${sessionId}, error=${errMsg}`)
          if ((globalSessionFrontendGenerations[sessionId] || 0) === launchGen) {
            globalSessionVerifyingLiveness.add(sessionId)
            globalAgentAwaitingReadySessions.add(sessionId)
            globalAgentReadySessions.delete(sessionId)
            delete globalAgentReadyFrontendGenerations[sessionId]
          }
          useStore.getState().appendFeedItem({
            id: `err-spawn-${Date.now()}`,
            type: 'ai',
            text: `Failed to spawn background PTY terminal: ${errMsg}`
          }, currentTaskId)
        }
      })
      .catch(err => {
        isSpawnPending = false
        pendingEventsBuffer.length = 0
        if ((globalSessionFrontendGenerations[sessionId] || 0) === launchGen) {
          globalSessionVerifyingLiveness.add(sessionId)
          globalAgentAwaitingReadySessions.add(sessionId)
          globalAgentReadySessions.delete(sessionId)
          delete globalAgentReadyFrontendGenerations[sessionId]
        }
        const errMsg = err?.message || String(err)
        agentActivity.finish(sessionId)
        logDebug(`Background PTY manager spawn catch error for sessionId=${sessionId}: ${errMsg}`)
        useStore.getState().appendFeedItem({
          id: `err-spawn-${Date.now()}`,
          type: 'ai',
          text: `Failed to spawn background PTY terminal: ${errMsg}`
        }, currentTaskId)
      })

    const launchingSessions = launchingSessionsRef.current

    return () => {
      isCancelled = true
      activeTimers.forEach(t => clearTimeout(t))
      launchingSessions.delete(sessionId)
      if ((globalSessionFrontendGenerations[sessionId] || 0) === launchGen) {
        globalSessionVerifyingLiveness.delete(sessionId)
      }
      cleanupData()
      cleanupExit()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeTaskId,
    task?.status,
    task?.model,
    task?.name,
    task?.worktreePath,
    activeRepo?.id,
    activeRepo?.path,
    activeRepo?.repoPath,
    settings?.useMockData,
    selectedModel,
    usesStructuredAgent,
    getTaskAgentSessionId,
  ])

  // 1b. Auxiliary terminal PTY process manager (for right-panel terminal tabs 0, 1, 2, etc.)
  useEffect(() => {
    if (rightPanelTab === 'terminal') {
      if (task && task.status !== 'running') return
      const targetCwd = resolveTaskCwd(task, activeRepo)
      if (task && !targetCwd && !settings?.useMockData) return

      const isMain = activeTabId === 'feed' || activeTabId === 'chat-main'
      const terminalSessionId = isMain
        ? (task ? `term-task-${task.id}-${activeTermTabIdx}` : `term-${activeRepo?.id || 'default'}-${activeTermTabIdx}`)
        : getSessionIdForTab(activeTabId)
      if (settings?.useMockData === false && terminalSessionId && targetCwd) {
        window.ziafAPI.spawnPty({ sessionId: terminalSessionId, cwd: targetCwd, cols: 80, rows: 24 })
          .then(res => {
            if (res?.success) {
              logDebug(`Auxiliary terminal PTY spawned/reconnected for sessionId=${terminalSessionId}`)
            }
          })
          .catch(() => {})
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rightPanelTab, activeTermTabIdx, activeTabId, task?.id, task?.status, task?.worktreePath, activeRepo?.path, activeRepo?.repoPath, activeRepo?.id, settings?.useMockData, getSessionIdForTab])

  // Auto-scroll chat to bottom when feed, custom feed, or logs update
  useEffect(() => {
    if (chatScrollRef.current) {
      const scrollTimer = setTimeout(() => {
        if (chatScrollRef.current) {
          chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
        }
      }, 60)
      return () => clearTimeout(scrollTimer)
    }
  }, [activeFeed, customTabFeeds, activeLogs])

  // Telemetry auto-scroll (only if user is near the bottom, to not fight manual scrolling)
  useEffect(() => {
    if (telemetryScrollRef.current && !telemetryCollapsed) {
      const el = telemetryScrollRef.current
      const isNearBottom = (el.scrollHeight - el.scrollTop - el.clientHeight) < 80
      if (isNearBottom) {
        el.scrollTop = el.scrollHeight
      }
    }
  }, [activeLogs, _customTabScreens, telemetryCollapsed])

  // Automatically spawn/reconnect PTY session for custom tabs when they become active
  useEffect(() => {
    if (usesStructuredAgent || settings?.useMockData === true || legacyReasoningUnsupported) return
    if (!isCustomChatTab(activeTabId, centralTabs)) {
      return
    }

    if (task && task.status !== 'running') return
    const targetCwd = resolveTaskCwd(task, activeRepo)
    if (task && !targetCwd && !settings?.useMockData) return
    if (!targetCwd) return

    let isCancelled = false
    activeCustomPtySessions.current.add(activeTabId)
    logDebug(`Auto-spawn/reconnect PTY for custom tab activeTabId=${activeTabId} at cwd=${targetCwd}`)

    const currentTabId = activeTabId
    const currentTaskId = task?.id

    const previousTaskOwner = globalSessionTaskOwners[currentTabId]
    const isTaskChanged = previousTaskOwner !== undefined && previousTaskOwner !== currentTaskId
    globalSessionTaskOwners[currentTabId] = currentTaskId
    globalLaunchedSessions.add(currentTabId)
    if (isTaskChanged) {
      clearSessionLifecycleState(currentTabId, currentTaskId, { preservePendingInputs: false })
    } else {
      globalSessionFrontendGenerations[currentTabId] = (globalSessionFrontendGenerations[currentTabId] || 0) + 1
      globalAgentReadySessions.delete(currentTabId)
      delete globalAgentReadyFrontendGenerations[currentTabId]
    }
    globalSessionVerifyingLiveness.add(currentTabId)
    globalAgentAwaitingReadySessions.add(currentTabId)
    agentActivity.boot(currentTabId)
    const launchGen = globalSessionFrontendGenerations[currentTabId]
    const agentReadiness = new PtyAgentReadiness()
    let bootState = 0 // 0 = spawning shell, 1 = waiting for prompt, 2 = booted
    const agentCmd = buildAgentCommand(selectedModel, presets, chatCustomAgent)

    let ptyBuffer = ''
    let ptyFlushTimer: ReturnType<typeof setTimeout> | null = null
    const PTY_FLUSH_INTERVAL = 300 // ms

    const flushPtyBuffer = () => {
      ptyFlushTimer = null
      if (!ptyBuffer) return
      const dataToProcess = ptyBuffer
      ptyBuffer = ''

      // Clean up \uFFFD characters before flushing
      const cleanData = dataToProcess.replace(/\uFFFD/g, '')

      // Get or initialize persistent cursor state for this tab
      if (!ptyScreenState.current[activeTabId]) {
        const existingLines = customTabScreensRef.current[activeTabId] || globalCustomTabScreens[activeTabId]
        const initialRow = existingLines && existingLines.length > 0 ? existingLines.length - 1 : 0
        const initialCol = existingLines && existingLines.length > 0 ? (existingLines[initialRow]?.length || 0) : 0
        ptyScreenState.current[activeTabId] = {
          cursorRow: initialRow,
          cursorCol: initialCol,
          savedRow: initialRow,
          savedCol: initialCol,
          trailing: ''
        }
      }
      const state = ptyScreenState.current[activeTabId]
      const lines = updateTerminalScreen(customTabScreensRef.current[activeTabId] || [''], state, cleanData)
      customTabScreensRef.current[activeTabId] = lines
      globalCustomTabScreens[activeTabId] = lines

      // Extract running sub-agent commands from screen lines
      const runningCmds: string[] = []
      for (const line of lines) {
        const trimmed = line.trim()
        const match = trimmed.match(/^[●•]\s*\[\d{2}:\d{2}:\d{2}\]\s*(.*?)\s+running/i)
        if (match) runningCmds.push(match[1].trim())
      }

      const currentFeed = customTabFeedsRef.current[activeTabId] || []
      const allUserMsgs = currentFeed.filter(item => item.type === 'user').map(item => item.text).filter(Boolean) as string[]
      const structuredItems = parseScreenToStructuredFeed(lines, allUserMsgs, activeTabId, runningCmds)

      setCustomTabScreens(prev => ({ ...prev, [activeTabId]: lines }))

      if (structuredItems.length > 0) {
        updateCustomTabFeed(activeTabId, current => mergeFeeds(current, structuredItems, activeTabId, useStore.getState().answeredPromptIds))
      }
    }

    const processCheckInterval = setInterval(() => {
      window.ziafAPI.getActiveProcesses({ sessionId: activeTabId })
        .then(res => {
          if (res.success && res.processes) {
            setCustomTabPids(prev => {
              const current = prev[activeTabId] || []
              if (current.length === res.processes.length && current.every((p, idx) => p.pid === res.processes[idx].pid && p.command === res.processes[idx].command)) return prev
              return { ...prev, [activeTabId]: res.processes }
            })
          }
        })
        .catch(() => {})
    }, 5000)

    let isSpawnPending = true
    const pendingEventsBuffer: Array<{ type: 'data' | 'exit', data?: string, exitCode?: number, generation?: number }> = []
    let isVerifyingLiveness = false
    let isCommandSubmitted = false

    const handleCustomData = (rawChunk: string, meta?: { generation?: number }) => {
      if (meta?.generation !== undefined && globalSessionGenerations[currentTabId] !== undefined && meta.generation !== globalSessionGenerations[currentTabId]) {
        logDebug(`Custom tab onPtyData: ignoring data from obsolete backend generation ${meta.generation} (current: ${globalSessionGenerations[currentTabId]})`)
        return
      }
      agentActivity.output(currentTabId, rawChunk)
      agentReadiness.output(rawChunk)
      const currentSnap = (globalSessionLastSnapshot[currentTabId] || '') + rawChunk
      globalSessionLastSnapshot[currentTabId] = currentSnap.slice(-200000)
      if (rawChunk.length > 30) {
        logDebug(`Custom tab onPtyData: received ${rawChunk.length} bytes for sessionId=${currentTabId}`)
      }

      appendToSessionLogs(currentTabId, rawChunk)

      // Accumulate output received while awaiting agent readiness / verification
      if (bootState !== 2 || isVerifyingLiveness) {
        // eslint-disable-next-line no-control-regex
        const cleanChunk = rawChunk.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '')
        const currentAccum = (accumulatedOutputBySession.current[currentTabId] || '') + cleanChunk
        accumulatedOutputBySession.current[currentTabId] = currentAccum.slice(-50000)
        globalAccumulatedOutputBySession[currentTabId] = accumulatedOutputBySession.current[currentTabId]
      } else {
        if (!globalAccumulatedOutputBySession[currentTabId]) {
          globalAccumulatedOutputBySession[currentTabId] = ''
        }
      }

      ptyBuffer += rawChunk

      // Inspect the current screen, gated during liveness verification and after startup.
      if (!isVerifyingLiveness && bootState !== 2 && (isCommandSubmitted || bootState === 1 || globalAgentAwaitingReadySessions.has(currentTabId))) {
        const currentBootBuf = ((globalAgentBootBuffers[currentTabId] || '') + rawChunk).slice(-4000)
        globalAgentBootBuffers[currentTabId] = currentBootBuf

        const isCommandNotFound = /command not found|no such file or directory|not recognized as an internal or external command/i.test(currentBootBuf)
        if (isCommandNotFound) {
          agentActivity.finish(currentTabId)
          logDebug(`Custom tab onPtyData: detected shell command failure for sessionId=${currentTabId}, bootChars=${currentBootBuf.length}`)
          bootState = 0
          isCommandSubmitted = false
          globalAgentAwaitingReadySessions.delete(currentTabId)
          globalLaunchedAgentSessions.delete(currentTabId)
          globalAgentReadySessions.delete(currentTabId)
          delete globalAgentReadyFrontendGenerations[currentTabId]
          globalSessionVerifyingLiveness.add(currentTabId)
          if (ptyFlushTimer) {
            clearTimeout(ptyFlushTimer)
            ptyFlushTimer = null
          }
          flushPtyBuffer()
          const curFeed = customTabFeedsRef.current[currentTabId] || globalCustomTabFeeds[currentTabId] || []
          const allUserMsgs = curFeed.filter(item => item.type === 'user').map(item => item.text).filter((t): t is string => Boolean(t))
          const leftover = extractMeaningfulText(accumulatedOutputBySession.current[currentTabId] || '', allUserMsgs)
          if (leftover) {
            updateCustomTabFeed(currentTabId, current => {
              if (isTextAlreadyInFeed(current, leftover)) {
                return current
              }
              const lastItem = current[current.length - 1]
              if (lastItem && lastItem.type === 'ai' && lastItem.text && leftover.startsWith(lastItem.text)) {
                return [
                  ...current.slice(0, -1),
                  { ...lastItem, text: leftover }
                ]
              }
              return [
                ...current,
                {
                  id: `ai-custom-log-${Date.now()}-${Math.random()}`,
                  type: 'ai' as const,
                  text: leftover
                }
              ]
            })
          }
          accumulatedOutputBySession.current[currentTabId] = ''
          globalAccumulatedOutputBySession[currentTabId] = ''
          updateCustomTabFeed(currentTabId, current => [
            ...current,
            {
              id: `ai-custom-err-${Date.now()}`,
              type: 'ai' as const,
              text: `⚠️ Agent launch failed: command not found or failed in shell.`
            }
          ])
          return
        }

        if (!isCommandNotFound && agentReadiness.isReady() && (bootState === 1 || globalAgentAwaitingReadySessions.has(currentTabId))) {
          bootState = 2
          isCommandSubmitted = false
          logDebug(`Custom tab bootState -> 2: agent ready for sessionId=${currentTabId}`)
          globalAgentAwaitingReadySessions.delete(currentTabId)
          globalSessionVerifyingLiveness.delete(currentTabId)
          globalLaunchedAgentSessions.add(currentTabId)
          globalAgentReadySessions.add(currentTabId)
          globalAgentReadyFrontendGenerations[currentTabId] = globalSessionFrontendGenerations[currentTabId] || 0
          if (ptyFlushTimer) {
            clearTimeout(ptyFlushTimer)
            ptyFlushTimer = null
          }
          flushPtyBuffer()
          const curFeed = customTabFeedsRef.current[currentTabId] || globalCustomTabFeeds[currentTabId] || []
          const allUserMsgs = curFeed.filter(item => item.type === 'user').map(item => item.text).filter((t): t is string => Boolean(t))
          const leftover = extractMeaningfulText(accumulatedOutputBySession.current[currentTabId] || '', allUserMsgs)
          if (leftover) {
            updateCustomTabFeed(currentTabId, current => {
              if (isTextAlreadyInFeed(current, leftover)) return current
              const lastItem = current[current.length - 1]
              if (lastItem && lastItem.type === 'ai' && lastItem.text && leftover.startsWith(lastItem.text)) {
                return [
                  ...current.slice(0, -1),
                  { ...lastItem, text: leftover }
                ]
              }
              return [
                ...current,
                {
                  id: `ai-custom-log-${Date.now()}-${Math.random()}`,
                  type: 'ai' as const,
                  text: leftover
                }
              ]
            })
          }
          accumulatedOutputBySession.current[currentTabId] = ''
          globalAccumulatedOutputBySession[currentTabId] = ''
          deliverFirstAndQueuedMessages(currentTabId, currentTaskId)
        }
      }

      if (!ptyFlushTimer && ptyBuffer) {
        ptyFlushTimer = setTimeout(flushPtyBuffer, PTY_FLUSH_INTERVAL)
      }
    }

    const handleCustomExit = (exitCode: number, generation?: number) => {
      if (generation !== undefined && globalSessionGenerations[currentTabId] !== undefined && generation !== globalSessionGenerations[currentTabId]) {
        logDebug(`Custom tab onPtyExit: ignoring exit from obsolete backend generation ${generation} (current: ${globalSessionGenerations[currentTabId]})`)
        return
      }
      if (ptyFlushTimer) {
        clearTimeout(ptyFlushTimer)
        ptyFlushTimer = null
      }
      flushPtyBuffer()
      agentReadiness.reset()
      clearSessionLifecycleState(currentTabId, currentTaskId)
      updateCustomTabFeed(currentTabId, current => [
        ...current,
        {
          id: `ai-custom-exit-${Date.now()}`,
          type: 'ai' as const,
          text: `✖ [Process exited with code ${exitCode}]`
        }
      ])
    }

    const cleanupData = window.ziafAPI.onPtyData(currentTabId, (rawChunk: string, meta?: { generation?: number }) => {
      if (isSpawnPending) {
        pendingEventsBuffer.push({ type: 'data', data: rawChunk, generation: meta?.generation })
        return
      }
      handleCustomData(rawChunk, meta)
    })

    const cleanupExit = window.ziafAPI.onPtyExit(currentTabId, ({ exitCode, generation }: { exitCode: number, generation?: number }) => {
      if (isSpawnPending) {
        pendingEventsBuffer.push({ type: 'exit', exitCode, generation })
        return
      }
      handleCustomExit(exitCode, generation)
    })

    window.ziafAPI.spawnPty({ sessionId: currentTabId, cwd: targetCwd, cols: 250, rows: 88 })
      .then(res => {
        if (isCancelled || (globalSessionFrontendGenerations[currentTabId] || 0) !== launchGen) return
        isSpawnPending = false
        const result = res
        if (result.success) {
          clearSessionStopped(currentTabId)
          if (currentTaskId) {
            clearSessionStopped(currentTaskId)
          }
          const resGen = res.generation
          const isGenerationChanged = resGen !== undefined && globalSessionGenerations[currentTabId] !== undefined && globalSessionGenerations[currentTabId] !== resGen
          if (resGen !== undefined) {
            globalSessionGenerations[currentTabId] = resGen
          }

          if (!result.reconnected || isGenerationChanged) {
            clearSessionLifecycleState(currentTabId, currentTaskId, { preservePendingInputs: true, preserveGeneration: true })
          }

          // Immediately reset ready status so that during asynchronous reconnect/liveness check,
          // messages are queued and never leaked to an unverified shell
          globalAgentReadySessions.delete(currentTabId)
          delete globalAgentReadyFrontendGenerations[currentTabId]
          globalAgentAwaitingReadySessions.add(currentTabId)
          globalSessionVerifyingLiveness.add(currentTabId)
          delete globalAgentBootBuffers[currentTabId]
          bootState = 0
          isVerifyingLiveness = Boolean(result.reconnected)

          globalLaunchedSessions.add(currentTabId)

          logDebug(`Custom tab PTY spawned/reconnected successfully for activeTabId=${currentTabId}, gen=${res.generation}`)

          const fullHistory = result.history || ''
          if (fullHistory) agentActivity.output(currentTabId, fullHistory)
          agentReadiness.output(fullHistory)
          const unseen = extractUnseenHistory(fullHistory, currentTabId)
          if (unseen) {
            appendToSessionLogs(currentTabId, unseen)
            // eslint-disable-next-line no-control-regex
            const cleanUnseen = unseen.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '')
            accumulatedOutputBySession.current[currentTabId] = ((accumulatedOutputBySession.current[currentTabId] || '') + cleanUnseen).slice(-50000)
            globalAccumulatedOutputBySession[currentTabId] = accumulatedOutputBySession.current[currentTabId]
            ptyBuffer += unseen
            flushPtyBuffer()
          }

          // Concatenate all buffered data events for current authoritative generation
          const matchingDataEvents = pendingEventsBuffer.filter(
            evt => evt.type === 'data' && (evt.generation === undefined || resGen === undefined || evt.generation === resGen)
          )
          const allBufferedData = matchingDataEvents.map(evt => evt.data || '').join('')

          // Reconcile snapshot and buffered stream: determine unseen portion of buffered data
          let unseenBufferedData = ''
          if (!fullHistory) {
            unseenBufferedData = allBufferedData
          } else if (allBufferedData) {
            if (fullHistory.endsWith(allBufferedData)) {
              unseenBufferedData = ''
            } else if (allBufferedData.startsWith(fullHistory)) {
              unseenBufferedData = allBufferedData.slice(fullHistory.length)
            } else {
              const maxOverlap = Math.min(fullHistory.length, allBufferedData.length)
              let overlap = 0
              for (let len = maxOverlap; len > 0; len--) {
                if (fullHistory.endsWith(allBufferedData.slice(0, len))) {
                  overlap = len
                  break
                }
              }
              unseenBufferedData = allBufferedData.slice(overlap)
            }
          }

          if (unseenBufferedData) {
            handleCustomData(unseenBufferedData, { generation: resGen })
          }

          // Drain exit events matching authoritative generation
          for (const evt of pendingEventsBuffer) {
            if (evt.generation !== undefined && resGen !== undefined && evt.generation !== resGen) {
              continue
            }
            if (evt.type === 'exit' && evt.exitCode !== undefined) {
              handleCustomExit(evt.exitCode, evt.generation)
            }
          }
          pendingEventsBuffer.length = 0

          const checkAndLaunchCustomAgent = async () => {
            if (result.reconnected) {
              try {
                const procRes = await window.ziafAPI.getActiveProcesses({ sessionId: currentTabId })
                if (isCancelled || (globalSessionFrontendGenerations[currentTabId] || 0) !== launchGen) return
                const procs = procRes?.processes || []
                // Check if ANY agent process is active in this session (Claude or Antigravity)
                const existingAgentProc = procs.find(p => {
                  const cmd = (p.command || '').toLowerCase()
                  return cmd.includes('claude') || cmd.includes('agy') || cmd.includes('antigravity') || cmd.includes('codex')
                })
                if (existingAgentProc) {
                  logDebug(`Custom tab PTY reconnected with verified active agent pid=${existingAgentProc.pid} for activeTabId=${currentTabId}`)
                  isVerifyingLiveness = false
                  globalSessionVerifyingLiveness.delete(currentTabId)
                  globalLaunchedAgentSessions.add(currentTabId)
                  if (!agentReadiness.isReady()) {
                    bootState = 1
                    logDebug(`Custom tab: existing agent is awaiting a current input prompt for sessionId=${currentTabId}`)
                    return
                  }
                  globalAgentAwaitingReadySessions.delete(currentTabId)
                  bootState = 2
                  globalAgentReadySessions.add(currentTabId)
                  globalAgentReadyFrontendGenerations[currentTabId] = globalSessionFrontendGenerations[currentTabId] || 0
                  const rawLeftover = accumulatedOutputBySession.current[currentTabId] || ''
                  const curFeed = customTabFeedsRef.current[currentTabId] || globalCustomTabFeeds[currentTabId] || []
                  const allUserMsgs = curFeed.filter(item => item.type === 'user').map(item => item.text).filter((t): t is string => Boolean(t))
                  const cleanLeftover = extractMeaningfulText(rawLeftover, allUserMsgs)
                  if (cleanLeftover) {
                    updateCustomTabFeed(currentTabId, current => {
                      if (isTextAlreadyInFeed(current, cleanLeftover)) {
                        return current
                      }
                      const lastItem = current[current.length - 1]
                      if (lastItem && lastItem.type === 'ai' && lastItem.text && cleanLeftover.startsWith(lastItem.text)) {
                        return [
                          ...current.slice(0, -1),
                          { ...lastItem, text: cleanLeftover }
                        ]
                      }
                      return [
                        ...current,
                        {
                          id: `ai-custom-log-${Date.now()}-${Math.random()}`,
                          type: 'ai' as const,
                          text: cleanLeftover
                        }
                      ]
                    })
                  }
                  accumulatedOutputBySession.current[currentTabId] = ''
                  globalAccumulatedOutputBySession[currentTabId] = ''
                  await deliverFirstAndQueuedMessages(currentTabId, currentTaskId)
                  return
                } else {
                  // Negative liveness check! Clear cached launched and ready flags
                  bootState = 0
                  globalLaunchedAgentSessions.delete(currentTabId)
                  globalAgentReadySessions.delete(currentTabId)
                  delete globalAgentReadyFrontendGenerations[currentTabId]
                  globalAgentAwaitingReadySessions.add(currentTabId)
                  globalSessionVerifyingLiveness.add(currentTabId)
                  if (ptyFlushTimer) {
                    clearTimeout(ptyFlushTimer)
                    ptyFlushTimer = null
                  }
                  const pendingPtyData = ptyBuffer
                  flushPtyBuffer()
                  const rawLeftover = accumulatedOutputBySession.current[currentTabId] || pendingPtyData || ''
                  const curFeed = customTabFeedsRef.current[currentTabId] || globalCustomTabFeeds[currentTabId] || []
                  const allUserMsgs = curFeed.filter(item => item.type === 'user').map(item => item.text).filter((t): t is string => Boolean(t))
                  const cleanLeftover = extractMeaningfulText(rawLeftover, allUserMsgs)
                  if (cleanLeftover) {
                    updateCustomTabFeed(currentTabId, current => {
                      if (isTextAlreadyInFeed(current, cleanLeftover)) {
                        return current
                      }
                      const lastItem = current[current.length - 1]
                      if (lastItem && lastItem.type === 'ai' && lastItem.text && cleanLeftover.startsWith(lastItem.text)) {
                        return [
                          ...current.slice(0, -1),
                          { ...lastItem, text: cleanLeftover }
                        ]
                      }
                      return [
                        ...current,
                        {
                          id: `ai-custom-log-${Date.now()}-${Math.random()}`,
                          type: 'ai' as const,
                          text: cleanLeftover
                        }
                      ]
                    })
                  }
                  delete globalAgentBootBuffers[currentTabId]
                  accumulatedOutputBySession.current[currentTabId] = ''
                  globalAccumulatedOutputBySession[currentTabId] = ''
                }
              } catch (procErr) {
                if (isCancelled || (globalSessionFrontendGenerations[currentTabId] || 0) !== launchGen) return
                logDebug(`Custom tab getActiveProcesses on reconnect error: ${procErr}`)
                bootState = 0
                globalLaunchedAgentSessions.delete(currentTabId)
                globalAgentReadySessions.delete(currentTabId)
                delete globalAgentReadyFrontendGenerations[currentTabId]
                globalAgentAwaitingReadySessions.add(currentTabId)
                globalSessionVerifyingLiveness.add(currentTabId)
                if (ptyFlushTimer) {
                  clearTimeout(ptyFlushTimer)
                  ptyFlushTimer = null
                }
                const pendingPtyData = ptyBuffer
                flushPtyBuffer()
                const rawLeftover = accumulatedOutputBySession.current[currentTabId] || pendingPtyData || ''
                const curFeed = customTabFeedsRef.current[currentTabId] || globalCustomTabFeeds[currentTabId] || []
                const allUserMsgs = curFeed.filter(item => item.type === 'user').map(item => item.text).filter((t): t is string => Boolean(t))
                const cleanLeftover = extractMeaningfulText(rawLeftover, allUserMsgs)
                if (cleanLeftover) {
                  updateCustomTabFeed(currentTabId, current => {
                    if (isTextAlreadyInFeed(current, cleanLeftover)) {
                      return current
                    }
                    const lastItem = current[current.length - 1]
                    if (lastItem && lastItem.type === 'ai' && lastItem.text && cleanLeftover.startsWith(lastItem.text)) {
                      return [
                        ...current.slice(0, -1),
                        { ...lastItem, text: cleanLeftover }
                      ]
                    }
                    return [
                      ...current,
                      {
                        id: `ai-custom-log-${Date.now()}-${Math.random()}`,
                        type: 'ai' as const,
                        text: cleanLeftover
                      }
                    ]
                  })
                }
                delete globalAgentBootBuffers[currentTabId]
                accumulatedOutputBySession.current[currentTabId] = ''
                globalAccumulatedOutputBySession[currentTabId] = ''
              } finally {
                isVerifyingLiveness = false
                if ((globalSessionFrontendGenerations[currentTabId] || 0) === launchGen && !globalAgentAwaitingReadySessions.has(currentTabId)) {
                  globalSessionVerifyingLiveness.delete(currentTabId)
                }
              }
            }

            if (isCancelled || (globalSessionFrontendGenerations[currentTabId] || 0) !== launchGen) return

            bootState = 0
            delete globalAgentBootBuffers[currentTabId]
            agentReadiness.reset()
            accumulatedOutputBySession.current[currentTabId] = ''
            globalAccumulatedOutputBySession[currentTabId] = ''
            if (ptyFlushTimer) {
              clearTimeout(ptyFlushTimer)
              ptyFlushTimer = null
            }
            flushPtyBuffer()
            window.ziafAPI.writePty({ 
              sessionId: currentTabId, 
              data: `export LANG=en_US.UTF-8; export LC_ALL=en_US.UTF-8; clear\n` 
            }).then(() => {
              if (isCancelled || (globalSessionFrontendGenerations[currentTabId] || 0) !== launchGen) return
              isCommandSubmitted = true
              window.ziafAPI.writePty({ sessionId: currentTabId, data: `${agentCmd}\n` }).then((cmdRes) => {
                if (isCancelled || (globalSessionFrontendGenerations[currentTabId] || 0) !== launchGen) return
                if (cmdRes && cmdRes.success === false) {
                  const errMsg = cmdRes.error || 'Failed to send launch command'
                  agentActivity.finish(currentTabId)
                  logDebug(`Custom tab agent command write failed for sessionId=${currentTabId}`)
                  isCommandSubmitted = false
                  updateCustomTabFeed(currentTabId, current => [
                    ...current,
                    {
                      id: `ai-custom-err-${Date.now()}`,
                      type: 'ai' as const,
                      text: `Failed to launch agent command: ${errMsg}`
                    }
                  ])
                  return
                }
                if (isSessionAgentReady(currentTabId)) return
                bootState = 1
                globalAgentAwaitingReadySessions.add(currentTabId)
                // Recheck the current screen if a ready input arrived during the command write.
                const currentBootBuf = globalAgentBootBuffers[currentTabId] || ''
                const isCommandNotFound = /command not found|no such file or directory|not recognized as an internal or external command/i.test(currentBootBuf)
                if (!isCommandNotFound && agentReadiness.isReady()) {
                  bootState = 2
                  isCommandSubmitted = false
                  logDebug(`Custom tab bootState -> 2: current input prompt confirmed upon command write resolution for sessionId=${currentTabId}`)
                  globalAgentAwaitingReadySessions.delete(currentTabId)
                  globalSessionVerifyingLiveness.delete(currentTabId)
                  globalLaunchedAgentSessions.add(currentTabId)
                  globalAgentReadySessions.add(currentTabId)
                  globalAgentReadyFrontendGenerations[currentTabId] = globalSessionFrontendGenerations[currentTabId] || 0
                  if (ptyFlushTimer) {
                    clearTimeout(ptyFlushTimer)
                    ptyFlushTimer = null
                  }
                  flushPtyBuffer()
                  const curFeed = customTabFeedsRef.current[currentTabId] || globalCustomTabFeeds[currentTabId] || []
                  const allUserMsgs = curFeed.filter(item => item.type === 'user').map(item => item.text).filter((t): t is string => Boolean(t))
                  const leftover = extractMeaningfulText(accumulatedOutputBySession.current[currentTabId] || '', allUserMsgs)
                  if (leftover) {
                    updateCustomTabFeed(currentTabId, current => {
                      if (isTextAlreadyInFeed(current, leftover)) return current
                      const lastItem = current[current.length - 1]
                      if (lastItem && lastItem.type === 'ai' && lastItem.text && leftover.startsWith(lastItem.text)) {
                        return [
                          ...current.slice(0, -1),
                          { ...lastItem, text: leftover }
                        ]
                      }
                      return [
                        ...current,
                        {
                          id: `ai-custom-log-${Date.now()}-${Math.random()}`,
                          type: 'ai' as const,
                          text: leftover
                        }
                      ]
                    })
                  }
                  accumulatedOutputBySession.current[currentTabId] = ''
                  globalAccumulatedOutputBySession[currentTabId] = ''
                  deliverFirstAndQueuedMessages(currentTabId, currentTaskId)
                }
              }).catch((cmdErr: Error) => {
                if (isCancelled || (globalSessionFrontendGenerations[currentTabId] || 0) !== launchGen) return
                isCommandSubmitted = false
                globalLaunchedAgentSessions.delete(currentTabId)
                globalAgentReadySessions.delete(currentTabId)
                delete globalAgentReadyFrontendGenerations[currentTabId]
                globalAgentAwaitingReadySessions.add(currentTabId)
                globalSessionVerifyingLiveness.add(currentTabId)
                const errMsg = cmdErr?.message || String(cmdErr)
                agentActivity.finish(currentTabId)
                logDebug(`Custom tab agent command write failed for sessionId=${currentTabId}`)
                updateCustomTabFeed(currentTabId, current => [
                  ...current,
                  {
                    id: `ai-custom-err-${Date.now()}`,
                    type: 'ai' as const,
                    text: `Failed to launch agent command: ${errMsg}`
                  }
                ])
              })
            }).catch((setupErr: Error) => {
              if (isCancelled || (globalSessionFrontendGenerations[currentTabId] || 0) !== launchGen) return
              globalLaunchedAgentSessions.delete(currentTabId)
              globalAgentReadySessions.delete(currentTabId)
              delete globalAgentReadyFrontendGenerations[currentTabId]
              globalAgentAwaitingReadySessions.add(currentTabId)
              globalSessionVerifyingLiveness.add(currentTabId)
              const errMsg = setupErr?.message || String(setupErr)
              agentActivity.finish(currentTabId)
              logDebug(`Custom tab setup write rejected: ${errMsg}`)
              updateCustomTabFeed(currentTabId, current => [
                ...current,
                {
                  id: `ai-custom-err-${Date.now()}`,
                  type: 'ai' as const,
                  text: `Failed to setup environment: ${errMsg}`
                }
              ])
            })
          }

          checkAndLaunchCustomAgent()
        } else {
          agentActivity.finish(currentTabId)
          logDebug(`Custom tab PTY spawn failed: ${res.error}`)
          if ((globalSessionFrontendGenerations[currentTabId] || 0) === launchGen) {
            globalSessionVerifyingLiveness.add(currentTabId)
            globalAgentAwaitingReadySessions.add(currentTabId)
            globalAgentReadySessions.delete(currentTabId)
            delete globalAgentReadyFrontendGenerations[currentTabId]
          }
          updateCustomTabFeed(currentTabId, current => [
            ...current,
            {
              id: `ai-custom-err-${Date.now()}`,
              type: 'ai' as const,
              text: `Failed to spawn background PTY terminal: ${res.error}`
            }
          ])
        }
      })
      .catch(err => {
        isSpawnPending = false
        pendingEventsBuffer.length = 0
        if ((globalSessionFrontendGenerations[currentTabId] || 0) === launchGen) {
          globalSessionVerifyingLiveness.add(currentTabId)
          globalAgentAwaitingReadySessions.add(currentTabId)
          globalAgentReadySessions.delete(currentTabId)
          delete globalAgentReadyFrontendGenerations[currentTabId]
        }
        const errMsg = err?.message || String(err)
        agentActivity.finish(currentTabId)
        logDebug(`Custom tab PTY spawn catch: ${errMsg}`)
        updateCustomTabFeed(currentTabId, current => [
          ...current,
          {
            id: `ai-custom-err-${Date.now()}`,
            type: 'ai' as const,
            text: `Failed to spawn background PTY terminal: ${errMsg}`
          }
        ])
      })

    ptyTabCleanups.current[currentTabId] = () => {
      isCancelled = true
      if ((globalSessionFrontendGenerations[currentTabId] || 0) === launchGen) {
        globalSessionVerifyingLiveness.delete(currentTabId)
      }
      flushPtyBuffer()
      if (ptyFlushTimer) { clearTimeout(ptyFlushTimer); ptyFlushTimer = null }
      clearInterval(processCheckInterval)
      if (typeof cleanupData === 'function') cleanupData()
      if (typeof cleanupExit === 'function') cleanupExit()
      persistChatHistoryRef.current()
    }

    return () => {
      isCancelled = true
      if ((globalSessionFrontendGenerations[currentTabId] || 0) === launchGen) {
        globalSessionVerifyingLiveness.delete(currentTabId)
      }
      flushPtyBuffer()
      if (ptyFlushTimer) { clearTimeout(ptyFlushTimer); ptyFlushTimer = null }
      clearInterval(processCheckInterval)
      if (typeof cleanupData === 'function') cleanupData()
      if (typeof cleanupExit === 'function') cleanupExit()
      persistChatHistoryRef.current()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabId, centralTabs, activeRepo?.id, task?.id, task?.status, task?.worktreePath, activeRepo?.repoPath, activeRepo?.path, usesStructuredAgent, settings?.useMockData])

  // Browser Address Go handler
  const handleBrowserGo = (e: React.FormEvent) => {
    e.preventDefault()
    if (!browserUrlInput.trim()) return
    
    let url = browserUrlInput.trim()
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url
    }
    setBrowserActiveUrl(url)
    
    if (url.includes('google.com')) {
      setBrowserResultsHtml('google')
    } else if (url.includes('adgway.online') || url.includes('emails')) {
      setBrowserResultsHtml('adgway')
    } else if (url.includes('github.com')) {
      setBrowserResultsHtml('github')
    } else if (url.includes('hh.kz')) {
      setBrowserResultsHtml('hh')
    } else {
      setBrowserResultsHtml('fallback')
    }
  }

  // Browser google mock query submit
  const handleGoogleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!browserSearchQuery.trim()) return
    
    setBrowserUrlInput(`https://www.google.com/search?q=${encodeURIComponent(browserSearchQuery)}`)
    setBrowserActiveUrl(`https://www.google.com/search?q=${encodeURIComponent(browserSearchQuery)}`)
    setBrowserResultsHtml('google-results')
  }

  // File tree click -> Open in central Tab editor
  const handleOpenFileTab = (filename: string, path: string, baseDir?: string) => {
    const tabId = `file-${baseDir || resolveTaskCwd(task, activeRepo) || activeRepo?.repoPath || ""}-${path}`
    workflowChats.select(tabId)
    const effectiveBaseDir = baseDir || resolveTaskCwd(task, activeRepo) || activeRepo?.repoPath
    const exists = centralTabs.some(t => t.id === tabId)
    
    if (!exists) {
      const newTab: CentralTab = {
        id: tabId,
        name: filename,
        type: 'file',
        filePath: path,
        baseDir: effectiveBaseDir
      }
      setCentralTabs(previous => previous.some(tab => tab.id === newTab.id) ? previous : [...previous, newTab])
    } else if (effectiveBaseDir) {
      setCentralTabs(prev => prev.map(t => t.id === tabId ? { ...t, baseDir: effectiveBaseDir } : t))
    }
    if (tabId !== activeTabIdRef.current) {
      abortPendingTabSend(activeTabIdRef.current, task?.id)
      activeTabIdRef.current = tabId
      setActiveTabId(tabId)
    }
    history.save()
  }

  const renderRealFileNode = (node: FileTreeNode) => {
    if (node.isDir) {
      const isOpen = folderOpenStates[node.path]
      return (
        <div key={node.path} className="space-y-1">
          <button 
            onClick={() => toggleFolder(node.path)}
            className="flex items-center gap-1.5 py-1 text-zinc-400 hover:text-white w-full text-left font-sans"
          >
            {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            <Folder className="h-3.5 w-3.5 text-blue-400 shrink-0" />
            <span className="font-semibold truncate">{node.name}</span>
          </button>
          {isOpen && node.children && (
            <div className="pl-4 space-y-1.5 border-l border-zinc-800 ml-1.5 mt-0.5">
              {node.children.map((child: FileTreeNode) => renderRealFileNode(child))}
            </div>
          )}
        </div>
      )
    } else {
      return (
        <div 
          key={node.path}
          onClick={() => handleOpenFileTab(node.name, node.path, resolveTaskCwd(task, activeRepo) || activeRepo?.repoPath)}
          className="flex items-center gap-1.5 py-0.5 text-zinc-500 hover:text-white cursor-pointer ml-4 font-sans"
        >
          <FileText className="h-3.5 w-3.5 text-zinc-600 shrink-0" />
          <span className="truncate">{node.name}</span>
        </div>
      )
    }
  }

  // Close tab
  const handleCloseTabById = (tabId: string, e?: React.MouseEvent, force = false, deferSave = false) => {
    if (e) e.stopPropagation()
    if (centralTabs.length <= 1 && !force) {
      // Don't close last tab, or reset to main feed
      return
    }
    if (activeTabId === tabId) workflowChats.stopFollowing()

    if (usesStructuredAgent && centralTabs.find(tab => tab.id === tabId)?.type === 'chat') {
      // Closing a view does not terminate the backend session or delete history.
      // Keep its identity available in Recent so reopen only attaches.
      const closed = centralTabs.find(tab => tab.id === tabId)!
      setRecentTabs(previous => [closed, ...previous.filter(tab => tab.id !== tabId)])
      const remaining = centralTabs.filter(tab => tab.id !== tabId)
      const next: CentralTab[] = remaining.length ? remaining : [{ id: 'chat-main', name: 'Discussion Feed', type: 'chat' }]
      centralTabsRef.current = next
      setCentralTabs(previous => {
        const remaining = previous.filter(tab => tab.id !== tabId)
        return remaining.length ? remaining : [{ id: 'chat-main', name: 'Discussion Feed', type: 'chat' }]
      })
      if (activeTabId === tabId) {
        activeTabIdRef.current = next[0].id
        setActiveTabId(next[0].id)
      }
      if (!deferSave) history.save()
      return
    }
    
    // Clean up PTY resources for this tab (onPtyData listener, intervals, timers)
    if (ptyTabCleanups.current[tabId]) {
      ptyTabCleanups.current[tabId]()
      delete ptyTabCleanups.current[tabId]
    }
    activeCustomPtySessions.current.delete(tabId)
    agentActivity.forget(tabId)
    window.ziafAPI.killPty({ sessionId: tabId }).catch(() => {})

    // Full lifecycle and buffer cleanup for the closed session
    abortPendingTabSend(tabId)
    if (activeTabIdRef.current === tabId) {
      abortPendingTabSend(activeTabIdRef.current, task?.id)
    }
    clearSessionLifecycleState(tabId, undefined, { preservePendingInputs: false })
    delete globalSessionTerminalLogs[tabId]
    delete globalSessionLastSnapshot[tabId]
    delete globalSessionGenerations[tabId]
    delete globalSessionFrontendGenerations[tabId]
    delete globalSessionTaskOwners[tabId]
    delete ptyScreenState.current[tabId]
    delete globalPtyScreenState[tabId]
    delete customTabScreensRef.current[tabId]

    const closedChat = centralTabs.find(tab => tab.id === tabId && tab.type === 'chat')
    if (closedChat) setRecentTabs(previous => [closedChat, ...previous.filter(tab => tab.id !== tabId)])
    // Release transient terminal screens while retaining the closed conversation.
    setCustomTabScreens(prev => {
      const next = { ...prev }
      delete next[tabId]
      return next
    })

    const index = centralTabs.findIndex(t => t.id === tabId)
    const remaining = centralTabs.filter(t => t.id !== tabId)
    const nextTabs: CentralTab[] = remaining.length ? remaining : [{ id: 'chat-main', name: 'Discussion Feed', type: 'chat' }]
    centralTabsRef.current = nextTabs
    setCentralTabs(previous => {
      const remaining = previous.filter(tab => tab.id !== tabId)
      return remaining.length ? remaining : [{ id: 'chat-main', name: 'Discussion Feed', type: 'chat' }]
    })

    if (activeTabId === tabId && nextTabs.length > 0) {
      const nextActiveIndex = Math.max(0, (index >= 0 ? index : 1) - 1)
      const nextActiveId = nextTabs[nextActiveIndex].id
      activeTabIdRef.current = nextActiveId
      setActiveTabId(nextActiveId)
    }
    if (!deferSave) history.save()
  }

  // Open Chat Tab
  const handleNewChatTab = () => {
    workflowChats.stopFollowing()
    const nextIdx = centralTabs.filter(t => t.type === 'chat').length + 1
    const chatTabId = `chat-${Date.now()}`
    const newTab: CentralTab = {
      id: chatTabId,
      name: `Chat ${nextIdx}`,
      type: 'chat'
    }
    setCentralTabs(previous => [...previous, newTab])
    abortPendingTabSend(activeTabIdRef.current, task?.id)
    activeTabIdRef.current = chatTabId
    setActiveTabId(chatTabId)
    history.save()
  }

  // Create new file dynamically
  const handleCreateNewFileSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newFilePath.trim()) return
    
    const pathVal = newFilePath.trim()
    const filename = pathVal.split('/').pop() || pathVal
    
    const targetBaseDir = resolveTaskCwd(task, activeRepo) || activeRepo?.repoPath
    if (settings?.useMockData === false && targetBaseDir) {
      try {
        if (!activeRepo) throw new Error(uiText("Project is not selected"))
        const created = await window.ziafAPI.editorCreate({ repoId: activeRepo.id, taskId: task?.id, scope: task ? 'task' : 'project', relativePath: pathVal, text: '' })
        await window.ziafAPI.editorClose({ id: created.id })
        const files = await window.ziafAPI.listProjectFiles({ projectPath: targetBaseDir })
        setRealFiles(files)
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err)
        console.error(err)
        alert(uiText("Failed to create file: {errMsg}", { errMsg: errMsg }))
        return
      }
    } else {
      createNewFile(pathVal, '')
    }
    
    setShowNewFileInput(false)
    setNewFilePath('')
    
    // Automatically open in tabs
    handleOpenFileTab(filename, pathVal, targetBaseDir)
  }

  // Create new folder dynamically
  const handleCreateNewFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newFolderPath.trim()) return
    
    const pathVal = newFolderPath.trim()
    const targetBaseDir = resolveTaskCwd(task, activeRepo) || activeRepo?.repoPath
    
    if (settings?.useMockData === false && targetBaseDir) {
      const absolutePath = `${targetBaseDir}/${pathVal}`
      try {
        await window.ziafAPI.createDirectory({ dirPath: absolutePath })
        const files = await window.ziafAPI.listProjectFiles({ projectPath: targetBaseDir })
        setRealFiles(files)
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err)
        console.error(err)
        alert(uiText("Failed to create directory: {errMsg}", { errMsg: errMsg }))
        return
      }
    } else {
      alert(uiText("Directory created in mock mode: {pathVal}", { pathVal: pathVal }))
    }
    
    setShowNewFolderInput(false)
    setNewFolderPath('')
  }

  // Git Commit trigger
  const handleGitCommitSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!commitMessage.trim() || !task) return
    
    commitGitChanges(task.id, commitMessage.trim())
    setCommitMessage('')
    setGitStatusAlert(true)
    setTimeout(() => setGitStatusAlert(false), 3000)
  }

  // Send Chat message
  const sendChatMessage = async (msgOverride?: string, attachedFiles?: ComposerAttachment[]) => {
    if (!isMountedRef.current) return

    let rawMsg = typeof msgOverride === 'string' ? msgOverride : chatMessage
    if (attachedFiles && attachedFiles.length > 0) {
      const attachText = attachedFiles.map(a => `@${a.name}${a.path ? ` (${a.path})` : ''}`).join(' ')
      rawMsg = rawMsg ? `${rawMsg.trim()}\n${attachText}` : attachText
    }
    if (!rawMsg.trim()) return
    const userMsg = rawMsg.trim()

    const isMainFeed = activeTabId === 'feed' || activeTabId === 'chat-main'
    const targetTaskId = task?.id
    const sessionId = getSessionIdForTab(activeTabId)
    const initialTaskId = targetTaskId
    const initialSessionId = sessionId
    const initialTabId = activeTabId

    clearSessionStopped(sessionId)
    clearSessionStopped(activeTabId)
    if (targetTaskId) {
      clearSessionStopped(targetTaskId)
    }

    const initialSessionCancelVer = globalSessionCancellationVersions[sessionId] || 0
    const initialTabCancelVer = globalSessionCancellationVersions[activeTabId] || 0
    const initialTaskCancelVer = targetTaskId ? (globalSessionCancellationVersions[targetTaskId] || 0) : 0

    const isExplicitlyCancelled = () => {
      if ((globalSessionCancellationVersions[initialSessionId] || 0) !== initialSessionCancelVer) return true
      if ((globalSessionCancellationVersions[initialTabId] || 0) !== initialTabCancelVer) return true
      if (initialTaskId && (globalSessionCancellationVersions[initialTaskId] || 0) !== initialTaskCancelVer) return true
      if (globalStoppedSessions.has(initialSessionId) || globalStoppedSessions.has(initialTabId) || (initialTaskId && globalStoppedSessions.has(initialTaskId))) return true
      return false
    }

    logDebug(`handleSendChatMessage: inputChars=${userMsg.length}, isMainFeed=${isMainFeed}, activeTabId="${activeTabId}", sessionId="${sessionId}", taskStatus="${task ? task.status : 'undefined'}"`)

    if (isMainFeed) {
      // If task is not running, auto-start it so the terminal CLI agent process spawns in the worktree!
      if (task && task.status !== 'running') {
        logDebug(`handleSendChatMessage: task status !== 'running', registering pending first input and calling startTask for taskId=${task.id}`)
        const firstKey = getQueueKey(sessionId, targetTaskId)
        const attemptId = `attempt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
        globalPendingFirstInput[firstKey] = userMsg
        globalPendingFirstInput[sessionId] = userMsg
        globalPendingFirstAttemptId[firstKey] = attemptId
        globalPendingFirstAttemptId[sessionId] = attemptId
        pendingFirstInputBySession.current[sessionId] = userMsg
        pendingFirstAttemptBySession.current[sessionId] = attemptId
        globalFirstInputVersions[firstKey] = (globalFirstInputVersions[firstKey] || 0) + 1
        globalFirstInputVersions[sessionId] = (globalFirstInputVersions[sessionId] || 0) + 1
        globalSessionTaskOwners[sessionId] = targetTaskId
        const optimisticMsgId = `user-msg-${Date.now()}`
        useStore.getState().appendFeedItem({
          id: optimisticMsgId,
          type: 'user',
          text: userMsg
        }, targetTaskId)

        const inFlightInfo: InFlightStartupSend = {
          tabId: initialTabId,
          taskId: initialTaskId,
          sessionId: initialSessionId,
          firstKey,
          userMsg,
          attemptId
        }
        globalInFlightStartupSends.set(initialSessionId, inFlightInfo)
        globalInFlightStartupSends.set(firstKey, inFlightInfo)
        globalInFlightStartupSends.set(initialTabId, inFlightInfo)
        if (initialTaskId) {
          globalInFlightStartupSends.set(initialTaskId, inFlightInfo)
        }

        const cleanupInFlightStartup = () => {
          if (globalInFlightStartupSends.get(initialSessionId)?.attemptId === attemptId) {
            globalInFlightStartupSends.delete(initialSessionId)
          }
          if (globalInFlightStartupSends.get(firstKey)?.attemptId === attemptId) {
            globalInFlightStartupSends.delete(firstKey)
          }
          if (globalInFlightStartupSends.get(initialTabId)?.attemptId === attemptId) {
            globalInFlightStartupSends.delete(initialTabId)
          }
          if (initialTaskId && globalInFlightStartupSends.get(initialTaskId)?.attemptId === attemptId) {
            globalInFlightStartupSends.delete(initialTaskId)
          }
        }

        const cleanupPendingFirstForAttempt = () => {
          if (globalPendingFirstAttemptId[firstKey] === attemptId) {
            delete globalPendingFirstInput[firstKey]
            delete globalPendingFirstAttemptId[firstKey]
            globalFirstInputVersions[firstKey] = (globalFirstInputVersions[firstKey] || 0) + 1
          }
          if (globalPendingFirstAttemptId[initialSessionId] === attemptId) {
            delete globalPendingFirstInput[initialSessionId]
            delete globalPendingFirstAttemptId[initialSessionId]
            globalFirstInputVersions[initialSessionId] = (globalFirstInputVersions[initialSessionId] || 0) + 1
          }
          if (pendingFirstAttemptBySession.current[initialSessionId] === attemptId) {
            delete pendingFirstInputBySession.current[initialSessionId]
            delete pendingFirstAttemptBySession.current[initialSessionId]
          }
        }

        const cleanupQueueForAttempt = () => {
          const qKey = getQueueKey(initialSessionId, initialTaskId)
          const q = globalPendingMessagesQueue[qKey]
          if (q) {
            for (let i = q.length - 1; i >= 0; i--) {
              if (getQueueItemAttemptId(q[i]) === attemptId) {
                q.splice(i, 1)
              }
            }
          }
        }

        try {
          try {
            await useStore.getState().startTask(task.id)
          } catch (err: unknown) {
            logDebug(`handleSendChatMessage: main feed startTask threw error: ${err}`)
            cleanupPendingFirstForAttempt()
            cleanupQueueForAttempt()
            useStore.setState(s => ({
              tasks: s.tasks.map(t => t.id === initialTaskId ? { ...t, feed: t.feed.filter(item => item.id !== optimisticMsgId) } : t),
              activeFeed: s.activeTaskId === initialTaskId ? s.activeFeed.filter(item => item.id !== optimisticMsgId) : s.activeFeed
            }))
            throw err
          }

          // If a write to PTY is currently in-flight for this attempt, await it before deciding on rollback!
          const inFlightWrite = globalInFlightWritePromises.get(attemptId)
          if (inFlightWrite) {
            try {
              await inFlightWrite
            } catch {
              // ignore
            }
          }

          const wasDelivered = globalDeliveredAttemptIds.has(attemptId)

          if (wasDelivered) {
            logDebug(`handleSendChatMessage: first message for attemptId=${attemptId} was already delivered to PTY during startTask for taskId=${initialTaskId}`)
            return
          }

          if (!isMountedRef.current) {
            logDebug(`handleSendChatMessage: component unmounted during startTask for taskId=${initialTaskId}`)
            return
          }

          const currentActiveTaskId = useStore.getState().activeTaskId
          const currentTask = useStore.getState().tasks.find(t => t.id === initialTaskId)
          const isStillActiveTab = activeTabIdRef.current === initialTabId
          const wasCancelled = isExplicitlyCancelled() || (attemptId ? globalCancelledAttemptIds.has(attemptId) : false)

          if (!currentTask || currentTask.status !== 'running') {
            logDebug(`handleSendChatMessage: main feed startTask failed for taskId=${initialTaskId}, clearing pending inputs`)
            cleanupPendingFirstForAttempt()
            cleanupQueueForAttempt()
            useStore.setState(s => ({
              tasks: s.tasks.map(t => t.id === initialTaskId ? { ...t, feed: t.feed.filter(item => item.id !== optimisticMsgId) } : t),
              activeFeed: s.activeTaskId === initialTaskId ? s.activeFeed.filter(item => item.id !== optimisticMsgId) : s.activeFeed
            }))
            throw new Error(uiText("Could not start task {name}.", { name: currentTask?.name || task?.name || initialTaskId || uiText("Task") }))
          }

          if (wasCancelled) {
            logDebug(`handleSendChatMessage: main feed execution was stopped during startTask for sessionId=${initialSessionId}`)
            cleanupPendingFirstForAttempt()
            cleanupQueueForAttempt()
            useStore.setState(s => ({
              tasks: s.tasks.map(t => t.id === initialTaskId ? { ...t, feed: t.feed.filter(item => item.id !== optimisticMsgId) } : t),
              activeFeed: s.activeTaskId === initialTaskId ? s.activeFeed.filter(item => item.id !== optimisticMsgId) : s.activeFeed
            }))
            throw new Error(uiText("Send cancelled: task execution was stopped."))
          }

          if (currentActiveTaskId !== initialTaskId || !isStillActiveTab) {
            logDebug(`handleSendChatMessage: activeTaskId or tab changed after startTask in main feed (initialTaskId=${initialTaskId}, currentActiveTaskId=${currentActiveTaskId}, initialTabId=${initialTabId}, activeTabId=${activeTabIdRef.current})`)
            cleanupPendingFirstForAttempt()
            cleanupQueueForAttempt()
            useStore.setState(s => ({
              tasks: s.tasks.map(t => t.id === initialTaskId ? { ...t, feed: t.feed.filter(item => item.id !== optimisticMsgId) } : t),
              activeFeed: s.activeTaskId === initialTaskId ? s.activeFeed.filter(item => item.id !== optimisticMsgId) : s.activeFeed
            }))
            throw new Error(uiText("Send cancelled: the active tab or task changed during startup."))
          }

          const queueKey = getQueueKey(initialSessionId, initialTaskId)
          if (
            globalPendingFirstAttemptId[firstKey] === attemptId ||
            globalPendingFirstAttemptId[initialSessionId] === attemptId
          ) {
            cleanupPendingFirstForAttempt()
            if (!globalPendingMessagesQueue[queueKey]) {
              globalPendingMessagesQueue[queueKey] = []
            }
            const alreadyInQueue = globalPendingMessagesQueue[queueKey].some(
              item => getQueueItemAttemptId(item) === attemptId
            )
            if (!alreadyInQueue) {
              globalPendingMessagesQueue[queueKey].push({ attemptId, text: userMsg })
            }
          }

          if (isSessionAgentReady(initialSessionId)) {
            await deliverFirstAndQueuedMessages(initialSessionId, initialTaskId)
          } else {
            logDebug(`handleSendChatMessage: task started, agent booting for ${initialSessionId}, message moved to queue`)
          }
          return
        } finally {
          cleanupInFlightStartup()
        }
      }

      // Check if task is running and we have an active PTY session to send inputs directly
      if (task && task.status === 'running') {
        const queueKey = getQueueKey(sessionId, targetTaskId)
        if (!globalPendingMessagesQueue[queueKey]) {
          globalPendingMessagesQueue[queueKey] = []
        }
        const runAttemptId = `run-attempt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
        globalPendingMessagesQueue[queueKey].push({ attemptId: runAttemptId, text: userMsg })
        globalSessionTaskOwners[sessionId] = targetTaskId
        useStore.getState().appendFeedItem({
          id: `user-msg-${Date.now()}`,
          type: 'user',
          text: userMsg
        }, targetTaskId)

        // Route all messages through the serialized delivery pump strictly once the agent is ready
        if (isSessionAgentReady(sessionId)) {
          await deliverFirstAndQueuedMessages(sessionId, targetTaskId)
        } else {
          logDebug(`handleSendChatMessage: agent still booting for ${sessionId}, queued input chars=${userMsg.length}`)
        }
        return
      }
    } else {
      // Custom Tab Feed
      if (task && task.status !== 'running') {
        logDebug(`handleSendChatMessage: custom tab task status !== 'running', starting task ${task.id}`)
        const attemptId = `custom-attempt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
        const inFlightInfo: InFlightStartupSend = {
          tabId: initialTabId,
          taskId: initialTaskId,
          sessionId: initialSessionId,
          firstKey: getQueueKey(sessionId, targetTaskId),
          userMsg,
          attemptId
        }
        globalInFlightStartupSends.set(initialSessionId, inFlightInfo)
        globalInFlightStartupSends.set(inFlightInfo.firstKey, inFlightInfo)
        globalInFlightStartupSends.set(initialTabId, inFlightInfo)
        if (initialTaskId) {
          globalInFlightStartupSends.set(initialTaskId, inFlightInfo)
        }

        const cleanupInFlightCustom = () => {
          if (globalInFlightStartupSends.get(initialSessionId)?.attemptId === attemptId) {
            globalInFlightStartupSends.delete(initialSessionId)
          }
          if (globalInFlightStartupSends.get(inFlightInfo.firstKey)?.attemptId === attemptId) {
            globalInFlightStartupSends.delete(inFlightInfo.firstKey)
          }
          if (globalInFlightStartupSends.get(initialTabId)?.attemptId === attemptId) {
            globalInFlightStartupSends.delete(initialTabId)
          }
          if (initialTaskId && globalInFlightStartupSends.get(initialTaskId)?.attemptId === attemptId) {
            globalInFlightStartupSends.delete(initialTaskId)
          }
        }

        try {
          try {
            await useStore.getState().startTask(task.id)
          } catch (err: unknown) {
            logDebug(`handleSendChatMessage: custom tab startTask threw error: ${err}`)
            throw err
          }

          const inFlightWrite = globalInFlightWritePromises.get(attemptId)
          if (inFlightWrite) {
            try {
              await inFlightWrite
            } catch {
              // ignore
            }
          }

          if (!isMountedRef.current) {
            logDebug(`handleSendChatMessage: component unmounted during custom tab startTask`)
            return
          }

          const currentActiveTaskId = useStore.getState().activeTaskId
          const currentTask = useStore.getState().tasks.find(t => t.id === initialTaskId)
          const isStillActiveTab = activeTabIdRef.current === initialTabId
          const wasCancelled = isExplicitlyCancelled() || (attemptId ? globalCancelledAttemptIds.has(attemptId) : false)

          // Check if task failed to start
          if (!currentTask || currentTask.status !== 'running') {
            logDebug(`handleSendChatMessage: custom tab task ${initialTaskId} failed to start`)
            const errMsg = uiText("Could not start task {name}. Check its status.", { name: currentTask?.name || task?.name || initialTaskId || uiText("Task") })
            updateCustomTabFeed(initialTabId, current => [
              ...current,
              {
                id: `ai-start-err-${Date.now()}`,
                type: 'ai' as const,
                text: errMsg
              }
            ])
            throw new Error(errMsg)
          }

          // Check if stopped during startup
          if (wasCancelled) {
            logDebug(`handleSendChatMessage: custom tab was stopped during startTask for tabId=${initialTabId}`)
            throw new Error(uiText("Send cancelled: execution was stopped."))
          }

          // Check if task or tab changed during the asynchronous startTask
          if (currentActiveTaskId !== initialTaskId || !isStillActiveTab) {
            logDebug(`handleSendChatMessage: task or tab switched during startTask (initialTaskId=${initialTaskId}, currentActiveTaskId=${currentActiveTaskId}, initialTabId=${initialTabId}, activeTabId=${activeTabIdRef.current})`)
            throw new Error(uiText("Send cancelled: the tab or task was switched during startup."))
          }
        } finally {
          cleanupInFlightCustom()
        }
      }

      if (isExplicitlyCancelled()) {
        logDebug(`handleSendChatMessage: custom tab was cancelled before sending message for tabId=${activeTabId}`)
        throw new Error(uiText("Send cancelled: execution was stopped."))
      }

      const nextIdx = (globalCustomTabFeeds[activeTabId] || []).filter(item => item.type === 'user').length
      const userMsgItem = {
        id: `user-custom-${activeTabId}-${nextIdx}-${Date.now()}`,
        type: 'user' as const,
        text: userMsg
      }
      updateCustomTabFeed(activeTabId, current => [...current, userMsgItem])

      const queueKey = getQueueKey(activeTabId, targetTaskId)
      if (!globalPendingMessagesQueue[queueKey]) {
        globalPendingMessagesQueue[queueKey] = []
      }
      const customRunAttemptId = `custom-run-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
      globalPendingMessagesQueue[queueKey].push({ attemptId: customRunAttemptId, text: userMsg })
      globalSessionTaskOwners[activeTabId] = targetTaskId

      if (isSessionAgentReady(activeTabId)) {
        await deliverFirstAndQueuedMessages(activeTabId, targetTaskId)
      } else {
        logDebug(`handleSendChatMessage: custom agent still booting for ${activeTabId}, queued input chars=${userMsg.length}`)
      }
    }
  }

  const handleSendChatMessage = async (msgOverride?: string, attachedFiles?: ComposerAttachment[]) => {
    if (legacyReasoningUnsupported) throw new Error(t('composer_legacy_reasoning_unavailable'))
    const sessionId = getSessionIdForTab(activeTabId)
    const completeInput = agentActivity.beginInput(sessionId)
    try {
      await sendChatMessage(msgOverride, attachedFiles)
    } finally {
      syncSessionQueuedInput(sessionId)
      completeInput()
    }
  }

  const handleChatKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    const sessionId = getSessionIdForTab(activeTabId)

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      logDebug(`handleChatKeyDown: ArrowUp, writing ANSI to PTY sessionId=${sessionId}`)
      window.ziafAPI.writePty({ sessionId, data: '\u001b[A' }).catch(() => {})
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      logDebug(`handleChatKeyDown: ArrowDown, writing ANSI to PTY sessionId=${sessionId}`)
      window.ziafAPI.writePty({ sessionId, data: '\u001b[B' }).catch(() => {})
    } else if (e.key === 'Enter') {
      if (e.shiftKey) {
        // Allow newline in multiline textarea
        return
      }
      if (!chatMessage.trim()) {
        e.preventDefault()
        logDebug(`handleChatKeyDown: Empty Enter, writing \\r to PTY sessionId=${sessionId}`)
        window.ziafAPI.writePty({ sessionId, data: '\r' }).catch(() => {})
      } else {
        e.preventDefault()
        handleSendChatMessage(undefined, attachments)
      }
    }
  }

  // Checklist updates
  const completedTodoCount = task ? task.todoSteps.filter(s => s.done).length : 0
  const totalTodoCount = task ? task.todoSteps.length : 0

  const handleDeleteStep = (stepId: string, stepTaskId?: string) => {
    const targetTaskId = stepTaskId || task?.id
    if (!targetTaskId) return
    deleteTodoStep(targetTaskId, stepId)
  }

  const handleUpdateStep = (stepId: string, updates: Partial<TodoStep>, stepTaskId?: string) => {
    const targetTaskId = stepTaskId || task?.id
    if (!targetTaskId) return
    updateTodoStep(targetTaskId, stepId, updates)
  }

  const handleOpenStructuredPlan = async () => {
    if (!task) return
    const planContent = JSON.stringify(
      {
        taskId: task.id,
        taskName: task.name,
        steps: task.todoSteps || [],
        createdAt: new Date().toISOString(),
      },
      null,
      2
    )
    const targetDir = resolveTaskCwd(task, activeRepo) || activeRepo?.repoPath
    if (settings?.useMockData === false && targetDir) {
      const absolutePath = `${targetDir}/plan.json`
      await window.ziafAPI.writeFile({ filePath: absolutePath, content: planContent }).catch(err => {
        logDebug(`handleOpenStructuredPlan: failed to write ${absolutePath}: ${err?.message || err}`)
      })
    }
    editFileContent('plan.json', planContent)
    handleOpenFileTab('plan.json', 'plan.json', targetDir)
  }

  const toggleFolder = (folderPath: string) => {
    setFolderOpenStates(prev => ({
      ...prev,
      [folderPath]: !prev[folderPath]
    }))
  }

  if (!task) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[#0b0c0e] text-zinc-500 font-medium">
        {uiText("Select or create a task to open the workspace.")}</div>
    )
  }

  const isDone = task.status === 'done'
  const runningProcesses = (customTabFeeds[activeTabId] || [])
    .filter(item => item.type === 'tools')
    .flatMap(item => (item.tools || []).filter((t: { type?: string; isRunning?: boolean; title?: string; content?: string }) => t.type === 'ran' && t.isRunning))

  const normalizeCommandLine = (cmd: string): string => {
    if (!cmd) return ''
    let cleaned = cmd
      .replace(/^[●○•]\s*/, '')
      .replace(/\(ctrl\+o to expand\)/g, '')
      .trim()
    
    const wrapperMatch = cleaned.match(/^[a-zA-Z0-9_]+\((.*)\)$/s)
    if (wrapperMatch) {
      cleaned = wrapperMatch[1].trim()
      if ((cleaned.startsWith('"') && cleaned.endsWith('"')) ||
          (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
        cleaned = cleaned.substring(1, cleaned.length - 1).trim()
      }
    }

    const tokens = cleaned.split(/\s+/)
    const cleanedTokens = tokens.map((token, index) => {
      if (index <= 1 && (token.includes('/') || token.includes('\\') || token.toLowerCase().includes('python') || token.toLowerCase().includes('node'))) {
        let name = token.split(/[/\\]/).pop() || token
        name = name.toLowerCase()
        if (name.startsWith('python')) return 'python'
        if (name.startsWith('node')) return 'node'
        return name
      }
      return token
    })

    return cleanedTokens.join(' ').toLowerCase().trim()
  }

  const findPidForCommand = (cmd: string): number | null => {
    const pids = customTabPids[activeTabId] || []
    if (pids.length === 0) return null

    const cleanPattern = normalizeCommandLine(cmd)
    if (!cleanPattern) return null

    for (const proc of pids) {
      const procCmdClean = normalizeCommandLine(proc.command)
      if (procCmdClean.includes(cleanPattern) || cleanPattern.includes(procCmdClean)) {
        return proc.pid
      }
    }
    
    return null
  }

  const openHistoryTab = (tab: CentralTab) => {
    workflowChats.select(tab.id)
    if (!centralTabs.some(item => item.id === tab.id)) setCentralTabs(previous => [...previous, tab])
    if (tab.id !== activeTabIdRef.current) {
      abortPendingTabSend(activeTabIdRef.current, task?.id)
      activeTabIdRef.current = tab.id
      setActiveTabId(tab.id)
    }
    setRecentTabs(previous => previous.filter(item => item.id !== tab.id))
    history.save()
  }
  const closeAllTabs = () => {
    workflowChats.stopFollowing()
    const closed = centralTabs.filter(tab => tab.id !== 'chat-main')
    // PTY cleanup callbacks may flush history too. Publish one coherent final
    // snapshot, with an active tab that still exists, after every view closes.
    tabHistoryTransaction.current = true
    try {
      for (const tab of closed) handleCloseTabById(tab.id, undefined, true, true)
      setRecentTabs(previous => [...closed.filter(tab => tab.type === 'chat'), ...previous.filter(tab => !closed.some(item => item.id === tab.id) && tab.id !== 'chat-main')])
      setCentralTabs([{ id: 'chat-main', name: 'Discussion Feed', type: 'chat' }])
      activeTabIdRef.current = 'chat-main'
      setActiveTabId('chat-main')
    } finally { tabHistoryTransaction.current = false }
    history.save()
  }
  const renderTabsPrefix = () => <ChatHistoryDropdown tabs={centralTabs} recent={recentTabs} activeTabId={activeTabId}
    onOpen={openHistoryTab} onCloseAll={closeAllTabs} error={history.error} />

  const renderTabsSuffix = () => (
    <div className="flex items-center gap-1 shrink-0 ml-2">
      {task?.codeFlowVersion === 1 && task.mode !== 'work' && usesStructuredAgent && <button type="button" data-testid="open-code-dialogue"
        onClick={() => openHistoryTab({ id: CODE_DIALOGUE_TAB, name: uiText("Forge · Discussion", undefined, (workflowRussian) ? 'ru' : undefined), type: 'chat' })}
        className="rounded-md px-2 py-1 text-[11px] text-orange-400 hover:bg-[#15171a]">{uiText("Discuss", undefined, (workflowRussian) ? 'ru' : undefined)}</button>}
      {workflowChats.currentId && <button type="button" data-testid="follow-workflow-chat"
        aria-pressed={workflowChats.following} onClick={workflowChats.follow}
        className={`rounded-md px-2 py-1 text-[11px] ${workflowChats.following ? 'text-orange-400' : 'text-zinc-400 hover:text-white hover:bg-[#15171a]'}`}>
        {uiText(workflowChats.following ? "Following stage" : "Follow stage")}
      </button>}
      <button 
        onClick={handleNewChatTab}
        className="flex items-center gap-1 px-2.5 py-1 rounded-md text-zinc-400 hover:text-white hover:bg-[#15171a] text-[11px] font-medium cursor-pointer"
        data-testid="btn-new-chat"
      >
        <MessageSquare className="h-3 w-3" />
        <span>{t('new_chat')}</span>
      </button>
      <button className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-300" title={t('split_view')}>
        <Columns className="h-3.5 w-3.5" />
      </button>
    </div>
  )

  const sendPromptResponse = async (promptId: string, answer: string, recordedAnswer = answer) => {
    if (useStore.getState().answeredPromptIds[promptId] || submittingPromptIds.current.has(promptId)) return
    let sessionId = getSessionIdForTab(activeTabId)
    const customMatch = promptId.match(/^prompt-custom-pty-(.+?)(?:-g\d+)?-\d+-\d+$/)
    if (customMatch && customMatch[1]) {
      sessionId = getSessionIdForTab(customMatch[1])
    }
    const ptyMatch = promptId.match(/^prompt-pty-(.+?)-\d+-(?:0\.)?\d+$/)
    if (ptyMatch && ptyMatch[1]) {
      sessionId = ptyMatch[1]
    }
    submittingPromptIds.current.add(promptId)
    setPromptError(null)

    const isMainFeed = activeTabId === 'feed' || activeTabId === 'chat-main'
    const currentFeed = isMainFeed
      ? (useStore.getState().tasks.find(t => t.id === task?.id)?.feed || useStore.getState().activeFeed || [])
      : (customTabFeeds[activeTabId] || [])

    const findPromptInFeed = (feed: (FeedItem | ToolItem)[]): { text?: string; promptActions?: PromptAction[] } | undefined => {
      for (const item of feed) {
        if (item.id === promptId) return item
        if ('tools' in item && Array.isArray(item.tools)) {
          for (const tool of item.tools) {
            if (tool.id === promptId) return tool
          }
        }
      }
      return undefined
    }

    let promptItem = findPromptInFeed(currentFeed)
    if (!promptItem && !isMainFeed && customTabFeedsRef.current[activeTabId]) {
      promptItem = findPromptInFeed(customTabFeedsRef.current[activeTabId])
    }

    const matchedAction = promptItem?.promptActions?.find(a => a.id === answer)
    let dataToSend = matchedAction?.payload
    if (!dataToSend) {
      const promptText = promptItem?.text || ''
      const isNav = /↑\/↓\s*Navigate|Navigate\s*·|enter\s*Confirm/i.test(promptText)
      if (isNav) {
        const num = parseInt(answer, 10)
        if (!isNaN(num) && num >= 1) {
          dataToSend = num === 1 ? '\r' : '\u001b[B'.repeat(num - 1) + '\r'
        }
      }
    }
    if (!dataToSend) {
      dataToSend = answer.endsWith('\r') ? answer : answer + '\r'
    }

    // Consume a prompt which has no trailing newline before the CLI echoes its answer.
    const pendingOutput = accumulatedOutputBySession.current[sessionId] || ''
    accumulatedOutputBySession.current[sessionId] = ''
    try {
      agentActivity.startTurn(sessionId)
      const result = await writeAgentInput(sessionId, dataToSend)
      if (!result.success) throw new Error(result.error || uiText("Failed to send answer"))
      if (activePromptIdBySession.current[sessionId] === promptId) {
        delete activePromptIdBySession.current[sessionId]
      }
      recordAnsweredPrompt(promptId, recordedAnswer)
      if (settings?.useMockData !== false && promptId === 'prompt-patch') respondToPrompt(answer)
    } catch (error) {
      accumulatedOutputBySession.current[sessionId] = pendingOutput + (accumulatedOutputBySession.current[sessionId] || '')
      const message = error instanceof Error ? error.message : String(error)
      setPromptError(message)
      logDebug('Prompt response failed: ' + message)
      throw error
    } finally {
      submittingPromptIds.current.delete(promptId)
    }
  }

  const renderFeed = () => {
    if (usesStructuredAgent && task && activeTab.type === 'chat') {
      const chatId = activeTabId === 'feed' ? 'chat-main' : activeTabId
      if (task.codeFlowVersion === 1 && task.mode !== 'work' && chatId === CODE_DIALOGUE_TAB) return <CodeDialogue key={task.id} task={task}
        onOpenPlan={() => setRightPanelTab('todo')} onOpenChat={(id, name) => openHistoryTab({ id, name, type: 'chat' })} />
      return <StructuredChat
        key={JSON.stringify([task.id, chatId])}
        taskId={task.id}
        chatId={chatId}
        workflowTitle={(task.codeFlowVersion === 1 && task.mode !== 'work' || task.workFlowVersion === 1) && chatId.startsWith('wf-') ? activeTab.name : undefined}
        workflowKind={task.workFlowVersion === 1 ? 'work' : undefined}
        presetName={taskPreset}
        provider={taskProvider}
        model={task.providerModel}
        apiConnectionId={task.apiConnectionId}
        permissions={task.permissions}
        reasoningEffort={task.reasoningEffort}
        presets={presets}
        initialPrompt={chatId === 'chat-main' && task.codeFlowVersion !== 1 && task.workFlowVersion !== 1 ? task.description : undefined}
        onOpenCodeDiscussion={task.codeFlowVersion === 1 && task.mode !== 'work' ? () => openHistoryTab({ id: CODE_DIALOGUE_TAB, name: uiText("Forge · Discussion", undefined, (workflowRussian) ? 'ru' : undefined), type: 'chat' }) : undefined}
      />
    }
    const isMainFeed = activeTabId === 'feed' || activeTabId === 'chat-main'
    const logs = isMainFeed ? activeLogs : (_customTabScreens[activeTabId] || [])
    const hasCustomPty = !isMainFeed && activeCustomPtySessions.current.has(activeTabId)
    const currentFeed = isMainFeed ? activeFeed : (customTabFeeds[activeTabId] || [])

    return (
      <div className="flex-1 flex flex-col overflow-hidden h-full">
        {/* Telemetry bar - pinned to top, resizable */}
        {(isMainFeed || isCustomChatTab(activeTabId, centralTabs) || hasCustomPty || logs.length > 0) && (
          <div className="border-b border-[#1e2024] bg-[#090a0c] shrink-0" data-testid="stdout-telemetry-bar">
            <button
              onClick={() => setTelemetryCollapsed(prev => !prev)}
              className="flex items-center justify-between w-full px-4 py-1.5 text-xs select-none hover:bg-[#15171a] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                {telemetryCollapsed ? <ChevronRight className="h-3 w-3 text-zinc-500" /> : <ChevronDown className="h-3 w-3 text-zinc-500" />}
                <TerminalIcon className="h-3.5 w-3.5 text-[#ff6b00]" />
                <span className="font-bold text-white">{uiText("Stdout telemetry stream")}</span>
                <span className="text-[9px] text-zinc-500 font-mono">• {uiText("Log lines: {count}", { count: logs.length })}</span>
              </div>
              <div className="flex items-center gap-3">
                <span
                  onClick={(e) => {
                    e.stopPropagation()
                    let cleanLogsText = ""
                    if (isMainFeed) {
                      cleanLogsText = logs.map(line => {
                        let l = line
                        try { l = decodeURIComponent(l) } catch { /* ignore */ }
                        // eslint-disable-next-line no-control-regex
                        return l.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '')
                      }).join('')
                    } else {
                      const cleanLines = [...logs]
                      while (cleanLines.length > 0 && cleanLines[cleanLines.length - 1].trim() === "") {
                        cleanLines.pop()
                      }
                      cleanLogsText = cleanLines.map(line => {
                        let l = line
                        try { l = decodeURIComponent(l) } catch { /* ignore */ }
                        return l
                      }).join('\n')
                    }
                    navigator.clipboard.writeText(cleanLogsText)
                  }}
                  className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-[#ff6b00] cursor-pointer transition-colors"
                  title={t('copy')}
                >
                  <Copy className="h-3 w-3" />
                  <span>{t('copy')}</span>
                </span>
                <span className="text-[9px] text-zinc-500 font-mono">{t('console_trace')}</span>
              </div>
            </button>
            {!telemetryCollapsed && (
              <>
                <pre
                  ref={telemetryScrollRef}
                  style={{ height: telemetryHeight }}
                  className="px-4 pb-2 pt-1 font-mono text-[10.5px] leading-relaxed text-zinc-400 overflow-x-auto whitespace-pre-wrap select-text overflow-y-auto bg-[#090a0c] scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent"
                >
                  {(() => {
                    if (logs.length === 0) {
                      return (
                        <span className="text-zinc-600 italic select-none">
                          {t('no_telemetry_output') || 'Waiting for CLI output...'}
                        </span>
                      )
                    }
                    if (isMainFeed) {
                      return logs.map(line => {
                        let l = line
                        try { l = decodeURIComponent(l) } catch { /* ignore */ }
                        // eslint-disable-next-line no-control-regex
                        return l.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '')
                      }).join('')
                    } else {
                      const cleanLines = [...logs]
                      while (cleanLines.length > 0 && cleanLines[cleanLines.length - 1].trim() === "") {
                        cleanLines.pop()
                      }
                      return cleanLines.map(line => {
                        let l = line
                        try { l = decodeURIComponent(l) } catch { /* ignore */ }
                        return l
                      }).join('\n')
                    }
                  })()}
                </pre>
                <div
                  onMouseDown={startResizingTelemetry}
                  className="h-[4px] cursor-row-resize hover:bg-[#ff6b00]/30 bg-[#1e2024]/60 transition-colors"
                />
              </>
            )}
          </div>
        )}

        {/* Inner Chat viewport */}
        <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-6 space-y-6">
          {isMainFeed && task && task.status === 'idle' && (
            <div className="flex flex-col items-center justify-center border border-dashed border-[#2b2e33] rounded-xl p-8 bg-[#15171a]/30 space-y-4 text-center max-w-md mx-auto mt-12">
              <PlayCircle className="h-12 w-12 text-[#ff6b00] animate-pulse" />
              <div className="space-y-1">
                <h4 className="font-bold text-white">{t('loop_ready_to_execute')}</h4>
                <p className="text-xs text-zinc-500">{t('loop_ready_desc')}</p>
              </div>
              <button
                onClick={() => startTask(task.id)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-[#ff6b00] to-[#ff8c3a] hover:from-[#ff7c1a] hover:to-[#ffa154] shadow-lg transition-all cursor-pointer"
              >
                <Play className="h-3.5 w-3.5 fill-white" />
                <span>{t('start_execution_loop')}</span>
              </button>
            </div>
          )}

          {!isMainFeed && currentFeed.length === 0 && (
            <div className="flex flex-col items-center justify-center border border-dashed border-[#2b2e33] rounded-xl p-8 bg-[#15171a]/30 space-y-3 text-center max-w-md mx-auto mt-12">
              <MessageSquare className="h-10 w-10 text-purple-400" />
              <div className="space-y-1">
                <h4 className="font-bold text-white">{uiText("Independent Chat Session")}</h4>
                <p className="text-xs text-zinc-500">
                  {uiText("Chat directly with {model}. This session is separate from task execution.", { model: selectedModel })}</p>
              </div>
            </div>
          )}

          {promptError && <div role="alert" className="text-xs text-rose-400">{promptError}</div>}
          <ConversationFeed
            feedItems={currentFeed}
            answeredPromptIds={answeredPromptIds}
            onPromptAction={(actionId, promptId) => {
              void sendPromptResponse(promptId, actionId).catch(() => {})
            }}
            onResolveApproval={(approvalId, decision) => sendPromptResponse(approvalId, decision === 'allow' ? 'y' : 'n', decision)}
            onStopTool={async (_callId, command) => {
              const sessionId = getSessionIdForTab(activeTabId)
              if (command) {
                const pid = findPidForCommand(command)
                if (pid) {
                  await window.ziafAPI.killProcessByPid({ pid, sessionId }).catch(() => {})
                  return
                }
                await window.ziafAPI.killProcessByCommand({ command, sessionId }).catch(() => {})
              } else {
                await window.ziafAPI.writePty({ sessionId, data: '\x03' }).catch(() => {})
              }
            }}
          />
        </div>
      </div>
    )
  }

  const renderComposer = () => {
    if (usesStructuredAgent) return null
    const activeProcesses: ActiveProcessItem[] = [
      ...(task && task.status === 'running' ? [{ id: task.id, name: task.name }] : []),
      ...runningProcesses.map((proc: { title?: string; content?: string }, idx: number) => ({
        id: `proc-${idx}`,
        name: proc.title || proc.content || 'Process',
        command: proc.content,
        pid: findPidForCommand(proc.content || '') || undefined,
      }))
    ]

    const handleStopExecution = async () => {
      const sessionId = getSessionIdForTab(activeTabId)
      // Cancel only this session's deliveries. Keep its generation, liveness,
      // terminal screen and process so the next prompt uses the same CLI.
      const startup = globalInFlightStartupSends.get(sessionId)
      recordCancelledAttempt(startup?.attemptId)
      recordCancelledAttempt(globalSessionActiveWriteAttempts.get(sessionId))
      markSessionStopped(sessionId)
      const keys = new Set([
        sessionId,
        ...Object.keys(globalPendingFirstInput),
        ...Object.keys(globalPendingMessagesQueue),
      ])
      for (const key of keys) {
        if (key !== sessionId && !key.startsWith(`${sessionId}:`)) continue
        for (const item of globalPendingMessagesQueue[key] || []) recordCancelledAttempt(getQueueItemAttemptId(item))
        recordCancelledAttempt(globalPendingFirstAttemptId[key])
        delete globalPendingMessagesQueue[key]
        delete globalPendingFirstInput[key]
        delete globalPendingFirstAttemptId[key]
        globalFirstInputVersions[key] = (globalFirstInputVersions[key] || 0) + 1
      }
      syncSessionQueuedInput(sessionId)
      setPromptError(null)
      const result = await window.ziafAPI.writePty({ sessionId, data: '\x03' })
        .catch((err: Error) => ({ success: false, error: err?.message || String(err) }))
      if (!result.success) {
        setPromptError(result.error || 'Failed to interrupt agent')
        logDebug(`handleStopExecution: interrupt failed for sessionId=${sessionId}: ${result.error}`)
      }
    }

    const handleTerminateSession = async () => {
      const sessionId = getSessionIdForTab(activeTabId)
      const inFlight = globalInFlightStartupSends.get(sessionId) ||
        (task?.id ? globalInFlightStartupSends.get(`${sessionId}:${task.id}`) : undefined) ||
        globalInFlightStartupSends.get(activeTabId) ||
        (task?.id ? globalInFlightStartupSends.get(task.id) : undefined)
      if (inFlight?.attemptId) {
        recordCancelledAttempt(inFlight.attemptId)
      }
      const activeWriteAttempt = globalSessionActiveWriteAttempts.get(sessionId) ||
        (task?.id ? globalSessionActiveWriteAttempts.get(task.id) : undefined) ||
        globalSessionActiveWriteAttempts.get(activeTabId)
      if (activeWriteAttempt) {
        recordCancelledAttempt(activeWriteAttempt)
      }
      markSessionStopped(sessionId)
      if (activeTabId && activeTabId !== sessionId) {
        markSessionStopped(activeTabId)
      }
      if (task?.id) {
        markSessionStopped(task.id)
      }
      clearSessionLifecycleState(sessionId, task?.id)
      const res = await window.ziafAPI.killPty({ sessionId }).catch((err: Error) => ({ success: false, error: err?.message || String(err) }))
      if (!res.success) {
        logDebug(`handleStopExecution: killPty failed for sessionId=${sessionId}: ${res.error}`)
      }
      if (task && task.status === 'running') {
        updateTaskStatus(task.id, 'idle')
      }
    }

    return (
      <div className="space-y-2">
      {legacyReasoningUnsupported && <p role="alert" className="text-xs text-amber-300">{t('composer_legacy_reasoning_unavailable')}</p>}
      <Composer
        value={chatMessage}
        onChange={setChatMessage}
        onSend={(msg, attached) => handleSendChatMessage(msg, attached)}
        onStop={handleStopExecution}
        isRunning={isAgentRunning}
        placeholder={t('chat_placeholder') || 'Ask anything or run command...'}
        selectedModel={selectedModel}
        onSelectModel={setSelectedModel}
        modelOptions={modelOptions}
        customAgent={chatCustomAgent}
        agentOptions={settings?.useMockData === true ? undefined : ['Google Antigravity', 'Claude Code']}
        onCustomAgentChange={setChatCustomAgent}
        customModels={chatCustomModels}
        customPermissions={chatCustomPermissions}
        onCustomPermissionsChange={setChatCustomPermissions}
        isLoadingModels={isLoadingChatModels}
        attachments={attachments}
        onAttachmentsChange={setAttachments}
        activeProcesses={activeProcesses}
        onKillProcess={async (_processId, pid) => {
          const sessionId = getSessionIdForTab(activeTabId)
          if (pid) {
            await window.ziafAPI.killProcessByPid({ pid, sessionId }).catch(() => {})
          } else if (task && task.status === 'running') {
            await handleTerminateSession()
          }
        }}
        onKeyDown={handleChatKeyDown}
        className="w-full"
      />
      </div>
    )
  }

  const renderFileViewer = () => {
    if (activeTab.type !== 'file' || !activeTab.filePath || !activeRepo) return null
    const base = activeTab.baseDir || resolveTaskCwd(task, activeRepo) || activeRepo.repoPath
    const taskRoot = resolveTaskCwd(task, activeRepo)
    const scope = task && base === taskRoot ? 'task' as const : 'project' as const
    // Tabs created by the file tree use relative paths. Old absolute tabs must remain in the granted root.
    const relativePath = activeTab.filePath.startsWith('/')
      ? base && activeTab.filePath.startsWith(`${base}/`) ? activeTab.filePath.slice(base.length + 1) : ''
      : activeTab.filePath
    if (!relativePath) return <p role="alert" className="p-4 text-red-300">{uiText("This file is outside this task folder. Open it from the correct project tree.")}</p>
    const request: EditorOpenRequest = { repoId: activeRepo.id, taskId: scope === 'task' ? task?.id : undefined, scope, relativePath }
    return <FileEditor key={JSON.stringify(request)} request={request}
      mockText={settings?.useMockData === false ? undefined : mockFileContents[activeTab.filePath] || ''}
      onMockSave={text => editFileContent(activeTab.filePath!, text)} />
  }

  const renderRightPanelContent = () => {
    if (!rightPanelTab) return null

    return (
      <div className="flex-1 flex flex-col overflow-hidden h-full">
        {/* 1. TO-DO TAB MODULE */}
            {rightPanelTab === 'todo' && (
              usesStructuredAgent && task?.workFlowVersion === 1 ? <WorkFlowPanel key={task.id} task={task} snapshot={workState.snapshot} loadError={workState.error} onSnapshot={workState.accept}
                onClose={() => setRightPanelTab(null)} onOpenChat={(id, title) => openHistoryTab({ id, name: title, type: 'chat' })} /> : usesStructuredAgent && task ? <ExecutablePlanPanel
                key={task.id}
                task={task}
                onClose={() => setRightPanelTab(null)}
                onOpenChat={(id, title) => {
                  openHistoryTab({ id, name: title, type: 'chat' })
                }}
              /> :
              <PlanPanel
                taskId={task?.id}
                todoSteps={task ? task.todoSteps : []}
                onToggleStep={(stepId) => {
                  if (task) toggleTodoStep(task.id, stepId)
                }}
                onAddStep={(text) => {
                  if (!text.trim() || !task) return
                  addTodoStep(task.id, text.trim())
                }}
        onUpdateStep={handleUpdateStep}
        onDeleteStep={handleDeleteStep}
        onClose={() => setRightPanelTab(null)}
        autoStartEnabled={autoStartEnabled}
        onToggleAutoStart={setAutoStartEnabled}
        onOpenStructuredPlan={handleOpenStructuredPlan}
        newStepText={todoDraft}
        onNewStepTextChange={setTodoDraft}
        className="w-full h-full"
      />
            )}

            {/* 2. FILES TAB MODULE (With new file creation) */}
            {rightPanelTab === 'files' && (
              <div className="flex-1 flex flex-col overflow-hidden font-sans">
                <div className="p-4 border-b border-[#1e2024]/60 bg-[#0c0d0e]/40 flex justify-between items-center select-none">
                  <div className="space-y-2"><h3 className="text-xs font-bold text-white uppercase tracking-wider">{t('file_explorer')}</h3>
                    {activeRepo && settings?.useMockData === false && <FolderActions scope={{ repoId: activeRepo.id, taskId: task?.id, scope: task ? 'task' : 'project' }} />}
                  </div>
                  
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        setShowNewFileInput(!showNewFileInput)
                        setShowNewFolderInput(false)
                      }}
                      className={`p-1 rounded hover:bg-[#1e2024] text-zinc-400 hover:text-white transition-all ${showNewFileInput ? 'bg-[#1e2024] text-white' : ''}`}
                      title={t('create_new_file')}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        setShowNewFolderInput(!showNewFolderInput)
                        setShowNewFileInput(false)
                      }}
                      className={`p-1 rounded hover:bg-[#1e2024] text-zinc-400 hover:text-white transition-all ${showNewFolderInput ? 'bg-[#1e2024] text-white' : ''}`}
                      title={t('create_new_folder')}
                    >
                      <Folder className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Inline file creator input */}
                {showNewFileInput && (
                  <div className="p-3 border-b border-[#1e2024] bg-[#121316]">
                    <form onSubmit={handleCreateNewFileSubmit} className="flex gap-2">
                      <input 
                        type="text"
                        required
                        placeholder={uiText("For example: {path}", { path: "src/utils.php" })}
                        value={newFilePath}
                        onChange={(e) => setNewFilePath(e.target.value)}
                        className="flex-1 bg-[#0a0b0d] border border-[#2b2e33] rounded px-2.5 py-1 text-xs text-white font-mono placeholder-zinc-700 focus:outline-none"
                      />
                      <button 
                        type="submit" 
                        className="px-2.5 py-1 rounded bg-[#ff6b00] hover:bg-[#ff7c1a] text-[10px] font-bold text-white"
                      >
                        {t('create')}
                      </button>
                    </form>
                  </div>
                )}

                {/* Inline folder creator input */}
                {showNewFolderInput && (
                  <div className="p-3 border-b border-[#1e2024] bg-[#121316]">
                    <form onSubmit={handleCreateNewFolderSubmit} className="flex gap-2">
                      <input 
                        type="text"
                        required
                        placeholder={uiText("For example: {path}", { path: "src/components" })}
                        value={newFolderPath}
                        onChange={(e) => setNewFolderPath(e.target.value)}
                        className="flex-1 bg-[#0a0b0d] border border-[#2b2e33] rounded px-2.5 py-1 text-xs text-white font-mono placeholder-zinc-700 focus:outline-none"
                      />
                      <button 
                        type="submit" 
                        className="px-2.5 py-1 rounded bg-[#ff6b00] hover:bg-[#ff7c1a] text-[10px] font-bold text-white"
                      >
                        {t('create')}
                      </button>
                    </form>
                  </div>
                )}

                <div className="flex-1 overflow-y-auto p-4 space-y-1.5 text-xs select-none">
                  <div className="space-y-1">
                    
                    {settings?.useMockData === false ? (
                      realFiles.length > 0 ? (
                        realFiles.map(file => renderRealFileNode(file))
                      ) : (
                        <div className="text-zinc-500 text-[10px] py-4 text-center">
                          {uiText("No files found in the project.")}</div>
                      )
                    ) : (
                      <>
                        {/* data folder */}
                        <div>
                          <button 
                            onClick={() => toggleFolder('data')}
                            className="flex items-center gap-1.5 py-1 text-zinc-400 hover:text-white w-full text-left font-sans"
                          >
                            {folderOpenStates['data'] ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                            <Folder className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                            <span className="font-semibold">data</span>
                          </button>
                          
                          {folderOpenStates['data'] && (
                            <div className="pl-4 space-y-1.5 border-l border-zinc-800 ml-1.5 mt-1">
                              
                              {/* crm folder */}
                              <div>
                                <button 
                                  onClick={() => toggleFolder('data/crm')}
                                  className="flex items-center gap-1.5 py-0.5 text-zinc-400 hover:text-white w-full text-left"
                                >
                                  {folderOpenStates['data/crm'] ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                  <Folder className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                                  <span>crm</span>
                                </button>
                                
                                {folderOpenStates['data/crm'] && (
                                  <div className="pl-4 space-y-1.5 border-l border-zinc-800 ml-1.5 mt-1">
                                    <div 
                                      onClick={() => handleOpenFileTab('1-progress-3214263.md', 'data/crm/companies/1-progress-3214263.md')}
                                      className="flex items-center gap-1.5 py-0.5 text-zinc-500 hover:text-white cursor-pointer"
                                    >
                                      <FileText className="h-3.5 w-3.5 text-zinc-500" />
                                      <span className="font-mono text-[11px]">1-progress-3214263.md</span>
                                    </div>
                                  </div>
                                )}
                              </div>

                            </div>
                          )}
                        </div>

                        {/* src folder */}
                        <div>
                          <button 
                            onClick={() => toggleFolder('src')}
                            className="flex items-center gap-1.5 py-1 text-zinc-400 hover:text-white w-full text-left font-sans"
                          >
                            {folderOpenStates['src'] ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                            <Folder className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                            <span className="font-semibold">src</span>
                          </button>
                          
                          {folderOpenStates['src'] && (
                            <div className="pl-4 space-y-1.5 border-l border-zinc-800 ml-1.5 mt-1 font-sans">
                              
                              {/* spam folder */}
                              <div>
                                <button 
                                  onClick={() => toggleFolder('src/spam')}
                                  className="flex items-center gap-1.5 py-0.5 text-zinc-400 hover:text-white w-full text-left"
                                >
                                  {folderOpenStates['src/spam'] ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                  <Folder className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                                  <span>spam</span>
                                </button>
                                
                                {folderOpenStates['src/spam'] && (
                                  <div className="pl-4 space-y-1.5 border-l border-zinc-800 ml-1.5 mt-1 font-sans">
                                    <div 
                                      onClick={() => handleOpenFileTab('blacklist.php', 'src/spam/blacklist.php')}
                                      className="flex items-center gap-1.5 py-0.5 text-zinc-500 hover:text-white cursor-pointer"
                                    >
                                      <FileText className="h-3.5 w-3.5 text-amber-500" />
                                      <span className="font-mono text-[11px]">blacklist.php</span>
                                    </div>
                                    <div 
                                      onClick={() => handleOpenFileTab('validation.php', 'src/spam/validation.php')}
                                      className="flex items-center gap-1.5 py-0.5 text-zinc-500 hover:text-white cursor-pointer"
                                    >
                                      <FileText className="h-3.5 w-3.5 text-amber-500" />
                                      <span className="font-mono text-[11px]">validation.php</span>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Render dynamically created files in src */}
                              {Object.keys(mockFileContents).filter(p => p.startsWith('src/') && !p.startsWith('src/spam')).map(path => {
                                const filename = path.split('/').pop() || path
                                return (
                                  <div 
                                    key={path}
                                    onClick={() => handleOpenFileTab(filename, path)}
                                    className="flex items-center gap-1.5 py-0.5 text-zinc-400 hover:text-white cursor-pointer"
                                  >
                                    <FileText className="h-3.5 w-3.5 text-zinc-500" />
                                    <span className="font-mono text-[11px]">{filename}</span>
                                  </div>
                                )
                              })}

                            </div>
                          )}
                        </div>

                        {/* package.json file */}
                        <div 
                          onClick={() => handleOpenFileTab('package.json', 'package.json')}
                          className="flex items-center gap-1.5 py-1 text-zinc-500 hover:text-white cursor-pointer ml-4"
                        >
                          <FileText className="h-3.5 w-3.5 text-zinc-500" />
                          <span className="font-mono text-[11px]">package.json</span>
                        </div>
                      </>
                    )}

                  </div>
                </div>
              </div>
            )}

            {/* 3. GIT CHANGES TAB MODULE (With functional Commit & Push) */}
            {rightPanelTab === 'git' && settings?.useMockData !== true && <GitPanel key={task.id} task={task} onClose={() => setRightPanelTab(null)} />}
            {rightPanelTab === 'git' && settings?.useMockData === true && (
              <div className="flex-1 flex flex-col overflow-hidden font-sans">
                {/* Git panel header with branch info */}
                <div className="border-b border-[#1e2024]/60 bg-[#0c0d0e]/40 select-none">
                  <div className="px-4 pt-3 pb-1 flex justify-between items-center">
                    <h3 className="text-xs font-bold text-white">{t('git_changes')}</h3>
                    <button 
                      onClick={() => setRightPanelTab(null)}
                      className="p-0.5 rounded text-zinc-600 hover:text-white"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  
                  {/* Branch info row */}
                  <div className="px-4 pb-2 space-y-1">
                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                      <GitBranch className="h-3 w-3 text-emerald-500" />
                      <span>{t('branch')} <span className="text-zinc-300 font-mono">ziaf-task-audit</span> {t('from_repo')} <span className="text-zinc-400">main</span></span>
                      <span className="text-[9px] text-zinc-600">({t('worktree')} ↗)</span>
                    </div>
                    
                    <div className="flex items-center justify-between text-[9px]">
                      <span className="text-zinc-600 font-mono">{t('changes_from')} aa03497..cc2e75c</span>
                      <div className="flex gap-1.5 font-mono font-bold">
                        <span className="text-emerald-500">+{task.gitChanges.reduce((sum, c) => sum + c.additions, 0)}</span>
                        <span className="text-rose-500">-{task.gitChanges.reduce((sum, c) => sum + c.deletions, 0)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {gitStatusAlert && (
                    <div className="bg-emerald-500/10 border border-emerald-500/25 p-3 rounded-lg text-emerald-400 text-[10.5px] font-bold leading-normal font-mono animate-fade-in select-none">
                      <Check className="h-3.5 w-3.5 inline mr-1" />
                      <span>{t('git_success_alert')}</span>
                    </div>
                  )}

                  {task.gitChanges.length === 0 ? (
                    <div className="py-8 text-center text-xs text-zinc-600 italic select-none">
                      {t('git_clean_state')}
                    </div>
                  ) : (
                    task.gitChanges.map(change => {
                      const isExpanded = gitExpandedDiffs[change.id] === true
                      return (
                        <div key={change.id} className="border border-[#1e2024] rounded-lg overflow-hidden bg-[#121316]">
                          <div
                            className="w-full flex items-center justify-between bg-[#15171a] px-3 py-2 text-xs border-b border-[#1e2024]/40 hover:text-white select-none text-left"
                          >
                            <button
                              onClick={() => setGitExpandedDiffs(prev => ({ ...prev, [change.id]: !isExpanded }))}
                              className="flex items-center gap-1.5 min-w-0"
                            >
                              {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-zinc-500" /> : <ChevronRight className="h-3.5 w-3.5 text-zinc-500" />}
                              <FileText className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                              <span className="font-mono text-[11px] truncate">{change.filename}</span>
                            </button>
                            
                            <div className="flex items-center gap-2 shrink-0">
                              <button 
                                onClick={() => handleOpenFileTab(change.filename, change.path, resolveTaskCwd(task, activeRepo) || activeRepo?.repoPath)}
                                className="text-[9px] bg-[#1e2024] hover:bg-[#2b2e33] px-1.5 py-0.5 rounded text-zinc-400 font-semibold"
                                title={t('open_file_editor')}
                              >
                                {t('view')}
                              </button>
                              
                              <div className="flex gap-1.5 text-[9px] font-mono font-bold">
                                <span className="text-emerald-500">+{change.additions}</span>
                                <span className="text-rose-500">-{change.deletions}</span>
                              </div>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="p-3 bg-[#0f1012] font-mono text-[10px] leading-relaxed overflow-x-auto whitespace-pre select-text border-t border-[#1e2024]/40">
                              {change.diff.split('\n').map((line, lidx) => {
                                const isAddition = line.startsWith('+')
                                const isDeletion = line.startsWith('-')
                                const isHeader = line.startsWith('@@')
                                
                                return (
                                  <div 
                                    key={lidx} 
                                    className={`px-1 py-0.5 rounded-sm ${
                                      isAddition 
                                        ? 'bg-emerald-500/10 text-emerald-400' 
                                        : isDeletion 
                                          ? 'bg-rose-500/10 text-rose-400' 
                                          : isHeader 
                                            ? 'text-indigo-400 bg-indigo-500/5' 
                                            : 'text-zinc-500'
                                    }`}
                                  >
                                    {line}
                                  </div>
                                )
                              })}
                            </div>
                          )}

                        </div>
                      )
                    })
                  )}
                </div>

                {/* Commit Form at bottom */}
                {task.gitChanges.length > 0 && (
                  <div className="p-3 border-t border-[#1e2024] bg-[#0c0d0e] select-none">
                    <form onSubmit={handleGitCommitSubmit} className="space-y-2">
                      <input 
                        type="text"
                        required
                        placeholder={t('commit_message_placeholder')}
                        value={commitMessage}
                        onChange={(e) => setCommitMessage(e.target.value)}
                        className="w-full bg-[#15171a] border border-[#2b2e33] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[#ff6b00]"
                      />
                      <button 
                        type="submit" 
                        className="w-full py-1.5 rounded-lg bg-[#ff6b00] hover:bg-[#ff7c1a] text-xs font-bold text-white shadow-sm transition-all"
                      >
                        {t('commit_and_push')}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )}

            {/* 4. TERMINAL TAB MODULE */}
            {rightPanelTab === 'terminal' && (() => {
              const isMain = activeTabId === 'feed' || activeTabId === 'chat-main'
              const terminalSessionId = isMain
                ? (task ? `term-task-${task.id}-${activeTermTabIdx}` : `term-${activeRepo?.id || 'default'}-${activeTermTabIdx}`)
                : getSessionIdForTab(activeTabId)
              const terminalLogs = globalSessionTerminalLogs[terminalSessionId] || sessionPtyLogsRef.current[terminalSessionId] || []
              const isCustomChat = isCustomChatTab(terminalSessionId, centralTabs)
              const isTaskTerminal = terminalSessionId.startsWith('term-task-') || (Boolean(task) && isCustomChat)
              const resolvedCwd = resolveTaskCwd(task, activeRepo)
              const isTaskEligible = Boolean(task && task.status === 'running' && resolvedCwd)
              const terminalCwd = isTaskTerminal
                ? (isTaskEligible ? resolvedCwd : '')
                : (activeRepo?.repoPath || activeRepo?.path || '')
              return (
                <TerminalPane
                  sessionId={terminalSessionId}
                  tabs={terminalTabs}
                  activeTabIdx={activeTermTabIdx}
                  onTabChange={setActiveTermTabIdx}
                  onNewTab={() => setTerminalTabs(prev => [...prev, `zsh ${prev.length + 1}`])}
                  logs={terminalLogs}
                  isRealMode={settings?.useMockData === false}
                  cwd={terminalCwd}
                  className="w-full h-full"
                />
              )
            })()}

            {/* 5. AUTOMATIONS TAB MODULE */}
            {rightPanelTab === 'automations' && settings?.useMockData !== true && <WorkflowRuns taskId={task.id} />}
            {rightPanelTab === 'automations' && settings?.useMockData === true && (
              <div className="flex-1 flex flex-col overflow-hidden font-sans">
                <div className="p-4 border-b border-[#1e2024]/60 bg-[#0c0d0e]/40 select-none">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">{t('task_automations')}</h3>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  <div className="bg-[#15171a] border border-[#1e2024] rounded-xl p-4 space-y-3 shadow-md animate-fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white block">{t('auto_refresh_tokens_loop')}</span>
                      <span className="text-[9px] bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider font-mono">{t('active')}</span>
                    </div>
                    <p className="text-[10px] text-zinc-500 leading-normal">
                      {t('auto_refresh_desc')}
                    </p>
                    <div className="flex items-center justify-between text-[9px] text-zinc-500 pt-2 border-t border-[#1e2024]/40 font-mono">
                      <span>{t('runs_count')}: 3</span>
                      <span>{t('next_run_remaining')}</span>
                    </div>
                  </div>

                  <button 
                    onClick={() => {
                      setRightPanelTab('automations')
                      // Navigate by the saved route, independently of the translated button title.
                      useStore.getState().setActiveTab('automations')
                    }}
                    className="w-full flex items-center justify-center gap-1.5 border border-dashed border-zinc-800 hover:border-zinc-700 bg-transparent text-[11px] font-bold text-zinc-400 hover:text-white py-2.5 rounded-lg transition-all select-none"
                  >
                    <Plus className="h-4 w-4" />
                    <span>{t('create_automation_chat')}</span>
                  </button>
                </div>
              </div>
            )}

            {rightPanelTab === 'browser' && settings?.useMockData !== true && <BrowserPreview key={task.id} />}
            {/* Simulated pages are available only in the explicit demo mode. */}
            {rightPanelTab === 'browser' && settings?.useMockData === true && (
              <div className="flex-1 flex flex-col overflow-hidden bg-white text-black font-sans">
                
                {/* Browser navigation and search address bar */}
                <div className="h-10 bg-zinc-100 border-b border-zinc-300 flex items-center px-2 gap-2 select-none shrink-0 text-zinc-600">
                  <div className="flex gap-1.5">
                    <button onClick={() => { setBrowserUrlInput('https://www.google.com/'); setBrowserActiveUrl('https://www.google.com/'); setBrowserResultsHtml('google'); }} className="p-1 rounded hover:bg-zinc-200"><ArrowLeft className="h-3.5 w-3.5" /></button>
                    <button className="p-1 rounded hover:bg-zinc-200"><ArrowRight className="h-3.5 w-3.5" /></button>
                    <button onClick={handleBrowserGo} className="p-1 rounded hover:bg-zinc-200"><RotateCw className="h-3.5 w-3.5" /></button>
                  </div>
                  
                  <form onSubmit={handleBrowserGo} className="flex-1 relative flex items-center">
                    <Search className="absolute left-2.5 h-3 w-3 text-zinc-400" />
                    <input
                      type="text"
                      value={browserUrlInput}
                      onChange={(e) => setBrowserUrlInput(e.target.value)}
                      className="w-full bg-white border border-zinc-300 rounded-md py-1 pl-7 pr-3 text-[10.5px] font-mono text-zinc-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </form>
                </div>

                {/* Simulating site render */}
                <div className="flex-1 overflow-y-auto p-5 select-text text-left font-sans text-xs bg-zinc-50">
                  
                  {/* Google Main */}
                  {browserResultsHtml === 'google' && (
                    <div className="space-y-6 text-center pt-8">
                      <div className="text-3xl font-extrabold text-[#ff6b00] tracking-tight">Google</div>
                      <form onSubmit={handleGoogleSearch} className="max-w-xs mx-auto relative flex items-center">
                        <input 
                          type="text" 
                          placeholder={t('search_google')} 
                          value={browserSearchQuery}
                          onChange={(e) => setBrowserSearchQuery(e.target.value)}
                          className="w-full bg-white border border-zinc-300 rounded-full py-1.5 px-4 pr-10 text-xs text-black focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm"
                        />
                        <button type="submit" className="absolute right-3 text-zinc-400 hover:text-[#ff6b00]"><Search className="h-4 w-4" /></button>
                      </form>
                      <div className="text-[10px] text-zinc-400">{t('google_search_simulator')}</div>
                    </div>
                  )}

                  {/* Google Results */}
                  {browserResultsHtml === 'google-results' && (
                    <div className="space-y-4">
                      <div className="text-xs text-zinc-500 border border-zinc-200 p-2 rounded-lg bg-white">
                        {t('search_query')}: <span className="font-bold text-zinc-800">"{browserSearchQuery}"</span>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="space-y-0.5">
                          <span onClick={() => { setBrowserUrlInput('https://github.com/ziaforge'); setBrowserActiveUrl('https://github.com/ziaforge'); setBrowserResultsHtml('github'); }} className="text-[#1a0dab] font-semibold text-xs hover:underline cursor-pointer block">GitHub - ziaforge/ziaforge: FORGE, DON'T VIBE. — Open-source IDE platform</span>
                          <span className="text-green-700 text-[10px] block">https://github.com/ziaforge/ziaforge</span>
                          <p className="text-zinc-600 text-[11px]">ZIAForge is a modern developer-first AI coding workspace for macOS, Linux and Windows supporting interactive checklists...</p>
                        </div>
                        <div className="space-y-0.5">
                          <span onClick={() => { setBrowserUrlInput('https://leadtracker.net/'); setBrowserActiveUrl('https://leadtracker.net/'); setBrowserResultsHtml('hh'); }} className="text-[#1a0dab] font-semibold text-xs hover:underline cursor-pointer block">LeadTracker Global - Active Campaigns & Candidates</span>
                          <span className="text-green-700 text-[10px] block">https://leadtracker.net/employer/campaigns</span>
                          <p className="text-zinc-600 text-[11px]">Employer dashboard search filters for candidate resume lists and active CRM synchronization details...</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* GitHub Mock */}
                  {browserResultsHtml === 'github' && (
                    <div className="space-y-4">
                      <div className="flex gap-2 items-center text-sm font-semibold border-b border-zinc-200 pb-2 text-zinc-800">
                        <GithubIcon className="h-4 w-4 text-zinc-800" />
                        <span>ziaforge / ziaforge</span>
                        <span className="bg-zinc-100 border text-[9px] text-zinc-500 rounded px-1.5 py-0.2">Public</span>
                      </div>
                      
                      <div className="bg-white border rounded-lg overflow-hidden shadow-sm text-[11px]">
                        <div className="bg-zinc-50 p-2.5 border-b border-zinc-200 flex justify-between text-zinc-500">
                          <span>Latest commit: <span className="font-mono text-[10px] text-zinc-800">e634697</span></span>
                          <span>2 hours ago</span>
                        </div>
                        <div className="divide-y divide-zinc-100 font-mono text-zinc-700">
                          <div className="p-2 flex items-center justify-between"><div className="flex items-center gap-1.5"><Folder className="h-3.5 w-3.5 text-blue-400" /><span>electron/</span></div><span className="text-zinc-400 text-[10px]">fix main window resize bounds</span></div>
                          <div className="p-2 flex items-center justify-between"><div className="flex items-center gap-1.5"><Folder className="h-3.5 w-3.5 text-blue-400" /><span>src/</span></div><span className="text-zinc-400 text-[10px]">add interactive terminal tab support</span></div>
                          <div className="p-2 flex items-center justify-between"><div className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-zinc-400" /><span>package.json</span></div><span className="text-zinc-400 text-[10px]">bump version to 2.3.2</span></div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* HeadHanter Mock */}
                  {browserResultsHtml === 'hh' && (
                    <div className="space-y-4">
                      <div className="text-lg font-bold text-red-600 border-b border-zinc-200 pb-2">LeadTracker Global</div>
                      <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-red-800 text-[11px]">
                        <span className="font-bold block text-red-900 mb-0.5">Employer Admin Dashboard</span>
                        Active CRM Sync token verified: campaigns data sync matches database.
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div className="border border-zinc-200 bg-white p-3 rounded-lg shadow-sm">
                          <span className="font-semibold block text-zinc-800">Active Job Postings</span>
                          <span className="text-lg font-bold text-zinc-900 block mt-1">4 campaigns</span>
                          <span className="text-[9px] text-zinc-400 block">TikTok Content Mgr, Copywriter</span>
                        </div>
                        <div className="border border-zinc-200 bg-white p-3 rounded-lg shadow-sm">
                          <span className="font-semibold block text-zinc-800">Discovered Candidates</span>
                          <span className="text-lg font-bold text-zinc-900 block mt-1">127 profiles</span>
                          <span className="text-[9px] text-zinc-400 block">Cached locally inside data/crm</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ADGWAY Online */}
                  {browserResultsHtml === 'adgway' && (
                    <div className="space-y-4">
                      <div className="text-md font-bold text-zinc-800 border-b border-zinc-300 pb-2">ADGWAY Online — Email Verification</div>
                      <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg text-emerald-800 flex gap-2">
                        <Check className="h-4 w-4 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold block">Status: Active</span>
                          Server cache lookup is fully synchronized with local ZIAForge client.
                        </div>
                      </div>
                      <table className="w-full text-[10px] border-collapse">
                        <thead>
                          <tr className="bg-zinc-100 text-zinc-500 border-b border-zinc-200">
                            <th className="p-1 text-left">Lookup IP</th>
                            <th className="p-1 text-left">Provider</th>
                            <th className="p-1 text-left">Result</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-zinc-100">
                            <td className="p-1 font-mono">194.22.18.99</td>
                            <td className="p-1">SpamCop</td>
                            <td className="p-1 text-red-600">Blocked</td>
                          </tr>
                          <tr className="border-b border-zinc-100">
                            <td className="p-1 font-mono">82.164.2.14</td>
                            <td className="p-1">SpamCop</td>
                            <td className="p-1 text-green-700">Clear (Cached)</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}

                  {browserResultsHtml === 'fallback' && (
                    <div className="space-y-3 py-8 text-center text-zinc-500">
                      <Globe className="h-8 w-8 text-zinc-400 mx-auto animate-pulse" />
                      <div className="space-y-1">
                        <span className="font-bold block text-zinc-700 text-xs">{t('browser_preview_label', { url: browserActiveUrl })}</span>
                        <p className="text-[11px] text-zinc-500 max-w-xs mx-auto">{t('browser_demo_hint')}</p>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            )}
      </div>
    )
  }

  return (
    <WorkspaceShell
      title={
        <div className="flex items-center gap-2 text-xs font-semibold">
          <span className="text-zinc-400">{repo?.name || 'Repository'}</span>
          <span className="text-zinc-700">/</span>
          <span className="text-white flex items-center gap-1.5 font-bold">
            {isDone ? (
              <Check className="h-3.5 w-3.5 text-emerald-500" />
            ) : task.status === 'running' ? (
              <span title={t('active_task')} className="flex h-3.5 w-3.5 items-center justify-center">
                <span className="h-2 w-2 rounded-full bg-[#ff6b00]" />
              </span>
            ) : null}
            {task.name}
          </span>
          {task.mode !== 'work' && task.branchType !== 'Folder' && <button onClick={() => setRightPanelTab('git')} className="ml-2 flex items-center gap-1.5 rounded-lg border border-[#2b2e33] bg-[#1e2024] px-2.5 py-1 text-[10px] text-white">
            <GitMerge className="h-3 w-3 text-emerald-400" /><span>Git · {task.branchName || task.id}</span>
          </button>}
          <ChevronDown className="h-3 w-3 text-zinc-500 cursor-pointer hover:text-zinc-300" />
        </div>
      }
      toolbarActions={
        <>
          {settings?.useMockData === true && <button className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-300 transition-all cursor-pointer" title={uiText("Bookmark")}>
            <Bookmark className="h-3.5 w-3.5" />
          </button>}
          <button onClick={() => useStore.getState().setActiveTab('settings')} className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-300 transition-all cursor-pointer" title={t('settings')}>
            <Settings className="h-3.5 w-3.5" />
          </button>
        </>
      }
      rightPanelTab={rightPanelTab}
      onSelectRightPanelTab={setRightPanelTab}
      todoProgress={task.workFlowVersion === 1 ? { completed: workState.snapshot?.plan?.filter(step => step.status === 'completed').length ?? 0, total: workState.snapshot?.plan?.length ?? 0 } : usesStructuredAgent ? workflowProgress : { completed: completedTodoCount, total: totalTodoCount }}
      todoStatus={task.workFlowVersion === 1 && !workState.snapshot?.plan?.length ? workState.snapshot ? workStatusTitle(workState.snapshot.status, workflowRussian) : 'Work' : undefined}
      gitChangesCount={settings?.useMockData === true ? task.gitChanges?.length || 0 : undefined}
      centralTabs={centralTabs}
      activeTabId={activeTabId}
      onSelectTab={(tabId) => {
        logDebug(`Workspace tab selected: id="${tabId}"`)
        workflowChats.select(tabId)
        if (tabId === activeTabIdRef.current) return
        abortPendingTabSend(activeTabIdRef.current, task?.id)
        activeTabIdRef.current = tabId
        setActiveTabId(tabId)
        history.save()
      }}
      onCloseTab={handleCloseTabById}
      tabsPrefix={renderTabsPrefix()}
      tabsSuffix={renderTabsSuffix()}
      feed={renderFeed()}
      composer={renderComposer()}
      fileViewer={renderFileViewer()}
      rightPanelContent={renderRightPanelContent()}
      rightPanelWidth={todoWidth}
      onRightPanelWidthChange={setTodoWidth}
      onCloseRightPanel={() => setRightPanelTab(null)}
    />
  )
}
