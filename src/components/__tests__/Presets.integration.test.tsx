// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { NewTaskForm } from '../NewTaskForm'
import { Settings } from '../Settings'
import { useStore, type Settings as AppSettings } from '../../store'

const initialState = useStore.getState()
const presets = [
  { name: 'Review', agent: 'Claude Code', model: 'auto', permissions: 'Read only' },
  { name: 'Coding', agent: 'Google Antigravity', model: 'gemini-3.8-flash-high', permissions: 'Read only' },
]
const settings: AppSettings = {
  theme: 'dark', language: 'en', uiLanguage: 'en', defaultIDE: 'VSCode', autoArchive: 'never',
  soundAlerts: false, soundType: 'Doorbell', desktopNotifications: false, launchAtLogin: false,
  preventSleep: false, useMockData: false, defaultCodingPreset: 'Coding', defaultReviewPreset: 'Review',
}

describe('preset selection and persistence', () => {
  beforeEach(() => {
    const stored = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => stored.set(key, value), removeItem: (key: string) => stored.delete(key) })
    const repositories = [{ id: 'repo-presets', name: 'Project' }]
    useStore.setState({ ...initialState, presets, settings, repositories, activeRepoId: 'repo-presets' })
    Object.defineProperty(window, 'ziafAPI', { configurable: true, writable: true, value: {
      getAgentModels: vi.fn().mockResolvedValue(['gemini-3.8-flash-high']),
      getAgentModelCatalog: vi.fn(async ({ agent }: { agent: string }) => ({ agent, status: 'ready', source: 'cli', command: agent, queriedAt: 1, models: [{ id: 'gemini-3.8-flash-high', label: 'gemini-3.8-flash-high' }] })),
      savePresets: vi.fn().mockResolvedValue(undefined),
      saveSettings: vi.fn().mockResolvedValue(undefined),
      getRepositories: vi.fn().mockResolvedValue(repositories),
      listWorkspaceFolders: vi.fn().mockResolvedValue(['Work']),
      createTask: vi.fn().mockResolvedValue({ id: 'created-task' }),
      lookupCodeStart: vi.fn().mockRejectedValue(new Error('Connection unavailable')),
    } })
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    useStore.setState(initialState)
  })

  it('uses the default after asynchronous settings load and sends it when creating a task', async () => {
    useStore.setState({ presets: [], settings: null })
    const { container } = render(<NewTaskForm />)
    await act(async () => { useStore.setState({ presets, settings }) })
    expect((screen.getByTestId('new-task-agent-preset') as HTMLSelectElement).value).toBe('Coding')
    fireEvent.change(container.querySelector('textarea')!, { target: { value: 'Implement a feature' } })
    await act(async () => { fireEvent.submit(container.querySelector('form')!) })
    expect(window.ziafAPI.createTask).toHaveBeenCalledWith(expect.objectContaining({ model: 'Coding', repoId: 'repo-presets' }))
    expect(useStore.getState().tasks.find(task => task.id === 'created-task')?.model).toBe('Coding')
  })

  it('preserves a manual preset choice across a refresh of settings', async () => {
    render(<NewTaskForm />)
    fireEvent.change(screen.getByTestId('new-task-agent-preset'), { target: { value: 'Review' } })
    await act(async () => { useStore.setState({ settings: { ...settings }, presets: [...presets] }) })
    expect((screen.getByTestId('new-task-agent-preset') as HTMLSelectElement).value).toBe('Review')
  })

  it('offers every saved CLI preset without a selected project and retains the selected default', async () => {
    const nativePresets = [...presets, { name: 'Codex local', agent: 'Codex', model: 'auto', permissions: 'Workspace write' }]
    useStore.setState({ presets: nativePresets, repositories: [], activeRepoId: null })
    render(<NewTaskForm />)
    expect((screen.getByTestId('new-task-agent-preset') as HTMLSelectElement).value).toBe('Coding')
    for (const preset of nativePresets) expect(within(screen.getByTestId('new-task-agent-preset')).getByRole('option', { name: preset.name })).not.toBeNull()
    await act(async () => fireEvent.change(screen.getByTestId('new-task-agent-preset'), { target: { value: 'Codex local' } }))
    expect((screen.getByTestId('new-task-agent-preset') as HTMLSelectElement).value).toBe('Codex local')
    expect(window.ziafAPI.createTask).not.toHaveBeenCalled()
  })

  it('saves both defaults and applies the coding default to the next form', async () => {
    const view = render(<Settings />)
    fireEvent.click(screen.getByRole('button', { name: 'Presets' }))
    fireEvent.change(screen.getByTestId('default-coding-preset'), { target: { value: 'Review' } })
    fireEvent.change(screen.getByTestId('default-review-preset'), { target: { value: 'Coding' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
    await waitFor(() => expect(useStore.getState().settings?.defaultCodingPreset).toBe('Review'))
    expect(window.ziafAPI.saveSettings).toHaveBeenCalledWith(expect.objectContaining({ defaultCodingPreset: 'Review', defaultReviewPreset: 'Coding' }))
    view.unmount()
    render(<NewTaskForm />)
    await act(async () => {})
    expect((screen.getByTestId('new-task-agent-preset') as HTMLSelectElement).value).toBe('Review')
  })

  it('forwards explicit task permission and reasoning overrides from the shared form', async () => {
    useStore.setState({ presets: [{ name: 'Codex direct', agent: 'Codex', model: 'fixture-model', permissions: 'Workspace write', reasoningEffort: 'low' }], settings: { ...settings, defaultCodingPreset: 'Codex direct' } })
    vi.mocked(window.ziafAPI.getAgentModelCatalog).mockResolvedValue({ agent: 'Codex', status: 'ready', source: 'cli', command: 'codex fixture', queriedAt: 1, models: [{ id: 'fixture-model', label: 'Fixture', supportedReasoningEfforts: ['low', 'xhigh'] }] })
    const view = render(<NewTaskForm />)
    await waitFor(() => expect(screen.getByTestId('new-task-agent-reasoning-effort').textContent).toContain('xhigh'))
    fireEvent.change(screen.getByTestId('new-task-agent-reasoning-effort'), { target: { value: 'xhigh' } })
    fireEvent.change(screen.getByTestId('new-task-agent-permissions'), { target: { value: 'Read only' } })
    fireEvent.change(view.container.querySelector('textarea')!, { target: { value: 'Task options' } })
    await act(async () => fireEvent.submit(view.container.querySelector('form')!))
    expect(window.ziafAPI.createTask).toHaveBeenCalledWith(expect.objectContaining({ model: 'Codex direct', reasoningEffort: 'xhigh', permissions: 'Read only', providerModel: 'fixture-model' }))
  })

  it('saves a custom model even when it is absent from the agent catalog', async () => {
    render(<Settings />)
    fireEvent.click(screen.getByRole('button', { name: 'Presets' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add Preset' }))
    fireEvent.change(screen.getByLabelText('Preset Name'), { target: { value: 'Future' } })
    await waitFor(() => expect(screen.getByTestId('preset-model-catalog').textContent).toContain('gemini-3.8-flash-high'))
    fireEvent.change(screen.getByLabelText('Model'), { target: { value: 'future-model-id' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })) })
    expect(window.ziafAPI.savePresets).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ name: 'Future', model: 'future-model-id' }),
    ]))
  })

  it('starts the selected Code flow with independent review/advance and preserves the backend task receipt', async () => {
    vi.mocked(window.ziafAPI.createTask).mockResolvedValue({ id: 'code-task', repoId: 'repo-presets', name: 'Investigate defect', status: 'running', logs: ['Preparing'], codeFlowVersion: 1,
      todoSteps: [{ id: 'investigate', text: 'Investigate the defect', done: false }] })
    const view = render(<NewTaskForm />)
    fireEvent.click(screen.getByTestId('new-workflow-fix-a-bug'))
    fireEvent.click(screen.getByTestId('new-code-auto'))
    fireEvent.change(view.container.querySelector('textarea')!, { target: { value: 'Investigate defect' } })
    await act(async () => fireEvent.submit(view.container.querySelector('form')!))
    expect(window.ziafAPI.createTask).toHaveBeenCalledWith(expect.objectContaining({ startWorkflow: true, createRequestId: expect.any(String), workflow: 'Fix a bug',
      workflowOptions: expect.objectContaining({ advance: 'auto', review: true, reviewer: expect.objectContaining({ presetName: '@task' }) }) }))
    const task = useStore.getState().tasks.find(item => item.id === 'code-task')!
    expect(task.status).toBe('running'); expect(task.logs).toEqual(['Preparing'])
    expect(task.todoSteps).toEqual([{ id: 'investigate', text: 'Investigate the defect', done: false }])
    expect(task.terminalLogs).toEqual([])
  })

  it('retries one saved Code start across remount while preserving a newer description draft', async () => {
    vi.mocked(window.ziafAPI.createTask).mockRejectedValueOnce(new Error('Create acknowledgement lost'))
    let view = render(<NewTaskForm />)
    fireEvent.change(view.container.querySelector('textarea')!, { target: { value: 'Original Code request' } })
    await act(async () => fireEvent.submit(view.container.querySelector('form')!))
    const first = vi.mocked(window.ziafAPI.createTask).mock.calls[0][0]
    expect(first.createRequestId).toBeTruthy()
    fireEvent.change(view.container.querySelector('textarea')!, { target: { value: 'New unsent draft' } })
    view.unmount()
    view = render(<NewTaskForm />)
    expect((view.container.querySelector('textarea')! as HTMLTextAreaElement).value).toBe('New unsent draft')
    vi.mocked(window.ziafAPI.createTask).mockResolvedValue({ id: 'code-existing', repoId: 'repo-presets', name: first.name, status: 'running', logs: [], codeFlowVersion: 1 })
    await act(async () => fireEvent.submit(view.container.querySelector('form')!))
    expect(vi.mocked(window.ziafAPI.createTask).mock.calls[1][0]).toEqual(first)
    expect(useStore.getState().tasks.filter(item => item.id === 'code-existing')).toHaveLength(1)
    expect(localStorage.getItem('ziaforge-new-task-draft')).toBe('New unsent draft')
    expect(localStorage.getItem('ziaforge-code-start-intent-v1')).toBeNull()
  })

  it('retains the task and description when Code preparation fails after creation', async () => {
    vi.mocked(window.ziafAPI.createTask).mockResolvedValue({ id: 'failed-start', repoId: 'repo-presets', name: 'Recoverable request', status: 'error', logs: [], codeFlowVersion: 1, startupError: 'Workspace could not be prepared' })
    const view = render(<NewTaskForm />)
    fireEvent.change(view.container.querySelector('textarea')!, { target: { value: 'Recoverable request' } })
    await act(async () => fireEvent.submit(view.container.querySelector('form')!))
    expect(useStore.getState().tasks.find(item => item.id === 'failed-start')).toMatchObject({ status: 'error', startupError: 'Workspace could not be prepared' })
    expect(localStorage.getItem('ziaforge-new-task-draft')).toBe('Recoverable request')
    expect(localStorage.getItem('ziaforge-code-start-intent-v1')).toBeNull()
  })

  it('unlocks a rejected Code selection only after the backend proves no task was created', async () => {
    vi.mocked(window.ziafAPI.createTask).mockRejectedValueOnce(new Error('Selected model is unavailable'))
    vi.mocked(window.ziafAPI.lookupCodeStart).mockResolvedValue(null)
    const view = render(<NewTaskForm />)
    fireEvent.change(view.container.querySelector('textarea')!, { target: { value: 'Preserve this request' } })
    await act(async () => fireEvent.submit(view.container.querySelector('form')!))
    const request = vi.mocked(window.ziafAPI.createTask).mock.calls[0][0]
    expect(window.ziafAPI.lookupCodeStart).toHaveBeenCalledWith({ repoId: 'repo-presets', createRequestId: request.createRequestId })
    expect(localStorage.getItem('ziaforge-code-start-intent-v1')).toBeNull()
    expect((screen.getByTestId('new-task-agent-preset') as HTMLSelectElement).disabled).toBe(false)
    expect(localStorage.getItem('ziaforge-new-task-draft')).toBe('Preserve this request')
  })

  it('uses the independent Work startup contract and preserves the selected executor', async () => {
    vi.mocked(window.ziafAPI.createTask).mockResolvedValueOnce({ id: 'created-work', name: 'Write a document', repoId: 'work-folder', status: 'idle', logs: [], workFlowVersion: 1 })
    render(<NewTaskForm />)
    fireEvent.click(screen.getByRole('button', { name: 'Work' }))
    expect((screen.getByTestId('new-work-agent-0-preset') as HTMLSelectElement).value).toBe('Coding')
    fireEvent.change(screen.getByTestId('new-work-description'), { target: { value: 'Write a document' } })
    await act(async () => fireEvent.click(screen.getByTestId('new-task-start')))
    const request = vi.mocked(window.ziafAPI.createTask).mock.calls[0][0]
    expect(request).toMatchObject({ repoId: 'work-folder', branchType: 'Folder', workflow: 'auto', model: 'Coding', provider: 'antigravity', providerModel: 'gemini-3.8-flash-high', startWorkflow: true, workOptions: { kind: 'auto', advance: 'auto', review: true, reviewers: [{ id: 'reviewer', presetName: '@task' }], inputIds: [] } })
    expect(request.createRequestId).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(request.workflowOptions).toBeUndefined()
    expect(localStorage.getItem('ziaforge-code-start-intent-v1')).toBeNull()
    expect(window.ziafAPI.lookupCodeStart).not.toHaveBeenCalled()
    expect(useStore.getState().tasks.find(task => task.id === 'created-work')?.workFlowVersion).toBe(1)
  })
})
