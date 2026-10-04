// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup, act, within } from '@testing-library/react'
import { Workspace } from '../Workspace'
import { useStore, Settings, Task, Repository, TodoStep } from '../../store'
import agyStartupChunks from '../../../e2e/fixtures/agy-startup.json'
import type { AgentSessionSnapshot, AgentSessionsAPI } from '../../../shared/agent-session'
import type { WorkflowAPI } from '../../../shared/workflow'

// Mock Terminal and FitAddon
const { MockTerminal, MockFitAddon, mockTerminalInstances } = vi.hoisted(() => {
  const mockTerminalInstances: Array<{
    write: ReturnType<typeof vi.fn>
    open: ReturnType<typeof vi.fn>
    reset: ReturnType<typeof vi.fn>
  }> = []
  class MockTerminal {
    options = {}
    cols = 80
    rows = 24
    open = vi.fn()
    loadAddon = vi.fn()
    write = vi.fn()
    clear = vi.fn()
    reset = vi.fn()
    dispose = vi.fn()
    onData = vi.fn(() => ({ dispose: vi.fn() }))
    onResize = vi.fn(() => ({ dispose: vi.fn() }))
    constructor() {
      mockTerminalInstances.push(this)
    }
  }

  class MockFitAddon {
    fit = vi.fn()
    dispose = vi.fn()
  }

  return { MockTerminal, MockFitAddon, mockTerminalInstances }
})

vi.mock('xterm', () => ({
  Terminal: MockTerminal,
}))

vi.mock('xterm-addon-fit', () => ({
  FitAddon: MockFitAddon,
}))

describe('Workspace Integration Tests', () => {
  const originalStartTask = useStore.getState().startTask
  let mockWritePty: ReturnType<typeof vi.fn>
  let mockKillPty: ReturnType<typeof vi.fn>
  let mockSpawnPty: ReturnType<typeof vi.fn>
  let mockResizePty: ReturnType<typeof vi.fn>
  let mockOnPtyData: ReturnType<typeof vi.fn>
  let mockOnPtyExit: ReturnType<typeof vi.fn>
  let mockWriteDebugLog: ReturnType<typeof vi.fn>

  const sampleSteps: TodoStep[] = [
    { id: 's1', text: 'Step One: Analyze architecture', done: true, description: 'Initial review complete' },
    { id: 's2', text: 'Step Two: Decompose modules', done: false, active: true },
    { id: 's3', text: 'Step Three: Write tests', done: false },
  ]

  const sampleTask: Task = {
    id: 'task-test-1',
    name: 'Integration Test Task',
    repoId: 'repo-1',
    status: 'idle',
    model: 'gpt-6-astra',
    workflow: 'Feature',
    branchType: 'Worktree',
    branchName: 'feature/workspace-integration',
    worktreePath: '/tmp/worktree-task-1',
    logs: [],
    feed: [
      { id: 'feed-1', type: 'user', text: 'Hello ZIAForge AI' },
      { id: 'feed-2', type: 'ai', text: 'Hello! I am ready to work on the workspace decomposition.' },
    ],
    todoSteps: sampleSteps,
    gitChanges: [
      { id: 'gc-1', filename: 'Workspace.tsx', path: 'src/components/Workspace.tsx', additions: 10, deletions: 50, diff: '@@ -1,3 +1,4 @@' },
    ],
  }

  const sampleRepo: Repository = {
    id: 'repo-1',
    name: 'Test Project',
    path: '/mock/projects/test-proj',
    repoPath: '/mock/projects/test-proj',
    currentBranch: 'main',
    branches: ['main', 'feature/workspace-integration'],
  }

  beforeEach(() => {
    const stored = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => stored.get(key) || null,
      setItem: (key: string, value: string) => stored.set(key, value),
    })
    mockTerminalInstances.length = 0
    mockWritePty = vi.fn().mockResolvedValue({ success: true })
    mockKillPty = vi.fn().mockResolvedValue({ success: true })
    mockSpawnPty = vi.fn().mockResolvedValue({ success: true })
    mockResizePty = vi.fn().mockResolvedValue({ success: true })
    mockOnPtyData = vi.fn().mockReturnValue(() => {})
    mockOnPtyExit = vi.fn().mockReturnValue(() => {})
    mockWriteDebugLog = vi.fn().mockResolvedValue(undefined)

    const ziafAPIMock = {
      workflows: {
        discuss: vi.fn<WorkflowAPI['discuss']>(),
        respond: vi.fn<WorkflowAPI['respond']>(), readArtifact: vi.fn<WorkflowAPI['readArtifact']>(),
        get: vi.fn<WorkflowAPI['get']>(async () => null),
        onEvent: vi.fn<WorkflowAPI['onEvent']>(() => () => {}),
        save: vi.fn<WorkflowAPI['save']>(), start: vi.fn<WorkflowAPI['start']>(), pause: vi.fn<WorkflowAPI['pause']>(),
      } satisfies WorkflowAPI,
      listProjectFiles: vi.fn().mockResolvedValue([]),
      getAgentModels: vi.fn().mockResolvedValue(['gpt-6-astra', 'claude-3-7-sonnet']),
      getChatHistory: vi.fn().mockResolvedValue([]),
      saveChatHistory: vi.fn().mockResolvedValue(undefined),
      writeDebugLog: mockWriteDebugLog,
      onPtyData: mockOnPtyData,
      onPtyExit: mockOnPtyExit,
      getActiveProcesses: vi.fn().mockResolvedValue([]),
      writePty: mockWritePty,
      spawnPty: mockSpawnPty,
      killPty: mockKillPty,
      resizePty: mockResizePty,
      killProcessByPid: vi.fn().mockResolvedValue({ success: true }),
      killProcessByCommand: vi.fn().mockResolvedValue({ success: true }),
      getRepositories: vi.fn().mockResolvedValue([sampleRepo]),
      getPresets: vi.fn().mockResolvedValue([]),
      getSettings: vi.fn().mockResolvedValue({}),
      getTasks: vi.fn().mockResolvedValue([sampleTask]),
      getAppVersion: vi.fn().mockResolvedValue('0.0.3'),
      readFile: vi.fn().mockResolvedValue('{"test": true}'),
      writeFile: vi.fn().mockResolvedValue({ success: true }),
      createDirectory: vi.fn().mockResolvedValue(undefined),
    }

    Object.defineProperty(window, 'ziafAPI', {
      value: ziafAPIMock,
      writable: true,
      configurable: true,
    })
    Object.defineProperty(globalThis, 'ziafAPI', {
      value: ziafAPIMock,
      writable: true,
      configurable: true,
    })

    useStore.setState({
      activeRepoId: 'repo-1',
      activeTaskId: 'task-test-1',
      tasks: [sampleTask],
      repositories: [sampleRepo],
      activeFeed: sampleTask.feed,
      presets: [],
      activeLogs: [],
      rightPanelTab: 'todo',
      startTask: originalStartTask,
      settings: {
        theme: 'dark',
        language: 'ru',
        uiLanguage: 'ru',
        defaultIDE: 'cursor',
        autoArchive: 'never',
        soundAlerts: false,
        soundType: 'default',
        desktopNotifications: false,
        launchAtLogin: false,
        preventSleep: false,
      } as Settings,
      mockFileContents: {},
    })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('ordinary Browser opens real URLs explicitly and header Settings navigates to settings', async () => {
    useStore.setState({ rightPanelTab: 'browser', settings: { ...useStore.getState().settings!, useMockData: false, uiLanguage: 'en' } })
    const openExternal = vi.fn().mockResolvedValue(undefined)
    Object.assign(window.ziafAPI, { openExternal })
    render(<Workspace />)
    expect(screen.getByTestId('browser-preview')).not.toBeNull()
    expect(screen.queryByText('Google')).toBeNull()
    expect(screen.queryByTitle('Bookmark')).toBeNull()
    expect(openExternal).not.toHaveBeenCalled()
    fireEvent.change(screen.getByTestId('browser-preview-url'), { target: { value: 'localhost:5173' } })
    await act(async () => fireEvent.click(screen.getByTestId('browser-preview-open')))
    expect(openExternal).toHaveBeenCalledExactlyOnceWith('http://localhost:5173/')
    fireEvent.click(screen.getByTitle('Settings'))
    expect(useStore.getState().activeTab).toBe('settings')
  })

  it('keeps the simulated browser only in explicit mock mode', () => {
    useStore.setState({ rightPanelTab: 'browser', settings: { ...useStore.getState().settings!, useMockData: true } })
    render(<Workspace />)
    expect(screen.queryByTestId('browser-preview')).toBeNull()
    expect(screen.getByText('Google')).not.toBeNull()
  })

  it.each([{ provider: 'codex' as const, agent: 'Codex' }, { provider: 'claude' as const, agent: 'Claude Code' }, { provider: 'antigravity' as const, agent: 'Google Antigravity' }])('routes saved $provider tasks and chats through the backend with no PTY or review-preset substitution', async ({ provider, agent }) => {
    const preset = { name: 'Saved coding choice', agent, model: 'fixture-model', permissions: 'Read only' }
    let session: AgentSessionSnapshot | null = null
    const api = {
      attach: vi.fn<AgentSessionsAPI['attach']>(async request => session?.chatId === request.chatId ? session : null),
      create: vi.fn<AgentSessionsAPI['create']>(async request => {
        session = {
          ...request, sessionId: `structured-${request.chatId}`, runId: 'run-native', cursor: 1,
          provider, presetName: preset.name, model: preset.model, sessionStatus: 'ready',
          capabilities: { attachments: false, interactiveApprovals: true, interruptTurn: true }, feed: [], pendingApprovals: [],
        }
        return session
      }),
      snapshot: vi.fn<AgentSessionsAPI['snapshot']>(async () => session!),
      send: vi.fn<AgentSessionsAPI['send']>(async request => ({ ...request, cursor: 2 })),
      queue: vi.fn<AgentSessionsAPI['queue']>(async () => session!),
      setQueuePaused: vi.fn<AgentSessionsAPI['setQueuePaused']>(async () => session!),
      cancelQueued: vi.fn<AgentSessionsAPI['cancelQueued']>(async () => session!),
      interrupt: vi.fn<AgentSessionsAPI['interrupt']>(async () => {}),
      terminate: vi.fn<AgentSessionsAPI['terminate']>(async () => {}),
      resume: vi.fn<AgentSessionsAPI['resume']>(async () => session!),
      reconfigure: vi.fn<AgentSessionsAPI['reconfigure']>(async () => session!),
      resolveApproval: vi.fn<AgentSessionsAPI['resolveApproval']>(async () => {}),
      onEvent: vi.fn<AgentSessionsAPI['onEvent']>(() => () => {}),
    } satisfies AgentSessionsAPI
    Object.assign(window.ziafAPI, { agentSessions: api })
    useStore.setState({
      tasks: [{ ...sampleTask, model: preset.name, status: 'running', description: 'Initial task request' }],
      presets: [preset, { name: 'Reviewer', agent: 'Claude Code', model: 'auto', permissions: 'Read only' }],
      settings: { ...useStore.getState().settings!, useMockData: false, defaultReviewPreset: 'Reviewer' },
    })
    const mounted = render(<Workspace />)
    await waitFor(() => expect((screen.getByTestId('composer-input') as HTMLTextAreaElement).value).toBe('Initial task request'))
    expect(screen.getByTestId(`structured-${provider}-chat`)).not.toBeNull()
    expect(api.create).not.toHaveBeenCalled()
    expect(mockSpawnPty).not.toHaveBeenCalled()
    await act(async () => { fireEvent.click(screen.getByTestId('btn-new-chat')) })
    await waitFor(() => expect(api.attach).toHaveBeenCalledTimes(2))
    await act(async () => {
      fireEvent.change(screen.getByTestId('composer-input'), { target: { value: 'Message from the new chat' } })
      fireEvent.click(screen.getByTestId('composer-send-button'))
    })
    expect(api.create).toHaveBeenCalledTimes(1)
    expect(api.create.mock.calls[0][0]).toMatchObject({ taskId: sampleTask.id, presetName: preset.name })
    expect(api.create.mock.calls[0][0].chatId).not.toBe('chat-main')
    expect(api.send).toHaveBeenCalledTimes(1)
    expect(mockSpawnPty).not.toHaveBeenCalled()
    expect(mockWritePty).not.toHaveBeenCalled()
    expect(mockKillPty).not.toHaveBeenCalled()
    const chatId = api.create.mock.calls[0][0].chatId
    await act(async () => {})
    const savesBeforeClose = vi.mocked(window.ziafAPI.saveChatHistory).mock.calls.length
    act(() => { fireEvent.click(screen.getByTestId(`close-tab-${chatId}`)) })
    // Persist the complete close transaction before debounce or unmount. A
    // native renderer reload cannot wait for a React cleanup effect.
    expect(window.ziafAPI.saveChatHistory).toHaveBeenCalledTimes(savesBeforeClose + 1)
    expect(vi.mocked(window.ziafAPI.saveChatHistory).mock.calls.at(-1)?.[0]).toMatchObject({
      taskId: sampleTask.id, activeTabId: 'chat-main',
      centralTabs: [{ id: 'chat-main', name: 'Discussion Feed', type: 'chat' }],
      recentTabs: [{ id: chatId, name: expect.any(String), type: 'chat' }],
    })
    expect(JSON.parse(localStorage.getItem(`ziaf-recent-chats:${sampleTask.id}`)!)).toEqual([
      { id: chatId, name: expect.any(String), type: 'chat' },
    ])
    mounted.unmount()
    const reopened = render(<Workspace />)
    await act(async () => { fireEvent.click(screen.getByTestId('chat-history-button')) })
    expect(screen.queryByTestId('recent-chat-recent-1')).toBeNull()
    await act(async () => { fireEvent.click(screen.getByTestId(`recent-chat-${chatId}`)) })
    await waitFor(() => expect(api.attach).toHaveBeenLastCalledWith({ taskId: sampleTask.id, chatId }))
    expect(api.create).toHaveBeenCalledTimes(1)
    expect(api.send).toHaveBeenCalledTimes(1)
    expect(mockSpawnPty).not.toHaveBeenCalled()
    expect(mockKillPty).not.toHaveBeenCalled()
    await act(async () => { fireEvent.click(screen.getByTestId(`close-tab-${chatId}`)) })
    reopened.unmount()
    useStore.setState({ activeTaskId: 'different-task', tasks: [{ ...useStore.getState().tasks[0], id: 'different-task' }] })
    render(<Workspace />)
    await act(async () => { fireEvent.click(screen.getByTestId('chat-history-button')) })
    expect(screen.queryByTestId(`recent-chat-${chatId}`)).toBeNull()
  })

  it.each(['edited', 'deleted'] as const)('retains a Codex task binding when its preset is %s across Workspace remount', async change => {
    const taskId = `codex-binding-${change}`
    const preset = { name: 'Mutable coding preset', agent: 'Codex', model: 'fixture', permissions: 'Read only' }
    const snapshot: AgentSessionSnapshot = {
      taskId, chatId: 'chat-main', sessionId: 'bound-session', runId: 'bound-run', cursor: 1,
      provider: 'codex', presetName: preset.name, sessionStatus: 'ready',
      capabilities: { attachments: false, interactiveApprovals: true, interruptTurn: true },
      feed: [], pendingApprovals: [],
    }
    const api = {
      attach: vi.fn<AgentSessionsAPI['attach']>(async () => snapshot),
      create: vi.fn<AgentSessionsAPI['create']>(async () => snapshot),
      snapshot: vi.fn<AgentSessionsAPI['snapshot']>(async () => snapshot),
      send: vi.fn<AgentSessionsAPI['send']>(async request => ({ ...request, cursor: 2 })),
      queue: vi.fn<AgentSessionsAPI['queue']>(async () => snapshot),
      setQueuePaused: vi.fn<AgentSessionsAPI['setQueuePaused']>(async () => snapshot),
      cancelQueued: vi.fn<AgentSessionsAPI['cancelQueued']>(async () => snapshot),
      interrupt: vi.fn<AgentSessionsAPI['interrupt']>(async () => {}),
      terminate: vi.fn<AgentSessionsAPI['terminate']>(async () => {}),
      resume: vi.fn<AgentSessionsAPI['resume']>(async () => snapshot),
      reconfigure: vi.fn<AgentSessionsAPI['reconfigure']>(async () => snapshot),
      resolveApproval: vi.fn<AgentSessionsAPI['resolveApproval']>(async () => {}),
      onEvent: vi.fn<AgentSessionsAPI['onEvent']>(() => () => {}),
    } satisfies AgentSessionsAPI
    Object.assign(window.ziafAPI, { agentSessions: api })
    useStore.setState({ tasks: [{ ...sampleTask, id: taskId, model: preset.name, status: 'running' }], activeTaskId: taskId,
      presets: [preset], settings: { ...useStore.getState().settings!, useMockData: false } })
    const mounted = render(<Workspace />)
    await waitFor(() => expect(useStore.getState().tasks[0].agentProvider).toBe('codex'))
    mounted.unmount()
    useStore.setState({ presets: change === 'deleted' ? [] : [{ ...preset, agent: 'Claude Code' }] })
    render(<Workspace />)
    await waitFor(() => expect(api.attach).toHaveBeenCalledTimes(2))
    expect(screen.getByTestId('structured-codex-chat')).not.toBeNull()
    await act(async () => {
      fireEvent.change(screen.getByTestId('composer-input'), { target: { value: 'Continue the existing session' } })
      fireEvent.click(screen.getByTestId('composer-send-button'))
    })
    expect(api.send.mock.calls[0][0]).toMatchObject({ sessionId: snapshot.sessionId, runId: snapshot.runId })
    expect(api.create).not.toHaveBeenCalled()
    expect(mockSpawnPty).not.toHaveBeenCalled()
    expect(mockWritePty).not.toHaveBeenCalled()
  })

  it('keeps an explicitly mocked Codex task on the mock UI without spawning a real CLI', async () => {
    const preset = { name: 'Mock Codex choice', agent: 'Codex', model: 'auto', permissions: 'Read only' }
    const attach = vi.fn()
    Object.assign(window.ziafAPI, { agentSessions: { attach } })
    useStore.setState({
      tasks: [{ ...sampleTask, model: preset.name, status: 'running' }],
      presets: [preset],
      settings: { ...useStore.getState().settings!, useMockData: true },
    })
    render(<Workspace />)
    expect(screen.queryByTestId('structured-codex-chat')).toBeNull()
    expect(screen.getByTestId('composer-input')).not.toBeNull()
    expect(attach).not.toHaveBeenCalled()
    expect(mockSpawnPty).not.toHaveBeenCalled()
  })

  it('uses the configured default for a task without a model, then follows each task model', async () => {
    const presets = [
      { name: 'Review preset', agent: 'Claude Code', model: 'auto', permissions: 'Read only' },
      { name: 'Coding preset', agent: 'Google Antigravity', model: 'auto', permissions: 'Read only' },
    ]
    useStore.setState({
      tasks: [{ ...sampleTask, model: undefined }],
      presets,
      settings: { ...useStore.getState().settings!, defaultCodingPreset: 'Coding preset', useMockData: true },
    })
    render(<Workspace />)
    expect(screen.getByTestId('composer-model-selector-btn').textContent).toContain('Coding preset')
    await act(async () => { useStore.setState({ tasks: [sampleTask] }) })
    expect(screen.getByTestId('composer-model-selector-btn').textContent).toContain(sampleTask.model)
    await act(async () => {
      useStore.setState({ tasks: [sampleTask, { ...sampleTask, id: 'another-model-task', model: 'Review preset' }], activeTaskId: 'another-model-task' })
    })
    expect(screen.getByTestId('composer-model-selector-btn').textContent).toContain('Review preset')
  })

  it('filters startup noise, parses split numbered and yes/no prompts, and records only successful PTY answers', async () => {
    const taskId = 'task-interactive-formats'
    const sessionId = `term-task-${taskId}-0`
    const callbacks: Record<string, (data: string) => void> = {}
    mockOnPtyData.mockImplementation((id: string, callback: (data: string) => void) => {
      callbacks[id] = callback
      return () => { delete callbacks[id] }
    })
    const interactiveTask: Task = { ...sampleTask, id: taskId, status: 'running', model: 'auto', feed: [] }
    useStore.setState({ activeTaskId: taskId, tasks: [interactiveTask], activeFeed: [], answeredPromptIds: {}, settings: { ...useStore.getState().settings!, useMockData: false } })
    render(<Workspace />)
    await waitFor(() => expect(callbacks[sessionId]).toBeDefined())
    await act(async () => {
      callbacks[sessionId]('export LANG=en_US.UTF-8; export LC_ALL=en_US.UTF-8; clear\r\nclear\r\nGemini 3.8 Flash · high\r\nWarning: provider unavailable\r\nChoose an action:\r\n1) Continue\r\n[2] Can')
      callbacks[sessionId]('cel\r\n(3) Explain')
    })
    const feed = screen.getByTestId('conversation-feed')
    expect(feed.textContent).not.toContain('export LANG=')
    expect(feed.textContent).not.toContain('Gemini 3.8 Flash · high')
    expect(feed.textContent).toContain('Warning: provider unavailable')
    expect(screen.getByRole('button', { name: 'Cancel' })).not.toBeNull()
    const explain = screen.getByRole('button', { name: 'Explain' })
    mockWritePty.mockResolvedValueOnce({ success: false, error: 'PTY write rejected' })
    await act(async () => { fireEvent.click(explain) })
    expect(explain.hasAttribute('disabled')).toBe(false)
    expect(screen.getByRole('alert').textContent).toContain('PTY write rejected')
    await act(async () => { fireEvent.click(explain) })
    expect(mockWritePty).toHaveBeenCalledWith({ sessionId, data: '3\r' })
    expect(explain.hasAttribute('disabled')).toBe(true)
    await act(async () => { callbacks[sessionId]('Confirmed choice: 3\r\nProceed? (y/N)') })
    expect(feed.textContent).toContain('Confirmed choice: 3')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Yes (y)' })) })
    expect(mockWritePty).toHaveBeenCalledWith({ sessionId, data: 'y\r' })
  })

  it('parses arrow navigation menus and sends payload (Enter for option 1, Down+Enter for option 2)', async () => {
    const taskId = 'task-arrow-menu'
    const sessionId = `term-task-${taskId}-0`
    const callbacks: Record<string, (data: string) => void> = {}
    mockOnPtyData.mockImplementation((id: string, callback: (data: string) => void) => {
      callbacks[id] = callback
      return () => { delete callbacks[id] }
    })
    const navTask: Task = { ...sampleTask, id: taskId, status: 'running', model: 'auto', feed: [] }
    useStore.setState({ activeTaskId: taskId, tasks: [navTask], activeFeed: [], answeredPromptIds: {}, settings: { ...useStore.getState().settings!, useMockData: false } })
    render(<Workspace />)
    await waitFor(() => expect(callbacks[sessionId]).toBeDefined())
    await act(async () => {
      callbacks[sessionId](
        'Requesting permission for:\r\n   git status\r\n\r\nRun this command?\r\n> 1. Yes, run command\r\n  2. Yes, and always allow\r\n  3. No, cancel\r\n\r\n  ↑/↓ Navigate · tab Amend · ctrl+g edit/expand command\r\n'
      )
    })
    const runBtn = screen.getByRole('button', { name: 'Yes, run command' })
    expect(runBtn).not.toBeNull()
    await act(async () => { fireEvent.click(runBtn) })
    expect(mockWritePty).toHaveBeenCalledWith({ sessionId, data: '\r' })

    // Next arrow menu: unnumbered trust prompt
    await act(async () => {
      callbacks[sessionId](
        'Do you trust the contents of this project?\r\n> Yes, I trust this folder\r\n  No, exit\r\n\r\n  ↑/↓ Navigate · enter Confirm\r\n'
      )
    })
    const exitBtn = screen.getByRole('button', { name: 'No, exit' })
    expect(exitBtn).not.toBeNull()
    await act(async () => { fireEvent.click(exitBtn) })
    expect(mockWritePty).toHaveBeenCalledWith({ sessionId, data: '\u001b[B\r' })
  })

  it('parses arrow navigation menus in custom tab feed when nested in tool items and sends payload', async () => {
    const taskId = 'task-custom-arrow-menu'
    const customSession = 'chat-custom-arrow-tab'
    const callbacks: Record<string, (data: string) => void> = {}
    mockOnPtyData.mockImplementation((id: string, callback: (data: string) => void) => {
      callbacks[id] = callback
      return () => { delete callbacks[id] }
    })
    mockSpawnPty.mockResolvedValue({ success: true, generation: 1 })
    vi.mocked(window.ziafAPI.getChatHistory).mockResolvedValue({
      centralTabs: [
        { id: 'chat-main', name: 'Discussion Feed', type: 'chat' },
        { id: customSession, name: 'Custom Arrow Chat', type: 'chat' },
      ],
      customTabFeeds: {},
    })
    useStore.setState({
      activeTaskId: taskId,
      tasks: [{ ...sampleTask, id: taskId, status: 'running', feed: [] }],
      activeFeed: [],
      answeredPromptIds: {},
      settings: { ...useStore.getState().settings!, useMockData: false },
    })
    render(<Workspace />)
    await act(async () => {})
    await act(async () => { fireEvent.click(screen.getByTestId(`central-tab-${customSession}`)) })
    await act(async () => { callbacks[customSession]('Welcome to Antigravity CLI\r\n> ? for shortcuts') })
    
    // User submits prompt
    fireEvent.change(screen.getByTestId('composer-input'), { target: { value: 'Run permission check' } })
    await act(async () => { fireEvent.click(screen.getByTestId('composer-send-button')) })

    // Agent outputs echo and interactive arrow menu nested in tool segment
    await act(async () => {
      callbacks[customSession](
        '> Run permission check\r\n● Bash(git status)\r\nRun this command?\r\n> 1. Yes, run command\r\n  2. No, cancel\r\n  ↑/↓ Navigate · enter Confirm\r\n'
      )
    })

    const runBtn = await screen.findByRole('button', { name: 'Yes, run command' })
    expect(runBtn).not.toBeNull()
    await act(async () => { fireEvent.click(runBtn) })
    expect(mockWritePty).toHaveBeenCalledWith({ sessionId: customSession, data: '\r' })
  })

  it('renders WorkspaceShell with central tabs, composer, and conversation feed', () => {
    render(<Workspace />)

    // Shell container is mounted
    expect(screen.getByTestId('workspace-shell')).not.toBeNull()

    // Central tab is rendered
    expect(screen.getByTestId('central-tab-chat-main')).not.toBeNull()

    // Composer is rendered
    expect(screen.getByTestId('composer-container')).not.toBeNull()
    expect(screen.getByTestId('composer-input')).not.toBeNull()

    // Conversation feed items are rendered
    expect(screen.getByTestId('conversation-feed')).not.toBeNull()
    expect(screen.getByText('Hello ZIAForge AI')).not.toBeNull()
    expect(screen.getByText('Hello! I am ready to work on the workspace decomposition.')).not.toBeNull()
  })

  it('parses a custom-tab yes/no prompt and sends the answer only to that tab PTY', async () => {
    const tabId = 'chat-prompt-routing'
    const taskId = 'task-prompt-routing'
    const callbacks: Record<string, (data: string) => void> = {}
    mockOnPtyData.mockImplementation((id: string, callback: (data: string) => void) => {
      callbacks[id] = callback
      return () => { delete callbacks[id] }
    })
    vi.mocked(window.ziafAPI.getChatHistory).mockResolvedValueOnce({
      centralTabs: [
        { id: 'chat-main', name: 'Discussion Feed', type: 'chat' },
        { id: tabId, name: 'Prompt Chat', type: 'chat' },
      ],
      customTabFeeds: { [tabId]: [{ id: 'routing-user', type: 'user', text: 'ask-yes-no' }] },
    })
    useStore.setState({
      activeTaskId: taskId,
      tasks: [{ ...sampleTask, id: taskId, status: 'running', model: 'auto' }],
      answeredPromptIds: {},
      settings: { ...useStore.getState().settings!, useMockData: false },
    })
    render(<Workspace />)
    fireEvent.click(await screen.findByTestId(`central-tab-${tabId}`))
    await waitFor(() => expect(callbacks[tabId]).toBeDefined())
    await act(async () => { callbacks[tabId]('ask-yes-no\r\nProceed? (y/N)') })
    const yes = await screen.findByRole('button', { name: 'Yes (y)' })
    await act(async () => { fireEvent.click(yes) })
    expect(mockWritePty).toHaveBeenCalledWith({ sessionId: tabId, data: 'y\r' })
    expect(mockWritePty).not.toHaveBeenCalledWith({ sessionId: `term-task-${taskId}-0`, data: 'y\r' })
    expect(yes.hasAttribute('disabled')).toBe(true)
    await act(async () => { callbacks[tabId]('\r\nConfirmed choice: y\r\n> ') })
    await waitFor(() => expect(screen.getByTestId('conversation-feed').textContent).toContain('Confirmed choice: y'))
  })

  it('integrates PlanPanel in right panel and renders todo steps correctly', () => {
    render(<Workspace />)

    expect(screen.getByTestId('plan-panel')).not.toBeNull()
    expect(screen.getByTestId('plan-progress-counter').textContent).toBe('1/3')
    expect(screen.getByText('Step One: Analyze architecture')).not.toBeNull()
    expect(screen.getByText('Step Two: Decompose modules')).not.toBeNull()
    expect(screen.getByText('Step Three: Write tests')).not.toBeNull()
  })

  it('opens exactly ONE EditStepModal when editing a step and saves changes to store', async () => {
    render(<Workspace />)

    // Initially no modal
    expect(screen.queryByTestId('edit-step-modal')).toBeNull()

    // Click chevron to edit Step 1
    const chevronBtn = screen.getByTestId('todo-chevron-s1')
    fireEvent.click(chevronBtn)

    // Exactly one modal should be present
    const modals = screen.getAllByTestId('edit-step-modal')
    expect(modals).toHaveLength(1)

    // Edit step name
    const nameInput = screen.getByTestId('edit-step-name-input') as HTMLInputElement
    expect(nameInput.value).toBe('Step One: Analyze architecture')
    fireEvent.change(nameInput, { target: { value: 'Step One: Architecture Analyzed (Updated)' } })

    // Save changes
    const saveBtn = screen.getByTestId('edit-step-save-btn')
    fireEvent.click(saveBtn)

    // Modal closes
    await waitFor(() => {
      expect(screen.queryByTestId('edit-step-modal')).toBeNull()
    })

    // Store is updated
    const updatedTask = useStore.getState().tasks.find(t => t.id === 'task-test-1')
    expect(updatedTask?.todoSteps.find(s => s.id === 's1')?.text).toBe('Step One: Architecture Analyzed (Updated)')
  })

  it('preserves PlanPanel draft text across right panel tab switching', async () => {
    render(<Workspace />)

    const addInput = screen.getByTestId('plan-add-input') as HTMLInputElement
    fireEvent.change(addInput, { target: { value: 'Drafted new step text' } })
    expect(addInput.value).toBe('Drafted new step text')

    // Switch right panel to 'files' tab
    const filesToggleBtn = screen.getByTestId('tab-btn-files')
    fireEvent.click(filesToggleBtn)

    // Plan panel should not be visible now
    expect(screen.queryByTestId('plan-panel')).toBeNull()

    // Switch back to 'todo' tab
    const todoToggleBtn = screen.getByTestId('tab-btn-todo')
    fireEvent.click(todoToggleBtn)

    // Plan panel reappears and draft text is preserved!
    expect(screen.getByTestId('plan-panel')).not.toBeNull()
    const restoredInput = screen.getByTestId('plan-add-input') as HTMLInputElement
    expect(restoredInput.value).toBe('Drafted new step text')
  })

  it('opens structured plan.json tab when clicking onOpenStructuredPlan link and writes to disk in real mode', async () => {
    useStore.setState({
      settings: { ...useStore.getState().settings, useMockData: false } as Settings,
    })

    render(<Workspace />)

    const structuredLink = screen.getByTestId('plan-structured-link')
    fireEvent.click(structuredLink)

    // File tab for plan.json should be opened in central tabs
    await waitFor(() => {
      expect(screen.getByTestId('central-tab-file-plan.json')).not.toBeNull()
    })
    expect(useStore.getState().mockFileContents['plan.json']).toBeDefined()
    expect(window.ziafAPI.writeFile).toHaveBeenCalledWith(
      expect.objectContaining({
        filePath: '/tmp/worktree-task-1/plan.json',
      })
    )
  })

  it('tracks main session generation and interrupts with Ctrl+C while preserving task and PTY', async () => {
    const taskId = 'task-busy-main'
    const sessionId = `term-task-${taskId}-0`
    let output: (data: string, meta?: { generation?: number }) => void = () => {}
    mockOnPtyData.mockImplementation((id, callback) => {
      if (id === sessionId) output = callback
      return () => {}
    })
    mockSpawnPty.mockResolvedValue({ success: true, generation: 7 })
    useStore.setState({
      activeTaskId: taskId,
      tasks: [{ ...sampleTask, id: taskId, status: 'running', feed: [] }],
      activeFeed: [],
      settings: { ...useStore.getState().settings!, useMockData: false },
    })
    render(<Workspace />)
    await act(async () => {})
    expect(screen.queryByTestId('composer-stop-button')).toBeNull() // Booting does not show stop button.
    await act(async () => { output('Welcome to Claude Code\r\n> ? for shortcuts', { generation: 7 }) })
    expect(screen.queryByTestId('composer-stop-button')).toBeNull()
    expect(screen.getByTestId('composer-send-button')).not.toBeNull()
    await act(async () => { output('Obsolete generation working', { generation: 6 }) })
    expect(screen.queryByTestId('composer-stop-button')).toBeNull()

    fireEvent.change(screen.getByTestId('composer-input'), { target: { value: 'Привет' } })
    await act(async () => { fireEvent.click(screen.getByTestId('composer-send-button')) })
    expect(mockWritePty).toHaveBeenCalledWith({ sessionId, data: 'Привет\r' })
    expect(screen.queryByTestId('composer-stop-button')).toBeNull()
    await act(async () => { output('Thinking...\r\n', { generation: 7 }) })
    expect(screen.queryByTestId('composer-stop-button')).not.toBeNull()
    await act(async () => { fireEvent.click(screen.getByTestId('composer-stop-button')) })
    expect(mockWritePty).toHaveBeenCalledWith({ sessionId, data: '\x03' })
    expect(mockKillPty).not.toHaveBeenCalled()
    expect(useStore.getState().tasks[0].status).toBe('running')
    await act(async () => { output('Cancelled\r\n> ', { generation: 7 }) })
    expect(screen.queryByTestId('composer-stop-button')).toBeNull()
    expect(mockSpawnPty).toHaveBeenCalledTimes(1)
  })

  it('orders two custom-tab turns, keeps prompts interactive and stops only the current session', async () => {
    const taskId = 'task-custom-turns'
    const mainSession = `term-task-${taskId}-0`
    const customSession = 'term-custom-flow-13'
    const callbacks: Record<string, (data: string, meta?: { generation?: number }) => void> = {}
    mockOnPtyData.mockImplementation((id, callback) => {
      callbacks[id] = callback
      return () => { delete callbacks[id] }
    })
    mockSpawnPty.mockResolvedValue({ success: true, generation: 13 })
    vi.mocked(window.ziafAPI.getChatHistory).mockResolvedValue({
      centralTabs: [
        { id: 'chat-main', name: 'Discussion Feed', type: 'chat' },
        { id: customSession, name: 'Turn regression', type: 'chat' },
      ], customTabFeeds: {},
    })
    useStore.setState({
      activeTaskId: taskId,
      tasks: [{ ...sampleTask, id: taskId, status: 'running', feed: [] }],
      activeFeed: [],
      answeredPromptIds: {},
      settings: { ...useStore.getState().settings!, useMockData: false },
    })
    render(<Workspace />)
    await act(async () => {})
    await act(async () => { callbacks[mainSession]('Welcome to Claude Code\r\n> ') })
    const send = async (message: string) => {
      fireEvent.change(screen.getByTestId('composer-input'), { target: { value: message } })
      await act(async () => { fireEvent.click(screen.getByTestId('composer-send-button')) })
    }
    await send('Background generation')
    await act(async () => { callbacks[mainSession]('\r\n⣾ Generating... (esc to cancel)') })
    await act(async () => { fireEvent.click(screen.getByTestId(`central-tab-${customSession}`)) })
    await act(async () => { callbacks[customSession]('Welcome to Antigravity CLI\r\n> ? for shortcuts') })
    expect(screen.queryByTestId('composer-stop-button')).toBeNull()
    await send('Привет')
    expect(screen.queryByTestId('composer-stop-button')).toBeNull()
    await act(async () => { callbacks[customSession]('\r\n⣾ Generating... (esc to cancel)') })
    expect(screen.queryByTestId('composer-stop-button')).not.toBeNull()
    await act(async () => { callbacks[customSession]('\r\x1b[2K> Привет\r\nОтвет на привет\r\n> ? for shortcuts', { generation: 13 }) })
    await waitFor(() => expect(screen.getByTestId('conversation-feed').textContent).toContain('Ответ на привет'))
    expect(screen.queryByTestId('composer-stop-button')).toBeNull()
    await send('Создай страницу авторизации')
    await act(async () => { callbacks[customSession]('\r\x1b[2K> Создай страницу авторизации\r\nChoose an action:\r\n1) Create mock page\r\n2) Cancel') })
    const approve = await screen.findByRole('button', { name: 'Create mock page' })
    expect(screen.queryByTestId('composer-stop-button')).toBeNull()
    await act(async () => { fireEvent.click(approve) })
    expect(mockWritePty).toHaveBeenCalledWith({ sessionId: customSession, data: '1\r' })
    expect(approve.hasAttribute('disabled')).toBe(true)
    await act(async () => { callbacks[customSession]('\r\nСтраница авторизации готова\r\n> ? for shortcuts') })
    await waitFor(() => expect(screen.getByTestId('conversation-feed').textContent).toContain('Страница авторизации готова'))
    const text = screen.getByTestId('conversation-feed').textContent!
    expect(text.indexOf('Привет')).toBeLessThan(text.indexOf('Ответ на привет'))
    expect(text.indexOf('Ответ на привет')).toBeLessThan(text.indexOf('Создай страницу авторизации'))
    expect(text.indexOf('Создай страницу авторизации')).toBeLessThan(text.indexOf('Страница авторизации готова'))
    expect(screen.queryByTestId('composer-stop-button')).toBeNull()

    await send('Долгая генерация')
    await act(async () => { callbacks[customSession]('\r\n⣾ Generating... (esc to cancel)') })
    await act(async () => { fireEvent.click(screen.getByTestId('composer-stop-button')) })
    expect(mockWritePty).toHaveBeenCalledWith({ sessionId: customSession, data: '\x03' })
    expect(mockWritePty).not.toHaveBeenCalledWith({ sessionId: mainSession, data: '\x03' })
    expect(mockKillPty).not.toHaveBeenCalled()
    await act(async () => { callbacks[customSession]('\r\nCancelled\r\n> ') })
    expect(screen.queryByTestId('composer-stop-button')).toBeNull()
    await act(async () => { fireEvent.click(screen.getByTestId('central-tab-chat-main')) })
    expect(screen.queryByTestId('composer-stop-button')).not.toBeNull()
    expect(useStore.getState().tasks[0].status).toBe('running')
  })

  it.each(['main', 'custom'])('delivers two %s chat turns after captured agy sign-in, without leaking a queued prompt to diagnostics', async mode => {
    const taskId = `task-ready-replay-${mode}`
    const callbacks: Record<string, (data: string, meta?: { generation?: number }) => void> = {}
    mockOnPtyData.mockImplementation((id, callback) => {
      callbacks[id] = callback
      return () => { delete callbacks[id] }
    })
    mockSpawnPty.mockResolvedValue({ success: true, generation: 61 })
    useStore.setState({
      activeTaskId: taskId,
      tasks: [{ ...sampleTask, id: taskId, status: 'running', feed: [] }],
      activeFeed: [],
      settings: { ...useStore.getState().settings!, useMockData: false },
    })
    render(<Workspace />)
    await act(async () => {})
    let sessionId = `term-task-${taskId}-0`
    if (mode === 'custom') {
      await act(async () => { fireEvent.click(screen.getByTestId('btn-new-chat')) })
      sessionId = mockSpawnPty.mock.calls.map(([args]) => args.sessionId as string).find(id => id.startsWith('chat-'))!
    }
    await waitFor(() => expect(mockWritePty).toHaveBeenCalledWith({ sessionId, data: expect.stringMatching(/^agy .*\n$/) }), { timeout: 3500 })
    for (const chunk of agyStartupChunks.slice(0, 31)) {
      await act(async () => { callbacks[sessionId](chunk, { generation: 61 }) })
    }
    const first = `private-${mode}-first-instruction`
    const second = `private-${mode}-second-instruction`
    const send = async (message: string) => {
      fireEvent.change(screen.getByTestId('composer-input'), { target: { value: message } })
      await act(async () => { fireEvent.click(screen.getByTestId('composer-send-button')) })
    }
    const delivered = () => mockWritePty.mock.calls.filter(([args]) => args.sessionId === sessionId && args.data.endsWith('\r'))
    await send(first)
    expect(delivered()).toHaveLength(0)
    expect(screen.queryByTestId('composer-stop-button')).toBeNull()
    await act(async () => { callbacks[sessionId]('\x1b[H\x1b[JWelcome to Antigravity CLI\r\n> ? for shortcuts', { generation: 60 }) })
    expect(delivered()).toHaveLength(0)
    for (const chunk of agyStartupChunks.slice(31)) {
      await act(async () => { callbacks[sessionId](chunk, { generation: 61 }) })
    }
    await waitFor(() => expect(delivered()).toEqual([[{ sessionId, data: `${first}\r` }]]))
    // Match the PTY fixture's echo/generation/answer layout, including its line breaks.
    await act(async () => { callbacks[sessionId](`\r\x1b[2K> ${first}\r\n⣾ Generating... (esc to cancel)\r\n`, { generation: 61 }) })
    expect(screen.queryByTestId('composer-stop-button')).not.toBeNull()
    await act(async () => { callbacks[sessionId]('\r\nFirst answer\r\n> ? for shortcuts', { generation: 61 }) })
    expect(screen.queryByTestId('composer-stop-button')).toBeNull()
    await waitFor(() => expect(screen.getByTestId('conversation-feed').textContent).toContain('First answer'))
    await send(second)
    await act(async () => { callbacks[sessionId](`\r\x1b[2K> ${second}\r\n⣾ Generating... (esc to cancel)\r\n\r\nSecond answer\r\n> ? for shortcuts`, { generation: 61 }) })
    expect(delivered()).toEqual([[{ sessionId, data: `${first}\r` }], [{ sessionId, data: `${second}\r` }]])
    await waitFor(() => expect(screen.getByTestId('conversation-feed').textContent).toContain('Second answer'))
    const feed = screen.getByTestId('conversation-feed').textContent!
    expect(feed.indexOf(first)).toBeLessThan(feed.indexOf('First answer'))
    expect(feed.indexOf('First answer')).toBeLessThan(feed.indexOf(second))
    expect(feed.indexOf(second)).toBeLessThan(feed.indexOf('Second answer'))
    expect(screen.queryByTestId('composer-stop-button')).toBeNull()
    const diagnosticOutput = JSON.stringify(mockWriteDebugLog.mock.calls)
    expect(diagnosticOutput).not.toContain(first)
    expect(diagnosticOutput).not.toContain(second)
  })

  it.each(['main', 'custom'])('keeps the %s reconnect queue pending while a live CLI is authenticating', async mode => {
    const taskId = `task-auth-reconnect-${mode}`
    const callbacks: Record<string, (data: string, meta?: { generation?: number }) => void> = {}
    mockOnPtyData.mockImplementation((id, callback) => {
      callbacks[id] = callback
      return () => { delete callbacks[id] }
    })
    mockSpawnPty.mockResolvedValue({
      success: true, reconnected: true, generation: 71,
      history: agyStartupChunks.slice(0, 31).join(''),
    })
    vi.mocked(window.ziafAPI.getActiveProcesses).mockResolvedValue({ success: true, processes: [{ pid: 7171, command: 'agy' }] })
    useStore.setState({
      activeTaskId: taskId,
      tasks: [{ ...sampleTask, id: taskId, status: 'running', feed: [] }],
      activeFeed: [],
      settings: { ...useStore.getState().settings!, useMockData: false },
    })
    render(<Workspace />)
    await act(async () => {})
    let sessionId = `term-task-${taskId}-0`
    if (mode === 'custom') {
      await act(async () => { fireEvent.click(screen.getByTestId('btn-new-chat')) })
      sessionId = mockSpawnPty.mock.calls.map(([args]) => args.sessionId as string).find(id => id.startsWith('chat-'))!
    }
    expect(window.ziafAPI.getActiveProcesses).toHaveBeenCalledWith({ sessionId })
    fireEvent.change(screen.getByTestId('composer-input'), { target: { value: 'Wait for authentication' } })
    await act(async () => { fireEvent.click(screen.getByTestId('composer-send-button')) })
    expect(mockWritePty).not.toHaveBeenCalled()
    expect(screen.queryByTestId('composer-stop-button')).toBeNull()
    for (const chunk of agyStartupChunks.slice(31)) {
      await act(async () => { callbacks[sessionId](chunk, { generation: 71 }) })
    }
    expect(mockWritePty.mock.calls).toEqual([[{ sessionId, data: 'Wait for authentication\r' }]])
  })

  it('does not treat the main fallback timer and a live authenticating process as readiness', async () => {
    vi.useFakeTimers()
    try {
      const taskId = 'task-auth-fallback'
      const sessionId = `term-task-${taskId}-0`
      let output: (data: string, meta?: { generation?: number }) => void = () => {}
      mockOnPtyData.mockImplementation((id, callback) => {
        if (id === sessionId) output = callback
        return () => {}
      })
      mockSpawnPty.mockResolvedValue({ success: true, generation: 81 })
      vi.mocked(window.ziafAPI.getActiveProcesses).mockResolvedValue({ success: true, processes: [{ pid: 8181, command: 'agy' }] })
      useStore.setState({
        activeTaskId: taskId,
        tasks: [{ ...sampleTask, id: taskId, status: 'running', feed: [] }],
        activeFeed: [],
        settings: { ...useStore.getState().settings!, useMockData: false },
      })
      render(<Workspace />)
      await act(async () => {})
      await act(async () => { await vi.advanceTimersByTimeAsync(1500) })
      expect(mockWritePty).toHaveBeenCalledWith({ sessionId, data: expect.stringMatching(/^agy .*\n$/) })
      await act(async () => { output(agyStartupChunks.slice(0, 31).join(''), { generation: 81 }) })
      fireEvent.change(screen.getByTestId('composer-input'), { target: { value: 'Pending beyond timeout' } })
      await act(async () => { fireEvent.click(screen.getByTestId('composer-send-button')) })
      await act(async () => { await vi.advanceTimersByTimeAsync(13000) })
      expect(window.ziafAPI.getActiveProcesses).toHaveBeenCalledWith({ sessionId })
      const inputCalls = () => mockWritePty.mock.calls.filter(([args]) => args.data.endsWith('\r'))
      expect(inputCalls()).toHaveLength(0)
      expect(screen.queryByTestId('composer-stop-button')).toBeNull()
      await act(async () => { output(agyStartupChunks.slice(31).join(''), { generation: 81 }) })
      expect(inputCalls()).toEqual([[{ sessionId, data: 'Pending beyond timeout\r' }]])
    } finally {
      cleanup()
      vi.useRealTimers()
    }
  })

  it.each([
    { mode: 'main', ack: 'after-ready' },
    { mode: 'custom', ack: 'after-ready' },
    { mode: 'custom', ack: 'during-auth' },
  ])('preserves $mode readiness when the launch ACK arrives $ack', async ({ mode, ack }) => {
    const taskId = `task-early-ready-${mode}-${ack}`
    const callbacks: Record<string, (data: string, meta?: { generation?: number }) => void> = {}
    mockOnPtyData.mockImplementation((id, callback) => {
      callbacks[id] = callback
      return () => { delete callbacks[id] }
    })
    mockSpawnPty.mockResolvedValue({ success: true, generation: 91 })
    let acknowledgeLaunch: () => void = () => {}
    const commandAck = new Promise(resolve => { acknowledgeLaunch = () => resolve({ success: true }) })
    mockWritePty.mockImplementation(({ data }) => data.startsWith('agy ') ? commandAck : Promise.resolve({ success: true }))
    useStore.setState({
      activeTaskId: taskId,
      tasks: [{ ...sampleTask, id: taskId, status: 'running', feed: [] }],
      activeFeed: [],
      settings: { ...useStore.getState().settings!, useMockData: false },
    })
    render(<Workspace />)
    await act(async () => {})
    let sessionId = `term-task-${taskId}-0`
    if (mode === 'custom') {
      await act(async () => { fireEvent.click(screen.getByTestId('btn-new-chat')) })
      sessionId = mockSpawnPty.mock.calls.map(([args]) => args.sessionId as string).find(id => id.startsWith('chat-'))!
    }
    await waitFor(() => expect(mockWritePty).toHaveBeenCalledWith({ sessionId, data: expect.stringMatching(/^agy .*\n$/) }), { timeout: 3500 })
    const send = async (message: string) => {
      fireEvent.change(screen.getByTestId('composer-input'), { target: { value: message } })
      await act(async () => { fireEvent.click(screen.getByTestId('composer-send-button')) })
    }
    await send('Before launch ACK')
    await act(async () => { callbacks[sessionId](agyStartupChunks.slice(0, 31).join(''), { generation: 91 }) })
    if (ack === 'during-auth') await act(async () => { acknowledgeLaunch() })
    expect(mockWritePty).not.toHaveBeenCalledWith({ sessionId, data: 'Before launch ACK\r' })
    await act(async () => { callbacks[sessionId](agyStartupChunks.slice(31).join(''), { generation: 91 }) })
    expect(mockWritePty).toHaveBeenCalledWith({ sessionId, data: 'Before launch ACK\r' })
    await act(async () => { callbacks[sessionId]('\r\n⣾ Generating... (esc to cancel)', { generation: 91 }) })
    if (ack === 'after-ready') await act(async () => { acknowledgeLaunch() })
    await act(async () => { callbacks[sessionId]('\r\x1b[2KCompleted\r\n> ? for shortcuts', { generation: 91 }) })
    await send('After launch ACK')
    const inputCalls = mockWritePty.mock.calls.filter(([args]) => args.sessionId === sessionId && args.data.endsWith('\r'))
    expect(inputCalls).toEqual([[{ sessionId, data: 'Before launch ACK\r' }], [{ sessionId, data: 'After launch ACK\r' }]])
  })

  it('opens an untouched custom chat on a running task and stays idle through agy authentication and redraws', async () => {
    const taskId = 'task-agy-startup-regression'
    const mainSession = `term-task-${taskId}-0`
    const callbacks: Record<string, (data: string, meta?: { generation?: number }) => void> = {}
    mockOnPtyData.mockImplementation((id, callback) => {
      callbacks[id] = callback
      return () => { delete callbacks[id] }
    })
    mockSpawnPty.mockResolvedValue({ success: true, generation: 51 })
    useStore.setState({
      activeTaskId: taskId,
      tasks: [{ ...sampleTask, id: taskId, status: 'running', feed: [] }],
      activeFeed: [],
      settings: { ...useStore.getState().settings!, useMockData: false },
    })
    render(<Workspace />)
    await act(async () => {})
    await act(async () => { callbacks[mainSession]('> ') })
    await act(async () => { callbacks[mainSession]('\r\n⣾ Generating... (esc to cancel)') })
    expect(screen.queryByTestId('composer-stop-button')).not.toBeNull()

    await act(async () => { fireEvent.click(screen.getByTestId('btn-new-chat')) })
    const customSession = mockSpawnPty.mock.calls.map(([args]) => args.sessionId as string).find(id => id.startsWith('chat-'))!
    expect(customSession).toBeTruthy()
    expect(screen.queryByTestId('composer-stop-button')).toBeNull()
    for (const chunk of agyStartupChunks) {
      await act(async () => { callbacks[customSession](chunk, { generation: 51 }) })
      expect(screen.queryByTestId('composer-stop-button')).toBeNull()
    }
    // Footer-less intermediate redraw and a control-only query after readiness.
    for (const chunk of ['\x1b[H\x1b[JAntigravity CLI 1.2.1', '\r\n> ', '\x1b[?2026$', 'p']) {
      await act(async () => { callbacks[customSession](chunk, { generation: 51 }) })
      expect(screen.queryByTestId('composer-stop-button')).toBeNull()
    }
    expect((screen.getByTestId('composer-input') as HTMLTextAreaElement).value).toBe('')
    expect(screen.getByTestId('composer-send-button')).not.toBeNull()
    expect(mockWritePty.mock.calls.filter(([args]) => args.sessionId === customSession && args.data.endsWith('\r'))).toHaveLength(0)
    expect(useStore.getState().tasks[0].status).toBe('running')
    await act(async () => { fireEvent.click(screen.getByTestId('central-tab-chat-main')) })
    expect(screen.queryByTestId('composer-stop-button')).not.toBeNull()
  })

  it('does not send chat message on Shift+Enter and preserves draft', () => {
    render(<Workspace />)

    const input = screen.getByTestId('composer-input') as HTMLTextAreaElement
    fireEvent.change(input, { target: { value: 'Line 1' } })

    // Press Shift+Enter
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })

    // Message is NOT sent, draft is preserved
    expect(input.value).toBe('Line 1')
  })

  it('routes live task stdout to appendLog with task ID attribution and updates activeLogs', async () => {
    let capturedOnDataCb: ((data: string, meta?: { generation?: number }) => void) | undefined
    mockOnPtyData.mockImplementation((_sessionId: string, cb: (data: string, meta?: { generation?: number }) => void) => {
      capturedOnDataCb = cb
      return () => {}
    })

    useStore.setState({
      tasks: [{ ...sampleTask, status: 'running', model: 'claude-3-7-sonnet' }],
    })

    render(<Workspace />)

    await waitFor(() => {
      expect(capturedOnDataCb).toBeDefined()
    })

    // Emit live task stdout data
    act(() => {
      capturedOnDataCb?.('Task build step complete\r\n', { generation: 1 })
    })

    // Verify activeLogs contains the emitted line
    expect(useStore.getState().activeLogs).toContain('Task build step complete\r\n')
    const activeTask = useStore.getState().tasks.find(t => t.id === 'task-test-1')
    expect(activeTask?.logs).toContain('Task build step complete\r\n')
  })

  it('handles reconnect with generation and does not stall startup', async () => {
    const reconnectTaskId = 'task-reconnect-stall-test'
    const reconnectSessionId = `term-task-${reconnectTaskId}-0`

    const ptyDataCallbacks: Record<string, (data: string, meta?: { generation?: number }) => void> = {}
    mockOnPtyData.mockImplementation((sId: string, cb: (data: string, meta?: { generation?: number }) => void) => {
      ptyDataCallbacks[sId] = cb
      return () => {
        delete ptyDataCallbacks[sId]
      }
    })

    mockSpawnPty.mockResolvedValueOnce({
      success: true,
      reconnected: true,
      history: 'Agent shell reconnected\n',
      generation: 2,
    })

    useStore.setState({
      activeTaskId: reconnectTaskId,
      tasks: [{
        ...sampleTask,
        id: reconnectTaskId,
        status: 'running',
        model: 'claude-3-7-sonnet',
        worktreePath: '/tmp/worktree-reconnect-test',
        feed: [],
      }],
      activeFeed: [],
    })

    render(<Workspace />)

    await waitFor(() => {
      expect(mockSpawnPty).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: reconnectSessionId })
      )
    })

    // User sends a message via Composer while agent launch is in progress
    const input = screen.getByTestId('composer-input') as HTMLTextAreaElement
    fireEvent.change(input, { target: { value: 'Inspect project structure' } })
    const sendBtn = screen.getByTestId('composer-send-button')
    fireEvent.click(sendBtn)

    // Message is visible immediately in feed
    expect(within(screen.getByTestId('conversation-feed')).getByText('Inspect project structure')).not.toBeNull()

    // Wait for the startup timer (1200ms) to fire agent command without stalling
    await waitFor(() => {
      expect(mockWritePty).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: reconnectSessionId, data: "claude --model 'claude-3-7-sonnet'\n" })
      )
    }, { timeout: 3500 })

    // Simulate agent emitting readiness banner via onPtyData
    act(() => {
      ptyDataCallbacks[reconnectSessionId]?.('Welcome to Claude Code! Type /help for shortcuts\r\n> ', { generation: 2 })
    })

    // Verify that the queued message is successfully delivered to writePty
    await waitFor(() => {
      expect(mockWritePty).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: reconnectSessionId,
          data: 'Inspect project structure\r',
        })
      )
    })
  })

  it('isolates pending message queues between different tasks and prevents cross-task leakage', async () => {
    const taskAId = 'task-queue-isolation-a'
    const taskBId = 'task-queue-isolation-b'
    const sessionAId = `term-task-${taskAId}-0`
    const sessionBId = `term-task-${taskBId}-0`

    const ptyDataCallbacks: Record<string, (data: string, meta?: { generation?: number }) => void> = {}
    mockOnPtyData.mockImplementation((sId: string, cb: (data: string, meta?: { generation?: number }) => void) => {
      ptyDataCallbacks[sId] = cb
      return () => {
        delete ptyDataCallbacks[sId]
      }
    })

    const taskA: Task = {
      ...sampleTask,
      id: taskAId,
      name: 'Task A',
      status: 'running',
      model: 'claude-3-7-sonnet',
      feed: [],
    }

    const taskB: Task = {
      ...sampleTask,
      id: taskBId,
      name: 'Task B',
      status: 'running',
      model: 'claude-3-7-sonnet',
      feed: [],
    }

    useStore.setState({
      activeTaskId: taskAId,
      tasks: [taskA, taskB],
      activeFeed: [],
    })

    render(<Workspace />)

    // User types and queues a message in Task A before agent readiness
    const inputA = screen.getByTestId('composer-input') as HTMLTextAreaElement
    fireEvent.change(inputA, { target: { value: 'Secret Task A instruction' } })
    const sendBtnA = screen.getByTestId('composer-send-button')
    fireEvent.click(sendBtnA)

    // Wait until Task A spawn is initiated
    await waitFor(() => {
      expect(mockSpawnPty).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: sessionAId })
      )
    })

    // Switch active task to Task B
    act(() => {
      useStore.setState({
        activeTaskId: taskBId,
      })
    })

    // Wait until Task B spawn is initiated
    await waitFor(() => {
      expect(mockSpawnPty).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: sessionBId })
      )
    })

    // Simulate agent ready banner in Task B's session
    act(() => {
      ptyDataCallbacks[sessionBId]?.('Welcome to Claude Code! Type /help for shortcuts\r\n> ', { generation: 1 })
    })

    // Give potential queue delivery a moment to flush
    await new Promise((r) => setTimeout(r, 100))

    // Verify Task B session NEVER received Task A's queued message
    const callsForSessionB = mockWritePty.mock.calls.filter(
      ([arg]) => arg?.sessionId === sessionBId
    )
    const leakedMessage = callsForSessionB.some(
      ([arg]) => typeof arg?.data === 'string' && arg.data.includes('Secret Task A instruction')
    )
    expect(leakedMessage).toBe(false)
  })

  it('delivers queued messages on reconnect with active agent without re-sending launch commands', async () => {
    const reconnectTaskId = 'task-active-reconnect-test'
    const reconnectSessionId = `term-task-${reconnectTaskId}-0`

    mockSpawnPty.mockResolvedValueOnce({
      success: true,
      reconnected: true,
      history: 'Welcome to Claude Code\r\n> ? for shortcuts',
      generation: 1,
    })

    ;(window.ziafAPI.getActiveProcesses as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      processes: [{ pid: 9999, command: '/usr/local/bin/claude --repl' }],
    })

    useStore.setState({
      activeTaskId: reconnectTaskId,
      tasks: [{
        ...sampleTask,
        id: reconnectTaskId,
        status: 'running',
        model: 'claude-3-7-sonnet',
        worktreePath: '/tmp/worktree-active-reconnect',
        feed: [],
      }],
      activeFeed: [],
    })

    render(<Workspace />)

    // Queue a message immediately while mounting/reconnecting
    const input = screen.getByTestId('composer-input') as HTMLTextAreaElement
    fireEvent.change(input, { target: { value: 'Continue task execution' } })
    const sendBtn = screen.getByTestId('composer-send-button')
    fireEvent.click(sendBtn)

    // Message should be delivered via writePty once active agent process is verified
    await waitFor(() => {
      expect(mockWritePty).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: reconnectSessionId,
          data: 'Continue task execution\r',
        })
      )
    })

    // Crucial check: launch commands must NOT be sent since agent is already running
    const writePtyCalls = mockWritePty.mock.calls
    const hasLangExport = writePtyCalls.some(([arg]) => typeof arg?.data === 'string' && arg.data.includes('export LANG='))
    const hasClaudeLaunch = writePtyCalls.some(([arg]) => typeof arg?.data === 'string' && arg.data.trim() === 'claude')

    expect(hasLangExport).toBe(false)
    expect(hasClaudeLaunch).toBe(false)
  })

  it('kills a legacy PTY on close but retains the chat identity in task-scoped Recent', async () => {
    mockSpawnPty.mockResolvedValue({
      success: true,
      generation: 1,
    })

    useStore.setState({
      tasks: [{ ...sampleTask, status: 'running' }],
    })

    render(<Workspace />)

    // Open a new custom chat tab
    const newChatBtn = screen.getByTestId('btn-new-chat')
    fireEvent.click(newChatBtn)

    // Central tabs should now contain custom tab with a close button
    const customCloseBtn = await waitFor(() => {
      const btn = screen.getByTestId(/^close-tab-chat-\d+$/)
      expect(btn).not.toBeNull()
      return btn
    })

    const match = customCloseBtn.getAttribute('data-testid')?.match(/^close-tab-(chat-\d+)$/)
    const customTabId = match ? match[1] : ''
    expect(customTabId).toBeTruthy()

    // Click close button on the custom tab
    fireEvent.click(customCloseBtn)

    // killPty must be called with the custom tab sessionId
    await waitFor(() => {
      expect(mockKillPty).toHaveBeenCalledWith({ sessionId: customTabId })
    })

    // The custom tab should be removed from the DOM
    expect(screen.queryByTestId(`central-tab-${customTabId}`)).toBeNull()

    await waitFor(() => {
      const saved = vi.mocked(window.ziafAPI.saveChatHistory).mock.calls.at(-1)?.[0]
      expect(saved?.taskId).toBe(sampleTask.id)
      expect(saved?.centralTabs.some(tab => tab.id === customTabId)).toBe(false)
      expect(saved?.recentTabs?.some(tab => tab.id === customTabId)).toBe(true)
    })
  })

  it('prevents delivery to shell and does not assume readiness on negative liveness reconnect', async () => {
    const reconnectTaskId = 'task-neg-liveness-test'
    const reconnectSessionId = `term-task-${reconnectTaskId}-0`

    mockSpawnPty.mockResolvedValueOnce({
      success: true,
      reconnected: true,
      history: 'Exited agent shell\n',
      generation: 1,
    })

    // Empty process list: agent process died!
    ;(window.ziafAPI.getActiveProcesses as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      processes: [],
    })

    useStore.setState({
      activeTaskId: reconnectTaskId,
      tasks: [{
        ...sampleTask,
        id: reconnectTaskId,
        status: 'running',
        model: 'claude-3-7-sonnet',
        worktreePath: '/tmp/worktree-neg-liveness',
        feed: [],
      }],
      activeFeed: [],
    })

    render(<Workspace />)

    // Queue a message immediately
    const input = screen.getByTestId('composer-input') as HTMLTextAreaElement
    fireEvent.change(input, { target: { value: 'Do not deliver to bare shell' } })
    const sendBtn = screen.getByTestId('composer-send-button')
    fireEvent.click(sendBtn)

    // Wait a brief period to ensure getActiveProcesses resolves
    await new Promise((r) => setTimeout(r, 100))

    // Verify message was NOT delivered immediately to the bare shell
    expect(mockWritePty).not.toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: reconnectSessionId,
        data: 'Do not deliver to bare shell\r',
      })
    )

    // Instead, agent command re-launch timer fires (after 1200ms)
    await waitFor(() => {
      expect(mockWritePty).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: reconnectSessionId, data: "claude --model 'claude-3-7-sonnet'\n" })
      )
    }, { timeout: 3500 })
  })

  it('detects running Claude agent on reconnect even if selected provider is Antigravity', async () => {
    const crossTaskId = 'task-cross-provider-test'
    const crossSessionId = `term-task-${crossTaskId}-0`

    mockSpawnPty.mockResolvedValueOnce({
      success: true,
      reconnected: true,
      history: 'Welcome to Claude Code\r\n> ? for shortcuts',
      generation: 1,
    })

    // Process is Claude, but task model is Antigravity/GPT
    ;(window.ziafAPI.getActiveProcesses as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      processes: [{ pid: 5555, command: 'claude --repl' }],
    })

    useStore.setState({
      activeTaskId: crossTaskId,
      tasks: [{
        ...sampleTask,
        id: crossTaskId,
        status: 'running',
        model: 'gpt-6-astra', // Selected provider is agy
        worktreePath: '/tmp/worktree-cross-provider',
        feed: [],
      }],
      activeFeed: [],
    })

    render(<Workspace />)

    // Queue a message
    const input = screen.getByTestId('composer-input') as HTMLTextAreaElement
    fireEvent.change(input, { target: { value: 'Message for existing Claude process' } })
    const sendBtn = screen.getByTestId('composer-send-button')
    fireEvent.click(sendBtn)

    // Message is delivered to the existing Claude session
    await waitFor(() => {
      expect(mockWritePty).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: crossSessionId,
          data: 'Message for existing Claude process\r',
        })
      )
    })

    // Verify agy launch command was NOT sent into the live Claude session
    const writePtyCalls = mockWritePty.mock.calls
    const hasAgyLaunch = writePtyCalls.some(
      ([arg]) => typeof arg?.data === 'string' && arg.data.trim() === 'agy'
    )
    expect(hasAgyLaunch).toBe(false)
  })

  it('isolates queues during deferred spawn response when switching tasks', async () => {
    const taskAId = 'task-deferred-a'
    const taskBId = 'task-deferred-b'
    const sessionBId = `term-task-${taskBId}-0`

    let resolveSpawnB: (val: unknown) => void
    const spawnBPromise = new Promise((resolve) => {
      resolveSpawnB = resolve
    })

    mockSpawnPty.mockImplementation((opts: { sessionId: string }) => {
      if (opts.sessionId === sessionBId) {
        return spawnBPromise
      }
      return Promise.resolve({ success: true, generation: 1 })
    })

    const taskA: Task = {
      ...sampleTask,
      id: taskAId,
      name: 'Task A',
      status: 'running',
      model: 'claude-3-7-sonnet',
      feed: [],
    }

    const taskB: Task = {
      ...sampleTask,
      id: taskBId,
      name: 'Task B',
      status: 'running',
      model: 'claude-3-7-sonnet',
      feed: [],
    }

    useStore.setState({
      activeTaskId: taskAId,
      tasks: [taskA, taskB],
      activeFeed: [],
    })

    render(<Workspace />)

    // Queue message in Task A
    const input = screen.getByTestId('composer-input') as HTMLTextAreaElement
    fireEvent.change(input, { target: { value: 'Task A sensitive message' } })
    fireEvent.click(screen.getByTestId('composer-send-button'))

    // Switch to Task B while spawn for Task B is deferred
    act(() => {
      useStore.setState({ activeTaskId: taskBId })
    })

    // Give time to ensure no delivery pump routes Task A's message to Task B
    await new Promise((r) => setTimeout(r, 100))

    // Resolve spawn for Task B
    await act(async () => {
      resolveSpawnB({ success: true, generation: 2 })
    })

    // Verify session B never received Task A's sensitive message
    const callsForSessionB = mockWritePty.mock.calls.filter(
      ([arg]) => arg?.sessionId === sessionBId
    )
    const leaked = callsForSessionB.some(
      ([arg]) => typeof arg?.data === 'string' && arg.data.includes('Task A sensitive message')
    )
    expect(leaked).toBe(false)
  })

  it('correctly captures launchGen across task switch so agent launch timers are not aborted', async () => {
    const taskSwitchAId = 'task-sw-a'
    const taskSwitchBId = 'task-sw-b'
    const sessionBId = `term-task-${taskSwitchBId}-0`

    const taskA: Task = {
      ...sampleTask,
      id: taskSwitchAId,
      name: 'Task Switch A',
      status: 'idle',
      model: 'claude-3-7-sonnet',
      worktreePath: '/tmp/worktree-sw-a',
      feed: [],
    }

    const taskB: Task = {
      ...sampleTask,
      id: taskSwitchBId,
      name: 'Task Switch B',
      status: 'running',
      model: 'claude-3-7-sonnet',
      worktreePath: '/tmp/worktree-sw-b',
      feed: [],
    }

    useStore.setState({
      activeTaskId: taskSwitchAId,
      tasks: [taskA, taskB],
      activeFeed: [],
    })

    const { rerender } = render(<Workspace />)

    // Switch activeTaskId to Task B which is running
    await act(async () => {
      useStore.setState({ activeTaskId: taskSwitchBId })
      rerender(<Workspace />)
    })

    // Verify agent command is launched for Task B without being aborted by stale launchGen
    await waitFor(() => {
      expect(mockWritePty).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: sessionBId, data: "claude --model 'claude-3-7-sonnet'\n" })
      )
    }, { timeout: 3500 })
  })

  it('handles custom tab session reuse across different tasks without stalling agent launch', async () => {
    const taskAId = 'task-reuse-a'
    const taskBId = 'task-reuse-b'

    const taskA: Task = {
      ...sampleTask,
      id: taskAId,
      name: 'Task Reuse A',
      status: 'running',
      model: 'claude-3-7-sonnet',
      worktreePath: '/tmp/worktree-reuse-a',
      feed: [],
    }

    const taskB: Task = {
      ...sampleTask,
      id: taskBId,
      name: 'Task Reuse B',
      status: 'running',
      model: 'claude-3-7-sonnet',
      worktreePath: '/tmp/worktree-reuse-b',
      feed: [],
    }

    mockSpawnPty.mockResolvedValue({
      success: true,
      generation: 1,
    })

    useStore.setState({
      activeTaskId: taskAId,
      tasks: [taskA, taskB],
      activeFeed: [],
    })

    const { rerender } = render(<Workspace />)

    // Open a new custom chat tab for Task A
    const newChatBtn = screen.getByTestId('btn-new-chat')
    fireEvent.click(newChatBtn)

    const customCloseBtn = await waitFor(() => {
      const btn = screen.getByTestId(/^close-tab-chat-\d+$/)
      expect(btn).not.toBeNull()
      return btn
    })
    const match = customCloseBtn.getAttribute('data-testid')?.match(/^close-tab-(chat-\d+)$/)
    const customTabId = match ? match[1] : ''
    expect(customTabId).toBeTruthy()

    // Switch activeTaskId to Task B while keeping the same custom tab active
    await act(async () => {
      useStore.setState({ activeTaskId: taskBId })
      rerender(<Workspace />)
    })

    // Verify agent command is launched for Task B on customTabId without stalling
    await waitFor(() => {
      expect(mockWritePty).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: customTabId, data: "claude --model 'claude-3-7-sonnet'\n" })
      )
    }, { timeout: 3500 })
  })

  it('buffers delayed exit event from previous generation during spawn and prevents abortion of new generation', async () => {
    const taskId = 'task-delayed-exit-test'
    const sessionId = `term-task-${taskId}-0`

    let exitHandler: (payload: { exitCode: number, generation?: number }) => void = () => {}
    mockOnPtyExit.mockImplementation((sid: string, handler: (payload: { exitCode: number, generation?: number }) => void) => {
      if (sid === sessionId) {
        exitHandler = handler
      }
      return () => {}
    })

    let resolveSpawn: (val: unknown) => void
    const deferredSpawnPromise = new Promise((resolve) => {
      resolveSpawn = resolve
    })

    mockSpawnPty.mockImplementation((opts: { sessionId: string }) => {
      if (opts.sessionId === sessionId) {
        return deferredSpawnPromise
      }
      return Promise.resolve({ success: true, generation: 1 })
    })

    useStore.setState({
      activeTaskId: taskId,
      tasks: [{
        ...sampleTask,
        id: taskId,
        status: 'running',
        model: 'claude-3-7-sonnet',
        worktreePath: '/tmp/worktree-delayed-exit',
        feed: [],
      }],
      activeFeed: [],
    })

    render(<Workspace />)

    // While spawn is pending, a delayed exit event from old generation 1 arrives
    act(() => {
      exitHandler({ exitCode: 0, generation: 1 })
    })

    // Now resolve spawn with authoritative generation 2
    await act(async () => {
      resolveSpawn({ success: true, generation: 2 })
    })

    // Verify agent command launch succeeds and was not aborted by the delayed generation-1 exit
    await waitFor(() => {
      expect(mockWritePty).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId, data: "claude --model 'claude-3-7-sonnet'\n" })
      )
    }, { timeout: 3500 })
  })

  it('handles massive multiline logs without RangeError or stack overflow', () => {
    const taskId = 'task-large-logs'
    useStore.setState({
      activeTaskId: taskId,
      tasks: [{
        ...sampleTask,
        id: taskId,
        logs: [],
      }],
      activeLogs: [],
    })

    // 50,000 lines chunk
    const massiveChunk = new Array(50000).fill('line data').join('\n')
    expect(() => {
      useStore.getState().appendLog(massiveChunk, taskId)
    }).not.toThrow()

    const currentTask = useStore.getState().tasks.find(t => t.id === taskId)
    expect(currentTask?.logs.length).toBeLessThanOrEqual(2000)
  })

  it('spawns PTY for custom tab using recovered worktreePath fallback when task.worktreePath is undefined', async () => {
    const taskId = 'task-no-worktree'
    useStore.setState({
      activeTaskId: taskId,
      tasks: [{
        ...sampleTask,
        id: taskId,
        status: 'running',
        worktreePath: undefined,
      }],
      repositories: [{
        id: 'repo-1',
        name: 'Repo 1',
        path: '/mock/repo/project',
        repoPath: '/mock/repo/project',
        currentBranch: 'main',
        branches: ['main'],
      }],
      activeRepoId: 'repo-1',
      settings: {
        ...useStore.getState().settings!,
        useMockData: false,
      },
    })

    render(<Workspace />)

    const newChatBtn = screen.getByTestId('btn-new-chat')
    fireEvent.click(newChatBtn)

    await waitFor(() => {
      expect(mockSpawnPty).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: expect.stringMatching(/^chat-/),
          cwd: '/mock/repo/project/worktrees/task-no-worktree',
        })
      )
    })
  })

  it('always renders stdout telemetry bar on chat tabs and displays placeholder when logs are empty', async () => {
    useStore.setState({
      activeTaskId: 'task-test-1',
      tasks: [{
        ...sampleTask,
        id: 'task-test-1',
        status: 'running',
        worktreePath: '/tmp/worktree-task-1',
      }],
      activeLogs: [],
      settings: {
        ...useStore.getState().settings!,
        useMockData: false,
      },
    })

    render(<Workspace />)

    // Check main feed telemetry bar and placeholder text
    const telemetryBar = screen.getByTestId('stdout-telemetry-bar')
    expect(telemetryBar).not.toBeNull()
    expect(screen.getByText('Stdout telemetry stream')).not.toBeNull()
    expect(screen.getByText(/• 0 lines/i)).not.toBeNull()
    expect(screen.getByText('Ожидание вывода CLI интерфейса...')).not.toBeNull()

    // Switch to custom chat tab
    const newChatBtn = screen.getByTestId('btn-new-chat')
    fireEvent.click(newChatBtn)

    // Telemetry bar and placeholder still visible in custom chat tab
    expect(screen.getByTestId('stdout-telemetry-bar')).not.toBeNull()
    expect(screen.getByText('Ожидание вывода CLI интерфейса...')).not.toBeNull()
  })

  it('auto-starts idle task when sending message from custom tab and delivers user message', async () => {
    const taskId = 'task-idle-custom'
    const startTaskSpy = vi.fn().mockImplementation(async (id: string) => {
      useStore.setState(s => ({
        tasks: s.tasks.map(t => t.id === id ? { ...t, status: 'running' } : t)
      }))
      return { success: true, worktreePath: '/tmp/worktree-idle' }
    })

    useStore.setState({
      activeTaskId: taskId,
      tasks: [{
        ...sampleTask,
        id: taskId,
        status: 'idle',
        worktreePath: '/tmp/worktree-idle',
      }],
      startTask: startTaskSpy,
      settings: {
        ...useStore.getState().settings!,
        useMockData: false,
      },
    })

    render(<Workspace />)

    const newChatBtn = screen.getByTestId('btn-new-chat')
    fireEvent.click(newChatBtn)

    const textarea = screen.getByTestId('composer-input')
    fireEvent.change(textarea, { target: { value: 'привет из вкладки' } })

    const sendBtn = screen.getByTestId('composer-send-button')
    await act(async () => {
      fireEvent.click(sendBtn)
    })

    await waitFor(() => {
      expect(startTaskSpy).toHaveBeenCalledWith(taskId)
    })

    // Verify task transitioned to running in store
    expect(useStore.getState().tasks.find(t => t.id === taskId)?.status).toBe('running')

    // Verify user message appeared in feed
    await waitFor(() => {
      expect(screen.getByText('привет из вкладки')).not.toBeNull()
    })
  })

  it('displays error in custom tab when task auto-start fails and prevents message queuing', async () => {
    const taskId = 'task-fail-custom'
    const startTaskSpy = vi.fn().mockImplementation(async (id: string) => {
      useStore.setState(s => ({
        tasks: s.tasks.map(t => t.id === id ? { ...t, status: 'error' } : t)
      }))
      return { success: false, error: 'Git worktree branch missing' }
    })

    useStore.setState({
      activeTaskId: taskId,
      tasks: [{
        ...sampleTask,
        id: taskId,
        name: 'Failing Task',
        status: 'idle',
        worktreePath: '/tmp/worktree-failing',
      }],
      startTask: startTaskSpy,
      settings: {
        ...useStore.getState().settings!,
        useMockData: false,
      },
    })

    render(<Workspace />)

    const newChatBtn = screen.getByTestId('btn-new-chat')
    fireEvent.click(newChatBtn)

    const textarea = screen.getByTestId('composer-input')
    fireEvent.change(textarea, { target: { value: 'запуск должен упасть' } })

    const sendBtn = screen.getByTestId('composer-send-button')
    await act(async () => {
      fireEvent.click(sendBtn)
    })

    await waitFor(() => {
      expect(startTaskSpy).toHaveBeenCalledWith(taskId)
    })

    // Custom tab displays error message badge
    await waitFor(() => {
      expect(screen.getAllByText(/⚠️ Не удалось запустить задачу "Failing Task"/i).length).toBeGreaterThanOrEqual(1)
    })

    // The message was NOT sent to PTY
    expect(mockWritePty).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.stringContaining('запуск должен упасть')
      })
    )

    // Draft is PRESERVED in Composer for user retry
    expect((textarea as HTMLTextAreaElement).value).toBe('запуск должен упасть')
  })

  it('delivers prompt when task running-status event arrives before startTask resolves', async () => {
    const taskId = 'task-race-status'
    const ptyDataCallbacks: Record<string, (data: string, meta?: { generation?: number }) => void> = {}
    mockOnPtyData.mockImplementation((sId: string, cb: (data: string, meta?: { generation?: number }) => void) => {
      ptyDataCallbacks[sId] = cb
      return () => {
        delete ptyDataCallbacks[sId]
      }
    })

    const startTaskSpy = vi.fn().mockImplementation(async (id: string) => {
      // Simulate running status arriving before startTask promise resolves
      useStore.setState(s => ({
        tasks: s.tasks.map(t => t.id === id ? { ...t, status: 'running' } : t)
      }))
      await new Promise(r => setTimeout(r, 10))
      return { success: true, worktreePath: '/tmp/worktree-race' }
    })

    useStore.setState({
      activeTaskId: taskId,
      tasks: [{
        ...sampleTask,
        id: taskId,
        status: 'idle',
        worktreePath: '/tmp/worktree-race',
      }],
      startTask: startTaskSpy,
      settings: {
        ...useStore.getState().settings!,
        useMockData: false,
      },
    })

    render(<Workspace />)

    const newChatBtn = screen.getByTestId('btn-new-chat')
    fireEvent.click(newChatBtn)

    const textarea = screen.getByTestId('composer-input')
    fireEvent.change(textarea, { target: { value: 'быстрый старт' } })

    const sendBtn = screen.getByTestId('composer-send-button')
    await act(async () => {
      fireEvent.click(sendBtn)
    })

    await waitFor(() => {
      expect(startTaskSpy).toHaveBeenCalledWith(taskId)
    })

    // Verify prompt is NOT dropped and appears in the custom tab feed
    await waitFor(() => {
      expect(screen.getByText('быстрый старт')).not.toBeNull()
    })

    // Simulate agent readiness on the custom tab PTY
    await waitFor(() => {
      const customSessionId = Object.keys(ptyDataCallbacks).find(k => k.startsWith('chat-'))
      expect(customSessionId).toBeDefined()
    })
    const customSessionId = Object.keys(ptyDataCallbacks).find(k => k.startsWith('chat-'))!
    act(() => {
      ptyDataCallbacks[customSessionId]?.('Welcome to Claude Code!\r\n> ')
    })

    // Verify prompt write to PTY occurred
    await waitFor(() => {
      expect(mockWritePty).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: customSessionId,
          data: expect.stringContaining('быстрый старт')
        })
      )
    })
  })

  it('aborts custom tab prompt delivery if user switches tabs while startTask is pending', async () => {
    const taskId = 'task-tab-switch'
    let resolveStartup: (() => void) | null = null
    const startTaskSpy = vi.fn().mockImplementation(() => {
      return new Promise<{ success: boolean; worktreePath: string }>((resolve) => {
        resolveStartup = () => {
          useStore.setState(s => ({
            tasks: s.tasks.map(t => t.id === taskId ? { ...t, status: 'running' } : t)
          }))
          resolve({ success: true, worktreePath: '/tmp/worktree-switch' })
        }
      })
    })

    useStore.setState({
      activeTaskId: taskId,
      tasks: [{
        ...sampleTask,
        id: taskId,
        status: 'idle',
        worktreePath: '/tmp/worktree-switch',
      }],
      startTask: startTaskSpy,
      settings: {
        ...useStore.getState().settings!,
        useMockData: false,
      },
    })

    render(<Workspace />)

    const newChatBtn = screen.getByTestId('btn-new-chat')
    fireEvent.click(newChatBtn)
    const originalTabTestId = screen.getByTestId(/^central-tab-chat-\d+$/).getAttribute('data-testid')!

    const textarea = screen.getByTestId('composer-input')
    fireEvent.change(textarea, { target: { value: 'сообщение до переключения' } })

    const sendBtn = screen.getByTestId('composer-send-button')
    // Click send, initiating asynchronous startTask
    act(() => {
      fireEvent.click(sendBtn)
    })

    expect(startTaskSpy).toHaveBeenCalledWith(taskId)

    // User switches back to main feed tab while startTask is still pending
    const mainTabBtn = screen.getByText('Discussion Feed')
    fireEvent.click(mainTabBtn)
    expect((screen.getByTestId('composer-input') as HTMLTextAreaElement).value).toBe('')

    // Now complete the startup
    await act(async () => {
      resolveStartup?.()
    })

    // Verify the message was aborted and not sent
    expect(mockWritePty).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.stringContaining('сообщение до переключения')
      })
    )
    // The late startup result must not copy the original draft into the new view.
    expect((screen.getByTestId('composer-input') as HTMLTextAreaElement).value).toBe('')
    fireEvent.click(screen.getByTestId(originalTabTestId))
    // Returning to its owner restores the unsent draft without submitting it.
    expect((screen.getByTestId('composer-input') as HTMLTextAreaElement).value).toBe('сообщение до переключения')
    expect(mockWritePty).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.stringContaining('сообщение до переключения') }))
  })

  it('aborts custom tab prompt delivery and retains draft when execution is stopped during startTask', async () => {
    const taskId = 'task-stop-during-start'
    let resolveStartup: (() => void) | null = null
    const startTaskSpy = vi.fn().mockImplementation(() => {
      return new Promise<{ success: boolean; worktreePath: string }>((resolve) => {
        // Early running status update before startup completes
        useStore.setState(s => ({
          tasks: s.tasks.map(t => t.id === taskId ? { ...t, status: 'running' } : t)
        }))
        resolveStartup = () => {
          resolve({ success: true, worktreePath: '/tmp/worktree-stop' })
        }
      })
    })

    useStore.setState({
      activeTaskId: taskId,
      tasks: [{
        ...sampleTask,
        id: taskId,
        status: 'idle',
        worktreePath: '/tmp/worktree-stop',
      }],
      startTask: startTaskSpy,
      settings: {
        ...useStore.getState().settings!,
        useMockData: false,
      },
    })

    render(<Workspace />)

    const newChatBtn = screen.getByTestId('btn-new-chat')
    fireEvent.click(newChatBtn)

    const textarea = screen.getByTestId('composer-input')
    fireEvent.change(textarea, { target: { value: 'запрос остановки' } })

    const sendBtn = screen.getByTestId('composer-send-button')
    act(() => {
      fireEvent.click(sendBtn)
    })

    expect(startTaskSpy).toHaveBeenCalledWith(taskId)

    // No generation yet. Termination remains available in the active task chip.
    expect(screen.queryByTestId('composer-stop-button')).toBeNull()
    const stopBtn = within(screen.getByTestId('active-processes-toolbar')).getByRole('button', { name: 'Остановить' })
    await act(async () => {
      fireEvent.click(stopBtn)
    })

    // Complete startTask resolution
    await act(async () => {
      resolveStartup?.()
    })

    // Prompt must NOT be written to PTY
    expect(mockWritePty).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.stringContaining('запрос остановки')
      })
    )
    // Prompt must NOT be added to feed
    expect(within(screen.getByTestId('conversation-feed')).queryByText('запрос остановки')).toBeNull()
    // Draft retained in Composer
    expect((screen.getByTestId('composer-input') as HTMLTextAreaElement).value).toBe('запрос остановки')
  })

  it('aborts main-feed prompt delivery and invalidates pending input when switching tabs while startTask is pending', async () => {
    const taskId = 'task-main-feed-nav'
    let resolveStartup: (() => void) | null = null
    const startTaskSpy = vi.fn().mockImplementation(() => {
      return new Promise<{ success: boolean; worktreePath: string }>((resolve) => {
        resolveStartup = () => {
          useStore.setState(s => ({
            tasks: s.tasks.map(t => t.id === taskId ? { ...t, status: 'running' } : t)
          }))
          resolve({ success: true, worktreePath: '/tmp/worktree-main-nav' })
        }
      })
    })

    const ptyDataCallbacks: Record<string, (data: string, meta?: { generation?: number }) => void> = {}
    mockOnPtyData.mockImplementation((sId: string, cb: (data: string, meta?: { generation?: number }) => void) => {
      ptyDataCallbacks[sId] = cb
      return () => {
        delete ptyDataCallbacks[sId]
      }
    })

    useStore.setState({
      activeTaskId: taskId,
      tasks: [{
        ...sampleTask,
        id: taskId,
        status: 'idle',
        worktreePath: '/tmp/worktree-main-nav',
        feed: [],
      }],
      activeFeed: [],
      startTask: startTaskSpy,
      settings: {
        ...useStore.getState().settings!,
        useMockData: false,
      },
    })

    render(<Workspace />)

    // User is on Discussion Feed (main feed)
    const textarea = screen.getByTestId('composer-input')
    fireEvent.change(textarea, { target: { value: 'основной промпт до смены вкладки' } })

    const sendBtn = screen.getByTestId('composer-send-button')
    act(() => {
      fireEvent.click(sendBtn)
    })

    expect(startTaskSpy).toHaveBeenCalledWith(taskId)

    // User opens a new custom chat tab while startup is pending
    const newChatBtn = screen.getByTestId('btn-new-chat')
    fireEvent.click(newChatBtn)
    expect((screen.getByTestId('composer-input') as HTMLTextAreaElement).value).toBe('')

    // Resolve startup
    await act(async () => {
      resolveStartup?.()
    })

    // Simulate agent emitting readiness on the main task session
    const taskSessionId = `term-task-${taskId}-0`
    act(() => {
      ptyDataCallbacks[taskSessionId]?.('Welcome to Claude Code!\r\n> ')
    })

    // Delivery pump must NOT write the aborted main feed prompt
    expect(mockWritePty).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.stringContaining('основной промпт до смены вкладки')
      })
    )
    // The new chat has its own empty draft, including after the late startup ACK.
    expect((screen.getByTestId('composer-input') as HTMLTextAreaElement).value).toBe('')
    fireEvent.click(screen.getByTestId('central-tab-chat-main'))
    // The original main-chat draft remains available when explicitly returning.
    expect((screen.getByTestId('composer-input') as HTMLTextAreaElement).value).toBe('основной промпт до смены вкладки')
    expect(mockWritePty).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.stringContaining('основной промпт до смены вкладки') }))
  })

  it('right panel terminal uses resolved CWD fallback when task.worktreePath is undefined and verifies TerminalPane output', async () => {
    const taskId = 'task-term-fallback'
    useStore.setState({
      rightPanelTab: 'terminal',
      activeTaskId: taskId,
      tasks: [{
        ...sampleTask,
        id: taskId,
        status: 'running',
        worktreePath: undefined,
      }],
      repositories: [{
        id: 'repo-1',
        name: 'Repo 1',
        path: '/mock/repo/project',
        repoPath: '/mock/repo/project',
        currentBranch: 'main',
        branches: ['main'],
      }],
      activeRepoId: 'repo-1',
      settings: {
        ...useStore.getState().settings!,
        useMockData: false,
      },
    })

    render(<Workspace />)

    // Verify TerminalPane container is rendered in DOM
    const terminalContainer = screen.getByTestId('terminal-container')
    expect(terminalContainer).not.toBeNull()

    // Auxiliary terminal PTY manager and TerminalPane spawn with recovered fallback path
    await waitFor(() => {
      expect(mockSpawnPty).toHaveBeenCalledWith(
        expect.objectContaining({
          cwd: '/mock/repo/project/worktrees/task-term-fallback',
        })
      )
    })

    // Assert TerminalPane did NOT write idle message
    const idleCalls = mockTerminalInstances.flatMap(inst =>
      inst.write.mock.calls.filter((call: unknown[]) => String(call[0]).includes('Terminal is idle'))
    )
    expect(idleCalls).toHaveLength(0)
  })

  it('closing a custom tab does not stall or cancel main feed pump and message delivery', async () => {
    const taskId = 'task-close-custom-isolate'
    const ptyDataCallbacks: Record<string, (data: string, meta?: { generation?: number }) => void> = {}
    mockOnPtyData.mockImplementation((sId: string, cb: (data: string, meta?: { generation?: number }) => void) => {
      ptyDataCallbacks[sId] = cb
      return () => {
        delete ptyDataCallbacks[sId]
      }
    })

    useStore.setState({
      activeTaskId: taskId,
      tasks: [{
        ...sampleTask,
        id: taskId,
        status: 'running',
        worktreePath: '/tmp/worktree-custom-isolate',
        feed: [],
      }],
      activeFeed: [],
      settings: {
        ...useStore.getState().settings!,
        useMockData: false,
      },
    })

    render(<Workspace />)

    // Open a new custom chat tab
    const newChatBtn = screen.getByTestId('btn-new-chat')
    act(() => {
      fireEvent.click(newChatBtn)
    })

    // Find the close button of the newly opened custom chat tab and close it
    const closeBtn = screen.getByTestId(/^close-tab-chat-\d+/)
    act(() => {
      fireEvent.click(closeBtn)
    })

    // Main feed is active again. Simulate agent readiness in main task session.
    const taskSessionId = `term-task-${taskId}-0`
    act(() => {
      ptyDataCallbacks[taskSessionId]?.('Welcome to Claude Code!\r\n> ')
    })

    // Send a message in the main feed
    const textarea = screen.getByTestId('composer-input')
    fireEvent.change(textarea, { target: { value: 'сообщение в основном фиде после закрытия вкладки' } })
    const sendBtn = screen.getByTestId('composer-send-button')
    await act(async () => {
      fireEvent.click(sendBtn)
    })

    // Verify main feed message is successfully delivered to PTY
    await waitFor(() => {
      expect(mockWritePty).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: taskSessionId,
          data: expect.stringContaining('сообщение в основном фиде после закрытия вкладки')
        })
      )
    })
  })

  it('sending a message after Stop execution succeeds and does not falsely cancel', async () => {
    const taskId = 'task-stop-then-send'
    const ptyDataCallbacks: Record<string, (data: string, meta?: { generation?: number }) => void> = {}
    mockOnPtyData.mockImplementation((sId: string, cb: (data: string, meta?: { generation?: number }) => void) => {
      ptyDataCallbacks[sId] = cb
      return () => {
        delete ptyDataCallbacks[sId]
      }
    })

    useStore.setState({
      activeTaskId: taskId,
      tasks: [{
        ...sampleTask,
        id: taskId,
        status: 'running',
        worktreePath: '/tmp/worktree-stop-send',
        feed: [],
      }],
      activeFeed: [],
      settings: {
        ...useStore.getState().settings!,
        useMockData: false,
      },
    })

    render(<Workspace />)

    const taskSessionId = `term-task-${taskId}-0`

    await act(async () => {})
    await act(async () => {
      ptyDataCallbacks[taskSessionId]?.('Welcome to Claude Code!\r\n> ')
    })
    expect(screen.queryByTestId('composer-stop-button')).toBeNull()
    fireEvent.change(screen.getByTestId('composer-input'), { target: { value: 'долгая генерация' } })
    await act(async () => { fireEvent.click(screen.getByTestId('composer-send-button')) })
    await act(async () => { ptyDataCallbacks[taskSessionId]?.('\r\n⣾ Generating... (esc to cancel)\r\n') })
    await act(async () => { fireEvent.click(screen.getByTestId('composer-stop-button')) })
    expect(mockWritePty).toHaveBeenCalledWith({ sessionId: taskSessionId, data: '\x03' })
    expect(mockKillPty).not.toHaveBeenCalled()
    await act(async () => {
      ptyDataCallbacks[taskSessionId]?.('Cancelled\r\n> ')
    })
    expect(screen.queryByTestId('composer-stop-button')).toBeNull()

    // Now send a new message
    const textarea = screen.getByTestId('composer-input')
    fireEvent.change(textarea, { target: { value: 'новое сообщение после остановки' } })
    const sendBtn = screen.getByTestId('composer-send-button')

    await act(async () => {
      fireEvent.click(sendBtn)
    })

    // The message should be successfully delivered without being blocked by previous stop
    await waitFor(() => {
      expect(mockWritePty).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: taskSessionId,
          data: expect.stringContaining('новое сообщение после остановки')
        })
      )
    })
  })

  it('switching tabs preserves already accepted messages in queue for running task', async () => {
    const taskId = 'task-preserve-queue-tab'
    const ptyDataCallbacks: Record<string, (data: string, meta?: { generation?: number }) => void> = {}
    mockOnPtyData.mockImplementation((sId: string, cb: (data: string, meta?: { generation?: number }) => void) => {
      ptyDataCallbacks[sId] = cb
      return () => {
        delete ptyDataCallbacks[sId]
      }
    })

    useStore.setState({
      activeTaskId: taskId,
      tasks: [{
        ...sampleTask,
        id: taskId,
        status: 'running',
        worktreePath: '/tmp/worktree-preserve-queue',
        feed: [],
      }],
      activeFeed: [],
      settings: {
        ...useStore.getState().settings!,
        useMockData: false,
      },
    })

    render(<Workspace />)

    const taskSessionId = `term-task-${taskId}-0`

    // Task is running, but agent has not emitted prompt yet (still booting)
    const textarea = screen.getByTestId('composer-input')
    fireEvent.change(textarea, { target: { value: 'принятое сообщение перед сменой таба' } })
    const sendBtn = screen.getByTestId('composer-send-button')

    await act(async () => {
      fireEvent.click(sendBtn)
    })

    // User switches to a new chat tab while message is queued
    const newChatBtn = screen.getByTestId('btn-new-chat')
    act(() => {
      fireEvent.click(newChatBtn)
    })

    // User switches back to main discussion feed
    const mainTab = screen.getByText('Discussion Feed')
    act(() => {
      fireEvent.click(mainTab)
    })

    // Agent in main task session finally becomes ready
    act(() => {
      ptyDataCallbacks[taskSessionId]?.('Welcome to Claude Code!\r\n> ')
    })

    // Queued message MUST be delivered to PTY and not lost
    await waitFor(() => {
      expect(mockWritePty).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: taskSessionId,
          data: expect.stringContaining('принятое сообщение перед сменой таба')
        })
      )
    })
  })

  it('clicking the already active tab does not abort pending send', async () => {
    const taskId = 'task-click-active-tab'
    const ptyDataCallbacks: Record<string, (data: string, meta?: { generation?: number }) => void> = {}
    mockOnPtyData.mockImplementation((sId: string, cb: (data: string, meta?: { generation?: number }) => void) => {
      ptyDataCallbacks[sId] = cb
      return () => {
        delete ptyDataCallbacks[sId]
      }
    })

    useStore.setState({
      activeTaskId: taskId,
      tasks: [{
        ...sampleTask,
        id: taskId,
        status: 'running',
        worktreePath: '/tmp/worktree-click-active',
        feed: [],
      }],
      activeFeed: [],
      settings: {
        ...useStore.getState().settings!,
        useMockData: false,
      },
    })

    render(<Workspace />)

    const taskSessionId = `term-task-${taskId}-0`

    const textarea = screen.getByTestId('composer-input')
    fireEvent.change(textarea, { target: { value: 'промпт при клике по активной вкладке' } })
    const sendBtn = screen.getByTestId('composer-send-button')

    await act(async () => {
      fireEvent.click(sendBtn)
    })

    // Click the ALREADY active discussion feed tab
    const mainTab = screen.getByText('Discussion Feed')
    act(() => {
      fireEvent.click(mainTab)
    })

    // Agent becomes ready
    act(() => {
      ptyDataCallbacks[taskSessionId]?.('Welcome to Claude Code!\r\n> ')
    })

    // Message must be successfully delivered
    await waitFor(() => {
      expect(mockWritePty).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: taskSessionId,
          data: expect.stringContaining('промпт при клике по активной вкладке')
        })
      )
    })
  })

  it('stale startTask rejection does not overwrite running status of newer task session', async () => {
    const taskId = 'task-stale-rejection'
    let rejectOldStart: ((reason?: unknown) => void) | undefined
    const oldPromise = new Promise((_, reject) => {
      rejectOldStart = reject
    })

    const mockApi = window.ziafAPI as unknown as Record<string, ReturnType<typeof vi.fn>>
    mockApi.startTask = vi.fn().mockImplementationOnce(() => oldPromise)

    useStore.setState({
      activeTaskId: taskId,
      tasks: [{
        ...sampleTask,
        id: taskId,
        status: 'idle',
        feed: [],
      }],
      settings: {
        ...useStore.getState().settings!,
        useMockData: false,
      },
    })

    // Initiate first startTask
    const firstStartPromise = useStore.getState().startTask(taskId)

    // User stops first execution (invalidating token) and restarts
    useStore.getState().updateTaskStatus(taskId, 'idle')
    useStore.getState().updateTaskStatus(taskId, 'running')

    // Old in-flight IPC promise rejects
    rejectOldStart?.(new Error('Old IPC network timeout'))
    await firstStartPromise

    // Task status MUST remain 'running' and not revert to 'error'
    const currentTask = useStore.getState().tasks.find(t => t.id === taskId)
    expect(currentTask?.status).toBe('running')
    // No error feed item appended
    const errorFeedItems = currentTask?.feed.filter(f => f.text?.includes('Old IPC network timeout')) || []
    expect(errorFeedItems).toHaveLength(0)
  })

  it('does not lose accepted first prompt when user switches tabs after startTask succeeds while agent is booting', async () => {
    const taskId = 'task-idle-switch-after-start'
    const ptyDataCallbacks: Record<string, (data: string, meta?: { generation?: number }) => void> = {}
    mockOnPtyData.mockImplementation((sId: string, cb: (data: string, meta?: { generation?: number }) => void) => {
      ptyDataCallbacks[sId] = cb
      return () => {
        delete ptyDataCallbacks[sId]
      }
    })

    const startTaskSpy = vi.fn().mockImplementation(async (id: string) => {
      useStore.setState(s => ({
        tasks: s.tasks.map(t => t.id === id ? { ...t, status: 'running' } : t)
      }))
      return { success: true, worktreePath: '/tmp/worktree-switch-after-start' }
    })

    useStore.setState({
      activeTaskId: taskId,
      tasks: [{
        ...sampleTask,
        id: taskId,
        status: 'idle',
        worktreePath: '/tmp/worktree-switch-after-start',
        feed: [],
      }],
      activeFeed: [],
      startTask: startTaskSpy,
      settings: {
        ...useStore.getState().settings!,
        useMockData: false,
      },
    })

    render(<Workspace />)

    const textarea = screen.getByTestId('composer-input')
    fireEvent.change(textarea, { target: { value: 'первый промпт до смены вкладки' } })
    const sendBtn = screen.getByTestId('composer-send-button')

    await act(async () => {
      fireEvent.click(sendBtn)
    })

    expect(startTaskSpy).toHaveBeenCalledWith(taskId)

    // User switches to a new chat tab AFTER startTask has completed, while agent is still booting
    const newChatBtn = screen.getByTestId('btn-new-chat')
    act(() => {
      fireEvent.click(newChatBtn)
    })

    // Main task agent now finishes booting and emits readiness prompt
    const taskSessionId = `term-task-${taskId}-0`
    act(() => {
      ptyDataCallbacks[taskSessionId]?.('Welcome to Claude Code!\r\n> ')
    })

    // The first prompt MUST be delivered to PTY even though tab was switched!
    await waitFor(() => {
      expect(mockWritePty).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: taskSessionId,
          data: expect.stringContaining('первый промпт до смены вкладки')
        })
      )
    })
  })

  it('does not rollback or duplicate message if agent delivers prompt before startTask resolves and tab is switched', async () => {
    const taskId = 'task-fast-delivery-tab-switch'
    const ptyDataCallbacks: Record<string, (data: string, meta?: { generation?: number }) => void> = {}
    mockOnPtyData.mockImplementation((sId: string, cb: (data: string, meta?: { generation?: number }) => void) => {
      ptyDataCallbacks[sId] = cb
      return () => {
        delete ptyDataCallbacks[sId]
      }
    })

    const taskSessionId = `term-task-${taskId}-0`
    let resolveStartup: (() => void) | null = null
    const startTaskSpy = vi.fn().mockImplementation(() => {
      return new Promise<{ success: boolean; worktreePath: string }>((resolve) => {
        useStore.setState(s => ({
          tasks: s.tasks.map(t => t.id === taskId ? { ...t, status: 'running' } : t)
        }))
        resolveStartup = () => {
          resolve({ success: true, worktreePath: '/tmp/worktree-fast-delivery' })
        }
      })
    })

    useStore.setState({
      activeTaskId: taskId,
      tasks: [{
        ...sampleTask,
        id: taskId,
        status: 'idle',
        worktreePath: '/tmp/worktree-fast-delivery',
        feed: [],
      }],
      activeFeed: [],
      startTask: startTaskSpy,
      settings: {
        ...useStore.getState().settings!,
        useMockData: false,
      },
    })

    render(<Workspace />)

    const textarea = screen.getByTestId('composer-input')
    fireEvent.change(textarea, { target: { value: 'быстрая доставка до разрешения startTask' } })
    const sendBtn = screen.getByTestId('composer-send-button')

    act(() => {
      fireEvent.click(sendBtn)
    })

    expect(startTaskSpy).toHaveBeenCalledWith(taskId)

    // Wait for the PTY listener to be registered in Workspace for the running task
    await waitFor(() => {
      expect(ptyDataCallbacks[taskSessionId]).toBeDefined()
    })

    // Agent emits readiness while startTask is still pending!
    act(() => {
      ptyDataCallbacks[taskSessionId]?.('Welcome to Claude Code!\r\n> ')
    })

    // Verify message was delivered to PTY
    await waitFor(() => {
      expect(mockWritePty).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: taskSessionId,
          data: expect.stringContaining('быстрая доставка до разрешения startTask')
        })
      )
    })

    // User switches to another tab
    const newChatBtn = screen.getByTestId('btn-new-chat')
    act(() => {
      fireEvent.click(newChatBtn)
    })

    // Now resolve startTask
    await act(async () => {
      resolveStartup?.()
    })

    // Task feed should still contain the delivered message, not rolled back
    const currentTask = useStore.getState().tasks.find(t => t.id === taskId)
    expect(currentTask?.feed.some(item => item.text === 'быстрая доставка до разрешения startTask')).toBe(true)
  })

  it('prevents first prompt duplication when writePty response is delayed and startTask completes', async () => {
    const taskId = 'task-writepty-delayed-dup'
    const ptyDataCallbacks: Record<string, (data: string, meta?: { generation?: number }) => void> = {}
    mockOnPtyData.mockImplementation((sId: string, cb: (data: string, meta?: { generation?: number }) => void) => {
      ptyDataCallbacks[sId] = cb
      return () => {
        delete ptyDataCallbacks[sId]
      }
    })

    let resolvePtyWrite: (() => void) | null = null
    mockWritePty.mockImplementation(() => {
      return new Promise<{ success: boolean }>((resolve) => {
        resolvePtyWrite = () => resolve({ success: true })
      })
    })

    const taskSessionId = `term-task-${taskId}-0`
    let resolveStartup: (() => void) | null = null
    const startTaskSpy = vi.fn().mockImplementation(() => {
      return new Promise<{ success: boolean; worktreePath: string }>((resolve) => {
        useStore.setState(s => ({
          tasks: s.tasks.map(t => t.id === taskId ? { ...t, status: 'running' } : t)
        }))
        resolveStartup = () => {
          resolve({ success: true, worktreePath: '/tmp/worktree-delayed-dup' })
        }
      })
    })

    useStore.setState({
      activeTaskId: taskId,
      tasks: [{
        ...sampleTask,
        id: taskId,
        status: 'idle',
        worktreePath: '/tmp/worktree-delayed-dup',
        feed: [],
      }],
      activeFeed: [],
      startTask: startTaskSpy,
      settings: {
        ...useStore.getState().settings!,
        useMockData: false,
      },
    })

    render(<Workspace />)

    const textarea = screen.getByTestId('composer-input')
    fireEvent.change(textarea, { target: { value: 'промпт без дублирования' } })
    const sendBtn = screen.getByTestId('composer-send-button')

    act(() => {
      fireEvent.click(sendBtn)
    })

    expect(startTaskSpy).toHaveBeenCalledWith(taskId)

    // Wait for PTY listener to be registered
    await waitFor(() => {
      expect(ptyDataCallbacks[taskSessionId]).toBeDefined()
    })

    // Agent emits readiness while startTask is pending
    act(() => {
      ptyDataCallbacks[taskSessionId]?.('Welcome to Claude Code!\r\n> ')
    })

    // Delivery pump initiated writePty (which is currently pending)
    await waitFor(() => {
      expect(mockWritePty).toHaveBeenCalledTimes(1)
    })

    // startTask finishes while writePty is still awaiting!
    act(() => {
      resolveStartup?.()
    })

    // Now writePty finishes
    await act(async () => {
      resolvePtyWrite?.()
    })

    // Give pump any time to process subsequent messages if any
    await new Promise(r => setTimeout(r, 50))

    // mockWritePty MUST be called EXACTLY ONCE for this prompt, never duplicated!
    const writeCalls = mockWritePty.mock.calls.filter((call: unknown[]) =>
      String((call[0] as { data?: string })?.data || '').includes('промпт без дублирования')
    )
    expect(writeCalls).toHaveLength(1)
  })

  it('does not treat failed auto-start as delivered when a previous prompt was delivered on the same session', async () => {
    const taskId = 'task-prev-delivered-isolation'
    const ptyDataCallbacks: Record<string, (data: string, meta?: { generation?: number }) => void> = {}
    mockOnPtyData.mockImplementation((sId: string, cb: (data: string, meta?: { generation?: number }) => void) => {
      ptyDataCallbacks[sId] = cb
      return () => {
        delete ptyDataCallbacks[sId]
      }
    })

    const taskSessionId = `term-task-${taskId}-0`
    let shouldStartFail = false
    const startTaskSpy = vi.fn().mockImplementation(async (id: string) => {
      if (shouldStartFail) {
        throw new Error('Process exited with code 1')
      }
      useStore.setState(s => ({
        tasks: s.tasks.map(t => t.id === id ? { ...t, status: 'running' } : t)
      }))
      return { success: true, worktreePath: '/tmp/worktree-isolate' }
    })

    useStore.setState({
      activeTaskId: taskId,
      tasks: [{
        ...sampleTask,
        id: taskId,
        status: 'idle',
        worktreePath: '/tmp/worktree-isolate',
        feed: [],
      }],
      activeFeed: [],
      startTask: startTaskSpy,
      settings: {
        ...useStore.getState().settings!,
        useMockData: false,
      },
    })

    render(<Workspace />)

    // Message 1 is sent and delivered successfully
    const textarea = screen.getByTestId('composer-input')
    fireEvent.change(textarea, { target: { value: 'первое успешное сообщение' } })
    const sendBtn = screen.getByTestId('composer-send-button')

    await act(async () => {
      fireEvent.click(sendBtn)
    })

    await waitFor(() => {
      expect(ptyDataCallbacks[taskSessionId]).toBeDefined()
    })

    act(() => {
      ptyDataCallbacks[taskSessionId]?.('Welcome to Claude Code!\r\n> ')
    })

    await waitFor(() => {
      expect(mockWritePty).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: taskSessionId,
          data: expect.stringContaining('первое успешное сообщение')
        })
      )
    })

    // Task finishes and goes to idle
    act(() => {
      useStore.getState().updateTaskStatus(taskId, 'idle')
    })

    // Now send Message 2, but this time startTask fails!
    shouldStartFail = true
    fireEvent.change(textarea, { target: { value: 'второе сообщение должно упасть' } })

    await act(async () => {
      fireEvent.click(sendBtn)
    })

    // Message 2 must NOT be treated as delivered! Draft must be retained in Composer!
    expect((screen.getByTestId('composer-input') as HTMLTextAreaElement).value).toBe('второе сообщение должно упасть')

    // Message 2 must NOT be in the task feed
    const currentTask = useStore.getState().tasks.find(t => t.id === taskId)
    expect(currentTask?.feed.some(item => item.text === 'второе сообщение должно упасть')).toBe(false)
  })

  it('does not rollback already delivered prompt when Stop occurs before startTask completes', async () => {
    const taskId = 'task-stop-after-delivery'
    const ptyDataCallbacks: Record<string, (data: string, meta?: { generation?: number }) => void> = {}
    mockOnPtyData.mockImplementation((sId: string, cb: (data: string, meta?: { generation?: number }) => void) => {
      ptyDataCallbacks[sId] = cb
      return () => {
        delete ptyDataCallbacks[sId]
      }
    })

    const taskSessionId = `term-task-${taskId}-0`
    let resolveStartup: (() => void) | null = null
    const startTaskSpy = vi.fn().mockImplementation(() => {
      return new Promise<{ success: boolean; worktreePath: string }>((resolve) => {
        useStore.setState(s => ({
          tasks: s.tasks.map(t => t.id === taskId ? { ...t, status: 'running' } : t)
        }))
        resolveStartup = () => {
          resolve({ success: true, worktreePath: '/tmp/worktree-stop-after' })
        }
      })
    })

    useStore.setState({
      activeTaskId: taskId,
      tasks: [{
        ...sampleTask,
        id: taskId,
        status: 'idle',
        worktreePath: '/tmp/worktree-stop-after',
        feed: [],
      }],
      activeFeed: [],
      startTask: startTaskSpy,
      settings: {
        ...useStore.getState().settings!,
        useMockData: false,
      },
    })

    render(<Workspace />)

    const textarea = screen.getByTestId('composer-input')
    fireEvent.change(textarea, { target: { value: 'доставленный промпт перед стопом' } })
    const sendBtn = screen.getByTestId('composer-send-button')

    act(() => {
      fireEvent.click(sendBtn)
    })

    // Wait for PTY listener
    await waitFor(() => {
      expect(ptyDataCallbacks[taskSessionId]).toBeDefined()
    })

    // Agent emits readiness and prompt is delivered
    act(() => {
      ptyDataCallbacks[taskSessionId]?.('Welcome to Claude Code!\r\n> ')
    })

    await waitFor(() => {
      expect(mockWritePty).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: taskSessionId,
          data: expect.stringContaining('доставленный промпт перед стопом')
        })
      )
    })

    // Generation starts while startTask is still pending; Stop follows CLI output.
    await act(async () => { ptyDataCallbacks[taskSessionId]?.('\r\n⣾ Generating... (esc to cancel)') })
    const stopBtn = screen.getByTestId('composer-stop-button')
    await act(async () => {
      fireEvent.click(stopBtn)
    })

    // Now resolve startTask
    await act(async () => {
      resolveStartup?.()
    })

    // Prompt MUST NOT be removed from feed and draft MUST NOT be restored
    const currentTask = useStore.getState().tasks.find(t => t.id === taskId)
    expect(currentTask?.feed.some(item => item.text === 'доставленный промпт перед стопом')).toBe(true)
    expect((screen.getByTestId('composer-input') as HTMLTextAreaElement).value).toBe('')
  })
})
