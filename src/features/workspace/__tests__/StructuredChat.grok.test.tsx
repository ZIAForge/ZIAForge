/** @vitest-environment happy-dom */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentSessionSnapshot, AgentSessionsAPI, AgentSessionUpdate } from '../../../../shared/agent-session'
import type { AgentMediaRef } from '../../../../shared/agent-media'
import type { AgentInputImageRef } from '../../../../shared/agent-input-images'
import type { GrokInteraction } from '../../../../shared/grok-interactions'
import { useStore, type Settings } from '../../../store'
import { StructuredChat } from '../StructuredChat'

let identity = 0
const image: AgentInputImageRef = { id: 'input-image-11111111-1111-4111-8111-111111111111', name: 'fixture.png', mime: 'image/png', bytes: 8, width: 2, height: 1, sha256: 'a'.repeat(64) }
const connection = { id: 'grok-fixture', name: 'Grok fixture', baseUrl: 'http://127.0.0.1:9999/v1', enabled: true, hasApiKey: false, model: 'grok-model', transport: 'responses', profile: 'grok-connector-v1' }
const deferred = <T,>() => { let resolve!: (value: T) => void; let reject!: (error: Error) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
function fixture(initial: Partial<AgentSessionSnapshot> | null = {}) {
  const taskId = `grok-ui-${++identity}`
  const base: AgentSessionSnapshot = { taskId, chatId: 'main', sessionId: `session-${taskId}`, runId: 'run-1', cursor: 1, provider: 'api', presetName: '', model: 'grok-model', apiConnectionId: connection.id, apiTransport: 'responses', apiProfile: 'grok-connector-v1', apiGrokConfig: { contextWindow: 32000, maxTurns: 9 }, sessionStatus: 'ready', capabilities: { attachments: true, interactiveApprovals: true, interruptTurn: true }, feed: [], pendingApprovals: [] }
  let current: AgentSessionSnapshot | null = initial === null ? null : { ...base, ...initial }
  const listeners = new Set<(update: AgentSessionUpdate) => void>()
  const api = {
    attach: vi.fn<AgentSessionsAPI['attach']>(async () => current), create: vi.fn<AgentSessionsAPI['create']>(async () => current = base), snapshot: vi.fn<AgentSessionsAPI['snapshot']>(async () => current ?? base),
    send: vi.fn<AgentSessionsAPI['send']>(async request => ({ ...request, outcome: 'accepted', turnId: 'sent-turn', cursor: 2 })),
    queue: vi.fn<AgentSessionsAPI['queue']>(async () => base), setQueuePaused: vi.fn<AgentSessionsAPI['setQueuePaused']>(async () => base), cancelQueued: vi.fn<AgentSessionsAPI['cancelQueued']>(async () => base),
    interrupt: vi.fn<AgentSessionsAPI['interrupt']>().mockResolvedValue(undefined), terminate: vi.fn<AgentSessionsAPI['terminate']>().mockResolvedValue(undefined),
    resume: vi.fn<AgentSessionsAPI['resume']>(async () => current = { ...base, runId: 'run-2' }), reconfigure: vi.fn<AgentSessionsAPI['reconfigure']>(async () => base), resolveApproval: vi.fn<AgentSessionsAPI['resolveApproval']>().mockResolvedValue(undefined),
    resolveInteraction: vi.fn<NonNullable<AgentSessionsAPI['resolveInteraction']>>().mockResolvedValue(undefined),
    pickImages: vi.fn<NonNullable<AgentSessionsAPI['pickImages']>>().mockResolvedValue([image]), listImages: vi.fn<NonNullable<AgentSessionsAPI['listImages']>>().mockResolvedValue([]), discardImages: vi.fn<NonNullable<AgentSessionsAPI['discardImages']>>().mockResolvedValue(undefined),
    onEvent: vi.fn<AgentSessionsAPI['onEvent']>(listener => { listeners.add(listener); return () => { listeners.delete(listener) } }),
  } satisfies AgentSessionsAPI
  const push = (snapshot: AgentSessionSnapshot) => { current = snapshot; listeners.forEach(listener => listener({ snapshot })) }
  return { base, api, push, props: { taskId, chatId: 'main', presetName: '', provider: 'api' as const, model: 'grok-model', apiConnectionId: connection.id, api } }
}
const input = () => screen.getByTestId('composer-input') as HTMLTextAreaElement
const sendButton = () => screen.getByTestId('composer-send-button') as HTMLButtonElement
const attachButton = () => screen.getByTestId('composer-attach-button') as HTMLButtonElement
const ready = () => waitFor(() => expect(screen.getByTestId('agent-session-status').textContent).not.toBe('Connecting…'))
const fill = (value: string) => fireEvent.change(input(), { target: { value } })
const pick = async () => { await waitFor(() => expect(attachButton().disabled).toBe(false)); await act(async () => fireEvent.click(attachButton())); await waitFor(() => expect(screen.getByTestId(`attachment-chip-${image.id}`)).not.toBeNull()) }

beforeEach(() => {
  const storage = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) })
  useStore.setState({ settings: { uiLanguage: 'en' } as Settings })
  Object.defineProperty(window, 'ziafAPI', { configurable: true, writable: true, value: { apiConnections: { list: vi.fn().mockResolvedValue([connection]) }, getAgentModelCatalog: vi.fn().mockResolvedValue({ status: 'ready', models: [{ id: 'grok-model', label: 'Grok' }] }) } })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('Grok structured UI boundaries', () => {
  it('creates the selected connection without inference for the native picker and sends an image-only message by ID', async () => {
    const test = fixture(null)
    render(<StructuredChat {...test.props} />)
    await ready(); await pick()
    expect(test.api.create).toHaveBeenCalledTimes(1)
    expect(test.api.create.mock.calls[0][0]).toMatchObject({ provider: 'api', apiConnectionId: connection.id, model: 'grok-model' })
    expect(test.api.send).not.toHaveBeenCalled()
    expect(test.api.pickImages).toHaveBeenCalledExactlyOnceWith({ sessionId: test.base.sessionId, runId: 'run-1' })
    expect(screen.getByTestId('agent-chat-api-transport').textContent).toContain('Grok Connector v1')
    expect(screen.getByTestId('agent-chat-grok-config').textContent).toContain('32000')
    await waitFor(() => expect(sendButton().disabled).toBe(false))
    await act(async () => fireEvent.click(sendButton()))
    expect(test.api.send).toHaveBeenCalledTimes(1)
    expect(test.api.send.mock.calls[0][0]).toMatchObject({ text: '', imageIds: [image.id] })
    expect(test.api.send.mock.calls[0][0]).not.toHaveProperty('attachments')
    expect(test.api.discardImages).toHaveBeenCalledExactlyOnceWith({ sessionId: test.base.sessionId, runId: 'run-1', imageIds: [image.id] })
    expect(screen.queryByTestId(`attachment-chip-${image.id}`)).toBeNull()
  })

  it('retains an ambiguous image send for the same ID retry and preserves newer text until explicit discard acknowledgement', async () => {
    const test = fixture(), discard = deferred<void>()
    test.api.send.mockRejectedValue(new Error('Unknown delivery'))
    render(<StructuredChat {...test.props} />); await ready(); await pick(); fill('Original image question')
    await act(async () => fireEvent.click(sendButton()))
    const first = test.api.send.mock.calls[0][0]
    expect(screen.getByTestId(`attachment-chip-${image.id}`)).not.toBeNull()
    await act(async () => fireEvent.click(sendButton()))
    expect(test.api.send.mock.calls[1][0]).toEqual(first)
    fill('Keep this newer text')
    expect(sendButton().disabled).toBe(true)
    test.api.discardImages.mockImplementation(() => discard.promise)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Discard image draft' })))
    expect(screen.getByTestId(`attachment-chip-${image.id}`)).not.toBeNull()
    const key = `ziaf-agent-draft:${JSON.stringify([test.base.taskId, test.base.chatId])}`
    expect(JSON.parse(localStorage.getItem(key)!).pending.id).toBe(first.clientMessageId)
    await act(async () => discard.resolve())
    expect(JSON.parse(localStorage.getItem(key)!).pending).toBeUndefined()
    expect(input().value).toBe('Keep this newer text')
    expect(screen.queryByTestId(`attachment-chip-${image.id}`)).toBeNull()
    expect(test.api.send).toHaveBeenCalledTimes(2)
  })

  it('discards an old native picker result after switching chats without attaching it to the next chat', async () => {
    const first = fixture(), next = fixture(), selected = deferred<AgentInputImageRef[]>()
    first.api.pickImages.mockImplementation(() => selected.promise)
    const view = render(<StructuredChat {...first.props} />); await ready()
    await waitFor(() => expect(attachButton().disabled).toBe(false))
    fireEvent.click(attachButton())
    view.rerender(<StructuredChat {...next.props} />); await ready()
    await act(async () => selected.resolve([image]))
    expect(first.api.discardImages).toHaveBeenCalledExactlyOnceWith({ sessionId: first.base.sessionId, runId: 'run-1', imageIds: [image.id] })
    expect(screen.queryByTestId('composer-attachments-list')).toBeNull()
    expect(next.api.discardImages).not.toHaveBeenCalled(); expect(first.api.send).not.toHaveBeenCalled()
  })

  it('loads unsent images in a disconnected run and permits Resume only after their explicit removal', async () => {
    const test = fixture({ sessionStatus: 'disconnected', resumeAvailable: true })
    test.api.listImages.mockResolvedValue([image])
    render(<StructuredChat {...test.props} />); await ready()
    await waitFor(() => expect(screen.getByTestId(`attachment-chip-${image.id}`)).not.toBeNull())
    const resume = screen.getByTestId('agent-session-resume') as HTMLButtonElement
    expect(resume.disabled).toBe(true)
    await act(async () => fireEvent.click(screen.getByTestId(`remove-attachment-${image.name}`)))
    expect(test.api.discardImages).toHaveBeenCalledTimes(1)
    expect(resume.disabled).toBe(false)
    test.api.listImages.mockResolvedValue([])
    await act(async () => fireEvent.click(resume))
    expect(test.api.resume).toHaveBeenCalledExactlyOnceWith({ sessionId: test.base.sessionId, runId: 'run-1' })
    expect(test.api.send).not.toHaveBeenCalled()
  })

  it('opens retained user image history through the resumed owner without using its discarded draft cache', async () => {
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
    const media: AgentMediaRef = { id: 'media-22222222-2222-4222-8222-222222222222', sourceRunId: 'old-run', mime: 'image/png', bytes: bytes.byteLength, width: 2, height: 1, sha256: 'b'.repeat(64) }
    const test = fixture({ feed: [{ id: 'sent-image', role: 'user', text: '', thinking: '', timestamp: 1, status: 'completed', media: [media] }] })
    const read = vi.fn().mockResolvedValue({ bytes, mime: 'image/png' }), save = vi.fn().mockResolvedValue({ cancelled: false })
    Object.defineProperty(window, 'ziafAPI', { configurable: true, writable: true, value: { ...window.ziafAPI, agentMedia: { read, save } } })
    vi.stubGlobal('IntersectionObserver', undefined)
    const previousCreate = Object.getOwnPropertyDescriptor(URL, 'createObjectURL'), previousRevoke = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL')
    const revoke = vi.fn()
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:retained-user-image') })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revoke })
    let view: ReturnType<typeof render> | undefined
    try {
      view = render(<StructuredChat {...test.props} />); await ready()
      await waitFor(() => expect(screen.getByTestId(`generated-image-${media.id}`)).not.toBeNull())
      expect(read).toHaveBeenCalledExactlyOnceWith({ sessionId: test.base.sessionId, runId: 'run-1', mediaId: media.id })
      expect(screen.getByRole('img', { name: 'Attached image' })).not.toBeNull()
      await act(async () => fireEvent.click(screen.getByTestId(`generated-media-save-${media.id}`)))
      expect(save).toHaveBeenCalledExactlyOnceWith({ sessionId: test.base.sessionId, runId: 'run-1', mediaId: media.id })
      expect(test.api.pickImages).not.toHaveBeenCalled(); expect(test.api.send).not.toHaveBeenCalled()
      expect(screen.queryByTestId('composer-attachments-list')).toBeNull()
    } finally {
      view?.unmount()
      for (const [key, descriptor] of [['createObjectURL', previousCreate], ['revokeObjectURL', previousRevoke]] as const) {
        if (descriptor) Object.defineProperty(URL, key, descriptor); else Reflect.deleteProperty(URL, key)
      }
    }
    expect(revoke).toHaveBeenCalledWith('blob:retained-user-image')
  })

  it('resolves only a live native question against its owning turn and keeps replayed cards read-only', async () => {
    const request: GrokInteraction = { interactionId: 'question-live', responseId: 'response-1', state: 'pending', expiresAt: Date.now() + 60_000, kind: 'question', request: { sessionId: 'native-id', toolCallId: 'ask-native', mode: 'default', questions: [{ question: 'Exact native question?', options: [{ label: 'Exact native answer', description: '' }], multiSelect: false }] } }
    const feed: AgentSessionSnapshot['feed'] = [{ id: 'native-card', text: '', thinking: '', role: 'assistant', status: 'streaming', timestamp: 1, interactions: [request] }]
    const test = fixture({ feed, activeTurn: { turnId: 'turn-1', clientMessageId: 'input-1', status: 'running' }, pendingInteractions: [{ ...request, turnId: 'turn-1' }] })
    render(<StructuredChat {...test.props} />); await ready()
    expect(screen.getByTestId('agent-session-status').textContent).toBe('Waiting for your response')
    fireEvent.click(screen.getByRole('radio', { name: 'Exact native answer' }))
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Send answer' })))
    expect(test.api.resolveInteraction).toHaveBeenCalledExactlyOnceWith({ sessionId: test.base.sessionId, runId: 'run-1', turnId: 'turn-1', interactionId: 'question-live', answer: { kind: 'question', outcome: 'accepted', answers: { 'Exact native question?': ['Exact native answer'] } } })
    act(() => test.push({ ...test.base, cursor: 3, feed, pendingInteractions: [] }))
    expect((screen.getByRole('button', { name: 'Cancel question' }) as HTMLButtonElement).disabled).toBe(true)
    expect(test.api.resolveApproval).not.toHaveBeenCalled(); expect(test.api.send).not.toHaveBeenCalled()
  })
})
