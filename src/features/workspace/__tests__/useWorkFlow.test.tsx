// @vitest-environment happy-dom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WorkFlowAPI, WorkFlowSnapshot, WorkStageRecord } from '../../../../shared/work-flow'
import type { ChatHistory, LegacyZiafAPI } from '../../../../shared/legacy-ipc'
import { useTaskChatHistory } from '../useTaskChatHistory'
import { useWorkFlow, useWorkFlowChats, workFlowChats } from '../useWorkFlow'

const stage = (id: string, phase: WorkStageRecord['phase'] = 'intake'): WorkStageRecord => ({ id, phase, round: 0, source: { id: 'executor', presetName: '@task' }, status: 'running', configurationHash: 'a', inputFingerprint: 'b', artifactIds: [], reportRepairCount: 0, verification: [], invocations: [{ id: `${id}-invoke`, clientMessageId: `${id}-message`, purpose: 'initial', prompt: 'Original request:\nAnswer directly', status: 'running', inputFingerprint: 'b', session: { sessionId: `${id}-session`, runId: `${id}-run`, chatId: `wf-${id}` } }] })
const state = (taskId = 'a', sequence = 1): WorkFlowSnapshot => ({ schemaVersion: 1, taskId, runId: `flow-${taskId}`, revision: 1, sequence, updatedAt: sequence, status: 'running', stages: [stage(`${taskId}-intake`)], artifacts: [], sources: [], decisions: [], commandReceipts: [], round: 0, turns: 1, failures: 0, definition: { version: 1, kind: 'auto', request: 'Answer directly', advance: 'auto', executor: { id: 'executor', presetName: '@task' }, review: false, reviewers: [], inputs: [], limits: { maxTurns: 30, maxFailures: 3, maxFollowUps: 5 } } })
function fixture() {
  const events = new Set<(value: WorkFlowSnapshot) => void>()
  const api = { get: vi.fn<WorkFlowAPI['get']>().mockResolvedValue(state()), onEvent: vi.fn<WorkFlowAPI['onEvent']>(callback => { events.add(callback); return () => { events.delete(callback) } }), save: vi.fn(), start: vi.fn(), respond: vi.fn(), followUp: vi.fn(), pause: vi.fn(), readArtifact: vi.fn(), openArtifact: vi.fn() } satisfies WorkFlowAPI
  const historyAPI = { getChatHistory: vi.fn<LegacyZiafAPI['getChatHistory']>().mockResolvedValue({ centralTabs: [{ id: 'chat-main', type: 'chat', name: 'Main' }], customTabFeeds: {}, drafts: { 'chat-main': 'Unsent question' } }), saveChatHistory: vi.fn<LegacyZiafAPI['saveChatHistory']>().mockResolvedValue({ success: true }) }
  const useView = (id: string) => { const flow = useWorkFlow(id, api); const history = useTaskChatHistory(id, [], historyAPI); const chats = useWorkFlowChats(id, flow.snapshot, history, false); return { flow, history, chats } }
  return { api, historyAPI, useView, emit: (value: WorkFlowSnapshot) => events.forEach(callback => callback(value)) }
}
beforeEach(() => localStorage.clear())
afterEach(cleanup)

describe('Work chats outside the panel', () => {
  it('opens only saved session references and keeps a manual conversation/draft selected during later phases', async () => {
    const f = fixture(); const view = renderHook(() => f.useView('a'))
    await waitFor(() => expect(view.result.current.history.activeTabId).toBe('wf-a-intake'))
    act(() => { view.result.current.chats.select('chat-main'); view.result.current.history.update(value => ({ ...value, activeTabId: 'chat-main' }), true) })
    act(() => f.emit({ ...state('a', 2), stages: [stage('a-intake'), stage('a-draft', 'draft')] }))
    await waitFor(() => expect(view.result.current.history.centralTabs.map(tab => tab.id)).toContain('wf-a-draft'))
    expect(view.result.current.history.activeTabId).toBe('chat-main')
    expect(view.result.current.history.drafts['chat-main']).toBe('Unsent question')
    expect(f.api.start).not.toHaveBeenCalled(); expect(f.api.respond).not.toHaveBeenCalled()
  })

  it('never projects the previous task while a new task load is pending, and ignores stale callbacks', async () => {
    const f = fixture()
    // TaskWorkspace is keyed in production: history belongs to one task.
    // Keep separate task histories while deliberately rerendering the Work
    // subscription itself, so the test exercises its stale-event boundary.
    const histories = new Map<string, Required<ChatHistory>>(['a', 'b'].map(id => [id, { centralTabs: [{ id: 'chat-main', name: 'Main', type: 'chat' }], activeTabId: 'chat-main', recentTabs: [], customTabFeeds: {}, drafts: { 'chat-main': `${id} draft` } }]))
    const updates = new Map(['a', 'b'].map(id => [id, vi.fn((apply: (value: Required<ChatHistory>) => Required<ChatHistory>) => { histories.set(id, apply(histories.get(id)!)) })]))
    localStorage.setItem('ziaf-follow-work:b', 'false')
    const view = renderHook(({ id }) => {
      const flow = useWorkFlow(id, f.api)
      const chats = useWorkFlowChats(id, flow.snapshot, { ...histories.get(id)!, hydrated: true, update: updates.get(id)! }, false)
      return { flow, chats }
    }, { initialProps: { id: 'a' } })
    await waitFor(() => expect(view.result.current.chats.currentId).toBe('wf-a-intake'))
    const previousCallback = f.api.onEvent.mock.calls[0][0]
    f.api.get.mockReturnValue(new Promise(() => {}))
    view.rerender({ id: 'b' })
    expect(view.result.current.flow.snapshot).toBeNull()
    expect(view.result.current.chats.currentId).toBeUndefined()
    expect(updates.get('b')).not.toHaveBeenCalled()
    act(() => previousCallback(state('a', 20)))
    expect(view.result.current.flow.snapshot).toBeNull()
    act(() => f.emit(state('b', 2)))
    await waitFor(() => expect(view.result.current.chats.currentId).toBe('wf-b-intake'))
    expect(histories.get('b')!.centralTabs.map(tab => tab.id)).toEqual(['chat-main', 'wf-b-intake'])
    expect(histories.get('b')!.activeTabId).toBe('chat-main')
    expect(histories.get('b')!.drafts).toEqual({ 'chat-main': 'b draft' })
    expect(histories.get('a')!.centralTabs.map(tab => tab.id)).toEqual(['chat-main', 'wf-a-intake'])
  })

  it('follows the question origin among parallel workers and deduplicates same-context continuations', () => {
    const value = state(); const first = stage('worker-a', 'worker'); const second = stage('worker-b', 'worker')
    first.sourceId = 'a'; second.sourceId = 'b'; first.invocations.push({ ...first.invocations[0], id: 'answer-invoke', purpose: 'answer' })
    value.definition.deep = { workers: [{ id: 'a', presetName: 'Model A' }, { id: 'b', presetName: 'Model B' }] }
    value.stages = [first, second]; value.pending = { id: 'ask-a', kind: 'questions', stageId: first.id, summary: 'A needs a constraint', artifactIds: [], actions: ['answer'] }
    const projection = workFlowChats(value)
    expect(projection.tabs).toHaveLength(2)
    expect(projection.currentId).toBe('wf-worker-a')
    expect(projection.tabs[0].name).toBe('Independent perspective 1')
  })
})
