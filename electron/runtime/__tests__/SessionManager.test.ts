import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RunService } from '../RunService'
import { CodexRpcRejectedError } from '../../agents/CodexAdapter'
import { writePrivateMetadata } from '../privateStorage'
import * as privateStorage from '../privateStorage'
import { SessionRegistry } from '../SessionRegistry'
import { ProcessSupervisor } from '../ProcessSupervisor'
import type { AgentAdapter, CreateAdapterOptions } from '../../agents/AgentAdapterFactory'
import type { AgentEvent } from '../../../shared/agent-events'
import type { AgentSessionSnapshot } from '../../../shared/agent-session'
import { EventJournal } from '../EventJournal'
import { RecoveryStore } from '../RecoveryStore'
import type { TrustedAgentSessionConfig } from '../SessionManager'

function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: Error) => void; const promise = new Promise<T>((ok, fail) => { resolve = ok; reject = fail }); return { promise, resolve, reject } }
class Provider implements AgentAdapter {
  private turn = 0
  readonly start = vi.fn(async () => ({ pid: 1001, threadId: 'thread-one' }))
  readonly stop = vi.fn(async () => {})
  readonly sendPrompt = vi.fn<AgentAdapter['sendPrompt']>(async () => {
    const turnId = `turn-${++this.turn}`
    this.emit({ type: 'agent.status.changed', scope: 'turn', status: 'running', turnId })
    return { turnId }
  })
  readonly interruptTurn = vi.fn(async (turnId?: string) => ({ turnId: turnId! }))
  readonly resolveApproval = vi.fn(async (approvalId: unknown, decision?: string) => {
    this.emit({ type: 'permission.state.changed', approvalId: approvalId as string, decision: decision as 'allow' | 'deny', state: 'resolved', turnId: `turn-${this.turn}` })
  })
  constructor(readonly options: CreateAdapterOptions) {}
  emit(event: Record<string, unknown>) { this.options.onEvent?.({ eventId: randomUUID(), taskId: this.options.taskId, runId: this.options.runId!, timestamp: Date.now(), ...event } as AgentEvent) }
  complete(turnId = `turn-${this.turn}`, status = 'completed') { this.emit({ type: 'agent.status.changed', scope: 'turn', status, turnId }) }
  getStatus() { return 'running' as const }
  getPid() { return 1001 }
  getSessionId() { return this.options.codexResumeThreadId ?? this.options.claudeResumeSessionId ?? this.options.claudeSessionId ?? this.options.agyConversationId ?? 'thread-one' }
  getCapabilities() { return { textStreaming: true, toolCalls: true, thinkingStreaming: true, toolOutputStreaming: true, interactiveApprovals: true, attachments: false } }
  getProvider() { return 'codex' as const }
  getTaskId() { return this.options.taskId }
  getRunId() { return this.options.runId! }
}

describe('RunService structured sessions with real journal storage', () => {
  let directory: string
  let service: RunService
  let registry: SessionRegistry
  let providers: Provider[]
  let config: TrustedAgentSessionConfig
  const createService = (configure?: (provider: Provider) => void) => new RunService({ sessionRegistry: registry, processSupervisor: new ProcessSupervisor(), baseStorageDir: directory, createAdapter: options => { const provider = new Provider(options); providers.push(provider); configure?.(provider); return provider } })
  const send = (snapshot: AgentSessionSnapshot, clientMessageId = 'input-1', text = 'Hello') => service.sessions.send({ ...snapshot, clientMessageId, text })
  beforeEach(() => {
    directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ziaf-session-')))
    providers = []
    registry = new SessionRegistry()
    config = { taskId: 'task-1', chatId: 'chat-main', presetName: 'Codex', cwd: directory, codexBinPath: '/trusted/codex', sandbox: 'read-only', approvalPolicy: 'on-request', env: { PATH: '/trusted' } }
    service = createService()
  })
  afterEach(async () => { await service.sessions.shutdown(); fs.rmSync(directory, { recursive: true, force: true }) })

  it('persists tool isolation across restart and refuses reuse or reconfiguration into a different policy', async () => {
    config = { ...config, provider: 'claude', presetName: '@custom', toolPolicy: 'none', claudePermissionMode: 'dontAsk' }
    const first = await service.sessions.create(config)
    expect(providers[0].options.toolPolicy).toBe('none')
    await expect(service.sessions.create({ ...config, toolPolicy: undefined })).rejects.toThrow(/configuration/)
    await expect(service.sessions.reconfigure({ ...first, presetName: config.presetName, requestId: 'loosen' }, { ...config, toolPolicy: undefined })).rejects.toThrow(/Tool isolation/)
    await service.sessions.shutdown(); service = createService()
    const restored = (await service.sessions.attach(config))!
    expect(service.sessions.persistedLaunch(restored).toolPolicy).toBe('none')
    const resumed = await service.sessions.resume(restored, { ...config, toolPolicy: undefined })
    expect(providers.at(-1)!.options.toolPolicy).toBe('none')
    expect(service.sessions.persistedLaunch(resumed).toolPolicy).toBe('none')
  }, 20000)

  it('freezes effort and access across restart, changes idle sessions explicitly, and binds queued inputs', async () => {
    config.reasoningEffort = 'high'; config.permissions = 'Read only'
    const first = await service.sessions.create(config)
    expect(first).toMatchObject({ reasoningEffort: 'high', permissions: 'Read only' })
    await send(first); providers[0].complete(); await service.sessions.snapshot(first)
    await service.sessions.setQueuePaused({ ...first, paused: true })
    await service.sessions.queue({ ...first, clientMessageId: 'later', text: 'Keep original configuration' })
    await expect(service.sessions.reconfigure({ ...first, presetName: config.presetName, requestId: 'blocked' }, { ...config, reasoningEffort: 'low' })).rejects.toThrow(/queued/)
    await service.sessions.shutdown(); service = createService()
    const disconnected = (await service.sessions.attach(config))!
    expect(disconnected).toMatchObject({ reasoningEffort: 'high', permissions: 'Read only', queue: { paused: true } })
    const resumed = await service.sessions.resume(disconnected, { ...config, reasoningEffort: 'low', permissions: 'Danger full access' })
    expect(resumed).toMatchObject({ reasoningEffort: 'high', permissions: 'Read only' })
    expect(providers.at(-1)!.options.reasoningEffort).toBe('high')
    await service.sessions.cancelQueued({ ...resumed, clientMessageId: 'later' })
    const changed = await service.sessions.reconfigure({ ...resumed, presetName: config.presetName, requestId: 'default' }, { ...config, reasoningEffort: null })
    expect(changed.reasoningEffort).toBeNull()
    expect(providers.at(-1)!.options).toMatchObject({ reasoningEffort: null, codexResumeThreadId: 'thread-one' })
    expect(changed.feed.map(message => message.text)).toContain('Hello')
  }, 20000)

  it.each(['codex', 'claude', 'api'] as const)('projects legacy %s read-only policy without rewriting metadata or trusting a changed preset', async provider => {
    const legacy = { ...config, provider, presetName: 'Old saved preset', permissions: undefined,
      sandbox: 'read-only' as const, claudePermissionMode: 'plan' as const, apiReadOnly: true,
      ...(provider === 'api' ? { apiConnectionId: 'local', apiConnection: { id: 'local', name: 'Local', baseUrl: 'http://127.0.0.1:9999/v1', model: 'manual', enabled: true, hasApiKey: false } } : {}) }
    const session = await service.sessions.create(legacy)
    await service.sessions.shutdown()
    const file = path.join(path.dirname(service.getJournal(session.taskId, session.runId).filePath), 'session.json')
    const before = fs.readFileSync(file)
    expect(JSON.parse(before.toString()).launch).not.toHaveProperty('permissions')
    service = createService()
    const restored = (await service.sessions.attach(config))!
    expect(restored.permissions).toBe('Read only')
    expect(fs.readFileSync(file)).toEqual(before)
    const frozen = service.sessions.persistedLaunch(restored)
    const next = await service.sessions.reconfigure({ ...restored, presetName: '', requestId: 'model-only' }, { ...legacy, ...frozen, presetName: '', model: 'new-model', permissions: restored.permissions })
    expect(next.permissions).toBe('Read only')
    expect(providers.at(-1)!.options).toMatchObject({ sandbox: 'read-only', claudePermissionMode: 'plan', apiReadOnly: true })
  }, 20000)

  it('distinguishes inherited and explicit default effort when deduplicating a switch request', async () => {
    const first = await service.sessions.create(config)
    const request = { ...first, presetName: config.presetName, requestId: 'same-switch' }
    await service.sessions.reconfigure(request, config)
    await expect(service.sessions.reconfigure(request, { ...config, reasoningEffort: null })).rejects.toThrow(/another selection/)
    expect(providers).toHaveLength(2)
  })

  it('attach never spawns; concurrent create shares one adapter and trusted launch configuration', async () => {
    expect(await service.sessions.attach(config)).toBeNull()
    expect(providers).toHaveLength(0)
    const [a, b] = await Promise.all([service.sessions.create(config), service.sessions.create(config)])
    expect(a).toEqual(b)
    expect(a.sessionStatus).toBe('ready')
    expect(providers).toHaveLength(1)
    expect(providers[0].options).toMatchObject({ worktreePath: directory, agentProvider: 'codex', codexBinPath: config.codexBinPath, env: config.env, sandbox: 'read-only', approvalPolicy: 'on-request' })
    expect(registry.getAgentSession(a.sessionId)?.pid).toBe(1001)
  })

  it('keeps direct CLI chats without a preset after process restart', async () => {
    config.presetName = ''
    const session = await service.sessions.create(config)
    await send(session); providers[0].complete()
    await service.sessions.shutdown()
    service = createService()
    const restored = await service.sessions.attach(config)
    expect(restored).toMatchObject({ sessionId: session.sessionId, presetName: '', sessionStatus: 'disconnected', resumeAvailable: true })
    expect(restored!.feed.map(message => message.text)).toContain('Hello')
  })

  it('blocks Git while starting, delivering or recovering and updates ownership to a replacement provider PID', async () => {
    const startup = deferred<{ pid: number; threadId: string }>()
    service = createService(provider => provider.start.mockImplementationOnce(() => startup.promise))
    const creating = service.sessions.create(config)
    expect(service.sessions.hasActiveTask(config.taskId)).toBe(true)
    await vi.waitFor(() => expect(providers).toHaveLength(1))
    startup.resolve({ pid: 1001, threadId: 'thread-one' })
    const session = await creating
    expect(service.sessions.hasActiveTask(config.taskId)).toBe(false)
    await send(session)
    expect(service.sessions.hasActiveTask(config.taskId)).toBe(true)
    providers[0].emit({ type: 'agent.status.changed', scope: 'session', status: 'starting' })
    providers[0].complete('turn-1', 'stopped')
    await service.sessions.snapshot(session)
    expect(service.sessions.hasActiveTask(config.taskId)).toBe(true)
    vi.spyOn(providers[0], 'getPid').mockReturnValue(1002)
    providers[0].emit({ type: 'agent.status.changed', scope: 'session', status: 'running' })
    const recovered = await service.sessions.snapshot(session)
    expect(recovered.sessionStatus).toBe('ready')
    expect(service.sessions.hasActiveTask(config.taskId)).toBe(false)
    expect(registry.getAgentSession(session.sessionId)?.pid).toBe(1002)
    expect(recovered.runId).toBe(session.runId)
  })

  it('refuses worktree removal for an idle connected session, but permits it after verified termination', async () => {
    const session = await service.sessions.create(config)
    await send(session); providers[0].complete(); await service.sessions.snapshot(session)
    expect(service.sessions.hasActiveTask(config.taskId)).toBe(false)
    expect(() => service.sessions.reserveWorktreeRemoval(config.taskId)).toThrow(/still attached/)
    expect(providers[0].stop).not.toHaveBeenCalled()
    await service.sessions.terminate(session)
    const release = service.sessions.reserveWorktreeRemoval(config.taskId)
    await expect(service.sessions.create({ ...config, chatId: 'new-chat' })).rejects.toThrow(/removal/)
    expect(() => service.sessions.resume(session, config)).toThrow(/removal/)
    await expect(send(session, 'after-removal')).rejects.toThrow(/removal/)
    release(); release()
    const resumed = await service.sessions.resume(session, config)
    expect(resumed.sessionStatus).toBe('ready')
    expect(resumed.feed.map(message => message.text)).toEqual(['Hello'])
    expect(providers).toHaveLength(2)
  })

  it('keeps failed cleanup attached and blocks removal during an awaited handshake or stop', async () => {
    const startup = deferred<{ pid: number; threadId: string }>()
    service = createService(provider => provider.start.mockImplementationOnce(() => startup.promise))
    const creating = service.sessions.create(config)
    expect(() => service.sessions.reserveWorktreeRemoval(config.taskId)).toThrow(/still attached/)
    await vi.waitFor(() => expect(providers).toHaveLength(1))
    startup.resolve({ pid: 1001, threadId: 'thread-one' })
    const session = await creating
    const cleanup = deferred<void>()
    providers[0].stop.mockImplementationOnce(() => cleanup.promise)
    const terminating = service.sessions.terminate(session)
    expect(() => service.sessions.reserveWorktreeRemoval(config.taskId)).toThrow(/still attached/)
    await vi.waitFor(() => expect(providers[0].stop).toHaveBeenCalledTimes(1))
    cleanup.reject(new Error('Owned process did not exit'))
    await expect(terminating).rejects.toThrow(/did not exit/)
    expect(() => service.sessions.reserveWorktreeRemoval(config.taskId)).toThrow(/still attached/)
    await service.sessions.terminate(session)
    service.sessions.reserveWorktreeRemoval(config.taskId)()
  })

  it('allows historical disconnected sessions and fences only the selected task until removal releases', async () => {
    const session = await service.sessions.create(config)
    await send(session); providers[0].complete(); await service.sessions.shutdown()
    service = createService()
    const restored = (await service.sessions.attach(config))!
    expect(restored.sessionStatus).toBe('disconnected')
    const release = service.sessions.reserveWorktreeRemoval(config.taskId)
    expect(() => service.sessions.resume(restored, config)).toThrow(/removal/)
    await expect(service.sessions.create({ ...config, taskId: 'other-task' })).resolves.toMatchObject({ sessionStatus: 'ready' })
    expect(() => service.sessions.reserveWorktreeRemoval(config.taskId)).toThrow(/removal/)
    release()
    await expect(service.sessions.resume(restored, config)).resolves.toMatchObject({ sessionStatus: 'ready' })
  })

  it('deduplicates sends, rejects changed content, and preserves one live session for two turns', async () => {
    const session = await service.sessions.create(config)
    const first = send(session)
    const duplicate = send(session)
    expect(first).toBe(duplicate)
    await expect(send(session, 'input-1', 'Changed')).rejects.toThrow(/different content/)
    const receipt = await first
    const second = send(session, 'input-2', 'Second')
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(providers[0].sendPrompt).toHaveBeenCalledTimes(1)
    providers[0].complete()
    const receipt2 = await second
    expect(receipt2.runId).toBe(receipt.runId)
    expect(receipt2.turnId).toBe('turn-2')
    expect(providers[0].start).toHaveBeenCalledTimes(1)
    expect(providers[0].stop).not.toHaveBeenCalled()
    providers[0].complete()
    const snapshot = await service.sessions.snapshot(session)
    expect(snapshot.sessionStatus).toBe('ready')
    expect(snapshot.activeTurn).toBeUndefined()
    expect(snapshot.lastTurn?.status).toBe('completed')
    expect(snapshot.feed.map(message => message.text)).toEqual(['Hello', 'Second'])
    expect(registry.getAgentSession(session.sessionId)?.pid).toBe(1001)
  })

  it('journals input before synchronous provider output, then replays the identical projection on remount', async () => {
    const session = await service.sessions.create(config)
    providers[0].sendPrompt.mockImplementationOnce(async () => {
      providers[0].emit({ type: 'message.delta', turnId: 'instant', messageId: 'answer', deltaType: 'text', content: 'Immediate answer' })
      providers[0].complete('instant')
      return { turnId: 'instant' }
    })
    await send(session)
    const snapshot = await service.sessions.attach(config)
    expect(snapshot?.feed.map(message => [message.role, message.text])).toEqual([['user', 'Hello'], ['assistant', 'Immediate answer']])
    expect(snapshot?.activeTurn).toBeUndefined()
    expect(snapshot?.lastTurn?.turnId).toBe('instant')
    expect(await service.getJournal(session.taskId, session.runId).reconstructFeed()).toEqual(snapshot?.feed)
    const oldCursor = snapshot!.cursor
    expect((await service.sessions.attach(config))?.cursor).toBe(oldCursor)
    expect(providers[0].sendPrompt).toHaveBeenCalledTimes(1)
  })

  it('does not deliver a queued turn after only the interruption RPC acknowledgment', async () => {
    const session = await service.sessions.create(config)
    await send(session)
    await service.sessions.interrupt({ ...session, turnId: 'turn-1' })
    expect((await service.sessions.snapshot(session)).activeTurn?.status).toBe('interrupting')
    expect(providers[0].stop).not.toHaveBeenCalled()
    const second = send(session, 'input-2')
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(providers[0].sendPrompt).toHaveBeenCalledTimes(1)
    providers[0].complete('turn-1', 'stopped')
    await second
    expect((await service.sessions.snapshot(session)).lastTurn?.status).toBe('interrupted')
    expect(providers[0].sendPrompt).toHaveBeenCalledTimes(2)
    await expect(service.sessions.interrupt({ ...session, turnId: 'turn-1' })).rejects.toThrow(/stale/)
  })

  it('fences stale events/commands by run and turn, while two chats remain independent', async () => {
    const a = await service.sessions.create(config)
    const b = await service.sessions.create({ ...config, chatId: 'chat-2' })
    await Promise.all([send(a), send(b)])
    providers[0].complete()
    await service.sessions.snapshot(a)
    providers[0].emit({ type: 'message.delta', turnId: 'turn-1', messageId: 'stale', deltaType: 'text', content: 'stale completed turn' })
    providers[0].emit({ type: 'message.delta', runId: 'wrong-run', messageId: 'wrong', deltaType: 'text', content: 'wrong run' })
    expect((await service.sessions.snapshot(a)).feed.some(message => message.id === 'stale' || message.id === 'wrong')).toBe(false)
    expect((await service.sessions.snapshot(b)).activeTurn?.turnId).toBe('turn-1')
    expect(() => service.sessions.send({ ...a, runId: 'wrong', clientMessageId: 'bad', text: 'Bad' })).toThrow(/stale/)
  })

  it('keeps an approval on its turn, fences stale resolution, and rolls back a failed write', async () => {
    const session = await service.sessions.create(config)
    await send(session)
    const provider = providers[0]
    provider.emit({ type: 'message.started', messageId: 'assistant', role: 'assistant', turnId: 'turn-1' })
    provider.emit({ type: 'permission.requested', turnId: 'turn-1', approvalId: 'approval-1', command: 'echo ok' })
    provider.emit({ type: 'agent.status.changed', scope: 'turn', turnId: 'turn-1', status: 'waiting_for_approval' })
    const waiting = await service.sessions.snapshot(session)
    expect(waiting.pendingApprovals).toMatchObject([{ approvalId: 'approval-1', turnId: 'turn-1', state: 'pending' }])
    const request = { ...session, turnId: 'turn-1', approvalId: 'approval-1', decision: 'allow' as const }
    await expect(service.sessions.resolveApproval({ ...request, turnId: 'stale' })).rejects.toThrow(/stale/)
    provider.resolveApproval.mockRejectedValueOnce(new Error('stdin failure'))
    await expect(service.sessions.resolveApproval(request)).rejects.toThrow(/stdin failure/)
    expect((await service.sessions.snapshot(session)).pendingApprovals[0].state).toBe('pending')
    await service.sessions.resolveApproval(request)
    expect((await service.sessions.snapshot(session)).pendingApprovals).toEqual([])
    provider.complete()
    await service.sessions.snapshot(session)
    await expect(service.sessions.resolveApproval(request)).rejects.toThrow(/stale/)
  })

  it('does not resurrect a completed turn when its turn/start response arrives late', async () => {
    const session = await service.sessions.create(config)
    const response = deferred<{ turnId: string }>()
    providers[0].sendPrompt.mockImplementationOnce(async () => {
      providers[0].emit({ type: 'agent.status.changed', scope: 'turn', status: 'running', turnId: 'turn-fast' })
      providers[0].complete('turn-fast')
      return response.promise
    })
    const first = send(session)
    await vi.waitFor(async () => expect((await service.sessions.snapshot(session)).lastTurn?.turnId).toBe('turn-fast'))
    const second = send(session, 'input-2')
    expect(providers[0].sendPrompt).toHaveBeenCalledTimes(1)
    response.resolve({ turnId: 'turn-fast' })
    await first
    await second
    expect((await service.sessions.snapshot(session)).activeTurn?.turnId).toBe('turn-1')
  })

  it('surfaces a journal failure and never submits unrecorded user text to the provider', async () => {
    const session = await service.sessions.create(config)
    const journal = service.getJournal(session.taskId, session.runId)
    vi.spyOn(journal, 'append').mockRejectedValueOnce(new Error('disk full'))
    await expect(send(session)).rejects.toThrow(/disk full/)
    const snapshot = await service.sessions.snapshot(session)
    expect(snapshot.sessionStatus).toBe('error')
    expect(snapshot.error).toMatch(/storage failed/)
    expect(providers[0].sendPrompt).not.toHaveBeenCalled()
    expect(providers[0].stop).toHaveBeenCalled()
  })

  it('retains private history after a full backend restart and never silently re-executes it', async () => {
    const session = await service.sessions.create(config)
    await send(session)
    providers[0].emit({ type: 'message.delta', turnId: 'turn-1', messageId: 'unfinished', deltaType: 'text', content: 'Partial' })
    await service.sessions.snapshot(session)
    const restarted = createService()
    const restored = await restarted.sessions.attach(config)
    expect(restored?.sessionStatus).toBe('disconnected')
    expect(restored?.feed.map(message => [message.text, message.status])).toEqual([['Hello', 'completed'], ['Partial', 'error']])
    expect(restored?.activeTurn).toBeUndefined()
    await expect(restarted.sessions.create(config)).rejects.toThrow(/history is preserved/)
    expect(providers).toHaveLength(1)
    await restarted.sessions.shutdown()
    const file = service.getJournal(session.taskId, session.runId).filePath
    expect(fs.statSync(file).mode & 0o777).toBe(0o600)
    expect(fs.statSync(path.dirname(file)).mode & 0o777).toBe(0o700)
    expect(fs.statSync(path.join(path.dirname(file), 'session.json')).mode & 0o777).toBe(0o600)
  })

  it('rejects symlink directories and journal files before reading or writing private conversations', async () => {
    const outside = path.join(directory, 'outside')
    fs.mkdirSync(outside)
    fs.symlinkSync(outside, path.join(directory, 'artifacts'))
    await expect(service.sessions.create(config)).rejects.toThrow(/Unsafe session storage/)
    expect(fs.readdirSync(outside)).toEqual([])
    expect(providers).toHaveLength(0)
    fs.unlinkSync(path.join(directory, 'artifacts'))
    const target = path.join(outside, 'target')
    fs.writeFileSync(target, 'private')
    const file = path.join(directory, 'journal.ndjson')
    fs.symlinkSync(target, file)
    const journal = new EventJournal(file, { privateStorage: true })
    await expect(journal.readEvents()).rejects.toThrow(/Unsafe session storage/)
    await expect(journal.append({ eventId: 'x', taskId: 'a', runId: 'b', timestamp: 1, type: 'message.started', messageId: 'x', role: 'user' })).rejects.toThrow(/Unsafe session storage/)
    expect(fs.readFileSync(target, 'utf8')).toBe('private')
  })

  it('publishes detached snapshots only after writes, with increasing cursors and listener cleanup', async () => {
    const updates: AgentSessionSnapshot[] = []
    const off = service.sessions.onEvent(update => updates.push(update.snapshot))
    const session = await service.sessions.create(config)
    await send(session)
    // Drain the ordered journal before choosing the cursor the coalesced update must reach.
    const drained = await service.sessions.snapshot(session)
    const committedCursor = (await service.getJournal(session.taskId, session.runId).readEvents()).length
    expect(drained.cursor).toBe(committedCursor)
    await vi.waitFor(() => expect(updates.at(-1)?.cursor).toBe(committedCursor))
    for (let index = 1; index < updates.length; index++) expect(updates[index].cursor).toBeGreaterThan(updates[index - 1].cursor)
    const latest = updates.at(-1)!
    expect(latest.feed).toEqual(drained.feed)
    latest.feed[0].text = 'mutated renderer copy'
    expect((await service.sessions.snapshot(session)).feed[0].text).toBe('Hello')
    off()
    const count = updates.length
    const remainingUpdates: AgentSessionSnapshot[] = []
    const stopObserving = service.sessions.onEvent(update => remainingUpdates.push(update.snapshot))
    providers[0].complete()
    const completed = await service.sessions.snapshot(session)
    // Prove a later notification was actually delivered, rather than relying on a sleep.
    await vi.waitFor(() => expect(remainingUpdates.at(-1)?.cursor).toBe(completed.cursor))
    stopObserving()
    expect(updates).toHaveLength(count)
  })
  it('rejects output arriving after session loss without changing the retained feed', async () => {
    const session = await service.sessions.create(config)
    await send(session)
    providers[0].emit({ type: 'agent.status.changed', scope: 'session', status: 'error', error: 'process exited' })
    const closed = await service.sessions.snapshot(session)
    providers[0].emit({ type: 'message.delta', messageId: 'late', deltaType: 'text', content: 'late' })
    providers[0].emit({ type: 'agent.status.changed', scope: 'turn', status: 'running', turnId: 'late-turn' })
    const after = await service.sessions.snapshot(session)
    expect(after.cursor).toBe(closed.cursor)
    expect(after.feed).toEqual(closed.feed)
    expect(after.sessionStatus).toBe('error')
    expect(after.activeTurn).toBeUndefined()
  })

  it('cancels a pending startup on shutdown rather than waiting for the startup timeout', async () => {
    const startup = deferred<{ pid: number; threadId: string }>()
    const pendingService = new RunService({ sessionRegistry: registry, processSupervisor: new ProcessSupervisor(), baseStorageDir: directory, createAdapter: options => {
      const provider = new Provider(options)
      provider.start.mockImplementation(() => startup.promise)
      provider.stop.mockImplementation(async () => { startup.reject(new Error('stopped during startup')) })
      providers.push(provider)
      return provider
    } })
    const creating = pendingService.sessions.create(config)
    const outcome = expect(creating).rejects.toThrow(/stopped during startup/)
    await vi.waitFor(() => expect(providers[0]?.start).toHaveBeenCalledOnce())
    await pendingService.sessions.shutdown()
    await outcome
    expect(providers[0].stop).toHaveBeenCalled()
  })

  it('never sends an approval decision when recording its submission fails', async () => {
    const session = await service.sessions.create(config)
    await send(session)
    providers[0].emit({ type: 'permission.requested', turnId: 'turn-1', approvalId: 'approval', command: 'echo ok' })
    await service.sessions.snapshot(session)
    // Registering the permission also queues its initial state, so drain that before failing submission.
    await service.sessions.snapshot(session)
    vi.spyOn(service.getJournal(session.taskId, session.runId), 'append').mockRejectedValueOnce(new Error('approval disk full'))
    await expect(service.sessions.resolveApproval({ ...session, turnId: 'turn-1', approvalId: 'approval', decision: 'allow' })).rejects.toThrow(/approval disk full/)
    expect(providers[0].resolveApproval).not.toHaveBeenCalled()
    expect((await service.sessions.snapshot(session)).sessionStatus).toBe('error')
  })

  it('rejects a conflicting preset while another create owns startup for the chat', async () => {
    const first = service.sessions.create(config)
    const conflicting = expect(service.sessions.create({ ...config, presetName: 'Different preset' })).rejects.toThrow(/another preset/)
    await first
    await conflicting
    expect(providers).toHaveLength(1)
    expect((await service.sessions.attach(config))?.presetName).toBe(config.presetName)
  })

  it('keeps a rejected input receipt idempotent and permits an explicit retry with a new identity', async () => {
    const session = await service.sessions.create(config)
    providers[0].sendPrompt.mockRejectedValueOnce(new CodexRpcRejectedError('turn/start', 'Temporarily unavailable', -32000))
    const rejected = await send(session)
    expect(rejected).toMatchObject({ outcome: 'rejected', clientMessageId: 'input-1', error: expect.stringContaining('Temporarily unavailable') })
    expect(await send(session)).toEqual(rejected)
    expect(providers[0].sendPrompt).toHaveBeenCalledTimes(1)
    const retry = await send(session, 'input-retry', 'Hello')
    expect(retry.outcome).toBe('accepted')
    expect(providers[0].sendPrompt).toHaveBeenCalledTimes(2)
    const snapshot = await service.sessions.snapshot(session)
    expect(snapshot.feed.map(message => [message.text, message.status])).toEqual([['Hello', 'error'], ['Hello', 'completed']])
    expect(snapshot.sessionStatus).toBe('ready')
  })

  it('never treats timeout or a contradictory RPC error after turn activity as a safe resend', async () => {
    const session = await service.sessions.create(config)
    providers[0].sendPrompt.mockRejectedValueOnce(new Error('RPC turn/start timed out'))
    await expect(send(session)).rejects.toThrow(/timed out/)
    await expect(send(session)).rejects.toThrow(/timed out/)
    expect(providers[0].sendPrompt).toHaveBeenCalledTimes(1)
    const contradiction = new CodexRpcRejectedError('turn/start', 'Error after observed output')
    contradiction.deliveryRejected = false
    providers[0].sendPrompt.mockRejectedValueOnce(contradiction)
    await expect(send(session, 'contradiction')).rejects.toThrow(/observed output/)
    await expect(send(session, 'contradiction')).rejects.toThrow(/observed output/)
    expect(providers[0].sendPrompt).toHaveBeenCalledTimes(2)
  })

  it('isolates invalid configuration only when the complete envelope proves another chat owns it', async () => {
    const session = await service.sessions.create(config)
    await send(session); providers[0].complete()
    const other = await service.sessions.create({ ...config, chatId: 'other-chat' })
    await service.sessions.shutdown()
    const file = path.join(path.dirname(service.getJournal(other.taskId, other.runId).filePath), 'session.json')
    const invalid = { ...JSON.parse(fs.readFileSync(file, 'utf8')), model: { malformed: true } }
    fs.writeFileSync(file, JSON.stringify(invalid))
    service = createService()
    expect((await service.sessions.attach(config))?.feed[0].text).toBe('Hello')
    await expect(service.sessions.attach({ ...config, chatId: 'other-chat' })).rejects.toMatchObject({ code: 'SESSION_RECOVERY_REQUIRED' })
    const fresh = await service.sessions.create({ ...config, chatId: 'fresh-chat' })
    expect(fresh.sessionStatus).toBe('ready')
    expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual(invalid)
  })

  it.each(['torn', 'null', 'array', 'invalid-model', 'wrong-task', 'wrong-run', 'wrong-session', 'numeric-lineage', 'array-lineage', 'numeric-api-id', 'array-api-id'] as const)('blocks %s current metadata and restores its exact backup before native resume without resending', async damage => {
    const first = await service.sessions.create(config)
    await send(first); providers[0].complete()
    await service.sessions.shutdown()
    const file = path.join(path.dirname(service.getJournal(first.taskId, first.runId).filePath), 'session.json')
    const original = fs.readFileSync(file)
    const record = JSON.parse(original.toString('utf8'))
    const bytes = damage === 'torn' ? '{"version":1,' : damage === 'null' ? 'null' : damage === 'array' ? '[]'
      : JSON.stringify({ ...record, ...(damage === 'invalid-model' ? { model: {} } : damage === 'wrong-task' ? { taskId: 'another-task' } : damage === 'wrong-run' ? { runId: 'another-run' } : damage === 'numeric-lineage' ? { previousRunId: 123 } : damage === 'array-lineage' ? { previousRunId: ['valid-id'] } : damage === 'numeric-api-id' ? { apiConnectionId: 123, launch: { ...record.launch, apiConnectionId: 123 } } : damage === 'array-api-id' ? { apiConnectionId: ['valid-id'], launch: { ...record.launch, apiConnectionId: ['valid-id'] } } : { sessionId: 'session-forged' }) })
    fs.writeFileSync(file, bytes)
    service = createService()
    await expect(service.sessions.attach(config)).rejects.toMatchObject({ code: 'SESSION_RECOVERY_REQUIRED', runId: first.runId })
    await expect(service.sessions.create(config)).rejects.toMatchObject({ code: 'SESSION_RECOVERY_REQUIRED' })
    expect(providers).toHaveLength(1)
    expect(fs.readFileSync(file, 'utf8')).toBe(bytes)
    const documents = await service.sessions.listRecovery(config.taskId)
    expect(documents).toHaveLength(1)
    const document = documents[0]
    expect(document.target).toEqual({ domain: 'session', taskId: config.taskId, runId: first.runId })
    expect(document.state).toBe('corrupt')
    expect(document.backups).toHaveLength(1)
    const backup = document.backups[0]
    expect(fs.statSync(path.join(file + '.recovery', backup.id + '.json')).mode & 0o777).toBe(0o600)
    expect(() => service.sessions.restoreRecovery(first.taskId, first.runId, { expectedFingerprint: '0'.repeat(64), backupId: backup.id })).toThrow(/changed/)
    service.sessions.restoreRecovery(first.taskId, first.runId, { expectedFingerprint: document.fingerprint!, backupId: backup.id })
    expect(fs.readFileSync(file)).toEqual(original)
    expect(fs.readFileSync(path.join(file + '.recovery', document.fingerprint + '.damaged'), 'utf8')).toBe(bytes)
    expect(await service.sessions.listRecovery(config.taskId)).toEqual([])
    const restored = (await service.sessions.attach(config))!
    expect(restored).toMatchObject({ sessionId: first.sessionId, runId: first.runId, sessionStatus: 'disconnected', resumeAvailable: true })
    expect(restored.feed.map(message => message.text)).toEqual(['Hello'])
    expect(providers).toHaveLength(1)
    const resumed = await service.sessions.resume(restored, config)
    expect(providers[1].options.codexResumeThreadId).toBe('thread-one')
    expect(providers[1].sendPrompt).not.toHaveBeenCalled()
    expect(resumed.feed.map(message => message.text)).toEqual(['Hello'])
  }, 15000)

  it('never falls back to an older matching run after the newest metadata is torn', async () => {
    const first = await service.sessions.create(config)
    await send(first); providers[0].complete()
    await service.sessions.shutdown()
    service = createService()
    const resumed = await service.sessions.resume((await service.sessions.attach(config))!, config)
    await send(resumed, 'second', 'Second'); providers[1].complete()
    await service.sessions.shutdown()
    const file = path.join(path.dirname(service.getJournal(resumed.taskId, resumed.runId).filePath), 'session.json')
    fs.writeFileSync(file, '{newest torn')
    service = createService()
    await expect(service.sessions.attach(config)).rejects.toMatchObject({ code: 'SESSION_RECOVERY_REQUIRED', runId: resumed.runId })
    await expect(service.sessions.create(config)).rejects.toMatchObject({ code: 'SESSION_RECOVERY_REQUIRED' })
    expect(providers).toHaveLength(2)
    const inspection = service.sessions.inspectRecovery(resumed.taskId, resumed.runId)
    service.sessions.restoreRecovery(resumed.taskId, resumed.runId, { expectedFingerprint: inspection.fingerprint!, backupId: inspection.backups[0].id })
    const restored = (await service.sessions.attach(config))!
    expect(restored.runId).toBe(resumed.runId)
    expect(restored.feed.map(message => message.text)).toEqual(['Hello', 'Second'])
    expect(providers).toHaveLength(2)
  }, 15000)

  it('fails closed for unknown torn extra ownership, rather than hiding it from healthy or new chats', async () => {
    const session = await service.sessions.create(config)
    await service.sessions.shutdown()
    const runs = path.dirname(path.dirname(service.getJournal(session.taskId, session.runId).filePath))
    const directory = path.join(runs, 'run-unknown'); fs.mkdirSync(directory)
    const file = path.join(directory, 'session.json'); fs.writeFileSync(file, '{unknown ownership')
    service = createService()
    await expect(service.sessions.attach(config)).rejects.toMatchObject({ code: 'SESSION_RECOVERY_REQUIRED', runId: 'run-unknown' })
    await expect(service.sessions.create({ ...config, chatId: 'fresh-chat' })).rejects.toMatchObject({ code: 'SESSION_RECOVERY_REQUIRED' })
    expect(fs.readFileSync(file, 'utf8')).toBe('{unknown ownership')
    expect(providers).toHaveLength(1)
  })

  it('retains missing metadata as a visible manual recovery case when a journal remains', async () => {
    const session = await service.sessions.create(config)
    await send(session); providers[0].complete(); await service.sessions.shutdown()
    const file = path.join(path.dirname(service.getJournal(session.taskId, session.runId).filePath), 'session.json')
    fs.unlinkSync(file)
    service = createService()
    await expect(service.sessions.attach(config)).rejects.toMatchObject({ code: 'SESSION_RECOVERY_REQUIRED' })
    await expect(service.sessions.create(config)).rejects.toMatchObject({ code: 'SESSION_RECOVERY_REQUIRED' })
    expect((await service.sessions.listRecovery(config.taskId))[0]).toMatchObject({ state: 'corrupt', fingerprint: null, error: expect.stringContaining('missing') })
    expect(fs.existsSync(file)).toBe(false)
    expect(providers).toHaveLength(1)
  })

  it('ignores only genuinely empty or failed-publication temporary directories', async () => {
    const session = await service.sessions.create(config)
    await service.sessions.shutdown()
    const runs = path.dirname(path.dirname(service.getJournal(session.taskId, session.runId).filePath))
    const temporary = path.join(runs, 'run-failed-before-publish'); fs.mkdirSync(temporary)
    fs.writeFileSync(path.join(temporary, 'session.json.failed.tmp'), '{partial temp')
    service = createService()
    expect((await service.sessions.attach(config))!.sessionId).toBe(session.sessionId)
    expect(await service.sessions.listRecovery(config.taskId)).toEqual([])
    expect((await service.sessions.create({ ...config, chatId: 'fresh-chat' })).sessionStatus).toBe('ready')
    expect(fs.readFileSync(path.join(temporary, 'session.json.failed.tmp'), 'utf8')).toBe('{partial temp')
  })

  it('allows inspection but requires a fresh uncached manager before restoring session metadata', async () => {
    const session = await service.sessions.create(config)
    const request = { expectedFingerprint: '0'.repeat(64), backupId: '1'.repeat(64) }
    expect(service.sessions.inspectRecovery(session.taskId, session.runId).state).toBe('valid')
    expect(() => service.sessions.restoreRecovery(session.taskId, session.runId, request)).toThrow(/Restart the application/)
    await service.sessions.shutdown()
    service = createService()
    await service.sessions.attach(config)
    expect(() => service.sessions.restoreRecovery(session.taskId, session.runId, request)).toThrow(/Restart the application/)
    expect(() => service.sessions.inspectRecovery('../escape', session.runId)).toThrow(/identity/)
    expect(() => service.sessions.inspectRecovery(session.taskId, '../escape')).toThrow()
    expect(() => service.sessions.inspectRecovery(session.taskId, 'unknown-run')).toThrow(/does not exist/)
  })

  it('publishes complete metadata atomically and never overwrites an existing record', async () => {
    const file = path.join(directory, 'atomic', 'session.json')
    const link = fs.promises.link.bind(fs.promises)
    const publish = vi.spyOn(fs.promises, 'link').mockImplementationOnce(async (temporary, target) => {
      expect(fs.existsSync(file)).toBe(false)
      expect(JSON.parse(fs.readFileSync(temporary, 'utf8'))).toEqual({ version: 1, taskId: 'original' })
      return link(temporary, target)
    })
    try {
      await writePrivateMetadata(file, { version: 1, taskId: 'original' })
      await expect(writePrivateMetadata(file, { version: 1, taskId: 'replacement' })).rejects.toMatchObject({ code: 'EEXIST' })
      expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual({ version: 1, taskId: 'original' })
      expect(fs.readdirSync(path.dirname(file))).toEqual(['session.json'])
      expect(fs.statSync(file).mode & 0o777).toBe(0o600)
    } finally { publish.mockRestore() }
  })

  it('leaves no final metadata when writing a temporary record fails midway', async () => {
    const file = path.join(directory, 'atomic-failed', 'session.json')
    const open = fs.promises.open.bind(fs.promises)
    const opening = vi.spyOn(fs.promises, 'open').mockImplementationOnce(async (target, flags, mode) => {
      const handle = await open(target, flags, mode)
      const write = handle.writeFile.bind(handle)
      vi.spyOn(handle, 'writeFile').mockImplementationOnce(async () => { await write('{"partial":', 'utf8'); throw new Error('disk full during metadata write') })
      return handle
    })
    try {
      await expect(writePrivateMetadata(file, { version: 1 })).rejects.toThrow(/disk full/)
      expect(fs.existsSync(file)).toBe(false)
      expect(fs.readdirSync(path.dirname(file))).toEqual([])
    } finally { opening.mockRestore() }
  })

  it.each(['claude', 'antigravity'] as const)('persists provider %s and forwards only the trusted configuration through the shared coordinator', async provider => {
    const selected = { ...config, provider, claudeBinPath: '/trusted/claude', claudePermissionMode: 'plan' as const, agyBinPath: '/trusted/agy', agyPermissionMode: 'cli-settings' as const, agyConversationId: 'conversation-1' }
    const session = await service.sessions.create(selected)
    expect(session.provider).toBe(provider)
    expect(providers[0].options).toMatchObject({ agentProvider: provider, claudeBinPath: selected.claudeBinPath, claudePermissionMode: 'plan', agyBinPath: selected.agyBinPath, agyPermissionMode: 'cli-settings', agyConversationId: 'conversation-1', env: config.env })
    await send(session)
    providers[0].complete()
    await service.sessions.shutdown()
    const restarted = createService()
    expect((await restarted.sessions.attach(selected))?.provider).toBe(provider)
    expect((await restarted.sessions.attach(selected))?.sessionStatus).toBe('disconnected')
    await restarted.sessions.shutdown()
  })

  it('rejects concurrent creation that would silently bind another provider to the same chat', async () => {
    const original = service.sessions.create({ ...config, provider: 'claude' })
    const conflict = service.sessions.create({ ...config, provider: 'antigravity' })
    await original
    await expect(conflict).rejects.toThrow(/another preset/)
    expect(providers).toHaveLength(1)
  })

  it('ends only the owned session, rejects queued/new sends, and retains the journal for attach', async () => {
    const session = await service.sessions.create(config)
    const other = await service.sessions.create({ ...config, chatId: 'other' })
    await send(session)
    const queued = send(session, 'queued')
    const queuedResult = expect(queued).rejects.toThrow(/ended/)
    const gate = deferred<void>()
    providers[0].stop.mockImplementationOnce(() => gate.promise)
    const ended = service.sessions.terminate(session)
    expect(service.sessions.terminate(session)).toBe(ended)
    await expect(send(session, 'late')).rejects.toThrow(/not ready/)
    await queuedResult
    gate.resolve()
    await ended
    expect(providers[0].stop).toHaveBeenCalledTimes(1)
    expect(providers[0].stop).toHaveBeenCalledWith(false)
    expect(providers[1].stop).not.toHaveBeenCalled()
    expect((await service.sessions.snapshot(other)).sessionStatus).toBe('ready')
    const history = await service.sessions.attach(config)
    expect(history?.sessionStatus).toBe('stopped')
    expect(history?.feed[0].text).toBe('Hello')
    expect(history?.activeTurn).toBeUndefined()
    expect(registry.getAgentSession(session.sessionId)?.pid).toBeUndefined()
    expect(() => service.sessions.terminate({ ...session, runId: 'stale' })).toThrow(/stale/)
    await expect(service.sessions.create(config)).rejects.toThrow(/new chat/)
  })

  it('does not report a failed termination as stopped, preserving PID ownership for retry', async () => {
    const session = await service.sessions.create(config)
    providers[0].stop.mockRejectedValueOnce(new Error('Descendants survived'))
    await expect(service.sessions.terminate(session)).rejects.toThrow('Descendants survived')
    expect((await service.sessions.snapshot(session)).sessionStatus).toBe('error')
    expect(registry.getAgentSession(session.sessionId)?.pid).toBe(1001)
    await service.sessions.terminate(session)
    expect((await service.sessions.snapshot(session)).sessionStatus).toBe('stopped')
    expect(registry.getAgentSession(session.sessionId)?.pid).toBeUndefined()
  })

  it('derives truthful capabilities from the actual adapter, including an absent interruption method', async () => {
    await service.sessions.shutdown()
    service = new RunService({ sessionRegistry: registry, processSupervisor: new ProcessSupervisor(), baseStorageDir: directory, createAdapter: options => {
      const provider = new Provider(options)
      Object.defineProperty(provider, 'interruptTurn', { value: undefined })
      provider.getCapabilities = () => ({ textStreaming: true, toolCalls: true, thinkingStreaming: false, toolOutputStreaming: false, interactiveApprovals: false, attachments: false })
      providers.push(provider)
      return provider
    } })
    const session = await service.sessions.create({ ...config, provider: 'antigravity' })
    expect(session.capabilities).toEqual({ attachments: false, interactiveApprovals: false, interruptTurn: false })
    await send(session)
    await expect(service.sessions.interrupt({ ...session, turnId: 'turn-1' })).rejects.toThrow(/unavailable/)
    await service.sessions.terminate(session)
    expect((await service.sessions.snapshot(session)).sessionStatus).toBe('stopped')
  })

  it('a late handshake cannot resurrect a session explicitly ended during creation', async () => {
    await service.sessions.shutdown()
    const gate = deferred<{ pid: number }>()
    const spawned = deferred<Provider>()
    service = new RunService({ sessionRegistry: registry, processSupervisor: new ProcessSupervisor(), baseStorageDir: directory, createAdapter: options => {
      const provider = new Provider(options)
      provider.start.mockImplementation(() => gate.promise as Promise<{ pid: number; threadId: string }>)
      providers.push(provider)
      spawned.resolve(provider)
      return provider
    } })
    const creation = service.sessions.create(config)
    const provider = await spawned.promise
    // Registry receives the real entry identity before the handshake settles.
    const key = `session-${(await import('node:crypto')).createHash('sha256').update(JSON.stringify([config.taskId, config.chatId])).digest('hex').slice(0, 40)}`
    const ref = registry.getAgentSession(key)!.snapshot
    await service.sessions.terminate(ref)
    gate.resolve({ pid: 1001 })
    await expect(creation).rejects.toThrow(/cancelled or failed/)
    expect(provider.sendPrompt).not.toHaveBeenCalled()
    expect((await service.sessions.snapshot(ref)).sessionStatus).not.toBe('ready')
  })

  it('holds project removal locks through caller cleanup, ending all owned chats but preserving other projects', async () => {
    const first = await service.sessions.create(config)
    await service.sessions.create({ ...config, chatId: 'chat-two' })
    const other = await service.sessions.create({ ...config, taskId: 'other-task' })
    await send(first)
    const queued = send(first, 'queued')
    const queuedResult = expect(queued).rejects.toThrow(/ended/)
    const removal = service.sessions.beginTaskRemoval([config.taskId])
    await expect(service.sessions.create({ ...config, chatId: 'new-chat' })).rejects.toThrow(/removal/)
    await expect(service.sessions.attach(config)).rejects.toThrow(/removal/)
    await expect(send(first, 'late')).rejects.toThrow(/removal/)
    await removal.terminated
    await queuedResult
    expect((await service.sessions.snapshot(first)).sessionStatus).toBe('stopped')
    expect((await service.sessions.snapshot(other)).sessionStatus).toBe('ready')
    expect(providers[0].stop).toHaveBeenCalledTimes(1)
    expect(providers[0].stop).toHaveBeenCalledWith(false)
    expect(providers[1].stop).toHaveBeenCalledTimes(1)
    expect(providers[2].stop).not.toHaveBeenCalled()
    await expect(service.sessions.attach(config)).rejects.toThrow(/removal/)
    removal.release(); removal.release()
    expect((await service.sessions.attach(config))?.feed[0].text).toBe('Hello')
    expect((await service.sessions.create({ ...config, chatId: 'after-failed-deletion' })).sessionStatus).toBe('ready')
  })

  it('blocks an already-requested create before its pending disk lookup can spawn a process', async () => {
    const gate = deferred<Awaited<ReturnType<typeof fs.promises.readdir>>>()
    const read = vi.spyOn(fs.promises, 'readdir').mockImplementationOnce(() => gate.promise as ReturnType<typeof fs.promises.readdir>)
    const creation = service.sessions.create(config)
    const creationResult = expect(creation).rejects.toThrow(/removal/)
    const removal = service.sessions.beginTaskRemoval([config.taskId])
    let settled = false
    void removal.terminated.then(() => { settled = true })
    await new Promise(resolve => setImmediate(resolve))
    expect(settled).toBe(false)
    gate.resolve([])
    await creationResult
    await removal.terminated
    expect(providers).toHaveLength(0)
    removal.release()
    read.mockRestore()
    expect((await service.sessions.create(config)).sessionStatus).toBe('ready')
  })

  it('keeps overlapping removal leases independent and releases locks after standalone teardown failure', async () => {
    const session = await service.sessions.create(config)
    const first = service.sessions.beginTaskRemoval([config.taskId])
    const second = service.sessions.beginTaskRemoval([config.taskId])
    await Promise.all([first.terminated, second.terminated])
    first.release()
    await expect(service.sessions.attach(config)).rejects.toThrow(/removal/)
    second.release()
    expect((await service.sessions.snapshot(session)).sessionStatus).toBe('stopped')
    const next = await service.sessions.create({ ...config, chatId: 'next' })
    providers[1].stop.mockRejectedValueOnce(new Error('Child remains alive'))
    await expect(service.sessions.terminateTasks([config.taskId])).rejects.toThrow('Child remains alive')
    expect((await service.sessions.attach({ taskId: config.taskId, chatId: 'next' }))?.runId).toBe(next.runId)
    await service.sessions.terminateTasks([config.taskId])
    expect(() => service.sessions.beginTaskRemoval([config.taskId, '../bad'])).toThrow(/Invalid/)
    expect((await service.sessions.create({ ...config, chatId: 'unlocked' })).sessionStatus).toBe('ready')
  })


  it('resumes a persisted native conversation after full shutdown, retaining frozen policy and history', async () => {
    const first = await service.sessions.create({ ...config, model: 'original-model' })
    await send(first)
    providers[0].complete()
    await service.sessions.snapshot(first)
    await service.sessions.shutdown()
    service = createService()
    const disconnected = (await service.sessions.attach(config))!
    expect(disconnected.sessionStatus).toBe('disconnected')
    expect(disconnected.resumeAvailable).toBe(true)
    const resumed = await service.sessions.resume(disconnected, { ...config, model: 'edited-preset-model', sandbox: 'danger-full-access', approvalPolicy: 'never' })
    expect(resumed).toMatchObject({ sessionId: first.sessionId, model: 'original-model', sessionStatus: 'ready' })
    expect(resumed.runId).not.toBe(first.runId)
    expect(providers[1].options).toMatchObject({ codexResumeThreadId: 'thread-one', model: 'original-model', sandbox: 'read-only', approvalPolicy: 'on-request' })
    expect(resumed.feed.map(message => message.text)).toEqual(['Hello'])
    expect(providers[1].sendPrompt).not.toHaveBeenCalled()
    await send(resumed, 'second', 'Continue')
    providers[1].complete()
    const beforeQuit = await service.sessions.snapshot(resumed)
    await service.sessions.shutdown()
    service = createService()
    const replayed = (await service.sessions.attach(config))!
    expect(replayed.feed).toEqual(beforeQuit.feed)
    expect(() => service.sessions.send({ ...first, clientMessageId: 'stale', text: 'Never' })).toThrow(/stale/)
  })

  it('switches an idle model in the same native thread, deduplicates switch requests and fences the former adapter', async () => {
    const first = await service.sessions.create(config)
    await send(first)
    providers[0].complete()
    await service.sessions.snapshot(first)
    const request = { sessionId: first.sessionId, runId: first.runId, presetName: 'Alternative', requestId: 'switch-one' }
    const nextConfig = { ...config, presetName: 'Alternative', model: 'new-model' }
    const changing = service.sessions.reconfigure(request, nextConfig)
    expect(service.sessions.reconfigure(request, nextConfig)).toBe(changing)
    await expect(send(first, 'during-switch')).rejects.toThrow(/not ready/)
    const next = await changing
    expect(await service.sessions.reconfigure(request, nextConfig)).toEqual(next)
    expect(providers[1].options).toMatchObject({ codexResumeThreadId: 'thread-one', model: 'new-model' })
    const oldCursor = next.cursor
    providers[0].emit({ type: 'message.delta', messageId: 'late', deltaType: 'text', content: 'STALE OUTPUT' })
    const latest = await service.sessions.snapshot(next)
    expect(latest.cursor).toBe(oldCursor)
    expect(latest.feed.map(message => message.text)).toEqual(['Hello'])
    await expect(service.sessions.reconfigure(request, { ...nextConfig, model: 'other' })).rejects.toThrow(/another selection/)
  })

  it('refuses switches during generation, approvals and queued sends without stopping the provider', async () => {
    const first = await service.sessions.create(config)
    await send(first)
    providers[0].emit({ type: 'permission.requested', approvalId: 'busy-approval', turnId: 'turn-1' })
    await service.sessions.snapshot(first)
    const second = send(first, 'second')
    await expect(service.sessions.reconfigure({ ...first, presetName: 'Claude' }, { ...config, presetName: 'Claude', provider: 'claude' })).rejects.toThrow(/active turn/)
    expect(providers[0].stop).not.toHaveBeenCalled()
    providers[0].complete()
    await second
    providers[0].complete()
  })

  it('explicit cross-provider switch preserves full visible history and sends bounded historical context once', async () => {
    const first = await service.sessions.create(config)
    await send(first)
    providers[0].complete()
    await service.sessions.snapshot(first)
    const switched = await service.sessions.reconfigure({ ...first, presetName: 'Claude' }, { ...config, presetName: 'Claude', provider: 'claude', model: 'sonnet' })
    expect(switched).toMatchObject({ provider: 'claude', model: 'sonnet', sessionId: first.sessionId })
    expect(providers[1].options.claudeSessionId).toMatch(/^[a-f0-9-]{36}$/)
    expect(providers[1].options.codexResumeThreadId).toBeUndefined()
    expect(switched.diagnostics?.some(row => row.message.includes('excerpts'))).toBe(true)
    await send(switched, 'next', 'New question')
    expect(providers[1].sendPrompt.mock.calls[0][0].text).toContain('untrusted historical content')
    expect(providers[1].sendPrompt.mock.calls[0][0].text).toContain('Hello')
    expect(providers[1].sendPrompt.mock.calls[0][0].text).toContain('New question')
    providers[1].complete()
    await service.sessions.snapshot(switched)
    await send(switched, 'third', 'Follow up')
    expect(providers[1].sendPrompt.mock.calls[1][0].text).toBe('Follow up')
    expect((await service.sessions.snapshot(switched)).feed.map(message => message.text)).toEqual(['Hello', 'New question', 'Follow up'])
  })

  it('a failed reconfiguration retains old history and can explicitly resume the attempted native conversation', async () => {
    await service.sessions.shutdown()
    let count = 0
    service = createService(provider => { if (++count === 2) provider.start.mockRejectedValueOnce(new Error('temporary launch failure')) })
    const first = await service.sessions.create(config)
    await send(first)
    providers[0].complete()
    await service.sessions.snapshot(first)
    await expect(service.sessions.reconfigure({ ...first, presetName: 'New' }, { ...config, presetName: 'New' })).rejects.toThrow('temporary launch failure')
    const failed = (await service.sessions.attach(config))!
    expect(failed.feed.map(message => message.text)).toEqual(['Hello'])
    expect(failed.sessionStatus).toBe('error')
    const retried = await service.sessions.resume(failed, config)
    expect(retried.sessionStatus).toBe('ready')
    expect(retried.presetName).toBe('New')
    expect(providers[2].options.codexResumeThreadId).toBe('thread-one')
    expect(retried.feed.map(message => message.text)).toEqual(['Hello'])
  })

  it('keeps actual CLI diagnostics bounded and sanitized outside the conversation journal', async () => {
    const session = await service.sessions.create(config)
    const journalCursor = session.cursor
    for (let index = 0; index < 300; index++) providers[0].options.onRawLog?.('stdout', `actual protocol output ${index}`)
    providers[0].options.onRawLog?.('stderr', 'Authorization: Bearer private-credential')
    providers[0].options.onRawLog?.('stderr', 'api_key="super-secret-value"')
    const latest = await service.sessions.snapshot(session)
    expect(latest.diagnostics).toHaveLength(200)
    expect(latest.diagnostics?.at(-3)?.message).toBe('actual protocol output 299')
    expect(JSON.stringify(latest.diagnostics)).not.toContain('private-credential')
    expect(JSON.stringify(latest.diagnostics)).not.toContain('super-secret-value')
    expect(latest.diagnosticsRevision).toBe(302)
    expect(latest.cursor).toBe(journalCursor)
    expect(JSON.stringify(await service.getJournal(session.taskId, session.runId).readEvents())).not.toContain('actual protocol output')
    providers[0].options.onRawLog?.('stderr', '-----BEGIN PRIVATE KEY-----')
    providers[0].options.onRawLog?.('stderr', 'private-base64-body')
    providers[0].options.onRawLog?.('stderr', '-----END PRIVATE KEY-----')
    expect(JSON.stringify((await service.sessions.snapshot(session)).diagnostics)).not.toContain('private-base64-body')
    for (let index = 0; index < 100; index++) providers[0].options.onRawLog?.('stdout', 'x'.repeat(10000))
    const bounded = (await service.sessions.snapshot(session)).diagnostics!
    expect(bounded.every(line => Buffer.byteLength(line.message) <= 2048)).toBe(true)
    expect(bounded.reduce((sum, line) => sum + Buffer.byteLength(line.message), 0)).toBeLessThanOrEqual(128 * 1024)
  })


  it('restarts a never-sent empty native conversation without trying a nonexistent provider rollout', async () => {
    const first = await service.sessions.create(config)
    await service.sessions.shutdown()
    service = createService()
    const disconnected = (await service.sessions.attach(config))!
    const resumed = await service.sessions.resume(disconnected, config)
    expect(resumed.sessionId).toBe(first.sessionId)
    expect(resumed.feed).toEqual([])
    expect(providers[1].options.codexResumeThreadId).toBeUndefined()
    expect(providers[1].sendPrompt).not.toHaveBeenCalled()
  })

  it('continues native history across a second restart even when no new input was sent after the first resume', async () => {
    const first = await service.sessions.create(config)
    await send(first)
    providers[0].complete()
    await service.sessions.snapshot(first)
    await service.sessions.shutdown()
    service = createService()
    const resumed = await service.sessions.resume((await service.sessions.attach(config))!, config)
    await service.sessions.shutdown()
    service = createService()
    const twice = await service.sessions.resume((await service.sessions.attach(config))!, config)
    expect(providers[2].options.codexResumeThreadId).toBe('thread-one')
    expect(twice.feed.map(message => message.text)).toEqual(['Hello'])
    expect(twice.runId).not.toBe(resumed.runId)
  })

  it('retains readable history if native reference metadata is malformed, without resuming an unrelated conversation', async () => {
    const first = await service.sessions.create(config)
    await send(first)
    providers[0].complete()
    await service.sessions.snapshot(first)
    await service.sessions.shutdown()
    fs.writeFileSync(path.join(path.dirname(service.getJournal(first.taskId, first.runId).filePath), 'provider.json'), 'null')
    service = createService()
    const disconnected = (await service.sessions.attach(config))!
    expect(disconnected.feed.map(message => message.text)).toEqual(['Hello'])
    expect(disconnected.resumeAvailable).not.toBe(true)
    await expect(service.sessions.resume(disconnected, config)).rejects.toThrow(/no saved provider reference/)
    expect(providers).toHaveLength(1)
  })


  it('termination during native-reference persistence cannot publish a late ready state or PID', async () => {
    const persisted = deferred<void>()
    const release = deferred<void>()
    const original = privateStorage.writePrivateMetadata
    const writer = vi.spyOn(privateStorage, 'writePrivateMetadata').mockImplementation(async (file, data) => {
      await original(file, data)
      if (file.endsWith('provider.json')) { persisted.resolve(); await release.promise }
    })
    try {
      const creation = service.sessions.create(config)
      const rejected = expect(creation).rejects.toThrow(/cancelled or failed/)
      await persisted.promise
      const key = `session-${(await import('node:crypto')).createHash('sha256').update(JSON.stringify([config.taskId, config.chatId])).digest('hex').slice(0, 40)}`
      const ref = registry.getAgentSession(key)!.snapshot
      await service.sessions.terminate(ref)
      release.resolve()
      await rejected
      expect((await service.sessions.snapshot(ref)).sessionStatus).not.toBe('ready')
      expect(registry.getAgentSession(key)?.pid).toBeUndefined()
      expect(providers[0].sendPrompt).not.toHaveBeenCalled()
    } finally { release.resolve(); writer.mockRestore() }
  })

  it('a failed old-process teardown blocks sends until an explicit recovery successfully owns a replacement', async () => {
    const first = await service.sessions.create(config)
    providers[0].stop.mockRejectedValueOnce(new Error('Owned descendants remain'))
    await expect(service.sessions.reconfigure({ ...first, presetName: 'Other' }, { ...config, presetName: 'Other' })).rejects.toThrow('Owned descendants remain')
    expect((await service.sessions.snapshot(first)).sessionStatus).toBe('error')
    await expect(send(first)).rejects.toThrow(/not ready/)
    const recovered = await service.sessions.resume(first, config)
    expect(recovered.sessionStatus).toBe('ready')
    expect(recovered.runId).not.toBe(first.runId)
    expect(providers[0].stop).toHaveBeenCalledTimes(2)
  })

  it('durably acknowledges two queued messages during generation and sends FIFO only after each completed turn', async () => {
    const session = await service.sessions.create(config)
    await send(session, 'active', 'First')
    const a = await service.sessions.queue({ ...session, clientMessageId: 'queued-a', text: 'Second' })
    const b = await service.sessions.queue({ ...session, clientMessageId: 'queued-b', text: 'Third' })
    expect(a.queue?.items[0].status).toBe('queued')
    expect(b.queue?.items.map(item => item.text)).toEqual(['Second', 'Third'])
    const document = JSON.parse(fs.readFileSync(path.join(directory, config.taskId, 'queues', `${session.sessionId}.json`), 'utf8'))
    expect(document.items.map((item: { text: string }) => item.text)).toEqual(['Second', 'Third'])
    expect(providers[0].sendPrompt).toHaveBeenCalledTimes(1)
    await expect(send(session, 'bypass')).rejects.toThrow(/queue/)
    providers[0].complete('turn-1')
    await vi.waitFor(() => expect(providers[0].sendPrompt).toHaveBeenCalledTimes(2))
    await service.sessions.snapshot(session)
    providers[0].complete('turn-2')
    await vi.waitFor(() => expect(providers[0].sendPrompt).toHaveBeenCalledTimes(3))
    await vi.waitFor(async () => expect((await service.sessions.snapshot(session)).queue?.items).toEqual([]))
    expect(providers[0].sendPrompt.mock.calls.map(([input]) => input.text)).toEqual(['First', 'Second', 'Third'])
    expect((await service.sessions.queue({ ...session, clientMessageId: 'queued-a', text: 'Second' })).queue?.items).toEqual([])
    expect(providers[0].sendPrompt).toHaveBeenCalledTimes(3)
  })

  it('persists queue on Quit, resumes the same provider paused, and rejects stale commands and preset changes', async () => {
    const session = await service.sessions.create(config)
    await send(session, 'active', 'First')
    await service.sessions.queue({ ...session, clientMessageId: 'after-restart', text: 'Second' })
    await expect(service.sessions.reconfigure({ ...session, presetName: 'Other' }, { ...config, presetName: 'Other' })).rejects.toThrow(/queued/)
    await service.sessions.shutdown()
    service = createService()
    const loaded = (await service.sessions.attach(config))!
    expect(loaded.queue).toMatchObject({ paused: true, items: [{ clientMessageId: 'after-restart', status: 'queued' }] })
    await expect(service.sessions.setQueuePaused({ ...loaded, paused: false })).rejects.toThrow(/Resume/)
    const resumed = await service.sessions.resume(loaded, config)
    expect(resumed.runId).not.toBe(session.runId)
    expect(resumed.queue?.paused).toBe(true)
    expect(providers[1].options.codexResumeThreadId).toBe('thread-one')
    expect(providers[1].sendPrompt).not.toHaveBeenCalled()
    await expect(service.sessions.cancelQueued({ ...session, clientMessageId: 'after-restart' })).rejects.toThrow(/stale/)
    await service.sessions.setQueuePaused({ ...resumed, paused: false })
    await vi.waitFor(() => expect(providers[1].sendPrompt).toHaveBeenCalledTimes(1))
    expect(providers[1].sendPrompt.mock.calls[0][0].text).toBe('Second')
  })

  it('Stop pauses queued work before interrupt and completion never starts the next item without Continue', async () => {
    const session = await service.sessions.create(config)
    await send(session)
    await service.sessions.queue({ ...session, clientMessageId: 'queued', text: 'After stop' })
    await service.sessions.interrupt({ ...session, turnId: 'turn-1' })
    expect((await service.sessions.snapshot(session)).queue?.paused).toBe(true)
    providers[0].complete('turn-1', 'stopped')
    await service.sessions.snapshot(session)
    await new Promise(resolve => setTimeout(resolve, 30))
    expect(providers[0].sendPrompt).toHaveBeenCalledTimes(1)
    await service.sessions.setQueuePaused({ ...session, paused: false })
    await vi.waitFor(() => expect(providers[0].sendPrompt).toHaveBeenCalledTimes(2))
  })

  // Multiple real fsync-backed queue updates plus shutdown/reload/resume need a
  // bounded durability-test budget when the full suite shares disk with four workers.
  it('transport uncertainty cannot replay or advance later queued inputs even after a native resume', { timeout: 20_000 }, async () => {
    const session = await service.sessions.create(config)
    await service.sessions.setQueuePaused({ ...session, paused: true })
    await service.sessions.queue({ ...session, clientMessageId: 'unknown', text: 'Maybe accepted' })
    await service.sessions.queue({ ...session, clientMessageId: 'next', text: 'Later' })
    providers[0].sendPrompt.mockRejectedValueOnce(new Error('transport closed before acknowledgment'))
    await service.sessions.setQueuePaused({ ...session, paused: false })
    await vi.waitFor(async () => expect((await service.sessions.snapshot(session)).queue?.items[0].status).toBe('uncertain'))
    await expect(service.sessions.setQueuePaused({ ...session, paused: false })).rejects.toThrow(/uncertain/)
    expect(providers[0].sendPrompt).toHaveBeenCalledTimes(1)
    await service.sessions.shutdown()
    service = createService()
    const restored = (await service.sessions.attach(config))!
    const resumed = await service.sessions.resume(restored, config)
    expect(resumed.queue?.items.map(item => item.status)).toEqual(['uncertain', 'queued'])
    expect(providers[1].sendPrompt).not.toHaveBeenCalled()
    await service.sessions.cancelQueued({ ...resumed, clientMessageId: 'unknown' })
    await service.sessions.setQueuePaused({ ...resumed, paused: false })
    await vi.waitFor(() => expect(providers[1].sendPrompt).toHaveBeenCalledTimes(1))
    expect(providers[1].sendPrompt.mock.calls[0][0].text).toBe('Later')
  })

  // Two fsync-backed chats plus cancellation, shutdown and native resume share
  // the full-suite disk budget; retain the same delivery/isolation assertions.
  it('queue cancellation is idempotent across process restart and never changes another chat', { timeout: 20_000 }, async () => {
    const a = await service.sessions.create(config)
    const b = await service.sessions.create({ ...config, chatId: 'chat-other' })
    await service.sessions.setQueuePaused({ ...a, paused: true })
    await service.sessions.setQueuePaused({ ...b, paused: true })
    await service.sessions.queue({ ...a, clientMessageId: 'same-id', text: 'A' })
    await service.sessions.queue({ ...b, clientMessageId: 'same-id', text: 'B' })
    await service.sessions.cancelQueued({ ...a, clientMessageId: 'same-id' })
    expect((await service.sessions.snapshot(b)).queue?.items[0].text).toBe('B')
    await service.sessions.shutdown()
    service = createService()
    const restored = (await service.sessions.attach(config))!
    const resumed = await service.sessions.resume(restored, config)
    expect((await service.sessions.queue({ ...resumed, clientMessageId: 'same-id', text: 'A' })).queue?.items).toEqual([])
    await expect(service.sessions.queue({ ...resumed, clientMessageId: 'same-id', text: 'Changed' })).rejects.toThrow(/different content/)
    expect(providers[2].sendPrompt).not.toHaveBeenCalled()
  })

  it('a queue receipt disk failure keeps the accepted provider turn and Stop available', async () => {
    const session = await service.sessions.create(config)
    await service.sessions.setQueuePaused({ ...session, paused: true })
    await service.sessions.queue({ ...session, clientMessageId: 'accepted', text: 'Live turn' })
    await service.sessions.queue({ ...session, clientMessageId: 'next', text: 'Never send' })
    const original = RecoveryStore.prototype.write
    const spy = vi.spyOn(RecoveryStore.prototype, 'write').mockImplementation(function (this: RecoveryStore<unknown>, value, expected) {
      if (this.filename.includes('/queues/') && Array.isArray((value as { receipts?: unknown }).receipts) && (value as { receipts: unknown[] }).receipts.length) throw new Error('receipt disk failure')
      return original.call(this, value, expected)
    })
    try {
      await service.sessions.setQueuePaused({ ...session, paused: false })
      await vi.waitFor(async () => expect((await service.sessions.snapshot(session)).queue?.error).toMatch(/storage failed/))
      const current = await service.sessions.snapshot(session)
      expect(current.activeTurn).toMatchObject({ turnId: 'turn-1', status: 'running' })
      expect(current.sessionStatus).toBe('ready')
      await service.sessions.interrupt({ ...session, turnId: 'turn-1' })
      expect(providers[0].interruptTurn).toHaveBeenCalledWith('turn-1')
      providers[0].complete('turn-1', 'stopped')
      await service.sessions.snapshot(session)
      expect(providers[0].sendPrompt).toHaveBeenCalledTimes(1)
      await service.sessions.terminate(session)
      expect(providers[0].stop).toHaveBeenCalledWith(false)
    } finally { spy.mockRestore() }
  })

  it.each(['interrupt', 'terminate'] as const)('queue pause disk failure never prevents native %s', async action => {
    const session = await service.sessions.create(config)
    await send(session)
    await service.sessions.queue({ ...session, clientMessageId: 'later', text: 'Keep saved' })
    const original = RecoveryStore.prototype.write
    const spy = vi.spyOn(RecoveryStore.prototype, 'write').mockImplementation(function (this: RecoveryStore<unknown>, value, expected) {
      if (this.filename.includes('/queues/')) throw new Error('pause disk failure')
      return original.call(this, value, expected)
    })
    try {
      if (action === 'interrupt') {
        await service.sessions.interrupt({ ...session, turnId: 'turn-1' })
        expect(providers[0].interruptTurn).toHaveBeenCalledWith('turn-1')
      } else {
        await service.sessions.terminate(session)
        expect(providers[0].stop).toHaveBeenCalledWith(false)
      }
      const snapshot = await service.sessions.snapshot(session)
      expect(snapshot.queue).toMatchObject({ paused: true, error: expect.stringContaining('storage failed') })
      expect(providers[0].sendPrompt).toHaveBeenCalledTimes(1)
      expect(snapshot.error ?? '').not.toMatch(/Conversation storage failed/)
    } finally { spy.mockRestore() }
  })

  it('a provider error pauses later queued inputs instead of starting a new turn', async () => {
    const session = await service.sessions.create(config)
    await send(session)
    await service.sessions.queue({ ...session, clientMessageId: 'later', text: 'Later' })
    providers[0].complete('turn-1', 'error')
    const failed = await service.sessions.snapshot(session)
    expect(failed.lastTurn?.status).toBe('failed')
    expect(failed.queue?.paused).toBe(true)
    await new Promise(resolve => setTimeout(resolve, 30))
    expect(providers[0].sendPrompt).toHaveBeenCalledTimes(1)
  })

  it('queue storage rejection keeps the input out of the provider and exposes a recoverable snapshot', async () => {
    const session = await service.sessions.create(config)
    const original = RecoveryStore.prototype.write
    const spy = vi.spyOn(RecoveryStore.prototype, 'write').mockImplementation(function (this: RecoveryStore<unknown>, value, expected) {
      if (this.filename.includes('/queues/')) throw new Error('accept disk failure')
      return original.call(this, value, expected)
    })
    try {
      await expect(service.sessions.queue({ ...session, clientMessageId: 'not-acknowledged', text: 'Keep draft' })).rejects.toThrow('accept disk failure')
      expect(providers[0].sendPrompt).not.toHaveBeenCalled()
      expect((await service.sessions.snapshot(session)).queue).toMatchObject({ paused: true, error: expect.stringContaining('storage failed') })
    } finally { spy.mockRestore() }
  })

  // Backup publication, explicit restore, and native resume all use real durable
  // storage; retain every assertion while allowing concurrent full-suite disk load.
  it('reports damaged queue recovery and a restored old receipt never permits duplicate provider delivery', { timeout: 20_000 }, async () => {
    const session = await service.sessions.create(config)
    await service.sessions.setQueuePaused({ ...session, paused: true })
    await service.sessions.queue({ ...session, clientMessageId: 'delivered-once', text: 'Exactly once' })
    const queuePath = path.join(directory, config.taskId, 'queues', `${session.sessionId}.json`)
    const oldFingerprint = (await import('node:crypto')).createHash('sha256').update(fs.readFileSync(queuePath)).digest('hex')
    await service.sessions.setQueuePaused({ ...session, paused: false })
    await vi.waitFor(async () => expect((await service.sessions.snapshot(session)).queue?.items).toEqual([]))
    providers[0].complete('turn-1')
    await service.sessions.snapshot(session)
    await service.sessions.shutdown()
    fs.writeFileSync(queuePath, '{damaged queue')
    service = createService()
    const reports = await service.sessions.listRecovery(config.taskId)
    const report = reports.find(item => item.target.domain === 'message-queue')!
    expect(report).toMatchObject({ state: 'corrupt', target: { taskId: config.taskId, sessionId: session.sessionId } })
    await expect(service.sessions.attach(config)).rejects.toThrow(/damaged/)
    await vi.waitFor(() => expect(() => service.sessions.restoreQueueRecovery(config.taskId, session.sessionId, { expectedFingerprint: report.fingerprint!, backupId: oldFingerprint })).not.toThrow())
    const restored = (await service.sessions.attach(config))!
    expect(restored.queue?.items[0].status).toBe('uncertain')
    const resumed = await service.sessions.resume(restored, config)
    await expect(service.sessions.setQueuePaused({ ...resumed, paused: false })).rejects.toThrow(/uncertain/)
    await service.sessions.cancelQueued({ ...resumed, clientMessageId: 'delivered-once' })
    await expect(service.sessions.send({ ...resumed, clientMessageId: 'delivered-once', text: 'Exactly once' })).rejects.toThrow(/saved history|durable queue/)
    expect(providers[1].sendPrompt).not.toHaveBeenCalled()
  })

})
