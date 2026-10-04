import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ApprovalRegistry, RegisterApprovalOptions } from '../ApprovalRegistry'

describe('ApprovalRegistry', () => {
  let registry: ApprovalRegistry

  beforeEach(() => {
    vi.useFakeTimers()
    registry = new ApprovalRegistry()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('registers a new approval request in pending state', () => {
    const record = registry.register({
      approvalId: 'appr-1',
      taskId: 'task-100',
      runId: 'run-1',
      command: 'rm -rf /tmp/test',
      description: 'Directory cleanup',
      resolver: vi.fn(),
    })

    expect(record.approvalId).toBe('appr-1')
    expect(record.taskId).toBe('task-100')
    expect(record.state).toBe('pending')
    expect(record.command).toBe('rm -rf /tmp/test')
    expect(registry.get('appr-1')).toEqual(record)
  })

  it('rejects registering duplicate approvalId', () => {
    const options: RegisterApprovalOptions = {
      approvalId: 'appr-dup',
      taskId: 'task-100',
      runId: 'run-1',
      command: 'ls',
      resolver: vi.fn(),
    }

    registry.register(options)
    expect(() => registry.register(options)).toThrow(/already exists/i)
  })

  it('resolves approval with allow and invokes registered resolver', async () => {
    const resolver = vi.fn().mockResolvedValue(undefined)
    registry.register({
      approvalId: 'appr-allow',
      taskId: 'task-1',
      runId: 'run-1',
      command: 'git push',
      resolver,
    })

    await registry.resolve('appr-allow', 'allow')

    expect(resolver).toHaveBeenCalledWith('allow', undefined)
    const record = registry.get('appr-allow')
    expect(record?.state).toBe('resolved')
    expect(record?.decision).toBe('allow')
    expect(record?.resolvedBy).toBe('user')
  })

  it('resolves approval with deny and custom note', async () => {
    const resolver = vi.fn().mockResolvedValue(undefined)
    registry.register({
      approvalId: 'appr-deny',
      taskId: 'task-1',
      runId: 'run-1',
      command: 'drop table users',
      resolver,
    })

    await registry.resolve('appr-deny', 'deny', 'Denied by admin')

    expect(resolver).toHaveBeenCalledWith('deny', 'Denied by admin')
    const record = registry.get('appr-deny')
    expect(record?.state).toBe('resolved')
    expect(record?.decision).toBe('deny')
  })

  it('rejects resolving already resolved or non-existent approval', async () => {
    registry.register({
      approvalId: 'appr-once',
      taskId: 'task-1',
      runId: 'run-1',
      resolver: vi.fn(),
    })

    await registry.resolve('appr-once', 'allow')

    // Second resolution should fail
    await expect(registry.resolve('appr-once', 'allow')).rejects.toThrow(
      /already resolved or terminated/i
    )

    // Non-existent approval should fail
    await expect(registry.resolve('non-existent', 'allow')).rejects.toThrow(/not found/i)
  })

  it('automatically expires request when timeout is reached', async () => {
    const resolver = vi.fn().mockResolvedValue(undefined)
    registry.register({
      approvalId: 'appr-exp',
      taskId: 'task-1',
      runId: 'run-1',
      timeoutMs: 5000,
      resolver,
    })

    const before = registry.get('appr-exp')
    expect(before?.state).toBe('pending')

    // Advance time past timeout
    vi.advanceTimersByTime(5001)

    const after = registry.get('appr-exp')
    expect(after?.state).toBe('expired')
    expect(after?.resolvedBy).toBe('timeout')
    expect(resolver).toHaveBeenCalledWith('deny', 'Approval request timed out after 5000ms')
  })

  it('filters active approvals by taskId and clears pending approvals for task', () => {
    registry.register({
      approvalId: 'appr-t1-1',
      taskId: 'task-A',
      runId: 'run-1',
      resolver: vi.fn(),
    })
    registry.register({
      approvalId: 'appr-t1-2',
      taskId: 'task-A',
      runId: 'run-1',
      resolver: vi.fn(),
    })
    registry.register({
      approvalId: 'appr-t2-1',
      taskId: 'task-B',
      runId: 'run-2',
      resolver: vi.fn(),
    })

    const activeA = registry.getActiveByTask('task-A')
    expect(activeA.length).toBe(2)

    registry.clearForTask('task-A')

    const clearedA = registry.getActiveByTask('task-A')
    expect(clearedA.length).toBe(0)

    const activeB = registry.getActiveByTask('task-B')
    expect(activeB.length).toBe(1)
  })

  it('notifies state change listeners through lifecycle', async () => {
    const states: string[] = []
    registry.onStateChanged((record) => {
      states.push(record.state)
    })

    registry.register({
      approvalId: 'appr-listener',
      taskId: 'task-1',
      runId: 'run-1',
      resolver: vi.fn(),
    })

    await registry.resolve('appr-listener', 'allow')

    expect(states).toContain('pending')
    expect(states).toContain('submitting')
    expect(states).toContain('resolved')
  })

  it('unsubscribes listener and catches listener exceptions gracefully', () => {
    const errorListener = vi.fn().mockImplementation(() => {
      throw new Error('Listener crash')
    })
    const unsubscribe = registry.onStateChanged(errorListener)

    expect(() => {
      registry.register({
        approvalId: 'appr-err-listener',
        taskId: 'task-1',
        runId: 'run-1',
        resolver: vi.fn(),
      })
    }).not.toThrow()
    expect(errorListener).toHaveBeenCalledTimes(1)

    unsubscribe()

    registry.register({
      approvalId: 'appr-err-listener-2',
      taskId: 'task-1',
      runId: 'run-1',
      resolver: vi.fn(),
    })
    expect(errorListener).toHaveBeenCalledTimes(1)
  })

  it('returns all records via getByTask and clears all via clearAll', () => {
    registry.register({
      approvalId: 'appr-all-1',
      taskId: 'task-Z',
      runId: 'run-1',
      resolver: vi.fn(),
    })
    registry.register({
      approvalId: 'appr-all-2',
      taskId: 'task-Z',
      runId: 'run-1',
      resolver: vi.fn(),
    })

    expect(registry.getByTask('task-Z').length).toBe(2)

    registry.clearAll()
    expect(registry.get('appr-all-1')).toBeUndefined()
    expect(registry.get('appr-all-2')).toBeUndefined()
    expect(registry.getByTask('task-Z').length).toBe(0)
  })

  it('deduplicates concurrent resolve calls returning the same in-flight promise', async () => {
    let resolveResolver: () => void = () => {}
    const resolver = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveResolver = resolve
        })
    )

    registry.register({
      approvalId: 'appr-concurrent',
      taskId: 'task-C',
      runId: 'run-1',
      resolver,
    })

    const p1 = registry.resolve('appr-concurrent', 'allow')
    const p2 = registry.resolve('appr-concurrent', 'allow')

    expect(p1).toBe(p2)
    resolveResolver()

    const [res1, res2] = await Promise.all([p1, p2])
    expect(res1).toBe(res2)
    expect(resolver).toHaveBeenCalledTimes(1)
    expect(res1.state).toBe('resolved')
  })

  it('rolls back to pending state and restores timeout when resolver throws', async () => {
    const resolver = vi.fn().mockRejectedValue(new Error('Network transport failed'))

    registry.register({
      approvalId: 'appr-fail',
      taskId: 'task-F',
      runId: 'run-1',
      timeoutMs: 10000,
      resolver,
    })

    await expect(registry.resolve('appr-fail', 'allow')).rejects.toThrow('Network transport failed')

    const record = registry.get('appr-fail')
    expect(record?.state).toBe('pending')
    expect(record?.timeoutTimer).toBeDefined()

    // Advance time to verify timeout was re-armed
    vi.advanceTimersByTime(10001)
    expect(record?.state).toBe('expired')
  })

  it('fencing check preserves expired/cleared state if task was cleared during resolution', async () => {
    let resolveResolver: () => void = () => {}
    const resolver = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveResolver = resolve
        })
    )

    registry.register({
      approvalId: 'appr-fence',
      taskId: 'task-Fence',
      runId: 'run-1',
      resolver,
    })

    const resolvePromise = registry.resolve('appr-fence', 'allow')

    // Task is cleared while resolver is in-flight
    registry.clearForTask('task-Fence')

    resolveResolver()
    await resolvePromise

    expect(registry.get('appr-fence')).toBeUndefined()
  })

  it('allows retry after synchronous resolver throw without permanently caching rejection', async () => {
    let callCount = 0
    const resolver = vi.fn().mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        throw new Error('Sync resolver boom')
      }
      return Promise.resolve()
    })

    registry.register({
      approvalId: 'appr-sync-fail',
      taskId: 'task-Sync',
      runId: 'run-1',
      resolver,
    })

    // First attempt fails synchronously
    await expect(registry.resolve('appr-sync-fail', 'allow')).rejects.toThrow('Sync resolver boom')

    // Second attempt should execute resolver again and succeed
    const retried = await registry.resolve('appr-sync-fail', 'allow')
    expect(retried.state).toBe('resolved')
    expect(callCount).toBe(2)
  })

  it('expires immediately when rollback occurs after expiration deadline has passed', async () => {
    let rejectResolver: (err: Error) => void = () => {}
    const resolver = vi.fn().mockImplementation((decision: string) => {
      if (decision === 'deny') {
        return Promise.resolve()
      }
      return new Promise<void>((_, reject) => {
        rejectResolver = reject
      })
    })

    const stateNotifications: string[] = []
    registry.onStateChanged((r) => {
      if (r.approvalId === 'appr-overdue-fail') {
        stateNotifications.push(r.state)
      }
    })

    registry.register({
      approvalId: 'appr-overdue-fail',
      taskId: 'task-Overdue',
      runId: 'run-1',
      timeoutMs: 5000,
      resolver,
    })

    const resolvePromise = registry.resolve('appr-overdue-fail', 'allow')

    // Advance time past the 5000ms deadline while resolver is in-flight
    vi.advanceTimersByTime(6000)

    // Now resolver fails after the deadline has already passed
    rejectResolver(new Error('Late network disconnect'))
    await expect(resolvePromise).rejects.toThrow('Late network disconnect')
    await Promise.resolve()

    const record = registry.get('appr-overdue-fail')
    expect(record?.state).toBe('expired')
    expect(record?.resolvedBy).toBe('timeout')
    expect(stateNotifications).toEqual(['pending', 'submitting', 'expired'])
  })

  it('fences timeout listener notification if task was cleared during timeout resolver', async () => {
    let finishTimeoutResolver: () => void = () => {}
    const resolver = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishTimeoutResolver = resolve
        })
    )

    const stateEvents: string[] = []
    registry.onStateChanged((r) => {
      if (r.approvalId === 'appr-timeout-fence') {
        stateEvents.push(r.state)
      }
    })

    registry.register({
      approvalId: 'appr-timeout-fence',
      taskId: 'task-TimeoutFence',
      runId: 'run-1',
      timeoutMs: 3000,
      resolver,
    })

    expect(stateEvents).toEqual(['pending'])

    // Advance time to trigger timeout
    vi.advanceTimersByTime(3001)

    // Clear task while timeout resolver is in-flight
    registry.clearForTask('task-TimeoutFence')

    finishTimeoutResolver()
    await Promise.resolve()

    // Since it was cleared, no further listener notification for this record should be emitted
    expect(stateEvents).toEqual(['pending'])
    expect(registry.get('appr-timeout-fence')).toBeUndefined()
  })

  it('invalidates in-flight resolution locks when cleared and avoids returning stale promise on ID reuse', async () => {
    let unblockOldResolver: () => void = () => {}
    const oldResolver = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          unblockOldResolver = resolve
        })
    )

    registry.register({
      approvalId: 'appr-reuse',
      taskId: 'task-Reuse',
      runId: 'run-1',
      resolver: oldResolver,
    })

    // Start resolution which is in-flight and hung
    const oldPromise = registry.resolve('appr-reuse', 'allow')

    // Task is cleared, invalidating record and in-flight lock
    registry.clearForTask('task-Reuse')

    // Register a new approval with the EXACT same approvalId
    const newResolver = vi.fn().mockResolvedValue(undefined)
    registry.register({
      approvalId: 'appr-reuse',
      taskId: 'task-Reuse',
      runId: 'run-2',
      resolver: newResolver,
    })

    // Resolving new approval must NOT return the old hanging promise, but invoke newResolver
    const newPromise = registry.resolve('appr-reuse', 'allow')
    expect(newPromise).not.toBe(oldPromise)

    await newPromise
    expect(newResolver).toHaveBeenCalledTimes(1)
    expect(registry.get('appr-reuse')?.state).toBe('resolved')

    // Finish old resolver to prevent unhandled rejection
    unblockOldResolver()
    await oldPromise.catch(() => {})
  })

  it('rejects resolution and transitions to expired if expiresAt deadline has already passed', async () => {
    const resolver = vi.fn().mockResolvedValue(undefined)

    const record = registry.register({
      approvalId: 'appr-overdue-resolve',
      taskId: 'task-OverdueTest',
      runId: 'run-1',
      timeoutMs: 5000,
      resolver,
    })

    // Simulate clock moving past the deadline before the timer callback runs
    record.expiresAt = Date.now() - 10

    await expect(registry.resolve('appr-overdue-resolve', 'allow')).rejects.toThrow(
      /already expired \(timeout deadline passed\)/i
    )

    expect(registry.get('appr-overdue-resolve')?.state).toBe('expired')
    expect(registry.get('appr-overdue-resolve')?.resolvedBy).toBe('timeout')
    expect(resolver).toHaveBeenCalledWith('deny', expect.stringContaining('timed out'))
  })
})

