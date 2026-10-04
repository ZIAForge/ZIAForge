import { afterEach, describe, expect, it, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import type { ChildProcess } from 'node:child_process'
import { ClaudeAdapter, type ClaudeAdapterOptions } from '../ClaudeAdapter'
import type { AgentEvent } from '../../../shared/agent-events'
import type { ProcessSupervisor } from '../../runtime/ProcessSupervisor'

class ClaudeProcess extends EventEmitter {
  pid = 10123
  stdin = new PassThrough()
  stdout = new PassThrough()
  stderr = new PassThrough()
  exitCode: number | null = null
  signalCode: NodeJS.Signals | null = null
  records: Array<Record<string, any>> = [] // eslint-disable-line @typescript-eslint/no-explicit-any
  initialize = true
  interrupt = true
  constructor() {
    super()
    this.stdin.on('data', chunk => {
      const record = JSON.parse(String(chunk))
      this.records.push(record)
      if (record.type === 'control_request' && ((record.request.subtype === 'initialize' && this.initialize) || (record.request.subtype === 'interrupt' && this.interrupt))) this.ack(record.request_id)
    })
  }
  emitRecord(record: unknown, newline = true) { this.stdout.write(JSON.stringify(record) + (newline ? '\n' : '')) }
  ack(requestId: string, error?: string) { this.emitRecord({ type: 'control_response', response: { subtype: error ? 'error' : 'success', request_id: requestId, response: {}, error } }) }
  result(text = 'Done', extra: Record<string, unknown> = {}) { this.emitRecord({ type: 'result', subtype: 'success', result: text, session_id: 'conversation-1', uuid: crypto.randomUUID(), ...extra }) }
  permission(id = 'approval-1') { this.emitRecord({ type: 'control_request', request_id: id, request: { subtype: 'can_use_tool', tool_name: 'Bash', tool_use_id: 'tool-1', input: { command: 'printf checked' }, permission_suggestions: [] } }) }
  kill(signal: NodeJS.Signals = 'SIGTERM') { this.exitCode = 0; this.signalCode = signal; this.emit('exit', 0, signal); this.emit('close', 0, signal); return true }
}
const adapters: ClaudeAdapter[] = []
function setup(options: Partial<ClaudeAdapterOptions> = {}, initialize = true) {
  const proc = new ClaudeProcess()
  proc.initialize = initialize
  const events: AgentEvent[] = []
  const spawnProcess = vi.fn<NonNullable<ClaudeAdapterOptions['spawnProcess']>>(() => proc as unknown as ChildProcess)
  const adapter = new ClaudeAdapter({ taskId: 'task', runId: 'run', worktreePath: '/worktree', startupTimeoutMs: 1000, stdinWriteTimeoutMs: 100, supervisor: { terminateProcessTree: vi.fn(async () => true) } as unknown as ProcessSupervisor, spawnProcess, onEvent: event => events.push(event), ...options })
  adapters.push(adapter)
  return { proc, adapter, events, spawnProcess }
}
const prompt = { taskId: 'task', runId: 'run', text: 'Hello' }
afterEach(async () => { await Promise.all(adapters.splice(0).map(adapter => adapter.stop(true).catch(() => {}))) })

describe('Claude persistent structured control protocol', () => {
  it('uses explicit native resume identity, preserves it on prompts, and applies the selected model', async () => {
    const saved = '12345678-1234-1234-1234-123456789abc'
    const { adapter, proc, spawnProcess, events } = setup({ resumeSessionId: saved, model: 'sonnet' })
    await expect(adapter.start()).resolves.toMatchObject({ sessionId: saved })
    expect(spawnProcess.mock.calls[0][1]).toEqual(expect.arrayContaining(['--resume', saved, '--model', 'sonnet']))
    expect(spawnProcess.mock.calls[0][1]).not.toContain('--session-id')
    const turn = await adapter.sendPrompt(prompt)
    expect(proc.records.find(record => record.type === 'user')!.session_id).toBe(saved)
    proc.result('Resumed answer', { session_id: saved })
    expect(events).toContainEqual(expect.objectContaining({ type: 'message.completed', fullContent: 'Resumed answer', turnId: turn.turnId }))
  })

  it('assigns a durable UUID to new sessions and fails a mismatched resume init', async () => {
    const saved = '12345678-1234-1234-1234-123456789abc'
    const fresh = setup({ sessionId: saved })
    await fresh.adapter.start()
    expect(fresh.spawnProcess.mock.calls[0][1]).toEqual(expect.arrayContaining(['--session-id', saved]))
    const resumed = setup({ resumeSessionId: saved })
    await resumed.adapter.start()
    resumed.proc.emitRecord({ type: 'system', subtype: 'init', session_id: 'different-native-session' })
    expect(resumed.events).toContainEqual(expect.objectContaining({ type: 'agent.status.changed', scope: 'session', status: 'error', error: expect.stringContaining('unexpected conversation') }))
    expect(resumed.spawnProcess).toHaveBeenCalledTimes(1)
    expect(() => setup({ resumeSessionId: '--continue' })).toThrow(/UUID/)
  })

  it('requires matching initialize response, and never treats spawn or auth logs as ready', async () => {
    const { proc, adapter } = setup({}, false)
    let ready = false
    const startup = adapter.start().then(() => { ready = true })
    await new Promise(resolve => setImmediate(resolve))
    proc.stderr.write('Signing in…\n')
    proc.ack('wrong-id')
    expect(ready).toBe(false)
    expect(proc.records).toHaveLength(1)
    expect(proc.records[0]).toMatchObject({ type: 'control_request', request: { subtype: 'initialize', hooks: null } })
    proc.ack(proc.records[0].request_id)
    await startup
    expect(ready).toBe(true)
  })

  it('fails a missing or rejected handshake and kills the owned process', async () => {
    const missing = setup({ startupTimeoutMs: 15 }, false)
    await expect(missing.adapter.start()).rejects.toThrow(/timed out/)
    expect(missing.proc.signalCode).not.toBeNull()
    const rejected = setup({}, false)
    const startup = rejected.adapter.start()
    await new Promise(resolve => setImmediate(resolve))
    rejected.proc.ack(rejected.proc.records[0].request_id, 'Protocol unsupported')
    await expect(startup).rejects.toThrow('Protocol unsupported')
  })

  it('keeps stdin and session context for two scoped turns, preserving the native permission policy and trusted env', async () => {
    const { proc, adapter, events, spawnProcess } = setup({ permissionMode: 'plan', env: { PATH: '/trusted/bin', HOME: '/isolated' } })
    await adapter.start()
    const first = await adapter.sendPrompt(prompt)
    proc.result('First')
    expect(adapter.getStatus()).toBe('idle')
    const second = await adapter.sendPrompt({ ...prompt, text: 'Second' })
    proc.result('Second')
    expect(second.turnId).not.toBe(first.turnId)
    expect(spawnProcess).toHaveBeenCalledTimes(1)
    expect(proc.stdin.writable).toBe(true)
    const users = proc.records.filter(record => record.type === 'user')
    expect(users.map(record => record.session_id)).toEqual(['', 'conversation-1'])
    expect(events.filter(event => event.type === 'message.completed').map(event => event.turnId)).toEqual([first.turnId, second.turnId])
    expect(events.filter(event => event.type === 'agent.status.changed' && event.status === 'completed')).toMatchObject([{ scope: 'turn', turnId: first.turnId }, { scope: 'turn', turnId: second.turnId }])
    expect(spawnProcess).toHaveBeenCalledWith('claude', expect.arrayContaining(['--permission-prompt-tool', 'stdio', '--permission-mode', 'plan']), expect.objectContaining({ env: { PATH: '/trusted/bin', HOME: '/isolated', CI: 'true' } }))
  })

  it('ignores idle results and foreign/subagent session identities', async () => {
    const { proc, adapter, events } = setup()
    await adapter.start()
    proc.result('Unexpected idle')
    expect(events.filter(event => event.type === 'message.completed')).toHaveLength(0)
    await adapter.sendPrompt(prompt)
    proc.result('Foreign', { session_id: 'foreign', parent_tool_use_id: 'child' })
    proc.result('Foreign root', { session_id: 'foreign' })
    expect(adapter.getSessionId()).toBe('conversation-1')
    expect(adapter.getStatus()).toBe('running')
    proc.result('Correct')
    expect(events.filter(event => event.type === 'message.completed')).toMatchObject([{ fullContent: 'Correct' }])
  })

  it('only resolves current approvals with explicit allow/deny and original input', async () => {
    const { proc, adapter, events } = setup()
    await adapter.start()
    const { turnId } = await adapter.sendPrompt(prompt)
    proc.permission()
    const permission = events.find(event => event.type === 'permission.requested')!
    if (permission.type !== 'permission.requested') throw new Error('Missing approval')
    expect(permission.turnId).toBe(turnId)
    expect(adapter.getStatus()).toBe('waiting_for_approval')
    await expect(adapter.resolveApproval(permission.approvalId, 'always')).rejects.toThrow(/Invalid/)
    await expect(adapter.resolveApproval({ taskId: 'foreign', runId: 'run', approvalId: permission.approvalId, decision: 'allow' })).rejects.toThrow(/ownership/)
    await adapter.resolveApproval(permission.approvalId, 'allow')
    expect(proc.records.at(-1)).toEqual({ type: 'control_response', response: { subtype: 'success', request_id: 'approval-1', response: { behavior: 'allow', updatedInput: { command: 'printf checked' } } } })
    await expect(adapter.resolveApproval(permission.approvalId, 'allow')).rejects.toThrow(/stale/)
    proc.permission('approval-2')
    const second = events.filter(event => event.type === 'permission.requested').at(-1)!
    if (second.type !== 'permission.requested') throw new Error('Missing approval')
    await adapter.resolveApproval(second.approvalId, 'deny')
    expect(proc.records.at(-1)).toMatchObject({ response: { request_id: 'approval-2', response: { behavior: 'deny' } } })
  })

  it('expires cancelled/finished approvals and cannot approve them on the next turn', async () => {
    const { proc, adapter, events } = setup()
    await adapter.start()
    await adapter.sendPrompt(prompt)
    proc.permission('cancelled')
    proc.emitRecord({ type: 'control_cancel_request', request_id: 'cancelled' })
    proc.permission('at-completion')
    const requested = events.filter(event => event.type === 'permission.requested')
    proc.result()
    await adapter.sendPrompt(prompt)
    for (const permission of requested) if (permission.type === 'permission.requested') await expect(adapter.resolveApproval(permission.approvalId, 'allow')).rejects.toThrow(/stale/)
    expect(events.filter(event => event.type === 'permission.state.changed' && event.state === 'expired')).toHaveLength(2)
    expect(proc.records.filter(record => record.type === 'control_response')).toHaveLength(0)
  })

  it('does not release a turn on interrupt acknowledgment; result ends that turn and permits the next', async () => {
    const { proc, adapter, events } = setup()
    await adapter.start()
    const { turnId } = await adapter.sendPrompt(prompt)
    await adapter.interruptTurn(turnId)
    expect(proc.signalCode).toBeNull()
    await expect(adapter.sendPrompt(prompt)).rejects.toThrow(/already in progress/)
    expect(events.some(event => event.type === 'agent.status.changed' && event.scope === 'turn' && event.status === 'stopped')).toBe(false)
    proc.result('', { is_error: true, errors: ['Interrupted'] })
    expect(events.filter(event => event.type === 'agent.status.changed' && event.status === 'stopped')).toMatchObject([{ scope: 'turn', turnId }])
    await adapter.sendPrompt(prompt)
    await expect(adapter.interruptTurn(turnId)).rejects.toThrow(/stale/)
  })

  it('keeps rejected interruption pending as a normal active turn, and result-before-ack remains scoped', async () => {
    const { proc, adapter, events } = setup()
    await adapter.start()
    const { turnId } = await adapter.sendPrompt(prompt)
    proc.interrupt = false
    const rejected = adapter.interruptTurn(turnId)
    proc.ack(proc.records.at(-1)!.request_id, 'Not supported')
    await expect(rejected).rejects.toThrow('Not supported')
    await expect(adapter.sendPrompt(prompt)).rejects.toThrow(/in progress/)
    const interrupt = adapter.interruptTurn(turnId)
    const requestId = proc.records.at(-1)!.request_id
    proc.result('Interrupted')
    const next = await adapter.sendPrompt(prompt)
    proc.ack(requestId)
    await expect(interrupt).resolves.toEqual({ turnId })
    expect(events.filter(event => event.type === 'agent.status.changed' && event.status === 'stopped').map(event => event.turnId)).toEqual([turnId])
    expect(next.turnId).not.toBe(turnId)
    expect(adapter.getStatus()).toBe('running')
  })

  it('drains the final result after exit before ending the session, and never spawns a fresh conversation on retry', async () => {
    const { proc, adapter, events, spawnProcess } = setup()
    await adapter.start()
    const { turnId } = await adapter.sendPrompt(prompt)
    proc.exitCode = 1
    proc.emit('exit', 1, null)
    proc.result('Tail answer', { uuid: 'tail' })
    proc.emit('close', 1, null)
    const completed = events.findIndex(event => event.type === 'message.completed' && event.turnId === turnId)
    const dead = events.findIndex(event => event.type === 'agent.status.changed' && event.scope === 'session' && event.status === 'error')
    expect(completed).toBeGreaterThan(-1)
    expect(dead).toBeGreaterThan(completed)
    await expect(adapter.sendPrompt(prompt)).rejects.toThrow(/error state/)
    await expect(adapter.start()).rejects.toThrow(/new chat/)
    expect(spawnProcess).toHaveBeenCalledTimes(1)
  })

  it('flushes a result without newline and scopes failure to turn while session remains alive', async () => {
    const { proc, adapter, events } = setup()
    await adapter.start()
    await adapter.sendPrompt(prompt)
    proc.result('', { subtype: 'error_during_execution', is_error: true, errors: ['Budget exceeded'] })
    expect(events.filter(event => event.type === 'agent.status.changed' && event.status === 'error')).toMatchObject([{ scope: 'turn', error: 'Budget exceeded' }])
    expect(adapter.getStatus()).toBe('idle')
    const next = await adapter.sendPrompt(prompt)
    proc.emitRecord({ type: 'result', subtype: 'success', result: 'Trailing', session_id: 'conversation-1' }, false)
    proc.exitCode = 0
    proc.emit('exit', 0, null)
    proc.emit('close', 0, null)
    expect(events.filter(event => event.type === 'message.completed')).toContainEqual(expect.objectContaining({ turnId: next.turnId, fullContent: 'Trailing', finishReason: 'stop' }))
  })
  it('keeps a rejected permission write retryable, then ignores its late success after turn completion', async () => {
    const { proc, adapter, events } = setup()
    await adapter.start()
    await adapter.sendPrompt(prompt)
    proc.permission()
    const permission = events.find(event => event.type === 'permission.requested')!
    if (permission.type !== 'permission.requested') throw new Error('Missing approval')
    const original = proc.stdin.write.bind(proc.stdin)
    proc.stdin.write = (() => { throw new Error('Temporary write rejection') }) as typeof proc.stdin.write
    await expect(adapter.resolveApproval(permission.approvalId, 'allow')).rejects.toThrow('Temporary write rejection')
    let callback!: () => void
    proc.stdin.write = ((_chunk: unknown, done: () => void) => { callback = done; return true }) as typeof proc.stdin.write
    const resolution = adapter.resolveApproval(permission.approvalId, 'allow')
    proc.result()
    proc.stdin.write = original
    const next = await adapter.sendPrompt(prompt)
    callback()
    await resolution
    expect(events.filter(event => event.type === 'permission.state.changed' && event.state === 'resolved')).toHaveLength(0)
    expect(events.filter(event => event.type === 'permission.state.changed' && event.state === 'expired')).toHaveLength(1)
    expect(events.filter(event => event.type === 'agent.status.changed' && event.status === 'running').at(-1)?.turnId).toBe(next.turnId)
  })

  it('a permission response write timeout makes the session terminal rather than falsely ready', async () => {
    const { proc, adapter, events } = setup({ stdinWriteTimeoutMs: 15 })
    await adapter.start()
    await adapter.sendPrompt(prompt)
    proc.permission()
    const permission = events.find(event => event.type === 'permission.requested')!
    if (permission.type !== 'permission.requested') throw new Error('Missing approval')
    proc.stdin.write = (() => true) as typeof proc.stdin.write
    await expect(adapter.resolveApproval(permission.approvalId, 'allow')).rejects.toThrow(/write timed out/)
    expect(events.filter(event => event.type === 'agent.status.changed' && event.scope === 'session' && event.status === 'error')).toHaveLength(1)
    await expect(adapter.sendPrompt(prompt)).rejects.toThrow(/error state/)
    expect(proc.signalCode).not.toBeNull()
  })

})
