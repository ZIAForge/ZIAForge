/** @vitest-environment happy-dom */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentSessionSnapshot, AgentSessionsAPI, AgentSessionUpdate } from '../../../../shared/agent-session'
import type { Settings } from '../../../store'
import { useStore } from '../../../store'
import { StructuredChat } from '../StructuredChat'

let nextTask = 0
function fixture(initial: Partial<AgentSessionSnapshot> | null = null) {
  const taskId = `structured-test-${++nextTask}`
  const base: AgentSessionSnapshot = {
    taskId, chatId: 'chat-main', sessionId: `session-${taskId}`, runId: 'run-1', cursor: 1,
    provider: 'codex', presetName: 'Native Codex', model: 'fixture-model', sessionStatus: 'ready',
    capabilities: { attachments: false, interactiveApprovals: true, interruptTurn: true },
    feed: [], pendingApprovals: [],
  }
  let current = initial ? { ...base, ...initial } : null
  const listeners = new Set<(event: AgentSessionUpdate) => void>()
  const api = {
    create: vi.fn<AgentSessionsAPI['create']>(async () => current = { ...base }),
    attach: vi.fn<AgentSessionsAPI['attach']>(async () => current),
    snapshot: vi.fn<AgentSessionsAPI['snapshot']>(async () => current || base),
    send: vi.fn<AgentSessionsAPI['send']>(async request => ({ ...request, turnId: 'turn-1', cursor: 2 })),
    queue: vi.fn<AgentSessionsAPI['queue']>(async request => current = { ...(current || base), queue: { revision: (current?.queue?.revision || 0) + 1, paused: current?.queue?.paused || false, items: [...(current?.queue?.items || []), { clientMessageId: request.clientMessageId, text: request.text, createdAt: 1, status: 'queued' }] } }),
    setQueuePaused: vi.fn<AgentSessionsAPI['setQueuePaused']>(async request => current = { ...(current || base), queue: { revision: (current?.queue?.revision || 0) + 1, paused: request.paused, items: current?.queue?.items || [] } }),
    cancelQueued: vi.fn<AgentSessionsAPI['cancelQueued']>(async request => current = { ...(current || base), queue: { revision: (current?.queue?.revision || 0) + 1, paused: current?.queue?.paused || false, items: (current?.queue?.items || []).filter(item => item.clientMessageId !== request.clientMessageId) } }),
    interrupt: vi.fn<AgentSessionsAPI['interrupt']>(async () => {}),
    terminate: vi.fn<AgentSessionsAPI['terminate']>(async () => {}),
    resume: vi.fn<AgentSessionsAPI['resume']>(async () => current = { ...base, runId: 'run-2' }),
    reconfigure: vi.fn<AgentSessionsAPI['reconfigure']>(async request => current = { ...base, runId: 'run-2', presetName: request.presetName, provider: request.provider || base.provider, model: request.model || base.model }),
    resolveApproval: vi.fn<AgentSessionsAPI['resolveApproval']>(async () => {}),
    onEvent: vi.fn<AgentSessionsAPI['onEvent']>(listener => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    }),
  } satisfies AgentSessionsAPI
  const push = (snapshot: AgentSessionSnapshot) => {
    current = snapshot
    listeners.forEach(listener => listener({ snapshot }))
  }
  const props = { taskId, chatId: 'chat-main', presetName: 'Native Codex', api }
  return { base, api, push, props, listeners }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((accept, decline) => { resolve = accept; reject = decline })
  return { promise, resolve, reject }
}

const input = () => screen.getByTestId('composer-input') as HTMLTextAreaElement
const ready = () => waitFor(() => expect(screen.getByTestId('agent-session-status').textContent).not.toBe('Connecting…'))
const fill = (text: string) => fireEvent.change(input(), { target: { value: text } })
const chatPresets = [
  { name: 'Native Codex', agent: 'Codex', model: 'fixture-model', permissions: 'Workspace write' },
  { name: 'Claude review', agent: 'Claude Code', model: 'sonnet', permissions: 'Read only' },
  { name: 'Antigravity native', agent: 'Google Antigravity', model: 'auto', permissions: 'CLI settings' },
]
const openSettings = () => fireEvent.click(screen.getByTestId('composer-preset-button'))
const selectPreset = (value: string) => fireEvent.click(screen.getByTestId(`composer-preset-${value}`))
const applySettings = () => fireEvent.click(screen.getByTestId('agent-chat-apply'))
const savedHistory: AgentSessionSnapshot['feed'] = [{ id: 'earlier-answer', role: 'assistant', text: 'Earlier answer', status: 'completed', revision: 1, thinking: '', tools: [], approvals: [], timestamp: 1 }]

describe('StructuredChat', () => {
  beforeEach(() => {
    const stored = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => stored.get(key) || null,
      setItem: (key: string, value: string) => stored.set(key, value),
    })
    useStore.setState({ settings: { uiLanguage: 'en' } as Settings })
    Object.defineProperty(window, 'ziafAPI', { configurable: true, writable: true, value: { getAgentModels: vi.fn().mockResolvedValue(['fixture-model']), getAgentModelCatalog: vi.fn(async ({ agent }: { agent: string }) => ({ agent, status: 'ready', source: 'cli', command: agent, queriedAt: 1, models: [{ id: 'fixture-model', label: 'Fixture' }] })) } })
  })
  afterEach(() => { cleanup(); vi.unstubAllGlobals() })

  it('shows a failed turn on a ready connection without replaying it or blocking the next request', async () => {
    const lastTurn = { turnId: 'denied-turn', clientMessageId: 'denied-input', status: 'failed' as const, error: 'CLI denied the command. Review permissions before sending again.' }
    const test = fixture({ lastTurn })
    render(<StructuredChat {...test.props} />)
    await ready()
    expect(screen.getByRole('alert').textContent).toContain(lastTurn.error)
    expect(screen.getByTestId('agent-session-status').textContent).toBe('Request failed')
    expect(test.api.send).not.toHaveBeenCalled()
    expect(screen.queryByTestId('agent-session-resume')).toBeNull()
    fill('Explicit next request')
    expect((screen.getByTestId('composer-send-button') as HTMLButtonElement).disabled).toBe(false)
    await act(async () => fireEvent.click(screen.getByTestId('composer-send-button')))
    expect(test.api.send).toHaveBeenCalledTimes(1)
    act(() => test.push({ ...test.base, cursor: 2, lastTurn, activeTurn: { turnId: 'next-turn', clientMessageId: 'next-input', status: 'running' } }))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('queues beside Stop, waits for durable acknowledgement and preserves newer typing', async () => {
    const active = { turnId: 'turn-live', clientMessageId: 'input-live', status: 'running' as const }
    const test = fixture({ activeTurn: active })
    const result = deferred<AgentSessionSnapshot>()
    test.api.queue.mockImplementation(() => result.promise)
    render(<StructuredChat {...test.props} />)
    await ready()
    fill('Queue this next')
    expect((screen.getByTestId('composer-send-button') as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByTestId('composer-stop-button') as HTMLButtonElement).disabled).toBe(false)
    await act(async () => fireEvent.click(screen.getByTestId('composer-queue-button')))
    const queued = test.api.queue.mock.calls[0][0]
    expect(queued).toMatchObject({ sessionId: test.base.sessionId, runId: 'run-1', text: 'Queue this next' })
    expect(input().value).toBe('Queue this next')
    expect((screen.getByTestId('composer-stop-button') as HTMLButtonElement).disabled).toBe(false)
    await act(async () => fireEvent.click(screen.getByTestId('composer-stop-button')))
    expect(screen.queryByTestId(`agent-queue-item-${queued.clientMessageId}`)).toBeNull()
    fill('A different draft typed while saving')
    act(() => test.push({ ...test.base, cursor: 3, activeTurn: { ...active, status: 'interrupting' }, queue: { revision: 2, paused: true, items: [{ ...queued, status: 'queued', createdAt: 1 }] } }))
    await act(async () => result.resolve({ ...test.base, activeTurn: active, queue: { revision: 1, paused: false, items: [{ ...queued, status: 'queued', createdAt: 1 }] } }))
    expect(input().value).toBe('A different draft typed while saving')
    expect(screen.getByTestId(`agent-queue-item-${queued.clientMessageId}`).textContent).toContain('Queue this next')
    expect(test.api.send).not.toHaveBeenCalled()
    expect(test.api.interrupt).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('agent-queue-status').textContent).toBe('Paused')
  })

  it.each([
    ['overlong', 'x'.repeat(100_001)],
    ['NUL-containing', 'Invalid\0message'],
  ])('rejects %s queue text before retaining an ID and allows corrected Queue and Send', async (_name, invalid) => {
    const test = fixture({ activeTurn: { turnId: 'turn-live', clientMessageId: 'input-live', status: 'running' } })
    const key = `ziaf-agent-draft:${JSON.stringify([test.props.taskId, test.props.chatId])}`
    render(<StructuredChat {...test.props} />)
    await ready()
    fill(invalid)
    await act(async () => fireEvent.click(screen.getByTestId('composer-queue-button')))
    expect(test.api.queue).not.toHaveBeenCalled()
    expect(JSON.parse(localStorage.getItem(key)!).queuePending).toBeUndefined()
    expect(input().value).toBe(invalid)
    expect(screen.getByRole('alert').textContent).toContain('Edit the draft and try again')
    expect(screen.queryByTestId('agent-queue-pending-text')).toBeNull()
    fill('Corrected queued message')
    await act(async () => fireEvent.click(screen.getByTestId('composer-queue-button')))
    expect(test.api.queue).toHaveBeenCalledTimes(1)
    expect(test.api.queue.mock.calls[0][0].text).toBe('Corrected queued message')
    expect(input().value).toBe('')
    expect(screen.queryByRole('alert')).toBeNull()
    act(() => test.push({ ...test.base, cursor: 3, queue: { revision: 2, paused: false, items: [] } }))
    fill('Direct send still works')
    await act(async () => fireEvent.click(screen.getByTestId('composer-send-button')))
    expect(test.api.send).toHaveBeenCalledTimes(1)
    expect(test.api.send.mock.calls[0][0].text).toBe('Direct send still works')
  })

  it.each([
    ['overlong', 'x'.repeat(100_001)],
    ['NUL-containing', 'Old\0message'],
    ['empty', ' \n '],
  ])('releases only impossible %s cached queue attempts without losing the editable draft', async (_name, invalid) => {
    const test = fixture({})
    const key = `ziaf-agent-draft:${JSON.stringify([test.props.taskId, test.props.chatId])}`
    localStorage.setItem(key, JSON.stringify({ text: invalid, initialized: true, queuePending: { id: 'old-invalid-id', text: invalid } }))
    render(<StructuredChat {...test.props} />)
    await ready()
    expect(input().value).toBe(invalid)
    expect(screen.queryByTestId('agent-queue-pending-text')).toBeNull()
    fill('Edited after reopening')
    expect(JSON.parse(localStorage.getItem(key)!).queuePending).toBeUndefined()
    expect((screen.getByTestId('composer-send-button') as HTMLButtonElement).disabled).toBe(false)
    await act(async () => fireEvent.click(screen.getByTestId('composer-send-button')))
    expect(test.api.queue).not.toHaveBeenCalled()
    expect(test.api.send).toHaveBeenCalledTimes(1)
    expect(test.api.send.mock.calls[0][0].text).toBe('Edited after reopening')
  })

  it('accepts the IPC queue text limit without discarding its pending identity', async () => {
    const test = fixture({ activeTurn: { turnId: 'turn-live', clientMessageId: 'input-live', status: 'running' } })
    test.api.queue.mockRejectedValueOnce(new Error('Acknowledgement unavailable'))
    const key = `ziaf-agent-draft:${JSON.stringify([test.props.taskId, test.props.chatId])}`
    render(<StructuredChat {...test.props} />)
    await ready()
    fill('x'.repeat(100_000))
    await act(async () => fireEvent.click(screen.getByTestId('composer-queue-button')))
    const request = test.api.queue.mock.calls[0][0]
    expect(request.text.length).toBe(100_000)
    expect(JSON.parse(localStorage.getItem(key)!).queuePending).toEqual({ id: request.clientMessageId, text: request.text })
    expect((screen.getByTestId('composer-send-button') as HTMLButtonElement).disabled).toBe(true)
  })

  it('keeps an independent queue identity on failed save, remount and retry without submitting a newer draft', async () => {
    const test = fixture({ activeTurn: { turnId: 'turn-live', clientMessageId: 'input-live', status: 'running' } })
    const key = `ziaf-agent-draft:${JSON.stringify([test.props.taskId, test.props.chatId])}`
    localStorage.setItem(key, JSON.stringify({ text: 'Persist me', initialized: true, pending: { id: 'ordinary-send-id', text: 'Previous direct send' } }))
    test.api.queue.mockRejectedValueOnce(new Error('Queue storage failed'))
    const view = render(<StructuredChat {...test.props} />)
    await ready()
    await act(async () => fireEvent.click(screen.getByTestId('composer-queue-button')))
    const first = test.api.queue.mock.calls[0][0]
    expect(first.clientMessageId).not.toBe('ordinary-send-id')
    expect(screen.getByRole('alert').textContent).toContain('Queue storage failed')
    expect(input().value).toBe('Persist me')
    fill('Newer unsent draft')
    view.unmount()
    render(<StructuredChat {...test.props} />)
    await ready()
    expect(screen.getByTestId('agent-queue-pending-text').textContent).toBe('Persist me')
    expect((screen.getByTestId('composer-send-button') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('composer-queue-button').textContent).toBe('Retry queue save')
    await act(async () => fireEvent.click(screen.getByTestId('composer-queue-button')))
    expect(test.api.queue.mock.calls[1][0]).toEqual(first)
    expect(input().value).toBe('Newer unsent draft')
    expect(screen.queryByTestId('agent-queue-pending-text')).toBeNull()
    expect(JSON.parse(localStorage.getItem(key)!).pending.id).toBe('ordinary-send-id')
    expect(test.api.send).not.toHaveBeenCalled()
  })

  it('does not resurrect a cancelled queue item or roll back the feed when a late queue acknowledgement arrives', async () => {
    const test = fixture({ activeTurn: { turnId: 'turn-live', clientMessageId: 'input-live', status: 'running' } })
    const result = deferred<AgentSessionSnapshot>()
    test.api.queue.mockImplementation(() => result.promise)
    render(<StructuredChat {...test.props} />)
    await ready(); fill('Accepted and already processed')
    await act(async () => fireEvent.click(screen.getByTestId('composer-queue-button')))
    const queued = test.api.queue.mock.calls[0][0]
    act(() => test.push({ ...test.base, cursor: 4, feed: savedHistory, queue: { revision: 3, paused: true, items: [] } }))
    await act(async () => result.resolve({ ...test.base, queue: { revision: 1, paused: false, items: [{ ...queued, status: 'queued', createdAt: 1 }] } }))
    expect(screen.queryByTestId(`agent-queue-item-${queued.clientMessageId}`)).toBeNull()
    expect(screen.getByText('Earlier answer')).not.toBeNull()
    expect(input().value).toBe('')
    expect(test.api.send).not.toHaveBeenCalled()
  })

  it('merges queue revisions independently from journal and diagnostics revisions', async () => {
    const item = { clientMessageId: 'saved-item', text: 'Still pending', createdAt: 1, status: 'queued' as const }
    const diagnostics = [{ id: 'latest', timestamp: 1, level: 'info' as const, source: 'stderr' as const, message: 'Latest diagnostic' }]
    const test = fixture({ cursor: 5, diagnosticsRevision: 3, diagnostics, feed: savedHistory, queue: { revision: 2, paused: false, items: [item] } })
    render(<StructuredChat {...test.props} />); await ready()
    act(() => test.push({ ...test.base, cursor: 5, diagnosticsRevision: 1, diagnostics: [], feed: savedHistory, queue: { revision: 3, paused: true, items: [item] } }))
    expect(screen.getByTestId('agent-queue-status').textContent).toBe('Paused')
    fireEvent.click(screen.getByTestId('agent-cli-logs-toggle'))
    expect(screen.getByTestId('agent-cli-log-lines').textContent).toContain('Latest diagnostic')
    act(() => test.push({ ...test.base, cursor: 6, feed: savedHistory, queue: { revision: 1, paused: false, items: [] } }))
    expect(screen.getByTestId('agent-queue-item-saved-item')).not.toBeNull()
    expect(screen.getByTestId('agent-queue-status').textContent).toBe('Paused')
    act(() => test.push({ ...test.base, cursor: 4, feed: [], queue: { revision: 4, paused: false, items: [item] } }))
    expect(screen.getByTestId('agent-queue-status').textContent).toBe('Continues automatically')
    expect(screen.getByText('Earlier answer')).not.toBeNull()
  })

  it('restores a paused queue and resumes native context without continuing it or submitting the draft', async () => {
    const queue = { revision: 4, paused: true, items: [{ clientMessageId: 'saved', text: 'Saved for later', createdAt: 1, status: 'queued' as const }] }
    const test = fixture({ sessionStatus: 'disconnected', resumeAvailable: true, feed: savedHistory, queue })
    const resumed = { ...test.base, runId: 'run-2', feed: savedHistory, queue }
    test.api.resume.mockResolvedValue(resumed)
    test.api.setQueuePaused.mockResolvedValue({ ...resumed, queue: { ...queue, revision: 5, paused: false } })
    render(<StructuredChat {...test.props} presets={chatPresets} />); await ready(); fill('Keep this separate draft')
    expect((screen.getByTestId('agent-queue-toggle') as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByTestId('agent-session-resume') as HTMLButtonElement).disabled).toBe(false)
    expect((screen.getByTestId('composer-queue-button') as HTMLButtonElement).disabled).toBe(true)
    openSettings()
    expect((screen.getByTestId('composer-preset-Claude review') as HTMLButtonElement).disabled).toBe(true)
    await act(async () => fireEvent.click(screen.getByTestId('agent-session-resume')))
    expect(test.api.resume).toHaveBeenCalledTimes(1)
    expect(test.api.setQueuePaused).not.toHaveBeenCalled()
    expect(test.api.send).not.toHaveBeenCalled()
    expect(test.api.queue).not.toHaveBeenCalled()
    expect(screen.getByTestId('agent-queue-status').textContent).toBe('Paused')
    expect((screen.getByTestId('composer-send-button') as HTMLButtonElement).disabled).toBe(true)
    await act(async () => fireEvent.click(screen.getByTestId('agent-queue-toggle')))
    expect(test.api.setQueuePaused).toHaveBeenCalledWith({ sessionId: test.base.sessionId, runId: 'run-2', paused: false })
    expect(input().value).toBe('Keep this separate draft')
    expect(screen.getByTestId('agent-queue-status').textContent).toBe('Continues automatically')
  })

  it('merges independently revised queue snapshots buffered before a native Resume acknowledgement', async () => {
    const old = { clientMessageId: 'old-queued', text: 'Old queued item', createdAt: 1, status: 'queued' as const }
    const newer = { clientMessageId: 'new-queued', text: 'New queued item', createdAt: 2, status: 'queued' as const }
    const queue = { revision: 4, paused: true, items: [old] }
    const test = fixture({ sessionStatus: 'disconnected', resumeAvailable: true, queue })
    const result = deferred<AgentSessionSnapshot>()
    test.api.resume.mockImplementation(() => result.promise)
    render(<StructuredChat {...test.props} />); await ready()
    await act(async () => fireEvent.click(screen.getByTestId('agent-session-resume')))
    act(() => test.push({ ...test.base, runId: 'run-2', cursor: 3, feed: savedHistory, queue: { revision: 6, paused: true, items: [] } }))
    act(() => test.push({ ...test.base, runId: 'run-2', cursor: 2, feed: [], queue: { revision: 7, paused: true, items: [newer] } }))
    act(() => test.push({ ...test.base, runId: 'run-2', cursor: 4, feed: savedHistory, queue: { revision: 5, paused: false, items: [old] } }))
    await act(async () => result.resolve({ ...test.base, runId: 'run-2', cursor: 1, queue }))
    expect(screen.getByTestId('agent-queue-item-new-queued')).not.toBeNull()
    expect(screen.queryByTestId('agent-queue-item-old-queued')).toBeNull()
    expect(screen.getByTestId('agent-queue-status').textContent).toBe('Paused')
    expect(screen.getByText('Earlier answer')).not.toBeNull()
    expect(test.api.setQueuePaused).not.toHaveBeenCalled()
  })

  it('disables dispatch cancellation and requires uncertain delivery to be dismissed without automatic retry', async () => {
    const items = [
      { clientMessageId: 'dispatch', text: 'Already dispatching', createdAt: 1, status: 'dispatching' as const },
      { clientMessageId: 'unknown', text: 'Possibly delivered', createdAt: 2, status: 'uncertain' as const, error: 'Provider outcome unknown' },
      { clientMessageId: 'waiting', text: 'Still waiting', createdAt: 3, status: 'queued' as const },
    ]
    const test = fixture({ queue: { revision: 4, paused: true, items } })
    render(<StructuredChat {...test.props} />); await ready()
    expect((screen.getByTestId('agent-queue-cancel-dispatch') as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByTestId('agent-queue-toggle') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('agent-queue-item-unknown').textContent).toContain('will not be resent automatically')
    await act(async () => fireEvent.click(screen.getByTestId('agent-queue-cancel-unknown')))
    expect(test.api.cancelQueued).toHaveBeenCalledWith({ sessionId: test.base.sessionId, runId: 'run-1', clientMessageId: 'unknown' })
    expect(screen.queryByTestId('agent-queue-item-unknown')).toBeNull()
    expect(screen.getByTestId('agent-queue-item-waiting')).not.toBeNull()
    expect(test.api.send).not.toHaveBeenCalled()
    expect(test.api.queue).not.toHaveBeenCalled()
    expect(test.api.setQueuePaused).not.toHaveBeenCalled()
  })

  it('keeps the queue intact on failed pause or cancellation rather than changing it optimistically', async () => {
    const item = { clientMessageId: 'retained', text: 'Must remain saved', createdAt: 1, status: 'queued' as const }
    const test = fixture({ queue: { revision: 1, paused: false, items: [item] } })
    test.api.setQueuePaused.mockRejectedValueOnce(new Error('Pause failed'))
    test.api.cancelQueued.mockRejectedValueOnce(new Error('Cancel failed'))
    render(<StructuredChat {...test.props} />); await ready(); fill('Unsent draft')
    await act(async () => fireEvent.click(screen.getByTestId('agent-queue-toggle')))
    expect(screen.getByRole('alert').textContent).toBe('Pause failed')
    expect(screen.getByTestId('agent-queue-status').textContent).toBe('Continues automatically')
    await act(async () => fireEvent.click(screen.getByTestId('agent-queue-cancel-retained')))
    expect(screen.getByRole('alert').textContent).toBe('Cancel failed')
    expect(screen.getByTestId('agent-queue-item-retained').textContent).toContain('Must remain saved')
    expect(input().value).toBe('Unsent draft')
  })

  it.each(['accepted', 'failed'] as const)('fences a late %s queue callback after changing chats and clears only acknowledged drafts', async outcome => {
    const first = fixture({ activeTurn: { turnId: 'turn-live', clientMessageId: 'input-live', status: 'running' } })
    const second = fixture()
    const result = deferred<AgentSessionSnapshot>()
    first.api.queue.mockImplementation(() => result.promise)
    const view = render(<StructuredChat {...first.props} />); await ready(); fill('First queued draft')
    await act(async () => fireEvent.click(screen.getByTestId('composer-queue-button')))
    view.rerender(<StructuredChat {...second.props} initialPrompt="Second chat draft" />); await ready()
    await act(async () => { if (outcome === 'accepted') result.resolve({ ...first.base, queue: { revision: 2, paused: false, items: [] } }); else result.reject(new Error('Old chat save failed')) })
    expect(input().value).toBe('Second chat draft')
    expect(screen.queryByTestId('agent-message-queue')).toBeNull()
    expect(second.api.queue).not.toHaveBeenCalled()
    expect(screen.queryByRole('alert')).toBeNull()
    view.rerender(<StructuredChat {...first.props} />); await ready()
    expect(input().value).toBe(outcome === 'accepted' ? '' : 'First queued draft')
  })

  it('rejects a mismatched queue acknowledgement without clearing the draft or changing ownership', async () => {
    const test = fixture({ activeTurn: { turnId: 'turn-live', clientMessageId: 'input-live', status: 'running' } })
    test.api.queue.mockResolvedValue({ ...test.base, runId: 'unrelated-run' })
    render(<StructuredChat {...test.props} />); await ready(); fill('Keep this on invalid reply')
    await act(async () => fireEvent.click(screen.getByTestId('composer-queue-button')))
    expect(input().value).toBe('Keep this on invalid reply')
    expect(screen.getByRole('alert').textContent).toBeTruthy()
    expect(screen.getByTestId('agent-queue-pending-text').textContent).toBe('Keep this on invalid reply')
    expect(test.api.send).not.toHaveBeenCalled()
  })

  it('blocks a damaged session without creating a replacement and retains the draft through recovery retry', async () => {
    const test = fixture({ feed: savedHistory })
    const view = render(<StructuredChat {...test.props} />)
    await ready()
    fill('Preserve this unsent draft')
    view.unmount()
    test.api.attach.mockRejectedValueOnce(new Error('Saved session metadata is damaged; restore a validated backup'))
    render(<StructuredChat {...test.props} />)
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Saved session metadata is damaged'))
    expect(input().value).toBe('Preserve this unsent draft')
    expect((screen.getByTestId('composer-send-button') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('agent-session-status').textContent).not.toBe('Ready')
    await act(async () => fireEvent.click(screen.getByTestId('composer-send-button')))
    expect(test.api.create).not.toHaveBeenCalled()
    expect(test.api.send).not.toHaveBeenCalled()
    // Explicit recovery updates the backend; Retry attaches that same saved run.
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Retry' })))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    expect(screen.getByText('Earlier answer')).not.toBeNull()
    expect(input().value).toBe('Preserve this unsent draft')
    expect(test.api.create).not.toHaveBeenCalled()
    expect(test.api.send).not.toHaveBeenCalled()
  })

  it('shows only actual reported usage for the current run, without fabricating an initial zero', async () => {
    const test = fixture({})
    render(<StructuredChat {...test.props} />)
    await ready()
    expect(screen.queryByTestId('agent-usage')).toBeNull()
    act(() => test.push({ ...test.base, cursor: 2, usage: { inputTokens: 12, outputTokens: 7, totalTokens: 19, requests: 1 } }))
    expect(screen.getByTestId('agent-usage').textContent).toContain('Input 12')
    expect(screen.getByTestId('agent-usage').textContent).toContain('Output 7')
    expect(screen.getByTestId('agent-usage').textContent).toContain('Total 19')
  })

  it('selects preset, model and CLI before first Send without starting a process, and remembers the selection', async () => {
    const test = fixture()
    const view = render(<StructuredChat {...test.props} presets={chatPresets} initialPrompt="Unsent request" />)
    await ready()
    openSettings()
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(4)
    await act(async () => selectPreset('Claude review'))
    openSettings()
    await act(async () => fireEvent.click(screen.getByTestId('composer-custom-option')))
    fireEvent.click(screen.getByTestId('composer-provider-button'))
    fireEvent.change(screen.getByTestId('agent-chat-provider'), { target: { value: 'antigravity' } })
    fireEvent.click(screen.getByTestId('composer-model-button'))
    fireEvent.change(screen.getByTestId('agent-chat-model'), { target: { value: 'future-gemini' } })
    await act(async () => applySettings())
    expect(test.api.create).not.toHaveBeenCalled()
    expect(test.api.reconfigure).not.toHaveBeenCalled()
    expect(input().value).toBe('Unsent request')
    view.unmount()
    render(<StructuredChat {...test.props} presets={chatPresets} />)
    await ready()
    expect(screen.getByTestId('structured-antigravity-chat')).not.toBeNull()
    await act(async () => fireEvent.click(screen.getByTestId('composer-send-button')))
    expect(test.api.create).toHaveBeenCalledWith(expect.objectContaining({ presetName: '', provider: 'antigravity', model: 'future-gemini' }))
    expect(test.api.send).toHaveBeenCalledTimes(1)
  })

  it('applies a switch only on acknowledgement and reconciles a newer snapshot published before it', async () => {
    const test = fixture({ feed: savedHistory })
    const response = deferred<AgentSessionSnapshot>()
    test.api.reconfigure.mockImplementation(() => response.promise)
    render(<StructuredChat {...test.props} presets={chatPresets} />)
    await ready()
    fill('Keep my draft')
    openSettings()
    await act(async () => selectPreset('Claude review'))
    expect(test.api.reconfigure).toHaveBeenCalledTimes(1)
    expect(test.api.reconfigure.mock.calls[0][0]).toMatchObject({ sessionId: test.base.sessionId, runId: 'run-1', presetName: 'Claude review', provider: 'claude', model: 'sonnet' })
    expect(screen.getByTestId('structured-codex-chat')).not.toBeNull()
    expect((screen.getByTestId('composer-send-button') as HTMLButtonElement).disabled).toBe(true)
    fill('Updated draft during apply')
    const switched: AgentSessionSnapshot = { ...test.base, provider: 'claude', presetName: 'Claude review', model: 'sonnet', runId: 'run-2', feed: savedHistory, cursor: 2 }
    act(() => test.push({ ...switched, cursor: 3, diagnosticsRevision: 1, diagnostics: [{ id: 'new-log', timestamp: 1, level: 'info', source: 'stdout', message: 'new process ready' }] }))
    expect(screen.getByTestId('structured-codex-chat')).not.toBeNull()
    await act(async () => response.resolve(switched))
    expect(screen.getByTestId('structured-claude-chat')).not.toBeNull()
    expect(input().value).toBe('Updated draft during apply')
    expect(screen.getByText('Earlier answer')).not.toBeNull()
    fireEvent.click(screen.getByTestId('agent-cli-logs-toggle'))
    expect(screen.getByTestId('agent-cli-log-lines').textContent).toContain('new process ready')
    act(() => test.push({ ...test.base, cursor: 99, feed: [] }))
    expect(screen.getByTestId('structured-claude-chat')).not.toBeNull()
    expect(screen.getByText('Earlier answer')).not.toBeNull()
    await act(async () => fireEvent.click(screen.getByTestId('composer-send-button')))
    expect(test.api.send.mock.calls[0][0].runId).toBe('run-2')
  })

  it('preserves the previous session, history, settings proposal and draft after a failed switch', async () => {
    const test = fixture({ feed: savedHistory })
    test.api.reconfigure.mockRejectedValueOnce(new Error('Selected CLI is unavailable'))
    render(<StructuredChat {...test.props} presets={chatPresets} />)
    await ready()
    fill('Do not lose this')
    openSettings()
    await act(async () => selectPreset('Antigravity native'))
    expect(screen.getByRole('alert').textContent).toContain('Selected CLI is unavailable')
    expect(screen.getByTestId('composer-preset-Antigravity native')).not.toBeNull()
    expect(screen.getByTestId('composer-preset-button').textContent).toContain('Native Codex')
    expect(screen.getByTestId('structured-codex-chat')).not.toBeNull()
    expect(screen.getByText('Earlier answer')).not.toBeNull()
    expect(input().value).toBe('Do not lose this')
    expect(test.api.send).not.toHaveBeenCalled()
    expect((screen.getByTestId('composer-send-button') as HTMLButtonElement).disabled).toBe(false)
  })

  it('refreshes the real owner when switching fails after the previous process has stopped', async () => {
    const test = fixture({ feed: savedHistory })
    const failed: AgentSessionSnapshot = { ...test.base, runId: 'failed-new-run', provider: 'claude', presetName: 'Claude review', model: 'sonnet', feed: savedHistory, sessionStatus: 'error', error: 'New CLI failed to initialize' }
    test.api.reconfigure.mockImplementationOnce(async () => {
      test.push(failed)
      throw new Error('New CLI failed to initialize')
    })
    render(<StructuredChat {...test.props} presets={chatPresets} />)
    await ready()
    fill('Retain this request')
    openSettings()
    await act(async () => selectPreset('Claude review'))
    expect(test.api.attach).toHaveBeenCalledTimes(2)
    expect(screen.getByTestId('structured-claude-chat').getAttribute('data-session-status')).toBe('error')
    expect(input().value).toBe('Retain this request')
    expect(screen.getByText('Earlier answer')).not.toBeNull()
    expect((screen.getByTestId('composer-send-button') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByRole('alert').textContent).toContain('New CLI failed to initialize')
    expect(test.api.send).not.toHaveBeenCalled()
  })

  it('does not apply a late interrupt error to the replacement run', async () => {
    const test = fixture({ activeTurn: { turnId: 'turn-1', clientMessageId: 'input-1', status: 'running' } })
    const interruptResult = deferred<void>()
    test.api.interrupt.mockImplementation(() => interruptResult.promise)
    render(<StructuredChat {...test.props} presets={chatPresets} />)
    await ready()
    await act(async () => fireEvent.click(screen.getByTestId('composer-stop-button')))
    act(() => test.push({ ...test.base, cursor: 3 }))
    openSettings()
    await act(async () => selectPreset('Claude review'))
    await act(async () => interruptResult.reject(new Error('Old interrupt reply failed')))
    expect(screen.getByTestId('structured-claude-chat')).not.toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('shows approval, native cancellation and reconnect readiness beside the draft without terminating the chat', async () => {
    const test = fixture({ provider: 'antigravity', activeTurn: { turnId: 'turn-1', clientMessageId: 'input-1', status: 'waiting_for_approval' } })
    render(<StructuredChat {...test.props} />)
    await ready()
    expect(screen.getByTestId('composer-process-status').getAttribute('data-state')).toBe('approval')
    fill('Retain next turn while canceling')
    await act(async () => fireEvent.click(screen.getByTestId('composer-stop-button')))
    expect(test.api.interrupt).toHaveBeenCalledTimes(1)
    expect(test.api.terminate).not.toHaveBeenCalled()
    expect(screen.getByTestId('composer-process-status').getAttribute('data-state')).toBe('interrupting')
    act(() => test.push({ ...test.base, provider: 'antigravity', cursor: 3, sessionStatus: 'starting', lastTurn: { turnId: 'turn-1', clientMessageId: 'input-1', status: 'interrupted' } }))
    expect(screen.getByTestId('composer-process-status').getAttribute('data-state')).toBe('starting')
    expect((screen.getByTestId('composer-send-button') as HTMLButtonElement).disabled).toBe(true)
    expect(input().value).toBe('Retain next turn while canceling')
    expect(test.api.send).not.toHaveBeenCalled()
    act(() => test.push({ ...test.base, provider: 'antigravity', cursor: 4 }))
    expect(screen.getByTestId('composer-process-status').getAttribute('data-state')).toBe('ready')
    expect((screen.getByTestId('composer-send-button') as HTMLButtonElement).disabled).toBe(false)
    await act(async () => fireEvent.click(screen.getByTestId('composer-send-button')))
    expect(test.api.send).toHaveBeenCalledWith(expect.objectContaining({ text: 'Retain next turn while canceling', runId: 'run-1' }))
  })

  it('allows browsing settings while busy but applies only after the active turn really ends', async () => {
    const test = fixture({ activeTurn: { turnId: 'turn-1', clientMessageId: 'input-1', status: 'running' } })
    render(<StructuredChat {...test.props} presets={chatPresets} />)
    await ready()
    openSettings()
    selectPreset('Claude review')
    expect(test.api.reconfigure).not.toHaveBeenCalled()
    await act(async () => fireEvent.click(screen.getByTestId('composer-stop-button')))
    expect((screen.getByTestId('composer-preset-Claude review') as HTMLButtonElement).disabled).toBe(true)
    act(() => test.push({ ...test.base, cursor: 3 }))
    await act(async () => selectPreset('Claude review'))
    expect(test.api.reconfigure).toHaveBeenCalledTimes(1)
  })

  it('does not let a switch callback after changing chats replace another chat or its draft', async () => {
    const first = fixture({ feed: savedHistory })
    const second = fixture()
    const response = deferred<AgentSessionSnapshot>()
    first.api.reconfigure.mockImplementation(() => response.promise)
    const view = render(<StructuredChat {...first.props} presets={chatPresets} />)
    await ready()
    fill('First draft')
    openSettings()
    await act(async () => selectPreset('Claude review'))
    view.rerender(<StructuredChat {...second.props} presets={chatPresets} initialPrompt="Second draft" />)
    await ready()
    await act(async () => response.resolve({ ...first.base, provider: 'claude', runId: 'run-2', presetName: 'Claude review', feed: savedHistory }))
    expect(input().value).toBe('Second draft')
    expect(screen.getByTestId('structured-codex-chat')).not.toBeNull()
    expect(screen.queryByText('Earlier answer')).toBeNull()
    expect(second.api.create).not.toHaveBeenCalled()
    view.rerender(<StructuredChat {...first.props} presets={chatPresets} />)
    await ready()
    expect(input().value).toBe('First draft')
  })

  it('resumes explicitly without resending the draft, and keeps diagnostics separate from the feed', async () => {
    const test = fixture({ sessionStatus: 'disconnected', resumeAvailable: true, feed: savedHistory })
    test.api.resume.mockImplementation(async () => ({ ...test.base, runId: 'run-2', feed: savedHistory }))
    render(<StructuredChat {...test.props} />)
    await ready()
    fill('A later prompt')
    await act(async () => fireEvent.click(screen.getByTestId('agent-session-resume')))
    expect(test.api.resume).toHaveBeenCalledWith({ sessionId: test.base.sessionId, runId: 'run-1' })
    expect(input().value).toBe('A later prompt')
    expect(test.api.send).not.toHaveBeenCalled()
    const diagnostics: NonNullable<AgentSessionSnapshot['diagnostics']> = [{ id: 'stdout-1', timestamp: 1, source: 'stdout', level: 'info', message: 'provider init metadata' }, { id: 'stderr-1', timestamp: 2, source: 'stderr', level: 'warning', message: 'native stderr warning' }]
    act(() => test.push({ ...test.base, runId: 'run-2', feed: savedHistory, diagnosticsRevision: 2, diagnostics }))
    fireEvent.click(screen.getByTestId('agent-cli-logs-toggle'))
    expect(screen.getByTestId('agent-cli-log-lines').textContent).toContain('native stderr warning')
    expect(screen.getByTestId('conversation-feed').textContent).not.toContain('native stderr warning')
    fireEvent.change(screen.getByLabelText('Log source'), { target: { value: 'stderr' } })
    expect(screen.getByTestId('agent-cli-log-lines').textContent).not.toContain('provider init metadata')
    act(() => test.push({ ...test.base, runId: 'run-2', feed: savedHistory, diagnosticsRevision: 1, diagnostics: [] }))
    expect(screen.getByTestId('agent-cli-log-lines').textContent).toContain('native stderr warning')
  })

  it('retains history and draft when native resume fails', async () => {
    const test = fixture({ sessionStatus: 'error', resumeAvailable: true, feed: savedHistory })
    test.api.resume.mockRejectedValueOnce(new Error('Native session is unavailable'))
    render(<StructuredChat {...test.props} />)
    await ready()
    fill('Resume later')
    await act(async () => fireEvent.click(screen.getByTestId('agent-session-resume')))
    expect(input().value).toBe('Resume later')
    expect(screen.getByText('Earlier answer')).not.toBeNull()
    expect(screen.getByRole('alert').textContent).toContain('Native session is unavailable')
    expect(test.api.send).not.toHaveBeenCalled()
  })

  it('keeps workflow history and approvals visible while blocking manual session controls', async () => {
    const chatId = 'wf-review-step-1'
    const approval = { approvalId: 'approval-plan', command: 'plan command', state: 'pending' as const, turnId: 'plan-turn' }
    const test = fixture({ chatId, activeTurn: { turnId: 'plan-turn', clientMessageId: 'plan-input', status: 'waiting_for_approval' }, pendingApprovals: [approval], feed: [{ ...savedHistory[0], approvals: [approval] }] })
    render(<StructuredChat {...test.props} chatId={chatId} presets={chatPresets} />)
    await ready()
    expect(screen.getByTestId('agent-chat-plan-owned').textContent).toBe('Managed by plan')
    fill('Do not send manually')
    expect((screen.getByTestId('composer-send-button') as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByTestId('composer-preset-button') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByTestId('composer-stop-button')).toBeNull()
    expect(screen.queryByTestId('agent-session-terminate')).toBeNull()
    expect(screen.queryByTestId('composer-queue-button')).toBeNull()
    fireEvent.click(screen.getByTestId('agent-cli-logs-toggle'))
    expect(screen.getByTestId('agent-cli-log-pane')).not.toBeNull()
    expect(screen.getByText('plan command')).not.toBeNull()
    expect(test.api.send).not.toHaveBeenCalled()
    expect(test.api.reconfigure).not.toHaveBeenCalled()
  })

  it('sends the displayed saved preset model after asynchronous preset loading', async () => {
    const test = fixture()
    const view = render(<StructuredChat {...test.props} presets={[]} />)
    await ready()
    view.rerender(<StructuredChat {...test.props} presets={chatPresets} />)
    expect(screen.getByTestId('composer-preset-button').getAttribute('title')).toContain('fixture-model')
    fill('First prompt')
    await act(async () => fireEvent.click(screen.getByTestId('composer-send-button')))
    expect(test.api.create.mock.calls[0][0]).toMatchObject({ presetName: 'Native Codex', model: 'fixture-model', provider: 'codex' })
  })

  it('preserves an explicit task model selection when a saved preset has a different model', async () => {
    const test = fixture()
    render(<StructuredChat {...test.props} presets={chatPresets} model="selected-model-from-task" />)
    await ready()
    expect(screen.getByTestId('composer-preset-button').getAttribute('title')).toContain('selected-model-from-task')
    fill('Use my chosen model')
    await act(async () => fireEvent.click(screen.getByTestId('composer-send-button')))
    expect(test.api.create.mock.calls[0][0]).toMatchObject({ presetName: 'Native Codex', model: 'selected-model-from-task', provider: 'codex' })
    expect(test.api.send).toHaveBeenCalledWith(expect.objectContaining({ text: 'Use my chosen model' }))
  })

  it('uses a fresh launch request after explicitly changing a configuration that failed to start', async () => {
    const test = fixture()
    test.api.create.mockRejectedValueOnce(new Error('Original CLI unavailable'))
    render(<StructuredChat {...test.props} presets={chatPresets} initialPrompt="Keep and retry" />)
    await ready()
    await act(async () => fireEvent.click(screen.getByTestId('composer-send-button')))
    const oldRequest = test.api.create.mock.calls[0][0].requestId
    openSettings()
    await act(async () => selectPreset('Claude review'))
    expect(input().value).toBe('Keep and retry')
    await act(async () => fireEvent.click(screen.getByTestId('composer-send-button')))
    expect(test.api.create.mock.calls[1][0].requestId).not.toBe(oldRequest)
    expect(test.api.create.mock.calls[1][0]).toMatchObject({ presetName: 'Claude review', provider: 'claude', model: 'sonnet' })
    expect(test.api.send).toHaveBeenCalledTimes(1)
  })

  it('shows an honest End session action when a provider cannot interrupt a turn', async () => {
    const test = fixture({ provider: 'antigravity', capabilities: { attachments: false, interactiveApprovals: false, interruptTurn: false }, activeTurn: { clientMessageId: 'input-1', turnId: 'turn-1', status: 'running' } })
    test.api.terminate.mockImplementation(async () => test.push({ ...test.base, provider: 'antigravity', sessionStatus: 'stopped' }))
    test.api.snapshot.mockImplementation(async () => ({ ...test.base, provider: 'antigravity', sessionStatus: 'stopped' }))
    render(<StructuredChat {...test.props} provider="antigravity" />)
    await ready()
    expect(screen.queryByTestId('composer-stop-button')).toBeNull()
    expect((screen.getByTestId('composer-send-button') as HTMLButtonElement).disabled).toBe(true)
    await act(async () => fireEvent.click(screen.getByTestId('agent-session-terminate')))
    expect(test.api.terminate).toHaveBeenCalledWith({ sessionId: test.base.sessionId, runId: test.base.runId })
    expect(test.api.interrupt).not.toHaveBeenCalled()
    expect(screen.getByTestId('structured-antigravity-chat').getAttribute('data-session-status')).toBe('stopped')
    expect((screen.getByTestId('composer-send-button') as HTMLButtonElement).disabled).toBe(true)
  })

  it('attaches without spawning or sending, and preserves the initial task request as a visible draft', async () => {
    const test = fixture()
    render(<StructuredChat {...test.props} initialPrompt="Build the requested feature" />)
    await ready()
    expect(input().value).toBe('Build the requested feature')
    expect(test.api.attach).toHaveBeenCalledWith({ taskId: test.props.taskId, chatId: 'chat-main' })
    expect(test.api.create).not.toHaveBeenCalled()
    expect(test.api.send).not.toHaveBeenCalled()
    expect((screen.getByTestId('composer-attach-button') as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByTestId('composer-preset-button') as HTMLButtonElement).disabled).toBe(false)
  })

  it('retains the draft on startup failure and sends only after a confirmed session creation', async () => {
    const test = fixture()
    test.api.create.mockRejectedValueOnce(new Error('Codex binary unavailable'))
    render(<StructuredChat {...test.props} initialPrompt="Important request" />)
    await ready()
    await act(async () => { fireEvent.click(screen.getByTestId('composer-send-button')) })
    expect(input().value).toBe('Important request')
    expect(screen.getByText('Codex binary unavailable')).not.toBeNull()
    expect(test.api.send).not.toHaveBeenCalled()
    await act(async () => { fireEvent.click(screen.getByTestId('composer-send-button')) })
    expect(test.api.create.mock.calls[1][0].requestId).toBe(test.api.create.mock.calls[0][0].requestId)
    expect(test.api.send).toHaveBeenCalledTimes(1)
    expect(test.api.send.mock.calls[0][0]).toMatchObject({
      sessionId: test.base.sessionId, runId: 'run-1', text: 'Important request',
    })
    expect(input().value).toBe('')
  })

  it('reuses the message identity after an ambiguous send failure and clears the draft only on acknowledgement', async () => {
    const test = fixture({})
    const receipt = deferred<Awaited<ReturnType<AgentSessionsAPI['send']>>>()
    test.api.send.mockRejectedValueOnce(new Error('Reply transport failed')).mockImplementationOnce(() => receipt.promise)
    render(<StructuredChat {...test.props} />)
    await ready()
    fill('Retry exactly once')
    await act(async () => { fireEvent.click(screen.getByTestId('composer-send-button')) })
    expect(input().value).toBe('Retry exactly once')
    await act(async () => { fireEvent.click(screen.getByTestId('composer-send-button')) })
    const first = test.api.send.mock.calls[0][0]
    const retry = test.api.send.mock.calls[1][0]
    expect(retry.clientMessageId).toBe(first.clientMessageId)
    expect(input().value).toBe('Retry exactly once')
    await act(async () => { receipt.resolve({ ...retry, cursor: 2, turnId: 'turn-1' }) })
    expect(input().value).toBe('')
  })

  it('keeps a newer draft across remount when an earlier send acknowledgement arrives', async () => {
    const test = fixture({})
    const receipt = deferred<Awaited<ReturnType<AgentSessionsAPI['send']>>>()
    test.api.send.mockImplementationOnce(() => receipt.promise)
    const first = render(<StructuredChat {...test.props} />)
    await ready()
    fill('Original message')
    await act(async () => { fireEvent.click(screen.getByTestId('composer-send-button')) })
    const request = test.api.send.mock.calls[0][0]
    first.unmount()
    render(<StructuredChat {...test.props} />)
    await ready()
    fill('New unsent draft')
    await act(async () => { receipt.resolve({ ...request, cursor: 2, turnId: 'turn-1' }) })
    expect(input().value).toBe('New unsent draft')
    expect(test.api.send).toHaveBeenCalledTimes(1)
  })

  it('keeps a same-text replacement through delayed Send ACK and does not steal options focus', async () => {
    const test = fixture({ presetName: '' })
    const receipt = deferred<Awaited<ReturnType<AgentSessionsAPI['send']>>>()
    test.api.send.mockImplementationOnce(() => receipt.promise)
    render(<StructuredChat {...test.props} presetName="" />); await ready()
    fill('Repeat text')
    fireEvent.click(screen.getByTestId('composer-send-button'))
    expect(document.activeElement).toBe(input())
    fill('Changed away'); fill('Repeat text')
    fireEvent.click(screen.getByTestId('composer-options-button'))
    const target = screen.getByTestId('agent-chat-settings')
    target.tabIndex = -1; target.focus()
    const request = test.api.send.mock.calls[0][0]
    await act(async () => receipt.resolve({ ...request, cursor: 2, turnId: 'turn-1' }))
    expect(input().value).toBe('Repeat text')
    expect(document.activeElement).toBe(target)
    expect(test.api.send).toHaveBeenCalledTimes(1)
  })

  it('forwards explicit task options instead of overwritten saved preset defaults', async () => {
    const test = fixture()
    render(<StructuredChat {...test.props} presets={chatPresets} permissions="Read only" reasoningEffort="xhigh" model="task-model" />)
    await ready(); fill('Use task configuration')
    await act(async () => fireEvent.click(screen.getByTestId('composer-send-button')))
    expect(test.api.create.mock.calls[0][0]).toMatchObject({ model: 'task-model', permissions: 'Read only', reasoningEffort: 'xhigh' })
  })

  it('preserves a definitively rejected draft and uses a new identity only for the next explicit attempt', async () => {
    const test = fixture({})
    test.api.send.mockImplementationOnce(async request => ({ ...request, cursor: 2, outcome: 'rejected', error: 'Provider temporarily refused the turn' }))
    render(<StructuredChat {...test.props} />)
    await ready()
    fill('Keep this request')
    await act(async () => { fireEvent.click(screen.getByTestId('composer-send-button')) })
    const first = test.api.send.mock.calls[0][0]
    expect(input().value).toBe('Keep this request')
    expect(screen.getByText('Provider temporarily refused the turn')).not.toBeNull()
    expect(test.api.send).toHaveBeenCalledTimes(1)
    await act(async () => { test.push({ ...test.base, cursor: 2, feed: [{
      id: `user-${first.clientMessageId}`, role: 'user', text: first.text, thinking: '', status: 'error', timestamp: 1,
    }] }) })
    expect(screen.getByTestId(`message-send-error-user-${first.clientMessageId}`).textContent).toContain('Message was not accepted')
    await act(async () => { fireEvent.click(screen.getByTestId('composer-send-button')) })
    expect(test.api.send.mock.calls[1][0].clientMessageId).not.toBe(first.clientMessageId)
    expect(test.api.send.mock.calls[1][0].text).toBe(first.text)
    expect(input().value).toBe('')
  })

  it('does not let a late rejection clear another pending send after remount', async () => {
    const test = fixture({})
    const firstReceipt = deferred<Awaited<ReturnType<AgentSessionsAPI['send']>>>()
    const nextReceipt = deferred<Awaited<ReturnType<AgentSessionsAPI['send']>>>()
    test.api.send.mockImplementationOnce(() => firstReceipt.promise).mockImplementationOnce(() => nextReceipt.promise)
    const mounted = render(<StructuredChat {...test.props} />)
    await ready()
    fill('Earlier request')
    await act(async () => { fireEvent.click(screen.getByTestId('composer-send-button')) })
    const first = test.api.send.mock.calls[0][0]
    mounted.unmount()
    const later = render(<StructuredChat {...test.props} />)
    await ready()
    fill('Newer request')
    await act(async () => { fireEvent.click(screen.getByTestId('composer-send-button')) })
    const next = test.api.send.mock.calls[1][0]
    await act(async () => { firstReceipt.resolve({ ...first, cursor: 2, outcome: 'rejected', error: 'Rejected earlier' }) })
    expect(input().value).toBe('Newer request')
    later.unmount()
    render(<StructuredChat {...test.props} />)
    await ready()
    await act(async () => { fireEvent.click(screen.getByTestId('composer-send-button')) })
    expect(test.api.send.mock.calls[2][0].clientMessageId).toBe(next.clientMessageId)
    await act(async () => { nextReceipt.resolve({ ...next, cursor: 3 }) })
  })

  it('reconciles events received during attach and ignores stale cursors and other runs', async () => {
    const test = fixture()
    const attaching = deferred<AgentSessionSnapshot | null>()
    test.api.attach.mockImplementationOnce(() => attaching.promise)
    render(<StructuredChat {...test.props} initialPrompt="Should not be replayed" />)
    const updated = {
      ...test.base, cursor: 4,
      feed: [{ id: 'assistant', role: 'assistant' as const, text: 'Latest response', thinking: '', status: 'completed' as const, timestamp: 1 }],
    }
    await act(async () => { test.push(updated); attaching.resolve({ ...test.base, cursor: 2 }) })
    expect(screen.getByText('Latest response')).not.toBeNull()
    expect(input().value).toBe('')
    await act(async () => {
      test.push({ ...test.base, cursor: 3 })
      test.push({ ...test.base, runId: 'obsolete-run', cursor: 900 })
      test.push({ ...test.base, taskId: 'another-task', cursor: 901 })
    })
    expect(screen.getByText('Latest response')).not.toBeNull()
  })

  it('waits for matching completion after Stop ACK while allowing the next draft to be typed', async () => {
    const test = fixture({ activeTurn: { turnId: 'turn-1', clientMessageId: 'message-1', status: 'running' } })
    render(<StructuredChat {...test.props} />)
    await ready()
    fill('The next message')
    expect((screen.getByTestId('composer-send-button') as HTMLButtonElement).disabled).toBe(true)
    await act(async () => { fireEvent.click(screen.getByTestId('composer-stop-button')) })
    expect(test.api.interrupt).toHaveBeenCalledWith({ sessionId: test.base.sessionId, runId: 'run-1', turnId: 'turn-1' })
    expect((screen.getByTestId('composer-stop-button') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.keyDown(input(), { key: 'Enter' })
    expect(test.api.send).not.toHaveBeenCalled()
    await act(async () => { test.push({ ...test.base, cursor: 5, lastTurn: { turnId: 'turn-1', clientMessageId: 'message-1', status: 'interrupted' } }) })
    expect(screen.queryByTestId('composer-stop-button')).toBeNull()
    await act(async () => { fireEvent.click(screen.getByTestId('composer-send-button')) })
    expect(test.api.create).not.toHaveBeenCalled()
    expect(test.api.send.mock.calls[0][0]).toMatchObject({ sessionId: test.base.sessionId, runId: 'run-1', text: 'The next message' })
  })

  it('preserves approval errors for retry and sends the exact approval/run/turn identity', async () => {
    const approval = { approvalId: 'approval-1', command: 'fixture command', state: 'pending' as const, turnId: 'turn-1' }
    const test = fixture({
      activeTurn: { turnId: 'turn-1', clientMessageId: 'message-1', status: 'waiting_for_approval' },
      pendingApprovals: [approval],
      feed: [{ id: 'assistant', role: 'assistant', text: '', thinking: '', status: 'streaming', timestamp: 1, approvals: [approval] }],
    })
    test.api.resolveApproval.mockRejectedValueOnce(new Error('Temporary approval failure'))
    render(<StructuredChat {...test.props} />)
    await ready()
    await act(async () => { fireEvent.click(screen.getByTestId('approval-allow-approval-1')) })
    expect(screen.getByText('Temporary approval failure')).not.toBeNull()
    await act(async () => { fireEvent.click(screen.getByTestId('approval-deny-approval-1')) })
    expect(test.api.resolveApproval.mock.calls[1][0]).toEqual({ sessionId: test.base.sessionId, runId: 'run-1', turnId: 'turn-1', approvalId: 'approval-1', decision: 'deny' })
  })

  it('shows disconnected history without spawning or pretending it can continue the old thread', async () => {
    const test = fixture({ sessionStatus: 'disconnected', feed: [{ id: 'old', role: 'assistant', text: 'Saved conversation', thinking: '', status: 'completed', timestamp: 1 }] })
    render(<StructuredChat {...test.props} />)
    await ready()
    expect(screen.getByText('Saved conversation')).not.toBeNull()
    fill('Unsent after restart')
    expect((screen.getByTestId('composer-send-button') as HTMLButtonElement).disabled).toBe(true)
    expect(test.api.create).not.toHaveBeenCalled()
    expect(test.api.send).not.toHaveBeenCalled()
  })

  it('follows new snapshots at the bottom and preserves a manually scrolled-up conversation', async () => {
    const test = fixture({})
    render(<StructuredChat {...test.props} />)
    await ready()
    const feed = screen.getByTestId('conversation-feed')
    Object.defineProperty(feed, 'clientHeight', { value: 400, configurable: true })
    Object.defineProperty(feed, 'scrollHeight', { value: 1000, configurable: true })
    feed.scrollTop = 600
    fireEvent.scroll(feed)
    Object.defineProperty(feed, 'scrollHeight', { value: 1200, configurable: true })
    await act(async () => {
      test.push({ ...test.base, cursor: 2, feed: [{ id: 'first', role: 'assistant', thinking: '', text: 'First reply', status: 'completed', timestamp: 1 }] })
    })
    expect(feed.scrollTop).toBe(1200)
    feed.scrollTop = 100
    fireEvent.scroll(feed)
    Object.defineProperty(feed, 'scrollHeight', { value: 1500, configurable: true })
    await act(async () => {
      test.push({ ...test.base, cursor: 3, feed: [{ id: 'second', role: 'assistant', thinking: '', text: 'Reply while reading history', status: 'completed', timestamp: 2 }] })
    })
    expect(feed.scrollTop).toBe(100)
  })
})
