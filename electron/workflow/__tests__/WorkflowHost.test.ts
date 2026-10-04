import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AgentSendReceipt, AgentSessionSnapshot, AgentSessionUpdate } from '../../../shared/agent-session'
import type { SessionManager, TrustedAgentSessionConfig } from '../../runtime/SessionManager'
import type { WorkflowEngineOptions } from '../WorkflowEngine'
import { createWorkflowHost } from '../WorkflowHost'
import { WorkflowAgentCleanupError } from '../WorkflowAgentRunner'

const wiring = vi.hoisted(() => ({ options: undefined as WorkflowEngineOptions | undefined }))
vi.mock('../WorkflowEngine', async importOriginal => ({
  ...await importOriginal<typeof import('../WorkflowEngine')>(),
  WorkflowEngine: class {
    constructor(options: WorkflowEngineOptions) { wiring.options = options }
    async shutdown() {}
  },
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((accept, decline) => { resolve = accept; reject = decline })
  return { promise, resolve, reject }
}

const snapshot = (): AgentSessionSnapshot => ({
  taskId: 'task', chatId: 'wf-review', sessionId: 'session-review', runId: 'run-review',
  provider: 'codex', presetName: 'Read only review', cursor: 0, sessionStatus: 'ready',
  capabilities: { attachments: false, interactiveApprovals: true, interruptTurn: true },
  feed: [], pendingApprovals: [],
})
const request = { taskId: 'task', chatId: 'wf-review', presetName: 'Read only review', role: 'reviewer' as const, prompt: 'Review the actual diff and evidence.' }
const ref = { sessionId: 'session-review', runId: 'run-review' }
const hosts: ReturnType<typeof createWorkflowHost>[] = []
const directories: string[] = []
afterEach(async () => {
  await Promise.all(hosts.splice(0).map(host => host.shutdown()))
  for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true })
  wiring.options = undefined
})

function setup(sessions: Pick<SessionManager, 'attach' | 'create' | 'send' | 'snapshot' | 'terminate' | 'onEvent'>) {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ziaf-workflow-host-')))
  directories.push(directory)
  const config: TrustedAgentSessionConfig = { taskId: 'task', chatId: 'wf-review', presetName: 'Read only review', provider: 'codex', cwd: directory }
  const resolveLaunch = vi.fn(async () => config)
  const host = createWorkflowHost({
    directory, sessions: () => sessions as SessionManager,
    resolveLaunch, taskCwd: () => directory, validateTask: () => {}, env: () => ({ ...process.env }),
  })
  hosts.push(host)
  return { runAgent: wiring.options!.runAgent, resolveLaunch, config }
}

describe('workflow host owns native sessions until cleanup completes', () => {
  it('retains a typed cleanup owner when startup finishes after pause and termination fails before session registration', async () => {
    const startup = deferred<AgentSessionSnapshot>()
    const sessions = {
      attach: vi.fn().mockResolvedValueOnce(null).mockResolvedValue(snapshot()),
      create: vi.fn(() => startup.promise), snapshot: vi.fn(async () => snapshot()),
      send: vi.fn<SessionManager['send']>(), onEvent: vi.fn<SessionManager['onEvent']>(),
      terminate: vi.fn().mockRejectedValueOnce(new Error('owned child did not close')).mockResolvedValue(undefined),
    }
    const { runAgent } = setup(sessions)
    const controller = new AbortController()
    const onSession = vi.fn(async () => {})
    const operation = runAgent(request, controller.signal, onSession)
    const outcome = operation.catch(error => error as unknown)
    await vi.waitFor(() => expect(sessions.create).toHaveBeenCalledTimes(1))
    controller.abort()
    startup.resolve(snapshot())
    const error = await outcome
    expect(error).toBeInstanceOf(WorkflowAgentCleanupError)
    expect((error as WorkflowAgentCleanupError).session).toEqual({ ...ref, chatId: request.chatId })
    expect((error as Error).message).toContain('no new context may start')
    expect(onSession).not.toHaveBeenCalled()
    expect(sessions.send).not.toHaveBeenCalled()
    expect(sessions.onEvent).not.toHaveBeenCalled()
    await wiring.options!.settleAgentCleanup!('task', [(error as WorkflowAgentCleanupError).session])
    expect(sessions.attach).toHaveBeenLastCalledWith({ taskId: 'task', chatId: request.chatId })
    expect(sessions.terminate).toHaveBeenNthCalledWith(1, ref)
    expect(sessions.terminate).toHaveBeenNthCalledWith(2, { ...ref, chatId: request.chatId })
    expect(sessions.create).toHaveBeenCalledTimes(1)
    expect(sessions.send).not.toHaveBeenCalled()
  })

  it('stops a newly created session before propagating a failed durable session registration', async () => {
    const cleanup = deferred<void>()
    const sessions = {
      attach: vi.fn(async () => null), create: vi.fn(async () => snapshot()),
      snapshot: vi.fn(async () => snapshot()),
      send: vi.fn<SessionManager['send']>(), onEvent: vi.fn<SessionManager['onEvent']>(),
      terminate: vi.fn(() => cleanup.promise),
    }
    const { runAgent, resolveLaunch, config } = setup(sessions)
    const storageError = new Error('simulated metadata write failure')
    const onSession = vi.fn(async () => { throw storageError })
    let settled = false
    const operation = runAgent(request, new AbortController().signal, onSession)
    const outcome = operation.then(value => { settled = true; return value }, error => { settled = true; return error })

    await vi.waitFor(() => expect(sessions.terminate).toHaveBeenCalledExactlyOnceWith(ref))
    expect(resolveLaunch).toHaveBeenCalledExactlyOnceWith(request)
    expect(sessions.create).toHaveBeenCalledExactlyOnceWith(config)
    expect(onSession).toHaveBeenCalledExactlyOnceWith({ ...ref, chatId: request.chatId })
    expect(settled).toBe(false)
    expect(sessions.send).not.toHaveBeenCalled()
    expect(sessions.onEvent).not.toHaveBeenCalled()

    cleanup.resolve()
    expect(await outcome).toBe(storageError)
    expect(settled).toBe(true)
  })

  it('pauses a pending reviewer delivery only after owned cleanup and detaches its observer once', async () => {
    const delivery = deferred<AgentSendReceipt>()
    const cleanup = deferred<void>()
    const off = vi.fn()
    let listener!: (update: AgentSessionUpdate) => void
    const sessions = {
      attach: vi.fn(async () => snapshot()), create: vi.fn<SessionManager['create']>(),
      snapshot: vi.fn(async () => snapshot()),
      send: vi.fn(() => delivery.promise), terminate: vi.fn(() => cleanup.promise),
      onEvent: vi.fn((callback: (update: AgentSessionUpdate) => void) => { listener = callback; return off }),
    }
    const { runAgent, resolveLaunch } = setup(sessions)
    const controller = new AbortController()
    const onSession = vi.fn(async () => {})
    let settled = false
    const operation = runAgent(request, controller.signal, onSession)
    const outcome = operation.then(value => { settled = true; return value }, error => { settled = true; return error })
    await vi.waitFor(() => expect(sessions.send).toHaveBeenCalledTimes(1))
    expect(sessions.create).not.toHaveBeenCalled()
    expect(resolveLaunch).not.toHaveBeenCalled()
    expect(onSession).toHaveBeenCalledExactlyOnceWith({ ...ref, chatId: request.chatId })

    controller.abort()
    await vi.waitFor(() => expect(sessions.terminate).toHaveBeenCalledExactlyOnceWith(ref))
    expect(settled).toBe(false)
    expect(off).not.toHaveBeenCalled()
    // A concurrent old generation cannot change the cancellation outcome.
    listener({ snapshot: { ...snapshot(), runId: 'stale-run', sessionStatus: 'error', error: 'stale failure' } })
    cleanup.resolve()
    expect(await outcome).toEqual(new Error('Workflow paused'))
    expect(off).toHaveBeenCalledTimes(1)
    expect(sessions.terminate).toHaveBeenCalledTimes(1)

    // Late transport rejection must already have a handler even though pause won.
    delivery.reject(new Error('late transport shutdown'))
    await new Promise<void>(resolve => setImmediate(resolve))
    expect(off).toHaveBeenCalledTimes(1)
    expect(sessions.terminate).toHaveBeenCalledTimes(1)
  })

  it('recovers a completed invocation by its stable message identity without sending again', async () => {
    const clientMessageId = 'wf-message-completed'
    const completed = { ...snapshot(), lastTurn: { clientMessageId, status: 'completed' as const }, feed: [
      { id: `user-${clientMessageId}`, role: 'user' as const, text: request.prompt },
      { id: 'answer', role: 'assistant' as const, text: 'Retained review result' },
    ] }
    const off = vi.fn()
    const sessions = {
      attach: vi.fn(async () => snapshot()), create: vi.fn<SessionManager['create']>(),
      snapshot: vi.fn(async () => completed as AgentSessionSnapshot),
      send: vi.fn<SessionManager['send']>(), terminate: vi.fn(async () => {}),
      onEvent: vi.fn(() => off),
    }
    const { runAgent } = setup(sessions)
    expect(await runAgent({ ...request, clientMessageId }, new AbortController().signal, async () => {})).toBe('Retained review result')
    expect(sessions.send).not.toHaveBeenCalled()
    expect(sessions.create).not.toHaveBeenCalled()
    expect(sessions.terminate).not.toHaveBeenCalled()
    expect(off).toHaveBeenCalledTimes(1)
  })
})
