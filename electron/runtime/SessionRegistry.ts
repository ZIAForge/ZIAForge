import type { AgentSessionSnapshot } from '../../shared/agent-session'
import { TaskSessionState, AgentRunStatus } from '../../shared/agent-commands'

const VALID_TRANSITIONS: Record<AgentRunStatus, ReadonlySet<AgentRunStatus>> = {
  idle: new Set(['starting', 'running']),
  starting: new Set(['running', 'error', 'stopped', 'stopping']),
  running: new Set(['waiting_for_approval', 'stopping', 'completed', 'error', 'stopped']),
  waiting_for_approval: new Set(['running', 'stopping', 'completed', 'error', 'stopped']),
  stopping: new Set(['stopped', 'error']),
  completed: new Set(), // Terminal
  error: new Set(['stopped']), // Allow stopping an errored session during teardown
  stopped: new Set(),   // Terminal
}

export class SessionRegistry {
  private agentSessions = new Map<string, { snapshot: AgentSessionSnapshot; pid?: number }>()

  registerAgentSession(snapshot: AgentSessionSnapshot): void {
    const previous = this.agentSessions.get(snapshot.sessionId)
    this.agentSessions.set(snapshot.sessionId, { snapshot: { ...snapshot }, pid: previous?.snapshot.runId === snapshot.runId ? previous.pid : undefined })
  }

  setAgentSessionPid(sessionId: string, runId: string, pid: number | undefined): boolean {
    const entry = this.agentSessions.get(sessionId)
    if (!entry || entry.snapshot.runId !== runId) return false
    entry.pid = pid
    return true
  }

  getAgentSession(sessionId: string): { snapshot: AgentSessionSnapshot; pid?: number } | undefined {
    const entry = this.agentSessions.get(sessionId)
    return entry ? { ...entry, snapshot: { ...entry.snapshot } } : undefined
  }

  private sessions = new Map<string, TaskSessionState>()

  /**
   * Registers or updates a task session.
   */
  register(session: TaskSessionState): void {
    this.sessions.set(session.taskId, { ...session })
  }

  /**
   * Retrieves a task session by taskId.
   */
  get(taskId: string): TaskSessionState | undefined {
    const s = this.sessions.get(taskId)
    return s ? { ...s } : undefined
  }

  /**
   * Retrieves a task session by sessionId.
   */
  getBySessionId(sessionId: string): TaskSessionState | undefined {
    for (const s of this.sessions.values()) {
      if (s.sessionId === sessionId) {
        return { ...s }
      }
    }
    return undefined
  }

  /**
   * Retrieves a task session by runId.
   */
  getByRunId(runId: string): TaskSessionState | undefined {
    for (const s of this.sessions.values()) {
      if (s.runId === runId) {
        return { ...s }
      }
    }
    return undefined
  }

  /**
   * Checks if a transition is valid without mutating session state.
   */
  canTransition(taskId: string, status: AgentRunStatus, expectedRunId?: string): boolean {
    const existing = this.sessions.get(taskId)
    if (!existing) return true
    if (expectedRunId && existing.runId !== expectedRunId) return false
    const allowed = VALID_TRANSITIONS[existing.status]
    return Boolean(allowed && allowed.has(status))
  }

  /**
   * Updates status of a task session, validating expectedRunId and checking strict transition rules.
   */
  updateStatus(taskId: string, status: AgentRunStatus, error?: string, expectedRunId?: string): TaskSessionState | undefined {
    const existing = this.sessions.get(taskId)
    if (!existing) return undefined

    if (expectedRunId && existing.runId !== expectedRunId) {
      // Stale update from previous/inactive run - reject silently
      return undefined
    }

    // Verify valid lifecycle transition
    const allowed = VALID_TRANSITIONS[existing.status]
    if (!allowed || !allowed.has(status)) {
      return undefined
    }

    existing.status = status
    if (error !== undefined) {
      existing.error = error
    }
    if (status === 'completed' || status === 'stopped') {
      existing.endedAt = Date.now()
      existing.pid = undefined
    } else if (status === 'error') {
      existing.endedAt = Date.now()
      // Preserve existing.pid on error so teardown ownership remains active until processes are terminated
    }
    this.sessions.set(taskId, existing)
    return { ...existing }
  }

  /**
   * Clears OS process ID for a task session once termination is verified.
   */
  clearPid(taskId: string): void {
    const existing = this.sessions.get(taskId)
    if (existing) {
      existing.pid = undefined
      this.sessions.set(taskId, existing)
    }
  }

  /**
   * Sets OS process ID for a task session, validating expectedRunId if provided.
   */
  setPid(taskId: string, pid: number, expectedRunId?: string): boolean {
    const existing = this.sessions.get(taskId)
    if (!existing) return false

    if (expectedRunId && existing.runId !== expectedRunId) {
      return false
    }

    existing.pid = pid
    this.sessions.set(taskId, existing)
    return true
  }

  /**
   * Checks if a task has an actively running or waiting session.
   */
  hasActiveSession(taskId: string): boolean {
    const s = this.sessions.get(taskId)
    return Boolean(s && (s.status === 'running' || s.status === 'waiting_for_approval' || s.status === 'starting'))
  }

  /**
   * Removes a session from the registry.
   */
  remove(taskId: string): boolean {
    return this.sessions.delete(taskId)
  }

  /**
   * Returns all recorded sessions.
   */
  getAll(): TaskSessionState[] {
    return Array.from(this.sessions.values()).map((s) => ({ ...s }))
  }

  /**
   * Clears all sessions (useful for tests and reset).
   */
  clear(): void {
    this.sessions.clear()
  }
}
