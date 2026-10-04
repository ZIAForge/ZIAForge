import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import { RunService } from '../RunService'
import { SessionRegistry } from '../SessionRegistry'
import { EventJournal } from '../EventJournal'
import { ProcessSupervisor } from '../ProcessSupervisor'
import { StartTaskRequest, StopTaskRequest } from '../../../shared/agent-commands'
import { AgentEvent, AgentStatusChangedEvent } from '../../../shared/agent-events'

describe('RunService and SessionRegistry', () => {
  let tempDir: string
  let worktreeDir: string
  let sessionRegistry: SessionRegistry
  let processSupervisor: ProcessSupervisor
  let runService: RunService

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ziaf-runservice-test-'))
    worktreeDir = path.join(tempDir, 'worktree-1')
    fs.mkdirSync(worktreeDir, { recursive: true })

    sessionRegistry = new SessionRegistry()
    processSupervisor = new ProcessSupervisor()
    runService = new RunService({
      sessionRegistry,
      processSupervisor,
      baseStorageDir: tempDir,
    })
  })

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('validates worktree path and rejects non-existent or file paths', async () => {
    const invalidReq: StartTaskRequest = {
      taskId: 'task-invalid',
      worktreePath: path.join(tempDir, 'non-existent-dir'),
      agentProvider: 'codex',
    }

    await expect(runService.startTask(invalidReq)).rejects.toThrow(
      /Target worktree directory does not exist/i
    )

    // Check when path points to a file, not a directory
    const filePath = path.join(tempDir, 'file.txt')
    fs.writeFileSync(filePath, 'hello')
    const fileReq: StartTaskRequest = {
      taskId: 'task-file',
      worktreePath: filePath,
      agentProvider: 'codex',
    }
    await expect(runService.startTask(fileReq)).rejects.toThrow(
      /Target worktree path is not a directory/i
    )
  })

  it('starts a task, registers session, and writes running event to EventJournal', async () => {
    const broadcastEvents: AgentEvent[] = []
    const unsub = runService.onEvent((evt) => broadcastEvents.push(evt))

    const req: StartTaskRequest = {
      taskId: 'task-1',
      worktreePath: worktreeDir,
      agentProvider: 'codex',
      model: 'gpt-6-astra',
      prompt: 'Refactor database schema',
    }

    const session = await runService.startTask(req)
    expect(session.taskId).toBe('task-1')
    expect(session.status).toBe('running')
    expect(session.agentProvider).toBe('codex')
    expect(session.runId).toBeTruthy()

    // SessionRegistry contains the session
    const registered = sessionRegistry.get('task-1')
    expect(registered).toEqual(session)
    expect(sessionRegistry.getBySessionId(session.sessionId)).toEqual(session)
    expect(sessionRegistry.getByRunId(session.runId)).toEqual(session)
    expect(sessionRegistry.hasActiveSession('task-1')).toBe(true)
    expect(runService.getSession('task-1')).toEqual(session)
    expect(runService.listSessions()).toHaveLength(1)

    // Broadcast callback received status change
    expect(broadcastEvents.some((e) => e.type === 'agent.status.changed' && e.status === 'running')).toBe(true)

    // EventJournal was created and contains event
    const events = await runService.getEvents('task-1', session.runId)
    expect(events.length).toBeGreaterThanOrEqual(1)
    expect(events[0].type).toBe('agent.status.changed')

    unsub()
  })

  it('shares in-flight promise for concurrent startTask calls without race conditions', async () => {
    const req: StartTaskRequest = {
      taskId: 'task-concurrent',
      worktreePath: worktreeDir,
      agentProvider: 'antigravity',
    }

    const [session1, session2] = await Promise.all([
      runService.startTask(req),
      runService.startTask(req),
    ])

    expect(session1.runId).toBe(session2.runId)
    expect(session1.sessionId).toBe(session2.sessionId)
    expect(sessionRegistry.getAll().filter((s) => s.taskId === 'task-concurrent')).toHaveLength(1)
  })

  it('stops a running task, triggers killProcessTree if pid is tracked, and marks status as stopped', async () => {
    const req: StartTaskRequest = {
      taskId: 'task-stop',
      worktreePath: worktreeDir,
      agentProvider: 'claude',
    }

    const session = await runService.startTask(req)
    expect(session.status).toBe('running')

    // Mock PID and ProcessSupervisor termination
    sessionRegistry.setPid('task-stop', 99999, session.runId)
    const killSpy = vi.spyOn(processSupervisor, 'terminateProcessTree').mockResolvedValue(true)

    const stopReq: StopTaskRequest = {
      taskId: 'task-stop',
      runId: session.runId,
      force: true,
    }

    const stoppedSession = await runService.stopTask(stopReq)
    expect(stoppedSession.status).toBe('stopped')
    expect(killSpy).toHaveBeenCalledWith(99999, { force: true })

    const inRegistry = sessionRegistry.get('task-stop')
    expect(inRegistry?.status).toBe('stopped')
    expect(sessionRegistry.hasActiveSession('task-stop')).toBe(false)

    const events = await runService.getEvents('task-stop', session.runId)
    const lastEvent = events[events.length - 1]
    expect(lastEvent.type).toBe('agent.status.changed')
    if (lastEvent.type === 'agent.status.changed') {
      expect(lastEvent.status).toBe('stopped')
    }
  })

  it('rejects stale stop requests if runId does not match the active session', async () => {
    const req: StartTaskRequest = {
      taskId: 'task-stale',
      worktreePath: worktreeDir,
      agentProvider: 'codex',
    }
    const session = await runService.startTask(req)
    expect(session.runId).toBeTruthy()

    await expect(
      runService.stopTask({
        taskId: 'task-stale',
        runId: 'old-stale-run-999',
      })
    ).rejects.toThrow(/Stale stop request/i)

    // Active session should remain running
    expect(sessionRegistry.get('task-stale')?.status).toBe('running')
  })

  it('automatically synchronizes registry status when emitting completion or error events', async () => {
    const req: StartTaskRequest = {
      taskId: 'task-sync',
      worktreePath: worktreeDir,
      agentProvider: 'codex',
    }
    const session = await runService.startTask(req)
    expect(sessionRegistry.get('task-sync')?.status).toBe('running')

    // Emit completed event
    await runService.emitEvent({
      eventId: 'evt-c-1',
      taskId: session.taskId,
      runId: session.runId,
      timestamp: Date.now(),
      type: 'agent.status.changed',
      status: 'completed',
    })

    expect(sessionRegistry.get('task-sync')?.status).toBe('completed')
    expect(sessionRegistry.hasActiveSession('task-sync')).toBe(false)
  })

  it('emits message deltas and reconstructs conversation feed', async () => {
    const req: StartTaskRequest = {
      taskId: 'task-feed',
      worktreePath: worktreeDir,
      agentProvider: 'codex',
    }
    const session = await runService.startTask(req)

    await runService.emitEvent({
      eventId: 'evt-msg-1',
      taskId: session.taskId,
      runId: session.runId,
      timestamp: Date.now(),
      type: 'message.started',
      messageId: 'msg-feed-1',
      role: 'assistant',
    })

    await runService.emitEvent({
      eventId: 'evt-msg-2',
      taskId: session.taskId,
      runId: session.runId,
      timestamp: Date.now(),
      type: 'message.delta',
      messageId: 'msg-feed-1',
      deltaType: 'text',
      content: 'Here is the implementation plan.',
    })

    await runService.emitEvent({
      eventId: 'evt-msg-3',
      taskId: session.taskId,
      runId: session.runId,
      timestamp: Date.now(),
      type: 'message.completed',
      messageId: 'msg-feed-1',
    })

    const feed = await runService.getReconstructedFeed(session.taskId, session.runId)
    expect(feed).toHaveLength(1)
    expect(feed[0].text).toBe('Here is the implementation plan.')
    expect(feed[0].status).toBe('completed')

    // getReconstructedFeed with inferred runId
    const feedAuto = await runService.getReconstructedFeed(session.taskId)
    expect(feedAuto).toHaveLength(1)

    // getReconstructedFeed with unknown task returns empty
    const emptyFeed = await runService.getReconstructedFeed('unknown-task')
    expect(emptyFeed).toEqual([])
  })

  it('manages session removal, setPid, and clearing in SessionRegistry', () => {
    sessionRegistry.register({
      taskId: 't-test',
      runId: 'r-test',
      sessionId: 's-test',
      agentProvider: 'codex',
      status: 'idle',
      worktreePath: worktreeDir,
      startedAt: Date.now(),
    })
    expect(sessionRegistry.get('t-test')).toBeDefined()
    expect(sessionRegistry.setPid('t-test', 1234, 'r-test')).toBe(true)
    expect(sessionRegistry.setPid('t-test', 5678, 'wrong-run')).toBe(false)
    expect(sessionRegistry.remove('t-test')).toBe(true)
    expect(sessionRegistry.get('t-test')).toBeUndefined()

    sessionRegistry.register({
      taskId: 't-2',
      runId: 'r-2',
      sessionId: 's-2',
      agentProvider: 'codex',
      status: 'idle',
      worktreePath: worktreeDir,
      startedAt: Date.now(),
    })
    sessionRegistry.clear()
    expect(sessionRegistry.getAll()).toHaveLength(0)
  })

  it('provides idempotent stopTask and prevents resurrection of stopped session', async () => {
    const req: StartTaskRequest = {
      taskId: 't-stop-idem',
      worktreePath: worktreeDir,
      agentProvider: 'codex',
    }
    const session = await runService.startTask(req)
    sessionRegistry.setPid('t-stop-idem', 11111, session.runId)

    const killSpy = vi.spyOn(processSupervisor, 'terminateProcessTree').mockResolvedValue(true)

    const stop1 = await runService.stopTask({ taskId: 't-stop-idem' })
    expect(stop1.status).toBe('stopped')
    expect(killSpy).toHaveBeenCalledTimes(1)

    // Second stop should be idempotent and not call kill again
    const stop2 = await runService.stopTask({ taskId: 't-stop-idem' })
    expect(stop2.status).toBe('stopped')
    expect(killSpy).toHaveBeenCalledTimes(1)

    // Attempting to update status to running for this stopped run must be rejected
    const resurrected = sessionRegistry.updateStatus('t-stop-idem', 'running', undefined, session.runId)
    expect(resurrected).toBeUndefined()
    expect(sessionRegistry.get('t-stop-idem')?.status).toBe('stopped')
  })

  it('rolls back session and rejects all concurrent callers if startup initialization fails', async () => {
    // Force emitEvent to fail during startup by mocking getJournal to throw on the FIRST append only
    const journalMock = {
      append: vi.fn().mockRejectedValueOnce(new Error('Disk I/O failed')),
      readEvents: vi.fn().mockResolvedValue([]),
    }
    vi.spyOn(runService, 'getJournal').mockReturnValue(journalMock as unknown as EventJournal)

    const req: StartTaskRequest = {
      taskId: 't-fail-start',
      worktreePath: worktreeDir,
      agentProvider: 'codex',
    }

    const startPromise1 = runService.startTask(req)
    const startPromise2 = runService.startTask(req)

    // Both callers must reject with the one-shot error
    await expect(startPromise1).rejects.toThrow(/Disk I\/O failed/i)
    await expect(startPromise2).rejects.toThrow(/Disk I\/O failed/i)

    // Crucially: exactly 1 initialization attempt was made across concurrent callers!
    expect(journalMock.append).toHaveBeenCalledTimes(1)

    // Session must be completely rolled back from registry
    expect(sessionRegistry.get('t-fail-start')).toBeUndefined()
    expect(sessionRegistry.hasActiveSession('t-fail-start')).toBe(false)
  })

  it('retains process ownership and refuses stopped transition when kill fails', async () => {
    const req: StartTaskRequest = {
      taskId: 't-kill-fail',
      worktreePath: worktreeDir,
      agentProvider: 'codex',
    }
    const session = await runService.startTask(req)
    sessionRegistry.setPid('t-kill-fail', 77777, session.runId)

    // Mock terminateProcessTree returning false (failure)
    vi.spyOn(processSupervisor, 'terminateProcessTree').mockResolvedValue(false)

    await expect(runService.stopTask({ taskId: 't-kill-fail' })).rejects.toThrow(
      /Failed to terminate process PID 77777/i
    )

    // Session must NOT be marked stopped, and PID must be retained for retry
    const state = sessionRegistry.get('t-kill-fail')
    expect(state?.status).toBe('stopping')
    expect(state?.pid).toBe(77777)
  })

  it('strictly blocks indirect resurrection and publishing of invalid transitions', async () => {
    const req: StartTaskRequest = {
      taskId: 't-resurrect',
      worktreePath: worktreeDir,
      agentProvider: 'codex',
    }
    const session = await runService.startTask(req)
    await runService.stopTask({ taskId: 't-resurrect' })
    expect(sessionRegistry.get('t-resurrect')?.status).toBe('stopped')

    // Indirect resurrection: stopped -> waiting_for_approval
    const indirectAttempt = sessionRegistry.updateStatus('t-resurrect', 'waiting_for_approval', undefined, session.runId)
    expect(indirectAttempt).toBeUndefined()
    expect(sessionRegistry.get('t-resurrect')?.status).toBe('stopped')

    // Emitting invalid transition throws and prevents publication
    await expect(
      runService.emitEvent({
        eventId: 'evt-illegal',
        taskId: 't-resurrect',
        runId: session.runId,
        timestamp: Date.now(),
        type: 'agent.status.changed',
        status: 'running',
      })
    ).rejects.toThrow(/Rejected invalid status transition/i)
  })

  it('prohibits starting a new run while previous run is still stopping, preserving PID', async () => {
    const req: StartTaskRequest = {
      taskId: 't-stopping-guard',
      worktreePath: worktreeDir,
      agentProvider: 'codex',
    }
    const session = await runService.startTask(req)
    sessionRegistry.setPid('t-stopping-guard', 88888, session.runId)

    // Simulate failed stop leaving session in 'stopping' state
    vi.spyOn(processSupervisor, 'terminateProcessTree').mockResolvedValue(false)
    await expect(runService.stopTask({ taskId: 't-stopping-guard' })).rejects.toThrow()

    expect(sessionRegistry.get('t-stopping-guard')?.status).toBe('stopping')
    expect(sessionRegistry.get('t-stopping-guard')?.pid).toBe(88888)

    // Attempting to start again must be rejected, preserving the PID
    await expect(runService.startTask(req)).rejects.toThrow(/still stopping/i)
    expect(sessionRegistry.get('t-stopping-guard')?.pid).toBe(88888)
  })

  it('prohibits starting a new run after failed stop followed by error event until teardown is resolved (failed stop -> error -> start)', async () => {
    const req: StartTaskRequest = {
      taskId: 't-failed-stop-error-start',
      worktreePath: worktreeDir,
      agentProvider: 'codex',
    }
    const session = await runService.startTask(req)
    sessionRegistry.setPid('t-failed-stop-error-start', 88888, session.runId)

    // 1. Simulate failed stop leaving session in 'stopping' state and unresolved teardown
    const terminateSpy = vi.spyOn(processSupervisor, 'terminateProcessTree').mockResolvedValue(false)
    const isAliveSpy = vi.spyOn(processSupervisor, 'isProcessAlive').mockReturnValue(true)
    await expect(runService.stopTask({ taskId: 't-failed-stop-error-start' })).rejects.toThrow(/Failed to terminate/i)

    expect(sessionRegistry.get('t-failed-stop-error-start')?.status).toBe('stopping')
    expect(sessionRegistry.get('t-failed-stop-error-start')?.pid).toBe(88888)

    // 2. An error event is emitted (transition stopping -> error)
    await runService.emitEvent({
      eventId: 'evt-teardown-error',
      taskId: 't-failed-stop-error-start',
      runId: session.runId,
      timestamp: Date.now(),
      type: 'agent.status.changed',
      status: 'error',
      error: 'Teardown failure',
    })

    // Session is now in 'error' state, but PID 88888 MUST be preserved!
    const sessionInError = sessionRegistry.get('t-failed-stop-error-start')
    expect(sessionInError?.status).toBe('error')
    expect(sessionInError?.pid).toBe(88888)

    // 3. Attempting to start a new task must be rejected because teardown ownership is unresolved!
    await expect(runService.startTask(req)).rejects.toThrow(/unresolved/i)

    // 4. Retry stop with force: true succeeds
    terminateSpy.mockResolvedValue(true)
    isAliveSpy.mockReturnValue(false)
    vi.spyOn(processSupervisor, 'getOwnedPids').mockReturnValue([])

    await runService.stopTask({ taskId: 't-failed-stop-error-start', force: true })

    const sessionAfterResolved = sessionRegistry.get('t-failed-stop-error-start')
    expect(sessionAfterResolved?.status).toBe('stopped')
    expect(sessionAfterResolved?.pid).toBeUndefined()

    // 5. Now starting a new task succeeds!
    const newSession = await runService.startTask(req)
    expect(newSession.status).toBe('running')
    expect(newSession.runId).not.toBe(session.runId)
  })

  it('returns existing healthy active session when startTask is called repeatedly with a live registered PID', async () => {
    const req: StartTaskRequest = {
      taskId: 't-repeated-start-active',
      worktreePath: worktreeDir,
      agentProvider: 'codex',
    }
    const session1 = await runService.startTask(req)
    expect(session1.status).toBe('running')

    // Simulate agent runner registering an active live PID
    sessionRegistry.setPid('t-repeated-start-active', 55555, session1.runId)
    vi.spyOn(processSupervisor, 'isProcessAlive').mockReturnValue(true)

    // Repeated call to startTask for the active running session must be idempotent and return existing session!
    const session2 = await runService.startTask(req)
    expect(session2).toBeDefined()
    expect(session2.taskId).toBe('t-repeated-start-active')
    expect(session2.runId).toBe(session1.runId)
    expect(session2.status).toBe('running')
    expect(session2.pid).toBe(55555)
  })

  it('preserves running state and PID if completion append fails, allowing successful retry', async () => {
    const req: StartTaskRequest = {
      taskId: 't-tx-retry',
      worktreePath: worktreeDir,
      agentProvider: 'codex',
    }
    const session = await runService.startTask(req)
    sessionRegistry.setPid('t-tx-retry', 99991, session.runId)

    const journal = runService.getJournal('t-tx-retry', session.runId)
    const originalAppend = journal.append.bind(journal)

    // Temporarily fail next append
    const appendSpy = vi.spyOn(journal, 'append').mockRejectedValueOnce(new Error('Journal disk full'))

    const completionEvt: AgentEvent = {
      eventId: 'evt-comp-tx',
      taskId: session.taskId,
      runId: session.runId,
      timestamp: Date.now(),
      type: 'agent.status.changed',
      status: 'completed',
    }

    // First attempt fails during append
    await expect(runService.emitEvent(completionEvt)).rejects.toThrow(/Journal disk full/i)

    // Session must STILL be running with PID preserved!
    const sessionAfterFail = sessionRegistry.get('t-tx-retry')
    expect(sessionAfterFail?.status).toBe('running')
    expect(sessionAfterFail?.pid).toBe(99991)

    // Restore append and retry
    appendSpy.mockImplementation(originalAppend)
    await runService.emitEvent(completionEvt)

    // Now it should be completed and PID cleared
    const sessionAfterSuccess = sessionRegistry.get('t-tx-retry')
    expect(sessionAfterSuccess?.status).toBe('completed')
    expect(sessionAfterSuccess?.pid).toBeUndefined()
  })

  it('serializes validate -> append -> apply -> broadcast and rejects conflicting terminal events when first append is pending', async () => {
    const req: StartTaskRequest = {
      taskId: 't-concurrent-term',
      worktreePath: worktreeDir,
      agentProvider: 'codex',
    }
    const session = await runService.startTask(req)
    expect(sessionRegistry.get('t-concurrent-term')?.status).toBe('running')

    const journal = runService.getJournal('t-concurrent-term', session.runId)
    const originalAppend = journal.append.bind(journal)

    let releaseAppend!: () => void
    const appendGate = new Promise<void>((r) => { releaseAppend = r })

    // Intercept append: when 'completed' is appended, hold it pending until released
    vi.spyOn(journal, 'append').mockImplementation(async (event: AgentEvent) => {
      if (event.type === 'agent.status.changed' && event.status === 'completed') {
        await appendGate
      }
      return originalAppend(event)
    })

    const receivedEvents: AgentEvent[] = []
    const unsub = runService.onEvent((evt) => {
      if (evt.taskId === 't-concurrent-term') {
        receivedEvents.push(evt)
      }
    })

    const completedEvt: AgentEvent = {
      eventId: 'evt-completed-term',
      taskId: session.taskId,
      runId: session.runId,
      timestamp: Date.now(),
      type: 'agent.status.changed',
      status: 'completed',
    }

    const errorEvt: AgentEvent = {
      eventId: 'evt-error-term',
      taskId: session.taskId,
      runId: session.runId,
      timestamp: Date.now() + 1,
      type: 'agent.status.changed',
      status: 'error',
      error: 'Unexpected crash',
    }

    // Submit first event (completed): starts append and blocks waiting for appendGate
    const pCompleted = runService.emitEvent(completedEvt)

    // Concurrently submit conflicting terminal event (error)
    const pError = runService.emitEvent(errorEvt)

    // Now release the gate to let the first append complete
    releaseAppend()

    // Completed must succeed
    await expect(pCompleted).resolves.toBeUndefined()

    // Error must be rejected due to invalid transition from 'completed' to 'error'
    await expect(pError).rejects.toThrow(/Rejected invalid status transition from "completed" to "error"/i)

    // Verify registry and journal/replay agreement
    expect(sessionRegistry.get('t-concurrent-term')?.status).toBe('completed')

    const events = await runService.getEvents('t-concurrent-term', session.runId)
    const terminalEvents = events.filter((e): e is AgentStatusChangedEvent => e.type === 'agent.status.changed' && (e.status === 'completed' || e.status === 'error'))
    expect(terminalEvents).toHaveLength(1)
    expect(terminalEvents[0].status).toBe('completed')

    // Listeners must only have received the valid 'completed' event, never 'error'
    const broadcastTerminal = receivedEvents.filter((e): e is AgentStatusChangedEvent => e.type === 'agent.status.changed' && (e.status === 'completed' || e.status === 'error'))
    expect(broadcastTerminal).toHaveLength(1)
    expect(broadcastTerminal[0].status).toBe('completed')

    unsub()
  })
})

