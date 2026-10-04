// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WorkFlowAPI, WorkFlowSnapshot } from '../../../../shared/work-flow'
import { useStore, type Task } from '../../../store'
import { WorkFlowPanel } from '../WorkFlowPanel'

vi.mock('../WorkflowAgentSelector', () => ({ WorkflowAgentSelector: ({ label }: { label: string }) => <div>{label}</div> }))
const task: Task = { id: 'work-a', repoId: 'folder-a', name: 'Work', status: 'idle', logs: [], feed: [], todoSteps: [], gitChanges: [], mode: 'work', workFlowVersion: 1, worktreePath: '/registered/task' }
function snapshot(): WorkFlowSnapshot {
  return { schemaVersion: 1, taskId: task.id, runId: 'work-run', revision: 1, sequence: 1, updatedAt: 1, status: 'draft', stages: [], artifacts: [], sources: [], decisions: [], commandReceipts: [], round: 0, turns: 0, failures: 0,
    definition: { version: 1, kind: 'auto', request: 'Write a useful answer', advance: 'auto', executor: { id: 'executor', presetName: '@task' }, review: false, reviewers: [], inputs: [], limits: { maxTurns: 30, maxFailures: 3, maxFollowUps: 5 } } }
}
function apiFixture() {
  return { get: vi.fn<WorkFlowAPI['get']>().mockResolvedValue(snapshot()), save: vi.fn<WorkFlowAPI['save']>(), start: vi.fn<WorkFlowAPI['start']>(), respond: vi.fn<WorkFlowAPI['respond']>(), followUp: vi.fn<WorkFlowAPI['followUp']>(), pause: vi.fn<WorkFlowAPI['pause']>(), readArtifact: vi.fn<WorkFlowAPI['readArtifact']>(), openArtifact: vi.fn<WorkFlowAPI['openArtifact']>(), onEvent: vi.fn<WorkFlowAPI['onEvent']>(() => () => {}) } satisfies WorkFlowAPI
}
beforeEach(() => { localStorage.clear(); useStore.setState({ presets: [], settings: null }) })
afterEach(cleanup)

describe('Work decisions and saved results', () => {
  it('does not invent a plan for a direct answer and retains review-free human report decisions', () => {
    const state = snapshot(); state.status = 'waiting'; state.pending = { id: 'report', kind: 'artifact-review', stageId: 'write', summary: 'Read the result', artifactIds: [], actions: ['approve', 'approve-with-comments', 'changes', 'cancel'] }
    state.definition.executor = { id: 'executor', presetName: '@custom', configuration: { provider: 'codex', model: 'saved-model', permissions: 'Workspace write' } }
    state.definition.roleLabels = { 'executor:executor': 'Original coding preset' }
    render(<WorkFlowPanel task={task} snapshot={state} api={apiFixture()} onSnapshot={vi.fn()} onOpenChat={vi.fn()} onClose={vi.fn()} />)
    expect(screen.queryByTestId('work-flow-plan')).toBeNull()
    expect(screen.getByTestId('work-flow-no-plan')).not.toBeNull()
    expect(screen.getByTestId('work-gate-approve')).not.toBeNull()
    expect(screen.getByText('Preset snapshot Original coding preset')).not.toBeNull()
    expect(screen.getByTestId('work-flow-gate').textContent).toContain('Review the result')
    expect((screen.getByTestId('work-gate-changes') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByTestId('work-gate-comments'), { target: { value: 'Keep this comment, no rework' } })
    expect((screen.getByTestId('work-gate-approve-with-comments') as HTMLButtonElement).disabled).toBe(false)
  })

  it('retries an unknown question response with the same exact command after remount', async () => {
    const state = snapshot(); state.status = 'waiting'; state.pending = { id: 'questions', kind: 'questions', stageId: 'worker-2', summary: 'Need constraints', artifactIds: [], actions: ['answer', 'cancel'], questions: [{ id: 'audience', question: 'Who reads this?', stageIds: ['worker-2'] }] }
    const api = apiFixture(); api.respond.mockRejectedValueOnce(new Error('ACK missing')); api.get.mockRejectedValue(new Error('offline'))
    const first = render(<WorkFlowPanel task={task} snapshot={state} api={api} onSnapshot={vi.fn()} onOpenChat={vi.fn()} onClose={vi.fn()} />)
    fireEvent.change(screen.getByTestId('work-question-audience'), { target: { value: 'New users' } })
    await act(async () => fireEvent.click(screen.getByTestId('work-gate-answer')))
    const sent = api.respond.mock.calls[0][0]
    expect(sent.answers).toEqual([{ questionId: 'audience', text: 'New users' }])
    first.unmount()
    api.respond.mockResolvedValueOnce({ ...state, sequence: 2, status: 'running', pending: undefined, commandReceipts: [{ commandId: sent.commandId, payloadHash: 'a'.repeat(64) }] })
    render(<WorkFlowPanel task={task} snapshot={state} api={api} onSnapshot={vi.fn()} onOpenChat={vi.fn()} onClose={vi.fn()} />)
    expect((screen.getByTestId('work-question-audience') as HTMLTextAreaElement).value).toBe('New users')
    await act(async () => fireEvent.click(screen.getByTestId('work-gate-retry')))
    expect(api.respond.mock.calls[1][0]).toEqual(sent)
  })

  it('unlocks rejected gate text only after a successful command barrier, without losing the answer', async () => {
    const state = snapshot(); state.status = 'waiting'; state.pending = { id: 'report', kind: 'artifact-review', stageId: 'draft', summary: 'Review', artifactIds: [], actions: ['changes', 'cancel'] }
    const api = apiFixture(); api.respond.mockRejectedValue(new Error('Artifact changed')); api.get.mockResolvedValue(state)
    render(<WorkFlowPanel task={task} snapshot={state} api={api} onSnapshot={vi.fn()} onOpenChat={vi.fn()} onClose={vi.fn()} />)
    fireEvent.change(screen.getByTestId('work-gate-comments'), { target: { value: 'Shorten the introduction' } })
    await act(async () => fireEvent.click(screen.getByTestId('work-gate-changes')))
    expect((screen.getByTestId('work-gate-comments') as HTMLTextAreaElement).value).toBe('Shorten the introduction')
    expect((screen.getByTestId('work-gate-comments') as HTMLTextAreaElement).disabled).toBe(false)
    expect(screen.queryByTestId('work-gate-retry')).toBeNull()
  })

  it('starts a saved edited draft with the new revision and shows concrete verification commands before approval', async () => {
    const state = snapshot(); const api = apiFixture(); const next = { ...state, revision: 2, sequence: 2, definition: { ...state.definition, request: 'Updated request' } }
    api.save.mockResolvedValue(next); api.start.mockResolvedValue({ ...next, status: 'running', sequence: 3 })
    const view = render(<WorkFlowPanel task={task} snapshot={state} api={api} onSnapshot={vi.fn()} onOpenChat={vi.fn()} onClose={vi.fn()} />)
    fireEvent.change(screen.getByTestId('work-flow-request'), { target: { value: 'Updated request' } })
    await act(async () => fireEvent.click(screen.getByTestId('work-flow-start')))
    expect(api.save).toHaveBeenCalledWith(expect.objectContaining({ expectedRevision: 1, definition: expect.objectContaining({ request: 'Updated request' }) }))
    expect(api.start).toHaveBeenCalledWith(expect.objectContaining({ revision: 2 }))
    view.unmount()
    const gate = { ...state, status: 'waiting' as const, pending: { id: 'plan', kind: 'plan' as const, stageId: 'intake', summary: 'Proposed plan', artifactIds: [], actions: ['approve' as const], proposedSteps: [{ id: 'step', title: 'Create notes', instructions: 'Write notes.md', acceptance: ['Readable notes'], status: 'pending' as const, verification: [{ executable: '/bin/test', args: ['-s', 'notes.md'], timeoutMs: 1000 }] }] } }
    render(<WorkFlowPanel task={task} snapshot={gate} api={api} onSnapshot={vi.fn()} onOpenChat={vi.fn()} onClose={vi.fn()} />)
    await waitFor(() => expect(screen.getByTestId('work-proposed-command').textContent).toContain('/registered/task'))
    expect(screen.getByTestId('work-proposed-command').textContent).toContain('notes.md')
    expect(api.respond).not.toHaveBeenCalled()
  })
})
