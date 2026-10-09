/** @vitest-environment happy-dom */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentSessionSnapshot, AgentSessionsAPI, AgentSessionUpdate } from '../../../../shared/agent-session'
import type { AgentInputImageRef } from '../../../../shared/agent-input-images'
import { useStore, type Settings } from '../../../store'
import { StructuredChat } from '../StructuredChat'

let identity = 0
const image: AgentInputImageRef = { id: 'input-image-11111111-1111-4111-8111-111111111111', name: 'fixture.png', mime: 'image/png', bytes: 8, width: 2, height: 1, sha256: 'a'.repeat(64) }
const connection = { id: 'grok-fixture', name: 'Grok fixture', baseUrl: 'http://127.0.0.1:9999/v1', enabled: true, hasApiKey: false, model: 'grok-model', transport: 'anthropic-messages', profile: 'claude-connector-v1' }
function fixture(initial: Partial<AgentSessionSnapshot> | null = {}) {
  const taskId = `claude-ui-${++identity}`
  const base: AgentSessionSnapshot = { taskId, chatId: 'main', sessionId: `session-${taskId}`, runId: 'run-1', cursor: 1, provider: 'api', presetName: '', model: 'grok-model', apiConnectionId: connection.id, apiTransport: 'anthropic-messages', apiProfile: 'claude-connector-v1', apiGrokConfig: { contextWindow: 32000, maxTurns: 9 }, sessionStatus: 'ready', capabilities: { attachments: true, interactiveApprovals: true, interruptTurn: true }, feed: [], pendingApprovals: [] }
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
    pickDocuments: vi.fn<NonNullable<AgentSessionsAPI['pickDocuments']>>().mockResolvedValue([{ id: 'input-document-11111111-1111-4111-8111-111111111111', name: 'requirements.pdf', mime: 'application/pdf', bytes: 100, sha256: 'b'.repeat(64) }]), listDocuments: vi.fn<NonNullable<AgentSessionsAPI['listDocuments']>>().mockResolvedValue([]), discardDocuments: vi.fn<NonNullable<AgentSessionsAPI['discardDocuments']>>().mockResolvedValue(undefined),
    onEvent: vi.fn<AgentSessionsAPI['onEvent']>(listener => { listeners.add(listener); return () => { listeners.delete(listener) } }),
  } satisfies AgentSessionsAPI
  const push = (snapshot: AgentSessionSnapshot) => { current = snapshot; listeners.forEach(listener => listener({ snapshot })) }
  return { base, api, push, props: { taskId, chatId: 'main', presetName: '', provider: 'api' as const, model: 'grok-model', apiConnectionId: connection.id, api } }
}
const sendButton = () => screen.getByTestId('composer-send-button') as HTMLButtonElement
const attachButton = () => screen.getByTestId('composer-attach-button') as HTMLButtonElement
const ready = () => waitFor(() => expect(screen.getByTestId('agent-session-status').textContent).not.toBe('Connecting…'))
const pick = async () => { await waitFor(() => expect(attachButton().disabled).toBe(false)); await act(async () => fireEvent.click(attachButton())); await waitFor(() => expect(screen.getByTestId(`attachment-chip-${image.id}`)).not.toBeNull()) }

beforeEach(() => {
  const storage = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) })
  useStore.setState({ settings: { uiLanguage: 'en' } as Settings })
  Object.defineProperty(window, 'ziafAPI', { configurable: true, writable: true, value: { apiConnections: { list: vi.fn().mockResolvedValue([connection]) }, getAgentModelCatalog: vi.fn().mockResolvedValue({ status: 'ready', models: [{ id: 'grok-model', label: 'Grok' }] }) } })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('Claude typed attachments in chat', () => {
  it('creates a session for a document picker, sends opaque document IDs and preserves mixed images', async () => {
    const test = fixture(null)
    render(<StructuredChat {...test.props} />)
    await ready()
    const documents = await screen.findByTestId('agent-attach-documents')
    await waitFor(() => expect((documents as HTMLButtonElement).disabled).toBe(false))
    await act(async () => fireEvent.click(documents))
    const documentId = 'input-document-11111111-1111-4111-8111-111111111111'
    await waitFor(() => expect(screen.getByTestId(`attachment-chip-${documentId}`)).not.toBeNull())
    await pick()
    await act(async () => fireEvent.click(sendButton()))
    expect(test.api.send).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ text: '', imageIds: [image.id], documentIds: [documentId] }))
    expect(test.api.discardDocuments).toHaveBeenCalledExactlyOnceWith({ sessionId: test.base.sessionId, runId: 'run-1', documentIds: [documentId] })
    expect(screen.queryByTestId(`attachment-chip-${documentId}`)).toBeNull()
    expect(screen.getByTestId('agent-chat-api-transport').textContent).toContain('Anthropic Messages')
  })
  it('keeps a document after an ambiguous send and requires explicit discard before configuration changes', async () => {
    const test = fixture()
    test.api.send.mockRejectedValue(new Error('Delivery unknown'))
    render(<StructuredChat {...test.props} />); await ready()
    await act(async () => fireEvent.click(screen.getByTestId('agent-attach-documents')))
    await waitFor(() => expect(sendButton().disabled).toBe(false))
    await act(async () => fireEvent.click(sendButton()))
    expect(test.api.discardDocuments).not.toHaveBeenCalled()
    expect(screen.getByTestId('attachment-chip-input-document-11111111-1111-4111-8111-111111111111')).not.toBeNull()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Discard image draft' })))
    expect(test.api.discardDocuments).toHaveBeenCalledTimes(1)
    expect(test.api.send).toHaveBeenCalledTimes(1)
  })
})
