/** @vitest-environment happy-dom */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WorkflowAPI, WorkflowSnapshot } from '../../../../shared/workflow'
import { CodeFlowPanel } from '../CodeFlowPanel'

const artifact = { id: 'artifact-1', name: 'spec.md', path: '/private/task-artifacts/spec-v1.md', version: 1, sha256: 'a'.repeat(64), bytes: 20, stepId: 'prepare', attemptId: 'attempt-1', createdAt: 1 }
const snapshot = (): WorkflowSnapshot => ({ schemaVersion: 1, taskId: 'task-1', runId: 'flow-1', revision: 4, sequence: 8, status: 'paused', iterations: 1, updatedAt: 1, commandIds: [],
  plan: { title: 'Code fixture', codeFlow: { version: 1, kind: 'spec-first', request: 'Build a small fixture' }, coderPreset: '@task', reviewerPreset: '@task', review: true, advance: 'manual', maxFailures: 3, maxIterations: 20, steps: [] }, steps: [],
  codeFlow: { artifacts: [artifact], answers: [], pending: { id: 'gate-1', kind: 'questions', stepId: 'prepare', attemptId: 'attempt-1', summary: 'Clarify before implementation', artifactIds: [artifact.id], questions: [{ id: 'behavior', question: 'Which behavior?', options: ['Strict', 'Permissive'] }] } },
})
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(accept => { resolve = accept }); return { promise, resolve } }
const props = { ru: false, workspace: '/private/task-worktree', disabled: false, onSnapshot: vi.fn(), onBusy: vi.fn() }
let api: { get: ReturnType<typeof vi.fn<WorkflowAPI['get']>>; respond: ReturnType<typeof vi.fn<WorkflowAPI['respond']>>; discuss: ReturnType<typeof vi.fn<WorkflowAPI['discuss']>>; readArtifact: ReturnType<typeof vi.fn<WorkflowAPI['readArtifact']>> }

describe('Code workflow documents and durable human decisions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const values = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) })
    api = { get: vi.fn<WorkflowAPI['get']>().mockRejectedValue(new Error('Connection unavailable')), respond: vi.fn<WorkflowAPI['respond']>(), discuss: vi.fn<WorkflowAPI['discuss']>(), readArtifact: vi.fn<WorkflowAPI['readArtifact']>(async () => ({ name: artifact.name, content: '# Prepared specification\n\n**Verified bytes**', sha256: artifact.sha256, version: 1 })) }
    Object.defineProperty(window, 'ziafAPI', { configurable: true, value: { workflows: api } })
  })
  afterEach(() => { cleanup(); vi.unstubAllGlobals() })

  it('edits a document as a new hashed discussion revision, without implicitly accepting it', async () => {
    const value = snapshot(); value.plan.codeFlow!.interaction = { version: 1 }
    value.codeFlow!.pending = { ...value.codeFlow!.pending!, kind: 'document', phase: 'specification', questions: undefined, artifactHashes: [{ id: artifact.id, sha256: artifact.sha256 }] }
    api.discuss.mockImplementation(async request => ({ ...value, sequence: 9, commandIds: [request.commandId], codeFlow: { ...value.codeFlow!, discussions: [{ ...request }] } }))
    render(<CodeFlowPanel snapshot={value} {...props} />)
    expect(screen.getByRole('heading', { name: 'Accept this document version' })).toBeTruthy()
    fireEvent.click(screen.getByTestId('code-artifact-open-artifact-1'))
    await screen.findByRole('heading', { name: 'Prepared specification' })
    fireEvent.click(screen.getByTestId('code-artifact-edit-artifact-1'))
    fireEvent.change(screen.getByTestId('code-artifact-editor-artifact-1'), { target: { value: '# My technical choice\nUse local storage.' } })
    fireEvent.click(screen.getByTestId('code-artifact-save-artifact-1'))
    await waitFor(() => expect(api.discuss).toHaveBeenCalledTimes(1))
    expect(api.discuss).toHaveBeenCalledWith(expect.objectContaining({ revision: 4, artifactEdits: [{ artifactId: artifact.id, expectedSha256: artifact.sha256, content: '# My technical choice\nUse local storage.' }] }))
    expect(api.respond).not.toHaveBeenCalled()
    expect(screen.getByTestId('code-artifact-content-artifact-1').textContent).toContain('Verified bytes')
  })

  it('restores a human plan proposal and approves only implementation fields in the edited order', async () => {
    const value = snapshot(); value.codeFlow!.pending = { ...value.codeFlow!.pending!, kind: 'plan', questions: undefined, proposedSteps: [
      { id: 'first', title: 'First change', instructions: 'First instructions', acceptance: ['First outcome'], verification: [], dependsOn: [], newContext: true, stopAfter: false, codePhase: 'implementation' },
      { id: 'second', title: 'Second change', instructions: 'Second instructions', acceptance: ['Second outcome'], verification: [], dependsOn: ['first'], newContext: true, stopAfter: false, codePhase: 'implementation' },
      { id: 'delivery', title: 'Host delivery', instructions: 'Summarize', acceptance: ['Report'], verification: [], dependsOn: ['second'], newContext: true, stopAfter: false, codePhase: 'delivery' },
    ] }
    let view = render(<CodeFlowPanel snapshot={value} {...props} />)
    fireEvent.change(screen.getByTestId('code-proposal-title-1'), { target: { value: 'My reordered change' } })
    fireEvent.click(screen.getByRole('button', { name: 'Move step 2 up' }))
    view.unmount(); view = render(<CodeFlowPanel snapshot={value} {...props} />)
    expect((screen.getByTestId('code-proposal-title-0') as HTMLInputElement).value).toBe('My reordered change')
    expect(screen.queryByText('Host delivery')).toBeNull()
    api.respond.mockResolvedValue({ ...value, sequence: 9 })
    fireEvent.click(screen.getByTestId('code-gate-approve'))
    await waitFor(() => expect(api.respond).toHaveBeenCalledTimes(1))
    expect(api.respond.mock.calls[0][0].proposedSteps).toEqual([
      { title: 'My reordered change', instructions: 'Second instructions', acceptance: ['Second outcome'], verification: [] },
      { title: 'First change', instructions: 'First instructions', acceptance: ['First outcome'], verification: [] },
    ])
  })

  it('reads only the clicked artifact by identity and renders safe Markdown with its actual receipt', async () => {
    render(<CodeFlowPanel snapshot={snapshot()} {...props} />)
    expect(api.readArtifact).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('code-artifact-open-artifact-1'))
    await screen.findByRole('heading', { name: 'Prepared specification' })
    expect(api.readArtifact).toHaveBeenCalledWith({ taskId: 'task-1', artifactId: 'artifact-1' })
    expect(screen.getByTestId('code-artifact-artifact-1').textContent).toContain('/private/task-artifacts/spec-v1.md')
    expect(screen.getByTestId('code-artifact-artifact-1').textContent).toContain(artifact.sha256)
    expect(api.respond).not.toHaveBeenCalled()
  })

  it('refuses a changed document receipt instead of displaying unverified contents', async () => {
    api.readArtifact.mockResolvedValue({ name: 'spec.md', content: 'Unverified replacement', sha256: 'b'.repeat(64), version: 1 })
    render(<CodeFlowPanel snapshot={snapshot()} {...props} />)
    fireEvent.click(screen.getByTestId('code-artifact-open-artifact-1'))
    expect((await screen.findByRole('alert')).textContent).toContain('receipt changed')
    expect(screen.queryByText('Unverified replacement')).toBeNull()
  })

  it('restores an unsent answer, then retries the exact response after a lost ACK and remount', async () => {
    api.respond.mockRejectedValueOnce(new Error('Connection closed before ACK'))
    const value = snapshot()
    let view = render(<CodeFlowPanel snapshot={value} {...props} />)
    fireEvent.change(screen.getByTestId('code-question-behavior'), { target: { value: 'Keep strict validation' } })
    view.unmount()
    view = render(<CodeFlowPanel snapshot={value} {...props} />)
    expect((screen.getByTestId('code-question-behavior') as HTMLTextAreaElement).value).toBe('Keep strict validation')
    expect(api.respond).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('code-gate-answer'))
    await screen.findByRole('alert')
    const first = api.respond.mock.calls[0][0]
    expect(first).toMatchObject({ taskId: value.taskId, revision: 4, gateId: 'gate-1', action: 'answer' })
    expect(first.text).toContain('Keep strict validation')
    view.unmount()
    render(<CodeFlowPanel snapshot={value} {...props} />)
    const accepted = { ...value, sequence: 9, status: 'running' as const, codeFlow: { ...value.codeFlow!, pending: undefined } }
    api.respond.mockResolvedValue(accepted)
    fireEvent.click(screen.getByTestId('code-gate-retry'))
    await waitFor(() => expect(props.onSnapshot).toHaveBeenCalledWith(accepted))
    expect(api.respond.mock.calls[1][0]).toEqual(first)
    expect(props.onBusy).toHaveBeenLastCalledWith('gate-1', false)
  })

  it('shows exact proposed checks before consent and requires verification or review', async () => {
    const value = snapshot()
    value.plan.review = false
    value.codeFlow!.pending = { ...value.codeFlow!.pending!, kind: 'plan', questions: undefined, proposedSteps: [
      { id: 'implement-1', title: 'Implement identifier', instructions: 'Make a bounded change', acceptance: ['Checks pass'], dependsOn: [], verification: [], newContext: true, stopAfter: false },
      { id: 'implement-2', title: 'Test identifier', instructions: 'Exercise edge cases', acceptance: ['No dependencies'], dependsOn: ['implement-1'], verification: [{ executable: '/usr/bin/node', args: ['--test', 'identifier.test.cjs'], timeoutMs: 15000 }], newContext: true, stopAfter: false },
    ] }
    const view = render(<CodeFlowPanel snapshot={value} {...props} />)
    const proposal = screen.getByTestId('code-proposed-step-1').textContent
    expect(proposal).toContain('/usr/bin/node'); expect(proposal).toContain('identifier.test.cjs'); expect(proposal).toContain('15000'); expect(proposal).toContain('/private/task-worktree')
    expect((screen.getByTestId('code-gate-approve') as HTMLButtonElement).disabled).toBe(true)
    expect(api.respond).not.toHaveBeenCalled()
    const saved = { ...value, revision: 5, plan: { ...value.plan, review: true } }
    view.rerender(<CodeFlowPanel snapshot={saved} {...props} />)
    api.respond.mockResolvedValue({ ...saved, sequence: 10 })
    await act(async () => fireEvent.click(screen.getByTestId('code-gate-approve')))
    expect(api.respond).toHaveBeenCalledWith(expect.objectContaining({ action: 'approve', revision: 5 }))
  })

  it('allows editing after the backend barrier proves a decision was rejected', async () => {
    api.respond.mockRejectedValueOnce(new Error('The workflow decision changed. Reload before responding.'))
    const current = { ...snapshot(), revision: 5, sequence: 9 }
    api.get.mockResolvedValue(current)
    render(<CodeFlowPanel snapshot={snapshot()} {...props} />)
    fireEvent.change(screen.getByTestId('code-question-behavior'), { target: { value: 'Original answer' } })
    fireEvent.click(screen.getByTestId('code-gate-answer'))
    await waitFor(() => expect(props.onSnapshot).toHaveBeenCalledWith(current))
    expect(screen.queryByTestId('code-gate-retry')).toBeNull()
    expect((screen.getByTestId('code-question-behavior') as HTMLTextAreaElement).disabled).toBe(false)
    expect((screen.getByTestId('code-question-behavior') as HTMLTextAreaElement).value).toBe('Original answer')
  })

  it('does not require a verification command on the delivery document when implementation has checks', async () => {
    const value = snapshot()
    value.plan.review = false
    value.codeFlow!.pending = { ...value.codeFlow!.pending!, kind: 'plan', questions: undefined, proposedSteps: [
      { id: 'implement', codePhase: 'implementation', title: 'Implement', instructions: 'Bounded change', acceptance: ['Tests pass'], dependsOn: [], verification: [{ executable: '/usr/bin/true', args: [], timeoutMs: 1000 }], newContext: true, stopAfter: false },
      { id: 'delivery', codePhase: 'delivery', title: 'Delivery report', instructions: 'Summarize evidence', acceptance: ['Real report'], dependsOn: ['implement'], verification: [], newContext: true, stopAfter: false },
    ] }
    api.respond.mockResolvedValue(value)
    render(<CodeFlowPanel snapshot={value} {...props} />)
    expect((screen.getByTestId('code-gate-approve') as HTMLButtonElement).disabled).toBe(false)
    await act(async () => fireEvent.click(screen.getByTestId('code-gate-approve')))
    expect(api.respond).toHaveBeenCalledTimes(1)
  })

  it('closes pending ownership on unmount and ignores the old response and document load', async () => {
    const reply = deferred<WorkflowSnapshot>()
    const read = deferred<Awaited<ReturnType<WorkflowAPI['readArtifact']>>>()
    api.respond.mockReturnValue(reply.promise); api.readArtifact.mockReturnValue(read.promise)
    const view = render(<CodeFlowPanel snapshot={snapshot()} {...props} />)
    fireEvent.click(screen.getByTestId('code-artifact-open-artifact-1'))
    fireEvent.change(screen.getByTestId('code-question-behavior'), { target: { value: 'Strict' } })
    fireEvent.click(screen.getByTestId('code-gate-answer'))
    view.unmount()
    expect(props.onBusy).toHaveBeenLastCalledWith('gate-1', false)
    await act(async () => { reply.resolve(snapshot()); read.resolve({ name: artifact.name, version: 1, content: 'Late response', sha256: artifact.sha256 }) })
    expect(props.onSnapshot).not.toHaveBeenCalled()
    expect(screen.queryByText('Late response')).toBeNull()
  })

  it('keeps stop distinct from approval and does not offer an unsupported second fixer attempt', async () => {
    const value = snapshot()
    value.codeFlow!.pending!.kind = 'review'; value.codeFlow!.pending!.questions = undefined
    value.codeFlow!.fix = { stepId: 'prepare', reviewAttemptId: 'attempt-1', authorized: true, attemptId: 'fix-1' }
    api.respond.mockResolvedValue(value)
    render(<CodeFlowPanel snapshot={value} {...props} />)
    expect((screen.getByTestId('code-gate-approve') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByTestId('code-gate-changes')).toBeNull()
    await act(async () => fireEvent.click(screen.getByTestId('code-gate-cancel')))
    expect(api.respond).toHaveBeenCalledWith(expect.objectContaining({ action: 'cancel' }))
  })

  it('acknowledges suggestions without offering another fixer when the review is approved', async () => {
    const value = snapshot()
    value.codeFlow!.pending = { ...value.codeFlow!.pending!, kind: 'review', reviewOutcome: 'approved', questions: undefined }
    value.codeFlow!.fix = { stepId: 'prepare', reviewAttemptId: 'attempt-1', authorized: true, attemptId: 'fix-1' }
    api.respond.mockResolvedValue(value)
    render(<CodeFlowPanel snapshot={value} {...props} />)
    const approve = screen.getByRole('button', { name: 'Acknowledge and continue' }) as HTMLButtonElement
    expect(approve.disabled).toBe(false)
    await act(async () => fireEvent.click(approve))
    expect(api.respond).toHaveBeenCalledWith(expect.objectContaining({ action: 'approve' }))
  })

  it.each([
    ['code-gate-approve', 'approve'], ['code-gate-skip-review', 'changes'], ['code-gate-cancel', 'cancel'],
  ] as const)('keeps review decision %s explicit without requiring invented feedback', async (id, action) => {
    const value = snapshot()
    value.plan.codeFlow!.kind = 'multi-model'
    value.codeFlow!.pending = { ...value.codeFlow!.pending!, kind: 'review-decision', questions: undefined }
    api.respond.mockResolvedValue(value)
    render(<CodeFlowPanel snapshot={value} {...props} />)
    expect(api.respond).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Run independent review' })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Skip review and continue' })).not.toBeNull()
    await act(async () => fireEvent.click(screen.getByTestId(id)))
    expect(api.respond).toHaveBeenCalledWith(expect.objectContaining({ action, gateId: 'gate-1', revision: 4 }))
  })

  it('does not advertise native re-review for a historical Multi definition', () => {
    const value = snapshot()
    value.status = 'completed'; value.plan.codeFlow!.kind = 'multi-model'; value.codeFlow!.pending = undefined
    render(<CodeFlowPanel snapshot={value} {...props} />)
    expect(screen.queryByTestId('code-rereview')).toBeNull()
  })

  it('sends explicit review feedback without authorizing a fixer', async () => {
    const value = snapshot()
    value.plan.codeFlow!.kind = 'multi-model'; value.plan.codeFlow!.multi = { version: 1 }
    value.codeFlow!.pending = { ...value.codeFlow!.pending!, kind: 'review', reviewOutcome: 'changes_requested', questions: undefined }
    api.respond.mockResolvedValue(value)
    render(<CodeFlowPanel snapshot={value} {...props} />)
    expect((screen.getByTestId('code-gate-review-feedback') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByTestId('code-gate-comments'), { target: { value: 'Reconsider this finding against the existing evidence.' } })
    fireEvent.click(screen.getByTestId('code-gate-review-feedback'))
    await waitFor(() => expect(api.respond).toHaveBeenCalledTimes(1))
    expect(api.respond.mock.calls[0][0]).toMatchObject({ action: 'changes', gateId: 'gate-1', text: 'Reconsider this finding against the existing evidence.' })
  })

  it('starts a completed Multi review only after explicit action and retries the same intent after unknown ACK', async () => {
    const value = snapshot()
    value.status = 'completed'; value.plan.codeFlow!.kind = 'multi-model'; value.plan.codeFlow!.multi = { version: 1 }; value.codeFlow!.pending = undefined
    api.respond.mockRejectedValueOnce(new Error('Unknown ACK'))
    const view = render(<CodeFlowPanel snapshot={value} {...props} />)
    expect(api.respond).not.toHaveBeenCalled()
    expect(screen.queryByTestId('code-gate-skip-review')).toBeNull()
    fireEvent.click(screen.getByTestId('code-rereview'))
    await screen.findByRole('alert')
    const request = api.respond.mock.calls[0][0]
    expect(request).toMatchObject({ taskId: 'task-1', revision: 4, gateId: 'completed-review', action: 'rereview' })
    view.unmount()
    render(<CodeFlowPanel snapshot={value} {...props} />)
    api.respond.mockResolvedValue({ ...value, status: 'running', sequence: 9 })
    await act(async () => fireEvent.click(screen.getByTestId('code-gate-retry')))
    expect(api.respond.mock.calls[1][0]).toEqual(request)
    expect(props.onSnapshot).toHaveBeenCalledWith(expect.objectContaining({ status: 'running' }))
  })

  it('does not reuse a completed re-review receipt as another requested review after reopening', async () => {
    const value = snapshot()
    value.status = 'completed'; value.plan.codeFlow!.kind = 'multi-model'; value.plan.codeFlow!.multi = { version: 1 }; value.codeFlow!.pending = undefined
    value.commandIds = ['accepted-review']
    localStorage.setItem('ziaforge-code-gate:task-1:flow-1:completed-review', JSON.stringify({ request: { taskId: 'task-1', revision: 3, gateId: 'completed-review', commandId: 'accepted-review', action: 'rereview' } }))
    render(<CodeFlowPanel snapshot={value} {...props} />)
    await waitFor(() => expect(screen.queryByTestId('code-gate-retry')).toBeNull())
    expect(screen.getByTestId('code-rereview')).not.toBeNull()
    expect(api.respond).not.toHaveBeenCalled()
  })

  it('allows one new correction for an explicitly requested later review cycle', async () => {
    const value = snapshot()
    value.plan.codeFlow!.kind = 'multi-model'
    value.codeFlow!.pending = { ...value.codeFlow!.pending!, kind: 'review', attemptId: 'attempt-2', reviewOutcome: 'changes_requested', questions: undefined }
    value.codeFlow!.multi = { reviewCycle: 2, fixCycle: 1 }
    value.codeFlow!.fix = { stepId: 'prepare', reviewAttemptId: 'attempt-1', authorized: true, attemptId: 'fix-1', cycle: 1 }
    api.respond.mockResolvedValue(value)
    render(<CodeFlowPanel snapshot={value} {...props} />)
    expect((screen.getByTestId('code-gate-approve') as HTMLButtonElement).disabled).toBe(false)
    expect(screen.getByRole('button', { name: 'Approve one correction' })).not.toBeNull()
    await act(async () => fireEvent.click(screen.getByTestId('code-gate-approve')))
    expect(api.respond).toHaveBeenCalledWith(expect.objectContaining({ action: 'approve', gateId: 'gate-1' }))
  })
})
