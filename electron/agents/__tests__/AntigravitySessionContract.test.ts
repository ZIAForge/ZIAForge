import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import type { ChildProcess, SpawnOptions } from 'node:child_process'
import { AntigravityAdapter, type AntigravityAdapterOptions } from '../AntigravityAdapter'
import { ProcessSupervisor } from '../../runtime/ProcessSupervisor'
import type { AgentEvent } from '../../../shared/agent-events'

let testWorktree: string

class ProtocolProcess extends EventEmitter {
  pid = 54321
  stdin = new PassThrough()
  stdout = new PassThrough()
  stderr = new PassThrough()
  exitCode: number | null = null
  signalCode: string | null = null
  signals: string[] = []
  record(value: unknown) { this.stdout.write(JSON.stringify(value) + '\n') }
  init(conversationId = 'conversation-fixture', cwd = testWorktree) { this.record({ event: 'init', conversation_id: conversationId, init: { cwd } }) }
  exit(code = 0, signal: string | null = null) {
    this.exitCode = code
    this.signalCode = signal
    this.emit('exit', code, signal)
    this.emit('close', code, signal)
  }
  kill(signal = 'SIGTERM') { this.signals.push(signal); this.exit(0, signal); return true }
}

describe('Antigravity persistent session contract', () => {
  const adapters: AntigravityAdapter[] = []
  beforeEach(() => { testWorktree = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'agy-contract-'))) })
  afterEach(async () => {
    await Promise.all(adapters.splice(0).map(adapter => adapter.stop(true).catch(() => {})))
    fs.rmSync(testWorktree, { recursive: true, force: true })
  })
  function setup(overrides: Partial<AntigravityAdapterOptions> = {}) {
    const child = new ProtocolProcess()
    const events: AgentEvent[] = []
    let spawned: { args: string[]; options: SpawnOptions } | undefined
    const adapter = new AntigravityAdapter({
      taskId: 'task-contract', runId: 'run-contract', worktreePath: testWorktree,
      startupTimeoutMs: 50, killTimeoutMs: 20,
      supervisor: new ProcessSupervisor({ getProcessListFn: () => [], killFn: () => { throw Object.assign(new Error('fixture PID absent'), { code: 'ESRCH' }) } }),
      spawnProcess: (_command, args, options) => { spawned = { args: args as string[], options }; return child as unknown as ChildProcess },
      onEvent: event => events.push(event), ...overrides,
    })
    adapters.push(adapter)
    const ready = async () => { const start = adapter.start(); child.init(overrides.conversationId, fs.realpathSync(overrides.worktreePath ?? testWorktree)); return start }
    return { child, events, adapter, ready, spawn: () => spawned! }
  }

  it('does not declare readiness on spawn or PID; only a valid init establishes the session', async () => {
    const { child, adapter, events } = setup()
    let settled = false
    const starting = adapter.start().then(value => { settled = true; return value })
    child.emit('spawn')
    await Promise.resolve()
    expect(settled).toBe(false)
    await expect(adapter.sendPrompt({ taskId: 'task-contract', text: 'premature' })).rejects.toThrow(/not started/)
    expect(events.filter(event => event.type === 'agent.status.changed' && event.scope === 'session' && event.status === 'running')).toEqual([])
    child.init()
    await expect(starting).resolves.toMatchObject({ conversationId: 'conversation-fixture' })
    expect(events).toContainEqual(expect.objectContaining({ type: 'agent.status.changed', scope: 'session', status: 'running' }))
  })

  it('rejects init timeout and an exit before init without leaving a pending start', async () => {
    const timed = setup({ startupTimeoutMs: 10 })
    await expect(timed.adapter.start()).rejects.toThrow(/initialization timed out/)
    const exited = setup()
    const starting = exited.adapter.start()
    exited.child.exit(1)
    await expect(starting).rejects.toThrow(/before initialization/)
  })

  it('uses only selected per-run policy and injected environment, and resumes the exact conversation', async () => {
    const inherited = setup({ env: { PATH: '/fixture/bin', LANG: 'C', PWD: '/unrelated/launch/directory', HOME: process.env.HOME }, permissionMode: 'cli-settings', conversationId: 'conversation-fixture', model: 'gemini-fixture' })
    await inherited.ready()
    expect(inherited.spawn().args).toEqual(['--input-format', 'stream-json', '--output-format', 'stream-json', '--disable-slash-commands', '--add-dir', testWorktree, '--sandbox', '--conversation', 'conversation-fixture', '--model', 'gemini-fixture'])
    expect(inherited.spawn().options.env).toEqual({ PATH: '/fixture/bin', LANG: 'C', PWD: testWorktree, HOME: process.env.HOME, CI: 'true' })
    const danger = setup({ permissionMode: 'dangerously-skip' })
    await danger.ready()
    expect(danger.spawn().args).toContain('--dangerously-skip-permissions')
    expect(danger.spawn().args).not.toContain('--sandbox')
    expect(() => setup({ permissionMode: 'read-only' as 'cli-settings' })).toThrow(/not enforced/)
  })

  it('rejects a resumed session with the wrong init identity', async () => {
    const { adapter, child } = setup({ conversationId: 'expected-conversation' })
    const starting = adapter.start()
    child.init('different-conversation')
    await expect(starting).rejects.toThrow(/mismatched/)
  })

  it('refuses relative, missing, file and symlink workspace paths before spawning', () => {
    const file = path.join(testWorktree, 'file'); fs.writeFileSync(file, 'not a directory')
    const target = path.join(testWorktree, 'target'); fs.mkdirSync(target)
    const link = path.join(testWorktree, 'link'); fs.symlinkSync(target, link, 'dir')
    const spawnProcess = vi.fn()
    for (const worktreePath of ['relative/worktree', path.join(testWorktree, 'missing'), file, link, link + path.sep]) {
      expect(() => setup({ worktreePath, spawnProcess })).toThrow(/workspace/i)
    }
    expect(spawnProcess).not.toHaveBeenCalled()
  })

  it.each(['fresh', 'resume'])('requires an absolute matching init.cwd before %s session readiness or input', async mode => {
    const wrong = path.join(testWorktree, 'another-workspace'); fs.mkdirSync(wrong)
    for (const init of [undefined, {}, { cwd: 1 }, { cwd: 'relative' }, { cwd: wrong }]) {
      const { adapter, child, events } = setup(mode === 'resume' ? { conversationId: 'conversation-fixture' } : {})
      const writes = vi.spyOn(child.stdin, 'write')
      const starting = adapter.start()
      const rejected = expect(starting).rejects.toThrow(/directory|workspace/i)
      child.record({ event: 'init', conversation_id: 'conversation-fixture', init })
      await rejected
      await expect(adapter.sendPrompt({ taskId: 'task-contract', text: 'must remain unsent' })).rejects.toThrow()
      child.init() // An old generation cannot regain readiness after failure.
      expect(events.filter(event => event.type === 'agent.status.changed' && event.scope === 'session' && event.status === 'running')).toEqual([])
      expect(writes).not.toHaveBeenCalled()
      await adapter.stop(true)
      expect(child.exitCode).not.toBeNull()
      expect(child.stdin.writableEnded).toBe(true)
    }
  })

  it('binds simultaneous conversations independently of an inherited launch directory', async () => {
    const one = path.join(testWorktree, 'one'); const two = path.join(testWorktree, 'two')
    fs.mkdirSync(one); fs.mkdirSync(two)
    const a = setup({ worktreePath: one, env: { PWD: testWorktree } })
    const b = setup({ worktreePath: two, env: { PWD: testWorktree }, conversationId: 'resumed-two' })
    await Promise.all([a.ready(), b.ready()])
    for (const [state, expected] of [[a, one], [b, two]] as const) {
      const args = state.spawn().args
      expect(args.slice(args.indexOf('--add-dir'), args.indexOf('--add-dir') + 2)).toEqual(['--add-dir', expected])
      expect(state.spawn().options.cwd).toBe(expected)
      expect(state.spawn().options.env?.PWD).toBe(expected)
      await state.adapter.sendPrompt({ taskId: 'task-contract', text: 'only my own workspace' })
    }
  })

  it('refuses a removed or replaced workspace both before startup and before a subsequent send', async () => {
    const owned = path.join(testWorktree, 'owned'); fs.mkdirSync(owned)
    const neverStarted = setup({ worktreePath: owned })
    fs.rmdirSync(owned)
    await expect(neverStarted.adapter.start()).rejects.toThrow(/workspace/i)
    expect(neverStarted.spawn()).toBeUndefined()

    fs.mkdirSync(owned)
    const live = setup({ worktreePath: owned }); await live.ready()
    await live.adapter.sendPrompt({ taskId: 'task-contract', text: 'first accepted' })
    live.child.record({ event: 'result', result: { status: 'SUCCESS', response: 'done' } })
    const writes = vi.spyOn(live.child.stdin, 'write')
    fs.renameSync(owned, path.join(testWorktree, 'previous-owned')); fs.mkdirSync(owned)
    await expect(live.adapter.sendPrompt({ taskId: 'task-contract', text: 'never enter replacement' })).rejects.toThrow(/does not match/)
    expect(writes).not.toHaveBeenCalled()
    expect(live.events).toContainEqual(expect.objectContaining({ type: 'agent.status.changed', scope: 'session', status: 'error' }))
    await live.adapter.stop(true)
    expect(live.child.exitCode).not.toBeNull()
  })

  it('keeps the session PID while ending each turn with matching event identities', async () => {
    const { adapter, child, ready, events } = setup()
    await ready()
    const first = await adapter.sendPrompt({ taskId: 'task-contract', text: 'first' })
    child.record({ event: 'step_update', step_update: { conversation_id: 'conversation-fixture', step_index: 2, step_type: 'agent_response', state: 'ACTIVE', text_delta: 'Привет 🌍' } })
    child.record({ event: 'result', result: { conversation_id: 'conversation-fixture', status: 'SUCCESS', response: 'Привет 🌍', num_turns: 1 } })
    const second = await adapter.sendPrompt({ taskId: 'task-contract', text: 'second' })
    child.record({ event: 'result', result: { conversation_id: 'conversation-fixture', status: 'SUCCESS', response: 'same session', num_turns: 2 } })
    expect(first.turnId).not.toBe(second.turnId)
    expect(adapter.getPid()).toBe(child.pid)
    expect(adapter.getStatus()).toBe('running')
    for (const turn of [first, second]) {
      expect(events).toContainEqual(expect.objectContaining({ type: 'message.completed', turnId: turn.turnId }))
      expect(events).toContainEqual(expect.objectContaining({ type: 'agent.status.changed', scope: 'turn', status: 'completed', turnId: turn.turnId }))
    }
    expect(events.filter(event => event.type === 'agent.status.changed' && event.scope === 'session' && event.status === 'completed')).toEqual([])
    expect(child.signals).toEqual([])
  })

  it('ignores another conversation and fails bounded response growth', async () => {
    const { adapter, child, ready, events } = setup({ maxTurnBufferBytes: 3 })
    await ready()
    const turn = await adapter.sendPrompt({ taskId: 'task-contract', text: 'hi' })
    child.record({ event: 'result', result: { conversation_id: 'wrong', status: 'SUCCESS', response: 'bad' } })
    expect(adapter.getActiveTurnId()).toBe(turn.turnId)
    child.record({ event: 'step_update', step_update: { conversation_id: 'conversation-fixture', step_index: 1, step_type: 'agent_response', text_delta: 'four' } })
    expect(events).toContainEqual(expect.objectContaining({ type: 'agent.status.changed', scope: 'turn', status: 'error', turnId: turn.turnId }))
    expect(adapter.getActiveTurnId()).toBeUndefined()
  })

  it('offers native turn interruption separately from whole-session EOF shutdown', async () => {
    const { adapter, child, ready, events } = setup()
    await ready()
    expect(typeof adapter.interruptTurn).toBe('function')
    await expect(adapter.interruptTurn('not-active')).rejects.toThrow(/stale/)
    expect(adapter.getCapabilities()).toMatchObject({ interactiveApprovals: false, attachments: false, thinkingStreaming: false, toolOutputStreaming: false })
    await expect(adapter.resolveApproval('approval', 'allow')).rejects.toThrow(/not supported/)
    child.stdin.on('finish', () => child.exit())
    await adapter.stop()
    expect(child.stdin.writableEnded).toBe(true)
    expect(child.signals).toEqual([])
    expect(events).toContainEqual(expect.objectContaining({ type: 'agent.status.changed', scope: 'session', status: 'stopped' }))
  })

  it('rejects a pending write when ending the session, preserving stopped status', async () => {
    const { adapter, child, ready } = setup()
    await ready()
    vi.spyOn(child.stdin, 'write').mockImplementation(() => true)
    const sending = adapter.sendPrompt({ taskId: 'task-contract', text: 'pending' })
    const rejection = expect(sending).rejects.toThrow(/stopped/)
    await adapter.stop(true)
    await rejection
    expect(adapter.getStatus()).toBe('stopped')
  })

  it('times out an unacknowledged stdin write rather than keeping send pending forever', async () => {
    const { adapter, child, ready } = setup({ stdinWriteTimeoutMs: 10 })
    await ready()
    vi.spyOn(child.stdin, 'write').mockImplementation(() => true)
    await expect(adapter.sendPrompt({ taskId: 'task-contract', text: 'pending' })).rejects.toThrow(/write timed out/)
    expect(adapter.getStatus()).toBe('error')
  })

  function restartSetup() {
    const first = new ProtocolProcess()
    const second = new ProtocolProcess(); second.pid = 54322
    const spawns: string[][] = []
    const state = setup({ startupTimeoutMs: 500, spawnProcess: (_cmd, args) => {
      spawns.push(args)
      return (spawns.length === 1 ? first : second) as unknown as ChildProcess
    } })
    first.kill = (signal = 'SIGTERM') => { first.signals.push(signal); if (signal !== 'SIGINT') first.exit(0, signal); return true }
    return { ...state, first, second, spawns }
  }

  it('waits for interrupted result AND close before resuming the same conversation, rejecting early sends and stale callbacks', async () => {
    const { adapter, first, second, spawns, events } = restartSetup()
    const starting = adapter.start(); first.init(); await starting
    const turn = await adapter.sendPrompt({ taskId: 'task-contract', text: 'first' })
    await adapter.interruptTurn(turn.turnId)
    await adapter.interruptTurn(turn.turnId)
    expect(first.signals).toEqual(['SIGINT'])
    first.record({ event: 'result', result: { status: 'ERROR', error: 'interrupted' } })
    expect(spawns).toHaveLength(1)
    await expect(adapter.sendPrompt({ taskId: 'task-contract', text: 'too soon' })).rejects.toThrow(/not started/)
    expect(events).toContainEqual(expect.objectContaining({ type: 'message.completed', finishReason: 'interrupted', turnId: turn.turnId }))
    first.exit(1)
    await vi.waitFor(() => expect(spawns).toHaveLength(2))
    expect(spawns[1]).toContain('--conversation')
    for (const args of spawns) expect(args.slice(args.indexOf('--add-dir'), args.indexOf('--add-dir') + 2)).toEqual(['--add-dir', testWorktree])
    expect(spawns[1][spawns[1].indexOf('--conversation') + 1]).toBe('conversation-fixture')
    await expect(adapter.sendPrompt({ taskId: 'task-contract', text: 'before init' })).rejects.toThrow(/not started/)
    second.init()
    await vi.waitFor(() => expect(adapter.getStatus()).toBe('running'))
    const next = await adapter.sendPrompt({ taskId: 'task-contract', text: 'after stop' })
    first.record({ event: 'result', result: { status: 'SUCCESS', response: 'stale' } }); first.emit('close', 1, null)
    expect(adapter.getActiveTurnId()).toBe(next.turnId)
    expect(adapter.getPid()).toBe(second.pid)
    expect(events.filter(event => event.type === 'message.completed' && event.turnId === turn.turnId)).toHaveLength(1)
    expect(events.filter(event => event.type === 'agent.status.changed' && event.scope === 'session' && event.status === 'error')).toEqual([])
  })

  it.each(['before-close', 'before-init'])('Quit %s cancels a pending resume without spawning or accepting late readiness', async phase => {
    const { adapter, first, second, spawns, events } = restartSetup()
    const starting = adapter.start(); first.init(); await starting
    const turn = await adapter.sendPrompt({ taskId: 'task-contract', text: 'first' })
    await adapter.interruptTurn(turn.turnId)
    first.record({ event: 'result', result: { status: 'ERROR', error: 'interrupted' } })
    if (phase === 'before-init') { first.exit(1); await vi.waitFor(() => expect(spawns).toHaveLength(2)) }
    await adapter.stop(true)
    first.emit('close', 1, null); second.init()
    await Promise.resolve()
    expect(adapter.getStatus()).toBe('stopped')
    expect(spawns).toHaveLength(phase === 'before-init' ? 2 : 1)
    expect(events.filter(event => event.type === 'agent.status.changed' && event.scope === 'session' && event.status === 'running')).toHaveLength(1)
    await expect(adapter.sendPrompt({ taskId: 'task-contract', text: 'not sent' })).rejects.toThrow(/stopped/)
  })

  it('keeps failed native resume visible and retains the conversation reference', async () => {
    const { adapter, first, second, spawns, events } = restartSetup()
    const starting = adapter.start(); first.init(); await starting
    const turn = await adapter.sendPrompt({ taskId: 'task-contract', text: 'first' })
    await adapter.interruptTurn(turn.turnId)
    first.record({ event: 'result', result: { status: 'ERROR', error: 'interrupted' } }); first.exit(1)
    await vi.waitFor(() => expect(spawns).toHaveLength(2))
    second.exit(7)
    await vi.waitFor(() => expect(events).toContainEqual(expect.objectContaining({ type: 'agent.status.changed', scope: 'session', status: 'error', error: expect.stringContaining('could not resume') })))
    expect(adapter.getSessionId()).toBe('conversation-fixture')
    await expect(adapter.sendPrompt({ taskId: 'task-contract', text: 'unsent draft' })).rejects.toThrow()
  })
})
