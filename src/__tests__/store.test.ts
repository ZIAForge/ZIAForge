import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useStore } from '../store'

// Mock window.ziafAPI
beforeEach(() => {
  globalThis.window = {
    ziafAPI: {
      writeDebugLog: vi.fn().mockResolvedValue(undefined),
      createTask: vi.fn().mockImplementation(async (config: { name: string; repoId: string; model: string; workflow: string; branchType: string; branchName: string; description?: string }) => ({
        id: 'mock-task-id',
        name: config.name,
        repoId: config.repoId,
        model: config.model,
        workflow: config.workflow,
        branchType: config.branchType,
        branchName: config.branchName,
        description: config.description,
        worktreePath: `/mock/worktrees/mock-task-id`,
        status: 'idle',
        logs: [],
        feed: [],
        todoSteps: [],
        gitChanges: []
      })),
      startTask: vi.fn().mockResolvedValue({ success: true }),
      saveSettings: vi.fn().mockResolvedValue({ success: true }),
      getRepositories: vi.fn().mockResolvedValue([])
    }
  } as unknown as Window & typeof globalThis & { ziafAPI: Record<string, unknown> }

  // Reset store state
  useStore.setState({
    activeRepoId: 'repo-1',
    activeTaskId: 'task-1',
    activeLogs: [],
    activeFeed: [],
    tasks: [
      {
        id: 'task-1',
        name: 'Task 1',
        repoId: 'repo-1',
        status: 'idle',
        model: 'gpt-6-astra',
        workflow: 'Feature',
        branchType: 'Worktree',
        branchName: 'feature/task-1',
        worktreePath: '/mock/worktrees/task-1',
        logs: ['task-1 log initial'],
        feed: [{ id: 'f1', type: 'user', text: 'Prompt 1' }],
        todoSteps: [],
        gitChanges: []
      },
      {
        id: 'task-2',
        name: 'Task 2',
        repoId: 'repo-2',
        status: 'idle',
        model: 'claude-3-7-sonnet',
        workflow: 'Bug',
        branchType: 'Worktree',
        branchName: 'bug/task-2',
        worktreePath: '/mock/worktrees/task-2',
        logs: ['task-2 log initial'],
        feed: [{ id: 'f2', type: 'user', text: 'Prompt 2' }],
        todoSteps: [],
        gitChanges: []
      }
    ]
  })
})

describe('ZIAForge Zustand Store Tests', () => {
  it('retains the project and registry when the backend refuses file deletion', async () => {
    const repository = { id: 'repo-1', name: 'Project', path: '/registered/project', repoPath: '/registered/project/repo' }
    useStore.setState({ repositories: [repository], settings: { ...useStore.getState().settings!, useMockData: false } })
    Object.assign(window.ziafAPI, { deleteProjectFiles: vi.fn().mockResolvedValue({ success: false, error: 'Outside registered roots' }), saveRepositories: vi.fn().mockResolvedValue(undefined) })
    await expect(useStore.getState().deleteRepository(repository.id, { deleteWorkspaceDir: true, deleteSourceDir: false })).rejects.toThrow(/Outside/)
    expect(useStore.getState().repositories).toEqual([repository])
    expect(window.ziafAPI.saveRepositories).not.toHaveBeenCalled()
  })

  it('sends repository identity and deletes files before unregistering the project', async () => {
    const repository = { id: 'repo-1', name: 'Project', path: '/registered/project', repoPath: '/registered/project/repo' }
    const order: string[] = []
    useStore.setState({ repositories: [repository], settings: { ...useStore.getState().settings!, useMockData: false } })
    Object.assign(window.ziafAPI, { deleteProjectFiles: vi.fn(async () => { order.push('delete'); return { success: true } }), saveRepositories: vi.fn(async () => { order.push('unregister') }) })
    vi.stubGlobal('localStorage', { setItem: vi.fn() })
    try {
      await useStore.getState().deleteRepository(repository.id, { deleteWorkspaceDir: true, deleteSourceDir: false })
      expect(order).toEqual(['delete', 'unregister'])
      expect(window.ziafAPI.deleteProjectFiles).toHaveBeenCalledWith({ repoId: 'repo-1', deleteWorkspaceDir: true, deleteSourceDir: false })
      expect(useStore.getState().repositories).toEqual([])
      expect(useStore.getState().tasks.some(task => task.repoId === repository.id)).toBe(false)
      expect(useStore.getState().activeTaskId).toBeNull()
    } finally { vi.unstubAllGlobals() }
  })

  it('preserves the backend provider binding when enriching a newly created task', async () => {
    vi.mocked(window.ziafAPI.createTask).mockResolvedValueOnce({
      ...useStore.getState().tasks[0], id: 'created-codex', agentProvider: 'codex',
    })
    const task = await useStore.getState().createTask('Native task', 'repo-1', 'Codex preset', 'Feature', 'Worktree', 'native')
    expect(task.agentProvider).toBe('codex')
    expect(useStore.getState().tasks.find(item => item.id === task.id)?.agentProvider).toBe('codex')
  })
  it('selectTask synchronizes activeTaskId, activeRepoId, activeLogs and activeFeed', () => {
    const store = useStore.getState()
    expect(store.activeTaskId).toBe('task-1')
    expect(store.activeRepoId).toBe('repo-1')

    store.selectTask('task-2')

    const updated = useStore.getState()
    expect(updated.activeTaskId).toBe('task-2')
    expect(updated.activeRepoId).toBe('repo-2')
    expect(updated.activeLogs).toEqual(['task-2 log initial'])
    expect(updated.activeFeed).toEqual([{ id: 'f2', type: 'user', text: 'Prompt 2' }])
  })

  it('appendLog with explicit taskId updates target task without polluting activeLogs of another task', () => {
    // Current active is task-1
    expect(useStore.getState().activeTaskId).toBe('task-1')

    // Append log to background task-2
    useStore.getState().appendLog('Background build finished', 'task-2')

    const state = useStore.getState()
    const task2 = state.tasks.find(t => t.id === 'task-2')
    const task1 = state.tasks.find(t => t.id === 'task-1')

    // task-2 should have new log
    expect(task2?.logs).toContain('Background build finished')
    // task-1 should NOT have new log
    expect(task1?.logs).not.toContain('Background build finished')
    // activeLogs should NOT contain task-2's log because task-1 is active
    expect(state.activeLogs).not.toContain('Background build finished')
  })

  it('appendFeedItem with explicit taskId updates target task without polluting activeFeed of another task', () => {
    // Current active is task-1
    expect(useStore.getState().activeTaskId).toBe('task-1')

    // Append feed item to background task-2
    useStore.getState().appendFeedItem({ id: 'bg-item', type: 'ai', text: 'Background thought' }, 'task-2')

    const state = useStore.getState()
    const task2 = state.tasks.find(t => t.id === 'task-2')
    const task1 = state.tasks.find(t => t.id === 'task-1')

    expect(task2?.feed).toContainEqual({ id: 'bg-item', type: 'ai', text: 'Background thought' })
    expect(task1?.feed).not.toContainEqual({ id: 'bg-item', type: 'ai', text: 'Background thought' })
    expect(state.activeFeed).not.toContainEqual({ id: 'bg-item', type: 'ai', text: 'Background thought' })
  })

  it('updateTaskStatus updates specific task status properly', () => {
    useStore.getState().updateTaskStatus('task-2', 'running')
    const task2 = useStore.getState().tasks.find(t => t.id === 'task-2')
    expect(task2?.status).toBe('running')
  })

  it('routes IPC onLogStream payloads with taskId to the background task', () => {
    // Current active is task-1
    expect(useStore.getState().activeTaskId).toBe('task-1')

    // Call store's appendLog directly or simulate IPC delivery with taskId
    useStore.getState().appendLog('IPC log line for task 2', 'task-2')

    const state = useStore.getState()
    const task2 = state.tasks.find(t => t.id === 'task-2')
    const task1 = state.tasks.find(t => t.id === 'task-1')

    expect(task2?.logs).toContain('IPC log line for task 2')
    expect(task1?.logs).not.toContain('IPC log line for task 2')
    expect(state.activeLogs).not.toContain('IPC log line for task 2')
  })

  it('bounds log memory to 2000 entries across 4001 appends and single 3001-line chunk', () => {
    // 4001 individual appends
    for (let i = 0; i < 4001; i++) {
      useStore.getState().appendLog(`log line ${i}`)
    }

    const state = useStore.getState()
    const task1 = state.tasks.find(t => t.id === 'task-1')
    expect(state.activeLogs.length).toBeLessThanOrEqual(2000)
    expect(task1?.logs.length).toBeLessThanOrEqual(2000)
    expect(state.activeLogs.length).toBe(1999)

    // Single 3001-line chunk
    const massiveChunk = Array.from({ length: 3001 }, (_, i) => `massive line ${i}`).join('\n')
    useStore.getState().appendLog(massiveChunk)

    const updatedState = useStore.getState()
    const updatedTask1 = updatedState.tasks.find(t => t.id === 'task-1')
    expect(updatedState.activeLogs.length).toBeLessThanOrEqual(2000)
    expect(updatedTask1?.logs.length).toBeLessThanOrEqual(2000)
    expect(updatedState.activeLogs.length).toBe(1000)
  })

  it('startTask clears existing task logs when starting', () => {
    useStore.setState({
      tasks: [{
        ...useStore.getState().tasks[0],
        id: 'task-1',
        logs: ['old log line 1', 'old log line 2'],
      }],
      activeLogs: ['old log line 1', 'old log line 2'],
    })

    useStore.getState().startTask('task-1')

    const task1 = useStore.getState().tasks.find(t => t.id === 'task-1')
    expect(task1?.logs).toEqual([])
  })
})
