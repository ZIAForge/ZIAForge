/** @vitest-environment happy-dom */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WorkflowAPI, WorkflowPlan, WorkflowSnapshot } from '../../../../shared/workflow'
import { useStore, type Settings, type Task } from '../../../store'
import { validatePlan } from '../../../../electron/workflow/WorkflowValidation'
import { ExecutablePlanPanel } from '../ExecutablePlanPanel'

const initialStore = useStore.getState()
const task = (id: string, model = 'Coding'): Task => ({ id, repoId: 'repo', name: `Task ${id}`, model, status: 'idle', logs: [], feed: [], todoSteps: [], gitChanges: [] })
const plan = (title = 'Original step'): WorkflowPlan => ({ title: 'Fixture plan', coderPreset: 'Coding', reviewerPreset: 'Review', review: true,
  advance: 'manual', maxFailures: 3, maxIterations: 50, steps: [{ id: 'step-1', title, instructions: 'A bounded fixture', acceptance: ['Actual evidence'],
    dependsOn: [], newContext: true, stopAfter: false, verification: [{ executable: '/usr/bin/true', args: [], timeoutMs: 1000 }] }] })
const snapshot = (taskId = 'task-a', revision = 1, sequence = 1, value = plan()): WorkflowSnapshot => ({ schemaVersion: 1, taskId, runId: `workflow-${taskId}`,
  revision, sequence, plan: value, status: 'draft', iterations: 0, steps: value.steps.map(step => ({ id: step.id, status: 'pending', failures: 0, attempts: [] })),
  updatedAt: 1, commandIds: [] })
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((accept, decline) => { resolve = accept; reject = decline })
  return { promise, resolve, reject }
}
function fixture(initial: WorkflowSnapshot | null = snapshot()) {
  const values = new Map<string, WorkflowSnapshot>()
  if (initial) values.set(initial.taskId, initial)
  const listeners = new Set<(value: WorkflowSnapshot) => void>()
  const push = (value: WorkflowSnapshot) => { values.set(value.taskId, value); listeners.forEach(listener => listener(value)) }
  const api = {
    respond: vi.fn<WorkflowAPI['respond']>(),
    discuss: vi.fn<WorkflowAPI['discuss']>(),
    readArtifact: vi.fn<WorkflowAPI['readArtifact']>(),
    get: vi.fn<WorkflowAPI['get']>(async request => values.get(request.taskId) ?? null),
    save: vi.fn<WorkflowAPI['save']>(async request => {
      const current = values.get(request.taskId)
      if ((current?.revision ?? 0) !== request.expectedRevision) throw new Error('The plan was changed elsewhere. Reload it before saving.')
      const next = snapshot(request.taskId, request.expectedRevision + 1, (current?.sequence ?? 0) + 1, request.plan)
      push(next)
      return next
    }),
    start: vi.fn<WorkflowAPI['start']>(async request => {
      const current = values.get(request.taskId)!
      const next: WorkflowSnapshot = { ...current, status: 'running', sequence: current.sequence + 1 }
      push(next)
      return next
    }),
    pause: vi.fn<WorkflowAPI['pause']>(async request => {
      const current = values.get(request.taskId)!
      const next: WorkflowSnapshot = { ...current, status: 'paused', sequence: current.sequence + 1 }
      push(next)
      return next
    }),
    onEvent: vi.fn<WorkflowAPI['onEvent']>(listener => { listeners.add(listener); return () => { listeners.delete(listener) } }),
  } satisfies WorkflowAPI
  Object.defineProperty(window, 'ziafAPI', { configurable: true, writable: true, value: { workflows: api } })
  return { api, push }
}
const start = () => screen.getByTestId('workflow-start') as HTMLButtonElement
const save = () => screen.getByTestId('workflow-save') as HTMLButtonElement
const ready = () => waitFor(() => expect((screen.getByTestId('workflow-add-title') as HTMLInputElement).disabled).toBe(false))
const props = { onClose: () => {}, onOpenChat: () => {} }

describe('ExecutablePlanPanel ownership and authoritative workflow state', () => {
  beforeEach(() => {
    localStorage.clear()
    useStore.setState({ settings: { uiLanguage: 'en', defaultCodingPreset: 'Coding', defaultReviewPreset: 'Review' } as Settings,
      presets: [
        { name: 'Coding', agent: 'Codex', model: 'fixture', permissions: 'Workspace write' },
        { name: 'Other', agent: 'Claude Code', model: 'fixture', permissions: 'Read only' },
        { name: 'Review', agent: 'Codex', model: 'fixture', permissions: 'Read only' },
      ] })
  })
  afterEach(() => { cleanup(); useStore.setState(initialStore) })

  it('keeps new Forge decisions in the conversation and restores unsaved Code plan edits after closing the panel', async () => {
    const value = snapshot()
    value.plan.codeFlow = { version: 1, kind: 'requirements-first', request: 'Discuss', interaction: { version: 1 } }
    value.plan.steps[0].codePhase = 'implementation'
    value.codeFlow = { artifacts: [], answers: [] }
    const test = fixture(value); const onOpenChat = vi.fn()
    const view = render(<ExecutablePlanPanel task={task('task-a')} {...props} onOpenChat={onOpenChat} />)
    await ready()
    expect(screen.queryByTestId('code-flow-panel')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Open Forge discussion' }))
    expect(onOpenChat).toHaveBeenCalledWith('forge-discussion', 'Forge · Discussion')
    fireEvent.click(screen.getByRole('button', { name: /Original step/ }))
    fireEvent.change(screen.getByLabelText('Instructions'), { target: { value: 'My unsaved extra acceptance context' } })
    view.unmount()
    render(<ExecutablePlanPanel task={task('task-a')} {...props} onOpenChat={onOpenChat} />)
    await ready()
    fireEvent.click(screen.getByRole('button', { name: /Original step/ }))
    expect((screen.getByLabelText('Instructions') as HTMLTextAreaElement).value).toBe('My unsaved extra acceptance context')
    await act(async () => fireEvent.click(save()))
    expect(test.api.save.mock.calls[0][0].plan.steps[0].instructions).toBe('My unsaved extra acceptance context')
    expect(localStorage.getItem('ziaforge-code-plan-draft:task-a')).toBeNull()
  })

  it('explains an unverified Work plan before start and allows either checks or a selected reviewer', async () => {
    const value = plan()
    value.review = false
    value.steps[0].verification = []
    const test = fixture(snapshot('task-a', 1, 1, value))
    render(<ExecutablePlanPanel task={{ ...task('task-a'), mode: 'work' }} {...props} />)
    await ready()
    expect(start().disabled).toBe(true)
    expect(screen.getByTestId('workflow-start-requirements').textContent).toContain('verification command')
    fireEvent.click(start())
    expect(test.api.start).not.toHaveBeenCalled()
    expect(test.api.save).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('workflow-review'))
    expect(start().disabled).toBe(false)
    fireEvent.change(screen.getByTestId('workflow-reviewer'), { target: { value: '' } })
    expect(start().disabled).toBe(true)
    expect(screen.getByTestId('workflow-start-requirements').textContent).toContain('reviewer preset')
    fireEvent.click(screen.getByTestId('workflow-review'))
    fireEvent.click(screen.getByRole('button', { name: /Original step/ }))
    fireEvent.change(screen.getByTestId('workflow-check-0'), { target: { value: 'test -s report.md' } })
    expect(start().disabled).toBe(false)
    expect(screen.queryByTestId('workflow-start-requirements')).toBeNull()
    await act(async () => fireEvent.click(start()))
    expect(test.api.start).toHaveBeenCalledTimes(1)
  })

  it('runs Code preparation without pretending that it needs implementation checks', async () => {
    const value = plan()
    value.codeFlow = { version: 1, kind: 'requirements-first', request: 'Prepare requirements' }
    value.steps[0].codePhase = 'requirements'; value.steps[0].verification = []; value.review = false
    const test = fixture(snapshot('task-a', 1, 1, value))
    render(<ExecutablePlanPanel task={{ ...task('task-a'), codeFlowVersion: 1 }} {...props} />)
    await ready()
    expect(start().disabled).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: /Original step/ }))
    expect(screen.queryByTestId('workflow-check-0')).toBeNull()
    expect(screen.queryByLabelText('Red check for TDD (optional)')).toBeNull()
    expect((screen.getByLabelText('New context for this step') as HTMLInputElement).disabled).toBe(true)
    expect((screen.getByLabelText('New context for this step') as HTMLInputElement).checked).toBe(true)
    expect(screen.getByText('Preparation uses a fresh context and saved documents. Executable checks belong to implementation steps.')).not.toBeNull()
    await act(async () => fireEvent.click(start()))
    expect(test.api.start).toHaveBeenCalledTimes(1)
    const waiting = snapshot('task-a', 1, 3, value)
    waiting.status = 'paused'
    waiting.steps[0].attempts = [{ id: 'requirements-attempt', number: 1, startedAt: 1, finishedAt: 2, stage: 'implementation', status: 'interrupted', verification: [], error: 'Waiting for the user to answer the preparation questions' }]
    waiting.codeFlow = { artifacts: [], answers: [], pending: { id: 'question-gate', kind: 'questions', stepId: value.steps[0].id, attemptId: 'requirements-attempt', phase: 'requirements', summary: 'An audience decision is needed', artifactIds: [], questions: [{ id: 'audience', question: 'Which audience?' }] } }
    act(() => test.push(waiting))
    expect(screen.getByText('Attempt 1 · Requirements')).not.toBeNull()
    expect(screen.getByTestId('workflow-awaiting-answer-0').className).toContain('text-amber-300')
    expect(screen.queryByText('Waiting for the user to answer the preparation questions')).toBeNull()
  })

  it.each(['code', 'legacy'] as const)('saves an added %s step with the correct phase contract', async kind => {
    const value = plan()
    if (kind === 'code') {
      value.codeFlow = { version: 1, kind: 'auto', request: 'A bounded change' }
      value.steps[0].codePhase = 'discovery'
      value.steps[0].verification = []
    }
    const test = fixture(snapshot('task-a', 1, 1, value))
    render(<ExecutablePlanPanel task={task('task-a')} {...props} />)
    await ready()
    fireEvent.change(screen.getByTestId('workflow-add-title'), { target: { value: 'User implementation step' } })
    fireEvent.click(screen.getByTestId('workflow-add-step'))
    await act(async () => fireEvent.click(save()))
    const saved = test.api.save.mock.calls[0][0].plan
    expect(saved.steps).toHaveLength(2)
    expect(saved.steps[1].codePhase).toBe(kind === 'code' ? 'implementation' : undefined)
    expect(saved.steps[1].dependsOn).toEqual(['step-1'])
    expect(() => validatePlan(saved)).not.toThrow()
    expect(test.api.start).not.toHaveBeenCalled()
  })

  it('allows saved role changes at a Code gate after preparation, while generic Start and step edits stay blocked', async () => {
    const value = plan()
    value.codeFlow = { version: 1, kind: 'multi-model', request: 'Plan a bounded change' }
    value.steps[0].codePhase = 'planning'; value.steps[0].verification = []
    const current = snapshot('task-a', 2, 5, value)
    current.status = 'paused'; current.steps[0].status = 'completed'
    current.codeFlow = { artifacts: [], answers: [], pending: { id: 'gate-plan', kind: 'plan', stepId: 'step-1', attemptId: 'attempt-1', summary: 'Accept this proposal', artifactIds: [], proposedSteps: [{ ...plan().steps[0], id: 'implementation', codePhase: 'implementation' }] } }
    const test = fixture(current)
    test.api.save.mockImplementation(async request => {
      const next = { ...current, plan: request.plan, revision: current.revision + 1, sequence: current.sequence + 1 }
      test.push(next); return next
    })
    render(<ExecutablePlanPanel task={{ ...task('task-a'), codeFlowVersion: 1 }} {...props} />)
    await waitFor(() => expect(screen.getByTestId('code-flow-gate')).not.toBeNull())
    expect((screen.getByTestId('workflow-reviewer') as HTMLSelectElement).disabled).toBe(false)
    expect(start().disabled).toBe(true)
    expect((screen.getByTestId('workflow-add-title') as HTMLInputElement).disabled).toBe(true)
    fireEvent.change(screen.getByTestId('workflow-reviewer'), { target: { value: 'Other' } })
    expect((screen.getByTestId('code-gate-approve') as HTMLButtonElement).disabled).toBe(true)
    expect(save().disabled).toBe(false)
    await act(async () => fireEvent.click(save()))
    expect(test.api.save.mock.calls[0][0].plan.reviewerPreset).toBe('Other')
    expect((screen.getByTestId('code-gate-approve') as HTMLButtonElement).disabled).toBe(false)
    expect(test.api.start).not.toHaveBeenCalled(); expect(test.api.respond).not.toHaveBeenCalled()
  })

  it('keeps the reviewed revision immutable at Gate B and leaves the explicit decision available', async () => {
    const value = plan()
    value.codeFlow = { version: 1, kind: 'multi-model', request: 'Review a bounded change' }
    value.steps[0].codePhase = 'implementation'
    const current = snapshot('task-a', 2, 5, value)
    current.status = 'paused'; current.steps[0].status = 'blocked'
    current.codeFlow = { artifacts: [], answers: [], pending: { id: 'gate-review', kind: 'review', stepId: 'step-1', attemptId: 'attempt-1', summary: 'Retained blocking finding', artifactIds: [], reviewOutcome: 'changes_requested' } }
    const test = fixture(current)
    render(<ExecutablePlanPanel task={{ ...task('task-a'), codeFlowVersion: 1 }} {...props} />)
    await waitFor(() => expect(screen.getByTestId('code-flow-gate')).not.toBeNull())
    expect((screen.getByTestId('workflow-reviewer') as HTMLSelectElement).disabled).toBe(true)
    expect(screen.getByTestId('workflow-auto').closest('fieldset')!.disabled).toBe(true)
    expect(save().disabled).toBe(true)
    expect(start().disabled).toBe(true)
    expect((screen.getByTestId('code-gate-approve') as HTMLButtonElement).disabled).toBe(false)
    await act(async () => fireEvent.click(save()))
    expect(test.api.save).not.toHaveBeenCalled()
    expect(test.api.respond).not.toHaveBeenCalled()
  })

  it('allows the saved task reviewer reference and finalization without new review work', async () => {
    const value = plan()
    value.reviewerPreset = '@task'
    const test = fixture(snapshot('task-a', 1, 1, value))
    render(<ExecutablePlanPanel task={task('task-a', '')} {...props} />)
    await ready()
    expect(start().disabled).toBe(false)
    const finished = snapshot('task-a', 1, 2, { ...value, reviewerPreset: undefined })
    finished.status = 'blocked'
    finished.steps[0].status = 'completed'
    act(() => test.push(finished))
    expect(start().disabled).toBe(false)
    await act(async () => fireEvent.click(start()))
    expect(test.api.start).toHaveBeenCalledTimes(1)
  })

  it('edits distinct review/helper sources and separate explicit Git choices without publishing from the form', async () => {
    const test = fixture()
    useStore.setState({ presets: [...useStore.getState().presets, { name: 'API review', agent: 'OpenAI-compatible API', model: 'test', permissions: 'Read only', apiConnectionId: 'api-fixture' }] })
    render(<ExecutablePlanPanel task={task('task-a')} {...props} />)
    await ready()
    fireEvent.click(screen.getByTestId('workflow-add-reviewer'))
    fireEvent.change(screen.getByTestId('workflow-review-source-1'), { target: { value: 'API review' } })
    fireEvent.click(screen.getByTestId('workflow-add-helper'))
    fireEvent.change(screen.getByLabelText('Helper instructions 1'), { target: { value: 'Find concrete validation evidence; change no files.' } })
    expect((screen.getByTestId('workflow-git-commit') as HTMLSelectElement).value).toBe('manual')
    expect((screen.getByTestId('workflow-git-merge') as HTMLSelectElement).value).toBe('manual')
    expect((screen.getByTestId('workflow-git-push') as HTMLSelectElement).value).toBe('manual')
    fireEvent.change(screen.getByTestId('workflow-git-commit'), { target: { value: 'after-plan' } })
    fireEvent.change(screen.getByTestId('workflow-git-push'), { target: { value: 'after-plan' } })
    fireEvent.change(screen.getByTestId('workflow-git-remote'), { target: { value: 'reviewed-remote' } })
    await act(async () => fireEvent.click(save()))
    const saved = test.api.save.mock.calls[0][0].plan
    expect(saved.reviewers?.map(source => source.presetName)).toEqual(['Review', 'API review'])
    expect(saved.reviewPolicy).toBe('all')
    expect(saved.helpers?.[0].instructions).toContain('change no files')
    expect(saved.git).toEqual({ commit: 'after-plan', merge: 'manual', push: 'after-plan', remote: 'reviewed-remote' })
    expect(test.api.start).not.toHaveBeenCalled()
  })

  it('persists coder, step, reviewer and helper effort while reviewer permissions stay read only', async () => {
    const test = fixture()
    window.ziafAPI.getAgentModelCatalog = vi.fn().mockResolvedValue({ agent: 'Codex', status: 'ready', source: 'cli', command: 'fixture model/list', queriedAt: 1, models: [{ id: 'fixture', label: 'Fixture', supportedReasoningEfforts: ['none', 'high'] }] })
    render(<ExecutablePlanPanel task={task('task-a')} {...props} />); await ready()
    const openOptions = async (prefix: string) => {
      const details = screen.getByTestId(`${prefix}-execution-options`) as HTMLDetailsElement
      details.open = true; fireEvent(details, new Event('toggle'))
      await waitFor(() => expect(screen.getByTestId(`${prefix}-reasoning-effort`).textContent).toContain('high'))
      fireEvent.change(screen.getByTestId(`${prefix}-reasoning-effort`), { target: { value: 'high' } })
    }
    await openOptions('workflow-coder')
    fireEvent.change(screen.getByTestId('workflow-coder-permissions'), { target: { value: 'Read only' } })
    await openOptions('workflow-reviewer')
    expect(screen.queryByTestId('workflow-reviewer-permissions')).toBeNull()
    fireEvent.click(screen.getByTestId('workflow-add-helper'))
    await openOptions('workflow-helper-0')
    expect(screen.queryByTestId('workflow-helper-0-permissions')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Original step/ }))
    await openOptions('workflow-step-0')
    fireEvent.change(screen.getByTestId('workflow-step-0-reasoning-effort'), { target: { value: 'none' } })
    await act(async () => fireEvent.click(save()))
    expect(test.api.save.mock.calls[0][0].plan).toMatchObject({ coderReasoningEffort: 'high', coderPermissions: 'Read only', reviewerReasoningEffort: 'high', helpers: [{ reasoningEffort: 'high' }], steps: [{ reasoningEffort: 'none' }] })
  })

  it('offers all presets for both roles and allows the same preset in separate review sources', async () => {
    const test = fixture()
    useStore.setState({ presets: [...useStore.getState().presets, { name: 'AGY', agent: 'Google Antigravity', model: 'gemini-fixture', permissions: 'Dangerously skip permissions' }] })
    render(<ExecutablePlanPanel task={task('task-a', 'AGY')} {...props} />)
    await ready()
    for (const prefix of ['workflow-coder', 'workflow-reviewer']) {
      const options = [...(screen.getByTestId(prefix) as HTMLSelectElement).options]
      expect(options.filter(option => option.value).map(option => option.value)).toEqual(['@task', '@custom', 'Coding', 'Other', 'Review', 'AGY'])
      expect(options.every(option => !option.disabled)).toBe(true)
      fireEvent.change(screen.getByTestId(prefix), { target: { value: 'AGY' } })
    }
    expect(screen.getByTestId('workflow-reviewer-access-hint').textContent).toContain('not a read-only sandbox')
    expect(screen.getByTestId('workflow-reviewer-execution-options').textContent).toContain('CLI settings')
    fireEvent.change(screen.getByTestId('workflow-reviewer'), { target: { value: '@task' } })
    fireEvent.change(screen.getByTestId('workflow-reviewer'), { target: { value: '@custom' } })
    expect((screen.getByTestId('workflow-reviewer-provider') as HTMLSelectElement).value).toBe('antigravity')
    expect((screen.getByTestId('workflow-reviewer-model') as HTMLInputElement).value).toBe('gemini-fixture')
    fireEvent.change(screen.getByTestId('workflow-reviewer'), { target: { value: 'AGY' } })
    fireEvent.click(screen.getByTestId('workflow-add-reviewer'))
    fireEvent.change(screen.getByTestId('workflow-review-source-1'), { target: { value: 'AGY' } })
    await act(async () => fireEvent.click(save()))
    const saved = test.api.save.mock.calls[0][0].plan
    expect(() => validatePlan(saved)).not.toThrow()
    expect(saved.coderPreset).toBe('AGY')
    expect(saved.reviewers?.map(source => source.presetName)).toEqual(['AGY', 'AGY'])
    expect(new Set(saved.reviewers?.map(source => source.id)).size).toBe(2)
  })

  it('preserves a custom reviewer when adding sources and clears stale options when switching selections', async () => {
    const value = plan()
    value.reviewerReasoningEffort = 'high'
    const test = fixture(snapshot('task-a', 1, 1, value))
    window.ziafAPI.getAgentModelCatalog = vi.fn().mockResolvedValue({ agent: 'Codex', status: 'ready', source: 'cli', command: 'fixture model/list', queriedAt: 1, models: [{ id: 'fixture', label: 'Fixture', supportedReasoningEfforts: ['high'] }] })
    render(<ExecutablePlanPanel task={task('task-a')} {...props} />)
    await ready()
    fireEvent.change(screen.getByTestId('workflow-reviewer'), { target: { value: '@custom' } })
    fireEvent.change(screen.getByTestId('workflow-reviewer-model'), { target: { value: 'custom-review-model' } })
    fireEvent.click(screen.getByTestId('workflow-add-reviewer'))
    expect((screen.getByTestId('workflow-review-source-0-model') as HTMLInputElement).value).toBe('custom-review-model')
    await act(async () => fireEvent.click(save()))
    expect(test.api.save.mock.calls[0][0].plan.reviewers?.[0]).toMatchObject({ presetName: '@custom', configuration: { provider: 'codex', model: 'custom-review-model', reasoningEffort: 'high', permissions: 'Read only' } })
    fireEvent.change(screen.getByTestId('workflow-review-source-0'), { target: { value: 'Other' } })
    expect(screen.queryByTestId('workflow-review-source-0-custom')).toBeNull()
    await act(async () => fireEvent.click(save()))
    expect(test.api.save.mock.calls[1][0].plan.reviewers?.[0]).toMatchObject({ presetName: 'Other', configuration: undefined, reasoningEffort: undefined })
  })

  it('inherits the custom coder in a step and saves independent provider/model overrides', async () => {
    const test = fixture()
    window.ziafAPI.getAgentModelCatalog = vi.fn().mockResolvedValue({ agent: 'Codex', status: 'ready', source: 'cli', command: 'fixture model/list', queriedAt: 1, models: [{ id: 'fixture', label: 'Fixture', supportedReasoningEfforts: ['high'] }] })
    render(<ExecutablePlanPanel task={task('task-a')} {...props} />)
    await ready()
    fireEvent.change(screen.getByTestId('workflow-coder'), { target: { value: '@custom' } })
    fireEvent.change(screen.getByTestId('workflow-coder-model'), { target: { value: 'custom-coder-model' } })
    fireEvent.click(screen.getByRole('button', { name: /Original step/ }))
    fireEvent.change(screen.getByTestId('workflow-step-0-preset'), { target: { value: '@custom' } })
    expect((screen.getByTestId('workflow-step-0-model') as HTMLInputElement).value).toBe('custom-coder-model')
    fireEvent.change(screen.getByTestId('workflow-step-0-provider'), { target: { value: 'claude' } })
    fireEvent.change(screen.getByTestId('workflow-step-0-model'), { target: { value: 'custom-step-model' } })
    await act(async () => fireEvent.click(save()))
    const saved = test.api.save.mock.calls[0][0].plan
    expect(() => validatePlan(saved)).not.toThrow()
    expect(saved.coderConfiguration).toMatchObject({ provider: 'codex', model: 'custom-coder-model' })
    expect(saved.steps[0].configuration).toMatchObject({ provider: 'claude', model: 'custom-step-model' })
    fireEvent.change(screen.getByTestId('workflow-step-0-preset'), { target: { value: '' } })
    await act(async () => fireEvent.click(save()))
    expect(test.api.save.mock.calls[1][0].plan.steps[0]).toMatchObject({ presetName: undefined, configuration: undefined, reasoningEffort: undefined, permissions: undefined })
  })

  it('shows source disagreements, source chat links and blocked Git receipts instead of implying completion', async () => {
    const value = snapshot()
    value.status = 'blocked'; value.iterations = 1
    value.steps[0] = { id: 'step-1', status: 'blocked', failures: 1, attempts: [{ id: 'attempt-one', number: 1, startedAt: 1, stage: 'review', status: 'failed', verification: [], reviewSources: [
      { sourceId: 'first', presetName: 'Review', status: 'completed', targetFingerprint: 'a'.repeat(64), review: { outcome: 'approved', findings: [], summary: 'Correctness passes' } },
      { sourceId: 'second', presetName: 'Other', status: 'completed', targetFingerprint: 'a'.repeat(64), session: { sessionId: 'session-two', runId: 'run-two', chatId: 'wf-review-two' }, review: { outcome: 'changes_requested', findings: [{ severity: 'blocking', location: 'a.ts:1', evidence: 'Unchecked input', action: 'Validate input' }], summary: 'Correction required' } },
    ] }] }
    const test = fixture(value)
    const open = vi.fn()
    render(<ExecutablePlanPanel task={task('task-a')} onClose={() => {}} onOpenChat={open} />)
    await ready()
    fireEvent.click(screen.getByRole('button', { name: /Original step/ }))
    expect(screen.getByTestId('workflow-source-first').textContent).toContain('approved')
    expect(screen.getByTestId('workflow-source-second').textContent).toContain('Unchecked input')
    fireEvent.click(screen.getByRole('button', { name: 'Open source chat' }))
    expect(open).toHaveBeenCalledWith('wf-review-two', 'Review: Other')
    const completed = structuredClone(value)
    completed.sequence++; completed.iterations = 2; completed.steps[0].status = 'completed'
    completed.steps[0].attempts.push({ id: 'attempt-two', number: 2, startedAt: 2, finishedAt: 3, stage: 'finished', status: 'completed', verification: [], targetFingerprint: 'b'.repeat(64), review: { outcome: 'approved', findings: [], summary: 'Both sources approved the correction' } })
    completed.finalization = { id: 'finalize-one', status: 'blocked', inputFingerprint: 'b'.repeat(64), error: 'Remote unavailable', receipt: { status: 'blocked', operations: [] } }
    act(() => test.push(completed))
    expect(screen.getByTestId('workflow-finalization').textContent).toContain('Remote unavailable')
    expect(screen.getByTestId('workflow-status').textContent).toBe('blocked')
  })

  it('resets plan and pending ownership on task change, ignoring the previous task save response', async () => {
    const test = fixture()
    const pending = deferred<WorkflowSnapshot>()
    test.api.save.mockImplementationOnce(() => pending.promise)
    const view = render(<ExecutablePlanPanel task={task('task-a')} {...props} />)
    await ready()
    fireEvent.click(screen.getByTestId('workflow-auto'))
    fireEvent.click(save())
    expect(save().disabled).toBe(true)
    view.rerender(<ExecutablePlanPanel task={task('task-b', 'Other')} {...props} />)
    await ready()
    expect(screen.queryByText('Original step')).toBeNull()
    expect((screen.getByTestId('workflow-coder') as HTMLSelectElement).value).toBe('Other')
    expect(start().disabled).toBe(true)
    await act(async () => pending.resolve(snapshot('task-a', 2, 2)))
    expect(screen.queryByText('Original step')).toBeNull()
    expect(save().disabled).toBe(false)
    await act(async () => fireEvent.click(save()))
    expect(test.api.save).toHaveBeenLastCalledWith(expect.objectContaining({ taskId: 'task-b', expectedRevision: 0,
      plan: expect.objectContaining({ title: 'Task task-b', coderPreset: 'Other', steps: [] }) }))
  })

  it('keeps a successful save revision when the following start fails, then retries start without resaving', async () => {
    const test = fixture()
    test.api.start.mockRejectedValueOnce(new Error('Provider is unavailable'))
    render(<ExecutablePlanPanel task={task('task-a')} {...props} />)
    await ready()
    fireEvent.click(screen.getByTestId('workflow-auto'))
    await act(async () => fireEvent.click(start()))
    expect(screen.getByRole('alert').textContent).toContain('Provider is unavailable')
    expect(screen.getByText('Revision 2')).not.toBeNull()
    expect(save().disabled).toBe(true)
    await act(async () => fireEvent.click(start()))
    expect(test.api.save).toHaveBeenCalledTimes(1)
    expect(test.api.start).toHaveBeenCalledTimes(2)
    for (const [request] of test.api.start.mock.calls) expect(request.revision).toBe(2)
    expect(screen.getByTestId('workflow-status').textContent).toBe('running')
  })

  it('updates a clean editor before starting a newer incoming plan revision', async () => {
    const test = fixture()
    render(<ExecutablePlanPanel task={task('task-a')} {...props} />)
    await ready()
    await act(async () => test.push(snapshot('task-a', 2, 4, plan('New server step'))))
    expect(screen.queryByText('Original step')).toBeNull()
    expect(screen.getByText('New server step')).not.toBeNull()
    expect(screen.getByText('Revision 2')).not.toBeNull()
    await act(async () => fireEvent.click(start()))
    expect(test.api.save).not.toHaveBeenCalled()
    expect(test.api.start).toHaveBeenCalledWith(expect.objectContaining({ taskId: 'task-a', revision: 2 }))
  })

  it('does not overwrite a newer event with an older successful save response', async () => {
    const test = fixture()
    const pending = deferred<WorkflowSnapshot>()
    test.api.save.mockImplementationOnce(() => pending.promise)
    render(<ExecutablePlanPanel task={task('task-a')} {...props} />)
    await ready()
    fireEvent.click(screen.getByTestId('workflow-auto'))
    fireEvent.click(save())
    await act(async () => test.push(snapshot('task-a', 3, 6, plan('Latest committed step'))))
    await act(async () => pending.resolve(snapshot('task-a', 2, 3, plan('Earlier save response'))))
    expect(screen.queryByText('Earlier save response')).toBeNull()
    expect(screen.getByText('Original step')).not.toBeNull()
    expect(start().disabled).toBe(true)
    fireEvent.click(screen.getByTestId('workflow-reload-plan'))
    expect(screen.getByText('Latest committed step')).not.toBeNull()
    expect(screen.getByText('Revision 3')).not.toBeNull()
    await act(async () => fireEvent.click(start()))
    expect(test.api.start).toHaveBeenCalledWith(expect.objectContaining({ revision: 3 }))
  })

  it('preserves dirty edits and refuses to start when a concurrent revision invalidates the save', async () => {
    const test = fixture()
    render(<ExecutablePlanPanel task={task('task-a')} {...props} />)
    await ready()
    fireEvent.click(screen.getByTestId('workflow-auto'))
    await act(async () => test.push(snapshot('task-a', 2, 4, plan('Another editor saved this'))))
    expect(screen.getByText('Original step')).not.toBeNull()
    expect((screen.getByTestId('workflow-auto') as HTMLInputElement).checked).toBe(true)
    expect(start().disabled).toBe(true)
    await act(async () => fireEvent.click(save()))
    expect(test.api.save).toHaveBeenCalledWith(expect.objectContaining({ expectedRevision: 1 }))
    expect(test.api.start).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toContain('changed elsewhere')
    expect(screen.getByText('Original step')).not.toBeNull()
    fireEvent.click(screen.getByTestId('workflow-reload-plan'))
    expect(screen.queryByText('Original step')).toBeNull()
    expect(screen.getByText('Another editor saved this')).not.toBeNull()
    expect(start().disabled).toBe(false)
  })

  it('locks edit and start controls for server running state, while pause awaits the server acknowledgement', async () => {
    const test = fixture()
    render(<ExecutablePlanPanel task={task('task-a')} {...props} />)
    await ready()
    const active: WorkflowSnapshot = { ...snapshot(), status: 'running', sequence: 3 }
    await act(async () => test.push(active))
    expect(start().disabled).toBe(true)
    expect(save().disabled).toBe(true)
    expect((screen.getByTestId('workflow-coder').closest('fieldset') as HTMLFieldSetElement).disabled).toBe(true)
    const response = deferred<WorkflowSnapshot>()
    test.api.pause.mockImplementationOnce(() => response.promise)
    fireEvent.click(screen.getByTestId('workflow-pause'))
    expect((screen.getByTestId('workflow-pause') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('workflow-status').textContent).toBe('running')
    await act(async () => response.resolve({ ...active, status: 'paused', sequence: 4 }))
    expect(screen.getByTestId('workflow-status').textContent).toBe('paused')
    expect(start().disabled).toBe(false)
    expect(screen.queryByTestId('workflow-pause')).toBeNull()
  })

  it('shows retained Multi stage evidence and opens the actual nested conversation without running it', async () => {
    const value = snapshot()
    value.plan.codeFlow = { version: 1, kind: 'multi-model', request: 'Bounded task' }
    value.plan.steps[0].codePhase = 'implementation'
    value.codeFlow = { artifacts: [{ id: 'review-document', name: 'review-summary.md', path: '/private/review-summary.md', sha256: 'a'.repeat(64), bytes: 12, version: 2, stepId: 'step-1', attemptId: 'attempt-1', createdAt: 1 }], answers: [] }
    value.steps[0].attempts = [{ id: 'attempt-1', number: 1, startedAt: 1, status: 'completed', stage: 'finished', verification: [], multiStages: [{
      id: 'coordinator-2', kind: 'review-coordinator', index: 1, cycle: 2, status: 'completed', targetFingerprint: 'reviewed-tree', output: 'Retained review evidence', artifactIds: ['review-document'],
      session: { sessionId: 'session-review', runId: 'run-review', chatId: 'wf-coordinator' },
    }] }]
    const test = fixture(value); const onOpenChat = vi.fn()
    render(<ExecutablePlanPanel task={task('task-a')} {...props} onOpenChat={onOpenChat} />)
    await ready()
    fireEvent.click(screen.getByRole('button', { name: /Original step/ }))
    const stage = screen.getByTestId('workflow-multi-stage-coordinator-2')
    expect(stage.textContent).toContain('Review synthesis 1 · Cycle 2')
    expect(stage.textContent).toContain('review-summary.md · v2')
    expect(stage.textContent).toContain('Retained review evidence')
    fireEvent.click(screen.getByRole('button', { name: 'Open stage chat' }))
    expect(onOpenChat).toHaveBeenCalledWith('wf-coordinator', 'Review synthesis 1 · Cycle 2')
    expect(test.api.start).not.toHaveBeenCalled(); expect(test.api.respond).not.toHaveBeenCalled()
  })

  it('saves a Multi policy edit without replacing custom role models, effort or stable source IDs', async () => {
    const value = snapshot()
    const configuration = { provider: 'codex' as const, model: 'custom-model', reasoningEffort: 'high', permissions: 'Read only' }
    value.plan.codeFlow = { version: 1, kind: 'multi-model', request: 'Task', planner: { id: 'planner-original', presetName: 'Coding' }, multi: {
      version: 1, reviewDecision: 'auto', explorers: [{ id: 'my-explorer', presetName: '@custom', configuration, instructions: 'Read selected interfaces' }],
      designers: [{ id: 'my-designer', presetName: 'Other', reasoningEffort: 'medium' }],
      reviewCoordinator: { id: 'my-coordinator', presetName: '@custom', configuration },
    } }
    value.plan.steps[0].codePhase = 'implementation'
    const test = fixture(value)
    render(<ExecutablePlanPanel task={task('task-a')} {...props} />)
    await ready()
    fireEvent.change(screen.getByTestId('workflow-multi-review-decision'), { target: { value: 'always' } })
    await act(async () => fireEvent.click(save()))
    const saved = test.api.save.mock.calls[0][0].plan
    expect(saved.codeFlow?.multi).toEqual({ ...value.plan.codeFlow.multi, reviewDecision: 'always' })
    expect(saved.codeFlow?.planner).toEqual(value.plan.codeFlow.planner)
    expect(test.api.start).not.toHaveBeenCalled()
  })
})
