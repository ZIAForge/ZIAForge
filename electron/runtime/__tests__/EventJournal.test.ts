import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import { EventJournal } from '../EventJournal'
import { AgentEvent } from '../../../shared/agent-events'

describe('EventJournal', () => {
  let tempDir: string
  let journalPath: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ziaf-journal-test-'))
    journalPath = path.join(tempDir, 'sub', 'runs', 'test-run', 'events.ndjson')
  })

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('validates taskId and runId formats and blocks path traversal', () => {
    expect(() => EventJournal.getJournalPath(tempDir, '../task-1', 'run-1')).toThrow(/Invalid taskId format/i)
    expect(() => EventJournal.getJournalPath(tempDir, 'task-1', '../../run-1')).toThrow(/Invalid runId format/i)
    const validPath = EventJournal.getJournalPath(tempDir, 'task-1', 'run-1')
    expect(validPath).toContain(path.join(tempDir, 'artifacts', 'worktrees', 'task-1', 'runs', 'run-1', 'events.ndjson'))
  })

  it('creates parent directories automatically on first append', async () => {
    const journal = new EventJournal(journalPath)
    expect(fs.existsSync(path.dirname(journalPath))).toBe(false)

    const event: AgentEvent = {
      eventId: 'evt-1',
      taskId: 'task-1',
      runId: 'run-1',
      timestamp: 1000,
      type: 'message.started',
      messageId: 'msg-1',
      role: 'assistant',
    }

    await journal.append(event)
    expect(fs.existsSync(journalPath)).toBe(true)

    const events = await journal.readEvents()
    expect(events).toHaveLength(1)
    expect(events[0]).toEqual(event)
  })

  it('appends and replays 1000 events with order preservation', async () => {
    const journal = new EventJournal(journalPath)
    const totalEvents = 1000

    const eventsToAppend: AgentEvent[] = []
    for (let i = 0; i < totalEvents; i++) {
      eventsToAppend.push({
        eventId: `evt-${i}`,
        taskId: 'task-batch',
        runId: 'run-batch',
        timestamp: 1000 + i,
        type: 'message.delta',
        messageId: 'msg-batch',
        deltaType: 'text',
        content: `chunk ${i} `,
      })
    }

    await journal.appendBatch(eventsToAppend)

    const replayed = await journal.readEvents()
    expect(replayed).toHaveLength(totalEvents)
    expect(replayed[0].eventId).toBe('evt-0')
    expect(replayed[999].eventId).toBe('evt-999')
  })

  it('safely repairs torn trailing lines so subsequent events are never corrupted', async () => {
    const journal = new EventJournal(journalPath)

    const event1: AgentEvent = {
      eventId: 'evt-valid-1',
      taskId: 'task-1',
      runId: 'run-1',
      timestamp: 1000,
      type: 'message.started',
      messageId: 'msg-1',
      role: 'assistant',
    }
    await journal.append(event1)

    // Simulate abrupt crash: incomplete line without newline appended
    fs.appendFileSync(journalPath, '{"eventId":"evt-broken","taskId":"task-1",')

    // Append new valid event
    const event2: AgentEvent = {
      eventId: 'evt-valid-2',
      taskId: 'task-1',
      runId: 'run-1',
      timestamp: 2000,
      type: 'message.completed',
      messageId: 'msg-1',
    }
    await journal.append(event2)

    const events = await journal.readEvents()
    // Both valid events must be recovered; torn line safely skipped
    expect(events).toHaveLength(2)
    expect(events[0].eventId).toBe('evt-valid-1')
    expect(events[1].eventId).toBe('evt-valid-2')
  })

  it('does not poison write queue upon a transient append failure', async () => {
    const journal = new EventJournal(journalPath)

    // Make journal path a directory to simulate write error
    fs.mkdirSync(journalPath, { recursive: true })

    await expect(
      journal.append({
        eventId: 'fail-1',
        taskId: 't1',
        runId: 'r1',
        timestamp: 10,
        type: 'raw.log',
        stream: 'stdout',
        line: 'test',
      })
    ).rejects.toThrow()

    // Restore normal file path
    fs.rmSync(journalPath, { recursive: true, force: true })

    // Next append must succeed without being blocked by previous failure
    await journal.append({
      eventId: 'success-1',
      taskId: 't1',
      runId: 'r1',
      timestamp: 20,
      type: 'raw.log',
      stream: 'stdout',
      line: 'recovered',
    })

    const events = await journal.readEvents()
    expect(events).toHaveLength(1)
    expect(events[0].eventId).toBe('success-1')
  })

  it('supports streaming events via async callback', async () => {
    const journal = new EventJournal(journalPath)
    const eventsToAppend: AgentEvent[] = [
      {
        eventId: 'evt-1',
        taskId: 'task-stream',
        runId: 'run-stream',
        timestamp: 1000,
        type: 'message.started',
        messageId: 'msg-1',
        role: 'user',
      },
      {
        eventId: 'evt-2',
        taskId: 'task-stream',
        runId: 'run-stream',
        timestamp: 1001,
        type: 'message.delta',
        messageId: 'msg-1',
        deltaType: 'text',
        content: 'Hello world',
      },
    ]

    await journal.appendBatch(eventsToAppend)

    const collected: AgentEvent[] = []
    const count = await journal.streamEvents(async (evt) => {
      await new Promise((resolve) => setTimeout(resolve, 5))
      collected.push(evt)
    })

    expect(count).toBe(2)
    expect(collected).toEqual(eventsToAppend)
  })

  it('reconstructs message text, thinking, and tool output deltas', async () => {
    const journal = new EventJournal(journalPath)

    await journal.append({
      eventId: 'e1',
      taskId: 't1',
      runId: 'r1',
      timestamp: 100,
      type: 'message.started',
      messageId: 'm1',
      role: 'assistant',
    })

    await journal.append({
      eventId: 'e2',
      taskId: 't1',
      runId: 'r1',
      timestamp: 101,
      type: 'message.delta',
      messageId: 'm1',
      deltaType: 'thinking',
      content: 'Planning...',
    })

    await journal.append({
      eventId: 'e3',
      taskId: 't1',
      runId: 'r1',
      timestamp: 102,
      type: 'tool.started',
      toolCallId: 'tool-1',
      toolName: 'read_file',
      input: { path: 'package.json' },
    })

    await journal.append({
      eventId: 'e4',
      taskId: 't1',
      runId: 'r1',
      timestamp: 103,
      type: 'tool.output.delta',
      toolCallId: 'tool-1',
      delta: '{"name": ',
    })

    await journal.append({
      eventId: 'e5',
      taskId: 't1',
      runId: 'r1',
      timestamp: 104,
      type: 'tool.output.delta',
      toolCallId: 'tool-1',
      delta: '"ziaforge"}',
    })

    await journal.append({
      eventId: 'e6',
      taskId: 't1',
      runId: 'r1',
      timestamp: 105,
      type: 'tool.completed',
      toolCallId: 'tool-1',
      exitCode: 0,
      outcome: 'completed',
    })

    await journal.append({
      eventId: 'e7',
      taskId: 't1',
      runId: 'r1',
      timestamp: 106,
      type: 'message.completed',
      messageId: 'm1',
      fullContent: 'Read package.json successfully.',
      finishReason: 'stop',
    })

    const projection = await journal.reconstructFeed()
    expect(projection).toHaveLength(1)
    expect(projection[0].id).toBe('m1')
    expect(projection[0].text).toBe('Read package.json successfully.')
    expect(projection[0].tools).toHaveLength(1)
    expect(projection[0].tools![0].output).toBe('{"name": "ziaforge"}')
    expect(projection[0].tools![0].status).toBe('completed')
    expect(projection[0].tools![0].exitCode).toBe(0)
  })

  it('correctly handles standalone tools/approvals, user messages isolation, outcome status, and empty fullContent', async () => {
    const journal = new EventJournal(journalPath)

    // 1. Tool and approval emitted before any message: creates synthetic assistant turn
    await journal.append({
      eventId: 'pre-tool-1',
      taskId: 't2',
      runId: 'r2',
      timestamp: 50,
      type: 'tool.started',
      toolCallId: 't-pre',
      toolName: 'init_repo',
    })

    await journal.append({
      eventId: 'pre-app-1',
      taskId: 't2',
      runId: 'r2',
      timestamp: 51,
      type: 'permission.requested',
      approvalId: 'app-pre',
      toolCallId: 't-pre',
      command: 'git init',
    })

    await journal.append({
      eventId: 'pre-tool-2',
      taskId: 't2',
      runId: 'r2',
      timestamp: 52,
      type: 'tool.completed',
      toolCallId: 't-pre',
      outcome: 'failed',
    })

    // 2. User message emitted
    await journal.append({
      eventId: 'user-1',
      taskId: 't2',
      runId: 'r2',
      timestamp: 60,
      type: 'message.started',
      messageId: 'msg-user-1',
      role: 'user',
    })

    await journal.append({
      eventId: 'user-2',
      taskId: 't2',
      runId: 'r2',
      timestamp: 61,
      type: 'message.delta',
      messageId: 'msg-user-1',
      deltaType: 'text',
      content: 'User query here',
    })

    // 3. Assistant tool should NEVER attach to user message; must attach to assistant
    await journal.append({
      eventId: 'tool-ast-1',
      taskId: 't2',
      runId: 'r2',
      timestamp: 70,
      type: 'tool.started',
      toolCallId: 't-cancelled',
      toolName: 'cancel_me',
    })

    await journal.append({
      eventId: 'tool-ast-2',
      taskId: 't2',
      runId: 'r2',
      timestamp: 71,
      type: 'tool.completed',
      toolCallId: 't-cancelled',
      outcome: 'cancelled',
    })

    // 4. Message completed with explicit empty fullContent
    await journal.append({
      eventId: 'ast-msg-1',
      taskId: 't2',
      runId: 'r2',
      timestamp: 80,
      type: 'message.started',
      messageId: 'msg-ast-1',
      role: 'assistant',
    })

    await journal.append({
      eventId: 'ast-msg-2',
      taskId: 't2',
      runId: 'r2',
      timestamp: 81,
      type: 'message.completed',
      messageId: 'msg-ast-1',
      fullContent: '',
    })

    const feed = await journal.reconstructFeed()
    expect(feed.length).toBeGreaterThanOrEqual(2)

    // Check pre-message tool
    const firstTurn = feed[0]
    expect(firstTurn.role).toBe('assistant')
    expect(firstTurn.tools).toHaveLength(1)
    expect(firstTurn.tools![0].status).toBe('error') // from outcome: 'failed'
    expect(firstTurn.approvals).toHaveLength(1)

    // User message should NOT have tools attached
    const userMsg = feed.find((m) => m.id === 'msg-user-1')
    expect(userMsg).toBeDefined()
    expect(userMsg?.tools || []).toHaveLength(0)

    // Empty fullContent is preserved as empty string
    const emptyMsg = feed.find((m) => m.id === 'msg-ast-1')
    expect(emptyMsg?.text).toBe('')
  })

  it('correctly manages explicit turnId correlation across intervening user messages without overwrite or collapse', async () => {
    const journal = new EventJournal(journalPath)

    // Tool in turn-A
    await journal.append({
      eventId: 'ta-1',
      taskId: 't3',
      runId: 'r3',
      timestamp: 10,
      type: 'tool.started',
      toolCallId: 'call-a1',
      toolName: 'cmd_a',
      turnId: 'turn-A',
    })

    // User message in between
    await journal.append({
      eventId: 'u-1',
      taskId: 't3',
      runId: 'r3',
      timestamp: 20,
      type: 'message.started',
      messageId: 'user-intervene',
      role: 'user',
    })

    // Another tool continuing turn-A
    await journal.append({
      eventId: 'ta-2',
      taskId: 't3',
      runId: 'r3',
      timestamp: 30,
      type: 'tool.started',
      toolCallId: 'call-a2',
      toolName: 'cmd_a_part2',
      turnId: 'turn-A',
    })

    // Tool in separate turn-B
    await journal.append({
      eventId: 'tb-1',
      taskId: 't3',
      runId: 'r3',
      timestamp: 40,
      type: 'tool.started',
      toolCallId: 'call-b1',
      toolName: 'cmd_b',
      turnId: 'turn-B',
    })

    const feed = await journal.reconstructFeed()
    // turn-A, user-intervene, turn-B
    expect(feed).toHaveLength(3)

    const turnA = feed.find((m) => m.id === 'turn-A')
    expect(turnA).toBeDefined()
    expect(turnA?.tools).toHaveLength(2)
    expect(turnA?.tools![0].callId).toBe('call-a1')
    expect(turnA?.tools![1].callId).toBe('call-a2')

    const turnB = feed.find((m) => m.id === 'turn-B')
    expect(turnB).toBeDefined()
    expect(turnB?.tools).toHaveLength(1)
    expect(turnB?.tools![0].callId).toBe('call-b1')
  })

  it('guarantees deterministic replay equality across multiple reconstructFeed runs', async () => {
    const journal = new EventJournal(journalPath)

    await journal.append({
      eventId: 'det-1',
      taskId: 't-det',
      runId: 'r-det',
      timestamp: 100,
      type: 'tool.started',
      toolCallId: 'tcall-1',
      toolName: 'read_status',
    })

    const run1 = await journal.reconstructFeed()
    const run2 = await journal.reconstructFeed()

    expect(run1).toEqual(run2)
    expect(run1[0].id).toBe(run2[0].id)
    expect(run1[0].id).toBe('turn-syn-det-1')
  })
  it('projects reasoning, tools, approvals and a terminal event into their actual turn', async () => {
    const journal = new EventJournal(journalPath)
    const base = { taskId: 'task', runId: 'run', timestamp: 1 }
    const events: AgentEvent[] = [
      { ...base, eventId: '1', type: 'message.started', messageId: 'm1', role: 'assistant', turnId: 't1' },
      { ...base, eventId: '2', type: 'tool.started', toolCallId: 'tool', toolName: 'command', turnId: 't1' },
      { ...base, eventId: '3', type: 'permission.requested', approvalId: 'approval', turnId: 't1' },
      { ...base, eventId: '4', type: 'message.completed', messageId: 'reason', turnId: 't2', fullContent: 'Reasoning', contentType: 'thinking' },
      { ...base, eventId: '5', type: 'agent.status.changed', scope: 'turn', turnId: 't1', status: 'stopped' },
    ]
    await journal.appendBatch(events)
    const feed = await journal.reconstructFeed()
    expect(feed).toHaveLength(2)
    expect(feed[0]).toMatchObject({ id: 'm1', turnId: 't1', status: 'interrupted', tools: [{ callId: 'tool', status: 'cancelled' }], approvals: [{ approvalId: 'approval', state: 'expired' }] })
    expect(feed[1]).toMatchObject({ id: 'reason', turnId: 't2', thinking: 'Reasoning', text: '', status: 'completed' })
  })

})

