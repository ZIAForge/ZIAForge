import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentAdapter, CreateAdapterOptions } from '../../agents/AgentAdapterFactory'
import type { AgentEvent } from '../../../shared/agent-events'
import type { AgentInteractionRequest } from '../../../shared/agent-session'
import type { GrokInteraction } from '../../../shared/grok-interactions'
import { RunService } from '../RunService'
import { SessionRegistry } from '../SessionRegistry'
import { ProcessSupervisor } from '../ProcessSupervisor'
import type { TrustedAgentSessionConfig } from '../SessionManager'
import { validateSessionCommand } from '../AgentSessionValidation'

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXv8AAAAASUVORK5CYII=', 'base64')
const interaction: GrokInteraction = { kind: 'question', interactionId: `question_${'a'.repeat(32)}`, responseId: `resp_${'b'.repeat(32)}`, state: 'pending', expiresAt: Date.now() + 600000, request: { sessionId: 'native', toolCallId: 'native-question', mode: 'default', questions: [{ question: 'Which option?', options: [{ label: 'One', description: '' }], multiSelect: false }] } }
class Provider implements AgentAdapter {
  readonly start = vi.fn(async () => ({ sessionId: 'api-native' }))
  readonly stop = vi.fn(async () => {})
  readonly sendPrompt = vi.fn<AgentAdapter['sendPrompt']>(async () => { this.emit({ type: 'agent.status.changed', scope: 'turn', status: 'running', turnId: 'turn-one' }); return { turnId: 'turn-one' } })
  readonly resolveApproval = vi.fn(async () => {})
  readonly resolveInteraction = vi.fn<NonNullable<AgentAdapter['resolveInteraction']>>(async request => { this.emit({ type: 'interaction.state.changed', interactionId: request.interactionId, state: 'resolved', answer: request.answer, turnId: request.turnId }) })
  constructor(readonly options: CreateAdapterOptions) {}
  emit(payload: Record<string, unknown>) { this.options.onEvent?.({ eventId: randomUUID(), taskId: this.options.taskId, runId: this.options.runId!, timestamp: Date.now(), ...payload } as AgentEvent) }
  getStatus() { return 'running' as const }
  getPid() { return undefined }
  getSessionId() { return 'api-native' }
  getCapabilities() { return { attachments: true, interactiveApprovals: true, textStreaming: true, thinkingStreaming: false, toolCalls: true, toolOutputStreaming: true } }
  getProvider() { return 'api' as const }
  getTaskId() { return this.options.taskId }
  getRunId() { return this.options.runId! }
}

describe('Grok session ownership, private image inputs and durable native answers', () => {
  let root: string, service: RunService, config: TrustedAgentSessionConfig, providers: Provider[]
  const create = () => new RunService({ baseStorageDir: path.join(root, 'storage'), sessionRegistry: new SessionRegistry(), processSupervisor: new ProcessSupervisor(), createAdapter: options => { const provider = new Provider(options); providers.push(provider); return provider } })
  beforeEach(() => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ziaf-grok-sessions-')))
    providers = []
    config = { taskId: 'task-one', chatId: 'chat-one', presetName: '', provider: 'api', model: 'grok-test', cwd: root, apiConnectionId: 'grok-fixture', apiConnection: { id: 'grok-fixture', name: 'Fixture', baseUrl: 'https://fixture.invalid/v1', model: 'grok-test', enabled: true, hasApiKey: false, transport: 'responses', profile: 'grok-connector-v1', grok: { contextWindow: 131072, maxTurns: 8 } } }
    service = create()
  })
  afterEach(async () => { await service.sessions.shutdown(); vi.restoreAllMocks(); fs.rmSync(root, { recursive: true, force: true }) })

  it('journals an owned workflow question answer before one native submission and rejects replay or another turn', async () => {
    config.chatId = 'wf-native-question'
    const session = await service.sessions.create(config)
    await service.sessions.send({ ...session, clientMessageId: 'hello', text: 'Hello' })
    providers[0].emit({ type: 'interaction.requested', interaction, turnId: 'turn-one' })
    const request: AgentInteractionRequest = { ...session, turnId: 'turn-one', interactionId: interaction.interactionId, answer: { kind: 'question', outcome: 'accepted', answers: { 'Which option?': ['One'] } } }
    providers[0].resolveInteraction.mockImplementation(async submitted => {
      const journal = await service.getJournal(session.taskId, session.runId).readEvents()
      expect(journal.find(event => event.type === 'interaction.state.changed' && event.state === 'submitting')).toMatchObject({ answer: request.answer })
      providers[0].emit({ type: 'interaction.state.changed', turnId: submitted.turnId, interactionId: submitted.interactionId, state: 'resolved', answer: submitted.answer })
    })
    await expect(service.sessions.resolveInteraction({ ...request, turnId: 'another-turn' })).rejects.toThrow('stale')
    await service.sessions.resolveInteraction(request)
    await expect(service.sessions.resolveInteraction(request)).rejects.toThrow()
    expect(providers[0].resolveInteraction).toHaveBeenCalledTimes(1)
    expect((await service.sessions.snapshot(session)).feed.flatMap(message => message.interactions ?? [])).toMatchObject([{ state: 'resolved', answer: request.answer }])
  })
  it('does not dispatch an answer when its journal write fails', async () => {
    const session = await service.sessions.create(config)
    await service.sessions.send({ ...session, clientMessageId: 'hello', text: 'Hello' })
    providers[0].emit({ type: 'interaction.requested', interaction, turnId: 'turn-one' })
    await service.sessions.snapshot(session)
    vi.spyOn(service.getJournal(session.taskId, session.runId), 'append').mockRejectedValueOnce(new Error('disk full'))
    await expect(service.sessions.resolveInteraction({ ...session, turnId: 'turn-one', interactionId: interaction.interactionId, answer: { kind: 'question', outcome: 'cancelled' } })).rejects.toThrow('disk full')
    expect(providers[0].resolveInteraction).not.toHaveBeenCalled()
  })
  it('keeps staged images under the original owner across restart, then allows explicit discard and Resume', async () => {
    const session = await service.sessions.create(config), filename = path.join(root, 'selected.png'); fs.writeFileSync(filename, png)
    const refs = await service.sessions.stageImages(session, [filename])
    await expect(service.sessions.reconfigure({ ...session, presetName: '', requestId: 'blocked' }, config)).rejects.toThrow('unsent input images')
    await service.sessions.shutdown(); service = create()
    const restored = (await service.sessions.attach(config))!
    expect(restored.sessionStatus).toBe('disconnected')
    expect(await service.sessions.listImages(restored)).toEqual(refs)
    await expect(service.sessions.resume(restored, config)).rejects.toThrow('unsent input images')
    await service.sessions.discardImages({ ...restored, imageIds: refs.map(ref => ref.id) })
    const resumed = await service.sessions.resume(restored, config)
    expect(resumed).toMatchObject({ sessionStatus: 'ready', apiGrokConfig: { contextWindow: 131072, maxTurns: 8 } })
    expect(await service.sessions.listImages(resumed)).toEqual([])
  })
  it('resolves owned image-only inputs before the adapter and keeps bytes out of the journal', async () => {
    const session = await service.sessions.create(config), filename = path.join(root, 'selected.png'); fs.writeFileSync(filename, png)
    const refs = await service.sessions.stageImages(session, [filename])
    const receipt = await service.sessions.send({ ...session, clientMessageId: 'image-only', text: '', imageIds: [refs[0].id] })
    expect(receipt.outcome).toBe('accepted')
    expect(providers[0].sendPrompt).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ text: '', inputImages: [{ id: refs[0].id, mime: 'image/png', dataUrl: `data:image/png;base64,${png.toString('base64')}` }] }))
    const raw = fs.readFileSync(service.getJournal(session.taskId, session.runId).filePath, 'utf8')
    expect(raw).toContain(refs[0].id)
    expect(raw).not.toContain(png.toString('base64'))
    const snapshot = await service.sessions.snapshot(session), media = snapshot.feed.find(message => message.role === 'user')!.media![0]
    expect(await service.sessions.readMedia({ sessionId: session.sessionId, runId: session.runId, mediaId: media.id })).toEqual({ bytes: new Uint8Array(png), mime: 'image/png' })
    await expect(service.sessions.send({ ...session, clientMessageId: 'image-only', text: '', imageIds: ['input-image-22222222-2222-4222-8222-222222222222'] })).rejects.toThrow('different content')
    await expect(service.sessions.queue({ ...session, clientMessageId: 'queued-image', text: 'queued', imageIds: [refs[0].id] })).rejects.toThrow('text-only queue')
    await service.sessions.discardImages({ ...session, imageIds: [refs[0].id] })
    await service.sessions.shutdown(); service = create()
    const restored = (await service.sessions.attach(config))!
    expect(await service.sessions.listImages(restored)).toEqual([])
    expect(await service.sessions.readMedia({ sessionId: restored.sessionId, runId: restored.runId, mediaId: media.id })).toEqual({ bytes: new Uint8Array(png), mime: 'image/png' })
  })
  it('expires replayed questions without native submission and validates bounded IPC IDs', async () => {
    const session = await service.sessions.create(config)
    await service.sessions.send({ ...session, clientMessageId: 'hello', text: 'Hello' })
    providers[0].emit({ type: 'interaction.requested', interaction, turnId: 'turn-one' }); await service.sessions.snapshot(session)
    await service.sessions.shutdown(); service = create()
    const restored = (await service.sessions.attach(config))!
    expect(restored.pendingInteractions).toEqual([])
    expect(restored.feed.flatMap(message => message.interactions ?? [])).toMatchObject([{ state: 'expired' }])
    expect(providers[1]).toBeUndefined()
    const ref = { sessionId: session.sessionId, runId: session.runId, clientMessageId: 'image', text: '', imageIds: ['input-image-11111111-1111-4111-8111-111111111111'] }
    expect(() => validateSessionCommand('send', ref)).not.toThrow()
    expect(() => validateSessionCommand('send', { ...ref, imageIds: [ref.imageIds[0], ref.imageIds[0]] })).toThrow()
    expect(() => validateSessionCommand('send', { ...ref, paths: ['/private/image.png'] })).toThrow()
    expect(() => validateSessionCommand('resolveInteraction', { ...session, turnId: 'turn-one', interactionId: interaction.interactionId, answer: { kind: 'question', outcome: 'accepted', answers: { 'Which option?': ['One'] } }, apiKey: 'never-accepted' })).toThrow()
  })
})
