import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

export interface ProcessItem {
  pid: number
  ppid: number
  command: string
  generation?: number | string
}

/**
 * Parses a line from `ps -ax -o pid,ppid,lstart,command` into a ProcessItem with a birth marker.
 */
export function parseUnixProcessLine(line: string): ProcessItem | null {
  if (!line || typeof line !== 'string') return null
  const lstartRegex = /^\s*(\d+)\s+(\d+)\s+([A-Za-z]{3}\s+[A-Za-z]{3}\s+\d+\s+\d{2}:\d{2}:\d{2}\s+\d{4})\s+(.*)$/
  const match = line.match(lstartRegex)
  if (match) {
    return {
      pid: parseInt(match[1], 10),
      ppid: parseInt(match[2], 10),
      generation: match[3].trim(),
      command: match[4].trim(),
    }
  }

  // Fallback if ps does not output standard lstart: leave generation undefined
  const fallback = line.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/)
  if (fallback) {
    return {
      pid: parseInt(fallback[1], 10),
      ppid: parseInt(fallback[2], 10),
      generation: undefined,
      command: fallback[3].trim(),
    }
  }
  return null
}

/**
 * Reads the OS process tree in a cross-platform manner, including birth markers.
 */
export function getSystemProcessList(): ProcessItem[] {
  const processList: ProcessItem[] = []
  if (process.platform === 'win32') {
    try {
      const stdout = execSync('powershell.exe -Command "Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId, CommandLine, CreationDate | ConvertTo-Json"', { encoding: 'utf8' })
      const raw = JSON.parse(stdout)
      const list = Array.isArray(raw) ? raw : [raw]
      for (const p of list) {
        processList.push({
          pid: p.ProcessId,
          ppid: p.ParentProcessId,
          command: p.CommandLine || '',
          generation: p.CreationDate ? String(p.CreationDate).trim() : undefined,
        })
      }
    } catch (e: unknown) {
      console.error('Windows process list error:', (e as Error)?.message || e)
    }
  } else {
    try {
      const stdout = execSync('ps -ax -o pid,ppid,lstart,command', { encoding: 'utf8' })
      const lines = stdout.split('\n')
      for (const line of lines) {
        const item = parseUnixProcessLine(line)
        if (item) {
          processList.push(item)
        }
      }
    } catch (e: unknown) {
      console.error('Unix process list error:', (e as Error)?.message || e)
    }
  }
  return processList
}

/**
 * Normalizes command line for pattern matching: removes wrappers, leading paths, flags, extra spaces.
 */
export function normalizeCommandLine(cmd: string): string {
  if (!cmd || typeof cmd !== 'string') return ''
  let cleaned = cmd
    .replace(/^[●•*]\s*/, '')
    .replace(/\(ctrl\+o to expand\)/gi, '')
    .trim()

  const wrapperMatch = cleaned.match(/^[a-zA-Z0-9_]+\((.*)\)$/s)
  if (wrapperMatch) {
    cleaned = wrapperMatch[1].trim()
    if ((cleaned.startsWith('"') && cleaned.endsWith('"')) ||
        (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
      cleaned = cleaned.substring(1, cleaned.length - 1).trim()
    }
  }

  const tokens = cleaned.split(/\s+/)
  const cleanedTokens = tokens.map((token, index) => {
    if (index <= 1 && (token.includes('/') || token.includes('\\') || token.toLowerCase().includes('python') || token.toLowerCase().includes('node'))) {
      let name = token.split(/[/\\]/).pop() || token
      name = name.toLowerCase()
      if (name.startsWith('python')) return 'python'
      if (name.startsWith('node')) return 'node'
      return name
    }
    return token
  })

  return cleanedTokens.join(' ').toLowerCase().trim()
}

/**
 * Traverses process hierarchy and returns all descendants of a given parent PID.
 */
export function getDescendants(parentPid: number, processList: ProcessItem[]): ProcessItem[] {
  const result: ProcessItem[] = []
  const queue: number[] = [parentPid]
  const visited = new Set<number>([parentPid])

  while (queue.length > 0) {
    const current = queue.shift()!
    for (const p of processList) {
      if (p.ppid === current && !visited.has(p.pid)) {
        visited.add(p.pid)
        result.push(p)
        queue.push(p.pid)
      }
    }
  }

  return result
}

export interface AllowedPidOptions {
  targetSessionId?: string
  includeRootShells?: boolean
}

/**
 * Collects allowed PIDs: root PTY shells (optional) and their child/descendant processes,
 * optionally scoped to a single target session ID.
 */
export function getAllowedPtyPids(
  ptySessions: Map<string, { pid?: number }>,
  processList: ProcessItem[],
  options?: AllowedPidOptions
): Set<number> {
  const allowed = new Set<number>()
  const includeRoots = options?.includeRootShells ?? true
  const targetSessionId = options?.targetSessionId

  for (const [sessionId, session] of ptySessions.entries()) {
    if (targetSessionId && sessionId !== targetSessionId) {
      continue
    }
    if (session && typeof session.pid === 'number' && session.pid > 100) {
      if (includeRoots) {
        allowed.add(session.pid)
      }
      const descendants = getDescendants(session.pid, processList)
      for (const d of descendants) {
        allowed.add(d.pid)
      }
    }
  }
  return allowed
}

/**
 * Checks if a target PID belongs to the allowed ZIAForge process hierarchy,
 * optionally verifying ownership by a specific session.
 */
export function isPidAllowed(
  pid: number,
  allowedPids: Set<number>
): boolean {
  if (!pid || !Number.isInteger(pid) || pid <= 100) {
    return false
  }
  return allowedPids.has(pid)
}

/**
 * Finds processes matching a command pattern STRICTLY among descendants of active PTY sessions.
 * Never includes root shells and optionally scopes search to a single session.
 */
export function findMatchingDescendantPids(
  pattern: string,
  ptySessions: Map<string, { pid?: number }>,
  processList: ProcessItem[],
  targetSessionId?: string
): number[] {
  const targetPattern = normalizeCommandLine(pattern)
  const rawPattern = pattern.trim().toLowerCase()
  if (targetPattern.length < 3 && rawPattern.length < 3) return []

  // Strictly exclude root shells from command-kill targets!
  const allowedPids = getAllowedPtyPids(ptySessions, processList, {
    targetSessionId,
    includeRootShells: false
  })
  const matchedPids: number[] = []

  for (const p of processList) {
    if (allowedPids.has(p.pid)) {
      const normalized = normalizeCommandLine(p.command)
      const rawCmd = p.command.toLowerCase()
      if (
        (targetPattern.length >= 3 && normalized.includes(targetPattern)) ||
        (rawPattern.length >= 3 && rawCmd.includes(rawPattern))
      ) {
        matchedPids.push(p.pid)
      }
    }
  }

  return matchedPids
}

/**
 * Validates working directory path: ensures it is provided, exists, and is a directory.
 * Explicitly rejects silent fallback to $HOME.
 */
export function validateCwd(cwd?: string): { valid: boolean; resolvedCwd?: string; error?: string } {
  if (!cwd || typeof cwd !== 'string' || cwd.trim() === '') {
    return { valid: false, error: 'Working directory is required and cannot be empty' }
  }

  const resolved = path.resolve(cwd.trim())
  try {
    if (!fs.existsSync(resolved)) {
      return { valid: false, error: `Target working directory does not exist: "${resolved}"` }
    }
    const stats = fs.statSync(resolved)
    if (!stats.isDirectory()) {
      return { valid: false, error: `Target path is not a directory: "${resolved}"` }
    }
    return { valid: true, resolvedCwd: resolved }
  } catch (err: unknown) {
    return { valid: false, error: `Failed to access working directory "${resolved}": ${(err as Error)?.message || err}` }
  }
}

/**
 * Options for customizing process execution and supervision (useful for testing).
 */
export interface ProcessSupervisorOptions {
  killFn?: (pid: number, signal: NodeJS.Signals | 0) => void
  getProcessListFn?: () => ProcessItem[]
}

export interface ProcessIdentity {
  pid: number
  command: string
  generation?: number | string
}

export type IdentityMatchResult = 'SAME' | 'REPLACED' | 'UNKNOWN'

export function isValidBirthMarker(generation: number | string | undefined | null): boolean {
  if (generation === undefined || generation === null) return false
  return String(generation).trim().length > 0
}

/**
 * Compares a recorded process birth identity against a live process item.
 * - 'SAME': Both generations are defined, non-empty, and match.
 * - 'REPLACED': Both generations are defined, non-empty, and DIFFERENT.
 * - 'UNKNOWN': Either generation or current process item is missing/undefined.
 */
export function checkProcessIdentity(
  tracked: ProcessIdentity,
  current: ProcessItem | undefined
): IdentityMatchResult {
  if (!current) {
    return 'UNKNOWN'
  }
  if (tracked.pid !== current.pid) {
    return 'UNKNOWN'
  }
  if (!isValidBirthMarker(tracked.generation) || !isValidBirthMarker(current.generation)) {
    return 'UNKNOWN'
  }
  const gen1 = String(tracked.generation).trim()
  const gen2 = String(current.generation).trim()
  if (gen1 === gen2) {
    return 'SAME'
  }
  return 'REPLACED'
}

interface ProcessTreeTracking {
  rootPid: number
  trackedProcesses: Map<number, ProcessIdentity>
  retiredPids: Set<number>
}

/**
 * Class wrapper for process lifecycle supervision and tree killing.
 */
export class ProcessSupervisor {
  private killFn: (pid: number, signal: NodeJS.Signals | 0) => void
  private getProcessListFn: () => ProcessItem[]
  // Persisted process tree tracking across termination retries keyed by original rootPid
  private trackedTrees = new Map<number, ProcessTreeTracking>()

  constructor(options?: ProcessSupervisorOptions) {
    this.killFn = options?.killFn || ((pid, signal) => process.kill(pid, signal))
    this.getProcessListFn = options?.getProcessListFn || getSystemProcessList
  }

  getSystemProcesses(): ProcessItem[] {
    return this.getProcessListFn()
  }

  getDescendants(parentPid: number): ProcessItem[] {
    return getDescendants(parentPid, this.getSystemProcesses())
  }

  /**
   * Compares a recorded process birth identity against a live process item.
   * Requires a matching birth marker (generation); command equality alone cannot establish identity.
   */
  isSameProcessIdentity(tracked: ProcessIdentity, current: ProcessItem): boolean {
    return checkProcessIdentity(tracked, current) === 'SAME'
  }

  /**
   * Retrieves currently active/owned PIDs for a given root process.
   */
  getOwnedPids(rootPid: number): number[] {
    const tracking = this.trackedTrees.get(rootPid)
    return tracking ? Array.from(tracking.trackedProcesses.keys()) : []
  }

  /**
   * Checks if a process is alive.
   * Treats ONLY 'ESRCH' as confirmed absence; 'EPERM' or other errors confirm presence.
   */
  isProcessAlive(pid: number): boolean {
    if (!pid || pid <= 100) return false
    try {
      this.killFn(pid, 0)
      return true
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException)?.code
      if (code === 'ESRCH') {
        return false
      }
      // EPERM or any permission/inspection error means the process exists
      return true
    }
  }

  killProcessTree(rootPid: number, signal: NodeJS.Signals = 'SIGTERM'): boolean {
    if (!rootPid || rootPid <= 100) return false
    try {
      const descendants = this.getDescendants(rootPid)
      // Kill descendants bottom-up
      for (const d of descendants.reverse()) {
        try {
          this.killFn(d.pid, signal)
        } catch {
          // Process might have already terminated
        }
      }
      try {
        this.killFn(rootPid, signal)
      } catch {
        // Root process might have already terminated
      }
      return true
    } catch {
      return false
    }
  }

  /** Snapshot ownership before graceful EOF can let the root exit and orphan descendants. */
  trackProcessTree(rootPid: number): void {
    if (!rootPid || rootPid <= 100) return
    let tracking = this.trackedTrees.get(rootPid)
    if (!tracking) {
      const currentList = this.getSystemProcesses()
      const listByPid = new Map<number, ProcessItem>()
      for (const p of currentList) {
        listByPid.set(p.pid, p)
      }

      const trackedProcesses = new Map<number, ProcessIdentity>()
      const rootItem = listByPid.get(rootPid)
      if (rootItem && isValidBirthMarker(rootItem.generation)) {
        trackedProcesses.set(rootPid, {
          pid: rootPid,
          command: rootItem.command,
          generation: rootItem.generation,
        })
        const initialDescendants = getDescendants(rootPid, currentList)
        for (const d of initialDescendants) {
          trackedProcesses.set(d.pid, {
            pid: d.pid,
            command: d.command,
            generation: isValidBirthMarker(d.generation) ? d.generation : undefined,
          })
        }
      } else if (this.isProcessAlive(rootPid)) {
        // Root is alive but missing from process table or lacks a valid birth marker.
        // It remains untrusted/unresolved and cannot establish identity.
        trackedProcesses.set(rootPid, {
          pid: rootPid,
          command: rootItem?.command || '',
          generation: undefined,
        })
      }

      tracking = {
        rootPid,
        trackedProcesses,
        retiredPids: new Set<number>(),
      }
      this.trackedTrees.set(rootPid, tracking)
    } else {
      // Extend the same owned tree while it is alive, without accepting a reused
      // root PID. This keeps descendants known if a provider later crashes.
      const currentList = this.getSystemProcesses()
      const byPid = new Map(currentList.map(item => [item.pid, item]))
      const parents = new Set([...tracking.trackedProcesses.values()]
        .filter(identity => checkProcessIdentity(identity, byPid.get(identity.pid)) === 'SAME')
        .map(identity => identity.pid))
      let discovered = true
      while (discovered) {
        discovered = false
        for (const item of currentList) {
          if (!parents.has(item.ppid) || parents.has(item.pid) || tracking.retiredPids.has(item.pid)) continue
          // Never replace an existing birth identity with a newer process.
          if (!tracking.trackedProcesses.has(item.pid)) tracking.trackedProcesses.set(item.pid, { pid: item.pid, command: item.command, generation: item.generation })
          if (checkProcessIdentity(tracking.trackedProcesses.get(item.pid)!, item) === 'SAME') {
            parents.add(item.pid)
            discovered = true
          }
        }
      }
    }
  }

  /**
   * Confirms process exit by polling liveness across the whole owned process tree.
   * Persists birth identity alongside each PID, verifies identity freshly before each signal dispatch,
   * and retains unresolved identities to eliminate PID-reuse hazards and table outage failures.
   */
  async terminateProcessTree(rootPid: number, options?: { timeoutMs?: number; force?: boolean }): Promise<boolean> {
    if (!rootPid || rootPid <= 100) return false
    this.trackProcessTree(rootPid)
    const tracking = this.trackedTrees.get(rootPid)!

    const { trackedProcesses, retiredPids } = tracking

    /**
     * Inspects tracked processes against a SINGLE OS process table snapshot,
     * and discovers descendants of verified active processes within the SAME snapshot.
     */
    const inspectAndDiscover = (): { verified: ProcessIdentity[]; hasUnresolved: boolean } => {
      const snapshot = this.getSystemProcesses()
      const listByPid = new Map<number, ProcessItem>()
      for (const p of snapshot) {
        listByPid.set(p.pid, p)
      }

      const verified: ProcessIdentity[] = []
      let hasUnresolved = false

      for (const [pid, identity] of Array.from(trackedProcesses.entries())) {
        // 1. Is process alive at OS signal level?
        if (!this.isProcessAlive(pid)) {
          // Confirmed dead (ESRCH)
          trackedProcesses.delete(pid)
          retiredPids.add(pid)
          continue
        }

        // 2. Lookup in process table and compare identity
        const current = listByPid.get(pid)
        const matchResult = checkProcessIdentity(identity, current)

        if (matchResult === 'SAME') {
          // Confirmed original process, verified alive
          verified.push(identity)
        } else if (matchResult === 'REPLACED') {
          // Confirmed replacement: original process is dead, new generation running
          trackedProcesses.delete(pid)
          retiredPids.add(pid)
        } else {
          // UNKNOWN (missing table entry or missing birth marker): retain ownership, do NOT signal
          hasUnresolved = true
        }
      }

      // Discover descendants within the SAME snapshot ONLY from verified active processes
      for (const proc of verified) {
        const children = getDescendants(proc.pid, snapshot)
        for (const c of children) {
          if (!retiredPids.has(c.pid) && !trackedProcesses.has(c.pid)) {
            const childIdentity: ProcessIdentity = {
              pid: c.pid,
              command: c.command,
              generation: isValidBirthMarker(c.generation) ? c.generation : undefined,
            }
            trackedProcesses.set(c.pid, childIdentity)
            // If child has valid birth marker, include in verified dispatch list for this snapshot
            if (childIdentity.generation !== undefined) {
              verified.push(childIdentity)
            }
          }
        }
      }

      return { verified, hasUnresolved }
    }

    /**
     * Revalidates a specific target process against a fresh OS check immediately
     * before sending an individual signal.
     */
    const verifyAndSignalTarget = (pid: number, signal: NodeJS.Signals): boolean => {
      const identity = trackedProcesses.get(pid)
      if (!identity) return false

      for (;;) {
        // 1. Must be alive at OS signal level
        if (!this.isProcessAlive(pid)) {
          trackedProcesses.delete(pid)
          retiredPids.add(pid)
          return false
        }

        // 2. Fetch fresh snapshot
        const snapshot = this.getSystemProcesses()
        const current = snapshot.find((p) => p.pid === pid)
        const matchResult = checkProcessIdentity(identity, current)

        if (matchResult === 'REPLACED') {
          // Parent was replaced: do NOT signal parent and do NOT adopt replacement's descendants
          trackedProcesses.delete(pid)
          retiredPids.add(pid)
          return false
        }

        if (matchResult !== 'SAME') {
          // UNKNOWN (missing from table or missing birth marker): do not signal
          return false
        }

        // 3. Parent is verified SAME in this snapshot: check for any untracked descendants
        const descendants = getDescendants(pid, snapshot)
        const newlyDiscoveredChildren: number[] = []
        for (const d of descendants) {
          if (!retiredPids.has(d.pid) && !trackedProcesses.has(d.pid)) {
            const childIdentity: ProcessIdentity = {
              pid: d.pid,
              command: d.command,
              generation: isValidBirthMarker(d.generation) ? d.generation : undefined,
            }
            trackedProcesses.set(d.pid, childIdentity)
            if (childIdentity.generation !== undefined) {
              newlyDiscoveredChildren.push(d.pid)
            }
          }
        }

        // If new descendants were discovered, signal them first (each gets fresh verification)
        if (newlyDiscoveredChildren.length > 0) {
          for (const childPid of newlyDiscoveredChildren) {
            verifyAndSignalTarget(childPid, signal)
          }
          // After child dispatches, take another fresh snapshot to re-verify parent and ensure no further descendants
          continue
        }

        // 4. In this snapshot, parent is verified SAME and has no untracked descendants.
        // Send signal immediately!
        try {
          this.killFn(pid, signal)
          signaledPids.add(pid)
          return true
        } catch {
          // Already exited
          return false
        }
      }
    }

    const signaledPids = new Set<number>()

    const dispatchSignal = (signal: NodeJS.Signals): void => {
      const { verified } = inspectAndDiscover()
      if (verified.length === 0) return

      // Signal children first, re-verifying each child immediately before dispatch
      for (const proc of verified) {
        if (proc.pid !== rootPid) {
          verifyAndSignalTarget(proc.pid, signal)
        }
      }

      // Signal root if it was in verified list, re-verifying immediately before dispatch
      const rootProc = verified.find((p) => p.pid === rootPid)
      if (rootProc) {
        verifyAndSignalTarget(rootProc.pid, signal)
      }
    }

    // Initial pass: verify and check if already clear
    const initialCheck = inspectAndDiscover()
    if (trackedProcesses.size === 0 && !initialCheck.hasUnresolved) {
      this.trackedTrees.delete(rootPid)
      return true
    }

    const timeout = options?.timeoutMs ?? 500
    const initialSignal: NodeJS.Signals = options?.force ? 'SIGKILL' : 'SIGTERM'

    // Dispatch initial signal freshly
    dispatchSignal(initialSignal)

    // Wait and verify exit across the whole owned tree
    const start = Date.now()
    while (Date.now() - start < timeout) {
      const { verified, hasUnresolved } = inspectAndDiscover()
      if (trackedProcesses.size === 0 && !hasUnresolved) {
        this.trackedTrees.delete(rootPid)
        return true
      }
      // If any newly tracked active processes have not received the initial signal yet, signal them
      for (const proc of verified) {
        if (!signaledPids.has(proc.pid)) {
          verifyAndSignalTarget(proc.pid, initialSignal)
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 20))
    }

    // Escalate to SIGKILL if necessary:
    // Fresh verification immediately before escalation ensures replacements during polling delay are NEVER signaled
    if (initialSignal !== 'SIGKILL') {
      const preEscalation = inspectAndDiscover()
      if (preEscalation.verified.length > 0) {
        dispatchSignal('SIGKILL')
        const killStart = Date.now()
        while (Date.now() - killStart < timeout) {
          const { hasUnresolved } = inspectAndDiscover()
          if (trackedProcesses.size === 0 && !hasUnresolved) {
            this.trackedTrees.delete(rootPid)
            return true
          }
          await new Promise((resolve) => setTimeout(resolve, 20))
        }
      }
    }

    const finalState = inspectAndDiscover()
    if (trackedProcesses.size === 0 && !finalState.hasUnresolved) {
      this.trackedTrees.delete(rootPid)
      return true
    }

    // Retain remaining trackedProcesses and retiredPids for subsequent retries
    return false
  }

  validateCwd(cwd?: string): { valid: boolean; resolvedCwd?: string; error?: string } {
    return validateCwd(cwd)
  }
}
