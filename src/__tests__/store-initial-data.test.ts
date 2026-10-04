import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore, type Repository, type Settings, type SidebarGroup } from '../store'

const repositories: Repository[] = Array.from({ length: 50 }, (_, index) => ({ id: `repo-${index + 1}`, name: `Project ${index + 1}`, path: `/fixture/project-${index + 1}` }))
const tasks = Array.from({ length: 100 }, (_, index) => ({ id: `task-${index + 1}`, name: `Task ${index + 1}`, repoId: `repo-${Math.floor(index / 2) + 1}`, status: 'idle' }))
const groupKey = 'ziaf_sidebar_groups'

function fixture(settings: Partial<Settings> = {}, savedTasks: unknown[] = tasks) {
  const api = {
    getRepositories: vi.fn().mockResolvedValue(repositories),
    getPresets: vi.fn().mockResolvedValue([]),
    getSettings: vi.fn().mockResolvedValue(settings),
    getTasks: vi.fn().mockResolvedValue(savedTasks),
    getAppVersion: vi.fn().mockResolvedValue({ version: '0.0.4', isDev: true, fullVersion: '0.0.4-dev' }),
    selectDirectory: vi.fn().mockResolvedValue('/fixture/new-source'),
    registerProject: vi.fn().mockResolvedValue({ success: true, projectId: 'new-repo', projectName: 'New project', projectPath: '/fixture/new-project', repoPath: '/fixture/new-source' }),
    getProjectBranches: vi.fn().mockResolvedValue(['main']),
  }
  vi.stubGlobal('window', { ziafAPI: api })
  return api
}

beforeEach(() => {
  const data = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) })
  vi.stubGlobal('alert', vi.fn())
  useStore.setState({ repositories: [], tasks: [], groups: [], settings: null, activeRepoId: null, activeTaskId: null })
})
afterEach(() => { vi.unstubAllGlobals() })

describe('real project bootstrap', () => {
  it.each([false, undefined])('keeps all 50 real projects visible when useMockData is %s', async useMockData => {
    fixture({ useMockData })
    await useStore.getState().loadInitialData()
    const state = useStore.getState()
    expect(state.tasks).toHaveLength(100)
    expect(state.groups).toEqual([{ id: 'g1', name: 'Active Projects', collapsed: false, children: [], repoIds: repositories.map(repo => repo.id) }])
    const visibleRepoIds = state.groups.filter(group => !group.collapsed).flatMap(group => group.repoIds)
    expect(state.tasks.every(task => visibleRepoIds.includes(task.repoId))).toBe(true)
    expect(visibleRepoIds).toContain(state.tasks[70].repoId)
    expect(JSON.parse(localStorage.getItem(groupKey)!)).toEqual(state.groups)
  })

  it('preserves saved custom hierarchy, explicit archive choices and their stored bytes', async () => {
    const saved: SidebarGroup[] = [{ id: 'my-group', name: 'My active projects', collapsed: false, children: [{ id: 'my-archive', name: 'Deliberately hidden', collapsed: true, children: [], repoIds: ['repo-36'] }], repoIds: ['repo-1'], color: '#123456' }]
    const bytes = JSON.stringify(saved, null, 2)
    localStorage.setItem(groupKey, bytes)
    fixture({ useMockData: false })
    await useStore.getState().loadInitialData()
    expect(useStore.getState().groups).toEqual(saved)
    expect(localStorage.getItem(groupKey)).toBe(bytes)
  })

  it('preserves an explicitly saved empty group list instead of inventing groups', async () => {
    localStorage.setItem(groupKey, '[]')
    fixture({ useMockData: false })
    await useStore.getState().loadInitialData()
    expect(useStore.getState().groups).toEqual([])
    expect(localStorage.getItem(groupKey)).toBe('[]')
    expect(useStore.getState().repositories).toHaveLength(50)
  })

  it('leaves absent real task data empty and preserves explicit content and empty values', async () => {
    const explicit = { ...tasks[1], todoSteps: [{ id: 'user-step', text: 'User requirement', done: false }], gitChanges: [{ id: 'real-diff', filename: 'owned.txt', path: 'owned.txt', additions: 1, deletions: 0, diff: '+actual content' }], terminalLogs: ['actual shell output'], browserUrl: 'http://localhost:4321' }
    const empty = { ...tasks[2], todoSteps: [], gitChanges: [], terminalLogs: [], browserUrl: '' }
    fixture({ useMockData: false }, [tasks[0], explicit, empty])
    await useStore.getState().loadInitialData()
    const [missing, saved, blank] = useStore.getState().tasks
    expect(missing).toMatchObject({ todoSteps: [], gitChanges: [], terminalLogs: [], logs: [], feed: [] })
    expect(missing.browserUrl).toBeUndefined()
    expect(saved).toMatchObject(explicit)
    expect(blank).toMatchObject(empty)
  })

  it('creates demonstration content only when mock mode was explicitly selected', async () => {
    fixture({ useMockData: true }, [tasks[0], { ...tasks[1], todoSteps: [], gitChanges: [], terminalLogs: [], browserUrl: '' }])
    await useStore.getState().loadInitialData()
    const state = useStore.getState()
    expect(state.tasks[0].todoSteps).toHaveLength(6)
    expect(state.tasks[0].gitChanges).toHaveLength(2)
    expect(state.tasks[0].terminalLogs).toEqual(['-> ziaforge git:(main) '])
    expect(state.groups[0].repoIds).toHaveLength(35)
    expect(state.groups[1]).toMatchObject({ name: 'Archived', collapsed: true })
    expect(state.tasks[1]).toMatchObject({ todoSteps: [], gitChanges: [], terminalLogs: [], browserUrl: '' })
  })

  it('adds the first Active group without replacing existing user groups', async () => {
    const saved: SidebarGroup[] = [{ id: 'custom', name: 'My projects', collapsed: true, children: [], repoIds: ['repo-2'], color: '#abcdef' }]
    localStorage.setItem(groupKey, JSON.stringify(saved))
    fixture({ useMockData: false })
    await useStore.getState().loadInitialData()
    expect(await useStore.getState().addRepositoryInteractive()).toBe('new-repo')
    expect(useStore.getState().groups).toEqual([{ id: 'g1', name: 'Active Projects', collapsed: false, children: [], repoIds: ['new-repo'] }, ...saved])
    expect(JSON.parse(localStorage.getItem(groupKey)!)).toEqual(useStore.getState().groups)
  })

  it('adds to an existing nested Active group without changing user collapse or parent state', async () => {
    const saved: SidebarGroup[] = [{ id: 'custom', name: 'My hierarchy', collapsed: true, children: [{ id: 'g1', name: 'Renamed active', collapsed: true, children: [], repoIds: ['repo-2'] }], repoIds: ['repo-1'] }]
    localStorage.setItem(groupKey, JSON.stringify(saved))
    fixture({ useMockData: false })
    await useStore.getState().loadInitialData()
    expect(await useStore.getState().addRepositoryInteractive()).toBe('new-repo')
    expect(useStore.getState().groups).toEqual([{ ...saved[0], children: [{ ...saved[0].children[0], repoIds: ['repo-2', 'new-repo'] }] }])
  })
})
