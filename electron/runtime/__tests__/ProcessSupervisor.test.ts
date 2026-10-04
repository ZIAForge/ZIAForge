import { describe, it, expect, vi } from 'vitest'
import {
  ProcessSupervisor,
  getDescendants,
  findMatchingDescendantPids,
  isPidAllowed,
  validateCwd,
  normalizeCommandLine,
  parseUnixProcessLine,
  checkProcessIdentity,
  type ProcessItem
} from '../ProcessSupervisor'

describe('ProcessSupervisor TDD Tests', () => {
  it('retains descendant birth identity when the root exits after a signal-free snapshot', async () => {
    let table: ProcessItem[] = [
      { pid: 8100, ppid: 1, command: 'fixture-root', generation: 'root-birth' },
      { pid: 8101, ppid: 8100, command: 'fixture-child', generation: 'child-birth' },
      { pid: 8200, ppid: 1, command: 'unrelated', generation: 'other-birth' },
    ]
    const signals: Array<{ pid: number; signal: NodeJS.Signals | 0 }> = []
    const supervisor = new ProcessSupervisor({
      getProcessListFn: () => table,
      killFn: (pid, signal) => {
        if (!table.some(item => item.pid === pid)) throw Object.assign(new Error('gone'), { code: 'ESRCH' })
        if (signal !== 0) { signals.push({ pid, signal }); table = table.filter(item => item.pid !== pid) }
      },
    })
    supervisor.trackProcessTree(8100)
    expect(signals).toEqual([])
    table = table.filter(item => item.pid !== 8100).map(item => ({ ...item, ppid: 1 }))
    expect(await supervisor.terminateProcessTree(8100, { timeoutMs: 50 })).toBe(true)
    expect(signals).toEqual([{ pid: 8101, signal: 'SIGTERM' }])
    expect(table.map(item => item.pid)).toEqual([8200])
  })

  const mockProcessList = [
    { pid: 1000, ppid: 1, command: '/bin/zsh', generation: 'gen-1000' },
    { pid: 1001, ppid: 1000, command: 'node /path/to/cli.js --stream', generation: 'gen-1001' },
    { pid: 1002, ppid: 1001, command: 'npm test -- --watch', generation: 'gen-1002' },
    { pid: 2000, ppid: 1, command: 'python3 /other/system/app.py', generation: 'gen-2000' },
    { pid: 2001, ppid: 2000, command: 'node /other/system/server.js', generation: 'gen-2001' },
  ]

  it('correctly extracts descendants of a specific shell PID', () => {
    const descendants = getDescendants(1000, mockProcessList)
    const pids = descendants.map(d => d.pid)
    expect(pids).toContain(1001)
    expect(pids).toContain(1002)
    expect(pids).not.toContain(2000)
    expect(pids).not.toContain(2001)
  })

  it('rejects killing a PID that does not belong to any active ZIAForge session', () => {
    const allowedPids = new Set([1000, 1001, 1002])
    expect(isPidAllowed(1001, allowedPids)).toBe(true)
    expect(isPidAllowed(2000, allowedPids)).toBe(false)
    expect(isPidAllowed(1, allowedPids)).toBe(false)
    expect(isPidAllowed(-5, allowedPids)).toBe(false)
  })

  it('finds matching PIDs strictly among session descendants and ignores external system processes', () => {
    const ptySessions = new Map<string, { pid: number }>([
      ['session-1', { pid: 1000 }]
    ])

    // Searching for 'node': should match pid 1001 (descendant of 1000) but NOT pid 2001 (external)
    const matching = findMatchingDescendantPids('node', ptySessions, mockProcessList)
    expect(matching).toEqual([1001])
    expect(matching).not.toContain(2001)
  })

  it('never targets root PTY shell PID when matching command pattern', () => {
    const ptySessions = new Map<string, { pid: number }>([
      ['session-1', { pid: 1000 }]
    ])

    // Even if user searches for 'zsh', it must NOT match root shell pid 1000
    const matching = findMatchingDescendantPids('zsh', ptySessions, mockProcessList)
    expect(matching).not.toContain(1000)
  })

  it('strictly scopes command killing to targetSessionId when provided', () => {
    const twoSessions = new Map<string, { pid: number }>([
      ['session-A', { pid: 1000 }],
      ['session-B', { pid: 3000 }]
    ])

    const multiSessionProcessList = [
      ...mockProcessList,
      { pid: 3000, ppid: 1, command: '/bin/zsh', generation: 'gen-3000' },
      { pid: 3001, ppid: 3000, command: 'node /path/to/cli.js --stream', generation: 'gen-3001' }
    ]

    // Target session-A only: must match pid 1001 but NOT pid 3001 from session-B
    const scopedMatch = findMatchingDescendantPids('node', twoSessions, multiSessionProcessList, 'session-A')
    expect(scopedMatch).toEqual([1001])
    expect(scopedMatch).not.toContain(3001)
  })

  it('validates cwd and forbids fallback to $HOME when target directory does not exist', () => {
    const valid = validateCwd(process.cwd())
    expect(valid.valid).toBe(true)
    expect(valid.resolvedCwd).toBe(process.cwd())

    const invalid = validateCwd('/non/existent/path/to/worktree/xyz123')
    expect(invalid.valid).toBe(false)
    expect(invalid.resolvedCwd).toBeUndefined()
    expect(invalid.error).toContain('does not exist')

    const empty = validateCwd('')
    expect(empty.valid).toBe(false)
    expect(empty.error).toContain('Working directory is required')
  })

  it('normalizes command lines consistently', () => {
    expect(normalizeCommandLine('  Node   /path/to/CLI.js   ')).toBe('node cli.js')
    expect(normalizeCommandLine('● bash(npm test (ctrl+o to expand))')).toBe('npm test')
  })

  describe('ProcessSupervisor class implementation', () => {
    it('isProcessAlive treats ESRCH as absence and EPERM as presence', () => {
      const alivePids = new Set([1000])
      const killFn = vi.fn((pid: number) => {
        if (pid === 2000) {
          const err = new Error('No such process') as NodeJS.ErrnoException
          err.code = 'ESRCH'
          throw err
        }
        if (pid === 3000) {
          const err = new Error('Operation not permitted') as NodeJS.ErrnoException
          err.code = 'EPERM'
          throw err
        }
        if (!alivePids.has(pid)) {
          const err = new Error('No such process') as NodeJS.ErrnoException
          err.code = 'ESRCH'
          throw err
        }
      })

      const supervisor = new ProcessSupervisor({ killFn })

      // Valid alive pid
      expect(supervisor.isProcessAlive(1000)).toBe(true)

      // ESRCH -> confirmed absent
      expect(supervisor.isProcessAlive(2000)).toBe(false)

      // EPERM -> confirmed present
      expect(supervisor.isProcessAlive(3000)).toBe(true)

      // Invalid pid <= 100
      expect(supervisor.isProcessAlive(0)).toBe(false)
      expect(supervisor.isProcessAlive(50)).toBe(false)
    })

    it('terminateProcessTree tracks entire descendant tree when root exits while child survives and requires escalation', async () => {
      // Process tree: Root 1000 -> Child 1001
      const alivePids = new Set([1000, 1001])
      const signaledWith: Array<{ pid: number; signal: NodeJS.Signals | 0 }> = []

      const killFn = vi.fn((pid: number, signal: NodeJS.Signals | 0) => {
        signaledWith.push({ pid, signal })
        if (signal === 0) {
          if (!alivePids.has(pid)) {
            const err = new Error('ESRCH') as NodeJS.ErrnoException
            err.code = 'ESRCH'
            throw err
          }
          return
        }

        // On SIGTERM, root 1000 exits, but child 1001 survives
        if (signal === 'SIGTERM') {
          if (pid === 1000) {
            alivePids.delete(1000)
          }
          // pid 1001 ignores SIGTERM!
        }

        // On SIGKILL, child 1001 exits
        if (signal === 'SIGKILL') {
          alivePids.delete(pid)
        }
      })

      const getProcessListFn = () => [
        { pid: 1000, ppid: 1, command: 'app', generation: 'gen-1000' },
        { pid: 1001, ppid: 1000, command: 'worker', generation: 'gen-1001' },
      ]

      const supervisor = new ProcessSupervisor({ killFn, getProcessListFn })

      // Run termination with short timeout for test speed
      const result = await supervisor.terminateProcessTree(1000, { timeoutMs: 100 })

      expect(result).toBe(true)
      expect(alivePids.size).toBe(0)

      // Root received SIGTERM
      expect(signaledWith.some((s) => s.pid === 1000 && s.signal === 'SIGTERM')).toBe(true)
      // Child received SIGTERM initially
      expect(signaledWith.some((s) => s.pid === 1001 && s.signal === 'SIGTERM')).toBe(true)
      // Child was escalated to SIGKILL because it survived root exit!
      expect(signaledWith.some((s) => s.pid === 1001 && s.signal === 'SIGKILL')).toBe(true)
    })

    it('terminateProcessTree returns false if surviving child cannot be terminated even after escalation', async () => {
      // Unkillable child 1002
      const alivePids = new Set([1000, 1002])

      const killFn = vi.fn((pid: number, signal: NodeJS.Signals | 0) => {
        if (signal === 0) {
          if (!alivePids.has(pid)) {
            const err = new Error('ESRCH') as NodeJS.ErrnoException
            err.code = 'ESRCH'
            throw err
          }
          return
        }

        if (signal === 'SIGTERM' && pid === 1000) {
          alivePids.delete(1000)
        }
        // pid 1002 ignores both SIGTERM and SIGKILL (e.g. unkillable D-state)
      })

      const getProcessListFn = () => [
        { pid: 1000, ppid: 1, command: 'app', generation: 'gen-1000' },
        { pid: 1002, ppid: 1000, command: 'zombie-worker', generation: 'gen-1002' },
      ]

      const supervisor = new ProcessSupervisor({ killFn, getProcessListFn })
      const result = await supervisor.terminateProcessTree(1000, { timeoutMs: 60 })

      expect(result).toBe(false)
      expect(alivePids.has(1002)).toBe(true)
    })

    it('persists ownership across retries when child is reparented to init (ppid 1) after root exit', async () => {
      // Dynamic process state:
      // Root: 1000, Child: 1001
      const alivePids = new Set([1000, 1001])
      let childCooperates = false

      const killFn = vi.fn((pid: number, signal: NodeJS.Signals | 0) => {
        if (signal === 0) {
          if (!alivePids.has(pid)) {
            const err = new Error('ESRCH') as NodeJS.ErrnoException
            err.code = 'ESRCH'
            throw err
          }
          return
        }

        if (signal === 'SIGTERM') {
          if (pid === 1000) {
            alivePids.delete(1000) // Root exits on SIGTERM
          }
          // Child 1001 ignores SIGTERM
        }

        if (signal === 'SIGKILL') {
          if (pid === 1001 && childCooperates) {
            alivePids.delete(1001) // Child exits on SIGKILL only when cooperating
          }
        }
      })

      // Dynamic process list: when root 1000 exits, child 1001's ppid changes to 1 (reparented)
      const getProcessListFn = () => {
        const list = []
        if (alivePids.has(1000)) {
          list.push({ pid: 1000, ppid: 1, command: 'root-process', generation: 'gen-1000' })
          list.push({ pid: 1001, ppid: 1000, command: 'child-process', generation: 'gen-1001' })
        } else if (alivePids.has(1001)) {
          // Reparented to init (PID 1)
          list.push({ pid: 1001, ppid: 1, command: 'child-process', generation: 'gen-1001' })
        }
        return list
      }

      const supervisor = new ProcessSupervisor({ killFn, getProcessListFn })

      // Attempt 1: Root exits, but child refuses to exit.
      const attempt1 = await supervisor.terminateProcessTree(1000, { timeoutMs: 50 })
      expect(attempt1).toBe(false)
      expect(supervisor.isProcessAlive(1000)).toBe(false)
      expect(supervisor.isProcessAlive(1001)).toBe(true)
      // Ownership must be retained
      expect(supervisor.getOwnedPids(1000)).toContain(1001)

      // Notice: in the OS process list, child 1001's ppid is now 1, so getDescendants(1000) returns []!
      expect(supervisor.getDescendants(1000)).toEqual([])

      // Attempt 2: Child still refuses. Retrying must NOT report success just because root is dead!
      const attempt2 = await supervisor.terminateProcessTree(1000, { timeoutMs: 50 })
      expect(attempt2).toBe(false)
      expect(supervisor.isProcessAlive(1001)).toBe(true)
      expect(supervisor.getOwnedPids(1000)).toContain(1001)

      // Attempt 3: Child now cooperates and exits on SIGKILL.
      childCooperates = true
      const attempt3 = await supervisor.terminateProcessTree(1000, { timeoutMs: 50 })
      expect(attempt3).toBe(true)
      expect(supervisor.isProcessAlive(1001)).toBe(false)
      // Ownership cleared once all processes confirmed dead
      expect(supervisor.getOwnedPids(1000)).toHaveLength(0)
    })

    it('never signals unrelated processes if root PID is reused after confirmed exit', async () => {
      // Step 1: Initial tree: Root 1000 -> Child 1001
      const alivePids = new Set([1000, 1001])
      const signalsSent: Array<{ pid: number; signal: NodeJS.Signals | 0 }> = []

      const killFn = vi.fn((pid: number, signal: NodeJS.Signals | 0) => {
        signalsSent.push({ pid, signal })
        if (signal === 0) {
          if (!alivePids.has(pid)) {
            const err = new Error('ESRCH') as NodeJS.ErrnoException
            err.code = 'ESRCH'
            throw err
          }
          return
        }

        if (signal === 'SIGTERM') {
          if (pid === 1000) {
            alivePids.delete(1000) // Original root exits
          }
          // Child 1001 ignores SIGTERM and SIGKILL during attempt 1
        }
      })

      let processList = [
        { pid: 1000, ppid: 1, command: 'original-root', generation: 'gen-root-1' },
        { pid: 1001, ppid: 1000, command: 'original-child', generation: 'gen-child-1' },
      ]

      const getProcessListFn = () => processList
      const supervisor = new ProcessSupervisor({ killFn, getProcessListFn })

      // Attempt 1 fails: original root 1000 exits, child 1001 survives
      const attempt1 = await supervisor.terminateProcessTree(1000, { timeoutMs: 50 })
      expect(attempt1).toBe(false)
      expect(supervisor.isProcessAlive(1001)).toBe(true)

      // Step 2: PID 1000 is reused by OS for an UNRELATED process, which has a child 2000!
      alivePids.add(1000) // Reused PID 1000 is now alive for unrelated process
      alivePids.add(2000) // Unrelated child

      processList = [
        { pid: 1000, ppid: 1, command: 'unrelated-system-service', generation: 'gen-root-2' },
        { pid: 2000, ppid: 1000, command: 'unrelated-worker', generation: 'gen-worker-2' },
        { pid: 1001, ppid: 1, command: 'original-child', generation: 'gen-child-1' },
      ]

      // Clear signal history before retry
      signalsSent.length = 0

      // Step 3: Retry termination for original task using original rootPid 1000
      const attempt2 = await supervisor.terminateProcessTree(1000, { timeoutMs: 50 })
      expect(attempt2).toBe(false) // Child 1001 still alive

      // CRITICAL ASSERTION: The reused PID 1000 and its child 2000 must NEVER have received ANY signal!
      const signaledPids = signalsSent.map((s) => s.pid)
      expect(signaledPids).not.toContain(1000)
      expect(signaledPids).not.toContain(2000)

      // Only the original child 1001 should have been signaled
      expect(signaledPids).toContain(1001)
    })

    it('never signals replacement process or its descendants when active child PID is reused without observed ESRCH', async () => {
      // Step 1: Initial tree: Root 1000 -> Child 1001
      const alivePids = new Set([1000, 1001])
      const signalsSent: Array<{ pid: number; signal: NodeJS.Signals | 0 }> = []

      const killFn = vi.fn((pid: number, signal: NodeJS.Signals | 0) => {
        signalsSent.push({ pid, signal })
        if (signal === 0) {
          if (!alivePids.has(pid)) {
            const err = new Error('ESRCH') as NodeJS.ErrnoException
            err.code = 'ESRCH'
            throw err
          }
          return
        }

        if (signal === 'SIGTERM') {
          if (pid === 1000) {
            alivePids.delete(1000) // Root exits
          }
          // Child 1001 ignores SIGTERM during attempt 1
        }
      })

      let processList = [
        { pid: 1000, ppid: 1, command: 'original-root', generation: 'gen-root-1' },
        { pid: 1001, ppid: 1000, command: 'original-child-agent', generation: 'gen-child-1' },
      ]

      const getProcessListFn = () => processList
      const supervisor = new ProcessSupervisor({ killFn, getProcessListFn })

      // Attempt 1: Root 1000 exits, child 1001 refuses and survives.
      const attempt1 = await supervisor.terminateProcessTree(1000, { timeoutMs: 50 })
      expect(attempt1).toBe(false)
      expect(supervisor.isProcessAlive(1000)).toBe(false)
      expect(supervisor.isProcessAlive(1001)).toBe(true)

      // Step 2: Between retries, child PID 1001 was replaced by an unrelated process with child 3000
      // WITHOUT any observed ESRCH (alivePids STILL contains 1001!).
      alivePids.add(3000) // Child of replacement

      processList = [
        // Notice: root 1000 is gone, but PID 1001 now belongs to 'unrelated-server' and spawned child 3000!
        { pid: 1001, ppid: 1, command: 'unrelated-server', generation: 'gen-child-2' },
        { pid: 3000, ppid: 1001, command: 'unrelated-worker', generation: 'gen-worker-3' },
      ]

      // Clear signal history before retry
      signalsSent.length = 0

      // Step 3: Retry termination for original task
      const attempt2 = await supervisor.terminateProcessTree(1000, { timeoutMs: 50 })
      // Since original child is gone (mismatched identity), ownership is retired and reports clean
      expect(attempt2).toBe(true)

      // CRITICAL ACCEPTANCE CRITERIA:
      // Neither the replacement process 1001 nor its child 3000 may receive ANY termination signal!
      const signaledPids = signalsSent.filter((s) => s.signal !== 0).map((s) => s.pid)
      expect(signaledPids).not.toContain(1001)
      expect(signaledPids).not.toContain(3000)
      expect(signaledPids).toHaveLength(0)
    })

    it('never signals replacement process with identical command line but different generation', async () => {
      // Step 1: Root 1000 -> Child 1001, child runs 'node worker.js' with gen-1
      const alivePids = new Set([1000, 1001])
      const signalsSent: Array<{ pid: number; signal: NodeJS.Signals | 0 }> = []

      const killFn = vi.fn((pid: number, signal: NodeJS.Signals | 0) => {
        signalsSent.push({ pid, signal })
        if (signal === 0) {
          if (!alivePids.has(pid)) {
            const err = new Error('ESRCH') as NodeJS.ErrnoException
            err.code = 'ESRCH'
            throw err
          }
          return
        }
        if (signal === 'SIGTERM') {
          if (pid === 1000) alivePids.delete(1000) // Root exits
          // Child 1001 survives attempt 1
        }
      })

      let processList = [
        { pid: 1000, ppid: 1, command: 'node main.js', generation: 'gen-root' },
        { pid: 1001, ppid: 1000, command: 'node worker.js', generation: 'gen-worker-v1' },
      ]

      const supervisor = new ProcessSupervisor({ killFn, getProcessListFn: () => processList })

      // Attempt 1: Root exits, child survives
      const attempt1 = await supervisor.terminateProcessTree(1000, { timeoutMs: 50 })
      expect(attempt1).toBe(false)
      expect(supervisor.isProcessAlive(1001)).toBe(true)

      // Step 2: Child 1001 is replaced by a NEW process that has the EXACT SAME command 'node worker.js'
      // but a DIFFERENT OS birth marker / generation 'gen-worker-v2', and spawns child 3000 ('node worker.js')
      alivePids.add(3000)
      processList = [
        { pid: 1001, ppid: 1, command: 'node worker.js', generation: 'gen-worker-v2' },
        { pid: 3000, ppid: 1001, command: 'node worker.js', generation: 'gen-worker-v3' },
      ]
      signalsSent.length = 0

      // Step 3: Attempt 2
      const attempt2 = await supervisor.terminateProcessTree(1000, { timeoutMs: 50 })
      expect(attempt2).toBe(true)

      // CRITICAL: No termination signals must be sent to replacement 1001 or child 3000 despite same command!
      const nonZeroSignals = signalsSent.filter((s) => s.signal !== 0).map((s) => s.pid)
      expect(nonZeroSignals).not.toContain(1001)
      expect(nonZeroSignals).not.toContain(3000)
      expect(nonZeroSignals).toHaveLength(0)
    })

    it('handles process-table outage without erroneously reporting success or terminating untracked processes', async () => {
      // Root 1000, Child 1001. Child survives until cooperating.
      const alivePids = new Set([1000, 1001])
      const signalsSent: Array<{ pid: number; signal: NodeJS.Signals | 0 }> = []
      let childCooperates = false

      const killFn = vi.fn((pid: number, signal: NodeJS.Signals | 0) => {
        signalsSent.push({ pid, signal })
        if (signal === 0) {
          if (!alivePids.has(pid)) {
            const err = new Error('ESRCH') as NodeJS.ErrnoException
            err.code = 'ESRCH'
            throw err
          }
          return
        }
        if (signal === 'SIGTERM' && pid === 1000) {
          alivePids.delete(1000) // Root exits on SIGTERM
        }
        if (signal === 'SIGKILL' && pid === 1001 && childCooperates) {
          alivePids.delete(1001) // Child exits on SIGKILL only when cooperating
        }
      })

      let tableOutage = false
      const getProcessListFn = () => {
        if (tableOutage) {
          // Process table query fails or returns empty array
          return []
        }
        const list = []
        if (alivePids.has(1000)) {
          list.push({ pid: 1000, ppid: 1, command: 'root-proc', generation: 'gen-1000' })
          list.push({ pid: 1001, ppid: 1000, command: 'child-proc', generation: 'gen-1001' })
        } else if (alivePids.has(1001)) {
          list.push({ pid: 1001, ppid: 1, command: 'child-proc', generation: 'gen-1001' })
        }
        return list
      }

      const supervisor = new ProcessSupervisor({ killFn, getProcessListFn })

      // Step 1: Initial attempt - root exits, child 1001 survives and is tracked.
      const attempt1 = await supervisor.terminateProcessTree(1000, { timeoutMs: 50 })
      expect(attempt1).toBe(false)
      expect(supervisor.getOwnedPids(1000)).toContain(1001)
      expect(supervisor.isProcessAlive(1001)).toBe(true)

      // Step 2: Simulate process table outage during attempt 2 while child 1001 is still alive
      tableOutage = true
      const attempt2 = await supervisor.terminateProcessTree(1000, { timeoutMs: 50 })
      // MUST NOT return true (must not report false success!)
      expect(attempt2).toBe(false)
      // MUST retain ownership of child 1001 and not retire it
      expect(supervisor.getOwnedPids(1000)).toContain(1001)
      expect(supervisor.isProcessAlive(1001)).toBe(true)

      // Step 3: Now process table recovers and child cooperates
      tableOutage = false
      childCooperates = true
      const attempt3 = await supervisor.terminateProcessTree(1000, { timeoutMs: 100 })
      // With table recovered, child 1001 is verified, escalated to SIGKILL, and terminated
      expect(attempt3).toBe(true)
      expect(supervisor.isProcessAlive(1001)).toBe(false)
      expect(supervisor.getOwnedPids(1000)).toHaveLength(0)
    })

    it('verifies identity freshly immediately before escalation and never sends SIGKILL to new generation', async () => {
      // Root 1000 -> Child 1001
      const alivePids = new Set([1000, 1001])
      const signalsSent: Array<{ pid: number; signal: NodeJS.Signals | 0 }> = []

      const killFn = vi.fn((pid: number, signal: NodeJS.Signals | 0) => {
        signalsSent.push({ pid, signal })
        if (signal === 0) {
          if (!alivePids.has(pid)) {
            const err = new Error('ESRCH') as NodeJS.ErrnoException
            err.code = 'ESRCH'
            throw err
          }
          return
        }

        if (signal === 'SIGTERM') {
          if (pid === 1000) alivePids.delete(1000)
          // Root exits on SIGTERM, child 1001 survives SIGTERM throughout the entire polling loop
        }
      })

      let simulatedNow = 1000
      let pollingTicks = 0
      let preEscalationVisited = false
      const timeoutMs = 50

      const dateSpy = vi.spyOn(Date, 'now').mockImplementation(() => simulatedNow)

      // Drive time strictly during the polling loop via setTimeout:
      const realSetTimeout = globalThis.setTimeout
      const timeoutSpy = vi.spyOn(globalThis, 'setTimeout').mockImplementation((cb: Parameters<typeof setTimeout>[0]) => {
        pollingTicks++
        simulatedNow += 25
        return realSetTimeout(cb, 1)
      })

      try {
        const getProcessListFn = () => {
          // If time has advanced beyond the polling timeout, we are at or past the escalation boundary
          if (simulatedNow >= 1000 + timeoutMs) {
            preEscalationVisited = true
          }

          const generation = preEscalationVisited ? 'gen-replaced' : 'gen-initial'

          const list = []
          if (alivePids.has(1000)) {
            list.push({ pid: 1000, ppid: 1, command: 'root', generation: 'gen-root' })
            list.push({ pid: 1001, ppid: 1000, command: 'worker', generation })
          } else {
            list.push({ pid: 1001, ppid: 1000, command: 'worker', generation })
          }
          return list
        }

        const supervisor = new ProcessSupervisor({ killFn, getProcessListFn })
        const result = await supervisor.terminateProcessTree(1000, { timeoutMs })

        // Assert that the polling loop was actually entered and executed
        expect(pollingTicks).toBeGreaterThanOrEqual(2)

        // Assert that preEscalation was reached and visited
        expect(preEscalationVisited).toBe(true)

        // Original process was replaced, so ownership retired
        expect(result).toBe(true)

        // CRITICAL: SIGTERM was sent to child 1001 initially
        const sigtermTargets = signalsSent.filter((s) => s.signal === 'SIGTERM').map((s) => s.pid)
        expect(sigtermTargets).toContain(1001)

        // CRITICAL: SIGKILL must NEVER have been sent to PID 1001 because its generation changed before escalation!
        const sigkillTargets = signalsSent.filter((s) => s.signal === 'SIGKILL').map((s) => s.pid)
        expect(sigkillTargets).not.toContain(1001)
        expect(sigkillTargets).toHaveLength(0)
      } finally {
        dateSpy.mockRestore()
        timeoutSpy.mockRestore()
      }
    })

    it('signals newly discovered child appearing in dispatch snapshot with force: true', async () => {
      // Root 1000 is running initially
      const alivePids = new Set([1000, 1001])
      const signalsSent: Array<{ pid: number; signal: NodeJS.Signals | 0 }> = []

      const killFn = vi.fn((pid: number, signal: NodeJS.Signals | 0) => {
        signalsSent.push({ pid, signal })
        if (signal === 0) {
          if (!alivePids.has(pid)) {
            const err = new Error('ESRCH') as NodeJS.ErrnoException
            err.code = 'ESRCH'
            throw err
          }
          return
        }
        if (signal === 'SIGKILL') {
          alivePids.delete(pid)
        }
      })

      // Snapshot 1: initial tree snapshot (root only)
      // Snapshot 2: initialCheck in terminateProcessTree (root only)
      // Snapshot 3: dispatchSignal snapshot — child 1001 appears for the first time!
      let snapshotCount = 0
      const getProcessListFn = () => {
        snapshotCount++
        if (snapshotCount <= 2) {
          return [{ pid: 1000, ppid: 1, command: 'root', generation: 'gen-root' }]
        }
        return [
          { pid: 1000, ppid: 1, command: 'root', generation: 'gen-root' },
          { pid: 1001, ppid: 1000, command: 'child', generation: 'gen-child' },
        ]
      }

      const supervisor = new ProcessSupervisor({ killFn, getProcessListFn })
      const result = await supervisor.terminateProcessTree(1000, { force: true, timeoutMs: 50 })

      expect(result).toBe(true)
      expect(alivePids.size).toBe(0)
      const killedPids = signalsSent.filter((s) => s.signal === 'SIGKILL').map((s) => s.pid)
      expect(killedPids).toContain(1001)
      expect(killedPids).toContain(1000)
    })

    it('discovers and signals child appearing in per-target verification (snapshot 4) before signaling parent', async () => {
      // Root 1000 is running initially.
      // Child 1001 appears ONLY on snapshot 4 (inside verifyAndSignalTarget for root 1000).
      const alivePids = new Set([1000, 1001])
      const signalsSent: Array<{ pid: number; signal: NodeJS.Signals | 0 }> = []

      const killFn = vi.fn((pid: number, signal: NodeJS.Signals | 0) => {
        signalsSent.push({ pid, signal })
        if (signal === 0) {
          if (!alivePids.has(pid)) {
            const err = new Error('ESRCH') as NodeJS.ErrnoException
            err.code = 'ESRCH'
            throw err
          }
          return
        }
        if (signal === 'SIGKILL') {
          alivePids.delete(pid)
        }
      })

      // Snapshot 1: initial tree snapshot (root only)
      // Snapshot 2: initialCheck in terminateProcessTree (root only)
      // Snapshot 3: dispatchSignal inspectAndDiscover snapshot (root only)
      // Snapshot 4: verifyAndSignalTarget(1000) snapshot — child 1001 appears for the first time!
      let snapshotCount = 0
      const getProcessListFn = () => {
        snapshotCount++
        if (snapshotCount <= 3) {
          return [{ pid: 1000, ppid: 1, command: 'root', generation: 'gen-root' }]
        }
        return [
          { pid: 1000, ppid: 1, command: 'root', generation: 'gen-root' },
          { pid: 1001, ppid: 1000, command: 'child', generation: 'gen-child-1001' },
        ]
      }

      const supervisor = new ProcessSupervisor({ killFn, getProcessListFn })
      const result = await supervisor.terminateProcessTree(1000, { force: true, timeoutMs: 50 })

      expect(result).toBe(true)
      expect(alivePids.size).toBe(0)

      const killedPids = signalsSent.filter((s) => s.signal === 'SIGKILL').map((s) => s.pid)
      // Child 1001 must have been discovered and signaled with SIGKILL
      expect(killedPids).toContain(1001)
      expect(killedPids).toContain(1000)

      // Verify child 1001 was signaled BEFORE root 1000
      const childKillIdx = signalsSent.findIndex((s) => s.pid === 1001 && s.signal === 'SIGKILL')
      const rootKillIdx = signalsSent.findIndex((s) => s.pid === 1000 && s.signal === 'SIGKILL')
      expect(childKillIdx).toBeLessThan(rootKillIdx)
    })

    it('does not send signal to parent if parent is replaced during recursive child dispatch', async () => {
      // Root 1000 is running initially.
      // Child 1001 appears in snapshot 4.
      // When child 1001 is signaled, root 1000 is replaced by a new process (generation changes from 'gen-root-1' to 'gen-root-2').
      const alivePids = new Set([1000, 1001])
      const signalsSent: Array<{ pid: number; signal: NodeJS.Signals | 0 }> = []

      let rootGeneration = 'gen-root-1'

      const killFn = vi.fn((pid: number, signal: NodeJS.Signals | 0) => {
        signalsSent.push({ pid, signal })
        if (signal === 0) {
          if (!alivePids.has(pid)) {
            const err = new Error('ESRCH') as NodeJS.ErrnoException
            err.code = 'ESRCH'
            throw err
          }
          return
        }

        if (signal === 'SIGKILL') {
          if (pid === 1001) {
            alivePids.delete(1001)
            // Simulating root being replaced concurrently while child is signaled!
            rootGeneration = 'gen-root-2'
          }
        }
      })

      // Snapshot 1: initial tree snapshot (root 1000 only)
      // Snapshot 2: initialCheck (root 1000 only)
      // Snapshot 3: dispatchSignal inspectAndDiscover (root 1000 only)
      // Snapshot 4: verifyAndSignalTarget(1000) discovery snapshot — child 1001 appears!
      // Snapshot 5: verifyAndSignalTarget(1001) discovery snapshot — no children
      // Snapshot 6: verifyAndSignalTarget(1001) fresh check -> kill child 1001 -> root generation changes!
      // Snapshot 7: verifyAndSignalTarget(1000) fresh check after child dispatch -> root generation is now gen-root-2!
      let snapshotCount = 0
      const getProcessListFn = () => {
        snapshotCount++
        if (snapshotCount <= 3) {
          return [{ pid: 1000, ppid: 1, command: 'root', generation: rootGeneration }]
        }
        const list = []
        if (alivePids.has(1000)) {
          list.push({ pid: 1000, ppid: 1, command: 'root', generation: rootGeneration })
        }
        if (alivePids.has(1001)) {
          list.push({ pid: 1001, ppid: 1000, command: 'child', generation: 'gen-child-1001' })
        }
        return list
      }

      const supervisor = new ProcessSupervisor({ killFn, getProcessListFn })
      const result = await supervisor.terminateProcessTree(1000, { force: true, timeoutMs: 50 })

      // Original root was replaced and child was killed, ownership retired cleanly
      expect(result).toBe(true)

      // Child 1001 received SIGKILL
      const sigkillPids = signalsSent.filter((s) => s.signal === 'SIGKILL').map((s) => s.pid)
      expect(sigkillPids).toContain(1001)

      // CRITICAL: Root 1000 must NEVER have received SIGKILL because it was replaced during child dispatch!
      expect(sigkillPids).not.toContain(1000)
    })

    it('does not adopt or signal descendants if parent was replaced before discovery', async () => {
      // Root 1000 is running initially with generation 'gen-root-1'
      // Snapshot 4: root 1000 has been replaced by an unrelated process with generation 'gen-root-2',
      // which has spawned an unrelated child 2001 (ppid 1000).
      const alivePids = new Set([1000, 2001])
      const signalsSent: Array<{ pid: number; signal: NodeJS.Signals | 0 }> = []

      const killFn = vi.fn((pid: number, signal: NodeJS.Signals | 0) => {
        signalsSent.push({ pid, signal })
        if (signal === 0) {
          if (!alivePids.has(pid)) {
            const err = new Error('ESRCH') as NodeJS.ErrnoException
            err.code = 'ESRCH'
            throw err
          }
          return
        }
      })

      let snapshotCount = 0
      const getProcessListFn = () => {
        snapshotCount++
        if (snapshotCount <= 3) {
          return [{ pid: 1000, ppid: 1, command: 'root', generation: 'gen-root-1' }]
        }
        // Snapshot 4+: root 1000 is replaced, and has spawned child 2001
        return [
          { pid: 1000, ppid: 1, command: 'unrelated-root', generation: 'gen-root-2' },
          { pid: 2001, ppid: 1000, command: 'unrelated-child', generation: 'gen-child-2001' },
        ]
      }

      const supervisor = new ProcessSupervisor({ killFn, getProcessListFn })
      const result = await supervisor.terminateProcessTree(1000, { force: true, timeoutMs: 50 })

      // Original process was replaced, ownership retired safely
      expect(result).toBe(true)

      // CRITICAL: Unrelated child 2001 must NEVER have been signaled!
      expect(signalsSent.some((s) => s.pid === 2001)).toBe(false)

      // CRITICAL: Replaced root 1000 must NEVER have received SIGKILL!
      expect(signalsSent.some((s) => s.pid === 1000 && s.signal === 'SIGKILL')).toBe(false)
    })

    it('does not adopt or signal descendants of a replacement root even after the replacement root exits', async () => {
      // 1. Root 1000 is running initially with generation 'gen-root-1'
      // 2. Snapshot 4: root 1000 is replaced by an unrelated process with generation 'gen-root-2'
      //    which has spawned an unrelated child 2001 (ppid 1000). Root 1000 is retired (REPLACED).
      // 3. Snapshot 5: replacement root 1000 has exited (absent from table), but unrelated child 2001 is still alive.
      // 4. Supervisor must NOT adopt child 2001 in snapshot 5, and must NEVER send signals to child 2001.
      const alivePids = new Set([1000, 2001])
      const signalsSent: Array<{ pid: number; signal: NodeJS.Signals | 0 }> = []

      const killFn = vi.fn((pid: number, signal: NodeJS.Signals | 0) => {
        signalsSent.push({ pid, signal })
        if (signal === 0) {
          if (!alivePids.has(pid)) {
            const err = new Error('ESRCH') as NodeJS.ErrnoException
            err.code = 'ESRCH'
            throw err
          }
          return
        }
      })

      let snapshotCount = 0
      const getProcessListFn = () => {
        snapshotCount++
        if (snapshotCount <= 3) {
          return [{ pid: 1000, ppid: 1, command: 'root', generation: 'gen-root-1' }]
        }
        if (snapshotCount === 4) {
          // Snapshot 4: Root 1000 is replaced by gen-root-2 and spawns child 2001
          return [
            { pid: 1000, ppid: 1, command: 'unrelated-root', generation: 'gen-root-2' },
            { pid: 2001, ppid: 1000, command: 'unrelated-child', generation: 'gen-child-2001' },
          ]
        }
        // Snapshot 5+: Replacement root 1000 has exited! Unrelated child 2001 still sitting in table
        alivePids.delete(1000)
        return [
          { pid: 2001, ppid: 1000, command: 'unrelated-child', generation: 'gen-child-2001' },
        ]
      }

      const supervisor = new ProcessSupervisor({ killFn, getProcessListFn })
      const result = await supervisor.terminateProcessTree(1000, { force: true, timeoutMs: 50 })

      // Original root was replaced and retired, so termination returns true
      expect(result).toBe(true)

      // CRITICAL: Unrelated child 2001 must NEVER have been signaled!
      expect(signalsSent.some((s) => s.pid === 2001)).toBe(false)
      expect(signalsSent.filter((s) => s.signal === 'SIGKILL')).toHaveLength(0)
    })

    it('rejects root with whitespace-only birth marker and never signals its children', async () => {
      const alivePids = new Set([1000, 1001])
      const signalsSent: Array<{ pid: number; signal: NodeJS.Signals | 0 }> = []

      const killFn = vi.fn((pid: number, signal: NodeJS.Signals | 0) => {
        signalsSent.push({ pid, signal })
        if (signal === 0) {
          if (!alivePids.has(pid)) {
            const err = new Error('ESRCH') as NodeJS.ErrnoException
            err.code = 'ESRCH'
            throw err
          }
          return
        }
      })

      const getProcessListFn = () => [
        { pid: 1000, ppid: 1, command: 'root', generation: '   ' }, // Whitespace only!
        { pid: 1001, ppid: 1000, command: 'child', generation: 'gen-child' },
      ]

      const supervisor = new ProcessSupervisor({ killFn, getProcessListFn })
      const result = await supervisor.terminateProcessTree(1000, { timeoutMs: 50 })

      expect(result).toBe(false)
      const nonZeroSignals = signalsSent.filter((s) => s.signal !== 0)
      expect(nonZeroSignals).toHaveLength(0)
    })

    it('never signals replacement process if original process was tracked without a valid birth marker', async () => {
      const alivePids = new Set([1000])
      const signalsSent: Array<{ pid: number; signal: NodeJS.Signals | 0 }> = []

      const killFn = vi.fn((pid: number, signal: NodeJS.Signals | 0) => {
        signalsSent.push({ pid, signal })
        if (signal === 0) {
          if (!alivePids.has(pid)) {
            const err = new Error('ESRCH') as NodeJS.ErrnoException
            err.code = 'ESRCH'
            throw err
          }
          return
        }
      })

      let processList: ProcessItem[] = [
        { pid: 1000, ppid: 1, command: 'app', generation: undefined }
      ]

      const supervisor = new ProcessSupervisor({ killFn, getProcessListFn: () => processList })

      // Attempt 1: Unknown identity must not authorize signaling and must return false
      const attempt1 = await supervisor.terminateProcessTree(1000, { timeoutMs: 50 })
      expect(attempt1).toBe(false)
      expect(signalsSent.filter((s) => s.signal !== 0)).toHaveLength(0)

      // Attempt 2: An unrelated process now appears on PID 1000 with a valid generation
      processList = [
        { pid: 1000, ppid: 1, command: 'unrelated-app', generation: 'gen-new-1000' }
      ]
      signalsSent.length = 0

      const attempt2 = await supervisor.terminateProcessTree(1000, { timeoutMs: 50 })
      // Must NOT adopt gen-new-1000 and must NOT signal it!
      expect(attempt2).toBe(false)
      expect(signalsSent.filter((s) => s.signal !== 0)).toHaveLength(0)
    })

    it('retains ownership and returns false when a live tracked process has undefined generation in process table', async () => {
      // Root 1000 -> Child 1001 with gen-1001
      const alivePids = new Set([1000, 1001])
      const signalsSent: Array<{ pid: number; signal: NodeJS.Signals | 0 }> = []

      const killFn = vi.fn((pid: number, signal: NodeJS.Signals | 0) => {
        signalsSent.push({ pid, signal })
        if (signal === 0) {
          if (!alivePids.has(pid)) {
            const err = new Error('ESRCH') as NodeJS.ErrnoException
            err.code = 'ESRCH'
            throw err
          }
          return
        }
        if (signal === 'SIGTERM' && pid === 1000) {
          alivePids.delete(1000) // Root exits, child survives
        }
      })

      let processList: ProcessItem[] = [
        { pid: 1000, ppid: 1, command: 'app', generation: 'gen-1000' },
        { pid: 1001, ppid: 1000, command: 'child', generation: 'gen-1001' },
      ]

      const supervisor = new ProcessSupervisor({ killFn, getProcessListFn: () => processList })

      // Attempt 1: Root exits, child survives
      const attempt1 = await supervisor.terminateProcessTree(1000, { timeoutMs: 50 })
      expect(attempt1).toBe(false)
      expect(supervisor.getOwnedPids(1000)).toContain(1001)

      // In Attempt 2: Child 1001 is still alive, but ps output has undefined generation
      processList = [
        { pid: 1001, ppid: 1, command: 'child', generation: undefined },
      ]

      const attempt2 = await supervisor.terminateProcessTree(1000, { timeoutMs: 50 })
      // MUST NOT return true (must not report false success)!
      expect(attempt2).toBe(false)
      // Ownership must be retained
      expect(supervisor.getOwnedPids(1000)).toContain(1001)
    })

    it('revalidates each target immediately before dispatch preventing signal to root replaced during child dispatch', async () => {
      // Tree: Root 1000 -> Child 1001
      const alivePids = new Set([1000, 1001])
      const signalsSent: Array<{ pid: number; signal: NodeJS.Signals | 0 }> = []

      let rootGeneration = 'gen-root-original'

      const killFn = vi.fn((pid: number, signal: NodeJS.Signals | 0) => {
        signalsSent.push({ pid, signal })
        if (signal === 0) {
          if (!alivePids.has(pid)) {
            const err = new Error('ESRCH') as NodeJS.ErrnoException
            err.code = 'ESRCH'
            throw err
          }
          return
        }

        // When child 1001 receives SIGTERM, simulate that root 1000 was replaced by a new process
        if (pid === 1001 && signal === 'SIGTERM') {
          rootGeneration = 'gen-root-replaced'
        }
      })

      const getProcessListFn = () => [
        { pid: 1000, ppid: 1, command: 'server', generation: rootGeneration },
        { pid: 1001, ppid: 1000, command: 'worker', generation: 'gen-worker' },
      ]

      const supervisor = new ProcessSupervisor({ killFn, getProcessListFn })
      await supervisor.terminateProcessTree(1000, { timeoutMs: 50 })

      // Child 1001 received SIGTERM
      expect(signalsSent.some((s) => s.pid === 1001 && s.signal === 'SIGTERM')).toBe(true)

      // CRITICAL: Root 1000 must NEVER receive SIGTERM because it was replaced during child dispatch!
      const nonZeroRootSignals = signalsSent.filter((s) => s.pid === 1000 && s.signal !== 0)
      expect(nonZeroRootSignals).toHaveLength(0)
    })
  })

  describe('parseUnixProcessLine', () => {
    it('correctly parses unix ps line with standard lstart birth marker', () => {
      const line = '  1050     1 Wed Sep 10 12:00:00 2026 /usr/local/bin/node /app/server.js'
      const parsed = parseUnixProcessLine(line)
      expect(parsed).toEqual({
        pid: 1050,
        ppid: 1,
        generation: 'Wed Sep 10 12:00:00 2026',
        command: '/usr/local/bin/node /app/server.js',
      })
    })

    it('leaves generation undefined when lstart is absent or non-standard', () => {
      const fallbackLine = '2040 1050 /bin/sh -c run'
      const parsed = parseUnixProcessLine(fallbackLine)
      expect(parsed).toEqual({
        pid: 2040,
        ppid: 1050,
        generation: undefined,
        command: '/bin/sh -c run',
      })
    })

    it('returns null for empty or invalid lines', () => {
      expect(parseUnixProcessLine('')).toBeNull()
      expect(parseUnixProcessLine('   ')).toBeNull()
      expect(parseUnixProcessLine('PID PPID COMMAND')).toBeNull()
    })
  })

  describe('checkProcessIdentity', () => {
    it('returns SAME when PIDs and generations match', () => {
      const tracked = { pid: 1000, command: 'node', generation: 'gen-1' }
      const current = { pid: 1000, ppid: 1, command: 'node', generation: 'gen-1' }
      expect(checkProcessIdentity(tracked, current)).toBe('SAME')
    })

    it('returns REPLACED when PIDs match but generations differ', () => {
      const tracked = { pid: 1000, command: 'node', generation: 'gen-1' }
      const current = { pid: 1000, ppid: 1, command: 'node', generation: 'gen-2' }
      expect(checkProcessIdentity(tracked, current)).toBe('REPLACED')
    })

    it('returns UNKNOWN when current is undefined or missing', () => {
      const tracked = { pid: 1000, command: 'node', generation: 'gen-1' }
      expect(checkProcessIdentity(tracked, undefined)).toBe('UNKNOWN')
    })

    it('returns UNKNOWN when either generation is undefined or empty', () => {
      const tracked = { pid: 1000, command: 'node', generation: undefined }
      const current = { pid: 1000, ppid: 1, command: 'node', generation: 'gen-1' }
      expect(checkProcessIdentity(tracked, current)).toBe('UNKNOWN')

      const tracked2 = { pid: 1000, command: 'node', generation: 'gen-1' }
      const current2 = { pid: 1000, ppid: 1, command: 'node', generation: undefined }
      expect(checkProcessIdentity(tracked2, current2)).toBe('UNKNOWN')

      const tracked3 = { pid: 1000, command: 'node', generation: '  ' }
      const current3 = { pid: 1000, ppid: 1, command: 'node', generation: 'gen-1' }
      expect(checkProcessIdentity(tracked3, current3)).toBe('UNKNOWN')
    })

    it('returns UNKNOWN when PIDs do not match', () => {
      const tracked = { pid: 1000, command: 'node', generation: 'gen-1' }
      const current = { pid: 2000, ppid: 1, command: 'node', generation: 'gen-1' }
      expect(checkProcessIdentity(tracked, current)).toBe('UNKNOWN')
    })
  })
})
