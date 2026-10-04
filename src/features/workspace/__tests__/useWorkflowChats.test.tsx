// @vitest-environment happy-dom
import { StrictMode } from 'react'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChatHistory, LegacyZiafAPI } from '../../../../shared/legacy-ipc'
import type { WorkflowAPI, WorkflowSnapshot, WorkflowStepState } from '../../../../shared/workflow'
import { useTaskChatHistory } from '../useTaskChatHistory'
import { useWorkflowChats, workflowChats } from '../useWorkflowChats'

const main = { id: 'chat-main', name: 'Discussion Feed', type: 'chat' as const }
const tab = (id: string) => ({ id, name: id, type: 'chat' as const })
const session = (chatId: string) => ({ chatId, sessionId: `session-${chatId}`, runId: `run-${chatId}` })
function snapshot(sequence = 1, current = 'discovery', taskId = 'task-a'): WorkflowSnapshot {
  const names = current === 'discovery' ? ['discovery'] : ['discovery', current]
  return {
    schemaVersion: 1, taskId, runId: 'workflow-run', revision: 1, sequence, updatedAt: sequence, status: 'running', iterations: names.length, commandIds: [],
    plan: { title: 'Code', codeFlow: { version: 1, kind: 'auto', request: 'Task' }, coderPreset: '@task', review: false, advance: 'auto', maxFailures: 3, maxIterations: 50,
      steps: names.map(id => ({ id, title: id, instructions: '', acceptance: [], dependsOn: [], verification: [], newContext: true, stopAfter: false, codePhase: id === 'discovery' ? 'discovery' : 'implementation' })) },
    steps: names.map(id => ({ id, status: id === current ? 'running' : 'completed', failures: 0, attempts: [{ id: `attempt-${id}`, number: 1, startedAt: 1, status: id === current ? 'running' : 'completed', stage: id === current ? 'implementation' : 'finished', session: session(`wf-${id}`), verification: [] }] })) as WorkflowStepState[],
  }
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(yes => { resolve = yes }); return { promise, resolve } }
function fixture() {
  const disk = new Map<string, ChatHistory>()
  const callbacks = new Set<(value: WorkflowSnapshot) => void>()
  const api = {
    getChatHistory: vi.fn<LegacyZiafAPI['getChatHistory']>(async id => structuredClone(disk.get(id) ?? { centralTabs: [main], customTabFeeds: {} })),
    saveChatHistory: vi.fn<LegacyZiafAPI['saveChatHistory']>(async value => { disk.set(value.taskId, structuredClone(value)); return { success: true } }),
  }
  const workflows = {
    get: vi.fn<WorkflowAPI['get']>(async () => snapshot()),
    onEvent: vi.fn<WorkflowAPI['onEvent']>(callback => { callbacks.add(callback); return () => { callbacks.delete(callback) } }),
    start: vi.fn(), respond: vi.fn(), discuss: vi.fn(), save: vi.fn(), pause: vi.fn(), readArtifact: vi.fn(),
  } satisfies WorkflowAPI
  const emit = (value: WorkflowSnapshot) => { for (const callback of callbacks) callback(value) }
  const useView = (taskId = 'task-a', enabled = true) => {
    const history = useTaskChatHistory(taskId, [], api)
    const chats = useWorkflowChats(taskId, enabled, history, false, workflows)
    return { history, chats }
  }
  return { api, workflows, emit, useView, disk }
}
beforeEach(() => localStorage.clear())
afterEach(cleanup)

describe('durable workflow conversations in the task workspace', () => {
  it('keeps the Forge conversation stable across stages and retains retired execution references', async () => {
    const f = fixture(); const firstValue = snapshot(); firstValue.plan.codeFlow!.interaction = { version: 1 }
    f.workflows.get.mockResolvedValue(firstValue)
    const view = renderHook(() => f.useView())
    await waitFor(() => expect(view.result.current.history.activeTabId).toBe('forge-discussion'))
    const revised = snapshot(3, 'implementation'); revised.plan.codeFlow!.interaction = { version: 1 }
    revised.codeFlow = { artifacts: [], answers: [], retiredSteps: [{ step: { ...firstValue.plan.steps[0], id: 'old-requirements', title: 'Old requirements' },
      state: { ...firstValue.steps[0], id: 'old-requirements', attempts: [{ ...firstValue.steps[0].attempts[0], session: session('wf-old-requirements') }] }, commandId: 'revision-command', reason: 'User revised requirements', at: 2 }] }
    act(() => f.emit(revised))
    await waitFor(() => expect(view.result.current.history.centralTabs.some(item => item.id === 'wf-old-requirements')).toBe(true))
    expect(view.result.current.history.activeTabId).toBe('forge-discussion')
    act(() => {
      view.result.current.chats.select('wf-discovery')
      view.result.current.history.update(current => ({ ...current, activeTabId: 'wf-discovery' }), true)
      f.emit({ ...revised, sequence: 4 })
    })
    expect(view.result.current.history.activeTabId).toBe('wf-discovery')
    expect(f.workflows.discuss).not.toHaveBeenCalled()
  })

  it('waits for saved tabs before opening the first phase once, without executing the workflow', async () => {
    const f = fixture(); const loading = deferred<ChatHistory>()
    f.api.getChatHistory.mockReturnValue(loading.promise)
    const view = renderHook(() => f.useView(), { wrapper: StrictMode })
    await act(async () => {})
    expect(view.result.current.history.activeTabId).toBe('chat-main')
    expect(f.api.saveChatHistory).not.toHaveBeenCalled()
    await act(async () => loading.resolve({ centralTabs: [main], customTabFeeds: {}, drafts: { 'chat-main': 'unsent' } }))
    await waitFor(() => expect(view.result.current.history.activeTabId).toBe('wf-discovery'))
    expect(view.result.current.history.centralTabs.map(item => item.id)).toEqual(['chat-main', 'wf-discovery'])
    expect(f.disk.get('task-a')).toMatchObject({ activeTabId: 'wf-discovery', drafts: { 'chat-main': 'unsent' } })
    expect(f.workflows.start).not.toHaveBeenCalled(); expect(f.workflows.respond).not.toHaveBeenCalled(); expect(f.workflows.save).not.toHaveBeenCalled()
  })

  it('follows later phase events without a Plan panel and rejects stale loads and other-task events', async () => {
    const f = fixture(); const loading = deferred<WorkflowSnapshot | null>()
    f.workflows.get.mockReturnValue(loading.promise)
    const view = renderHook(() => f.useView())
    await act(async () => f.emit(snapshot(4, 'implementation')))
    await waitFor(() => expect(view.result.current.history.activeTabId).toBe('wf-implementation'))
    await act(async () => { loading.resolve(snapshot(1)); f.emit(snapshot(10, 'other', 'task-b')); f.emit(snapshot(3, 'stale')) })
    expect(view.result.current.history.centralTabs.map(item => item.id)).toEqual(['chat-main', 'wf-discovery', 'wf-implementation'])
    expect(view.result.current.history.activeTabId).toBe('wf-implementation')
  })

  it('respects manual reading and drafts across restart, with explicit Follow reopening only the current phase', async () => {
    const f = fixture(); const first = renderHook(() => f.useView())
    await waitFor(() => expect(first.result.current.history.activeTabId).toBe('wf-discovery'))
    act(() => {
      first.result.current.chats.select('chat-main')
      first.result.current.history.update(value => ({ ...value, activeTabId: 'chat-main', drafts: { 'chat-main': 'Keep my question' } }), true)
      f.emit(snapshot(2, 'implementation'))
    })
    await waitFor(() => expect(first.result.current.history.centralTabs).toHaveLength(3))
    expect(first.result.current.history.activeTabId).toBe('chat-main')
    first.unmount()
    f.workflows.get.mockResolvedValue(snapshot(3, 'implementation'))
    const second = renderHook(() => f.useView())
    await waitFor(() => expect(second.result.current.history.hydrated).toBe(true))
    expect(second.result.current.history.activeTabId).toBe('chat-main')
    expect(second.result.current.chats.following).toBe(false)
    act(() => second.result.current.chats.follow())
    await waitFor(() => expect(second.result.current.history.activeTabId).toBe('wf-implementation'))
    expect(second.result.current.history.drafts).toEqual({ 'chat-main': 'Keep my question' })
  })

  it('keeps explicitly closed phase chats closed after new events and a full remount', async () => {
    const f = fixture(); f.disk.set('task-a', { centralTabs: [main], activeTabId: 'chat-main', recentTabs: [tab('wf-discovery')], customTabFeeds: {} })
    localStorage.setItem('ziaf-follow-workflow:task-a', 'false')
    const first = renderHook(() => f.useView())
    await waitFor(() => expect(first.result.current.history.hydrated).toBe(true))
    act(() => f.emit(snapshot(2, 'implementation')))
    await waitFor(() => expect(first.result.current.history.centralTabs.map(item => item.id)).toEqual(['chat-main', 'wf-implementation']))
    first.unmount()
    f.workflows.get.mockResolvedValue(snapshot(2, 'implementation'))
    const again = renderHook(() => f.useView())
    await waitFor(() => expect(again.result.current.history.hydrated).toBe(true))
    expect(again.result.current.history.recentTabs.map(item => item.id)).toEqual(['wf-discovery'])
    expect(again.result.current.history.centralTabs.map(item => item.id)).not.toContain('wf-discovery')
  })

  it('restores the followed current phase after restart but does not populate another task or legacy/Work views', async () => {
    const f = fixture(); f.disk.set('task-a', { centralTabs: [main, tab('wf-discovery')], activeTabId: 'wf-discovery', customTabFeeds: {} })
    localStorage.setItem('ziaf-follow-workflow:task-a', 'true')
    f.workflows.get.mockResolvedValue(snapshot(2, 'implementation'))
    const first = renderHook(() => f.useView())
    await waitFor(() => expect(first.result.current.history.activeTabId).toBe('wf-implementation'))
    first.unmount()
    const stale = f.workflows.onEvent.mock.calls[0][0]
    const second = renderHook(() => f.useView('task-b', false))
    await act(async () => stale(snapshot(3, 'late')))
    expect(second.result.current.history.centralTabs).toEqual([main])
    expect(f.workflows.get).toHaveBeenCalledTimes(1)
  })

  it('never projects a prior task when rerendered without remount while the new task load is pending', async () => {
    const f = fixture(); const loading = deferred<WorkflowSnapshot | null>()
    const states = new Map<string, Required<ChatHistory>>([
      ['task-a', { centralTabs: [main], activeTabId: 'chat-main', recentTabs: [], drafts: {}, customTabFeeds: {} }],
      ['task-b', { centralTabs: [main], activeTabId: 'chat-main', recentTabs: [], drafts: { 'chat-main': 'B draft' }, customTabFeeds: {} }],
    ])
    const updates = new Map(['task-a', 'task-b'].map(id => [id, vi.fn((apply: (value: Required<ChatHistory>) => Required<ChatHistory>) => { states.set(id, apply(states.get(id)!)) })]))
    localStorage.setItem('ziaf-follow-workflow:task-b', 'false')
    const view = renderHook(({ id }) => useWorkflowChats(id, true, { ...states.get(id)!, hydrated: true, update: updates.get(id)! }, false, f.workflows), { initialProps: { id: 'task-a' } })
    await waitFor(() => expect(states.get('task-a')!.activeTabId).toBe('wf-discovery'))
    const oldEvent = f.workflows.onEvent.mock.calls[0][0]
    f.workflows.get.mockReturnValue(loading.promise)
    view.rerender({ id: 'task-b' })
    expect(view.result.current.currentId).toBeUndefined()
    expect(view.result.current.following).toBe(false)
    expect(updates.get('task-b')).not.toHaveBeenCalled()
    await act(async () => { oldEvent(snapshot(99, 'old')); loading.resolve(snapshot(1, 'b-phase', 'task-b')) })
    await waitFor(() => expect(states.get('task-b')!.centralTabs.some(item => item.id === 'wf-b-phase')).toBe(true))
    expect(states.get('task-b')!.centralTabs.some(item => item.id === 'wf-old')).toBe(false)
    expect(states.get('task-b')!.activeTabId).toBe('chat-main')
    expect(states.get('task-b')!.drafts).toEqual({ 'chat-main': 'B draft' })
    act(() => view.result.current.follow())
    expect(states.get('task-b')!.activeTabId).toBe('wf-b-phase')
    expect(localStorage.getItem('ziaf-follow-workflow:task-a')).toBe('true')
  })

  it('lists prior attempts and every reviewer/helper context without inventing a session', () => {
    const value = snapshot(); const attempt = value.steps[0].attempts[0]
    attempt.stage = 'review'
    attempt.helperSources = [{ sourceId: 'research', presetName: 'Helper', status: 'completed', targetFingerprint: 'target', session: session('wf-helper') }]
    attempt.reviewSources = [{ sourceId: 'review-a', presetName: 'Reviewer', status: 'running', targetFingerprint: 'target', session: session('wf-review') }, { sourceId: 'not-started', presetName: 'Reviewer', status: 'failed', targetFingerprint: 'target' }]
    const projected = workflowChats(value)
    expect(projected.tabs.map(item => item.id)).toEqual(['wf-helper', 'wf-discovery', 'wf-review'])
    expect(projected.currentId).toBe('wf-review')
    value.steps[0].attempts.push({ ...attempt, id: 'retry', number: 2, session: session('wf-retry'), stage: 'implementation', reviewSources: [], helperSources: [] })
    expect(workflowChats(value).tabs.find(item => item.id === 'wf-discovery')?.name).toContain('Attempt 1')
    expect(workflowChats(value).currentId).toBe('wf-retry')
  })

  it('exposes durable nested Multi contexts with cycle names and follows the active coordinator', () => {
    const value = snapshot()
    value.steps[0].attempts[0].stage = 'review'
    value.steps[0].attempts[0].multiStages = [
      { id: 'explore-1', kind: 'exploration', index: 1, cycle: 0, status: 'completed', targetFingerprint: 'a', session: session('wf-explore'), artifactIds: ['explore-document'] },
      { id: 'worker-1', kind: 'review-worker', index: 1, cycle: 1, status: 'completed', targetFingerprint: 'b', session: session('wf-worker') },
      { id: 'coordinator-1', kind: 'review-coordinator', index: 1, cycle: 1, status: 'running', targetFingerprint: 'b', session: session('wf-coordinator') },
    ]
    const projected = workflowChats(value)
    expect(projected.tabs.map(item => item.id)).toEqual(['wf-discovery', 'wf-explore', 'wf-worker', 'wf-coordinator'])
    expect(projected.tabs.at(-1)?.name).toContain('Review synthesis 1 · Cycle 1')
    expect(projected.currentId).toBe('wf-coordinator')
  })

  it('follows a new review gate and its final result after an older delivery step has completed', () => {
    const value = snapshot(4, 'delivery')
    value.status = 'paused'
    value.steps.forEach(step => { step.status = 'completed'; step.attempts[0].status = 'completed'; step.attempts[0].stage = 'finished' })
    value.steps[1].attempts[0].startedAt = 20
    const rereview = { ...value.steps[0].attempts[0], id: 'rereview', number: 2, startedAt: 30, session: undefined, stage: 'review' as const,
      multiStages: [{ id: 'cycle-3-coordinator', kind: 'review-coordinator' as const, index: 1, cycle: 3, status: 'completed' as const, targetFingerprint: 'corrected-source', session: session('wf-new-review') }] }
    value.steps[0].attempts.push(rereview)
    value.codeFlow = { artifacts: [], answers: [], responses: [], pending: { id: 'gate-3', kind: 'review', attemptId: 'rereview', stepId: 'discovery', summary: 'Acknowledge suggestions', artifactIds: [], reviewOutcome: 'approved' } }
    expect(workflowChats(value).currentId).toBe('wf-new-review')
    value.codeFlow.pending = undefined
    value.status = 'completed'
    expect(workflowChats(value).currentId).toBe('wf-new-review')
    expect(workflowChats(value).tabs.map(item => item.id)).toContain('wf-delivery')
  })
})
