import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { EventEmitter } from 'events'
import { PassThrough } from 'stream'
import {
  ClaudeAdapter,
  ClaudeAdapterOptions,
} from '../ClaudeAdapter'
import { ProcessSupervisor } from '../../runtime/ProcessSupervisor'
import { EventJournal } from '../../runtime/EventJournal'
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

const TEST_JOURNAL_DIR = path.join(os.tmpdir(), 'ziaforge-claude-test-journals')
function createTestJournalDir(prefix: string): string {
  fs.mkdirSync(TEST_JOURNAL_DIR, { recursive: true })
  return fs.mkdtempSync(path.join(TEST_JOURNAL_DIR, prefix))
}

class MockChildProcess extends EventEmitter {
  pid = 64321
  stdin = new PassThrough()
  stdout = new PassThrough()
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
  stdout = new PassThrough()
  stderr = new PassThrough()
  killed = false
  exitCode: number | null = null
  signalCode: string | null = null

  kill(signal: NodeJS.Signals | number = 'SIGTERM') {
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

function createAdapter(options: ClaudeAdapterOptions): ClaudeAdapter {
  const spawn = options.spawnProcess!
  return new ClaudeAdapter({ ...options, spawnProcess: (command, args, config) => {
    const proc = spawn(command, args, config)
    const write = proc.stdin?.write.bind(proc.stdin)
    if (proc.stdin && write) proc.stdin.write = ((chunk: unknown, ...rest: unknown[]) => {
      let record: { type?: string; request_id?: string; request?: { subtype?: string } } = {}
      try { record = JSON.parse(String(chunk)) } catch { /* raw parser fixture */ }
      if (record.type === 'control_request' && record.request?.subtype === 'initialize') {
        queueMicrotask(() => {
          proc.stdout?.emit('data', Buffer.from(JSON.stringify({ type: 'control_response', response: { subtype: 'success', request_id: record.request_id, response: {} } }) + '\n'))
          const callback = rest.find(value => typeof value === 'function') as (() => void) | undefined
          callback?.()
        })
        return true
      }
      return (write as (...args: unknown[]) => boolean)(chunk, ...rest)
    }) as typeof proc.stdin.write
    return proc
  } })
}

describe('ClaudeAdapter', () => {
  let mockProc: MockChildProcess
  let emittedEvents: AgentEvent[]
  let rawLogs: { stream: 'stdout' | 'stderr'; line: string }[]
  let adapter: ClaudeAdapter
  let adapterOptions: ClaudeAdapterOptions
  let lastSpawnArgs: { command: string; args: string[]; options: Record<string, unknown> } | null = null

  beforeEach(() => {
    mockProc = new MockChildProcess()
    emittedEvents = []
    rawLogs = []
    lastSpawnArgs = null

    const mockSupervisor = {
      killProcessTree: vi.fn(),
      terminateProcessTree: vi.fn().mockResolvedValue(true),
    } as unknown as ProcessSupervisor

    adapterOptions = {
      taskId: 'test-task-claude',
      runId: 'test-run-claude',
      worktreePath: '/mock/worktree',
      claudeBinPath: 'claude',
      emitRawLogEvents: true,
      supervisor: mockSupervisor,
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
  })

  it('starts process with -p --input-format stream-json --output-format stream-json --include-partial-messages --verbose', async () => {
    adapter = createAdapter(adapterOptions)

    const res = await adapter.start()
    expect(res.pid).toBe(64321)
    expect(lastSpawnArgs).toBeDefined()
    expect(lastSpawnArgs!.command).toBe('claude')
    expect(lastSpawnArgs!.args).toEqual([
      '-p',
      '--input-format',
      'stream-json',
      '--output-format',
      'stream-json',
      '--include-partial-messages',
      '--verbose',
      '--permission-prompt-tool', 'stdio',
      '--permission-mode', 'default',
    ])
    expect(lastSpawnArgs!.options.cwd).toBe('/mock/worktree')
  })

  it('disables built-ins, external MCP and skills for report-only sessions and denies unexpected permission requests', async () => {
    adapter = createAdapter({ ...adapterOptions, toolPolicy: 'none', permissionMode: 'bypassPermissions' })
    await adapter.start()
    const args = lastSpawnArgs!.args
    for (const [flag, value] of [['--tools', ''], ['--mcp-config', '{"mcpServers":{}}'], ['--setting-sources', ''], ['--permission-mode', 'dontAsk']]) expect(args.slice(args.indexOf(flag), args.indexOf(flag) + 2)).toEqual([flag, value])
    expect(args).toContain('--strict-mcp-config'); expect(args).toContain('--disable-slash-commands')
    expect(adapter.getCapabilities()).toMatchObject({ toolCalls: false, interactiveApprovals: false })
    const wire: string[] = []; mockProc.stdin.on('data', chunk => wire.push(String(chunk)))
    await adapter.sendPrompt({ taskId: adapterOptions.taskId, text: 'Reports only' })
    mockProc.stdout.write(JSON.stringify({ type: 'control_request', request_id: 'unexpected-tool', request: { subtype: 'can_use_tool', tool_name: 'Read', input: { file_path: '/forbidden' } } }) + '\n')
    await vi.waitFor(() => expect(wire.join('')).toContain('"behavior":"deny"'))
    expect(emittedEvents.some(event => event.type === 'permission.requested')).toBe(false)
    await expect(adapter.resolveApproval('unexpected-tool', 'allow')).rejects.toThrow('Tools are disabled')
    mockProc.stdout.write(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', id: 'forbidden', name: 'Read', input: { file_path: '/forbidden' } }] } }) + '\n')
    await vi.waitFor(() => expect(emittedEvents.some(event => event.type === 'agent.status.changed' && event.status === 'error' && event.error?.includes('tool-free'))).toBe(true))
    expect(emittedEvents.some(event => event.type === 'tool.started')).toBe(false)
  })

  it('passes native session effort independently from its read-only permission mode', async () => {
    adapter = createAdapter({ ...adapterOptions, reasoningEffort: 'max', permissionMode: 'plan' })
    await adapter.start()
    const args = lastSpawnArgs!.args
    expect(args.slice(args.indexOf('--effort'), args.indexOf('--effort') + 2)).toEqual(['--effort', 'max'])
    expect(args.slice(args.indexOf('--permission-mode'), args.indexOf('--permission-mode') + 2)).toEqual(['--permission-mode', 'plan'])
    expect(() => createAdapter({ ...adapterOptions, reasoningEffort: 'ultra' })).toThrow(/does not support/)
  })

  it('passes --model flag when model option is specified', async () => {
    adapter = createAdapter({
      ...adapterOptions,
      model: 'claude-3-5-sonnet-latest',
    })

    await adapter.start()
    expect(lastSpawnArgs!.args).toContain('--model')
    expect(lastSpawnArgs!.args).toContain('claude-3-5-sonnet-latest')
  })

  it('deduplicates concurrent start calls', async () => {
    adapter = createAdapter(adapterOptions)

    const [res1, res2] = await Promise.all([adapter.start(), adapter.start()])
    expect(res1.pid).toBe(64321)
    expect(res2.pid).toBe(64321)
  })

  it('processes system init event and captures sessionId', async () => {
    adapter = createAdapter(adapterOptions)
    await adapter.start()

    mockProc.stdout.write(
      JSON.stringify({
        type: 'system',
        subtype: 'init',
        session_id: 'claude-sess-999',
        claude_code_version: '2.1.114',
      }) + '\n'
    )

    expect(adapter.getSessionId()).toBe('claude-sess-999')
  })

  it('sends prompt formatted as stream-json user message over stdin with uuid', async () => {
    adapter = createAdapter(adapterOptions)
    await adapter.start()

    let writtenData = ''
    mockProc.stdin.on('data', (chunk) => {
      writtenData += chunk.toString()
    })

    const { turnId } = await adapter.sendPrompt({
      taskId: 'test-task-claude',
      text: 'Analyze the architecture',
    })

    expect(turnId).toBeDefined()
    expect(writtenData).toContain('"type":"user"')
    expect(writtenData).toContain('"content":"Analyze the architecture"')
    expect(writtenData).toContain('"uuid":')
    expect(adapter.getCurrentStatus()).toBe('running')
  })

  it('rejects prompt if attachments are passed', async () => {
    adapter = createAdapter(adapterOptions)
    await adapter.start()

    await expect(
      adapter.sendPrompt({
        taskId: 'test-task-claude',
        text: 'Hello',
        attachments: ['/path/to/img.png'],
      })
    ).rejects.toThrow(/Attachments are not supported/i)
  })

  it('rejects concurrent prompts while an active turn is in flight', async () => {
    adapter = createAdapter(adapterOptions)
    await adapter.start()

    await adapter.sendPrompt({ taskId: 'test-task-claude', text: 'First' })

    await expect(
      adapter.sendPrompt({ taskId: 'test-task-claude', text: 'Second' })
    ).rejects.toThrow(/turn is already in progress/i)
  })

  it('streams text_delta from stream_event into message.started and message.delta', async () => {
    adapter = createAdapter(adapterOptions)
    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-claude', text: 'Hello' })

    // stream_event: message_start
    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        uuid: 'evt-1',
        session_id: 'sess-1',
        event: {
          type: 'message_start',
          message: { id: 'msg_01', model: 'claude-3-5-sonnet', content: [] },
        },
      }) + '\n'
    )

    // stream_event: content_block_start text
    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        uuid: 'evt-2',
        session_id: 'sess-1',
        event: {
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'text', text: '' },
        },
      }) + '\n'
    )

    // stream_event: content_block_delta text_delta
    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        uuid: 'evt-3',
        session_id: 'sess-1',
        event: {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: 'Hello, ' },
        },
      }) + '\n'
    )

    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        uuid: 'evt-4',
        session_id: 'sess-1',
        event: {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: 'world!' },
        },
      }) + '\n'
    )

    const msgStart = emittedEvents.find((e): e is MessageStartedEvent => e.type === 'message.started')
    expect(msgStart).toBeDefined()
    expect(msgStart?.role).toBe('assistant')

    const deltas = emittedEvents.filter((e): e is MessageDeltaEvent => e.type === 'message.delta')
    expect(deltas.length).toBe(2)
    expect(deltas[0].content).toBe('Hello, ')
    expect(deltas[1].content).toBe('world!')
  })

  it('streams thinking_delta into message.delta with deltaType: thinking', async () => {
    adapter = createAdapter(adapterOptions)
    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-claude', text: 'Deep prompt' })

    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        uuid: 'evt-t1',
        session_id: 'sess-1',
        event: {
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'thinking', thinking: '' },
        },
      }) + '\n'
    )

    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        uuid: 'evt-t2',
        session_id: 'sess-1',
        event: {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'thinking_delta', thinking: 'Evaluating options...' },
        },
      }) + '\n'
    )

    const delta = emittedEvents.find(
      (e): e is MessageDeltaEvent => e.type === 'message.delta' && e.deltaType === 'thinking'
    )
    expect(delta).toBeDefined()
    expect(delta?.content).toBe('Evaluating options...')
  })

  it('handles tool_use block start and accumulates input deltas, then completes tool via user tool_result', async () => {
    adapter = createAdapter(adapterOptions)
    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-claude', text: 'Run bash command' })

    // 1. Tool start
    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        uuid: 'evt-tool-1',
        session_id: 'sess-1',
        event: {
          type: 'content_block_start',
          index: 0,
          content_block: {
            type: 'tool_use',
            id: 'toolu_123',
            name: 'Bash',
            input: {},
          },
        },
      }) + '\n'
    )
    // 2. Input JSON deltas
    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        uuid: 'evt-tool-2',
        session_id: 'sess-1',
        event: {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'input_json_delta', partial_json: '{"command":"ls ' },
        },
      }) + '\n'
    )

    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        uuid: 'evt-tool-3',
        session_id: 'sess-1',
        event: {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'input_json_delta', partial_json: '-la"}' },
        },
      }) + '\n'
    )

    // 3. content_block_stop seals tool call and emits tool.started with parsed input
    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        uuid: 'evt-tool-4',
        session_id: 'sess-1',
        event: {
          type: 'content_block_stop',
          index: 0,
        },
      }) + '\n'
    )

    const msgStartedIdx = emittedEvents.findIndex((e) => e.type === 'message.started')
    const toolStartedIdx = emittedEvents.findIndex((e) => e.type === 'tool.started')
    expect(msgStartedIdx).toBeGreaterThanOrEqual(0)
    expect(toolStartedIdx).toBeGreaterThan(msgStartedIdx)
    const toolStarted = emittedEvents[toolStartedIdx] as ToolStartedEvent
    expect(toolStarted.toolCallId).toBe('toolu_123')
    expect(toolStarted.toolName).toBe('Bash')
    expect(toolStarted.input).toEqual({ command: 'ls -la' })

    // Tool should not be marked completed yet (it is executing)
    expect(emittedEvents.find((e) => e.type === 'tool.completed')).toBeUndefined()

    // 4. Claude emits user record with tool_result
    mockProc.stdout.write(
      JSON.stringify({
        type: 'user',
        uuid: 'evt-user-1',
        session_id: 'sess-1',
        message: {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'toolu_123',
              content: 'total 0\ndrwxr-xr-x .',
              is_error: false,
            },
          ],
        },
      }) + '\n'
    )

    const toolDone = emittedEvents.find((e): e is ToolCompletedEvent => e.type === 'tool.completed')
    expect(toolDone).toBeDefined()
    expect(toolDone?.toolCallId).toBe('toolu_123')
    expect(toolDone?.output).toBe('total 0\ndrwxr-xr-x .')
    expect(toolDone?.isError).toBe(false)
    expect(toolDone?.outcome).toBe('completed')
  })

  it('deduplicates assistant snapshot that matches already-emitted streamed text', async () => {
    adapter = createAdapter(adapterOptions)
    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-claude', text: 'Hello' })

    // Stream text delta
    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        uuid: 'evt-s1',
        event: {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: 'Fully streamed text.' },
        },
      }) + '\n'
    )

    expect(emittedEvents.filter((e) => e.type === 'message.delta').length).toBe(1)

    // Completed assistant snapshot arrives
    mockProc.stdout.write(
      JSON.stringify({
        type: 'assistant',
        uuid: 'evt-a1',
        message: {
          id: 'msg_01',
          role: 'assistant',
          content: [{ type: 'text', text: 'Fully streamed text.' }],
        },
      }) + '\n'
    )

    // Should NOT emit duplicate delta
    expect(emittedEvents.filter((e) => e.type === 'message.delta').length).toBe(1)
  })

  it('emits missing suffix if assistant snapshot has more text than streamed deltas', async () => {
    adapter = createAdapter(adapterOptions)
    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-claude', text: 'Hello' })

    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        uuid: 'evt-part1',
        event: {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: 'Prefix ' },
        },
      }) + '\n'
    )

    // Assistant snapshot with extra suffix
    mockProc.stdout.write(
      JSON.stringify({
        type: 'assistant',
        uuid: 'evt-full',
        message: {
          id: 'msg_01',
          role: 'assistant',
          content: [{ type: 'text', text: 'Prefix suffix' }],
        },
      }) + '\n'
    )

    const deltas = emittedEvents.filter((e): e is MessageDeltaEvent => e.type === 'message.delta')
    expect(deltas.length).toBe(2)
    expect(deltas[0].content).toBe('Prefix ')
    expect(deltas[1].content).toBe('suffix')
  })

  it('deduplicates identical records with same wrapper uuid', async () => {
    adapter = createAdapter(adapterOptions)
    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-claude', text: 'Hello' })

    const chunk = JSON.stringify({
      type: 'stream_event',
      uuid: 'repeat-uuid-1',
      event: {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text: 'Repeat' },
      },
    }) + '\n'

    mockProc.stdout.write(chunk)
    mockProc.stdout.write(chunk)

    const deltas = emittedEvents.filter((e) => e.type === 'message.delta')
    expect(deltas.length).toBe(1)
  })

  it('preserves distinct records that happen to contain identical text content', async () => {
    adapter = createAdapter(adapterOptions)
    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-claude', text: 'Hello' })

    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        uuid: 'uuid-ha-1',
        event: {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: 'ha' },
        },
      }) + '\n'
    )

    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        uuid: 'uuid-ha-2',
        event: {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: 'ha' },
        },
      }) + '\n'
    )

    const deltas = emittedEvents.filter((e): e is MessageDeltaEvent => e.type === 'message.delta')
    expect(deltas.length).toBe(2)
    expect(deltas.map((d) => d.content).join('')).toBe('haha')
  })

  it('completes turn cleanly on result with subtype success', async () => {
    adapter = createAdapter(adapterOptions)
    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-claude', text: 'Hello' })

    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        uuid: 'evt-r1',
        event: {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: 'All done.' },
        },
      }) + '\n'
    )

    mockProc.stdout.write(
      JSON.stringify({
        type: 'result',
        subtype: 'success',
        is_error: false,
        result: 'All done.',
      }) + '\n'
    )

    const completed = emittedEvents.find((e): e is MessageCompletedEvent => e.type === 'message.completed')
    expect(completed).toBeDefined()
    expect(completed?.finishReason).toBe('stop')
    expect(completed?.fullContent).toBe('All done.')
    expect(adapter.getCurrentStatus()).toBe('idle')
  })

  it('handles result with is_error true or error subtype as a turn failure while the process stays usable', async () => {
    adapter = createAdapter(adapterOptions)
    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-claude', text: 'Will fail' })

    mockProc.stdout.write(
      JSON.stringify({
        type: 'result',
        subtype: 'error_max_turns',
        is_error: true,
        errors: ['Turn limit reached'],
      }) + '\n'
    )

    const completed = emittedEvents.find((e): e is MessageCompletedEvent => e.type === 'message.completed')
    expect(completed).toBeDefined()
    expect(completed?.finishReason).toBe('error')

    const statusChanged = emittedEvents.find((e): e is AgentStatusChangedEvent => e.type === 'agent.status.changed' && e.status === 'error')
    expect(statusChanged).toBeDefined()
    expect(adapter.getCurrentStatus()).toBe('idle')
  })

  it('allows immediate subsequent prompt directly inside message.completed callback without busy error', async () => {
    let secondTurnSubmitted = false

    adapter = createAdapter({
      ...adapterOptions,
      onEvent: (evt) => {
        emittedEvents.push(evt)
        if (evt.type === 'message.completed' && evt.finishReason === 'stop' && !secondTurnSubmitted) {
          secondTurnSubmitted = true
          void adapter.sendPrompt({ taskId: 'test-task-claude', text: 'Second prompt' }).catch(() => {})
        }
      },
    })

    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-claude', text: 'First prompt' })

    mockProc.stdout.write(
      JSON.stringify({
        type: 'result',
        subtype: 'success',
        is_error: false,
        result: 'First prompt complete',
      }) + '\n'
    )

    expect(secondTurnSubmitted).toBe(true)
    expect(adapter.getCurrentStatus()).toBe('running')
  })

  it('allows a new turn after a failed result without replacing the session', async () => {
    let callbackPromise: Promise<unknown> | null = null
    let callbackExecuted = false

    adapter = createAdapter({
      ...adapterOptions,
      onEvent: (evt) => {
        emittedEvents.push(evt)
        if (evt.type === 'message.completed' && evt.finishReason === 'error') {
          callbackExecuted = true
          callbackPromise = adapter.sendPrompt({ taskId: 'test-task-claude', text: 'Another prompt' })
        }
      },
    })

    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-claude', text: 'Failing prompt' })

    mockProc.stdout.write(
      JSON.stringify({
        type: 'result',
        subtype: 'error_during_execution',
        is_error: true,
        errors: ['Execution error'],
      }) + '\n'
    )

    expect(callbackExecuted).toBe(true)
    expect(adapter.getCurrentStatus()).toBe('running')
    expect(callbackPromise).not.toBeNull()
    await expect(callbackPromise).resolves.toMatchObject({ turnId: expect.any(String) })
  })

  it('rejects sendPrompt immediately if invoked during stop() shutdown callbacks', async () => {
    let sendPromptError: Error | null = null
    adapter = createAdapter({
      ...adapterOptions,
      onEvent: (evt) => {
        emittedEvents.push(evt)
        if (evt.type === 'message.completed' && evt.finishReason === 'interrupted') {
          adapter.sendPrompt({ taskId: 'test-task-claude', text: 'Prompt during stop' }).catch((err) => {
            sendPromptError = err
          })
        }
      },
    })

    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-claude', text: 'Prompt before stop' })

    await adapter.stop(false)

    expect(sendPromptError).not.toBeNull()
    expect((sendPromptError as unknown as Error)?.message).toMatch(
      /Cannot send prompt: adapter is not started or has stopped/
    )
  })

  it('deduplicates concurrent start() calls during old process teardown', async () => {
    let callCount = 0
    const procs: MockChildProcess[] = []

    adapter = createAdapter({
      ...adapterOptions,
      killTimeoutMs: 50,
      spawnProcess: () => {
        callCount++
        const p = new MockChildProcess()
        p.pid = 4000 + callCount
        procs.push(p)
        return p as unknown as import('child_process').ChildProcess
      },
    })

    await adapter.start()
    expect(adapter.getPid()).toBe(4001)

    ;(adapter as unknown as { activeGen: { retired: boolean } }).activeGen.retired = true

    const [res1, res2] = await Promise.all([adapter.start(), adapter.start()])
    expect(res1.pid).toBe(4002)
    expect(res2.pid).toBe(4002)
    expect(callCount).toBe(2)
  })

  it('handles asynchronous exit delivery after SIGKILL escalation', async () => {
    const asyncKillProc = Object.assign(new EventEmitter(), {
      pid: 75432,
      stdin: new PassThrough(),
      stdout: new PassThrough(),
      stderr: new PassThrough(),
      exitCode: null,
      signalCode: null,
      kill: (signal?: string | number) => {
        if (signal === 'SIGKILL') {
          setTimeout(() => {
            const procWithExit = asyncKillProc as unknown as { exitCode: number | null; signalCode: string | null }
            procWithExit.exitCode = 137
            procWithExit.signalCode = 'SIGKILL'
            asyncKillProc.emit('exit', 137, 'SIGKILL')
            asyncKillProc.emit('close', 137, 'SIGKILL')
          }, 20)
        }
        return true
      },
    }) as unknown as import('child_process').ChildProcess

    adapter = createAdapter({
      ...adapterOptions,
      killTimeoutMs: 50,
      spawnProcess: () => asyncKillProc,
    })

    await adapter.start()
    expect(adapter.getPid()).toBe(75432)

    await adapter.stop(false)
    expect(adapter.getPid()).toBeUndefined()
  })

  it('allows retrying stop(true) after a previous stop failure with async exit', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    let shouldFailKill = true
    const retryProc = Object.assign(new EventEmitter(), {
      pid: 75434,
      stdin: new PassThrough(),
      stdout: new PassThrough(),
      stderr: new PassThrough(),
      exitCode: null,
      signalCode: null,
      kill: (signal?: string | number) => {
        if (shouldFailKill) {
          throw new Error('EPERM: Cannot kill')
        }
        if (signal === 'SIGKILL') {
          setTimeout(() => {
            const procWithExit = retryProc as unknown as { exitCode: number | null; signalCode: string | null }
            procWithExit.exitCode = 137
            procWithExit.signalCode = 'SIGKILL'
            retryProc.emit('exit', 137, 'SIGKILL')
            retryProc.emit('close', 137, 'SIGKILL')
          }, 20)
        }
        return true
      },
    }) as unknown as import('child_process').ChildProcess

    adapter = createAdapter({
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

  it('handles multi-byte UTF-8 sequences split directly across chunks', async () => {
    adapter = createAdapter(adapterOptions)
    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-claude', text: 'Cyrillic test' })

    const cyrillicText = 'Привет'
    const fullJson = JSON.stringify({
      type: 'stream_event',
      uuid: 'cyr-1',
      event: {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text: cyrillicText },
      },
    }) + '\n'

    const fullBuffer = Buffer.from(fullJson, 'utf8')
    const splitIndex = fullJson.indexOf('П') + 1

    const part1 = fullBuffer.subarray(0, splitIndex)
    const part2 = fullBuffer.subarray(splitIndex)

    mockProc.stdout.write(part1)
    mockProc.stdout.write(part2)

    const deltas = emittedEvents.filter((e): e is MessageDeltaEvent => e.type === 'message.delta')
    expect(deltas.map((d) => d.content).join('')).toBe(cyrillicText)
  })

  it('rejects resolveApproval for unknown or stale requests', async () => {
    adapter = createAdapter(adapterOptions)
    await adapter.start()

    await expect(
      adapter.resolveApproval('appr-1', 'allow')
    ).rejects.toThrow(/stale/i)
  })

  it('exposes correct capability profile', () => {
    adapter = createAdapter(adapterOptions)
    const caps = adapter.getCapabilities()
    expect(caps).toEqual({
      textStreaming: true,
      thinkingStreaming: true,
      toolCalls: true,
      toolOutputStreaming: false,
      interactiveApprovals: true,
      attachments: false,
    })
  })

  it('rejects start() if spawnProcess throws synchronously', async () => {
    adapter = createAdapter({
      ...adapterOptions,
      spawnProcess: () => {
        throw new Error('Spawn failed immediately')
      },
    })

    await expect(adapter.start()).rejects.toThrow('Spawn failed immediately')
  })

  it('rejects start() if child process emits early error before spawn completes', async () => {
    const brokenProc = Object.assign(new EventEmitter(), {
      pid: undefined,
      stdin: new PassThrough(),
      stdout: new PassThrough(),
      stderr: new PassThrough(),
      exitCode: null,
      signalCode: null,
      kill: () => true,
    }) as unknown as import('child_process').ChildProcess

    adapter = createAdapter({
      ...adapterOptions,
      spawnProcess: () => brokenProc,
    })

    const startPromise = adapter.start()
    brokenProc.emit('error', new Error('ENOENT: claude binary not found'))
    await expect(startPromise).rejects.toThrow('ENOENT: claude binary not found')
  })

  it('rejects start() if stop() is called during startup', async () => {
    const slowProc = Object.assign(new EventEmitter(), {
      pid: undefined,
      stdin: new PassThrough(),
      stdout: new PassThrough(),
      stderr: new PassThrough(),
      exitCode: null,
      signalCode: null,
      kill: () => true,
    }) as unknown as import('child_process').ChildProcess

    adapter = createAdapter({
      ...adapterOptions,
      spawnProcess: () => slowProc,
    })

    const startPromise = adapter.start()
    await adapter.stop(false)
    await expect(startPromise).rejects.toThrow(/adapter was stopped during startup/)
  })

  it('handles runtime process error after startup by finalising active turn and setting error status', async () => {
    adapter = createAdapter(adapterOptions)
    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-claude', text: 'Prompt before crash' })

    mockProc.emit('error', new Error('ECONNRESET: claude daemon died'))

    expect(adapter.getCurrentStatus()).toBe('error')
    const abortMsg = emittedEvents.find((e): e is MessageCompletedEvent => e.type === 'message.completed' && e.finishReason === 'error')
    expect(abortMsg).toBeDefined()
  })

  it('handles process close unexpectedly with error code', async () => {
    adapter = createAdapter(adapterOptions)
    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-claude', text: 'Prompt before exit' })

    mockProc.emit('close', 1, null)

    expect(adapter.getCurrentStatus()).toBe('error')
    const abortMsg = emittedEvents.find((e): e is MessageCompletedEvent => e.type === 'message.completed' && e.finishReason === 'interrupted')
    expect(abortMsg).toBeDefined()
  })

  it('rejects sendPrompt if adapter is in error status', async () => {
    adapter = createAdapter(adapterOptions)
    await adapter.start()

    mockProc.emit('error', new Error('Initial crash'))
    expect(adapter.getCurrentStatus()).toBe('error')

    await expect(
      adapter.sendPrompt({ taskId: 'test-task-claude', text: 'Will fail' })
    ).rejects.toThrow(/adapter is in error state/i)
  })

  it('handles synchronous throw in stdin write', async () => {
    const stdinPass = new PassThrough()
    ;(stdinPass as unknown as { write: (chunk: unknown) => boolean }).write = () => {
      throw new Error('Sync stdin crash')
    }
    const badStdinProc = Object.assign(new EventEmitter(), {
      pid: 88888,
      stdin: stdinPass,
      stdout: new PassThrough(),
      stderr: new PassThrough(),
      exitCode: null,
      signalCode: null,
      kill: () => true,
    }) as unknown as import('child_process').ChildProcess

    adapter = createAdapter({
      ...adapterOptions,
      spawnProcess: () => badStdinProc,
    })

    await adapter.start()
    await expect(adapter.sendPrompt({ taskId: 'test-task-claude', text: 'Boom' })).rejects.toThrow('Sync stdin crash')
  })

  it('ignores subagent records carrying non-null parent_tool_use_id', async () => {
    adapter = createAdapter(adapterOptions)
    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-claude', text: 'Subagent test' })

    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        uuid: 'sub-evt-1',
        parent_tool_use_id: 'toolu_parent_999',
        event: {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: 'Subagent internal message' },
        },
      }) + '\n'
    )

    const deltas = emittedEvents.filter((e) => e.type === 'message.delta')
    expect(deltas.length).toBe(0)
  })

  it('completes open tools implicitly when result arrives before tool_result', async () => {
    adapter = createAdapter(adapterOptions)
    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-claude', text: 'Tool prompt' })

    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        uuid: 'tool-e1',
        event: {
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'tool_use', id: 'toolu_open_1', name: 'Bash', input: {} },
        },
      }) + '\n'
    )

    mockProc.stdout.write(
      JSON.stringify({
        type: 'result',
        subtype: 'success',
        is_error: false,
        result: 'Done',
      }) + '\n'
    )

    const toolDone = emittedEvents.find((e): e is ToolCompletedEvent => e.type === 'tool.completed' && e.toolCallId === 'toolu_open_1')
    expect(toolDone).toBeDefined()
    expect(toolDone?.outcome).toBe('completed')
  })

  it('evicts oldest UUID when exceeding maxTrackedRecords', async () => {
    adapter = createAdapter({
      ...adapterOptions,
      maxTrackedRecords: 2,
    })
    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-claude', text: 'Eviction test' })

    mockProc.stdout.write(JSON.stringify({ type: 'stream_event', uuid: 'u1', event: { type: 'message_start', message: { id: 'm1' } } }) + '\n')
    mockProc.stdout.write(JSON.stringify({ type: 'stream_event', uuid: 'u2', event: { type: 'message_start', message: { id: 'm1' } } }) + '\n')
    mockProc.stdout.write(JSON.stringify({ type: 'stream_event', uuid: 'u3', event: { type: 'message_start', message: { id: 'm1' } } }) + '\n')

    expect(adapter.getPid()).toBe(64321)
  })

  it('handles tool result with non-string object content', async () => {
    adapter = createAdapter(adapterOptions)
    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-claude', text: 'Obj tool' })

    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        uuid: 't-start',
        event: {
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'tool_use', id: 'toolu_obj', name: 'FileRead', input: {} },
        },
      }) + '\n'
    )

    mockProc.stdout.write(
      JSON.stringify({
        type: 'user',
        uuid: 't-res',
        message: {
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: 'toolu_obj', content: { lines: 42 }, is_error: false }],
        },
      }) + '\n'
    )

    const toolDone = emittedEvents.find((e): e is ToolCompletedEvent => e.type === 'tool.completed' && e.toolCallId === 'toolu_obj')
    expect(toolDone).toBeDefined()
    expect(toolDone?.output).toBe('{"lines":42}')
  })

  it('handles assistant snapshot with newly introduced text and tool_use blocks', async () => {
    adapter = createAdapter(adapterOptions)
    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-claude', text: 'New blocks' })

    mockProc.stdout.write(
      JSON.stringify({
        type: 'assistant',
        uuid: 'asst-new',
        message: {
          id: 'msg_new',
          role: 'assistant',
          content: [
            { type: 'text', text: 'Brand new text without deltas' },
            { type: 'tool_use', id: 'toolu_brand_new', name: 'Glob', input: {} },
          ],
        },
      }) + '\n'
    )

    const deltas = emittedEvents.filter((e): e is MessageDeltaEvent => e.type === 'message.delta')
    expect(deltas.length).toBe(1)
    expect(deltas[0].content).toBe('Brand new text without deltas')

    const toolStarted = emittedEvents.find((e): e is ToolStartedEvent => e.type === 'tool.started' && e.toolCallId === 'toolu_brand_new')
    expect(toolStarted).toBeDefined()
  })

  it('emits raw.log events for stderr and calls onRawLog', async () => {
    adapter = createAdapter(adapterOptions)
    await adapter.start()

    mockProc.stderr.write('Warning: slow network\n')

    expect(rawLogs).toContainEqual({ stream: 'stderr', line: 'Warning: slow network' })
    const rawEvt = emittedEvents.find((e): e is RawLogEvent => e.type === 'raw.log' && e.stream === 'stderr')
    expect(rawEvt).toBeDefined()
    expect(rawEvt?.line).toBe('Warning: slow network')
  })

  it('discards oversized line remainder and preserves subsequent valid lines', async () => {
    adapter = createAdapter({
      ...adapterOptions,
      maxLineBufferBytes: 200,
    })
    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-claude', text: 'Buffer test' })

    const bigGarbage = 'X'.repeat(400)
    mockProc.stdout.write(bigGarbage + '\n')

    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        uuid: 'valid-after-big',
        event: {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: 'Recovered text' },
        },
      }) + '\n'
    )

    const deltas = emittedEvents.filter((e): e is MessageDeltaEvent => e.type === 'message.delta')
    expect(deltas.length).toBe(1)
    expect(deltas[0].content).toBe('Recovered text')
  })

  it('rejects stop() and logs error if proc.kill throws', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const throwingProc = Object.assign(new EventEmitter(), {
      pid: 99991,
      stdin: new PassThrough(),
      stdout: new PassThrough(),
      stderr: new PassThrough(),
      exitCode: null,
      signalCode: null,
      kill: () => {
        throw new Error('EPERM: Operation not permitted')
      },
    }) as unknown as import('child_process').ChildProcess

    adapter = createAdapter({
      ...adapterOptions,
      spawnProcess: () => throwingProc,
    })

    await adapter.start()
    await expect(adapter.stop(false)).rejects.toThrow('EPERM: Operation not permitted')
    expect(adapter.getPid()).toBe(99991)
    errorSpy.mockRestore()
  })

  it('escalates to SIGKILL if stop(true) is invoked during graceful shutdown', async () => {
    const stubbornProc = new StubbornChildProcess()
    adapter = createAdapter({
      ...adapterOptions,
      killTimeoutMs: 500,
      spawnProcess: () => stubbornProc as unknown as import('child_process').ChildProcess,
    })

    await adapter.start()

    const stopPromise = adapter.stop(false)
    await adapter.stop(true)
    await stopPromise

    expect(stubbornProc.killed).toBe(true)
    expect(stubbornProc.signalCode).toBe('SIGKILL')
  })

  it('rejects stop() and preserves tracking if process refuses to exit after timeout', async () => {
    const unkillableProc = Object.assign(new EventEmitter(), {
      pid: 99992,
      stdin: new PassThrough(),
      stdout: new PassThrough(),
      stderr: new PassThrough(),
      exitCode: null,
      signalCode: null,
      kill: () => true,
    }) as unknown as import('child_process').ChildProcess

    adapter = createAdapter({
      ...adapterOptions,
      killTimeoutMs: 50,
      spawnProcess: () => unkillableProc,
    })

    await adapter.start()
    expect(adapter.getPid()).toBe(99992)

    await expect(adapter.stop(false)).rejects.toThrow(/Failed to terminate child process/i)
    expect(adapter.getPid()).toBe(99992)
  })

  it('rejects start() if adapter was stopped and stop is idempotent', async () => {
    adapter = createAdapter(adapterOptions)
    await adapter.start()
    await adapter.stop(false)
    await adapter.stop(false)

    expect(adapter.getCurrentStatus()).toBe('stopped')
    await expect(adapter.start()).rejects.toThrow(/adapter has been stopped/)
  })

  it('emits delta if content_block_start contains non-empty text or thinking initially', async () => {
    adapter = createAdapter(adapterOptions)
    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-claude', text: 'initial block content' })

    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        uuid: 'init-text',
        event: {
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'text', text: 'Initial prefix' },
        },
      }) + '\n'
    )

    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        uuid: 'init-think',
        event: {
          type: 'content_block_start',
          index: 1,
          content_block: { type: 'thinking', thinking: 'Deep thoughts' },
        },
      }) + '\n'
    )

    const textDelta = emittedEvents.find((e): e is MessageDeltaEvent => e.type === 'message.delta' && e.deltaType === 'text')
    const thinkDelta = emittedEvents.find((e): e is MessageDeltaEvent => e.type === 'message.delta' && e.deltaType === 'thinking')

    expect(textDelta?.content).toBe('Initial prefix')
    expect(thinkDelta?.content).toBe('Deep thoughts')
  })

  it('flushes trailing unflushed stdout and stderr buffers on process exit', async () => {
    adapter = createAdapter(adapterOptions)
    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-claude', text: 'trailing test' })

    // Write chunk without trailing newline
    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        uuid: 'flush-trail',
        event: {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: 'Trailing flushed delta' },
        },
      })
    )
    mockProc.stderr.write('Unflushed stderr line')

    // Close process to trigger flushBuffers
    mockProc.emit('close', 0, null)

    const flushedDelta = emittedEvents.find((e): e is MessageDeltaEvent => e.type === 'message.delta' && e.content === 'Trailing flushed delta')
    expect(flushedDelta).toBeDefined()
    expect(rawLogs.some((l) => l.stream === 'stderr' && l.line === 'Unflushed stderr line')).toBe(true)
  })

  it('handles stream errors on stdin, stdout, and stderr gracefully without crashing', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    adapter = createAdapter(adapterOptions)
    await adapter.start()

    mockProc.stdin.emit('error', new Error('stdin test err'))
    mockProc.stdout.emit('error', new Error('stdout test err'))
    mockProc.stderr.emit('error', new Error('stderr test err'))

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('stdin error'), expect.any(Error))
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('stdout error'), expect.any(Error))
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('stderr error'), expect.any(Error))
    errorSpy.mockRestore()
  })

  it('discards chunks when buffer remainder exceeds maxLineBufferBytes without newline', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    adapter = createAdapter({
      ...adapterOptions,
      maxLineBufferBytes: 200,
    })
    await adapter.start()

    // Send chunk larger than 200 bytes without newline -> triggers remainder discard
    mockProc.stdout.write('A'.repeat(250))
    // Next chunk with no newline while discarding
    mockProc.stdout.write('B'.repeat(30))
    // Next chunk with newline to recover
    mockProc.stdout.write('C'.repeat(10) + '\n')

    // Stderr oversized remainder
    mockProc.stderr.write('D'.repeat(250))
    mockProc.stderr.write('E'.repeat(30))
    mockProc.stderr.write('F'.repeat(10) + '\n')

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('stdout line buffer exceeded 200 bytes'))
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('stderr line buffer exceeded 200 bytes'))
    warnSpy.mockRestore()
  })

  it('handles stdin write timeout by terminating generation and setting error status', async () => {
    const hungStdin = Object.assign(new EventEmitter(), {
      writable: true,
      write: vi.fn(),
    })
    const hungProc = Object.assign(new EventEmitter(), {
      pid: 65432,
      stdin: hungStdin,
      stdout: new PassThrough(),
      stderr: new PassThrough(),
      exitCode: null,
      signalCode: null,
      kill: vi.fn().mockReturnValue(true),
    }) as unknown as import('child_process').ChildProcess

    adapter = createAdapter({
      ...adapterOptions,
      stdinWriteTimeoutMs: 50,
      spawnProcess: () => hungProc,
    })

    await adapter.start()
    await expect(
      adapter.sendPrompt({ taskId: 'test-task-claude', text: 'Hello hung stdin' })
    ).rejects.toThrow('ClaudeAdapter stdin write timed out after 50ms')

    expect(adapter.getStatus()).toBe('error')
  })

  it('handles maxTurnBufferBytes exceeded by discarding subsequent stream chunks and setting error status', async () => {
    adapter = createAdapter({
      ...adapterOptions,
      maxTurnBufferBytes: 50,
    })
    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-claude', text: 'Prompt' })

    // Send 60 bytes of text delta -> exceeds 50 bytes limit
    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        event: {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: 'X'.repeat(60) },
        },
      }) + '\n'
    )

    expect(adapter.getStatus()).toBe('error')
    const oomErr = emittedEvents.find((e) => e.type === 'agent.status.changed' && e.status === 'error')
    expect(oomErr).toBeDefined()

    const deltaCountBefore = emittedEvents.filter((e) => e.type === 'message.delta').length
    // Subsequent delta should be discarded, no new deltas emitted
    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        event: {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: 'Y'.repeat(20) },
        },
      }) + '\n'
    )
    const deltaCountAfter = emittedEvents.filter((e) => e.type === 'message.delta').length
    expect(deltaCountAfter).toBe(deltaCountBefore)
  })

  it('recovers from error state on new start() call by replacing errored process with fresh spawn', async () => {
    let spawnCount = 0
    let currentMockProc = mockProc
    adapter = createAdapter({
      ...adapterOptions,
      spawnProcess: () => {
        spawnCount++
        currentMockProc = new MockChildProcess()
        currentMockProc.pid = 70000 + spawnCount
        return currentMockProc as unknown as import('child_process').ChildProcess
      },
    })

    const res1 = await adapter.start()
    expect(res1.pid).toBe(70001)

    // An initialization-stage process failure may be retried before any conversation input.
    currentMockProc.emit('error', new Error('CLI fatal crash'))
    expect(adapter.getStatus()).toBe('error')

    // Calling start() again must not reuse the errored process (70001)
    const res2 = await adapter.start()
    expect(res2.pid).toBe(70002)
    expect(adapter.getStatus()).toBe('idle')
  })

  it('interleaves thinking snapshot and delayed thinking deltas without duplicating thinking content', async () => {
    adapter = createAdapter(adapterOptions)
    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-claude', text: 'Solve riddle' })

    // Delta 1: partial thinking "I am thi"
    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        event: {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'thinking_delta', thinking: 'I am thi' },
        },
      }) + '\n'
    )

    // Assistant snapshot arrives ahead with "I am thinking deeply"
    mockProc.stdout.write(
      JSON.stringify({
        type: 'assistant',
        message: {
          id: 'msg-think-1',
          content: [{ type: 'thinking', thinking: 'I am thinking deeply' }],
        },
      }) + '\n'
    )

    // Delayed stream delta arrives late with "nking"
    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        event: {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'thinking_delta', thinking: 'nking' },
        },
      }) + '\n'
    )

    const thinkDeltas = emittedEvents.filter(
      (e): e is MessageDeltaEvent => e.type === 'message.delta' && e.deltaType === 'thinking'
    )
    const totalThinking = thinkDeltas.map((d) => d.content).join('')
    expect(totalThinking).toBe('I am thinking deeply')
  })

  it('reconciles multi-block assistant snapshot with distinct contents by block position', async () => {
    adapter = createAdapter(adapterOptions)
    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-claude', text: 'Two blocks' })

    // Block 0: "Hello "
    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        event: {
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'text', text: 'Hello ' },
        },
      }) + '\n'
    )

    // Block 1: "World"
    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        event: {
          type: 'content_block_start',
          index: 1,
          content_block: { type: 'text', text: 'World' },
        },
      }) + '\n'
    )

    // Assistant snapshot with both blocks updated: "Hello there!" and "World!"
    mockProc.stdout.write(
      JSON.stringify({
        type: 'assistant',
        message: {
          id: 'msg-blocks-1',
          content: [
            { type: 'text', index: 0, text: 'Hello there!' },
            { type: 'text', index: 1, text: 'World!' },
          ],
        },
      }) + '\n'
    )

    // Complete turn
    mockProc.stdout.write(
      JSON.stringify({
        type: 'result',
        subtype: 'success',
      }) + '\n'
    )

    // Verify stream deltas did not corrupt ordering by appending block 0 suffix behind block 1
    const textDeltas = emittedEvents.filter(
      (e): e is MessageDeltaEvent => e.type === 'message.delta' && e.deltaType === 'text'
    )
    const texts = textDeltas.map((d) => d.content)
    expect(texts).toEqual(['Hello ', 'World', '!'])

    // Verify fullContent on message.completed is reconstructed strictly in block order
    const completedEvt = emittedEvents.find(
      (e): e is MessageCompletedEvent => e.type === 'message.completed'
    )
    expect(completedEvt?.fullContent).toBe('Hello there!World!')

    // Verify EventJournal reconstructs feed content strictly in block order
    const tempDir = createTestJournalDir('journal-multi-block-')
    try {
      const journal = new EventJournal(path.join(tempDir, 'events.ndjson'))
      await journal.appendBatch(emittedEvents)
      const feed = await journal.reconstructFeed()
      expect(feed[0].text).toBe('Hello there!World!')
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('parses errors array from result record and includes it in agent error event', async () => {
    adapter = createAdapter(adapterOptions)
    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-claude', text: 'Will fail with error list' })

    mockProc.stdout.write(
      JSON.stringify({
        type: 'result',
        subtype: 'error',
        errors: ['Turn limit reached', 'Rate limit hit'],
      }) + '\n'
    )

    expect(adapter.getStatus()).toBe('idle')
    const errEvt = emittedEvents.find(
      (e): e is AgentStatusChangedEvent => e.type === 'agent.status.changed' && e.status === 'error'
    )
    expect(errEvt?.error).toBe('Turn limit reached; Rate limit hit')
  })

  it('handles surviving descendant processes by rejecting stop() and allowing successful forced retry', async () => {
    let treeKilled = false
    const failingSupervisor = {
      killProcessTree: vi.fn(),
      terminateProcessTree: vi.fn().mockImplementation(async () => treeKilled),
    } as unknown as ProcessSupervisor

    adapter = createAdapter({
      ...adapterOptions,
      supervisor: failingSupervisor,
    })

    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-claude', text: 'Test stop tree failure' })

    // stop(false) must reject when descendant processes survive
    await expect(adapter.stop(false)).rejects.toThrow(/Failed to terminate descendant processes/i)
    expect(adapter.getStatus()).not.toBe('stopped')
    expect(adapter.getPid()).toBeDefined()

    // Retry with force when tree can now be terminated
    treeKilled = true
    await expect(adapter.stop(true)).resolves.not.toThrow()
    expect(adapter.getStatus()).toBe('stopped')
    expect(adapter.getPid()).toBeUndefined()
  })

  it('preserves stdio error handlers through closure and ignores late writable stream errors without crashing host', async () => {
    adapter = createAdapter({
      ...adapterOptions,
      stdinWriteTimeoutMs: 50,
    })

    await adapter.start()

    // Mock stdin write that never finishes to trigger timeout
    mockProc.stdin.write = vi.fn().mockReturnValue(false) as unknown as typeof mockProc.stdin.write

    await expect(
      adapter.sendPrompt({ taskId: 'test-task-claude', text: 'Stuck write' })
    ).rejects.toThrow(/timed out/i)

    // Emit delayed error on stdin after retirement (e.g. async EPIPE from OS)
    expect(() => {
      mockProc.stdin.emit('error', new Error('EPIPE: broken pipe'))
    }).not.toThrow()
  })

  it('strictly bounds turn memory and discards oversized turn data without buffer growth', async () => {
    adapter = createAdapter({
      ...adapterOptions,
      maxTurnBufferBytes: 50,
    })

    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-claude', text: 'Prompt exceeding turn limit' })

    // Stream 30 bytes
    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        event: {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: '123456789012345678901234567890' },
        },
      }) + '\n'
    )

    // Stream another 30 bytes to exceed 50-byte limit
    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        event: {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: 'abcdefghijklmnopqrstuvwxyz1234' },
        },
      }) + '\n'
    )

    expect(adapter.getStatus()).toBe('error')

    // Subsequent deltas (800 bytes) must be completely discarded
    const largeChunk = 'A'.repeat(800)
    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        event: {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: largeChunk },
        },
      }) + '\n'
    )

    const allDeltas = emittedEvents.filter((e): e is MessageDeltaEvent => e.type === 'message.delta')
    const totalDeltaText = allDeltas.map((d) => d.content).join('')
    expect(totalDeltaText).not.toContain(largeChunk)
  })

  it('isolates subsequent tool call arguments on identical block index after previous tool_result', async () => {
    adapter = createAdapter(adapterOptions)
    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-claude', text: 'Execute two tools consecutively' })

    // First tool call on index 0
    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        event: {
          type: 'content_block_start',
          index: 0,
          content_block: {
            type: 'tool_use',
            id: 'tool-call-1',
            name: 'execute_command',
          },
        },
      }) + '\n'
    )
    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        event: {
          type: 'content_block_delta',
          index: 0,
          delta: {
            type: 'input_json_delta',
            partial_json: JSON.stringify({ command: 'first' }),
          },
        },
      }) + '\n'
    )
    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        event: {
          type: 'content_block_stop',
          index: 0,
        },
      }) + '\n'
    )

    // Tool result for tool-call-1
    mockProc.stdout.write(
      JSON.stringify({
        type: 'user',
        message: {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'tool-call-1',
              content: 'first output',
            },
          ],
        },
      }) + '\n'
    )

    // Claude starts next message step
    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        event: {
          type: 'message_start',
          message: { id: 'msg-claude-step-2' },
        },
      }) + '\n'
    )

    // Second tool call on index 0
    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        event: {
          type: 'content_block_start',
          index: 0,
          content_block: {
            type: 'tool_use',
            id: 'tool-call-2',
            name: 'execute_command',
          },
        },
      }) + '\n'
    )
    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        event: {
          type: 'content_block_delta',
          index: 0,
          delta: {
            type: 'input_json_delta',
            partial_json: JSON.stringify({ command: 'second' }),
          },
        },
      }) + '\n'
    )
    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        event: {
          type: 'content_block_stop',
          index: 0,
        },
      }) + '\n'
    )

    const toolStarts = emittedEvents.filter((e): e is ToolStartedEvent => e.type === 'tool.started')
    expect(toolStarts).toHaveLength(2)
    expect(toolStarts[0].input).toEqual({ command: 'first' })
    expect(toolStarts[1].input).toEqual({ command: 'second' })
  })

  it('maintains valid journal ordering on interrupted tool-only turns without synthetic entries', async () => {
    adapter = createAdapter(adapterOptions)
    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-claude', text: 'Run tool and get interrupted' })

    // Tool start without content_block_stop (interrupted in-flight)
    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        event: {
          type: 'content_block_start',
          index: 0,
          content_block: {
            type: 'tool_use',
            id: 'tool-interrupted-1',
            name: 'bash',
          },
        },
      }) + '\n'
    )

    // User interrupts process
    await adapter.stop(false)

    // Reconstruct with EventJournal to verify ordering invariant
    const tempDir = createTestJournalDir('journal-interrupt-')
    try {
      const journal = new EventJournal(path.join(tempDir, 'events.ndjson'))
      await journal.appendBatch(emittedEvents)
      const feed = await journal.reconstructFeed()

      // Must reconstruct exactly one message with role assistant, interrupted status, and attached tool
      expect(feed).toHaveLength(1)
      expect(feed[0].role).toBe('assistant')
      expect(feed[0].status).toBe('interrupted')
      expect(feed[0].tools).toBeDefined()
      expect(feed[0].tools).toHaveLength(1)
      expect(feed[0].tools![0].callId).toBe('tool-interrupted-1')
      expect(feed[0].tools![0].status).toBe('error')
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('preserves single stable journal messageId across upstream message_start transitions', async () => {
    adapter = createAdapter(adapterOptions)
    await adapter.start()
    const promptRes = await adapter.sendPrompt({ taskId: 'test-task-claude', text: 'Multi-step turn' })

    // First internal upstream message
    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        event: {
          type: 'message_start',
          message: { id: 'msg_claude_upstream_1' },
        },
      }) + '\n'
    )
    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        event: {
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'text', text: 'Step 1 output' },
        },
      }) + '\n'
    )

    // Second internal upstream message in the same turn
    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        event: {
          type: 'message_start',
          message: { id: 'msg_claude_upstream_2' },
        },
      }) + '\n'
    )
    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        event: {
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'text', text: 'Step 2 output' },
        },
      }) + '\n'
    )

    // Finish turn
    mockProc.stdout.write(
      JSON.stringify({
        type: 'result',
        subtype: 'success',
      }) + '\n'
    )

    // Verify all deltas and completed event reference the single stable messageId
    const deltaEvents = emittedEvents.filter((e): e is MessageDeltaEvent => e.type === 'message.delta')
    const completedEvents = emittedEvents.filter(
      (e): e is MessageCompletedEvent => e.type === 'message.completed'
    )

    const expectedMessageId = `msg-${promptRes.turnId}`
    expect(deltaEvents.every((d) => d.messageId === expectedMessageId)).toBe(true)
    expect(completedEvents).toHaveLength(1)
    expect(completedEvents[0].messageId).toBe(expectedMessageId)
    expect(completedEvents[0].fullContent).toBe('Step 1 outputStep 2 output')

    // Reconstruct feed and verify exactly one completed message with concatenated steps text
    const tempDir = createTestJournalDir('journal-stable-id-')
    try {
      const journal = new EventJournal(path.join(tempDir, 'events.ndjson'))
      await journal.appendBatch(emittedEvents)
      const feed = await journal.reconstructFeed()

      expect(feed).toHaveLength(1)
      expect(feed[0].id).toBe(expectedMessageId)
      expect(feed[0].status).toBe('completed')
      expect(feed[0].text).toBe('Step 1 outputStep 2 output')
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('strictly bounds memory on assistant snapshots and clears turn data before emitting completion', async () => {
    adapter = createAdapter({
      ...adapterOptions,
      maxTurnBufferBytes: 100,
    })

    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-claude', text: 'Snapshot memory test' })

    const oversizedText = 'Z'.repeat(500)
    mockProc.stdout.write(
      JSON.stringify({
        type: 'assistant',
        message: {
          id: 'msg-snap-oom',
          content: [{ type: 'text', text: oversizedText }],
        },
      }) + '\n'
    )

    expect(adapter.getStatus()).toBe('error')

    const statusEvents = emittedEvents.filter(
      (e): e is AgentStatusChangedEvent => e.type === 'agent.status.changed' && e.status === 'error'
    )
    expect(statusEvents.some((e) => e.error?.includes('Turn buffer exceeded'))).toBe(true)

    const completedEvt = emittedEvents.find(
      (e): e is MessageCompletedEvent => e.type === 'message.completed'
    )
    // fullContent must be empty string, not the 500-byte overflow payload
    expect(completedEvt?.fullContent).toBe('')
  })

  it('rejects oversized tool_use input in content_block_start and assistant snapshots without memory leak', async () => {
    adapter = createAdapter({
      ...adapterOptions,
      maxTurnBufferBytes: 80,
    })

    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-claude', text: 'Oversized tool input test' })

    const largePayload = { query: 'X'.repeat(200) }
    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        event: {
          type: 'content_block_start',
          index: 0,
          content_block: {
            type: 'tool_use',
            id: 'oversized-tool-1',
            name: 'bash',
            input: largePayload,
          },
        },
      }) + '\n'
    )

    expect(adapter.getStatus()).toBe('error')
    const toolStartEvents = emittedEvents.filter((e) => e.type === 'tool.started')
    expect(toolStartEvents).toHaveLength(0)
  })

  it('maintains independent guard indexes for text and thinking so thinking suffixes are emitted correctly', async () => {
    adapter = createAdapter(adapterOptions)
    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-claude', text: 'Reasoning then text' })

    // Stream thinking on block 0
    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        event: {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'thinking_delta', thinking: 'Thinking start...' },
        },
      }) + '\n'
    )

    // Stream text on block 1 (advancing maxStreamedTextBlockIndex to 1)
    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        event: {
          type: 'content_block_delta',
          index: 1,
          delta: { type: 'text_delta', text: 'Final answer' },
        },
      }) + '\n'
    )

    // Assistant snapshot delivers extra thinking suffix on block 0
    mockProc.stdout.write(
      JSON.stringify({
        type: 'assistant',
        message: {
          id: 'msg-thinking-suffix',
          content: [
            { type: 'thinking', index: 0, thinking: 'Thinking start... and extra reasoning suffix.' },
            { type: 'text', index: 1, text: 'Final answer' },
          ],
        },
      }) + '\n'
    )

    // Thinking delta must be emitted for the suffix despite block 1 having streamed text
    const thinkingDeltas = emittedEvents.filter(
      (e): e is MessageDeltaEvent => e.type === 'message.delta' && e.deltaType === 'thinking'
    )
    const combinedThinking = thinkingDeltas.map((d) => d.content).join('')
    expect(combinedThinking).toBe('Thinking start... and extra reasoning suffix.')
  })

  it('handles late process close after failed stop without losing activeGen and enables retry', async () => {
    class DelayedCloseProc extends EventEmitter {
      pid = 74321
      stdin = new PassThrough()
      stdout = new PassThrough()
      stderr = new PassThrough()
      killed = false
      exitCode: number | null = null
      signalCode: string | null = null

      kill(signal: NodeJS.Signals | number = 'SIGTERM') {
        this.killed = true
        this.signalCode = typeof signal === 'string' ? signal : String(signal)
        // Intentionally do not emit 'close' or 'exit' here!
        return true
      }
    }

    const delayedProc = new DelayedCloseProc()
    let treeKilled = false
    let supervisorCallCount = 0
    const failingSupervisor = {
      killProcessTree: vi.fn(),
      terminateProcessTree: vi.fn().mockImplementation(async () => {
        supervisorCallCount++
        return treeKilled
      }),
    } as unknown as ProcessSupervisor

    adapter = createAdapter({
      ...adapterOptions,
      spawnProcess: () => delayedProc as unknown as import('child_process').ChildProcess,
      supervisor: failingSupervisor,
    })

    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-claude', text: 'Test late close' })

    // stop(false) must reject when descendant processes survive
    await expect(adapter.stop(false)).rejects.toThrow(/Failed to terminate descendant processes/i)
    expect(supervisorCallCount).toBeGreaterThanOrEqual(1)

    // Now the delayed close arrives AFTER stop() rejected
    delayedProc.emit('exit', 0, 'SIGTERM')
    delayedProc.emit('close', 0, 'SIGTERM')

    // activeGen and pid must still be defined because descendants survived!
    expect(adapter.getPid()).toBe(74321)
    expect(adapter.getStatus()).not.toBe('stopped')

    // Subsequent stop(true) with treeKilled still false must call supervisor again and reject
    const prevCalls = supervisorCallCount
    await expect(adapter.stop(true)).rejects.toThrow(/Failed to terminate descendant processes/i)
    expect(supervisorCallCount).toBeGreaterThan(prevCalls)

    // Now descendants can be terminated
    treeKilled = true
    await expect(adapter.stop(true)).resolves.not.toThrow()
    expect(adapter.getStatus()).toBe('stopped')
    expect(adapter.getPid()).toBeUndefined()
  })

  it('terminates surviving descendants of previous generation when new start() is requested', async () => {
    class DelayedCloseProc extends EventEmitter {
      pid = 74322
      stdin = new PassThrough()
      stdout = new PassThrough()
      stderr = new PassThrough()
      killed = false
      exitCode: number | null = null
      signalCode: string | null = null

      kill(signal: NodeJS.Signals | number = 'SIGTERM') {
        this.killed = true
        this.signalCode = typeof signal === 'string' ? signal : String(signal)
        return true
      }
    }

    const delayedProc = new DelayedCloseProc()
    let treeKilled = false
    const mockSupervisor = {
      killProcessTree: vi.fn(),
      terminateProcessTree: vi.fn().mockImplementation(async () => treeKilled),
    } as unknown as ProcessSupervisor

    let currentProc: EventEmitter = delayedProc
    adapter = createAdapter({
      ...adapterOptions,
      spawnProcess: () => currentProc as unknown as import('child_process').ChildProcess,
      supervisor: mockSupervisor,
    })

    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-claude', text: 'Initial prompt' })

    // Stop fails because descendants survive
    await expect(adapter.stop(false)).rejects.toThrow(/Failed to terminate descendant processes/i)
    // Delayed close arrives
    delayedProc.emit('exit', 0, 'SIGTERM')
    delayedProc.emit('close', 0, 'SIGTERM')

    // New process to spawn
    const newProc = new MockChildProcess()
    newProc.pid = 88888
    currentProc = newProc

    // Starting new generation while old descendants still survive must re-attempt cleanup of old tree!
    // Since treeKilled is still false, start() must reject
    await expect(adapter.start()).rejects.toThrow(/Failed to terminate descendant processes/i)

    // Now let tree termination succeed
    treeKilled = true
    await expect(adapter.start()).rejects.toThrow(/create a new chat/i)
    expect(adapter.getPid()).toBeUndefined()
    expect(newProc.killed).toBe(false)
  })

  it('strictly bounds memory when snapshot length increases turnAccumulatedText beyond limit', async () => {
    adapter = createAdapter({
      ...adapterOptions,
      maxTurnBufferBytes: 100,
    })

    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-claude', text: 'Accumulator overflow test' })

    // Delta with 30 3-byte chars = 90 bytes (30 chars)
    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        event: {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: '界'.repeat(30) },
        },
      }) + '\n'
    )

    // Snapshot with 90 1-byte chars = 90 bytes (90 chars)
    // Adding suffix of 60 chars would push accumulator to 150 bytes (exceeding 100 limit)
    mockProc.stdout.write(
      JSON.stringify({
        type: 'assistant',
        message: {
          id: 'msg-accum-oom',
          content: [{ type: 'text', index: 0, text: 'A'.repeat(90) }],
        },
      }) + '\n'
    )

    expect(adapter.getStatus()).toBe('error')
    const completedEvt = emittedEvents.find(
      (e): e is MessageCompletedEvent => e.type === 'message.completed'
    )
    expect(completedEvt?.fullContent).toBe('')
  })

  it('preserves both steps when multiple steps have identical text and result.result matches step text', async () => {
    adapter = createAdapter(adapterOptions)
    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-claude', text: 'Multi-step repeating' })

    // Step 1: 'Done.'
    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        event: {
          type: 'message_start',
          message: { id: 'msg_done_1' },
        },
      }) + '\n'
    )
    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        event: {
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'text', text: 'Done.' },
        },
      }) + '\n'
    )

    // Step 2: 'Done.'
    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        event: {
          type: 'message_start',
          message: { id: 'msg_done_2' },
        },
      }) + '\n'
    )
    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        event: {
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'text', text: 'Done.' },
        },
      }) + '\n'
    )

    // Result with 'Done.'
    mockProc.stdout.write(
      JSON.stringify({
        type: 'result',
        subtype: 'success',
        result: 'Done.',
      }) + '\n'
    )

    const completedEvents = emittedEvents.filter(
      (e): e is MessageCompletedEvent => e.type === 'message.completed'
    )
    expect(completedEvents).toHaveLength(1)
    expect(completedEvents[0].fullContent).toBe('Done.Done.')

    const tempDir = createTestJournalDir('journal-repeating-steps-')
    try {
      const journal = new EventJournal(path.join(tempDir, 'events.ndjson'))
      await journal.appendBatch(emittedEvents)
      const feed = await journal.reconstructFeed()

      expect(feed).toHaveLength(1)
      expect(feed[0].text).toBe('Done.Done.')
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('strictly bounds memory on multibyte replacement snapshots exceeding limit', async () => {
    adapter = createAdapter({
      ...adapterOptions,
      maxTurnBufferBytes: 100,
    })

    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-claude', text: 'Multibyte replacement test' })

    // Stream 80 ASCII bytes
    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        event: {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: 'A'.repeat(80) },
        },
      }) + '\n'
    )

    // Snapshot with 81 3-byte characters = 243 bytes (exceeds 100 bytes limit)
    mockProc.stdout.write(
      JSON.stringify({
        type: 'assistant',
        message: {
          id: 'msg-multibyte-oom',
          content: [{ type: 'text', index: 0, text: '界'.repeat(81) }],
        },
      }) + '\n'
    )

    expect(adapter.getStatus()).toBe('error')
    const completedEvt = emittedEvents.find(
      (e): e is MessageCompletedEvent => e.type === 'message.completed'
    )
    expect(completedEvt?.fullContent).toBe('')
  })

  it('strictly bounds memory when result.result exceeds turn buffer limit', async () => {
    adapter = createAdapter({
      ...adapterOptions,
      maxTurnBufferBytes: 100,
    })

    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-claude', text: 'Result overflow test' })

    // Initial valid delta (20 bytes)
    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        event: {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: 'A'.repeat(20) },
        },
      }) + '\n'
    )

    // Result with 800-byte payload
    mockProc.stdout.write(
      JSON.stringify({
        type: 'result',
        subtype: 'success',
        result: 'X'.repeat(800),
      }) + '\n'
    )

    expect(adapter.getStatus()).toBe('error')
    const completedEvt = emittedEvents.find(
      (e): e is MessageCompletedEvent => e.type === 'message.completed'
    )
    expect(completedEvt?.fullContent).toBe('')
  })

  it('preserves previous steps text when result.result contains only the final step', async () => {
    adapter = createAdapter(adapterOptions)
    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-claude', text: 'Multi-step with result' })

    // Step 1
    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        event: {
          type: 'message_start',
          message: { id: 'msg_upstream_1' },
        },
      }) + '\n'
    )
    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        event: {
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'text', text: 'Step 1 output' },
        },
      }) + '\n'
    )

    // Step 2
    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        event: {
          type: 'message_start',
          message: { id: 'msg_upstream_2' },
        },
      }) + '\n'
    )
    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        event: {
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'text', text: 'Step 2 output' },
        },
      }) + '\n'
    )

    // Result containing only the final step's text
    mockProc.stdout.write(
      JSON.stringify({
        type: 'result',
        subtype: 'success',
        result: 'Step 2 output',
      }) + '\n'
    )

    const completedEvents = emittedEvents.filter(
      (e): e is MessageCompletedEvent => e.type === 'message.completed'
    )
    expect(completedEvents).toHaveLength(1)
    expect(completedEvents[0].fullContent).toBe('Step 1 outputStep 2 output')

    const tempDir = createTestJournalDir('journal-result-steps-')
    try {
      const journal = new EventJournal(path.join(tempDir, 'events.ndjson'))
      await journal.appendBatch(emittedEvents)
      const feed = await journal.reconstructFeed()

      expect(feed).toHaveLength(1)
      expect(feed[0].text).toBe('Step 1 outputStep 2 output')
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('preserves activeGen and retries supervisor cleanup on stop() after failed start() error recovery', async () => {
    class DelayedCloseProc extends EventEmitter {
      pid = 74323
      stdin = new PassThrough()
      stdout = new PassThrough()
      stderr = new PassThrough()
      killed = false
      exitCode: number | null = null
      signalCode: string | null = null

      kill(signal: NodeJS.Signals | number = 'SIGTERM') {
        this.killed = true
        this.signalCode = typeof signal === 'string' ? signal : String(signal)
        return true
      }
    }

    const delayedProc = new DelayedCloseProc()
    let treeKilled = false
    let supervisorCallCount = 0
    const mockSupervisor = {
      killProcessTree: vi.fn(),
      terminateProcessTree: vi.fn().mockImplementation(async () => {
        supervisorCallCount++
        return treeKilled
      }),
    } as unknown as ProcessSupervisor

    let currentProc: EventEmitter = delayedProc
    adapter = createAdapter({
      ...adapterOptions,
      spawnProcess: () => currentProc as unknown as import('child_process').ChildProcess,
      supervisor: mockSupervisor,
    })

    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-claude', text: 'Initial prompt' })

    // Simulate result error so status becomes 'error'
    delayedProc.stdout.write(
      JSON.stringify({
        type: 'result',
        subtype: 'error',
        is_error: true,
        error: 'Execution failed',
      }) + '\n'
    )
    expect(adapter.getStatus()).toBe('idle')

    // Root process finishes with exit, but delayed close arrives asynchronously
    delayedProc.exitCode = 1
    delayedProc.emit('exit', 1, null)

    // Attempt start() to recover while tree termination fails (descendants survive)
    const newProc = new MockChildProcess()
    newProc.pid = 99999
    currentProc = newProc

    const startPromise = adapter.start()

    // Asynchronously emit 'close' on delayedProc during tree termination
    delayedProc.emit('close', 1, null)

    // start() must reject because descendants survived
    await expect(startPromise).rejects.toThrow(/Failed to terminate descendant processes/i)
    expect(supervisorCallCount).toBe(1)

    // activeGen must NOT be lost even after rejection and asynchronous close!
    expect(adapter.getPid()).toBe(74323)

    // Subsequent stop(true) must attempt supervisor cleanup again
    treeKilled = true
    await expect(adapter.stop(true)).resolves.not.toThrow()
    expect(supervisorCallCount).toBe(2)
    expect(adapter.getStatus()).toBe('stopped')
    expect(adapter.getPid()).toBeUndefined()
  })

  it('preserves intermediate steps when second step final result shares prefix with turn text', async () => {
    adapter = createAdapter(adapterOptions)
    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-claude', text: 'Prefix collision test' })

    // Step 1: 'Done.'
    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        event: {
          type: 'message_start',
          message: { id: 'msg_collision_1' },
        },
      }) + '\n'
    )
    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        event: {
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'text', text: 'Done.' },
        },
      }) + '\n'
    )

    // Step 2: streamed prefix is 'Done.'
    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        event: {
          type: 'message_start',
          message: { id: 'msg_collision_2' },
        },
      }) + '\n'
    )
    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        event: {
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'text', text: 'Done.' },
        },
      }) + '\n'
    )

    // Result record with 'Done.Done.' (the final text of step 2)
    // Step 1 ('Done.') + Step 2 ('Done.Done.') => expected total 'Done.Done.Done.'
    mockProc.stdout.write(
      JSON.stringify({
        type: 'result',
        subtype: 'success',
        result: 'Done.Done.',
      }) + '\n'
    )

    const completedEvents = emittedEvents.filter(
      (e): e is MessageCompletedEvent => e.type === 'message.completed'
    )
    expect(completedEvents).toHaveLength(1)
    expect(completedEvents[0].fullContent).toBe('Done.Done.Done.')

    const tempDir = createTestJournalDir('journal-collision-steps-')
    try {
      const journal = new EventJournal(path.join(tempDir, 'events.ndjson'))
      await journal.appendBatch(emittedEvents)
      const feed = await journal.reconstructFeed()

      expect(feed).toHaveLength(1)
      expect(feed[0].text).toBe('Done.Done.Done.')
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('does not duplicate previous steps when result contains the entire turn text', async () => {
    adapter = createAdapter(adapterOptions)
    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-claude', text: 'Full turn result test' })

    // Step 1: 'A'
    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        event: {
          type: 'message_start',
          message: { id: 'msg_full_1' },
        },
      }) + '\n'
    )
    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        event: {
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'text', text: 'A' },
        },
      }) + '\n'
    )

    // Step 2: 'B'
    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        event: {
          type: 'message_start',
          message: { id: 'msg_full_2' },
        },
      }) + '\n'
    )
    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        event: {
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'text', text: 'B' },
        },
      }) + '\n'
    )

    // Result with 'AB' (entire turn)
    mockProc.stdout.write(
      JSON.stringify({
        type: 'result',
        subtype: 'success',
        result: 'AB',
      }) + '\n'
    )

    const completedEvents = emittedEvents.filter(
      (e): e is MessageCompletedEvent => e.type === 'message.completed'
    )
    expect(completedEvents).toHaveLength(1)
    expect(completedEvents[0].fullContent).toBe('AB')
  })

  it('does not duplicate previous steps when result contains entire turn text plus new suffix', async () => {
    adapter = createAdapter(adapterOptions)
    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-claude', text: 'Full turn result plus suffix test' })

    // Step 1: 'A'
    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        event: {
          type: 'message_start',
          message: { id: 'msg_full_suf_1' },
        },
      }) + '\n'
    )
    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        event: {
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'text', text: 'A' },
        },
      }) + '\n'
    )

    // Step 2: 'B'
    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        event: {
          type: 'message_start',
          message: { id: 'msg_full_suf_2' },
        },
      }) + '\n'
    )
    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        event: {
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'text', text: 'B' },
        },
      }) + '\n'
    )

    // Result with 'ABC' (entire turn + 'C')
    mockProc.stdout.write(
      JSON.stringify({
        type: 'result',
        subtype: 'success',
        result: 'ABC',
      }) + '\n'
    )

    const completedEvents = emittedEvents.filter(
      (e): e is MessageCompletedEvent => e.type === 'message.completed'
    )
    expect(completedEvents).toHaveLength(1)
    expect(completedEvents[0].fullContent).toBe('ABC')
  })

  it('does not invoke unvalidated supervisor.killProcessTree during force stop', async () => {
    const mockSupervisor = {
      killProcessTree: vi.fn(),
      terminateProcessTree: vi.fn().mockResolvedValue(true),
    } as unknown as ProcessSupervisor

    adapter = createAdapter({
      ...adapterOptions,
      supervisor: mockSupervisor,
    })

    await adapter.start()
    await adapter.stop(true)

    expect(mockSupervisor.terminateProcessTree).toHaveBeenCalledWith(
      expect.any(Number),
      expect.objectContaining({ force: true })
    )
    // killProcessTree must NOT be called directly without validation
    expect(mockSupervisor.killProcessTree).not.toHaveBeenCalled()
  })

  it('bounds blocks and active tools by maxTrackedRecords', async () => {
    adapter = createAdapter({
      ...adapterOptions,
      maxTrackedRecords: 5,
      onEvent: (evt) => emittedEvents.push(evt),
    })

    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-claude', text: 'Test block bounds' })

    // Stream message start
    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        event: {
          type: 'message_start',
          message: { id: 'msg_bounds_test' },
        },
      }) + '\n'
    )

    // Emit 5 content_block_start events (fills up to maxTrackedRecords = 5)
    for (let i = 0; i < 5; i++) {
      mockProc.stdout.write(
        JSON.stringify({
          type: 'stream_event',
          event: {
            type: 'content_block_start',
            index: i,
            content_block: { type: 'text', text: '' },
          },
        }) + '\n'
      )
    }

    expect(adapter.getStatus()).toBe('running')

    // 6th block exceeds limit
    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        event: {
          type: 'content_block_start',
          index: 5,
          content_block: { type: 'text', text: '' },
        },
      }) + '\n'
    )

    expect(adapter.getStatus()).toBe('error')
    const oomEvent = emittedEvents.find(
      (e) => e.type === 'agent.status.changed' && (e as AgentStatusChangedEvent).status === 'error'
    ) as AgentStatusChangedEvent | undefined
    expect(oomEvent).toBeDefined()
    expect(oomEvent?.error).toMatch(/Turn block limit exceeded/i)
  })

  it('prevents reentrant message.completed when adapter.stop() is called inside tool.completed callback', async () => {
    adapter = createAdapter({
      ...adapterOptions,
      onEvent: (evt) => {
        emittedEvents.push(evt)
        if (evt.type === 'tool.completed') {
          // Callback triggers stop() synchronously inside tool.completed
          void adapter.stop(false)
        }
      },
    })

    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-claude', text: 'Prompt with tool reentrancy' })

    // Stream message start
    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        event: {
          type: 'message_start',
          message: { id: 'msg_reentrancy_test' },
        },
      }) + '\n'
    )

    // Tool use
    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        event: {
          type: 'content_block_start',
          index: 0,
          content_block: {
            type: 'tool_use',
            id: 'tool_reentrant_1',
            name: 'bash',
            input: { command: 'echo 1' },
          },
        },
      }) + '\n'
    )

    // Result finalizing the turn
    mockProc.stdout.write(
      JSON.stringify({
        type: 'result',
        subtype: 'success',
        result: 'Done',
      }) + '\n'
    )

    // Verify message.completed events
    const msgCompletedEvents = emittedEvents.filter(
      (e): e is MessageCompletedEvent => e.type === 'message.completed'
    )

    // Exactly one message.completed event must be emitted
    expect(msgCompletedEvents).toHaveLength(1)
    // messageId must not be undefined
    expect(msgCompletedEvents[0].messageId).toBeDefined()
    expect(typeof msgCompletedEvents[0].messageId).toBe('string')
    expect(msgCompletedEvents[0].messageId?.length).toBeGreaterThan(0)
    expect(msgCompletedEvents[0].finishReason).toBe('interrupted')
  })

  it('enforces block count limit on snapshots with 1000 empty blocks and sets error status', async () => {
    adapter = createAdapter({
      ...adapterOptions,
      maxTrackedRecords: 2,
    })

    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-claude', text: 'Hello' })

    // Build snapshot with 1000 empty text blocks
    const content: Array<{ type: string; index: number; text: string }> = []
    for (let i = 0; i < 1000; i++) {
      content.push({ type: 'text', index: i, text: '' })
    }

    mockProc.stdout.write(
      JSON.stringify({
        type: 'assistant',
        message: {
          id: 'msg-snap-1000',
          role: 'assistant',
          content,
        },
      }) + '\n'
    )

    expect(adapter.getStatus()).toBe('error')
    const oomEvent = emittedEvents.find(
      (e): e is AgentStatusChangedEvent => e.type === 'agent.status.changed' && e.status === 'error'
    )
    expect(oomEvent).toBeDefined()
    expect(oomEvent?.error).toMatch(/Turn block limit exceeded/i)
  })

  it('enforces block count limit on deltas with distinct indices without prior block_start', async () => {
    adapter = createAdapter({
      ...adapterOptions,
      maxTrackedRecords: 2,
    })

    await adapter.start()
    await adapter.sendPrompt({ taskId: 'test-task-claude', text: 'Hello' })

    // Send deltas for block 0, block 1, block 2
    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        event: {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: 'a' },
        },
      }) + '\n'
    )

    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        event: {
          type: 'content_block_delta',
          index: 1,
          delta: { type: 'text_delta', text: 'b' },
        },
      }) + '\n'
    )

    expect(adapter.getStatus()).toBe('running')

    // Third block exceeds limit of 2
    mockProc.stdout.write(
      JSON.stringify({
        type: 'stream_event',
        event: {
          type: 'content_block_delta',
          index: 2,
          delta: { type: 'text_delta', text: 'c' },
        },
      }) + '\n'
    )

    expect(adapter.getStatus()).toBe('error')
    const oomEvent = emittedEvents.find(
      (e): e is AgentStatusChangedEvent => e.type === 'agent.status.changed' && e.status === 'error'
    )
    expect(oomEvent).toBeDefined()
    expect(oomEvent?.error).toMatch(/Turn block limit exceeded/i)
  })
})


