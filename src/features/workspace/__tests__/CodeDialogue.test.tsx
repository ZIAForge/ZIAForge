/** @vitest-environment happy-dom */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WorkflowAPI, WorkflowSnapshot } from '../../../../shared/workflow'
import { useStore, type Task } from '../../../store'
import { CodeDialogue } from '../CodeDialogue'

vi.mock('../ComposerConfigurationBar', () => ({ ComposerConfigurationBar: ({ current, onApply, busy }: { current: { model: string }; busy: boolean; onApply: (value: unknown) => Promise<void> }) => <div data-testid="test-configuration">{current.model}<button disabled={busy} onClick={() => void onApply({ presetName: '', provider: 'codex', model: 'chosen-model', permissions: 'Read only', reasoningEffort: 'high' })}>Choose next model</button></div> }))
const originalStore = useStore.getState()
const task: Task = { id: 'task-a', repoId: 'repo-a', name: 'Discuss a product', model: 'Coder', providerModel: 'coder-model', agentProvider: 'codex', codeFlowVersion: 1, description: 'Build a useful product', status: 'idle', logs: [], feed: [], todoSteps: [], gitChanges: [] }
const initial = (): WorkflowSnapshot => ({ schemaVersion: 1, taskId: task.id, runId: 'workflow-a', revision: 1, sequence: 1, updatedAt: 1, commandIds: [], status: 'paused', iterations: 1,
  plan: { title: task.name, coderPreset: '@task', review: true, reviewerPreset: '@task', advance: 'manual', maxFailures: 3, maxIterations: 50, codeFlow: { version: 1, kind: 'requirements-first', request: task.description!, interaction: { version: 1 } },
    steps: [{ id: 'requirements', title: 'Requirements', instructions: 'Discuss requirements', acceptance: ['Accepted'], verification: [], dependsOn: [], newContext: true, stopAfter: false, codePhase: 'requirements' }] },
  steps: [{ id: 'requirements', status: 'pending', failures: 0, attempts: [] }],
  codeFlow: { artifacts: [], answers: [], dialogue: [{ id: 'initial', stepId: 'requirements', role: 'user', text: task.description!, at: 1 }, { id: 'questions', stepId: 'requirements', role: 'assistant', text: 'Who uses the product?', questions: [{ id: 'audience', question: 'Which audience?', options: ['Internal', 'Public'] }], at: 2 }] },
})
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: Error) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
let value: WorkflowSnapshot
let api: WorkflowAPI
let listener: (next: WorkflowSnapshot) => void
const sendText = (text: string) => { fireEvent.change(screen.getByTestId('composer-input'), { target: { value: text } }); fireEvent.click(screen.getByTestId('composer-send-button')) }
const props = { task, onOpenChat: vi.fn(), onOpenPlan: vi.fn() }
beforeEach(() => {
  localStorage.clear(); vi.clearAllMocks(); value = initial()
  useStore.setState({ settings: { ...originalStore.settings!, useMockData: false, language: 'en', uiLanguage: 'en' }, presets: [{ name: 'Coder', agent: 'Codex', model: 'coder-model', permissions: 'Workspace write' }] })
  api = { get: vi.fn<WorkflowAPI['get']>(async () => value), onEvent: vi.fn<WorkflowAPI['onEvent']>(next => { listener = next; return () => {} }),
    discuss: vi.fn<WorkflowAPI['discuss']>(async request => ({ ...value, sequence: value.sequence + 1, commandIds: [request.commandId], codeFlow: { ...value.codeFlow!, discussions: [{ ...request }] } })),
    save: vi.fn<WorkflowAPI['save']>(async request => ({ ...value, revision: value.revision + 1, sequence: value.sequence + 1, plan: request.plan })),
    pause: vi.fn<WorkflowAPI['pause']>(async () => ({ ...value, status: 'paused', sequence: value.sequence + 1 })), start: vi.fn(), respond: vi.fn(), readArtifact: vi.fn() }
  Object.defineProperty(window, 'ziafAPI', { configurable: true, value: { workflows: api, agentSessions: { send: vi.fn() } } })
})
afterEach(() => { cleanup(); useStore.setState(originalStore, true) })

describe('Forge discussion is distinct from execution approval', () => {
  it('keeps a task-scoped draft typed while its saved workflow is still loading', async () => {
    const reply = deferred<WorkflowSnapshot | null>(); vi.mocked(api.get).mockReturnValue(reply.promise)
    render(<CodeDialogue {...props} />)
    fireEvent.change(screen.getByTestId('composer-input'), { target: { value: 'A requirement typed during loading' } })
    expect((screen.getByTestId('composer-send-button') as HTMLButtonElement).disabled).toBe(true)
    await act(async () => reply.resolve(value))
    expect((screen.getByTestId('composer-input') as HTMLTextAreaElement).value).toBe('A requirement typed during loading')
    expect(localStorage.getItem('ziaforge-code-discussion:task-a:conversation')).toContain('A requirement typed during loading')
    expect(api.discuss).not.toHaveBeenCalled()
  })

  it('renders original request and questions, accepts a counterquestion without all form answers or approval', async () => {
    render(<CodeDialogue {...props} />)
    await screen.findByText('Who uses the product?')
    expect(screen.getAllByText(task.description!)).toHaveLength(1)
    sendText('What are the trade-offs before choosing an audience?')
    await waitFor(() => expect(api.discuss).toHaveBeenCalledTimes(1))
    expect(api.discuss).toHaveBeenCalledWith(expect.objectContaining({ taskId: task.id, revision: 1, text: 'What are the trade-offs before choosing an audience?' }))
    expect(api.respond).not.toHaveBeenCalled(); expect(window.ziafAPI.agentSessions.send).not.toHaveBeenCalled()
  })

  it('sends a clarification during work through controlled workflow discussion, while Stop remains separate', async () => {
    value.status = 'running'; render(<CodeDialogue {...props} />)
    await screen.findByText('Who uses the product?')
    expect((screen.getByTestId('composer-stop-button') as HTMLButtonElement).disabled).toBe(false)
    sendText('Pause this direction: it must work offline.')
    await waitFor(() => expect(api.discuss).toHaveBeenCalledTimes(1))
    expect(api.respond).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('composer-stop-button'))
    await waitFor(() => expect(api.pause).toHaveBeenCalledWith({ taskId: task.id }))
  })

  it('keeps a newer draft and intentional focus when a delayed discussion ACK arrives', async () => {
    const reply = deferred<WorkflowSnapshot>(); vi.mocked(api.discuss).mockReturnValue(reply.promise)
    render(<CodeDialogue {...props} />); await screen.findByText('Who uses the product?')
    sendText('First clarification')
    await waitFor(() => expect(api.discuss).toHaveBeenCalledTimes(1))
    fireEvent.change(screen.getByTestId('composer-input'), { target: { value: 'Next unsent requirement' } })
    const selector = screen.getByRole('button', { name: 'Plan and roles' }); selector.focus()
    await act(async () => reply.resolve({ ...value, sequence: 2, commandIds: [vi.mocked(api.discuss).mock.calls[0][0].commandId] }))
    expect((screen.getByTestId('composer-input') as HTMLTextAreaElement).value).toBe('Next unsent requirement')
    expect(document.activeElement).toBe(selector)
    expect(api.discuss).toHaveBeenCalledTimes(1)
  })

  it('retries the same immutable request after unknown ACK and restart, preserving a new draft', async () => {
    vi.mocked(api.discuss).mockRejectedValueOnce(new Error('Lost response'))
    const view = render(<CodeDialogue {...props} />); await screen.findByText('Who uses the product?')
    vi.mocked(api.get).mockRejectedValueOnce(new Error('Connection unavailable'))
    sendText('Persist this requirement')
    await screen.findByTestId('code-dialogue-retry')
    await waitFor(() => expect((screen.getByTestId('code-dialogue-retry') as HTMLButtonElement).disabled).toBe(false))
    const request = vi.mocked(api.discuss).mock.calls[0][0]
    fireEvent.change(screen.getByTestId('composer-input'), { target: { value: 'My next draft' } })
    view.unmount(); render(<CodeDialogue {...props} />)
    await screen.findByText('Who uses the product?')
    fireEvent.click(screen.getByTestId('code-dialogue-retry'))
    await waitFor(() => expect(api.discuss).toHaveBeenCalledTimes(2))
    expect(vi.mocked(api.discuss).mock.calls[1][0]).toEqual(request)
    expect((screen.getByTestId('composer-input') as HTMLTextAreaElement).value).toBe('My next draft')
  })

  it('uses the actual planner for preparation and preserves coder/reviewer policy on model change', async () => {
    value.plan.codeFlow!.planner = { id: 'planner-a', presetName: '@custom', configuration: { provider: 'codex', model: 'planner-model', permissions: 'Read only', reasoningEffort: 'medium' } }
    render(<CodeDialogue {...props} />); await screen.findByText('planner-model')
    fireEvent.click(screen.getByText('Choose next model'))
    await waitFor(() => expect(api.save).toHaveBeenCalledTimes(1))
    const changed = vi.mocked(api.save).mock.calls[0][0].plan
    expect(changed.codeFlow?.planner).toMatchObject({ id: 'planner-a', presetName: '@custom', configuration: { model: 'chosen-model', reasoningEffort: 'high' } })
    expect(changed.coderPreset).toBe('@task'); expect(changed.reviewerPreset).toBe('@task')
    expect(api.discuss).not.toHaveBeenCalled()
  })

  it('shows and updates the step override without changing workflow defaults, and respects retained decision boundaries', async () => {
    useStore.setState({ presets: [...useStore.getState().presets, { name: 'Requirements expert', agent: 'Claude Code', model: 'step-model', permissions: 'Read only', reasoningEffort: 'medium' }] })
    value.plan.steps[0] = { ...value.plan.steps[0], presetName: 'Requirements expert', reasoningEffort: 'high' }
    const original = structuredClone(value.plan)
    render(<CodeDialogue {...props} />)
    await screen.findByText('step-model')
    expect(screen.getByTestId('code-dialogue-agent-role').textContent).toContain('override for this step')
    fireEvent.click(screen.getByText('Choose next model'))
    await waitFor(() => expect(api.save).toHaveBeenCalledTimes(1))
    const changed = vi.mocked(api.save).mock.calls[0][0].plan
    expect(changed.steps[0]).toEqual({ ...original.steps[0], presetName: '@custom', configuration: { provider: 'codex', model: 'chosen-model', permissions: 'Read only', reasoningEffort: 'high' }, permissions: 'Read only', reasoningEffort: 'high' })
    expect(changed.coderPreset).toBe(original.coderPreset)
    expect(changed.coderConfiguration).toEqual(original.coderConfiguration)
    expect(changed.reviewerPreset).toBe(original.reviewerPreset)
    await screen.findByText('chosen-model')
    const pending: WorkflowSnapshot = { ...value, plan: changed, revision: 2, sequence: 3, codeFlow: { ...value.codeFlow!, pending: { id: 'question-gate', kind: 'questions', stepId: 'requirements', attemptId: 'attempt-1', phase: 'requirements', artifactIds: [], summary: 'Choose the audience', questions: [{ id: 'audience', question: 'Which audience?' }] } } }
    act(() => listener(pending))
    expect((screen.getByText('Choose next model') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('code-dialogue-step-policy-locked')).not.toBeNull()
    fireEvent.click(screen.getByText('Choose next model'))
    act(() => listener({ ...pending, sequence: 4, steps: [{ ...pending.steps[0], status: 'completed' }], codeFlow: { ...pending.codeFlow!, pending: { ...pending.codeFlow!.pending!, kind: 'document' } } }))
    expect((screen.getByText('Choose next model') as HTMLButtonElement).disabled).toBe(true)
    expect(api.save).toHaveBeenCalledTimes(1)
    expect(api.discuss).not.toHaveBeenCalled()
  })

  it('makes an explicit foundation revision and ignores unrelated task events', async () => {
    render(<CodeDialogue {...props} />); await screen.findByText('Who uses the product?')
    fireEvent.change(screen.getByTestId('code-dialogue-phase'), { target: { value: 'specification' } })
    sendText('Revisit storage: use a local database.')
    await waitFor(() => expect(api.discuss).toHaveBeenCalledWith(expect.objectContaining({ phase: 'specification', text: 'Revisit storage: use a local database.' })))
    act(() => listener({ ...value, taskId: 'other-task', sequence: 99, codeFlow: { ...value.codeFlow!, dialogue: [{ id: 'other', stepId: 'requirements', role: 'assistant', text: 'Other private task', at: 3 }] } }))
    expect(screen.queryByText('Other private task')).toBeNull()
  })
})
