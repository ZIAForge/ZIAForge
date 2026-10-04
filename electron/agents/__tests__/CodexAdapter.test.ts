import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { CodexAdapter, CodexAdapterOptions, CodexRpcRejectedError } from '../CodexAdapter'
import {
  AgentEvent,
  AgentStatusChangedEvent,
  MessageStartedEvent,
  MessageDeltaEvent,
  MessageCompletedEvent,
  ToolStartedEvent,
  ToolOutputDeltaEvent,
  ToolCompletedEvent,
  PermissionRequestedEvent,
  PermissionStateChangedEvent,
  RawLogEvent,
} from '../../../shared/agent-events'

class MockChildProcess extends EventEmitter {
  pid = 12345
  stdin = new PassThrough()
  stdout = new PassThrough()
  stderr = new PassThrough()
  killed = false
  exitCode: number | null = null

  kill(signal: NodeJS.Signals | number = 'SIGTERM') {
    this.killed = true
    this.exitCode = 0
    this.emit('exit', 0, signal)
    this.emit('close', 0, signal)
    return true
  }
}

class StubbornChildProcess extends EventEmitter {
  pid = 67890
  stdin = new PassThrough()
  stdout = new PassThrough()
  stderr = new PassThrough()
  killed = false
  exitCode: number | null = null
  signalsReceived: (NodeJS.Signals | number)[] = []

  kill(signal: NodeJS.Signals | number = 'SIGTERM') {
    this.signalsReceived.push(signal)
    if (signal === 'SIGKILL') {
      this.killed = true
      this.exitCode = 137
      this.emit('exit', 137, 'SIGKILL')
      return true
    }
    // In real Node.js child_process, proc.killed is true once any kill() signal is sent
    this.killed = true
    return true
  }
}

describe('CodexAdapter', () => {
  let mockProc: MockChildProcess
  let emittedEvents: AgentEvent[]
  let rawLogs: { stream: 'stdout' | 'stderr'; line: string }[]
  let adapter: CodexAdapter
  let adapterOptions: CodexAdapterOptions

  beforeEach(() => {
    mockProc = new MockChildProcess()
    emittedEvents = []
    rawLogs = []

    adapterOptions = {
      taskId: 'test-task-1',
      runId: 'test-run-1',
      worktreePath: '/mock/worktree',
      spawnProcess: () => mockProc as unknown as ReturnType<NonNullable<CodexAdapterOptions['spawnProcess']>>,
      onEvent: (evt) => emittedEvents.push(evt),
      onRawLog: (stream, line) => rawLogs.push({ stream, line }),
    }
  })

  afterEach(async () => {
    if (adapter) {
      await adapter.stop().catch(() => {})
    }
  })

  describe('persistent session turn lifecycle', () => {
    interface Request {
      id: number
      method: string
      params: Record<string, unknown>
    }

    it('forwards explicit effort through thread configuration and every turn', async () => {
      adapterOptions.reasoningEffort = 'none'
      const wire = protocol()
      await adapter.start(); await adapter.sendPrompt({ taskId: adapterOptions.taskId, text: 'First' })
      wire.notify('turn/completed', { threadId: 'thread-1', turn: { id: 'turn-1', status: 'completed' } })
      await adapter.sendPrompt({ taskId: adapterOptions.taskId, text: 'Second' })
      expect(wire.requests.find(request => request.method === 'thread/start')?.params.config).toEqual({ model_reasoning_effort: 'none' })
      expect(wire.requests.filter(request => request.method === 'turn/start').map(request => request.params.effort)).toEqual(['none', 'none'])
      expect(wire.requests.some(request => request.method === 'model/list')).toBe(false)
    })

    it('resets resumed effort to the actual model catalog default without sending invalid config null', async () => {
      adapterOptions.reasoningEffort = null; adapterOptions.resumeThreadId = 'thread-1'
      const wire = protocol(request => {
        if (request.method === 'thread/resume') {
          mockProc.stdout.write(JSON.stringify({ id: request.id, result: { thread: { id: 'thread-1' }, model: 'known-model', reasoningEffort: 'xhigh' } }) + '\n'); return true
        }
        if (request.method === 'model/list') {
          const result = request.params.cursor ? { data: [{ model: 'known-model', defaultReasoningEffort: 'medium', supportedReasoningEfforts: [{ reasoningEffort: 'medium' }, { reasoningEffort: 'xhigh' }] }], nextCursor: null } : { data: [], nextCursor: 'page-2' }
          mockProc.stdout.write(JSON.stringify({ id: request.id, result }) + '\n'); return true
        }
        return false
      })
      await adapter.start(); await adapter.sendPrompt({ taskId: adapterOptions.taskId, text: 'Default' })
      expect(wire.requests.find(request => request.method === 'thread/resume')?.params).not.toHaveProperty('config')
      expect(wire.requests.filter(request => request.method === 'model/list')).toHaveLength(2)
      expect(wire.requests.find(request => request.method === 'turn/start')?.params.effort).toBe('medium')
    })

    it('fences Stop during default discovery before any turn', async () => {
      adapterOptions.reasoningEffort = null
      let held: Request | undefined
      const wire = protocol(request => {
        if (request.method === 'thread/start') { mockProc.stdout.write(JSON.stringify({ id: request.id, result: { thread: { id: 'thread-1' }, model: 'manual-unknown' } }) + '\n'); return true }
        if (request.method === 'model/list') { held = request; return true }
        return false
      })
      const starting = adapter.start(); const rejected = expect(starting).rejects.toThrow()
      await vi.waitFor(() => expect(held).toBeDefined())
      await adapter.stop(); await rejected
      wire.respond(held!, { data: [{ model: 'manual-unknown', defaultReasoningEffort: 'medium', supportedReasoningEfforts: [{ reasoningEffort: 'medium' }] }], nextCursor: null })
      expect(adapter.getStatus()).not.toBe('running')
      expect(wire.requests.some(request => request.method === 'turn/start')).toBe(false)
    })

    function protocol(onRequest?: (request: Request) => boolean) {
      const requests: Request[] = []
      let nextTurn = 0
      const respond = (request: Request, result: unknown) => {
        mockProc.stdout.write(JSON.stringify({ id: request.id, result }) + '\n')
      }
      const notify = (method: string, params: Record<string, unknown>) => {
        mockProc.stdout.write(JSON.stringify({ method, params }) + '\n')
      }
      let buffer = ''
      mockProc.stdin.on('data', (chunk) => {
        buffer += chunk.toString()
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (!line.trim()) continue
          const request = JSON.parse(line) as Request
          requests.push(request)
          if (onRequest?.(request)) continue
          if (request.method === 'initialize') respond(request, {})
          if (request.method === 'thread/start') respond(request, { thread: { id: 'thread-1' } })
          if (request.method === 'turn/start') respond(request, { turn: { id: `turn-${++nextTurn}` } })
          if (request.method === 'turn/interrupt') respond(request, {})
        }
      })
      adapter = new CodexAdapter(adapterOptions)
      return { requests, respond, notify }
    }

    it('resumes only the explicit thread with current model/policy and never falls back to thread/start', async () => {
      adapterOptions = { ...adapterOptions, resumeThreadId: 'saved-thread', model: 'changed-model', sandbox: 'read-only' }
      const fixture = protocol(request => {
        if (request.method === 'thread/resume') { mockProc.stdout.write(JSON.stringify({ id: request.id, result: { thread: { id: 'saved-thread' } } }) + '\n'); return true }
        return false
      })
      await expect(adapter.start()).resolves.toMatchObject({ threadId: 'saved-thread' })
      expect(fixture.requests.find(request => request.method === 'thread/resume')?.params).toMatchObject({ threadId: 'saved-thread', model: 'changed-model', sandbox: 'read-only', cwd: '/mock/worktree' })
      expect(fixture.requests.some(request => request.method === 'thread/start')).toBe(false)
    })

    it('rejects missing or mismatched native resume identities without creating a replacement thread', async () => {
      adapterOptions = { ...adapterOptions, resumeThreadId: 'saved-thread' }
      const fixture = protocol(request => {
        if (request.method === 'thread/resume') { mockProc.stdout.write(JSON.stringify({ id: request.id, result: { thread: { id: 'different-thread' } } }) + '\n'); return true }
        return false
      })
      await expect(adapter.start()).rejects.toThrow(/unexpected thread/)
      expect(fixture.requests.some(request => request.method === 'thread/start')).toBe(false)
      expect(mockProc.killed).toBe(true)
    })

    it('passes trusted permission policy and environment to the app-server handshake', async () => {
      const spawn = vi.fn(() => mockProc as unknown as ReturnType<NonNullable<CodexAdapterOptions['spawnProcess']>>)
      adapterOptions = { ...adapterOptions, spawnProcess: spawn, env: { PATH: '/trusted/bin', FIXTURE_ONLY: 'yes' }, sandbox: 'read-only', approvalPolicy: 'untrusted' }
      const fixture = protocol()
      await adapter.start()
      expect(spawn.mock.calls[0]).toMatchObject([expect.any(String), ['app-server', '--listen', 'stdio://'], { env: { PATH: '/trusted/bin', FIXTURE_ONLY: 'yes', CI: 'true' } }])
      expect(fixture.requests.find(request => request.method === 'thread/start')?.params).toMatchObject({ cwd: '/mock/worktree', sandbox: 'read-only', approvalPolicy: 'untrusted' })
    })

    it('preserves structured reasoning completion as thinking instead of assistant text', async () => {
      const fixture = protocol()
      await adapter.start()
      await adapter.sendPrompt({ taskId: 'test-task-1', text: 'Reason' })
      fixture.notify('item/completed', { threadId: 'thread-1', turnId: 'turn-1', item: { type: 'reasoning', id: 'reasoning', content: [{ type: 'reasoning_text', text: 'Done thinking' }] } })
      expect(emittedEvents.find(event => event.type === 'message.completed')).toMatchObject({ contentType: 'thinking', fullContent: 'Done thinking', turnId: 'turn-1' })
    })

    it('classifies an explicit turn/start refusal independently from uncertain transport failures', async () => {
      protocol(request => {
        if (request.method !== 'turn/start') return false
        mockProc.stdout.write(JSON.stringify({ id: request.id, error: { code: -32000, message: 'Try again later' } }) + '\n')
        return true
      })
      await adapter.start()
      const error = await adapter.sendPrompt({ taskId: 'test-task-1', text: 'Retryable' }).catch(error => error)
      expect(error).toBeInstanceOf(CodexRpcRejectedError)
      expect(error).toMatchObject({ method: 'turn/start', deliveryRejected: true })
    })

    it.each(['turn/started', 'item/agentMessage/delta'])('does not classify refusal after %s as definitely undelivered', async method => {
      protocol(request => {
        if (request.method !== 'turn/start') return false
        const params = method === 'turn/started'
          ? { threadId: 'thread-1', turn: { id: 'turn-contradictory' } }
          : { threadId: 'thread-1', turnId: 'turn-contradictory', itemId: 'message', delta: 'Already working' }
        mockProc.stdout.write(JSON.stringify({ method, params }) + '\n')
        mockProc.stdout.write(JSON.stringify({ id: request.id, error: { code: -32000, message: 'Contradictory refusal' } }) + '\n')
        return true
      })
      await adapter.start()
      const error = await adapter.sendPrompt({ taskId: 'test-task-1', text: 'Keep uncertain' }).catch(error => error)
      expect(error).toBeInstanceOf(CodexRpcRejectedError)
      expect(error.deliveryRejected).toBe(false)
    })

    it('keeps the PID/thread on interrupt acknowledgement and releases send only on matching completion', async () => {
      const fixture = protocol()
      await adapter.start()
      await adapter.sendPrompt({ taskId: 'test-task-1', text: 'First' })
      await expect(adapter.interruptTurn('turn-1')).resolves.toEqual({ turnId: 'turn-1' })
      expect(fixture.requests.find((request) => request.method === 'turn/interrupt')?.params).toEqual({
        threadId: 'thread-1', turnId: 'turn-1',
      })
      expect(adapter.getActiveTurnId()).toBe('turn-1')
      expect(adapter.getStatus()).toBe('running')
      await expect(adapter.sendPrompt({ taskId: 'test-task-1', text: 'Too early' })).rejects.toThrow(/already in progress/)
      fixture.notify('turn/completed', { threadId: 'thread-1', turn: { id: 'turn-1', status: 'interrupted' } })
      expect(adapter.getActiveTurnId()).toBeUndefined()
      expect(emittedEvents[emittedEvents.length - 1]).toMatchObject({
        type: 'agent.status.changed', scope: 'turn', turnId: 'turn-1', status: 'stopped',
      })
      await expect(adapter.sendPrompt({ taskId: 'test-task-1', text: 'Next' })).resolves.toEqual({ turnId: 'turn-2' })
      expect(adapter.getActiveTurnId()).toBe('turn-2')
      expect(adapter.getPid()).toBe(12345)
      expect(adapter.getThreadId()).toBe('thread-1')
      expect(mockProc.killed).toBe(false)
      expect(fixture.requests.filter((request) => request.method === 'thread/start')).toHaveLength(1)
    })

    it('ignores duplicate and foreign lifecycle notifications after the next turn starts', async () => {
      const fixture = protocol()
      await adapter.start()
      await adapter.sendPrompt({ taskId: 'test-task-1', text: 'First' })
      fixture.notify('turn/completed', { turn: { id: 'turn-1', status: 'completed' } })
      await adapter.sendPrompt({ taskId: 'test-task-1', text: 'Second' })
      const eventCount = emittedEvents.length
      fixture.notify('turn/completed', { turn: { id: 'turn-1', status: 'interrupted' } })
      fixture.notify('turn/started', { turn: { id: 'turn-1' } })
      fixture.notify('error', { turnId: 'turn-1', message: 'Late first-turn failure' })
      fixture.notify('turn/completed', { turn: { id: 'unknown-turn', status: 'completed' } })
      fixture.notify('turn/completed', { threadId: 'other-thread', turn: { id: 'turn-2', status: 'completed' } })
      fixture.notify('turn/completed', { status: 'completed' })
      expect(emittedEvents).toHaveLength(eventCount)
      expect(adapter.getActiveTurnId()).toBe('turn-2')
      expect(adapter.getStatus()).toBe('running')
      await expect(adapter.sendPrompt({ taskId: 'test-task-1', text: 'Third' })).rejects.toThrow(/already in progress/)
      await expect(adapter.interruptTurn('turn-1')).rejects.toThrow(/no longer matches/)
      expect(fixture.requests.filter((request) => request.method === 'turn/interrupt')).toHaveLength(0)
    })

    it('ignores old completion while the next turn/start response is pending', async () => {
      let pending: Request | undefined
      let count = 0
      const fixture = protocol((request) => {
        if (request.method === 'turn/start' && ++count === 2) {
          pending = request
          return true
        }
        return false
      })
      await adapter.start()
      await adapter.sendPrompt({ taskId: 'test-task-1', text: 'First' })
      fixture.notify('turn/completed', { turn: { id: 'turn-1', status: 'completed' } })
      const sending = adapter.sendPrompt({ taskId: 'test-task-1', text: 'Second' })
      fixture.notify('turn/completed', { turn: { id: 'turn-1', status: 'failed' } })
      fixture.notify('turn/started', { turn: { id: 'turn-1' } })
      expect(adapter.getStatus()).toBe('running')
      expect(adapter.getActiveTurnId()).toBeUndefined()
      await expect(adapter.interruptTurn()).rejects.toThrow(/no active turn/)
      fixture.respond(pending!, { turn: { id: 'turn-2' } })
      await expect(sending).resolves.toEqual({ turnId: 'turn-2' })
      expect(adapter.getActiveTurnId()).toBe('turn-2')
      expect(emittedEvents[emittedEvents.length - 1]).toMatchObject({
        type: 'agent.status.changed', scope: 'turn', turnId: 'turn-2', status: 'running',
      })
    })

    it('does not revive a fast completed turn when its delayed started notification arrives', async () => {
      let pending: Request | undefined
      const fixture = protocol((request) => {
        if (request.method === 'turn/start') {
          pending = request
          return true
        }
        return false
      })
      await adapter.start()
      const sending = adapter.sendPrompt({ taskId: 'test-task-1', text: 'Fast' })
      fixture.notify('turn/completed', { turn: { id: 'fast', status: 'completed' } })
      fixture.notify('turn/started', { turn: { id: 'fast' } })
      fixture.respond(pending!, { turn: { id: 'fast' } })
      await expect(sending).resolves.toEqual({ turnId: 'fast' })
      expect(adapter.getStatus()).toBe('completed')
      expect(adapter.getActiveTurnId()).toBeUndefined()
      expect(emittedEvents.filter((event) => event.type === 'agent.status.changed' && event.turnId === 'fast')).toEqual([
        expect.objectContaining({ status: 'completed', scope: 'turn' }),
      ])
    })

    it('does not modify a new turn when an older interrupt response arrives late', async () => {
      let interruptRequest: Request | undefined
      const fixture = protocol((request) => {
        if (request.method === 'turn/interrupt' && !interruptRequest) {
          interruptRequest = request
          return true
        }
        return false
      })
      await adapter.start()
      await adapter.sendPrompt({ taskId: 'test-task-1', text: 'First' })
      const interrupting = adapter.interruptTurn('turn-1')
      fixture.notify('turn/completed', { turn: { id: 'turn-1', status: 'interrupted' } })
      await adapter.sendPrompt({ taskId: 'test-task-1', text: 'Second' })
      fixture.respond(interruptRequest!, {})
      await expect(interrupting).resolves.toEqual({ turnId: 'turn-1' })
      expect(adapter.getActiveTurnId()).toBe('turn-2')
      expect(adapter.getStatus()).toBe('running')
      expect(mockProc.killed).toBe(false)
    })

    it('expires only matching approvals on completion, and a failed interrupt keeps the turn active', async () => {
      const fixture = protocol((request) => {
        if (request.method === 'turn/interrupt') {
          mockProc.stdout.write(JSON.stringify({ id: request.id, error: { code: -32000, message: 'Interrupt rejected' } }) + '\n')
          return true
        }
        return false
      })
      await adapter.start()
      // Unassociated legacy approval must not be expired by a different turn.
      mockProc.stdout.write(JSON.stringify({ id: 'legacy', method: 'execCommandApproval', params: {} }) + '\n')
      await adapter.sendPrompt({ taskId: 'test-task-1', text: 'First' })
      mockProc.stdout.write(JSON.stringify({
        id: 'current', method: 'item/commandExecution/requestApproval',
        params: { threadId: 'thread-1', turnId: 'turn-1', command: 'echo local-fixture' },
      }) + '\n')
      const approvals = emittedEvents.filter((event): event is PermissionRequestedEvent => event.type === 'permission.requested')
      await expect(adapter.interruptTurn()).rejects.toThrow(/Interrupt rejected/)
      expect(adapter.getStatus()).toBe('waiting_for_approval')
      expect(adapter.getActiveTurnId()).toBe('turn-1')
      expect(emittedEvents.filter((event) => event.type === 'permission.state.changed')).toHaveLength(0)
      fixture.notify('turn/completed', { turn: { id: 'turn-1', status: 'interrupted' } })
      expect(emittedEvents.filter((event) => event.type === 'permission.state.changed')).toEqual([
        expect.objectContaining({ approvalId: approvals[1].approvalId, state: 'expired', turnId: 'turn-1' }),
      ])
      await expect(adapter.resolveApproval(approvals[1].approvalId, 'allow')).rejects.toThrow(/not found/)
      await expect(adapter.resolveApproval(approvals[0].approvalId, 'deny')).resolves.toBeUndefined()
    })

    it.each(['completed', 'interrupted', 'failed'])('reports process loss after %s as a separate session failure', async (status) => {
      const fixture = protocol()
      await adapter.start()
      await adapter.sendPrompt({ taskId: 'test-task-1', text: 'First' })
      fixture.notify('turn/completed', { turn: { id: 'turn-1', status } })
      mockProc.emit('exit', 0, null)
      mockProc.emit('close', 0, null)
      const terminalEvents = emittedEvents.filter((event) => event.type === 'agent.status.changed').slice(-2)
      expect(terminalEvents).toEqual([
        expect.objectContaining({ scope: 'turn', turnId: 'turn-1', status: status === 'interrupted' ? 'stopped' : status === 'failed' ? 'error' : 'completed' }),
        expect.objectContaining({ scope: 'session', status: 'error', error: expect.stringContaining('process exited') }),
      ])
      expect(terminalEvents[1].turnId).toBeUndefined()
      expect(adapter.getPid()).toBeUndefined()
      expect(adapter.getThreadId()).toBeUndefined()
      await expect(adapter.sendPrompt({ taskId: 'test-task-1', text: 'Next' })).rejects.toThrow(/not initialized/)
    })

    it('keeps the send lock during approval expiry callbacks, then permits a new turn from the terminal callback', async () => {
      let earlySend: Promise<unknown> | undefined
      let nextSend: Promise<{ turnId: string }> | undefined
      adapterOptions.onEvent = (event) => {
        emittedEvents.push(event)
        if (event.type === 'permission.state.changed' && event.state === 'expired') {
          earlySend = adapter.sendPrompt({ taskId: 'test-task-1', text: 'Too early' }).catch((error: unknown) => error)
        }
        if (event.type === 'agent.status.changed' && event.scope === 'turn' && event.status === 'completed') {
          nextSend = adapter.sendPrompt({ taskId: 'test-task-1', text: 'Next turn' })
        }
      }
      const fixture = protocol()
      await adapter.start()
      await adapter.sendPrompt({ taskId: 'test-task-1', text: 'First' })
      mockProc.stdout.write(JSON.stringify({
        id: 'approval', method: 'item/commandExecution/requestApproval', params: { turnId: 'turn-1' },
      }) + '\n')
      fixture.notify('turn/completed', { turn: { id: 'turn-1', status: 'completed' } })
      expect(await earlySend).toMatchObject({ message: expect.stringContaining('already in progress') })
      await expect(nextSend).resolves.toEqual({ turnId: 'turn-2' })
      expect(adapter.getActiveTurnId()).toBe('turn-2')
      expect(adapter.getStatus()).toBe('running')
    })

    it('rejects a pending interrupt on process loss without issuing a process kill', async () => {
      protocol((request) => request.method === 'turn/interrupt')
      await adapter.start()
      await adapter.sendPrompt({ taskId: 'test-task-1', text: 'First' })
      const interrupting = adapter.interruptTurn()
      mockProc.emit('exit', 1, null)
      mockProc.emit('close', 1, null)
      await expect(interrupting).rejects.toThrow(/process exited/)
      expect(adapter.getStatus()).toBe('error')
      expect(adapter.getPid()).toBeUndefined()
      expect(mockProc.killed).toBe(false)
    })

    it('deduplicates recovery started inside the exit callback with a concurrent start after close', async () => {
      const processes: MockChildProcess[] = []
      let recovery: Promise<{ pid: number; threadId: string }> | undefined
      adapter = new CodexAdapter({
        ...adapterOptions,
        spawnProcess: () => {
          const proc = new MockChildProcess()
          proc.pid = 100 + processes.length
          processes.push(proc)
          proc.stdin.on('data', (chunk) => {
            const request = JSON.parse(chunk.toString().trim()) as Request
            let result: unknown
            if (request.method === 'initialize') result = {}
            if (request.method === 'thread/start') result = { thread: { id: `thread-${proc.pid}` } }
            if (request.method === 'turn/start') result = { turn: { id: `turn-${proc.pid}` } }
            if (result !== undefined) proc.stdout.write(JSON.stringify({ id: request.id, result }) + '\n')
          })
          return proc as unknown as ReturnType<NonNullable<CodexAdapterOptions['spawnProcess']>>
        },
        onEvent: (event) => {
          emittedEvents.push(event)
          if (!recovery && event.type === 'agent.status.changed' && event.scope === 'session' && event.status === 'error') {
            recovery = adapter.start()
          }
        },
      })
      await adapter.start()
      await adapter.sendPrompt({ taskId: 'test-task-1', text: 'Interrupted by process exit' })
      processes[0].emit('exit', 0, null)
      processes[0].emit('close', 0, null)
      expect(recovery).toBeDefined()
      const concurrent = adapter.start()
      const results = await Promise.allSettled([recovery!, concurrent])
      expect(results).toEqual([
        { status: 'fulfilled', value: { pid: 101, threadId: 'thread-101' } },
        { status: 'fulfilled', value: { pid: 101, threadId: 'thread-101' } },
      ])
      expect(processes).toHaveLength(2)
      expect(adapter.getPid()).toBe(101)
      expect(adapter.getThreadId()).toBe('thread-101')
      expect(adapter.getStatus()).toBe('idle')
    })
  })

  it('starts process, completes initialize handshake, sends initialized notification, and starts thread', async () => {
    adapter = new CodexAdapter(adapterOptions)

    const receivedRequests: Array<{ method: string; id?: number | string; params?: Record<string, unknown> }> = []
    let stdinBuffer = ''
    mockProc.stdin.on('data', (chunk) => {
      stdinBuffer += chunk.toString()
      const lines = stdinBuffer.split('\n')
      stdinBuffer = lines.pop() || ''
      for (const line of lines) {
        if (!line.trim()) continue
        const req = JSON.parse(line)
        receivedRequests.push(req)

        if (req.method === 'initialize') {
          mockProc.stdout.write(
            JSON.stringify({
              jsonrpc: '2.0',
              id: req.id,
              result: { userAgent: 'codex-cli/0.153.4' },
            }) + '\n'
          )
        } else if (req.method === 'thread/start') {
          mockProc.stdout.write(
            JSON.stringify({
              jsonrpc: '2.0',
              id: req.id,
              result: {
                thread: {
                  id: 'mock-thread-xyz',
                  sessionId: 'mock-thread-xyz',
                  status: { type: 'idle' },
                },
              },
            }) + '\n'
          )
        }
      }
    })

    const info = await adapter.start()
    expect(info.pid).toBe(12345)
    expect(adapter.getThreadId()).toBe('mock-thread-xyz')

    // Verify initialize, initialized notification, and thread/start were sent
    expect(receivedRequests.length).toBe(3)
    expect(receivedRequests[0].method).toBe('initialize')
    expect((receivedRequests[0].params?.clientInfo as { name: string }).name).toBe('ziaforge')
    expect(receivedRequests[1].method).toBe('initialized')
    expect(receivedRequests[2].method).toBe('thread/start')
    expect(receivedRequests[2].params?.cwd).toBe('/mock/worktree')
  })

  it('sends prompt via turn/start, normalizes return turnId, and emits status running', async () => {
    adapter = new CodexAdapter(adapterOptions)

    mockProc.stdin.on('data', (chunk) => {
      const line = chunk.toString().trim()
      if (!line) return
      const req = JSON.parse(line)
      if (req.method === 'initialize') {
        mockProc.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: {} }) + '\n')
      } else if (req.method === 'thread/start') {
        mockProc.stdout.write(
          JSON.stringify({
            jsonrpc: '2.0',
            id: req.id,
            result: { thread: { id: 'thread-123' } },
          }) + '\n'
        )
      } else if (req.method === 'turn/start') {
        mockProc.stdout.write(
          JSON.stringify({
            jsonrpc: '2.0',
            id: req.id,
            result: { turnId: 'turn-456' },
          }) + '\n'
        )
      }
    })

    await adapter.start()
    const res = await adapter.sendPrompt({ taskId: 'test-task-1', text: 'Implement login page' })
    expect(res.turnId).toBe('turn-456')
    expect(adapter.getActiveTurnId()).toBe('turn-456')

    const statusEvents = emittedEvents.filter((e): e is AgentStatusChangedEvent => e.type === 'agent.status.changed')
    expect(statusEvents.some((e) => e.status === 'running')).toBe(true)
  })

  it('translates streaming message deltas (text and thinking) into AgentEvents', async () => {
    adapter = new CodexAdapter(adapterOptions)

    mockProc.stdin.on('data', (chunk) => {
      const line = chunk.toString().trim()
      if (!line) return
      const req = JSON.parse(line)
      if (req.method === 'initialize') {
        mockProc.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: {} }) + '\n')
      } else if (req.method === 'thread/start') {
        mockProc.stdout.write(
          JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { thread: { id: 'thread-1' } } }) +
            '\n'
        )
      }
    })

    await adapter.start()

    // Simulate item/started (assistant message)
    mockProc.stdout.write(
      JSON.stringify({
        method: 'item/started',
        params: {
          threadId: 'thread-1',
          turnId: 'turn-1',
          item: { type: 'agentMessage', id: 'msg-1', text: '' },
        },
      }) + '\n'
    )

    // Simulate thinking delta
    mockProc.stdout.write(
      JSON.stringify({
        method: 'item/reasoning/textDelta',
        params: {
          threadId: 'thread-1',
          turnId: 'turn-1',
          itemId: 'msg-1',
          delta: 'Analyzing requirement...',
        },
      }) + '\n'
    )

    // Simulate text delta
    mockProc.stdout.write(
      JSON.stringify({
        method: 'item/agentMessage/delta',
        params: {
          threadId: 'thread-1',
          turnId: 'turn-1',
          itemId: 'msg-1',
          delta: 'I will write the test.',
        },
      }) + '\n'
    )

    // Simulate item/completed
    mockProc.stdout.write(
      JSON.stringify({
        method: 'item/completed',
        params: {
          threadId: 'thread-1',
          turnId: 'turn-1',
          item: { type: 'agentMessage', id: 'msg-1', text: 'I will write the test.' },
        },
      }) + '\n'
    )

    expect(emittedEvents.length).toBe(4)

    const startedEvt = emittedEvents[0] as MessageStartedEvent
    expect(startedEvt.type).toBe('message.started')
    expect(startedEvt.messageId).toBe('msg-1')
    expect(startedEvt.role).toBe('assistant')

    const thinkingEvt = emittedEvents[1] as MessageDeltaEvent
    expect(thinkingEvt.type).toBe('message.delta')
    expect(thinkingEvt.messageId).toBe('msg-1')
    expect(thinkingEvt.deltaType).toBe('thinking')
    expect(thinkingEvt.content).toBe('Analyzing requirement...')

    const textEvt = emittedEvents[2] as MessageDeltaEvent
    expect(textEvt.type).toBe('message.delta')
    expect(textEvt.messageId).toBe('msg-1')
    expect(textEvt.deltaType).toBe('text')
    expect(textEvt.content).toBe('I will write the test.')

    const completedEvt = emittedEvents[3] as MessageCompletedEvent
    expect(completedEvt.type).toBe('message.completed')
    expect(completedEvt.messageId).toBe('msg-1')
    expect(completedEvt.fullContent).toBe('I will write the test.')
  })

  it('translates tool execution and tool deltas into tool events', async () => {
    adapter = new CodexAdapter(adapterOptions)

    mockProc.stdin.on('data', (chunk) => {
      const line = chunk.toString().trim()
      if (!line) return
      const req = JSON.parse(line)
      if (req.method === 'initialize') {
        mockProc.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: {} }) + '\n')
      } else if (req.method === 'thread/start') {
        mockProc.stdout.write(
          JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { thread: { id: 'thread-1' } } }) +
            '\n'
        )
      }
    })

    await adapter.start()

    // Tool started: commandExecution
    mockProc.stdout.write(
      JSON.stringify({
        method: 'item/started',
        params: {
          threadId: 'thread-1',
          turnId: 'turn-1',
          item: {
            type: 'commandExecution',
            id: 'tool-exec-1',
            command: 'npm test',
            cwd: '/mock/worktree',
          },
        },
      }) + '\n'
    )

    // Tool output delta
    mockProc.stdout.write(
      JSON.stringify({
        method: 'item/commandExecution/outputDelta',
        params: {
          threadId: 'thread-1',
          turnId: 'turn-1',
          itemId: 'tool-exec-1',
          delta: 'PASS src/index.test.ts\n',
        },
      }) + '\n'
    )

    // Tool completed
    mockProc.stdout.write(
      JSON.stringify({
        method: 'item/completed',
        params: {
          threadId: 'thread-1',
          turnId: 'turn-1',
          item: {
            type: 'commandExecution',
            id: 'tool-exec-1',
            command: 'npm test',
            exitCode: 0,
            aggregatedOutput: 'PASS src/index.test.ts\n',
          },
        },
      }) + '\n'
    )

    expect(emittedEvents.length).toBe(3)

    const toolStarted = emittedEvents[0] as ToolStartedEvent
    expect(toolStarted.type).toBe('tool.started')
    expect(toolStarted.toolCallId).toBe('tool-exec-1')
    expect(toolStarted.toolName).toBe('command_exec')
    expect((toolStarted.input as { command: string }).command).toBe('npm test')

    const toolDelta = emittedEvents[1] as ToolOutputDeltaEvent
    expect(toolDelta.type).toBe('tool.output.delta')
    expect(toolDelta.toolCallId).toBe('tool-exec-1')
    expect(toolDelta.delta).toBe('PASS src/index.test.ts\n')

    const toolCompleted = emittedEvents[2] as ToolCompletedEvent
    expect(toolCompleted.type).toBe('tool.completed')
    expect(toolCompleted.toolCallId).toBe('tool-exec-1')
    expect(toolCompleted.exitCode).toBe(0)
    expect(toolCompleted.isError).toBe(false)
  })

  it('handles server approval requests with namespaced approvalId and delivers "accept" decision', async () => {
    adapter = new CodexAdapter(adapterOptions)

    mockProc.stdin.on('data', (chunk) => {
      const line = chunk.toString().trim()
      if (!line) return
      const req = JSON.parse(line)
      if (req.method === 'initialize') {
        mockProc.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: {} }) + '\n')
      } else if (req.method === 'thread/start') {
        mockProc.stdout.write(
          JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { thread: { id: 'thread-1' } } }) +
            '\n'
        )
      }
    })

    await adapter.start()

    // Server sends approval request to client
    mockProc.stdout.write(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 99,
        method: 'item/commandExecution/requestApproval',
        params: {
          threadId: 'thread-1',
          turnId: 'turn-1',
          itemId: 'item-cmd-1',
          command: 'rm -rf dist',
          approvalId: 'appr-uuid-123',
          reason: 'Build cleanup',
        },
      }) + '\n'
    )

    const expectedNamespacedId = 'test-task-1-test-run-1-gen1-appr-uuid-123'

    // Verify permission.requested was emitted with namespaced approvalId
    const reqEvent = emittedEvents.find(
      (e): e is PermissionRequestedEvent => e.type === 'permission.requested'
    )
    expect(reqEvent).toBeDefined()
    expect(reqEvent?.approvalId).toBe(expectedNamespacedId)
    expect(reqEvent?.command).toBe('rm -rf dist')

    // Verify status changed to waiting_for_approval
    const waitStatus = emittedEvents.find(
      (e): e is AgentStatusChangedEvent =>
        e.type === 'agent.status.changed' && e.status === 'waiting_for_approval'
    )
    expect(waitStatus).toBeDefined()

    // Now resolve approval with allow -> maps to { decision: "accept" }
    let approvalResponseReceived: { id: number | string; result: { decision: unknown } } | null = null
    mockProc.stdin.on('data', (chunk) => {
      const line = chunk.toString().trim()
      if (!line) return
      const res = JSON.parse(line)
      if (res.id === 99) {
        approvalResponseReceived = res
      }
    })

    await adapter.resolveApproval(expectedNamespacedId, 'allow')

    expect(approvalResponseReceived).toBeDefined()
    expect(approvalResponseReceived!.id).toBe(99)
    expect((approvalResponseReceived!.result as { decision: unknown }).decision).toBe('accept')

    const stateChanged = emittedEvents.find(
      (e): e is PermissionStateChangedEvent => e.type === 'permission.state.changed'
    )
    expect(stateChanged).toBeDefined()
    expect(stateChanged?.approvalId).toBe(expectedNamespacedId)
    expect(stateChanged?.state).toBe('resolved')
    expect(stateChanged?.decision).toBe('allow')
  })

  it('handles rejection decision and delivers "decline" payload for item/* requests', async () => {
    adapter = new CodexAdapter(adapterOptions)

    mockProc.stdin.on('data', (chunk) => {
      const line = chunk.toString().trim()
      if (!line) return
      const req = JSON.parse(line)
      if (req.method === 'initialize') {
        mockProc.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: {} }) + '\n')
      } else if (req.method === 'thread/start') {
        mockProc.stdout.write(
          JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { thread: { id: 'thread-1' } } }) +
            '\n'
        )
      }
    })

    await adapter.start()

    mockProc.stdout.write(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 105,
        method: 'item/commandExecution/requestApproval',
        params: {
          threadId: 'thread-1',
          turnId: 'turn-1',
          itemId: 'item-cmd-2',
          command: 'dangerous-cmd',
          approvalId: 'appr-uuid-456',
        },
      }) + '\n'
    )

    const expectedNamespacedId = 'test-task-1-test-run-1-gen1-appr-uuid-456'

    let approvalResponseReceived: { id: number | string; result: { decision: unknown } } | null = null
    mockProc.stdin.on('data', (chunk) => {
      const line = chunk.toString().trim()
      if (!line) return
      const res = JSON.parse(line)
      if (res.id === 105) {
        approvalResponseReceived = res
      }
    })

    await adapter.resolveApproval(expectedNamespacedId, 'deny', 'Unauthorized command')

    expect(approvalResponseReceived).toBeDefined()
    expect(approvalResponseReceived!.id).toBe(105)
    expect((approvalResponseReceived!.result as { decision: unknown }).decision).toBe('decline')

    const stateChanged = emittedEvents.find(
      (e): e is PermissionStateChangedEvent =>
        e.type === 'permission.state.changed' && e.decision === 'deny'
    )
    expect(stateChanged).toBeDefined()
    expect(stateChanged?.state).toBe('resolved')
  })

  it('handles legacy execCommandApproval with approved and denied payloads', async () => {
    adapter = new CodexAdapter(adapterOptions)

    mockProc.stdin.on('data', (chunk) => {
      const line = chunk.toString().trim()
      if (!line) return
      const req = JSON.parse(line)
      if (req.method === 'initialize') {
        mockProc.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: {} }) + '\n')
      } else if (req.method === 'thread/start') {
        mockProc.stdout.write(
          JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { thread: { id: 'thread-1' } } }) +
            '\n'
        )
      }
    })

    await adapter.start()

    // Send legacy execCommandApproval
    mockProc.stdout.write(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 201,
        method: 'execCommandApproval',
        params: {
          command: 'legacy-deploy',
          approvalId: 'legacy-1',
        },
      }) + '\n'
    )

    let responsePayload: { id: number | string; result: { decision: unknown } } | null = null
    mockProc.stdin.on('data', (chunk) => {
      const line = chunk.toString().trim()
      if (!line) return
      const res = JSON.parse(line)
      if (res.id === 201) {
        responsePayload = res
      }
    })

    await adapter.resolveApproval('test-task-1-test-run-1-gen1-legacy-1', 'deny', 'Legacy rejection')

    expect(responsePayload).toBeDefined()
    expect(responsePayload!.result.decision).toEqual({
      denied: { rejection: 'Legacy rejection' },
    })
  })

  it('robustly handles fragmented chunks and multiple JSON lines in a single buffer', async () => {
    adapter = new CodexAdapter(adapterOptions)

    mockProc.stdin.on('data', (chunk) => {
      const line = chunk.toString().trim()
      if (!line) return
      const req = JSON.parse(line)
      if (req.method === 'initialize') {
        mockProc.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: {} }) + '\n')
      } else if (req.method === 'thread/start') {
        mockProc.stdout.write(
          JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { thread: { id: 'thread-1' } } }) +
            '\n'
        )
      }
    })

    await adapter.start()

    const line1 = JSON.stringify({
      method: 'item/agentMessage/delta',
      params: { threadId: 'thread-1', turnId: 'turn-1', itemId: 'm1', delta: 'Hello ' },
    })
    const line2 = JSON.stringify({
      method: 'item/agentMessage/delta',
      params: { threadId: 'thread-1', turnId: 'turn-1', itemId: 'm1', delta: 'world!' },
    })

    // Write part of line 1
    mockProc.stdout.write(line1.slice(0, 15))
    expect(emittedEvents.length).toBe(0)

    // Write rest of line 1 + newline + first 10 chars of line 2
    mockProc.stdout.write(line1.slice(15) + '\n' + line2.slice(0, 10))
    expect(emittedEvents.length).toBe(1)
    expect((emittedEvents[0] as MessageDeltaEvent).content).toBe('Hello ')

    // Write rest of line 2 + newline
    mockProc.stdout.write(line2.slice(10) + '\n')
    expect(emittedEvents.length).toBe(2)
    expect((emittedEvents[1] as MessageDeltaEvent).content).toBe('world!')
  })

  it('reassembles multi-byte UTF-8 sequences across chunk boundaries without corruption', async () => {
    adapter = new CodexAdapter(adapterOptions)

    mockProc.stdin.on('data', (chunk) => {
      const line = chunk.toString().trim()
      if (!line) return
      const req = JSON.parse(line)
      if (req.method === 'initialize') {
        mockProc.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: {} }) + '\n')
      } else if (req.method === 'thread/start') {
        mockProc.stdout.write(
          JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { thread: { id: 'thread-1' } } }) +
            '\n'
        )
      }
    })

    await adapter.start()

    // Cyrillic string: "Привет мир" (2-byte UTF-8 chars)
    const payload = JSON.stringify({
      method: 'item/agentMessage/delta',
      params: { threadId: 'thread-1', turnId: 'turn-1', itemId: 'utf-1', delta: 'Привет мир' },
    }) + '\n'

    const buffer = Buffer.from(payload, 'utf8')
    // Split right in the middle of the first Cyrillic character ('П' is 2 bytes: 0xd0 0x9f)
    // Find index of 0xd0 in buffer
    const splitIndex = buffer.indexOf(0xd0) + 1 // split between 0xd0 and 0x9f

    const chunk1 = buffer.subarray(0, splitIndex)
    const chunk2 = buffer.subarray(splitIndex)

    mockProc.stdout.write(chunk1)
    expect(emittedEvents.length).toBe(0)

    mockProc.stdout.write(chunk2)
    expect(emittedEvents.length).toBe(1)
    expect((emittedEvents[0] as MessageDeltaEvent).content).toBe('Привет мир')
  })

  it('deduplicates concurrent start calls and returns identical results', async () => {
    adapter = new CodexAdapter(adapterOptions)

    mockProc.stdin.on('data', (chunk) => {
      const line = chunk.toString().trim()
      if (!line) return
      const req = JSON.parse(line)
      if (req.method === 'initialize') {
        mockProc.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: {} }) + '\n')
      } else if (req.method === 'thread/start') {
        mockProc.stdout.write(
          JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { thread: { id: 'thread-dedup' } } }) +
            '\n'
        )
      }
    })

    const [res1, res2] = await Promise.all([adapter.start(), adapter.start()])
    expect(res1).toEqual(res2)
    expect(res1.threadId).toBe('thread-dedup')
  })

  it('emits raw.log events when emitRawLogEvents is true', async () => {
    adapter = new CodexAdapter({
      ...adapterOptions,
      emitRawLogEvents: true,
    })

    mockProc.stdin.on('data', (chunk) => {
      const line = chunk.toString().trim()
      if (!line) return
      const req = JSON.parse(line)
      if (req.method === 'initialize') {
        mockProc.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: {} }) + '\n')
      } else if (req.method === 'thread/start') {
        mockProc.stdout.write(
          JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { thread: { id: 'thread-1' } } }) +
            '\n'
        )
      }
    })

    await adapter.start()

    mockProc.stderr.write('some warning message\n')

    const rawStderr = emittedEvents.find(
      (e): e is RawLogEvent => e.type === 'raw.log' && e.stream === 'stderr'
    )
    expect(rawStderr).toBeDefined()
    expect(rawLogs.some((l) => l.stream === 'stderr' && l.line === 'some warning message')).toBe(
      true
    )
  })

  it('handles server error notifications by emitting agent error status', async () => {
    adapter = new CodexAdapter(adapterOptions)

    mockProc.stdin.on('data', (chunk) => {
      const line = chunk.toString().trim()
      if (!line) return
      const req = JSON.parse(line)
      if (req.method === 'initialize') {
        mockProc.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: {} }) + '\n')
      } else if (req.method === 'thread/start') {
        mockProc.stdout.write(
          JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { thread: { id: 'thread-1' } } }) +
            '\n'
        )
      }
    })

    await adapter.start()

    mockProc.stdout.write(
      JSON.stringify({
        method: 'error',
        params: { message: 'Rate limit exceeded' },
      }) + '\n'
    )

    const errEvent = emittedEvents.find(
      (e): e is AgentStatusChangedEvent => e.type === 'agent.status.changed' && e.status === 'error'
    )
    expect(errEvent).toBeDefined()
    expect(errEvent?.error).toContain('Rate limit exceeded')
  })

  it('handles dynamic and mcp tool calls correctly', async () => {
    adapter = new CodexAdapter(adapterOptions)

    mockProc.stdin.on('data', (chunk) => {
      const line = chunk.toString().trim()
      if (!line) return
      const req = JSON.parse(line)
      if (req.method === 'initialize') {
        mockProc.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: {} }) + '\n')
      } else if (req.method === 'thread/start') {
        mockProc.stdout.write(
          JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { thread: { id: 'thread-1' } } }) +
            '\n'
        )
      }
    })

    await adapter.start()

    // MCP tool start
    mockProc.stdout.write(
      JSON.stringify({
        method: 'item/started',
        params: {
          threadId: 'thread-1',
          turnId: 'turn-1',
          item: {
            type: 'mcpToolCall',
            id: 'mcp-tool-1',
            server: 'github',
            tool: 'create_issue',
            arguments: { title: 'Bug' },
          },
        },
      }) + '\n'
    )

    // MCP tool completed
    mockProc.stdout.write(
      JSON.stringify({
        method: 'item/completed',
        params: {
          threadId: 'thread-1',
          turnId: 'turn-1',
          item: {
            type: 'mcpToolCall',
            id: 'mcp-tool-1',
            status: 'completed',
            result: { issueNumber: 42 },
          },
        },
      }) + '\n'
    )

    const mcpStarted = emittedEvents.find(
      (e): e is ToolStartedEvent => e.type === 'tool.started' && e.toolCallId === 'mcp-tool-1'
    )
    expect(mcpStarted).toBeDefined()
    expect(mcpStarted?.toolName).toBe('github/create_issue')

    const mcpCompleted = emittedEvents.find(
      (e): e is ToolCompletedEvent => e.type === 'tool.completed' && e.toolCallId === 'mcp-tool-1'
    )
    expect(mcpCompleted).toBeDefined()
    expect(mcpCompleted?.isError).toBe(false)
  })

  it('gracefully handles stop() by interrupting active turn and killing process', async () => {
    adapter = new CodexAdapter(adapterOptions)

    let interruptReceived = false
    let stdinBuf = ''
    mockProc.stdin.on('data', (chunk) => {
      stdinBuf += chunk.toString()
      const lines = stdinBuf.split('\n')
      stdinBuf = lines.pop() || ''
      for (const rawLine of lines) {
        const line = rawLine.trim()
        if (!line) continue
        const req = JSON.parse(line)
        if (req.method === 'initialize') {
          mockProc.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: {} }) + '\n')
        } else if (req.method === 'thread/start') {
          mockProc.stdout.write(
            JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { thread: { id: 'thread-1' } } }) +
              '\n'
        )
        } else if (req.method === 'turn/start') {
          mockProc.stdout.write(
            JSON.stringify({
              jsonrpc: '2.0',
              id: req.id,
              result: { turn: { id: 'turn-999' } },
            }) + '\n'
          )
        } else if (req.method === 'turn/interrupt') {
          interruptReceived = true
          mockProc.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: {} }) + '\n')
        }
      }
    })

    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-1', text: 'Long running task' })

    expect(adapter.getActiveTurnId()).toBe('turn-999')

    await adapter.stop()
    expect(interruptReceived).toBe(true)
    expect(mockProc.killed).toBe(true)
  })

  it('escalates to SIGKILL if child process does not terminate on SIGTERM', async () => {
    const stubbornProc = new StubbornChildProcess()
    adapter = new CodexAdapter({
      ...adapterOptions,
      killTimeoutMs: 30, // Short timeout for test speed
      spawnProcess: () => stubbornProc as unknown as ReturnType<NonNullable<CodexAdapterOptions['spawnProcess']>>,
    })

    stubbornProc.stdin.on('data', (chunk) => {
      const line = chunk.toString().trim()
      if (!line) return
      const req = JSON.parse(line)
      if (req.method === 'initialize') {
        stubbornProc.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: {} }) + '\n')
      } else if (req.method === 'thread/start') {
        stubbornProc.stdout.write(
          JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { thread: { id: 'thread-1' } } }) +
            '\n'
        )
      }
    })

    await adapter.start()
    await adapter.stop()

    expect(stubbornProc.signalsReceived).toContain('SIGTERM')
    expect(stubbornProc.signalsReceived).toContain('SIGKILL')
    expect(stubbornProc.killed).toBe(true)
  })

  it('escalates to SIGKILL and only resolves stop() after confirmed exit when SIGKILL exit is delayed', async () => {
    class DelayedKillProc extends EventEmitter {
      pid = 77777
      stdin = new PassThrough()
      stdout = new PassThrough()
      stderr = new PassThrough()
      killed = false
      exitCode: number | null = null
      signalsReceived: (NodeJS.Signals | number)[] = []

      kill(signal: NodeJS.Signals | number = 'SIGTERM') {
        this.signalsReceived.push(signal)
        if (signal === 'SIGKILL') {
          this.killed = true
          // Delay exit after SIGKILL
          setTimeout(() => {
            this.exitCode = 137
            this.emit('exit', 137, 'SIGKILL')
          }, 30)
          return true
        }
        // Ignore SIGTERM completely
        return true
      }
    }

    const delayedKillProc = new DelayedKillProc()
    adapter = new CodexAdapter({
      ...adapterOptions,
      killTimeoutMs: 100,
      spawnProcess: () =>
        delayedKillProc as unknown as ReturnType<NonNullable<CodexAdapterOptions['spawnProcess']>>,
    })

    delayedKillProc.stdin.on('data', (chunk) => {
      const line = chunk.toString().trim()
      if (!line) return
      const req = JSON.parse(line)
      if (req.method === 'initialize') {
        delayedKillProc.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: {} }) + '\n')
      } else if (req.method === 'thread/start') {
        delayedKillProc.stdout.write(
          JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { thread: { id: 'thread-1' } } }) +
            '\n'
        )
      }
    })

    await adapter.start()

    let stopResolved = false
    const stopPromise = adapter.stop().then(() => {
      stopResolved = true
    })

    // At 110ms: SIGTERM timed out (100ms), SIGKILL was sent (at 100ms), delayed exit triggers at 100+30 = 130ms
    await new Promise((resolve) => setTimeout(resolve, 110))
    // stop() must NOT have resolved yet, and start() must reject
    expect(stopResolved).toBe(false)
    await expect(adapter.start()).rejects.toThrow(/adapter is currently stopping/i)

    await stopPromise
    expect(stopResolved).toBe(true)
    expect(delayedKillProc.signalsReceived).toContain('SIGTERM')
    expect(delayedKillProc.signalsReceived).toContain('SIGKILL')
    expect(delayedKillProc.killed).toBe(true)
    expect(adapter.getStatus()).toBe('stopped')
  })

  it('guards activeTurnId when turn/completed arrives before turn/start resolves', async () => {
    adapter = new CodexAdapter(adapterOptions)

    mockProc.stdin.on('data', (chunk) => {
      const line = chunk.toString().trim()
      if (!line) return
      const req = JSON.parse(line)
      if (req.method === 'initialize') {
        mockProc.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: {} }) + '\n')
      } else if (req.method === 'thread/start') {
        mockProc.stdout.write(
          JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { thread: { id: 'thread-1' } } }) +
            '\n'
        )
      } else if (req.method === 'turn/start') {
        // Send turn/completed notification before replying with result
        mockProc.stdout.write(
          JSON.stringify({
            method: 'turn/completed',
            params: { threadId: 'thread-1', turnId: 'fast-turn-1' },
          }) + '\n'
        )
        mockProc.stdout.write(
          JSON.stringify({
            jsonrpc: '2.0',
            id: req.id,
            result: { turnId: 'fast-turn-1' },
          }) + '\n'
        )
      }
    })

    await adapter.start()
    const res = await adapter.sendPrompt({ taskId: 'test-task-1', text: 'Fast turn' })
    expect(res.turnId).toBe('fast-turn-1')
    // Since turn/completed already arrived, activeTurnId should NOT remain set
    expect(adapter.getActiveTurnId()).toBeUndefined()
    expect(adapter.getStatus()).toBe('completed')
    expect(emittedEvents[emittedEvents.length - 1]).toMatchObject({
      type: 'agent.status.changed', scope: 'turn', turnId: 'fast-turn-1', status: 'completed',
    })
  })

  it('handles item/permissions/requestApproval returning permissions schema on allow and deny', async () => {
    adapter = new CodexAdapter(adapterOptions)

    mockProc.stdin.on('data', (chunk) => {
      const line = chunk.toString().trim()
      if (!line) return
      const req = JSON.parse(line)
      if (req.method === 'initialize') {
        mockProc.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: {} }) + '\n')
      } else if (req.method === 'thread/start') {
        mockProc.stdout.write(
          JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { thread: { id: 'thread-1' } } }) +
            '\n'
        )
      }
    })

    await adapter.start()

    // 1. Allow permissions request
    mockProc.stdout.write(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 301,
        method: 'item/permissions/requestApproval',
        params: {
          threadId: 'thread-1',
          approvalId: 'perm-allow',
          permissions: { network: true, filesystem: 'read' },
        },
      }) + '\n'
    )

    let allowResponse: { id: number | string; result: { permissions: unknown } } | null = null
    mockProc.stdin.on('data', (chunk) => {
      const line = chunk.toString().trim()
      if (!line) return
      const res = JSON.parse(line)
      if (res.id === 301) {
        allowResponse = res
      }
    })

    await adapter.resolveApproval('test-task-1-test-run-1-gen1-perm-allow', 'allow')
    expect(allowResponse).toBeDefined()
    expect(allowResponse!.result.permissions).toEqual({ network: true, filesystem: 'read' })

    // 2. Deny permissions request
    mockProc.stdout.write(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 302,
        method: 'item/permissions/requestApproval',
        params: {
          threadId: 'thread-1',
          approvalId: 'perm-deny',
          permissions: { fullAccess: true },
        },
      }) + '\n'
    )

    let denyResponse: { id: number | string; result: { permissions: unknown } } | null = null
    mockProc.stdin.on('data', (chunk) => {
      const line = chunk.toString().trim()
      if (!line) return
      const res = JSON.parse(line)
      if (res.id === 302) {
        denyResponse = res
      }
    })

    await adapter.resolveApproval('test-task-1-test-run-1-gen1-perm-deny', 'deny')
    expect(denyResponse).toBeDefined()
    expect(denyResponse!.result.permissions).toEqual({})
  })

  it('propagates write error on resolveApproval and keeps pending approval for retry', async () => {
    adapter = new CodexAdapter(adapterOptions)

    mockProc.stdin.on('data', (chunk) => {
      const line = chunk.toString().trim()
      if (!line) return
      const req = JSON.parse(line)
      if (req.method === 'initialize') {
        mockProc.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: {} }) + '\n')
      } else if (req.method === 'thread/start') {
        mockProc.stdout.write(
          JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { thread: { id: 'thread-1' } } }) +
            '\n'
        )
      }
    })

    await adapter.start()

    mockProc.stdout.write(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 401,
        method: 'item/commandExecution/requestApproval',
        params: {
          threadId: 'thread-1',
          approvalId: 'write-fail-appr',
          command: 'ls',
        },
      }) + '\n'
    )

    const expectedId = 'test-task-1-test-run-1-gen1-write-fail-appr'

    // Simulate broken pipe on stdin
    mockProc.stdin.write = vi.fn().mockImplementation((_data: string, cb?: (err: Error | null) => void) => {
      if (cb) cb(new Error('EPIPE: broken pipe'))
      return false
    })

    // resolveApproval must reject with the write error
    await expect(adapter.resolveApproval(expectedId, 'allow')).rejects.toThrow('EPIPE')

    // Verify approval was NOT deleted and can be resolved once pipe recovers
    let recoveredResponse: { id: number | string; result: { decision: unknown } } | null = null
    mockProc.stdin.write = vi.fn().mockImplementation((data: string, cb?: (err: Error | null) => void) => {
      recoveredResponse = JSON.parse(data.trim())
      if (cb) cb(null)
      return true
    })

    await adapter.resolveApproval(expectedId, 'allow')
    expect(recoveredResponse).toBeDefined()
    expect(recoveredResponse!.result.decision).toBe('accept')
  })

  it('cleans up on unsolicited process exit and allows fresh restart with cross-generation isolation', async () => {
    let processCount = 0
    const spawnedProcs: MockChildProcess[] = []

    adapter = new CodexAdapter({
      ...adapterOptions,
      spawnProcess: () => {
        processCount++
        const proc = new MockChildProcess()
        proc.pid = 1000 + processCount
        proc.stdin.on('data', (chunk) => {
          const line = chunk.toString().trim()
          if (!line) return
          const req = JSON.parse(line)
          if (req.method === 'initialize') {
            proc.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: {} }) + '\n')
          } else if (req.method === 'thread/start') {
            proc.stdout.write(
              JSON.stringify({
                jsonrpc: '2.0',
                id: req.id,
                result: { thread: { id: `thread-proc-${processCount}` } },
              }) + '\n'
            )
          }
        })
        spawnedProcs.push(proc)
        return proc as unknown as ReturnType<NonNullable<CodexAdapterOptions['spawnProcess']>>
      },
    })

    const start1 = await adapter.start()
    expect(start1.pid).toBe(1001)
    expect(start1.threadId).toBe('thread-proc-1')
    const proc1 = spawnedProcs[0]

    // Simulate approval request from proc1 and partial trailing stdout line
    proc1.stdout.write(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 777,
        method: 'item/commandExecution/requestApproval',
        params: { approvalId: 'appr-gen-1' },
      }) + '\n'
    )
    proc1.stdout.write('{"incomplete_json": true') // unclosed line in stdout buffer

    // Simulate unexpected process exit of proc1
    proc1.emit('exit', 1, 'SIGTERM')

    // Approval from proc1 should have been cleared, so resolveApproval throws
    await expect(
      adapter.resolveApproval('test-task-1-test-run-1-appr-gen-1', 'allow')
    ).rejects.toThrow(/not found or already resolved/i)

    // Second start spawns proc2 cleanly without corrupting initialization with leftover stdout buffer
    const start2 = await adapter.start()
    expect(start2.pid).toBe(1002)
    expect(start2.threadId).toBe('thread-proc-2')
    expect(processCount).toBe(2)

    // Simulate delayed exit from proc1 (older generation)
    proc1.emit('exit', 0, 'SIGKILL')

    // proc2 should remain healthy and active (fencing check)
    expect(adapter.getPid()).toBe(1002)
    expect(adapter.getThreadId()).toBe('thread-proc-2')
  })

  it('cleans prior process-scoped state before replacement and ignores late stdout from prior generation', async () => {
    let processCount = 0
    const spawnedProcs: MockChildProcess[] = []

    adapter = new CodexAdapter({
      ...adapterOptions,
      spawnProcess: () => {
        processCount++
        const proc = new MockChildProcess()
        proc.pid = 2000 + processCount
        proc.stdin.on('data', (chunk) => {
          const line = chunk.toString().trim()
          if (!line) return
          const req = JSON.parse(line)
          if (req.method === 'initialize') {
            proc.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: {} }) + '\n')
          } else if (req.method === 'thread/start') {
            proc.stdout.write(
              JSON.stringify({
                jsonrpc: '2.0',
                id: req.id,
                result: { thread: { id: `thread-p-${processCount}` } },
              }) + '\n'
            )
          }
        })
        spawnedProcs.push(proc)
        return proc as unknown as ReturnType<NonNullable<CodexAdapterOptions['spawnProcess']>>
      },
    })

    // 1. Start process 1
    await adapter.start()
    const proc1 = spawnedProcs[0]

    // Process 1 has a pending approval and partial buffer
    proc1.stdout.write(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 888,
        method: 'item/commandExecution/requestApproval',
        params: { approvalId: 'appr-proc-1' },
      }) + '\n'
    )
    proc1.stdout.write('{"dangling": true')

    // Mark proc1 as dead/killed WITHOUT emitting the 'exit' callback
    proc1.killed = true

    // 2. Start process 2 before process 1's exit callback ever fired
    const start2 = await adapter.start()
    expect(start2.pid).toBe(2002)
    expect(start2.threadId).toBe('thread-p-2')
    const proc2 = spawnedProcs[1]

    // Process 1's approval must have been cleaned up
    await expect(
      adapter.resolveApproval('test-task-1-test-run-1-appr-proc-1', 'allow')
    ).rejects.toThrow(/not found or already resolved/i)

    const eventsCountBeforeLateData = emittedEvents.length

    // 3. Inject late stdout from process 1 (e.g. late message delta and late approval)
    proc1.stdout.write(
      JSON.stringify({
        method: 'item/agentMessage/delta',
        params: { threadId: 'thread-p-1', turnId: 'turn-1', itemId: 'late-msg', delta: 'ghost text' },
      }) + '\n'
    )
    proc1.stdout.write(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 999,
        method: 'item/commandExecution/requestApproval',
        params: { approvalId: 'ghost-appr' },
      }) + '\n'
    )

    // Verify late data from proc1 is completely ignored by the adapter
    expect(emittedEvents.length).toBe(eventsCountBeforeLateData)
    expect(adapter.getPid()).toBe(2002)

    // 4. Inject delayed exit from process 1
    proc1.emit('exit', 1, 'SIGKILL')
    expect(adapter.getPid()).toBe(2002)

    // Process 2 continues functioning normally
    expect(proc2.killed).toBe(false)
  })

  it('generates distinct approvalIds across process generations avoiding collisions on repeated RPC IDs', async () => {
    let processCount = 0
    const spawnedProcs: MockChildProcess[] = []

    adapter = new CodexAdapter({
      ...adapterOptions,
      spawnProcess: () => {
        processCount++
        const proc = new MockChildProcess()
        proc.pid = 3000 + processCount
        proc.stdin.on('data', (chunk) => {
          const line = chunk.toString().trim()
          if (!line) return
          const req = JSON.parse(line)
          if (req.method === 'initialize') {
            proc.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: {} }) + '\n')
          } else if (req.method === 'thread/start') {
            proc.stdout.write(
              JSON.stringify({
                jsonrpc: '2.0',
                id: req.id,
                result: { thread: { id: `thread-gen-${processCount}` } },
              }) + '\n'
            )
          }
        })
        spawnedProcs.push(proc)
        return proc as unknown as ReturnType<NonNullable<CodexAdapterOptions['spawnProcess']>>
      },
    })

    // Generation 1
    await adapter.start()
    const proc1 = spawnedProcs[0]

    // Proc1 sends approval with RPC ID 1
    proc1.stdout.write(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'item/commandExecution/requestApproval',
        params: { command: 'echo gen1' },
      }) + '\n'
    )

    const gen1Event = emittedEvents.find(
      (e): e is PermissionRequestedEvent => e.type === 'permission.requested'
    )
    expect(gen1Event).toBeDefined()
    expect(gen1Event?.approvalId).toContain('gen1')
    const gen1ApprovalId = gen1Event!.approvalId

    // Crash proc1
    proc1.emit('exit', 1, 'SIGTERM')

    // Generation 2: server restarts and repeats RPC ID 1
    await adapter.start()
    const proc2 = spawnedProcs[1]

    let gen2ResponseReceived: { id: number | string; result: { decision: unknown } } | null = null
    proc2.stdin.on('data', (chunk) => {
      const line = chunk.toString().trim()
      if (!line) return
      const res = JSON.parse(line)
      if (res.id === 1) {
        gen2ResponseReceived = res
      }
    })

    proc2.stdout.write(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'item/commandExecution/requestApproval',
        params: { command: 'echo gen2' },
      }) + '\n'
    )

    const permEvents = emittedEvents.filter(
      (e): e is PermissionRequestedEvent => e.type === 'permission.requested'
    )
    const gen2Event = permEvents[permEvents.length - 1]
    expect(gen2Event.approvalId).toContain('gen2')
    const gen2ApprovalId = gen2Event.approvalId

    expect(gen1ApprovalId).not.toBe(gen2ApprovalId)

    // Stale resolution using gen1 approvalId must fail
    await expect(adapter.resolveApproval(gen1ApprovalId, 'allow')).rejects.toThrow(
      /not found or already resolved/i
    )
    expect(gen2ResponseReceived).toBeNull()

    // Valid resolution using gen2 approvalId succeeds
    await adapter.resolveApproval(gen2ApprovalId, 'allow')
    expect(gen2ResponseReceived).toBeDefined()
    expect(gen2ResponseReceived!.id).toBe(1)
  })

  it('absorbs late stdin and process error events on terminated process without unhandled crash', async () => {
    adapter = new CodexAdapter(adapterOptions)

    mockProc.stdin.on('data', (chunk) => {
      const line = chunk.toString().trim()
      if (!line) return
      const req = JSON.parse(line)
      if (req.method === 'initialize') {
        mockProc.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: {} }) + '\n')
      } else if (req.method === 'thread/start') {
        mockProc.stdout.write(
          JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { thread: { id: 'thread-1' } } }) +
            '\n'
        )
      }
    })

    await adapter.start()

    // Stop adapter
    await adapter.stop()

    // Emit delayed late errors on retired process streams
    expect(() => {
      mockProc.stdin.emit('error', new Error('Late EPIPE on dead stdin'))
      mockProc.emit('error', new Error('Late process error'))
    }).not.toThrow()
  })

  it('allows start() after stop(), resetting status to idle and spawning new process', async () => {
    let procCount = 0
    adapter = new CodexAdapter({
      ...adapterOptions,
      spawnProcess: () => {
        procCount++
        const proc = new MockChildProcess()
        proc.pid = 20000 + procCount
        proc.stdin.on('data', (chunk) => {
          const line = chunk.toString().trim()
          if (!line) return
          const req = JSON.parse(line)
          if (req.method === 'initialize') {
            proc.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: {} }) + '\n')
          } else if (req.method === 'thread/start') {
            proc.stdout.write(
              JSON.stringify({
                jsonrpc: '2.0',
                id: req.id,
                result: { thread: { id: `thread-${procCount}` } },
              }) + '\n'
            )
          }
        })
        return proc as unknown as ReturnType<NonNullable<CodexAdapterOptions['spawnProcess']>>
      },
    })

    const first = await adapter.start()
    expect(first.pid).toBe(20001)
    expect(first.threadId).toBe('thread-1')
    expect(adapter.getStatus()).toBe('idle')

    await adapter.stop()
    expect(adapter.getStatus()).toBe('stopped')

    const second = await adapter.start()
    expect(second.pid).toBe(20002)
    expect(second.threadId).toBe('thread-2')
    expect(adapter.getStatus()).toBe('idle')
  })

  it('rejects start() if adapter is currently stopping during delayed process exit', async () => {
    class DelayedExitProc extends MockChildProcess {
      override kill(signal: NodeJS.Signals | number = 'SIGTERM') {
        this.killed = true
        setTimeout(() => {
          this.emit('exit', 0, signal)
        }, 80)
        return true
      }
    }

    const delayedProc = new DelayedExitProc()
    delayedProc.stdin.on('data', (chunk) => {
      const line = chunk.toString().trim()
      if (!line) return
      const req = JSON.parse(line)
      if (req.method === 'initialize') {
        delayedProc.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: {} }) + '\n')
      } else if (req.method === 'thread/start') {
        delayedProc.stdout.write(
          JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { thread: { id: 'thread-1' } } }) +
            '\n'
        )
      }
    })

    adapter = new CodexAdapter({
      ...adapterOptions,
      spawnProcess: () =>
        delayedProc as unknown as ReturnType<NonNullable<CodexAdapterOptions['spawnProcess']>>,
    })

    await adapter.start()

    const stopPromise = adapter.stop()
    await expect(adapter.start()).rejects.toThrow(/adapter is currently stopping/i)

    await stopPromise
    expect(adapter.getStatus()).toBe('stopped')
  })

  it('resets status to idle when calling start() with live process after error', async () => {
    mockProc.stdin.on('data', (chunk) => {
      const line = chunk.toString().trim()
      if (!line) return
      const req = JSON.parse(line)
      if (req.method === 'initialize') {
        mockProc.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: {} }) + '\n')
      } else if (req.method === 'thread/start') {
        mockProc.stdout.write(
          JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { thread: { id: 'thread-1' } } }) +
            '\n'
        )
      }
    })

    adapter = new CodexAdapter(adapterOptions)
    await adapter.start()
    expect(adapter.getStatus()).toBe('idle')

    ;(adapter as unknown as { currentStatus: string }).currentStatus = 'error'
    expect(adapter.getStatus()).toBe('error')

    await adapter.start()
    expect(adapter.getStatus()).toBe('idle')
  })

  it('emits error status and rejects start() when spawn throws synchronously', async () => {
    adapter = new CodexAdapter({
      ...adapterOptions,
      spawnProcess: () => {
        throw new Error('spawn ENOENT: codex not found')
      },
    })

    await expect(adapter.start()).rejects.toThrow('spawn ENOENT: codex not found')
    expect(adapter.getStatus()).toBe('error')
    const errEvent = emittedEvents.find(
      (e) => e.type === 'agent.status.changed' && (e as AgentStatusChangedEvent).status === 'error'
    ) as AgentStatusChangedEvent
    expect(errEvent).toBeDefined()
    expect(errEvent.error).toContain('spawn ENOENT')
  })

  it('emits error status if process exits with code 0 while active turn is running', async () => {
    mockProc.stdin.on('data', (chunk) => {
      const line = chunk.toString().trim()
      if (!line) return
      const req = JSON.parse(line)
      if (req.method === 'initialize') {
        mockProc.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: {} }) + '\n')
      } else if (req.method === 'thread/start') {
        mockProc.stdout.write(
          JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { thread: { id: 'thread-1' } } }) +
            '\n'
        )
      } else if (req.method === 'turn/start') {
        mockProc.stdout.write(
          JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { turn: { id: 'turn-1' } } }) + '\n'
        )
      }
    })

    adapter = new CodexAdapter(adapterOptions)
    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-1', text: 'Hello' })

    // Simulate clean exit before turn completed
    mockProc.emit('exit', 0, null)
    mockProc.emit('close', 0, null)
    expect(adapter.getStatus()).toBe('error')
    const exitError = emittedEvents.find(
      (e) =>
        e.type === 'agent.status.changed' &&
        (e as AgentStatusChangedEvent).error?.includes('before active turn completed')
    )
    expect(exitError).toBeDefined()
  })

  it('emits error status if process exits with code 0 while turn/start RPC is pending', async () => {
    mockProc.stdin.on('data', (chunk) => {
      const line = chunk.toString().trim()
      if (!line) return
      const req = JSON.parse(line)
      if (req.method === 'initialize') {
        mockProc.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: {} }) + '\n')
      } else if (req.method === 'thread/start') {
        mockProc.stdout.write(
          JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { thread: { id: 'thread-1' } } }) +
            '\n'
        )
      }
      // Do not respond to turn/start - leave it pending
    })

    adapter = new CodexAdapter(adapterOptions)
    await adapter.start()
    const promptPromise = adapter.sendPrompt({ taskId: 'test-task-1', text: 'Hello' })

    // Simulate clean exit 0 while turn/start is in flight
    mockProc.emit('exit', 0, null)
    mockProc.emit('close', 0, null)

    await expect(promptPromise).rejects.toThrow()
    expect(adapter.getStatus()).toBe('error')

    const exitError = emittedEvents.find(
      (e) =>
        e.type === 'agent.status.changed' &&
        (e as AgentStatusChangedEvent).error?.includes('before active turn completed')
    )
    expect(exitError).toBeDefined()

    const completedEvts = emittedEvents.filter(
      (e) => e.type === 'agent.status.changed' && (e as AgentStatusChangedEvent).status === 'completed'
    )
    expect(completedEvts.length).toBe(0)
  })

  it('reports session loss separately after a turn interruption', async () => {
    mockProc.stdin.on('data', (chunk) => {
      const line = chunk.toString().trim()
      if (!line) return
      const req = JSON.parse(line)
      if (req.method === 'initialize') {
        mockProc.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: {} }) + '\n')
      } else if (req.method === 'thread/start') {
        mockProc.stdout.write(
          JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { thread: { id: 'thread-1' } } }) +
            '\n'
        )
      } else if (req.method === 'turn/start') {
        mockProc.stdout.write(
          JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { turn: { id: 'turn-1' } } }) + '\n'
        )
      }
    })

    adapter = new CodexAdapter(adapterOptions)
    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-1', text: 'Hello' })

    // Emit turn/completed with status: interrupted
    mockProc.stdout.write(
      JSON.stringify({
        jsonrpc: '2.0',
        method: 'turn/completed',
        params: { turn: { id: 'turn-1', status: 'interrupted' } },
      }) + '\n'
    )

    expect(adapter.getStatus()).toBe('stopped')

    // The turn remains interrupted, but the session is now unavailable.
    mockProc.emit('exit', 0, null)
    mockProc.emit('close', 0, null)
    expect(adapter.getStatus()).toBe('error')
    expect(emittedEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'agent.status.changed', scope: 'turn', turnId: 'turn-1', status: 'stopped' }),
      expect.objectContaining({ type: 'agent.status.changed', scope: 'session', status: 'error' }),
    ]))

    const completedEvts = emittedEvents.filter(
      (e) => e.type === 'agent.status.changed' && (e as AgentStatusChangedEvent).status === 'completed'
    )
    expect(completedEvts.length).toBe(0)
  })

  it('does not overwrite terminal error status with completed when exit code is 0', async () => {
    mockProc.stdin.on('data', (chunk) => {
      const line = chunk.toString().trim()
      if (!line) return
      const req = JSON.parse(line)
      if (req.method === 'initialize') {
        mockProc.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: {} }) + '\n')
      } else if (req.method === 'thread/start') {
        mockProc.stdout.write(
          JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { thread: { id: 'thread-1' } } }) +
            '\n'
        )
      } else if (req.method === 'turn/start') {
        mockProc.stdout.write(
          JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { turn: { id: 'turn-1' } } }) + '\n'
        )
      }
    })

    adapter = new CodexAdapter(adapterOptions)
    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-1', text: 'Hello' })

    // Emit turn/completed with error
    mockProc.stdout.write(
      JSON.stringify({
        jsonrpc: '2.0',
        method: 'turn/completed',
        params: { turn: { id: 'turn-1', status: 'failed', error: 'Model out of tokens' } },
      }) + '\n'
    )

    expect(adapter.getStatus()).toBe('error')

    // Now emit exit 0
    mockProc.emit('exit', 0, null)
    mockProc.emit('close', 0, null)
    expect(adapter.getStatus()).toBe('error')
    const completedEvts = emittedEvents.filter(
      (e) => e.type === 'agent.status.changed' && (e as AgentStatusChangedEvent).status === 'completed'
    )
    expect(completedEvts.length).toBe(0)
  })

  it('discards oversized stdout/stderr lines exceeding maxLineBufferBytes and recovers', async () => {
    mockProc.stdin.on('data', (chunk) => {
      const line = chunk.toString().trim()
      if (!line) return
      const req = JSON.parse(line)
      if (req.method === 'initialize') {
        mockProc.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: {} }) + '\n')
      } else if (req.method === 'thread/start') {
        mockProc.stdout.write(
          JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { thread: { id: 'thread-1' } } }) +
            '\n'
        )
      }
    })

    adapter = new CodexAdapter({
      ...adapterOptions,
      maxLineBufferBytes: 200,
    })

    await adapter.start()

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    // Send 500-byte line with newline to stdout -> triggers buffer overflow & discard
    mockProc.stdout.write('X'.repeat(500) + '\n')
    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/oversized line discarded/i))

    // Valid JSON-RPC line afterwards should still be parsed normally
    mockProc.stdout.write(
      JSON.stringify({
        jsonrpc: '2.0',
        method: 'item/agentMessage/delta',
        params: {
          itemId: 'item-rec-1',
          delta: 'Recovered message',
        },
      }) + '\n'
    )

    const deltaEvent = emittedEvents.find(
      (e) => e.type === 'message.delta' && (e as MessageDeltaEvent).content === 'Recovered message'
    )
    expect(deltaEvent).toBeDefined()
    warnSpy.mockRestore()
  })

  it('rejects concurrent or overlapping sendPrompt calls before emitting running status', async () => {
    let turnResolve: (() => void) | undefined
    mockProc.stdin.on('data', (chunk) => {
      const line = chunk.toString().trim()
      if (!line) return
      const req = JSON.parse(line)
      if (req.method === 'initialize') {
        mockProc.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: {} }) + '\n')
      } else if (req.method === 'thread/start') {
        mockProc.stdout.write(
          JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { thread: { id: 'thread-1' } } }) +
            '\n'
        )
      } else if (req.method === 'turn/start') {
        turnResolve = () => {
          mockProc.stdout.write(
            JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { turn: { id: 'turn-1' } } }) +
              '\n'
          )
        }
      }
    })

    adapter = new CodexAdapter(adapterOptions)
    await adapter.start()

    // 1. First prompt starts turn
    const promptPromise1 = adapter.sendPrompt({ taskId: 'test-task-1', text: 'First' })

    // 2. Second prompt immediately attempted concurrently while turn/start is in flight
    await expect(
      adapter.sendPrompt({ taskId: 'test-task-1', text: 'Second concurrent' })
    ).rejects.toThrow(/a turn is already in progress/)

    // Release turn 1
    turnResolve?.()
    const res1 = await promptPromise1
    expect(res1.turnId).toBe('turn-1')

    // 3. Third prompt while turn 1 is active (before turn/completed)
    await expect(
      adapter.sendPrompt({ taskId: 'test-task-1', text: 'Third overlapping' })
    ).rejects.toThrow(/a turn is already in progress/)
  })

  it('drains buffered stdout stream records before evaluating exit status', async () => {
    mockProc.stdin.on('data', (chunk) => {
      const line = chunk.toString().trim()
      if (!line) return
      const req = JSON.parse(line)
      if (req.method === 'initialize') {
        mockProc.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: {} }) + '\n')
      } else if (req.method === 'thread/start') {
        mockProc.stdout.write(
          JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { thread: { id: 'thread-1' } } }) +
            '\n'
        )
      } else if (req.method === 'turn/start') {
        mockProc.stdout.write(
          JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { turn: { id: 'turn-1' } } }) +
            '\n'
        )
      }
    })

    adapter = new CodexAdapter(adapterOptions)
    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-1', text: 'Hello' })

    // Write completion to stdout buffer right before exit
    mockProc.stdout.write(
      JSON.stringify({
        jsonrpc: '2.0',
        method: 'turn/completed',
        params: { turn: { id: 'turn-1', status: 'completed' } },
      }) + '\n'
    )

    // Emit exit 0
    mockProc.emit('exit', 0, null)
    mockProc.emit('close', 0, null)

    expect(adapter.getStatus()).toBe('error')
    const completedEvent = emittedEvents.find(
      (e) => e.type === 'agent.status.changed' && (e as AgentStatusChangedEvent).status === 'completed'
    )
    expect(completedEvent).toBeDefined()
  })

  it('retains process reference across stop timeout and late exit clears isStopping', async () => {
    class StubbornProc extends EventEmitter {
      pid = 99123
      stdin = new PassThrough()
      stdout = new PassThrough()
      stderr = new PassThrough()
      exitCode: number | null = null
      signalCode: string | null = null
      killCalls: string[] = []

      kill(sig: NodeJS.Signals | number = 'SIGTERM') {
        this.killCalls.push(String(sig))
        // Do NOT emit exit immediately
        return true
      }
    }

    const stubborn = new StubbornProc()
    stubborn.stdin.on('data', (chunk) => {
      const req = JSON.parse(chunk.toString().trim())
      if (req.method === 'initialize') {
        stubborn.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: {} }) + '\n')
      } else if (req.method === 'thread/start') {
        stubborn.stdout.write(
          JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { thread: { id: 'thread-1' } } }) +
            '\n'
        )
      }
    })

    adapter = new CodexAdapter({
      ...adapterOptions,
      killTimeoutMs: 50,
      spawnProcess: () => stubborn as unknown as import('child_process').ChildProcess,
    })

    await adapter.start()
    expect(adapter.getPid()).toBe(99123)

    // stop(false) should fail because process refuses to exit
    await expect(adapter.stop(false)).rejects.toThrow(/Failed to terminate process 99123/i)

    // Process reference must be retained!
    expect(adapter.getPid()).toBe(99123)

    // Calling stop(true) re-uses the process reference to attempt force termination
    const forceStopPromise = adapter.stop(true)

    // Simulate process finally exiting
    stubborn.emit('exit', 0, 'SIGKILL')
    stubborn.emit('close', 0, 'SIGKILL')

    await forceStopPromise

    // After exit confirmed, process reference is cleared
    expect(adapter.getPid()).toBeUndefined()
    expect(adapter.getStatus()).toBe('stopped')
  })

  it('refuses to spawn new generation if previous generation fails to terminate on SIGKILL', async () => {
    class UnkillableProc extends EventEmitter {
      pid = 77123
      stdin = new PassThrough()
      stdout = new PassThrough()
      stderr = new PassThrough()
      exitCode: number | null = null
      signalCode: string | null = null

      kill() {
        // Refuse to exit
        return true
      }
    }

    let spawnCount = 0
    const initializeShouldFail = true
    const unkillable = new UnkillableProc()
    unkillable.stdin.on('data', (chunk) => {
      const line = chunk.toString().trim()
      if (!line) return
      const req = JSON.parse(line)
      if (req.method === 'initialize') {
        if (initializeShouldFail) {
          unkillable.stdout.write(
            JSON.stringify({
              jsonrpc: '2.0',
              id: req.id,
              error: { code: -32600, message: 'Init failed' },
            }) + '\n'
          )
        } else {
          unkillable.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: {} }) + '\n')
        }
      } else if (req.method === 'thread/start') {
        unkillable.stdout.write(
          JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { thread: { id: 'thread-1' } } }) +
            '\n'
        )
      }
    })

    adapter = new CodexAdapter({
      ...adapterOptions,
      killTimeoutMs: 50,
      spawnProcess: () => {
        spawnCount++
        return unkillable as unknown as import('child_process').ChildProcess
      },
    })

    // First start fails on initialize handshake
    await expect(adapter.start()).rejects.toThrow(/Init failed/i)
    expect(spawnCount).toBe(1)
    expect(adapter.getPid()).toBe(77123)

    // Second start() must attempt to terminate unkillable and fail, NOT spawn a second process
    await expect(adapter.start()).rejects.toThrow(/Failed to terminate process 77123 after SIGKILL timeout/i)
    expect(spawnCount).toBe(1)
    expect(adapter.getPid()).toBe(77123)
  })

  it('preserves stream data arriving between exit and close without premature failure', async () => {
    mockProc.stdin.on('data', (chunk) => {
      const line = chunk.toString().trim()
      if (!line) return
      const req = JSON.parse(line)
      if (req.method === 'initialize') {
        mockProc.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: {} }) + '\n')
      } else if (req.method === 'thread/start') {
        mockProc.stdout.write(
          JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { thread: { id: 'thread-1' } } }) +
            '\n'
        )
      } else if (req.method === 'turn/start') {
        mockProc.stdout.write(
          JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { turn: { id: 'turn-1' } } }) + '\n'
        )
      }
    })

    adapter = new CodexAdapter(adapterOptions)
    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-1', text: 'Hello' })

    // 1. Process exit occurs first
    mockProc.emit('exit', 0, null)

    // 2. Final stdout events arrive AFTER exit but BEFORE close
    mockProc.stdout.write(
      JSON.stringify({
        jsonrpc: '2.0',
        method: 'item/agentMessage/delta',
        params: { itemId: 'item-final', delta: 'Final words between exit and close' },
      }) + '\n'
    )
    mockProc.stdout.write(
      JSON.stringify({
        jsonrpc: '2.0',
        method: 'turn/completed',
        params: { turn: { id: 'turn-1', status: 'completed' } },
      }) + '\n'
    )

    // 3. Close occurs after stream data has arrived
    mockProc.emit('close', 0, null)

    // Must receive the delta emitted between exit and close
    const deltaEvt = emittedEvents.find(
      (e) =>
        e.type === 'message.delta' &&
        (e as MessageDeltaEvent).content === 'Final words between exit and close'
    )
    expect(deltaEvt).toBeDefined()

    // Keep the successful turn event while reporting that the session exited.
    expect(adapter.getStatus()).toBe('error')
    const completedEvt = emittedEvents.find(
      (e) => e.type === 'agent.status.changed' && (e as AgentStatusChangedEvent).status === 'completed'
    )
    expect(completedEvt).toBeDefined()
  })

  it('does not duplicate delta events on stdout chunk delivery', async () => {
    mockProc.stdin.on('data', (chunk) => {
      const line = chunk.toString().trim()
      if (!line) return
      const req = JSON.parse(line)
      if (req.method === 'initialize') {
        mockProc.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: {} }) + '\n')
      } else if (req.method === 'thread/start') {
        mockProc.stdout.write(
          JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { thread: { id: 'thread-1' } } }) +
            '\n'
        )
      } else if (req.method === 'turn/start') {
        mockProc.stdout.write(
          JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { turn: { id: 'turn-1' } } }) + '\n'
        )
      }
    })

    adapter = new CodexAdapter(adapterOptions)
    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-1', text: 'Hello' })

    // Send single delta
    mockProc.stdout.write(
      JSON.stringify({
        jsonrpc: '2.0',
        method: 'item/agentMessage/delta',
        params: { itemId: 'item-1', delta: 'unique-token-xyz' },
      }) + '\n'
    )

    mockProc.stdout.write(
      JSON.stringify({
        jsonrpc: '2.0',
        method: 'turn/completed',
        params: { turn: { id: 'turn-1', status: 'completed' } },
      }) + '\n'
    )

    mockProc.emit('exit', 0, null)
    mockProc.emit('close', 0, null)

    const matchingDeltas = emittedEvents.filter(
      (e) =>
        e.type === 'message.delta' &&
        (e as MessageDeltaEvent).content === 'unique-token-xyz'
    )
    expect(matchingDeltas.length).toBe(1)
  })

  it('aborts pending start() when stop(true) is invoked during old process termination and does not spawn new process', async () => {
    let spawnCount = 0
    let proc1: MockChildProcess | undefined
    let proc2Spawned = false

    adapter = new CodexAdapter({
      ...adapterOptions,
      spawnProcess: () => {
        spawnCount++
        if (spawnCount === 1) {
          proc1 = new MockChildProcess()
          proc1.pid = 4101
          // Fail initialize to leave old process hanging in termination
          proc1.stdin.on('data', (chunk) => {
            const line = chunk.toString().trim()
            if (!line) return
            const req = JSON.parse(line)
            if (req.method === 'initialize') {
              proc1!.stdout.write(
                JSON.stringify({ jsonrpc: '2.0', id: req.id, error: { message: 'Initialization failed' } }) + '\n'
              )
            }
          })
          // On SIGKILL, do not emit exit immediately to simulate delayed exit
          proc1.kill = () => {
            proc1!.killed = true
            return true
          }
          return proc1 as unknown as import('child_process').ChildProcess
        } else {
          proc2Spawned = true
          const proc2 = new MockChildProcess()
          proc2.pid = 4102
          return proc2 as unknown as import('child_process').ChildProcess
        }
      },
    })

    // 1. Initial start fails due to initialize error
    await expect(adapter.start()).rejects.toThrow('Initialization failed')
    expect(proc1).toBeDefined()
    expect(proc1?.killed).toBe(true)

    // 2. Second start begins and awaits termination of proc1
    const start2Promise = adapter.start()

    // 3. While second start is awaiting old process kill, stop(true) is called
    const stopPromise = adapter.stop(true)

    // 4. Now simulate old process finally exiting
    proc1!.emit('exit', 0, 'SIGKILL')
    proc1!.emit('close', 0, 'SIGKILL')

    // 5. stop(true) should resolve cleanly
    await stopPromise

    // 6. start2 should be rejected due to cancellation
    await expect(start2Promise).rejects.toThrow(/adapter was stopped during startup/i)

    // 7. Critical: No second process was spawned, pid is undefined, status is stopped
    expect(proc2Spawned).toBe(false)
    expect(adapter.getPid()).toBeUndefined()
    expect(adapter.getStatus()).toBe('stopped')
  })

  it('preserves stream data arriving 80ms after exit but before close', async () => {
    mockProc.stdin.on('data', (chunk) => {
      const line = chunk.toString().trim()
      if (!line) return
      const req = JSON.parse(line)
      if (req.method === 'initialize') {
        mockProc.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: {} }) + '\n')
      } else if (req.method === 'thread/start') {
        mockProc.stdout.write(
          JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { thread: { id: 'thread-1' } } }) +
            '\n'
        )
      } else if (req.method === 'turn/start') {
        mockProc.stdout.write(
          JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { turn: { id: 'turn-1' } } }) + '\n'
        )
      }
    })

    adapter = new CodexAdapter(adapterOptions)
    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-1', text: 'Hello' })

    // 1. Process exit occurs first
    mockProc.emit('exit', 0, null)

    // 2. Wait 85ms (well over the old 50ms premature timer) before stream data arrives
    await new Promise((resolve) => setTimeout(resolve, 85))

    // 3. Final stdout events arrive 85ms after exit but before close
    mockProc.stdout.write(
      JSON.stringify({
        jsonrpc: '2.0',
        method: 'item/agentMessage/delta',
        params: { itemId: 'item-delayed', delta: 'Message arriving 85ms post-exit' },
      }) + '\n'
    )
    mockProc.stdout.write(
      JSON.stringify({
        jsonrpc: '2.0',
        method: 'turn/completed',
        params: { turn: { id: 'turn-1', status: 'completed' } },
      }) + '\n'
    )

    // 4. Close occurs after stream data has arrived
    mockProc.emit('close', 0, null)

    // Must receive the delta emitted 85ms after exit
    const deltaEvt = emittedEvents.find(
      (e) =>
        e.type === 'message.delta' &&
        (e as MessageDeltaEvent).content === 'Message arriving 85ms post-exit'
    )
    expect(deltaEvt).toBeDefined()

    // Keep the successful turn event while reporting that the session exited.
    expect(adapter.getStatus()).toBe('error')
    const completedEvt = emittedEvents.find(
      (e) => e.type === 'agent.status.changed' && (e as AgentStatusChangedEvent).status === 'completed'
    )
    expect(completedEvt).toBeDefined()
    expect(adapter.getPid()).toBeUndefined()
  })

  it('terminates newly spawned process on stop(false) after restart (start -> stop -> start -> stop cycle)', async () => {
    let spawnCount = 0
    const spawnedProcs: MockChildProcess[] = []

    adapter = new CodexAdapter({
      ...adapterOptions,
      killTimeoutMs: 100,
      spawnProcess: () => {
        spawnCount++
        const proc = new MockChildProcess()
        proc.pid = 5000 + spawnCount
        spawnedProcs.push(proc)

        proc.stdin.on('data', (chunk) => {
          const line = chunk.toString().trim()
          if (!line) return
          const req = JSON.parse(line)
          if (req.method === 'initialize') {
            proc.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: {} }) + '\n')
          } else if (req.method === 'thread/start') {
            proc.stdout.write(
              JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { thread: { id: `thread-${proc.pid}` } } }) +
                '\n'
            )
          }
        })

        // On SIGTERM, asynchronously exit to simulate a real process
        proc.kill = (sig = 'SIGTERM') => {
          if (sig === 'SIGTERM') {
            setTimeout(() => {
              proc.killed = true
              proc.exitCode = 0
              proc.emit('exit', 0, 'SIGTERM')
              proc.emit('close', 0, 'SIGTERM')
            }, 30)
            return true
          } else if (sig === 'SIGKILL') {
            proc.killed = true
            proc.exitCode = 137
            proc.emit('exit', 137, 'SIGKILL')
            proc.emit('close', 137, 'SIGKILL')
            return true
          }
          return true
        }

        return proc as unknown as import('child_process').ChildProcess
      },
    })

    // Cycle 1: start() -> stop(false)
    const start1 = await adapter.start()
    expect(start1.pid).toBe(5001)
    const proc1 = spawnedProcs[0]

    await adapter.stop(false)
    expect(proc1.killed).toBe(true)
    expect(adapter.getPid()).toBeUndefined()
    expect(adapter.getStatus()).toBe('stopped')

    // Cycle 2: start() -> stop(false)
    const start2 = await adapter.start()
    expect(start2.pid).toBe(5002)
    const proc2 = spawnedProcs[1]
    expect(proc2.killed).toBe(false)

    // Stop 2 MUST send SIGTERM to proc2 and wait for its termination
    await adapter.stop(false)
    expect(proc2.killed).toBe(true)
    expect(adapter.getPid()).toBeUndefined()
    expect(adapter.getStatus()).toBe('stopped')
  })
})
