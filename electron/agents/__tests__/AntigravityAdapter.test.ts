import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { EventEmitter } from 'events'
import { PassThrough } from 'stream'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { ProcessSupervisor } from '../../runtime/ProcessSupervisor'
import {
  AntigravityAdapter,
  AntigravityAdapterOptions,
} from '../AntigravityAdapter'
import {
  AgentEvent,
  MessageStartedEvent,
  MessageDeltaEvent,
  MessageCompletedEvent,
  ToolStartedEvent,
  ToolCompletedEvent,
  AgentStatusChangedEvent,
  RawLogEvent,
} from '../../../shared/agent-events'

let testWorktree: string

function protocolStdout() {
  const stream = new PassThrough()
  let scheduled = false
  stream.on('newListener', event => {
    if (event === 'data' && !scheduled) {
      scheduled = true
      queueMicrotask(() => stream.write(JSON.stringify({ event: 'init', conversation_id: 'conv-1', init: { cwd: testWorktree } }) + '\n'))
    }
  })
  return stream
}

class MockChildProcess extends EventEmitter {
  pid = 54321
  stdin = new PassThrough()
  stdout = protocolStdout()
  stderr = new PassThrough()
  killed = false
  exitCode: number | null = null
  signalCode: string | null = null

  kill(signal: NodeJS.Signals | number = 'SIGTERM') {
    this.killed = true
    this.exitCode = 0
    this.signalCode = typeof signal === 'string' ? signal : String(signal)
    this.emit('exit', 0, signal)
    this.emit('close', 0, signal)
    return true
  }
}

class StubbornChildProcess extends EventEmitter {
  pid = 98765
  stdin = new PassThrough()
  stdout = protocolStdout()
  stderr = new PassThrough()
  killed = false
  exitCode: number | null = null
  signalCode: string | null = null
  signalsReceived: (NodeJS.Signals | number)[] = []

  kill(signal: NodeJS.Signals | number = 'SIGTERM') {
    this.signalsReceived.push(signal)
    if (signal === 'SIGKILL') {
      this.killed = true
      this.exitCode = 137
      this.signalCode = 'SIGKILL'
      this.emit('exit', 137, 'SIGKILL')
      this.emit('close', 137, 'SIGKILL')
      return true
    }
    this.killed = true
    return true
  }
}

describe('AntigravityAdapter', () => {
  let mockProc: MockChildProcess
  let emittedEvents: AgentEvent[]
  let rawLogs: { stream: 'stdout' | 'stderr'; line: string }[]
  let adapter: AntigravityAdapter
  let adapterOptions: AntigravityAdapterOptions
  let lastSpawnArgs: { command: string; args: string[]; options: Record<string, unknown> } | null = null

  beforeEach(() => {
    testWorktree = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'agy-adapter-')))
    mockProc = new MockChildProcess()
    emittedEvents = []
    rawLogs = []
    lastSpawnArgs = null

    adapterOptions = {
      taskId: 'test-task-agy',
      runId: 'test-run-agy',
      worktreePath: testWorktree,
      agyBinPath: 'agy',
      supervisor: new ProcessSupervisor({ getProcessListFn: () => [], killFn: () => { throw Object.assign(new Error('absent fixture PID'), { code: 'ESRCH' }) } }),
      killTimeoutMs: 25,
      emitRawLogEvents: true,
      spawnProcess: (command, args, options) => {
        lastSpawnArgs = { command, args: (args || []) as string[], options: (options || {}) as Record<string, unknown> }
        return mockProc as unknown as import('child_process').ChildProcess
      },
      onEvent: (evt) => emittedEvents.push(evt),
      onRawLog: (stream, line) => rawLogs.push({ stream, line }),
    }
  })

  afterEach(async () => {
    if (adapter) {
      await adapter.stop(true).catch(() => {})
    }
    fs.rmSync(testWorktree, { recursive: true, force: true })
  })

  it('starts process with --input-format stream-json and --output-format stream-json', async () => {
    adapter = new AntigravityAdapter(adapterOptions)

    const res = await adapter.start()
    expect(res.pid).toBe(54321)
    expect(lastSpawnArgs).toBeDefined()
    expect(lastSpawnArgs!.command).toBe('agy')
    expect(lastSpawnArgs!.args).toEqual([
      '--input-format',
      'stream-json',
      '--output-format',
      'stream-json',
      '--disable-slash-commands',
      '--add-dir',
      testWorktree,
      '--sandbox',
    ])
    expect(lastSpawnArgs!.options.cwd).toBe(testWorktree)
  })

  it('passes the verified native effort flag without weakening the sandbox policy', async () => {
    adapter = new AntigravityAdapter({ ...adapterOptions, reasoningEffort: 'high' })
    await adapter.start()
    const args = lastSpawnArgs!.args
    expect(args.slice(args.indexOf('--effort'), args.indexOf('--effort') + 2)).toEqual(['--effort', 'high'])
    expect(args).toContain('--sandbox'); expect(args).not.toContain('--dangerously-skip-permissions')
    expect(() => new AntigravityAdapter({ ...adapterOptions, reasoningEffort: 'max' })).toThrow(/does not support/)
  })

  it('passes --model flag when model option is specified', async () => {
    adapter = new AntigravityAdapter({
      ...adapterOptions,
      model: 'gemini-2.5-flash',
    })

    await adapter.start()
    expect(lastSpawnArgs!.args).toEqual([
      '--input-format',
      'stream-json',
      '--output-format',
      'stream-json',
      '--disable-slash-commands',
      '--add-dir',
      testWorktree,
      '--sandbox',
      '--model',
      'gemini-2.5-flash',
    ])
  })

  it('deduplicates concurrent start calls', async () => {
    adapter = new AntigravityAdapter(adapterOptions)

    const [p1, p2] = await Promise.all([adapter.start(), adapter.start()])
    expect(p1.pid).toBe(54321)
    expect(p2.pid).toBe(54321)
  })

  it('rejects start() if child process emits early error before spawn completes', async () => {
    const brokenProc = Object.assign(new EventEmitter(), {
      pid: undefined,
      stdin: new PassThrough(),
      stdout: protocolStdout(),
      stderr: new PassThrough(),
      kill: () => true,
    }) as unknown as import('child_process').ChildProcess

    adapter = new AntigravityAdapter({
      ...adapterOptions,
      spawnProcess: () => {
        queueMicrotask(() => {
          brokenProc.emit('error', new Error('spawn agy ENOENT'))
        })
        return brokenProc
      },
    })

    await expect(adapter.start()).rejects.toThrow('spawn agy ENOENT')
  })

  it('rejects start() if stop() is called during startup', async () => {
    const slowProc = Object.assign(new EventEmitter(), {
      pid: undefined,
      stdin: new PassThrough(),
      stdout: protocolStdout(),
      stderr: new PassThrough(),
      exitCode: null as number | null,
      signalCode: null as string | null,
      kill(this: { exitCode: number | null; emit: (ev: string, ...args: unknown[]) => boolean }) {
        this.exitCode = 0
        this.emit('exit', 0, 'SIGTERM')
        this.emit('close', 0, 'SIGTERM')
        return true
      },
    }) as unknown as import('child_process').ChildProcess

    adapter = new AntigravityAdapter({
      ...adapterOptions,
      spawnProcess: () => slowProc,
    })

    const startPromise = adapter.start()
    const expectation = expect(startPromise).rejects.toThrow(/adapter was stopped during startup/i)
    await adapter.stop()
    await expectation
  })

  it('processes init event and updates conversationId', async () => {
    adapter = new AntigravityAdapter(adapterOptions)
    mockProc.stdout = new PassThrough()
    const starting = adapter.start()

    expect(adapter.getConversationId()).toBeUndefined()

    mockProc.stdout.write(
      JSON.stringify({
        event: 'init',
        conversation_id: 'conv-12345',
        init: { cwd: testWorktree, tools: ['run_command'], permission_mode: 'request-review' },
      }) + '\n'
    )

    await starting
    expect(adapter.getConversationId()).toBe('conv-12345')
  })

  it('sends prompt formatted as stream-json user message over stdin', async () => {
    adapter = new AntigravityAdapter(adapterOptions)
    await adapter.start()

    let stdinWrittenData = ''
    mockProc.stdin.on('data', (chunk) => {
      stdinWrittenData += chunk.toString()
    })

    const { turnId } = await adapter.sendPrompt({
      taskId: 'test-task-agy',
      runId: 'test-run-agy',
      text: 'Analyze the codebase',
    })

    expect(turnId).toBeDefined()
    expect(adapter.getActiveTurnId()).toBe(turnId)

    const parsed = JSON.parse(stdinWrittenData.trim())
    expect(parsed).toEqual({
      event: 'user',
      message: {
        content: 'Analyze the codebase',
      },
    })
  })

  it('rejects prompt if attachments are passed', async () => {
    adapter = new AntigravityAdapter(adapterOptions)
    await adapter.start()

    await expect(
      adapter.sendPrompt({
        taskId: 'test-task-agy',
        text: 'With attachments',
        attachments: ['/path/to/file.txt'],
      })
    ).rejects.toThrow(/attachments are not supported/i)
  })

  it('rejects concurrent prompts while an active turn is in flight', async () => {
    adapter = new AntigravityAdapter(adapterOptions)
    await adapter.start()

    await adapter.sendPrompt({
      taskId: 'test-task-agy',
      text: 'First prompt',
    })

    await expect(
      adapter.sendPrompt({
        taskId: 'test-task-agy',
        text: 'Second prompt concurrent',
      })
    ).rejects.toThrow(/busy|already in progress/i)
  })

  it('clears activeTurnId and does not remain busy if stdin write fails', async () => {
    adapter = new AntigravityAdapter(adapterOptions)
    await adapter.start()

    // End stdin to induce write failure
    mockProc.stdin.end()

    await expect(
      adapter.sendPrompt({
        taskId: 'test-task-agy',
        text: 'Prompt to dead stdin',
      })
    ).rejects.toThrow()

    expect(adapter.getActiveTurnId()).toBeUndefined()
    expect(adapter.getCurrentStatus()).toBe('error')
  })

  it('rejects sendPrompt if adapter is in error status', async () => {
    adapter = new AntigravityAdapter(adapterOptions)
    await adapter.start()

    await adapter.sendPrompt({ taskId: 'test-task-agy', text: 'Cause fail' })
    mockProc.stdout.write(
      JSON.stringify({
        event: 'result',
        result: { status: 'ERROR', error: 'Fatal model crash' },
      }) + '\n'
    )

    expect(adapter.getCurrentStatus()).toBe('error')

    await expect(
      adapter.sendPrompt({ taskId: 'test-task-agy', text: 'Followup prompt' })
    ).rejects.toThrow(/error state/i)
  })

  it('handles runtime process error after startup by finalising active turn and setting error status', async () => {
    adapter = new AntigravityAdapter(adapterOptions)
    await adapter.start()

    await adapter.sendPrompt({ taskId: 'test-task-agy', text: 'Running turn' })

    mockProc.emit('error', new Error('Simulated runtime process crash'))

    expect(adapter.getCurrentStatus()).toBe('error')
    expect(adapter.getActiveTurnId()).toBeUndefined()

    const errEvent = emittedEvents.find((e): e is AgentStatusChangedEvent => e.type === 'agent.status.changed' && e.status === 'error')
    expect(errEvent).toBeDefined()
    expect(errEvent?.error).toContain('Simulated runtime process crash')
  })

  it('streams agent_response text_delta into message.started and message.delta events', async () => {
    adapter = new AntigravityAdapter(adapterOptions)
    await adapter.start()

    await adapter.sendPrompt({
      taskId: 'test-task-agy',
      text: 'Tell a story',
    })

    mockProc.stdout.write(
      JSON.stringify({
        event: 'step_update',
        step_update: {
          conversation_id: 'conv-1',
          step_index: 1,
          state: 'ACTIVE',
          step_type: 'agent_response',
          text_delta: 'Once upon ',
        },
      }) + '\n'
    )

    mockProc.stdout.write(
      JSON.stringify({
        event: 'step_update',
        step_update: {
          conversation_id: 'conv-1',
          step_index: 1,
          state: 'ACTIVE',
          step_type: 'agent_response',
          text_delta: 'a time.',
        },
      }) + '\n'
    )

    const started = emittedEvents.find((e): e is MessageStartedEvent => e.type === 'message.started')
    expect(started).toBeDefined()
    expect(started?.role).toBe('assistant')

    const deltas = emittedEvents.filter((e): e is MessageDeltaEvent => e.type === 'message.delta')
    expect(deltas.length).toBe(2)
    expect(deltas[0].content).toBe('Once upon ')
    expect(deltas[1].content).toBe('a time.')
  })

  it('streams tool step_updates into tool.started and tool.completed events', async () => {
    adapter = new AntigravityAdapter(adapterOptions)
    await adapter.start()

    await adapter.sendPrompt({
      taskId: 'test-task-agy',
      text: 'Run command',
    })

    // 1. Tool start (ACTIVE)
    mockProc.stdout.write(
      JSON.stringify({
        event: 'step_update',
        step_update: {
          conversation_id: 'conv-1',
          step_index: 2,
          state: 'ACTIVE',
          step_type: 'tool',
          tool_name: 'run_command',
          tool_info: {
            name: 'run_command',
            parameters: { CommandLine: 'ls -la' },
          },
        },
      }) + '\n'
    )

    const toolStart = emittedEvents.find((e): e is ToolStartedEvent => e.type === 'tool.started')
    expect(toolStart).toBeDefined()
    expect(toolStart?.toolName).toBe('run_command')
    expect(toolStart?.input).toEqual({ CommandLine: 'ls -la' })

    // 2. Tool completed (DONE)
    mockProc.stdout.write(
      JSON.stringify({
        event: 'step_update',
        step_update: {
          conversation_id: 'conv-1',
          step_index: 2,
          state: 'DONE',
          step_type: 'tool',
          tool_name: 'run_command',
          tool_info: {
            name: 'run_command',
            parameters: { CommandLine: 'ls -la' },
            output: 'total 0\n-rw-r--r-- 1 user staff 0 Sep 10 file.txt\n',
          },
        },
      }) + '\n'
    )

    const toolDone = emittedEvents.find((e): e is ToolCompletedEvent => e.type === 'tool.completed')
    expect(toolDone).toBeDefined()
    expect(toolDone?.toolCallId).toBe(toolStart?.toolCallId)
    expect(toolDone?.output).toBe('total 0\n-rw-r--r-- 1 user staff 0 Sep 10 file.txt\n')
  })

  it('handles tool step arriving directly with state: DONE without preceding ACTIVE', async () => {
    adapter = new AntigravityAdapter(adapterOptions)
    await adapter.start()

    await adapter.sendPrompt({
      taskId: 'test-task-agy',
      text: 'Instant tool',
    })

    mockProc.stdout.write(
      JSON.stringify({
        event: 'step_update',
        step_update: {
          step_index: 5,
          state: 'DONE',
          step_type: 'tool',
          tool_name: 'view_file',
          tool_info: {
            name: 'view_file',
            parameters: { AbsolutePath: '/foo.txt' },
            output: 'file contents',
          },
        },
      }) + '\n'
    )

    const toolStart = emittedEvents.find((e): e is ToolStartedEvent => e.type === 'tool.started')
    const toolDone = emittedEvents.find((e): e is ToolCompletedEvent => e.type === 'tool.completed')

    expect(toolStart).toBeDefined()
    expect(toolDone).toBeDefined()
    expect(toolStart?.toolCallId).toBe(toolDone?.toolCallId)
    expect(toolDone?.output).toBe('file contents')
    expect(toolDone?.outcome).toBe('completed')
  })

  it('fails an unconfirmed tool instead of fabricating success from terminal SUCCESS', async () => {
    adapter = new AntigravityAdapter(adapterOptions)
    await adapter.start()

    await adapter.sendPrompt({ taskId: 'test-task-agy', text: 'Unfinished tool prompt' })

    // Open tool
    mockProc.stdout.write(
      JSON.stringify({
        event: 'step_update',
        step_update: {
          step_index: 7,
          state: 'ACTIVE',
          step_type: 'tool',
          tool_name: 'test_tool',
        },
      }) + '\n'
    )

    // Result SUCCESS arrives directly without tool DONE
    mockProc.stdout.write(
      JSON.stringify({
        event: 'result',
        result: { status: 'SUCCESS', response: 'Completed all work' },
      }) + '\n'
    )

    const toolDone = emittedEvents.find((e): e is ToolCompletedEvent => e.type === 'tool.completed')
    expect(toolDone).toBeDefined()
    expect(toolDone?.outcome).toBe('failed')
    expect(toolDone?.isError).toBe(true)
    expect(toolDone?.output).toMatch(/outcome is unknown/)

    const msgDone = emittedEvents.find((e): e is MessageCompletedEvent => e.type === 'message.completed')
    expect(msgDone).toBeDefined()
    expect(msgDone?.finishReason).toBe('error')
    expect(msgDone?.fullContent).toBe('Completed all work')
    expect(emittedEvents.some(e => e.type === 'agent.status.changed' && e.scope === 'turn' && e.status === 'completed')).toBe(false)
  })

  it('preserves native tool ERROR and denied_actions instead of an empty successful turn, without retrying', async () => {
    // Sanitized shape from a retained native agy 1.2.7 permission-denial capture.
    adapter = new AntigravityAdapter(adapterOptions)
    await adapter.start()
    const writes = vi.spyOn(mockProc.stdin, 'write')
    const first = await adapter.sendPrompt({ taskId: 'test-task-agy', text: 'Run the bounded command' })
    const step = { conversation_id: 'conv-1', step_index: 2, step_type: 'tool', tool_name: 'run_command' }
    const nativeError = 'permission check failed: user denied permission to run command'
    const emit = (record: unknown) => mockProc.stdout.write(JSON.stringify(record) + '\n')
    emit({ event: 'step_update', step_update: { ...step, state: 'ACTIVE', tool_info: { parameters: { CommandLine: '/usr/bin/true' } } } })
    const deniedStep = { event: 'step_update', step_update: { ...step, state: 'ERROR', tool_info: { error: { type: 'TOOL_ERROR', message: nativeError } } } }
    emit(deniedStep)
    emit(deniedStep)
    emit({ event: 'result', result: { conversation_id: 'conv-1', status: 'SUCCESS', response: '', denied_actions: [{ action: 'command', display_name: 'RunCommand' }] } })
    const tools = emittedEvents.filter((e): e is ToolCompletedEvent => e.type === 'tool.completed')
    expect(tools).toHaveLength(1)
    expect(tools[0]).toMatchObject({ output: nativeError, isError: true, outcome: 'failed', turnId: first.turnId })
    expect(emittedEvents.filter(e => e.type === 'message.completed')).toEqual([expect.objectContaining({ finishReason: 'error', fullContent: '', turnId: first.turnId })])
    expect(emittedEvents).toContainEqual(expect.objectContaining({ type: 'agent.status.changed', scope: 'turn', status: 'error', turnId: first.turnId, error: expect.stringMatching(/denied.*Headless.*explicitly resend/) }))
    expect(emittedEvents.some(e => e.type === 'agent.status.changed' && e.scope === 'turn' && e.status === 'completed')).toBe(false)
    expect(emittedEvents.some(e => e.type === 'agent.status.changed' && e.scope === 'session' && e.status === 'error')).toBe(false)
    expect(writes).toHaveBeenCalledTimes(1)
    expect(lastSpawnArgs!.args).toContain('--sandbox')
    expect(lastSpawnArgs!.args).not.toContain('--dangerously-skip-permissions')
    expect(mockProc.killed).toBe(false)
    // Only a new explicit user input may advance this still-connected session.
    const second = await adapter.sendPrompt({ taskId: 'test-task-agy', text: 'Explain without tools' })
    expect(second.turnId).not.toBe(first.turnId)
    emit({ event: 'result', result: { status: 'SUCCESS', response: 'The earlier action was denied.' } })
    expect(writes).toHaveBeenCalledTimes(2)
    expect(emittedEvents).toContainEqual(expect.objectContaining({ type: 'agent.status.changed', scope: 'turn', status: 'completed', turnId: second.turnId }))
  })

  it('surfaces denied_actions without tool updates and fences callback sends while publishing the failed turn', async () => {
    let callbackSend: Promise<unknown> | undefined
    adapter = new AntigravityAdapter({ ...adapterOptions, onEvent: event => {
      emittedEvents.push(event)
      if (event.type === 'message.completed' && event.finishReason === 'error') {
        callbackSend = adapter.sendPrompt({ taskId: 'test-task-agy', text: 'Must not send inside completion' })
        void callbackSend.catch(() => {})
      }
    } })
    await adapter.start()
    const writes = vi.spyOn(mockProc.stdin, 'write')
    await adapter.sendPrompt({ taskId: 'test-task-agy', text: 'Denied operation' })
    mockProc.stdout.write(JSON.stringify({ event: 'result', result: { status: 'SUCCESS', response: 'I could not perform that action.', denied_actions: [{ action: 'command' }] } }) + '\n')
    expect(callbackSend).toBeDefined()
    await expect(callbackSend).rejects.toThrow(/busy/)
    expect(writes).toHaveBeenCalledTimes(1)
    expect(emittedEvents.filter(e => e.type === 'tool.completed')).toHaveLength(0)
    expect(emittedEvents).toContainEqual(expect.objectContaining({ type: 'message.completed', finishReason: 'error', fullContent: 'I could not perform that action.' }))
  })

  it('retains a failed tool error while allowing a later explanatory native response to complete', async () => {
    adapter = new AntigravityAdapter(adapterOptions)
    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-agy', text: 'Inspect a missing fixture' })
    mockProc.stdout.write(JSON.stringify({ event: 'step_update', step_update: { step_index: 5, step_type: 'tool', tool_name: 'view_file', state: 'ERROR', tool_info: { error: { type: 'TOOL_ERROR', message: 'Fixture file is missing' } } } }) + '\n')
    mockProc.stdout.write(JSON.stringify({ event: 'result', result: { status: 'SUCCESS', response: 'The requested fixture does not exist.' } }) + '\n')
    expect(emittedEvents.filter(e => e.type === 'tool.started')).toHaveLength(1)
    expect(emittedEvents.filter(e => e.type === 'tool.completed')).toEqual([expect.objectContaining({ isError: true, outcome: 'failed', output: 'Fixture file is missing' })])
    expect(emittedEvents).toContainEqual(expect.objectContaining({ type: 'message.completed', finishReason: 'stop', fullContent: 'The requested fixture does not exist.' }))
  })

  it('completes the turn with explicit identity without completing the persistent session', async () => {
    adapter = new AntigravityAdapter(adapterOptions)
    await adapter.start()

    await adapter.sendPrompt({
      taskId: 'test-task-agy',
      text: 'Calculate 2+2',
    })

    mockProc.stdout.write(
      JSON.stringify({
        event: 'step_update',
        step_update: {
          step_index: 1,
          state: 'ACTIVE',
          step_type: 'agent_response',
          text_delta: '4',
        },
      }) + '\n'
    )

    mockProc.stdout.write(
      JSON.stringify({
        event: 'result',
        result: {
          conversation_id: 'conv-1',
          status: 'SUCCESS',
          response: '4',
          num_turns: 1,
          duration_seconds: 1,
        },
      }) + '\n'
    )

    const completed = emittedEvents.find((e): e is MessageCompletedEvent => e.type === 'message.completed')
    expect(completed).toBeDefined()
    expect(completed?.finishReason).toBe('stop')

    expect(adapter.getActiveTurnId()).toBeUndefined()

    const terminalStatus = emittedEvents.find(
      (e): e is AgentStatusChangedEvent => e.type === 'agent.status.changed' && e.status === 'completed'
    )
    expect(terminalStatus).toMatchObject({ scope: 'turn', turnId: completed?.turnId })
    expect(emittedEvents.filter(e => e.type === 'agent.status.changed' && e.scope === 'session' && e.status === 'completed')).toEqual([])
  })

  it('allows the next prompt from turn completion after message finalization', async () => {
    let secondPromptTurnId: string | undefined
    adapter = new AntigravityAdapter({
      ...adapterOptions,
      onEvent: (evt) => {
        emittedEvents.push(evt)
        if (evt.type === 'agent.status.changed' && evt.scope === 'turn' && evt.status === 'completed') {
          void adapter.sendPrompt({ taskId: 'test-task-agy', text: 'Immediate second turn' })
            .then(res => { secondPromptTurnId = res.turnId })
            .catch(() => {})
        }
      },
    })

    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-agy', text: 'Turn 1' })

    mockProc.stdout.write(
      JSON.stringify({
        event: 'result',
        result: { status: 'SUCCESS', response: 'Done 1' },
      }) + '\n'
    )

    await vi.waitFor(() => {
      expect(secondPromptTurnId).toBeDefined()
    })
    expect(adapter.getActiveTurnId()).toBe(secondPromptTurnId)
  })

  it('emits running for each turn independently of the ready session', async () => {
    adapter = new AntigravityAdapter(adapterOptions)
    await adapter.start()

    // Turn 1
    await adapter.sendPrompt({ taskId: 'test-task-agy', text: 'Turn 1' })
    mockProc.stdout.write(
      JSON.stringify({
        event: 'result',
        result: { status: 'SUCCESS', response: 'Done 1' },
      }) + '\n'
    )

    // Turn 2
    await adapter.sendPrompt({ taskId: 'test-task-agy', text: 'Turn 2' })

    const runningStatuses = emittedEvents.filter(
      (e): e is AgentStatusChangedEvent => e.type === 'agent.status.changed' && e.status === 'running'
    )
    expect(runningStatuses.filter(e => e.scope === 'session')).toHaveLength(1)
    expect(runningStatuses.filter(e => e.scope === 'turn')).toHaveLength(2)
    expect(new Set(runningStatuses.filter(e => e.scope === 'turn').map(e => e.turnId)).size).toBe(2)
  })

  it('handles immediate result: ERROR by ensuring message.started, completing message with error, and completing open tools', async () => {
    adapter = new AntigravityAdapter(adapterOptions)
    await adapter.start()

    await adapter.sendPrompt({ taskId: 'test-task-agy', text: 'Start with open tool' })

    // Open tool
    mockProc.stdout.write(
      JSON.stringify({
        event: 'step_update',
        step_update: {
          step_index: 3,
          state: 'ACTIVE',
          step_type: 'tool',
          tool_name: 'read_url',
          tool_info: { parameters: { Url: 'http://test' } },
        },
      }) + '\n'
    )

    // Immediate error without prior agent_response text
    mockProc.stdout.write(
      JSON.stringify({
        event: 'result',
        result: {
          conversation_id: 'conv-1',
          status: 'ERROR',
          error: 'Model quota exhausted string message',
        },
      }) + '\n'
    )

    const msgStarted = emittedEvents.find((e): e is MessageStartedEvent => e.type === 'message.started')
    expect(msgStarted).toBeDefined()

    const toolDone = emittedEvents.find((e): e is ToolCompletedEvent => e.type === 'tool.completed')
    expect(toolDone).toBeDefined()
    expect(toolDone?.outcome).toBe('failed')
    expect(toolDone?.isError).toBe(true)

    const msgDone = emittedEvents.find((e): e is MessageCompletedEvent => e.type === 'message.completed')
    expect(msgDone).toBeDefined()
    expect(msgDone?.finishReason).toBe('error')

    const statusErr = emittedEvents.find(
      (e): e is AgentStatusChangedEvent => e.type === 'agent.status.changed' && e.status === 'error'
    )
    expect(statusErr).toBeDefined()
    expect(statusErr?.error).toBe('Model quota exhausted string message')
    expect(adapter.getActiveTurnId()).toBeUndefined()
  })

  it('deduplicates error status emission on close after result: ERROR', async () => {
    adapter = new AntigravityAdapter(adapterOptions)
    await adapter.start()

    await adapter.sendPrompt({ taskId: 'test-task-agy', text: 'Cause error and close' })

    mockProc.stdout.write(
      JSON.stringify({
        event: 'result',
        result: { status: 'ERROR', error: 'Fail' },
      }) + '\n'
    )

    mockProc.emit('close', 1, 'SIGTERM')

    const errorStatuses = emittedEvents.filter(
      (e): e is AgentStatusChangedEvent => e.type === 'agent.status.changed' && e.status === 'error'
    )
    expect(errorStatuses.filter(e => e.scope === 'session')).toHaveLength(1)
    expect(errorStatuses.filter(e => e.scope === 'turn')).toHaveLength(1)
  })

  it('handles result: CANCELED by emitting message.completed with finishReason interrupted', async () => {
    adapter = new AntigravityAdapter(adapterOptions)
    await adapter.start()

    await adapter.sendPrompt({ taskId: 'test-task-agy', text: 'Prompt to cancel' })

    mockProc.stdout.write(
      JSON.stringify({
        event: 'result',
        result: {
          conversation_id: 'conv-1',
          status: 'CANCELED',
        },
      }) + '\n'
    )

    const msgDone = emittedEvents.find((e): e is MessageCompletedEvent => e.type === 'message.completed')
    expect(msgDone).toBeDefined()
    expect(msgDone?.finishReason).toBe('interrupted')
    expect(adapter.getActiveTurnId()).toBeUndefined()
  })

  it.each(['RUNNING', 'WAITING'])('ends a failed turn on terminal result %s rather than staying busy forever', async status => {
    adapter = new AntigravityAdapter(adapterOptions)
    await adapter.start()
    const { turnId } = await adapter.sendPrompt({ taskId: 'test-task-agy', text: 'Ongoing turn' })
    mockProc.stdout.write(JSON.stringify({ event: 'result', result: { status } }) + '\n')
    expect(adapter.getActiveTurnId()).toBeUndefined()
    expect(emittedEvents).toContainEqual(expect.objectContaining({ type: 'agent.status.changed', scope: 'turn', status: 'error', turnId }))
  })

  it('safely ignores orphan step_updates or results when no turn is active', async () => {
    adapter = new AntigravityAdapter(adapterOptions)
    await adapter.start()

    // No active turn: write ghost events
    mockProc.stdout.write(
      JSON.stringify({
        event: 'step_update',
        step_update: { step_index: 99, state: 'ACTIVE', step_type: 'tool', tool_name: 'orphan' },
      }) + '\n'
    )

    mockProc.stdout.write(
      JSON.stringify({
        event: 'result',
        result: { status: 'SUCCESS', response: 'Ghost result' },
      }) + '\n'
    )

    const toolEvents = emittedEvents.filter(e => e.type === 'tool.started' || e.type === 'tool.completed')
    expect(toolEvents.length).toBe(0)

    const msgDoneEvents = emittedEvents.filter(e => e.type === 'message.completed')
    expect(msgDoneEvents.length).toBe(0)
  })

  it('halts step processing cleanly if callback invokes stop() during message.started', async () => {
    adapter = new AntigravityAdapter({
      ...adapterOptions,
      onEvent: (evt) => {
        emittedEvents.push(evt)
        if (evt.type === 'message.started') {
          void adapter.stop()
        }
      },
    })

    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-agy', text: 'Halt on start' })

    // When this step arrives, ensureMessageStarted fires, onEvent calls stop()
    mockProc.stdout.write(
      JSON.stringify({
        event: 'step_update',
        step_update: {
          step_index: 1,
          state: 'ACTIVE',
          step_type: 'agent_response',
          text_delta: 'Should be ignored after stop',
        },
      }) + '\n'
    )

    // Verify delta was not emitted with undefined messageId
    const deltas = emittedEvents.filter(e => e.type === 'message.delta')
    expect(deltas.length).toBe(0)
  })

  it('emits raw.log events when emitRawLogEvents is true for both stdout and stderr', async () => {
    adapter = new AntigravityAdapter(adapterOptions)
    await adapter.start()

    mockProc.stdout.write('diagnostic stdout line\n')
    mockProc.stderr.write('diagnostic stderr line\n')

    const rawEvents = emittedEvents.filter((e): e is RawLogEvent => e.type === 'raw.log')
    expect(rawEvents.some(e => e.stream === 'stdout' && e.line === 'diagnostic stdout line')).toBe(true)
    expect(rawEvents.some(e => e.stream === 'stderr' && e.line === 'diagnostic stderr line')).toBe(true)
  })

  it('finalizes incomplete tools and active message when process unexpectedly crashes mid-turn', async () => {
    adapter = new AntigravityAdapter(adapterOptions)
    await adapter.start()

    await adapter.sendPrompt({ taskId: 'test-task-agy', text: 'Long command' })

    // Open a tool
    mockProc.stdout.write(
      JSON.stringify({
        event: 'step_update',
        step_update: {
          step_index: 10,
          state: 'ACTIVE',
          step_type: 'tool',
          tool_name: 'bash',
          tool_info: { parameters: { cmd: 'sleep 10' } },
        },
      }) + '\n'
    )

    // Process abruptly exits
    mockProc.emit('close', 1, 'SIGKILL')

    const toolDone = emittedEvents.find((e): e is ToolCompletedEvent => e.type === 'tool.completed')
    expect(toolDone).toBeDefined()
    expect(toolDone?.outcome).toBe('failed')
    expect(toolDone?.isError).toBe(true)

    const msgDone = emittedEvents.find((e): e is MessageCompletedEvent => e.type === 'message.completed')
    expect(msgDone).toBeDefined()
    expect(msgDone?.finishReason).toBe('error')
    expect(adapter.getActiveTurnId()).toBeUndefined()
  })

  it('drains buffered stdout records when exit fires before close without losing completion', async () => {
    adapter = new AntigravityAdapter(adapterOptions)
    await adapter.start()

    await adapter.sendPrompt({ taskId: 'test-task-agy', text: 'Process exit race' })

    // Exit event fires first
    mockProc.emit('exit', 0, null)

    // Asynchronous stdout arrival before close
    await new Promise((resolve) => setTimeout(resolve, 50))

    mockProc.stdout.write(
      JSON.stringify({
        event: 'result',
        result: { status: 'SUCCESS', response: 'Completed right at exit' },
      }) + '\n'
    )

    mockProc.emit('close', 0, null)

    const msgDone = emittedEvents.find((e): e is MessageCompletedEvent => e.type === 'message.completed')
    expect(msgDone).toBeDefined()
    expect(msgDone?.finishReason).toBe('stop')
    expect(msgDone?.fullContent).toBe('Completed right at exit')
  })

  it('guarantees callback reentrancy safety: calling stop() in onEvent does not double-emit message.completed', async () => {
    adapter = new AntigravityAdapter({
      ...adapterOptions,
      onEvent: (evt) => {
        emittedEvents.push(evt)
        if (evt.type === 'message.completed') {
          void adapter.stop()
        }
      },
    })

    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-agy', text: 'Stop inside callback' })

    mockProc.stdout.write(
      JSON.stringify({
        event: 'result',
        result: { status: 'SUCCESS', response: 'Done' },
      }) + '\n'
    )

    const completedEvents = emittedEvents.filter(e => e.type === 'message.completed')
    expect(completedEvents.length).toBe(1)
  })

  it('rejects resolveApproval as unsupported capability for stream-json mode', async () => {
    adapter = new AntigravityAdapter(adapterOptions)
    await adapter.start()

    await expect(
      adapter.resolveApproval('any-approval-id', 'allow')
    ).rejects.toThrow(/not supported/i)
  })

  it('exposes correct capability profile', () => {
    adapter = new AntigravityAdapter(adapterOptions)
    const caps = adapter.getCapabilities()

    expect(caps).toEqual({
      textStreaming: true,
      toolCalls: true,
      thinkingStreaming: false,
      toolOutputStreaming: false,
      interactiveApprovals: false,
      attachments: false,
    })
  })

  it('handles multi-byte UTF-8 sequences split directly across a 2-byte Cyrillic character', async () => {
    adapter = new AntigravityAdapter(adapterOptions)
    await adapter.start()

    await adapter.sendPrompt({ taskId: 'test-task-agy', text: 'Russian text' })

    const fullLine = JSON.stringify({
      event: 'step_update',
      step_update: {
        step_index: 1,
        state: 'ACTIVE',
        step_type: 'agent_response',
        text_delta: 'Привет мир',
      },
    }) + '\n'

    const buffer = Buffer.from(fullLine, 'utf8')
    const d0Index = buffer.indexOf(0xd0)
    expect(d0Index).toBeGreaterThan(-1)

    const part1 = buffer.subarray(0, d0Index + 1)
    const part2 = buffer.subarray(d0Index + 1)

    mockProc.stdout.write(part1)
    mockProc.stdout.write(part2)

    const delta = emittedEvents.find((e): e is MessageDeltaEvent => e.type === 'message.delta')
    expect(delta).toBeDefined()
    expect(delta?.content).toBe('Привет мир')
  })

  it('escalates to SIGKILL if stop(true) is invoked during graceful shutdown', async () => {
    const stubbornProc = new StubbornChildProcess()

    adapter = new AntigravityAdapter({
      ...adapterOptions,
      killTimeoutMs: 5000,
      spawnProcess: () => stubbornProc as unknown as import('child_process').ChildProcess,
    })

    await adapter.start()

    // Graceful stop
    void adapter.stop(false)
    expect(stubbornProc.stdin.writableEnded).toBe(true)
    expect(stubbornProc.signalsReceived).toEqual([])

    // Immediate force stop escalation
    await adapter.stop(true)
    expect(stubbornProc.signalsReceived).toContain('SIGKILL')
  })

  it('rejects start() if adapter was stopped and stop is idempotent', async () => {
    adapter = new AntigravityAdapter(adapterOptions)
    await adapter.start()
    await adapter.stop()
    await adapter.stop()

    await expect(adapter.start()).rejects.toThrow(/adapter has been stopped/i)
  })

  it('isolates onEvent and onRawLog callback exceptions without breaking stream parsing', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    adapter = new AntigravityAdapter({
      ...adapterOptions,
      onRawLog: () => {
        throw new Error('Explosive raw log callback!')
      },
      onEvent: (evt) => {
        if (evt.type === 'message.delta') {
          throw new Error('Listener explosive error!')
        }
        emittedEvents.push(evt)
      },
    })

    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-agy', text: 'Resilience test' })

    mockProc.stdout.write(
      JSON.stringify({
        event: 'step_update',
        step_update: {
          step_index: 1,
          state: 'ACTIVE',
          step_type: 'agent_response',
          text_delta: 'Hello',
        },
      }) + '\n'
    )

    mockProc.stdout.write(
      JSON.stringify({
        event: 'result',
        result: { status: 'SUCCESS', response: 'Hello' },
      }) + '\n'
    )

    const completed = emittedEvents.find((e): e is MessageCompletedEvent => e.type === 'message.completed')
    expect(completed).toBeDefined()
    expect(completed?.finishReason).toBe('stop')
    errorSpy.mockRestore()
  })

  it('processes multiple valid lines in one chunk without discarding them when total chunk size exceeds limit', async () => {
    // The init record includes the real TMPDIR path, which is longer in QA.
    // Size the budget from that record and keep the batch independently larger.
    const initLine = JSON.stringify({ event: 'init', conversation_id: 'conv-1', init: { cwd: testWorktree } })
    const lineLimit = Math.max(256, Buffer.byteLength(initLine) + 1)
    const firstText = 'A'.repeat(Math.floor(lineLimit / 4))
    const secondText = 'B'.repeat(Math.floor(lineLimit / 4))
    const line1 = JSON.stringify({ event: 'step_update', step_update: { step_index: 1, state: 'ACTIVE', step_type: 'agent_response', text_delta: firstText } })
    const line2 = JSON.stringify({ event: 'step_update', step_update: { step_index: 1, state: 'ACTIVE', step_type: 'agent_response', text_delta: secondText } })
    const line3 = JSON.stringify({ event: 'result', result: { status: 'SUCCESS', response: firstText + secondText } })
    const batch = `${line1}\n${line2}\n${line3}\n`
    for (const line of [initLine, line1, line2, line3]) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(lineLimit)
    expect(Buffer.byteLength(batch)).toBeGreaterThan(lineLimit)

    adapter = new AntigravityAdapter({
      ...adapterOptions,
      maxLineBufferBytes: lineLimit,
    })

    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-agy', text: 'Batch test' })

    mockProc.stdout.write(batch)

    const deltas = emittedEvents.filter((e): e is MessageDeltaEvent => e.type === 'message.delta')
    expect(deltas.length).toBe(2)

    const completed = emittedEvents.find((e): e is MessageCompletedEvent => e.type === 'message.completed')
    expect(completed).toBeDefined()
    expect(completed?.finishReason).toBe('stop')
    expect(completed?.fullContent).toBe(firstText + secondText)
  })

  it('discards oversized line remainder and ignores tail until newline, preserving subsequent valid lines', async () => {
    // The required init.cwd contains a real temporary path; keep initialization
    // below the limit while still exceeding it with the fragmented junk record.
    const lineLimit = 256
    adapter = new AntigravityAdapter({
      ...adapterOptions,
      maxLineBufferBytes: lineLimit,
    })

    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-agy', text: 'Discard remainder test' })

    mockProc.stdout.write('x'.repeat(lineLimit + 20))

    // A newline ends the discarded record; the next valid result must survive.
    const validLine = JSON.stringify({ event: 'result', result: { status: 'SUCCESS', response: 'Valid recovered' } })
    mockProc.stdout.write('junk_tail_continues\n' + validLine + '\n')

    const completed = emittedEvents.find((e): e is MessageCompletedEvent => e.type === 'message.completed')
    expect(completed).toBeDefined()
    expect(completed?.fullContent).toBe('Valid recovered')
  })

  it('rejects stop() and preserves tracking if process refuses to exit after timeout', async () => {
    const unkillableProc = Object.assign(new EventEmitter(), {
      pid: 77777,
      stdin: new PassThrough(),
      stdout: protocolStdout(),
      stderr: new PassThrough(),
      exitCode: null,
      signalCode: null,
      kill: () => true,
    }) as unknown as import('child_process').ChildProcess

    adapter = new AntigravityAdapter({
      ...adapterOptions,
      killTimeoutMs: 50,
      spawnProcess: () => unkillableProc,
    })

    await adapter.start()
    expect(adapter.getPid()).toBe(77777)

    await expect(adapter.stop(false)).rejects.toThrow(/Failed to terminate child process/i)
    expect(adapter.getPid()).toBe(77777)
  })

  it('rejects stop() and logs error if proc.kill throws', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const throwingProc = Object.assign(new EventEmitter(), {
      pid: 88888,
      stdin: new PassThrough(),
      stdout: protocolStdout(),
      stderr: new PassThrough(),
      exitCode: null,
      signalCode: null,
      kill: () => {
        throw new Error('EPERM: Operation not permitted')
      },
    }) as unknown as import('child_process').ChildProcess

    adapter = new AntigravityAdapter({
      ...adapterOptions,
      spawnProcess: () => throwingProc,
    })

    await adapter.start()
    await expect(adapter.stop(false)).rejects.toThrow('EPERM: Operation not permitted')
    expect(adapter.getPid()).toBe(88888)
    errorSpy.mockRestore()
  })

  it('handles synchronous throw in stdin write', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const stdinPass = new PassThrough()
    ;(stdinPass as unknown as { write: (chunk: unknown) => boolean }).write = () => {
      throw new Error('Sync stdin crash')
    }
    const badStdinProc = Object.assign(new EventEmitter(), {
      pid: 99999,
      stdin: stdinPass,
      stdout: protocolStdout(),
      stderr: new PassThrough(),
      exitCode: null,
      signalCode: null,
      kill: () => true,
    }) as unknown as import('child_process').ChildProcess

    adapter = new AntigravityAdapter({
      ...adapterOptions,
      spawnProcess: () => badStdinProc,
    })

    await adapter.start()
    await expect(adapter.sendPrompt({ taskId: 'test-task-agy', text: 'Boom' })).rejects.toThrow('Sync stdin crash')
    errorSpy.mockRestore()
  })

  it('finalizes previous active turn when start() replaces old active generation', async () => {
    let callCount = 0
    const procs: MockChildProcess[] = []

    adapter = new AntigravityAdapter({
      ...adapterOptions,
      spawnProcess: () => {
        callCount++
        const p = new MockChildProcess()
        p.pid = 2000 + callCount
        procs.push(p)
        return p as unknown as import('child_process').ChildProcess
      },
    })

    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-agy', text: 'Turn before replace' })

    // Simulate old process exit code so it is considered dead
    procs[0].exitCode = 1

    await adapter.start()

    const abortMsg = emittedEvents.find((e): e is MessageCompletedEvent => e.type === 'message.completed' && e.finishReason === 'interrupted')
    expect(abortMsg).toBeDefined()
    expect(adapter.getPid()).toBe(2002)
  })

  it('handles asynchronous exit delivery after SIGKILL escalation', async () => {
    const asyncKillProc = Object.assign(new EventEmitter(), {
      pid: 65432,
      stdin: new PassThrough(),
      stdout: protocolStdout(),
      stderr: new PassThrough(),
      exitCode: null,
      signalCode: null,
      kill: (signal?: string | number) => {
        if (signal === 'SIGKILL') {
          setTimeout(() => {
            (asyncKillProc as unknown as { exitCode: number | null }).exitCode = 137
            ;(asyncKillProc as unknown as { signalCode: string | null }).signalCode = 'SIGKILL'
            asyncKillProc.emit('exit', 137, 'SIGKILL')
            asyncKillProc.emit('close', 137, 'SIGKILL')
          }, 20)
        }
        return true
      },
    }) as unknown as import('child_process').ChildProcess

    adapter = new AntigravityAdapter({
      ...adapterOptions,
      killTimeoutMs: 50,
      spawnProcess: () => asyncKillProc,
    })

    await adapter.start()
    expect(adapter.getPid()).toBe(65432)

    await adapter.stop(false)
    expect(adapter.getPid()).toBeUndefined()
  })

  it('prevents restarting with a new process if previous process failed termination', async () => {
    let killed = false
    const stubbornProc = Object.assign(new EventEmitter(), {
      pid: 65433,
      stdin: new PassThrough(),
      stdout: protocolStdout(),
      stderr: new PassThrough(),
      exitCode: null,
      signalCode: null,
      kill: () => {
        killed = true
        return true
      },
    }) as unknown as import('child_process').ChildProcess

    adapter = new AntigravityAdapter({
      ...adapterOptions,
      killTimeoutMs: 30,
      spawnProcess: () => stubbornProc,
    })

    await adapter.start()
    await expect(adapter.stop(false)).rejects.toThrow(/Failed to terminate child process/i)
    expect(killed).toBe(true)
    expect(adapter.getPid()).toBe(65433)

    await expect(adapter.start()).rejects.toThrow(/adapter has been stopped|Failed to terminate child process/i)
  })

  it('blocks new prompt submissions during error completion callbacks', async () => {
    let callbackPromise: Promise<unknown> | null = null
    let callbackExecuted = false

    adapter = new AntigravityAdapter({
      ...adapterOptions,
      onEvent: (evt) => {
        emittedEvents.push(evt)
        if (evt.type === 'message.completed' && evt.finishReason === 'error') {
          callbackExecuted = true
          callbackPromise = adapter.sendPrompt({ taskId: 'test-task-agy', text: 'Another prompt' })
        }
      },
    })

    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-agy', text: 'Prompt that errors' })

    mockProc.stdout.write(
      JSON.stringify({
        event: 'result',
        result: {
          conversation_id: 'conv-1',
          status: 'ERROR',
          error: 'Simulated runtime error',
        },
      }) + '\n'
    )

    expect(callbackExecuted).toBe(true)
    expect(adapter.getCurrentStatus()).toBe('error')
    expect(callbackPromise).not.toBeNull()
    await expect(callbackPromise).rejects.toThrow(/Cannot send prompt: adapter is in error state/)
  })

  it('allows retrying stop(true) after a previous stop failure', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    let shouldFailKill = true
    const retryProc = Object.assign(new EventEmitter(), {
      pid: 65434,
      stdin: new PassThrough(),
      stdout: protocolStdout(),
      stderr: new PassThrough(),
      exitCode: null,
      signalCode: null,
      kill: (signal?: string | number) => {
        if (shouldFailKill) {
          throw new Error('EPERM: Cannot kill')
        }
        if (signal === 'SIGKILL') {
          setTimeout(() => {
            (retryProc as unknown as { exitCode: number | null }).exitCode = 137
            ;(retryProc as unknown as { signalCode: string | null }).signalCode = 'SIGKILL'
            retryProc.emit('exit', 137, 'SIGKILL')
            retryProc.emit('close', 137, 'SIGKILL')
          }, 10)
        }
        return true
      },
    }) as unknown as import('child_process').ChildProcess

    adapter = new AntigravityAdapter({
      ...adapterOptions,
      killTimeoutMs: 30,
      spawnProcess: () => retryProc,
    })

    await adapter.start()
    await expect(adapter.stop(false)).rejects.toThrow('EPERM: Cannot kill')

    shouldFailKill = false
    await adapter.stop(true)
    expect(adapter.getPid()).toBeUndefined()
    errorSpy.mockRestore()
  })

  it('guards against reentrancy when stop is called inside tool.completed callback during SUCCESS', async () => {
    let stopCalledInCallback = false
    adapter = new AntigravityAdapter({
      ...adapterOptions,
      onEvent: (evt) => {
        emittedEvents.push(evt)
        if (evt.type === 'tool.completed' && !stopCalledInCallback) {
          stopCalledInCallback = true
          void adapter.stop(false)
        }
      },
    })

    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-agy', text: 'Run tool' })

    mockProc.stdout.write(
      JSON.stringify({
        event: 'step_update',
        step_update: {
          step_index: 0,
          state: 'ACTIVE',
          step_type: 'tool',
          tool_name: 'execute_command',
          tool_info: { parameters: { command: 'echo hello' } },
        },
      }) + '\n'
    )

    mockProc.stdout.write(
      JSON.stringify({
        event: 'result',
        result: {
          conversation_id: 'conv-1',
          status: 'SUCCESS',
          response: 'All done',
        },
      }) + '\n'
    )

    const messageCompletedEvents = emittedEvents.filter((e) => e.type === 'message.completed')
    expect(messageCompletedEvents.length).toBeLessThanOrEqual(1)
  })

  it('deduplicates concurrent start() calls during old process teardown', async () => {
    let callCount = 0
    const procs: MockChildProcess[] = []

    adapter = new AntigravityAdapter({
      ...adapterOptions,
      killTimeoutMs: 50,
      spawnProcess: () => {
        callCount++
        const p = new MockChildProcess()
        p.pid = 3000 + callCount
        procs.push(p)
        return p as unknown as import('child_process').ChildProcess
      },
    })

    await adapter.start()
    expect(adapter.getPid()).toBe(3001)

    // Generation was retired (e.g. after error or stdin crash), but process hasn't finished terminating yet
    ;(adapter as unknown as { activeGen: { retired: boolean } }).activeGen.retired = true

    // Trigger two concurrent restarts
    const [res1, res2] = await Promise.all([adapter.start(), adapter.start()])
    expect(res1.pid).toBe(3002)
    expect(res2.pid).toBe(3002)
    expect(callCount).toBe(2)
  })

  it('rejects sendPrompt immediately if invoked during stop() shutdown callbacks', async () => {
    let sendPromptError: Error | null = null
    adapter = new AntigravityAdapter({
      ...adapterOptions,
      onEvent: (evt) => {
        emittedEvents.push(evt)
        if (evt.type === 'message.completed' && evt.finishReason === 'interrupted') {
          adapter.sendPrompt({ taskId: 'test-task-agy', text: 'Prompt during stop' }).catch((err) => {
            sendPromptError = err
          })
        }
      },
    })

    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-agy', text: 'Prompt before stop' })

    await adapter.stop(false)

    expect(sendPromptError).not.toBeNull()
    expect((sendPromptError as unknown as Error)?.message).toMatch(
      /Cannot send prompt: adapter is not started or has stopped/
    )
  })

  it('enforces 1 MB default line buffer limit when maxLineBufferBytes is omitted', async () => {
    adapter = new AntigravityAdapter({
      ...adapterOptions,
      maxLineBufferBytes: undefined,
      spawnProcess: () => mockProc as unknown as import('child_process').ChildProcess,
    })

    await adapter.start()

    // 1 MB + 10 bytes line should be discarded
    const oversizedChunk = 'A'.repeat(1024 * 1024 + 10) + '\n'
    mockProc.stdout.write(oversizedChunk)

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    // Valid small line should be accepted
    const validJson = JSON.stringify({ event: 'init', conversation_id: 'conv-1', init: { cwd: testWorktree } }) + '\n'
    mockProc.stdout.write(validJson)

    expect(adapter.getConversationId()).toBe('conv-1')
    warnSpy.mockRestore()
  })

  it('resets the persistent session to ready only after successful restart initialization', async () => {
    let callCount = 0
    const procs: MockChildProcess[] = []

    adapter = new AntigravityAdapter({
      ...adapterOptions,
      onEvent: (evt) => emittedEvents.push(evt),
      spawnProcess: () => {
        callCount++
        const p = new MockChildProcess()
        p.pid = 4000 + callCount
        procs.push(p)
        return p as unknown as import('child_process').ChildProcess
      },
    })

    await adapter.start()
    expect(adapter.getStatus()).toBe('running')

    // Simulate process error crash
    procs[0].emit('error', new Error('Simulated process crash'))
    expect(adapter.getStatus()).toBe('error')

    // Restart adapter
    emittedEvents.length = 0
    const restartRes = await adapter.start()
    expect(restartRes.pid).toBe(4002)
    expect(adapter.getStatus()).toBe('running')

    const idleEvent = emittedEvents.find(
      (e) => e.type === 'agent.status.changed' && (e as AgentStatusChangedEvent).status === 'running' && (e as AgentStatusChangedEvent).scope === 'session'
    )
    expect(idleEvent).toBeDefined()

    // Subsequent prompt should succeed without being rejected due to error state
    const promptRes = await adapter.sendPrompt({
      taskId: 'test-task-agy',
      text: 'Prompt after error recovery',
    })
    expect(promptRes.turnId).toBeDefined()
    expect(adapter.getStatus()).toBe('running')
  })
})
