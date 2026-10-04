import { SessionManager } from './SessionManager'
import type { AgentAdapter, CreateAdapterOptions } from '../agents/AgentAdapterFactory'
import fs from 'node:fs'
import path from 'node:path'
import { SessionRegistry } from './SessionRegistry'
import { ProcessSupervisor } from './ProcessSupervisor'
import { EventJournal, ReconstructedMessage } from './EventJournal'
import {
  StartTaskRequest,
  StopTaskRequest,
  TaskSessionState,
} from '../../shared/agent-commands'
import { AgentEvent } from '../../shared/agent-events'

export interface RunServiceOptions {
  sessionRegistry: SessionRegistry
  processSupervisor: ProcessSupervisor
  baseStorageDir: string
  createAdapter?: (options: CreateAdapterOptions) => AgentAdapter
}

export class RunService {
  readonly sessions: SessionManager
  private sessionRegistry: SessionRegistry
  private processSupervisor: ProcessSupervisor
  private baseStorageDir: string
  // Nested map (taskId -> runId -> EventJournal) to eliminate key collision risks
  private journals = new Map<string, Map<string, EventJournal>>()
  private eventListeners = new Set<(event: AgentEvent) => void>()
  // Task queues ensuring operations (start, stop, emitEvent) per taskId execute in strict FIFO sequence
  private taskQueues = new Map<string, Promise<unknown>>()
  // In-flight task startup promises to deduplicate concurrent starts and share initialization/failure
  private startingTasks = new Map<string, Promise<TaskSessionState>>()
  // Tracks unresolved process teardowns per task to preserve teardown ownership across terminal states
  private unresolvedTeardowns = new Map<string, { taskId: string; runId: string; pid: number }>()

  constructor(options: RunServiceOptions) {
    this.sessionRegistry = options.sessionRegistry
    this.processSupervisor = options.processSupervisor
    this.baseStorageDir = path.resolve(options.baseStorageDir)
    this.sessions = new SessionManager({
      registry: options.sessionRegistry,
      baseStorageDir: this.baseStorageDir,
      getJournal: (taskId, runId) => this.getJournal(taskId, runId, true),
      createAdapter: options.createAdapter,
    })
  }

  /**
   * Serializes lifecycle mutations and event emissions per task to prevent race conditions.
   */
  private async serializeTask<T>(taskId: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.taskQueues.get(taskId) || Promise.resolve()
    const operation = (async () => {
      await prev.catch(() => {})
      return await fn()
    })()
    this.taskQueues.set(taskId, operation)
    try {
      return await operation
    } finally {
      if (this.taskQueues.get(taskId) === operation) {
        this.taskQueues.delete(taskId)
      }
    }
  }

  /**
   * Registers a global listener for all events emitted through RunService.
   */
  onEvent(callback: (event: AgentEvent) => void): () => void {
    this.eventListeners.add(callback)
    return () => {
      this.eventListeners.delete(callback)
    }
  }

  /**
   * Gets or initializes the EventJournal instance for a specific task run using nested mapping.
   */
  getJournal(taskId: string, runId: string, privateStorage = false): EventJournal {
    let taskMap = this.journals.get(taskId)
    if (!taskMap) {
      taskMap = new Map<string, EventJournal>()
      this.journals.set(taskId, taskMap)
    }

    let journal = taskMap.get(runId)
    if (!journal) {
      const journalPath = EventJournal.getJournalPath(this.baseStorageDir, taskId, runId)
      journal = new EventJournal(journalPath, { privateStorage })
      taskMap.set(runId, journal)
    }

    return journal
  }

  /**
   * Starts a task run idempotently with transactional locking.
   * Concurrent requests for the same taskId will share the same initialization attempt.
   */
  async startTask(request: StartTaskRequest): Promise<TaskSessionState> {
    // 1. Check if a start is already in flight (deduplicate concurrent initialization callers)
    const inFlight = this.startingTasks.get(request.taskId)
    if (inFlight) {
      return inFlight
    }

    const startPromise = this.serializeTask(request.taskId, async () => {
      const existing = this.sessionRegistry.get(request.taskId)
      // 1. Idempotency for healthy active session: return existing running/starting/waiting_for_approval session
      if (existing) {
        if (existing.status === 'running' || existing.status === 'waiting_for_approval' || existing.status === 'starting') {
          return existing
        }
      }

      // 2. Teardown ownership guards for previous/stopped/errored runs
      const unresolved = this.unresolvedTeardowns.get(request.taskId)
      if (unresolved) {
        if (this.processSupervisor.isProcessAlive(unresolved.pid) || this.processSupervisor.getOwnedPids(unresolved.pid).length > 0) {
          throw new Error(`Cannot start task "${request.taskId}": previous run "${unresolved.runId}" has unresolved teardown (PID ${unresolved.pid})`)
        } else {
          this.unresolvedTeardowns.delete(request.taskId)
        }
      }

      if (existing) {
        if (existing.status === 'stopping') {
          throw new Error(`Cannot start task "${request.taskId}": previous run "${existing.runId}" is still stopping`)
        }
        if (existing.pid && (this.processSupervisor.isProcessAlive(existing.pid) || this.processSupervisor.getOwnedPids(existing.pid).length > 0)) {
          throw new Error(`Cannot start task "${request.taskId}": previous run "${existing.runId}" has unresolved teardown (PID ${existing.pid})`)
        }
      }

      return this.executeStartTask(request)
    })

    this.startingTasks.set(request.taskId, startPromise)
    try {
      return await startPromise
    } finally {
      this.startingTasks.delete(request.taskId)
    }
  }

  private async executeStartTask(request: StartTaskRequest): Promise<TaskSessionState> {
    if (!request.worktreePath) {
      throw new Error('Target worktree directory is required and cannot be empty.')
    }

    const resolvedWorktree = path.resolve(request.worktreePath)
    if (!fs.existsSync(resolvedWorktree)) {
      throw new Error(`Target worktree directory does not exist: "${resolvedWorktree}"`)
    }

    const stats = fs.statSync(resolvedWorktree)
    if (!stats.isDirectory()) {
      throw new Error(`Target worktree path is not a directory: "${resolvedWorktree}"`)
    }

    const runId = request.runId || `run-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    const sessionId = `task-${request.taskId}-${runId}`

    const session: TaskSessionState = {
      taskId: request.taskId,
      runId,
      sessionId,
      agentProvider: request.agentProvider || 'codex',
      model: request.model,
      status: 'starting',
      worktreePath: resolvedWorktree,
      startedAt: Date.now(),
    }

    // Register session in starting state
    this.sessionRegistry.register(session)

    try {
      // Emit initial running event
      await this.emitEventInternal({
        eventId: `evt-start-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        taskId: request.taskId,
        runId,
        timestamp: Date.now(),
        type: 'agent.status.changed',
        status: 'running',
      })
      session.status = 'running'
    } catch (err) {
      // Rollback session only if the same run still owns the registry entry
      const current = this.sessionRegistry.get(request.taskId)
      if (current && current.runId === runId) {
        this.sessionRegistry.remove(request.taskId)
      }
      throw err
    }

    return session
  }

  /**
   * Stops an active task run, kills its process tree, and updates status to 'stopped'.
   * Rejects stale stop requests if runId mismatch is detected.
   */
  async stopTask(request: StopTaskRequest): Promise<TaskSessionState> {
    return this.serializeTask(request.taskId, async () => {
      const session = this.sessionRegistry.get(request.taskId)
      const unresolved = this.unresolvedTeardowns.get(request.taskId)
      if (!session && !unresolved) {
        throw new Error(`No active session found for task "${request.taskId}"`)
      }

      if (request.runId && session && session.runId !== request.runId) {
        throw new Error(`Stale stop request: expected runId "${session.runId}", but got "${request.runId}"`)
      }

      // Idempotent stop: if already stopped and no unresolved teardown, return without resending signals
      if (session && session.status === 'stopped' && !unresolved) {
        return session
      }

      const runId = session?.runId ?? unresolved!.runId
      const targetPid = session?.pid ?? unresolved?.pid

      if (session && session.status !== 'stopping' && session.status !== 'error') {
        await this.emitEventInternal({
          eventId: `evt-stopping-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          taskId: request.taskId,
          runId,
          timestamp: Date.now(),
          type: 'agent.status.changed',
          status: 'stopping',
        })
      }

      if (targetPid) {
        const killed = await this.processSupervisor.terminateProcessTree(targetPid, { force: request.force })
        if (!killed) {
          this.unresolvedTeardowns.set(request.taskId, { taskId: request.taskId, runId, pid: targetPid })
          throw new Error(`Failed to terminate process PID ${targetPid} for task "${request.taskId}"`)
        }
        this.unresolvedTeardowns.delete(request.taskId)
        this.sessionRegistry.clearPid(request.taskId)
      }

      await this.emitEventInternal({
        eventId: `evt-stop-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        taskId: request.taskId,
        runId,
        timestamp: Date.now(),
        type: 'agent.status.changed',
        status: 'stopped',
      })

      return this.sessionRegistry.get(request.taskId)!
    })
  }

  /**
   * Appends an event to the task's EventJournal and broadcasts to all active listeners.
   * Enforces transactional: validate transition -> append to journal -> mutate registry -> broadcast,
   * serialized per task.
   */
  async emitEvent(event: AgentEvent): Promise<void> {
    return this.serializeTask(event.taskId, () => this.emitEventInternal(event))
  }

  private async emitEventInternal(event: AgentEvent): Promise<void> {
    const current = this.sessionRegistry.get(event.taskId)

    // 1. Stale runId guard
    if (event.runId && current && current.runId !== event.runId) {
      throw new Error(`Cannot emit event for stale runId "${event.runId}" (current runId is "${current.runId}")`)
    }

    // 2. Validate status transition or guard terminated session
    if (event.type === 'agent.status.changed') {
      if (current) {
        if (!this.sessionRegistry.canTransition(event.taskId, event.status, event.runId)) {
          throw new Error(`Rejected invalid status transition from "${current.status}" to "${event.status}" for task "${event.taskId}"`)
        }
      }
    } else if (current && (current.status === 'completed' || current.status === 'error' || current.status === 'stopped')) {
      throw new Error(`Cannot emit event "${event.type}" on terminated session in status "${current.status}" for task "${event.taskId}"`)
    }

    // 3. Durable journal write FIRST
    const journal = this.getJournal(event.taskId, event.runId)
    await journal.append(event)

    // 4. Mutate registry state ONLY after durable write succeeds
    if (event.type === 'agent.status.changed') {
      const updated = this.sessionRegistry.updateStatus(event.taskId, event.status, event.error, event.runId)
      if (!updated) {
        throw new Error(`Failed to update status to "${event.status}" for task "${event.taskId}" in registry`)
      }
    }

    // 5. Broadcast to listeners
    for (const listener of this.eventListeners) {
      try {
        listener(event)
      } catch (err) {
        console.error('Error in RunService event listener:', err)
      }
    }
  }

  /**
   * Retrieves all events recorded for a task run.
   */
  async getEvents(taskId: string, runId: string): Promise<AgentEvent[]> {
    const journal = this.getJournal(taskId, runId)
    return journal.readEvents()
  }

  /**
   * Reconstructs the structured conversation feed from the task run's EventJournal.
   */
  async getReconstructedFeed(taskId: string, runId?: string): Promise<ReconstructedMessage[]> {
    const targetRunId = runId || this.sessionRegistry.get(taskId)?.runId
    if (!targetRunId) {
      return []
    }
    const journal = this.getJournal(taskId, targetRunId)
    return journal.reconstructFeed()
  }

  /**
   * Gets session details by taskId.
   */
  getSession(taskId: string): TaskSessionState | undefined {
    return this.sessionRegistry.get(taskId)
  }

  /**
   * Lists all sessions.
   */
  listSessions(): TaskSessionState[] {
    return this.sessionRegistry.getAll()
  }
}
