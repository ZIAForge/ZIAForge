import { validateReasoningEffort } from '../runtime/AgentExecutionPolicy'
import { isReasoningEffort } from '../../shared/agent-models'
import { spawn, ChildProcess, SpawnOptions } from 'node:child_process'
import path from 'node:path'
import { StringDecoder } from 'node:string_decoder'
import {
  AgentEvent,
  ApprovalDecision,
  MessageDeltaEvent,
  MessageCompletedEvent,
  MessageStartedEvent,
  PermissionRequestedEvent,
  PermissionStateChangedEvent,
  ToolStartedEvent,
  ToolOutputDeltaEvent,
  ToolCompletedEvent,
  AgentStatusChangedEvent,
  RawLogEvent,
} from '../../shared/agent-events'
import {
  SendPromptRequest,
  AgentRunStatus,
  ResolveApprovalRequest,
  AgentProviderType,
} from '../../shared/agent-commands'

/** A matching JSON-RPC error response, distinct from timeout or transport uncertainty. */
export class CodexRpcRejectedError extends Error {
  deliveryRejected = true
  constructor(readonly method: string, message: string, readonly code?: number) {
    super(`RPC error [${method}]: ${message}`)
    this.name = 'CodexRpcRejectedError'
  }
}

export interface CodexCapabilities {
  textStreaming: boolean
  toolCalls: boolean
  thinkingStreaming: boolean
  toolOutputStreaming: boolean
  interactiveApprovals: boolean
  attachments: boolean
}

export interface CodexAdapterOptions {
  taskId: string
  runId: string
  worktreePath: string
  reasoningEffort?: string | null
  model?: string
  resumeThreadId?: string
  codexBinPath?: string
  approvalPolicy?: 'on-request' | 'never' | 'untrusted'
  sandbox?: 'read-only' | 'workspace-write' | 'danger-full-access'
  env?: Record<string, string | undefined>
  emitRawLogEvents?: boolean
  killTimeoutMs?: number
  maxLineBufferBytes?: number
  spawnProcess?: (command: string, args: string[], options: SpawnOptions) => ChildProcess
  onEvent?: (event: AgentEvent) => void
  onRawLog?: (stream: 'stdout' | 'stderr', line: string) => void
}

const DEFAULT_MAX_LINE_BUFFER_BYTES = 1 * 1024 * 1024 // 1 MB

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (reason: unknown) => void
  method: string
}

interface PendingApproval {
  rpcId: number | string
  approvalId: string
  method: string
  params: Record<string, unknown>
  turnId?: string
}

interface JsonRpcMessage {
  id?: number | string
  method?: string
  params?: Record<string, unknown>
  result?: unknown
  error?: { code?: number; message?: string; data?: unknown }
}

interface ThreadItemPayload {
  type: string
  id: string
  text?: string
  content?: Array<string | { text?: string }>
  summary?: Array<{ text?: string }>
  command?: string
  cwd?: string
  changes?: unknown
  server?: string
  tool?: string
  arguments?: unknown
  aggregatedOutput?: string
  output?: unknown
  result?: unknown
  contentItems?: unknown
  exitCode?: number
  status?: string
  success?: boolean
}

interface ApprovalRequestParams {
  threadId?: string
  turnId?: string
  itemId?: string
  command?: string
  reason?: string
  approvalId?: string
  cwd?: string
  permissions?: Record<string, unknown> | unknown[]
}

interface ItemNotificationParams {
  threadId?: string
  turnId?: string
  turn?: { id: string; status?: string; error?: unknown }
  status?: string
  error?: unknown
  itemId?: string
  delta?: string
  message?: string
  item?: ThreadItemPayload
}

export class CodexAdapter {
  private options: CodexAdapterOptions
  private childProcess?: ChildProcess
  private threadId?: string
  private effectiveReasoningEffort?: string
  private activeTurnId?: string
  private completedTurnIds = new Set<string>()
  private nextRpcId = 1
  private pendingRequests = new Map<number | string, PendingRequest>()
  private pendingApprovals = new Map<string, PendingApproval>()
  private stdoutBuffer = ''
  private stderrBuffer = ''
  private stdoutDiscardingUntilNewline = false
  private stderrDiscardingUntilNewline = false
  private stdoutDecoder = new StringDecoder('utf8')
  private stderrDecoder = new StringDecoder('utf8')
  private isStopped = false
  private isStopping = false
  private startingTurn?: { turnId?: string; observedActivity?: boolean }
  private startingPromise?: Promise<{ pid: number; threadId: string }>
  private terminationContext?: {
    proc: ChildProcess
    promise: Promise<void>
  }
  private processGeneration = 0
  private currentStatus: AgentRunStatus = 'idle'

  private async defaultReasoningEffort(model: string | undefined, generation: number): Promise<string> {
    if (typeof model !== 'string' || !model) throw new Error('Codex did not identify its model; choose an explicit reasoning effort')
    let cursor: string | undefined
    const seen = new Set<string>()
    for (let page = 0; page < 20; page++) {
      if (this.processGeneration !== generation || this.isStopping || this.isStopped) throw new Error('Codex stopped during default effort discovery')
      const result = await this.sendRpcRequest('model/list', { limit: 100, includeHidden: true, ...(cursor ? { cursor } : {}) }) as { data?: Array<{ model?: string; defaultReasoningEffort?: unknown; supportedReasoningEfforts?: Array<{ reasoningEffort?: unknown }> }>; nextCursor?: unknown }
      if (this.processGeneration !== generation || this.isStopping || this.isStopped) throw new Error('Codex stopped during default effort discovery')
      if (!result || !Array.isArray(result.data)) throw new Error('Codex returned an invalid model catalog for the default reasoning effort')
      const selected = result.data.find(item => item && item.model === model)
      if (selected) {
        const effort = selected.defaultReasoningEffort
        if (!isReasoningEffort(effort) || !Array.isArray(selected.supportedReasoningEfforts) || !selected.supportedReasoningEfforts.some(item => item?.reasoningEffort === effort)) throw new Error('This model does not advertise a valid default reasoning effort; choose an explicit effort')
        return effort
      }
      if (result.nextCursor == null) break
      if (typeof result.nextCursor !== 'string' || !result.nextCursor || seen.has(result.nextCursor)) throw new Error('Codex returned an invalid model catalog cursor')
      cursor = result.nextCursor; seen.add(cursor)
    }
    throw new Error('This model is absent from the Codex catalog. Choose an explicit reasoning effort instead of Default.')
  }

  constructor(options: CodexAdapterOptions) {
    validateReasoningEffort('codex', options.reasoningEffort)
    if (options.resumeThreadId !== undefined && !/^[A-Za-z0-9_-]{1,200}$/.test(options.resumeThreadId)) throw new Error('Invalid Codex thread reference')
    this.options = {
      ...options,
      worktreePath: path.resolve(options.worktreePath),
      codexBinPath: options.codexBinPath || 'codex',
      maxLineBufferBytes: options.maxLineBufferBytes ?? DEFAULT_MAX_LINE_BUFFER_BYTES,
    }
  }

  getThreadId(): string | undefined {
    return this.threadId
  }

  getActiveTurnId(): string | undefined {
    return this.activeTurnId
  }

  getPid(): number | undefined {
    return this.childProcess?.pid
  }

  getStatus(): AgentRunStatus {
    if (this.isStopped) return 'stopped'
    return this.currentStatus
  }

  getSessionId(): string | undefined {
    return this.threadId
  }

  getProvider(): AgentProviderType {
    return 'codex'
  }

  getTaskId(): string {
    return this.options.taskId
  }

  getRunId(): string {
    return this.options.runId
  }

  getCapabilities(): CodexCapabilities {
    return {
      textStreaming: true,
      toolCalls: true,
      thinkingStreaming: true,
      toolOutputStreaming: true,
      interactiveApprovals: true,
      attachments: false,
    }
  }

  /**
   * Spawns codex app-server, performs initialize handshake, and starts an active thread.
   * Deduplicates concurrent start invocations via startingPromise.
   */
  async start(): Promise<{ pid: number; threadId: string }> {
    if (this.isStopping) {
      throw new Error('Cannot start CodexAdapter: adapter is currently stopping')
    }
    this.isStopped = false

    if (this.startingPromise) {
      return this.startingPromise
    }

    if (
      this.childProcess &&
      !this.childProcess.killed &&
      !this.isProcessExited(this.childProcess) &&
      this.threadId
    ) {
      if (this.currentStatus === 'error' || this.currentStatus === 'stopped') {
        this.emitEvent({
          eventId: this.createEventId('stat-idle'),
          taskId: this.options.taskId,
          runId: this.options.runId,
          timestamp: Date.now(),
          type: 'agent.status.changed',
          status: 'idle',
        } as AgentStatusChangedEvent)
      }
      return Promise.resolve({ pid: this.childProcess.pid ?? -1, threadId: this.threadId })
    }

    this.startingPromise = (async () => {
      let proc: ChildProcess | undefined
      const currentStartGen = ++this.processGeneration
      try {
        // Clean up any unhealthy prior generation before replacing it
        if (this.childProcess) {
          const oldProc = this.childProcess
          await this.terminateChildProcess(oldProc, true)
          this.cleanupTurnAndBufferState(new Error('Previous process replaced by new start()'))
          if (this.childProcess === oldProc) {
            this.childProcess = undefined
          }
        }

        if (this.isStopped || this.isStopping || this.processGeneration !== currentStartGen) {
          throw new Error('Cannot start CodexAdapter: adapter was stopped during startup')
        }

        const spawnFn = this.options.spawnProcess || spawn
        const spawnArgs = ['app-server', '--listen', 'stdio://']

        proc = spawnFn(this.options.codexBinPath!, spawnArgs, {
          cwd: this.options.worktreePath,
          stdio: ['pipe', 'pipe', 'pipe'],
          env: {
            ...(this.options.env ?? process.env),
            CI: 'true',
          },
        })

        if (this.isStopped || this.isStopping || this.processGeneration !== currentStartGen) {
          void this.terminateChildProcess(proc, true).catch(() => {})
          throw new Error('Cannot start CodexAdapter: adapter was stopped during startup')
        }

        this.childProcess = proc
        const currentProc: ChildProcess = proc
        const pid = proc.pid ?? -1

        proc.stdin?.on('error', (err) => {
          if (this.childProcess !== proc) return
          console.error(`CodexAdapter stdin error [${this.options.taskId}]:`, err)
        })

        proc.stdout?.on('data', (chunk: Buffer | string) => {
          if (this.childProcess !== proc) return
          this.handleStdoutData(chunk)
        })

        proc.stderr?.on('data', (chunk: Buffer | string) => {
          if (this.childProcess !== proc) return
          this.handleStderrData(chunk)
        })

        proc.on('error', (err) => {
          if (this.childProcess !== proc) return
          this.emitEvent({
            eventId: this.createEventId('err'),
            taskId: this.options.taskId,
            runId: this.options.runId,
            timestamp: Date.now(),
            type: 'agent.status.changed',
            status: 'error',
            error: err.message,
          } as AgentStatusChangedEvent)
        })

        let terminationDone = false
        let processExitCode: number | null = null
        let processSignalCode: NodeJS.Signals | null = null
        let hasClosed = false
        let sessionExitReported = false

        const reportUnexpectedExit = (code: number | null, signal: NodeJS.Signals | null) => {
          if (sessionExitReported || this.isStopped || this.isStopping) return
          sessionExitReported = true
          const hadActiveTurn = Boolean(this.activeTurnId) || Boolean(this.startingTurn)
          const isStarting = Boolean(this.startingPromise) || !this.threadId
          const errorMsg =
            code !== 0
              ? `Codex process exited with code ${code}, signal ${signal}`
              : isStarting
              ? 'Codex process exited cleanly (code 0) during startup initialization'
              : hadActiveTurn
              ? 'Codex process exited cleanly (code 0) before active turn completed'
              : 'Codex process exited unexpectedly with code 0'
          this.emitEvent({
            eventId: this.createEventId('exit'),
            taskId: this.options.taskId,
            runId: this.options.runId,
            timestamp: Date.now(),
            type: 'agent.status.changed',
            scope: 'session',
            status: 'error',
            error: errorMsg,
          })
        }

        const drainAndTerminate = (code: number | null, signal: NodeJS.Signals | null) => {
          if (terminationDone) return
          if (this.childProcess !== currentProc) return
          terminationDone = true
          const drainGeneration = this.processGeneration

          // Flush decoders and process all buffered lines
          this.flushBuffers()
          if (this.childProcess !== currentProc || this.processGeneration !== drainGeneration) return

          // app-server is persistent. A clean unsolicited exit also invalidates
          // the session; stream completion remains a separate turn outcome.
          reportUnexpectedExit(code, signal)
          // onEvent may synchronously begin recovery or stop(). That owner now
          // controls cleanup; the exiting generation must not erase its startup.
          if (this.childProcess !== currentProc || this.processGeneration !== drainGeneration) return

          this.cleanupTurnAndBufferState(
            new Error(`Codex process exited with code ${code}, signal ${signal}`)
          )

          if (this.childProcess === currentProc) {
            this.childProcess = undefined
          }
          this.startingPromise = undefined
          this.terminationContext = undefined
          this.isStopping = false
        }

        proc.once('exit', (code, signal) => {
          if (this.childProcess !== currentProc) return
          processExitCode = code
          processSignalCode = signal
          const mutableProc = proc as unknown as { exitCode: number | null; signalCode: string | null }
          if (code !== null && mutableProc.exitCode === null) {
            try {
              mutableProc.exitCode = code
            } catch {
              // ignore readonly property error
            }
          }
          if (signal !== null && mutableProc.signalCode === null) {
            try {
              mutableProc.signalCode = signal
            } catch {
              // ignore readonly property error
            }
          }

          // Report a crash immediately, but retain stdout ownership until close.
          if (code !== 0) reportUnexpectedExit(code, signal)
          if (hasClosed) {
            drainAndTerminate(code, signal)
          }
        })

        proc.once('close', (code, signal) => {
          hasClosed = true
          const finalCode = code !== null ? code : processExitCode
          const finalSignal = signal !== null ? signal : processSignalCode
          drainAndTerminate(finalCode, finalSignal)
        })

        // 1. Initialize handshake
        await this.sendRpcRequest('initialize', {
          clientInfo: {
            name: 'ziaforge',
            version: '0.1.0',
          },
          capabilities: null,
        })

        if (
          this.childProcess !== proc ||
          this.isStopped ||
          this.isStopping ||
          this.processGeneration !== currentStartGen
        ) {
          throw new Error('Codex process replaced or terminated during initialize handshake')
        }

        // Send initialized notification per app-server LSP specification
        this.sendRpcNotification('initialized', {})

        // 2. Start thread in worktree directory
        const threadMethod = this.options.resumeThreadId ? 'thread/resume' : 'thread/start'
        const threadRes = (await this.sendRpcRequest(threadMethod, {
          ...(this.options.resumeThreadId ? { threadId: this.options.resumeThreadId } : {}),
          cwd: this.options.worktreePath,
          model: this.options.model ?? null,
          approvalPolicy: this.options.approvalPolicy ?? 'on-request',
          sandbox: this.options.sandbox ?? 'workspace-write',
          ...(this.options.reasoningEffort != null ? { config: { model_reasoning_effort: this.options.reasoningEffort } } : {}),
        })) as { thread?: { id: string }; model?: string }

        if (this.childProcess !== proc || this.processGeneration !== currentStartGen || this.isStopping || this.isStopped) throw new Error('Codex stopped during thread initialization')

        // null is a UI reset request, not a valid Codex configuration value.
        // A resumed thread may retain its previous effort, so explicitly send
        // the selected model's advertised default on every subsequent turn.
        this.effectiveReasoningEffort = this.options.reasoningEffort === null
          ? await this.defaultReasoningEffort(threadRes.model ?? this.options.model, currentStartGen)
          : this.options.reasoningEffort

        if (
          this.childProcess !== proc ||
          this.isStopped ||
          this.isStopping ||
          this.processGeneration !== currentStartGen
        ) {
          throw new Error('Codex process replaced or terminated during thread start')
        }

        const threadId = threadRes?.thread?.id
        if (!threadId) {
          throw new Error(`Codex failed to return thread ID from ${threadMethod}`)
        }
        if (this.options.resumeThreadId && threadId !== this.options.resumeThreadId) throw new Error('Codex resumed an unexpected thread')
        this.threadId = threadId
        this.isStopped = false
        this.isStopping = false

        if (this.currentStatus === 'error' || this.currentStatus === 'stopped') {
          this.emitEvent({
            eventId: this.createEventId('stat-idle'),
            taskId: this.options.taskId,
            runId: this.options.runId,
            timestamp: Date.now(),
            type: 'agent.status.changed',
            status: 'idle',
          } as AgentStatusChangedEvent)
        } else {
          this.currentStatus = 'idle'
        }

        return { pid, threadId }
      } catch (err) {
        const isCurrentProc = !proc || this.childProcess === proc
        if (proc) {
          if (this.childProcess === proc) {
            this.cleanupTurnAndBufferState(
              err instanceof Error ? err : new Error(String(err))
            )
          }
          void this.terminateChildProcess(proc, true).catch(() => {})
        }
        if (isCurrentProc && !this.isStopped && !this.isStopping) {
          this.emitEvent({
            eventId: this.createEventId('err-start'),
            taskId: this.options.taskId,
            runId: this.options.runId,
            timestamp: Date.now(),
            type: 'agent.status.changed',
            status: 'error',
            error: err instanceof Error ? err.message : String(err),
          } as AgentStatusChangedEvent)
        }
        throw err
      }
    })()

    try {
      return await this.startingPromise
    } finally {
      this.startingPromise = undefined
    }
  }

  /**
   * Starts a new turn with the provided prompt.
   * Returns normalized { turnId: string } and guards activeTurnId against late promise resolution.
   */
  async sendPrompt(request: SendPromptRequest): Promise<{ turnId: string }> {
    if (this.isStopped || this.isStopping) {
      throw new Error('Cannot send prompt: adapter is stopped')
    }
    if (this.startingTurn || this.activeTurnId) {
      throw new Error('Cannot send prompt: a turn is already in progress')
    }
    if (!this.threadId) {
      throw new Error('Cannot send prompt: thread is not initialized')
    }
    if (request.attachments && request.attachments.length > 0) {
      throw new Error('CodexAdapter does not currently support prompt attachments')
    }

    const targetProc = this.childProcess
    const targetGeneration = this.processGeneration
    if (!targetProc || this.isProcessExited(targetProc)) {
      throw new Error('Cannot send prompt: process is not running')
    }

    const startingTurn: { turnId?: string; observedActivity?: boolean } = {}
    this.startingTurn = startingTurn
    this.emitEvent({
      eventId: this.createEventId('status'),
      taskId: this.options.taskId,
      runId: this.options.runId,
      timestamp: Date.now(),
      type: 'agent.status.changed',
      scope: 'turn',
      status: 'running',
    } as AgentStatusChangedEvent)

    let turnRes: { turn?: { id: string }; turnId?: string }
    try {
      turnRes = (await this.sendRpcRequest('turn/start', {
        ...(this.effectiveReasoningEffort !== undefined ? { effort: this.effectiveReasoningEffort } : {}),
        threadId: this.threadId,
        input: [
          {
            type: 'text',
            text: request.text,
            text_elements: [],
          },
        ],
      })) as { turn?: { id: string }; turnId?: string }
    } catch (err) {
      if (err instanceof CodexRpcRejectedError && (startingTurn.turnId || startingTurn.observedActivity)) err.deliveryRejected = false
      if (this.childProcess !== targetProc || this.processGeneration !== targetGeneration || this.isStopped || this.isStopping) {
        throw err
      }
      this.emitEvent({
        eventId: this.createEventId('err-turn'),
        taskId: this.options.taskId,
        runId: this.options.runId,
        timestamp: Date.now(),
        type: 'agent.status.changed',
        scope: 'turn',
        turnId: startingTurn.turnId,
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      } as AgentStatusChangedEvent)
      throw err
    } finally {
      if (this.startingTurn === startingTurn) this.startingTurn = undefined
    }

    if (this.childProcess !== targetProc || this.processGeneration !== targetGeneration || this.isStopped || this.isStopping || this.isProcessExited(targetProc)) {
      throw new Error('Process replaced or terminated while starting turn')
    }

    const turnId = turnRes?.turn?.id || turnRes?.turnId
    if (!turnId || (startingTurn.turnId && startingTurn.turnId !== turnId)) {
      const error = !turnId
        ? 'Codex failed to return turn ID from turn/start'
        : 'Codex returned a different turn ID from the turn/start notification'
      if (this.childProcess === targetProc && !this.isStopped && !this.isStopping) {
        this.emitEvent({
          eventId: this.createEventId('err-turn'),
          taskId: this.options.taskId,
          runId: this.options.runId,
          timestamp: Date.now(),
          type: 'agent.status.changed',
          scope: 'turn',
          turnId: startingTurn.turnId,
          status: 'error',
          error,
        } as AgentStatusChangedEvent)
      }
      throw new Error(error)
    }

    if (!this.completedTurnIds.has(turnId)) {
      this.activeTurnId = turnId
      // Some servers reply without a turn/started notification. Publish the
      // now-known identity without overwriting an approval wait in this turn.
      if (!startingTurn.turnId) {
        this.emitEvent({
          eventId: this.createEventId('turn-start'),
          taskId: this.options.taskId,
          runId: this.options.runId,
          timestamp: Date.now(),
          type: 'agent.status.changed',
          scope: 'turn',
          turnId,
          status: this.currentStatus === 'waiting_for_approval' ? 'waiting_for_approval' : 'running',
        })
      }
    }

    return { turnId }
  }

  /**
   * Interrupts only the current turn. The RPC acknowledgement is not completion:
   * sendPrompt stays blocked until the matching turn/completed notification.
   * No process signal is sent and the thread remains available for another turn.
   */
  async interruptTurn(expectedTurnId?: string): Promise<{ turnId: string }> {
    const targetProc = this.childProcess
    const targetGeneration = this.processGeneration
    if (this.isStopped || this.isStopping || !targetProc || this.isProcessExited(targetProc) || !this.threadId) {
      throw new Error('Cannot interrupt turn: session is not running')
    }
    const turnId = this.activeTurnId
    if (!turnId) {
      throw new Error('Cannot interrupt turn: no active turn with a confirmed ID')
    }
    if (expectedTurnId !== undefined && expectedTurnId !== turnId) {
      throw new Error('Cannot interrupt turn: active turn no longer matches the requested turn')
    }
    await this.sendRpcRequest('turn/interrupt', { threadId: this.threadId, turnId })
    if (this.childProcess !== targetProc || this.processGeneration !== targetGeneration || this.isStopped || this.isStopping || this.isProcessExited(targetProc)) {
      throw new Error('Session replaced or terminated while interrupting turn')
    }
    return { turnId }
  }

  /**
   * Resolves a pending permission/approval request from codex app-server.
   * Formats modern { decision: "accept" | "decline" } for item/* approvals
   * and legacy { decision: "approved" | { denied: ... } } for execCommandApproval.
   */
  async resolveApproval(
    approvalIdOrRequest: string | ResolveApprovalRequest,
    decision?: ApprovalDecision | string,
    note?: string
  ): Promise<void> {
    const approvalId =
      typeof approvalIdOrRequest === 'string'
        ? approvalIdOrRequest
        : approvalIdOrRequest.approvalId
    const rawDecision =
      typeof approvalIdOrRequest === 'object' ? approvalIdOrRequest.decision : decision

    if (rawDecision !== 'allow' && rawDecision !== 'deny') {
      throw new Error(
        `Invalid approval decision: "${String(rawDecision)}". Decision must be "allow" or "deny"`
      )
    }
    const effectiveDecision: ApprovalDecision = rawDecision

    const effectiveNote =
      typeof approvalIdOrRequest === 'object' && 'note' in approvalIdOrRequest
        ? (approvalIdOrRequest as { note?: string }).note
        : note

    const pending = this.pendingApprovals.get(approvalId)
    if (!pending) {
      throw new Error(`Approval request "${approvalId}" not found or already resolved`)
    }

    let responseResult: Record<string, unknown>

    if (pending.method === 'item/permissions/requestApproval') {
      responseResult = {
        permissions: effectiveDecision === 'allow' ? (pending.params.permissions ?? {}) : {},
      }
    } else if (
      pending.method === 'item/commandExecution/requestApproval' ||
      pending.method === 'item/fileChange/requestApproval'
    ) {
      responseResult = {
        decision: effectiveDecision === 'allow' ? 'accept' : 'decline',
      }
    } else {
      responseResult = {
        decision:
          effectiveDecision === 'allow'
            ? 'approved'
            : {
                denied: {
                  rejection: effectiveNote || 'User declined execution',
                },
              },
      }
    }

    const response = {
      jsonrpc: '2.0',
      id: pending.rpcId,
      result: responseResult,
    }

    const targetProc = this.childProcess

    // Await write and ensure write errors abort resolution before mutating state
    await this.writeLineToStdin(JSON.stringify(response))

    // Fencing check: verify process has not changed/exited and record was not cleared or replaced
    if (this.childProcess !== targetProc || this.pendingApprovals.get(approvalId) !== pending) {
      return
    }

    this.pendingApprovals.delete(approvalId)

    this.emitEvent({
      eventId: this.createEventId('appr-res'),
      taskId: this.options.taskId,
      runId: this.options.runId,
      timestamp: Date.now(),
      type: 'permission.state.changed',
      turnId: pending.turnId,
      approvalId,
      state: 'resolved',
      decision: effectiveDecision,
      resolvedBy: 'user',
    } as PermissionStateChangedEvent)

    if (this.pendingApprovals.size === 0 && this.activeTurnId) {
      this.emitEvent({
        eventId: this.createEventId('stat-run'),
        taskId: this.options.taskId,
        runId: this.options.runId,
        timestamp: Date.now(),
        type: 'agent.status.changed',
        scope: 'turn',
        turnId: this.activeTurnId,
        status: 'running',
      } as AgentStatusChangedEvent)
    }
  }

  /**
   * Stops the adapter and terminates the codex process.
   * Interrupts active turn, attempts graceful SIGTERM, and escalates to SIGKILL after 1000ms.
   */
  async stop(force = false): Promise<void> {
    if (this.isStopped && !force && !this.childProcess && !this.startingPromise) return
    this.isStopping = true
    this.processGeneration++

    if (this.startingPromise) {
      this.rejectAllPending(new Error('CodexAdapter stopped'))
      if (force && this.childProcess) {
        void this.terminateChildProcess(this.childProcess, true).catch(() => {})
      }
      try {
        await this.startingPromise
      } catch {
        // Expected cancellation / failure of aborted startup
      }
    }

    let terminationSucceeded = false

    try {
      if (this.activeTurnId && this.threadId && !force) {
        try {
          await this.sendRpcRequest(
            'turn/interrupt',
            {
              threadId: this.threadId,
              turnId: this.activeTurnId,
            },
            300
          )
        } catch {
          // Ignore interrupt failure during teardown
        }
      }

      this.currentStatus = 'stopped'

      this.emitEvent({
        eventId: this.createEventId('stop'),
        taskId: this.options.taskId,
        runId: this.options.runId,
        timestamp: Date.now(),
        type: 'agent.status.changed',
        status: 'stopped',
      } as AgentStatusChangedEvent)

      this.flushBuffers()
      this.cleanupTurnAndBufferState(new Error('CodexAdapter stopped'))

      const procToKill = this.childProcess
      if (procToKill) {
        await this.terminateChildProcess(procToKill, force)
      }
      terminationSucceeded = true
    } finally {
      if (terminationSucceeded) {
        this.isStopped = true
        this.isStopping = false
      } else {
        // Retain teardown ownership if termination was not confirmed, blocking restart until exit fires
        this.isStopped = true
        this.isStopping = true
      }
    }
  }

  private cleanupTurnAndBufferState(error: Error): void {
    this.threadId = undefined
    this.activeTurnId = undefined
    this.startingTurn = undefined
    this.pendingApprovals.clear()
    this.completedTurnIds.clear()
    this.stdoutBuffer = ''
    this.stderrBuffer = ''
    this.stdoutDiscardingUntilNewline = false
    this.stderrDiscardingUntilNewline = false
    this.stdoutDecoder = new StringDecoder('utf8')
    this.stderrDecoder = new StringDecoder('utf8')
    this.rejectAllPending(error)
  }

  private async terminateChildProcess(proc: ChildProcess, force: boolean): Promise<void> {
    if (!proc || this.isProcessExited(proc)) {
      if (this.childProcess === proc) {
        this.childProcess = undefined
      }
      if (this.terminationContext?.proc === proc) {
        this.terminationContext = undefined
      }
      return
    }

    if (this.terminationContext?.proc === proc && !force) {
      return this.terminationContext.promise
    }

    const killTimeout = this.options.killTimeoutMs ?? 1000

    const termPromise = new Promise<void>((resolve, reject) => {
      let resolved = false
      let termTimer: NodeJS.Timeout | undefined
      let finalKillTimer: NodeJS.Timeout | undefined

      const cleanup = () => {
        if (termTimer) clearTimeout(termTimer)
        if (finalKillTimer) clearTimeout(finalKillTimer)
        proc.removeListener('exit', onExit)
        proc.removeListener('close', onExit)
      }

      const onExit = () => {
        if (resolved) return
        resolved = true
        cleanup()
        if (this.childProcess === proc) {
          this.childProcess = undefined
        }
        if (this.terminationContext?.proc === proc) {
          this.terminationContext = undefined
        }
        resolve()
      }

      proc.once('exit', onExit)
      proc.once('close', onExit)

      if (this.isProcessExited(proc)) {
        onExit()
        return
      }

      const sendKill = () => {
        try {
          proc.kill('SIGKILL')
        } catch {
          // Process might already be dead
        }
        finalKillTimer = setTimeout(() => {
          if (!resolved && !this.isProcessExited(proc)) {
            resolved = true
            cleanup()
            if (this.terminationContext?.proc === proc) {
              this.terminationContext = undefined
            }
            reject(new Error(`Failed to terminate process ${proc.pid} after SIGKILL timeout`))
          } else {
            onExit()
          }
        }, killTimeout)
        finalKillTimer.unref?.()
      }

      try {
        if (force) {
          sendKill()
        } else {
          try {
            proc.kill('SIGTERM')
          } catch {
            sendKill()
            return
          }

          termTimer = setTimeout(() => {
            if (!resolved && !this.isProcessExited(proc)) {
              sendKill()
            }
          }, killTimeout)
          termTimer.unref?.()
        }
      } catch (err) {
        cleanup()
        if (this.terminationContext?.proc === proc) {
          this.terminationContext = undefined
        }
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    })

    this.terminationContext = { proc, promise: termPromise }

    termPromise.catch(() => {
      // Suppress unhandled rejection on termPromise when caller runs it detached
    })

    return termPromise
  }

  private isProcessExited(proc: ChildProcess): boolean {
    return (
      (proc.exitCode !== null && proc.exitCode !== undefined) ||
      (proc.signalCode !== null && proc.signalCode !== undefined)
    )
  }

  private sendRpcRequest<T = unknown>(
    method: string,
    params: Record<string, unknown>,
    timeoutMs = 30000
  ): Promise<T> {
    if (this.isStopped || (this.isStopping && method !== 'turn/interrupt')) {
      return Promise.reject(new Error(`Cannot send request "${method}": adapter is stopped`))
    }

    const id = this.nextRpcId++
    const request = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    }

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id)
          reject(new Error(`RPC request "${method}" (ID ${id}) timed out after ${timeoutMs}ms`))
        }
      }, timeoutMs)

      this.pendingRequests.set(id, {
        resolve: (val) => {
          clearTimeout(timer)
          resolve(val as T)
        },
        reject: (err) => {
          clearTimeout(timer)
          reject(err)
        },
        method,
      })

      this.writeLineToStdin(JSON.stringify(request)).catch((err) => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id)
          clearTimeout(timer)
          reject(err)
        }
      })
    })
  }

  private sendRpcNotification(method: string, params: Record<string, unknown> = {}): void {
    if (this.isStopped) return
    const notification = {
      jsonrpc: '2.0',
      method,
      params,
    }
    void this.writeLineToStdin(JSON.stringify(notification)).catch((err) => {
      console.error(`Failed to send notification "${method}":`, err)
    })
  }

  private writeLineToStdin(data: string): Promise<void> {
    if (this.isStopped || !this.childProcess?.stdin || !this.childProcess.stdin.writable) {
      return Promise.reject(new Error('Cannot write to child process stdin: stream is not writable'))
    }

    return new Promise<void>((resolve, reject) => {
      try {
        this.childProcess!.stdin!.write(`${data}\n`, (err) => {
          if (err) {
            console.error(`CodexAdapter stdin write error [${this.options.taskId}]:`, err)
            reject(err)
          } else {
            resolve()
          }
        })
      } catch (err) {
        console.error('CodexAdapter failed to write to stdin:', err)
        reject(err)
      }
    })
  }

  private processStdoutLine(line: string): void {
    this.options.onRawLog?.('stdout', line)
    if (this.options.emitRawLogEvents) {
      this.emitEvent({
        eventId: this.createEventId('raw'),
        taskId: this.options.taskId,
        runId: this.options.runId,
        timestamp: Date.now(),
        type: 'raw.log',
        stream: 'stdout',
        line,
      } as RawLogEvent)
    }

    try {
      const parsed = JSON.parse(line)
      this.processIncomingJsonRpc(parsed)
    } catch {
      // Non-JSON stdout line - raw log was already emitted
    }
  }

  private processStderrLine(line: string): void {
    this.options.onRawLog?.('stderr', line)
    if (this.options.emitRawLogEvents) {
      this.emitEvent({
        eventId: this.createEventId('raw-err'),
        taskId: this.options.taskId,
        runId: this.options.runId,
        timestamp: Date.now(),
        type: 'raw.log',
        stream: 'stderr',
        line,
      } as RawLogEvent)
    }
  }

  private flushBuffers(): void {
    const remainingStdout = this.stdoutDecoder.end()
    if (remainingStdout) {
      this.stdoutBuffer += remainingStdout
    }
    if (this.stdoutBuffer.trim()) {
      const lines = this.stdoutBuffer.split('\n')
      this.stdoutBuffer = ''
      for (const rawLine of lines) {
        const line = rawLine.trim()
        if (!line) continue
        this.processStdoutLine(line)
      }
    }

    const remainingStderr = this.stderrDecoder.end()
    if (remainingStderr) {
      this.stderrBuffer += remainingStderr
    }
    if (this.stderrBuffer.trim()) {
      const lines = this.stderrBuffer.split('\n')
      this.stderrBuffer = ''
      for (const rawLine of lines) {
        const line = rawLine.trim()
        if (!line) continue
        this.processStderrLine(line)
      }
    }
  }

  private handleStdoutData(chunk: Buffer | string): void {
    let textChunk = typeof chunk === 'string' ? chunk : this.stdoutDecoder.write(chunk)

    if (this.stdoutDiscardingUntilNewline) {
      const newlineIndex = textChunk.indexOf('\n')
      if (newlineIndex === -1) {
        return
      }
      textChunk = textChunk.slice(newlineIndex + 1)
      this.stdoutDiscardingUntilNewline = false
    }

    this.stdoutBuffer += textChunk
    const lines = this.stdoutBuffer.split('\n')
    const remainder = lines.pop() || ''
    const maxBuffer = this.options.maxLineBufferBytes ?? DEFAULT_MAX_LINE_BUFFER_BYTES

    if (Buffer.byteLength(remainder, 'utf8') > maxBuffer) {
      console.warn(`CodexAdapter stdout line buffer exceeded ${maxBuffer} bytes, discarding line remainder`)
      this.stdoutBuffer = ''
      this.stdoutDiscardingUntilNewline = true
    } else {
      this.stdoutBuffer = remainder
    }

    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line) continue
      if (Buffer.byteLength(rawLine, 'utf8') > maxBuffer) {
        console.warn(`CodexAdapter: oversized line discarded (${Buffer.byteLength(rawLine, 'utf8')} bytes)`)
        continue
      }
      this.processStdoutLine(line)
    }
  }

  private handleStderrData(chunk: Buffer | string): void {
    let textChunk = typeof chunk === 'string' ? chunk : this.stderrDecoder.write(chunk)

    if (this.stderrDiscardingUntilNewline) {
      const newlineIndex = textChunk.indexOf('\n')
      if (newlineIndex === -1) {
        return
      }
      textChunk = textChunk.slice(newlineIndex + 1)
      this.stderrDiscardingUntilNewline = false
    }

    this.stderrBuffer += textChunk
    const lines = this.stderrBuffer.split('\n')
    const remainder = lines.pop() || ''
    const maxBuffer = this.options.maxLineBufferBytes ?? DEFAULT_MAX_LINE_BUFFER_BYTES

    if (Buffer.byteLength(remainder, 'utf8') > maxBuffer) {
      console.warn(`CodexAdapter stderr line buffer exceeded ${maxBuffer} bytes, discarding line remainder`)
      this.stderrBuffer = ''
      this.stderrDiscardingUntilNewline = true
    } else {
      this.stderrBuffer = remainder
    }

    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line) continue
      if (Buffer.byteLength(rawLine, 'utf8') > maxBuffer) {
        console.warn(`CodexAdapter: oversized stderr line discarded`)
        continue
      }
      this.processStderrLine(line)
    }
  }

  private processIncomingJsonRpc(message: JsonRpcMessage): void {
    // 1. JSON-RPC Response to client's request
    if (message.id !== undefined && (message.result !== undefined || message.error !== undefined)) {
      const pending = this.pendingRequests.get(message.id)
      if (pending) {
        this.pendingRequests.delete(message.id)
        if (message.error) {
          pending.reject(
            new CodexRpcRejectedError(pending.method, message.error.message || JSON.stringify(message.error), message.error.code)
          )
        } else {
          pending.resolve(message.result)
        }
      }
      return
    }

    // 2. Inbound Server Request (requires client response)
    if (message.id !== undefined && message.method) {
      this.handleServerRequest(message.id, message.method, (message.params || {}) as ApprovalRequestParams)
      return
    }

    // 3. Inbound Server Notification
    if (message.method) {
      this.handleServerNotification(message.method, (message.params || {}) as ItemNotificationParams)
    }
  }

  private handleServerRequest(
    id: number | string,
    method: string,
    params: ApprovalRequestParams
  ): void {
    if (params.threadId && params.threadId !== this.threadId) return
    const turnId = params.turnId || this.activeTurnId || this.startingTurn?.turnId
    const expectedTurnId = this.activeTurnId || this.startingTurn?.turnId
    if (turnId && (this.completedTurnIds.has(turnId) || (expectedTurnId && expectedTurnId !== turnId))) return
    if (
      method === 'item/commandExecution/requestApproval' ||
      method === 'item/fileChange/requestApproval' ||
      method === 'item/permissions/requestApproval' ||
      method === 'execCommandApproval' ||
      method === 'applyPatchApproval'
    ) {
      if (this.startingTurn) {
        this.startingTurn.observedActivity = true
        if (turnId) this.startingTurn.turnId = turnId
      }
      const rawApprovalId = params.approvalId || `approval-${id}`
      const approvalId = `${this.options.taskId}-${this.options.runId}-gen${this.processGeneration}-${rawApprovalId}`
      this.pendingApprovals.set(approvalId, {
        rpcId: id,
        approvalId,
        method,
        params: params as unknown as Record<string, unknown>,
        turnId,
      })

      // Emit permission.requested
      this.emitEvent({
        eventId: this.createEventId('perm'),
        taskId: this.options.taskId,
        runId: this.options.runId,
        timestamp: Date.now(),
        type: 'permission.requested',
        turnId,
        approvalId,
        command: params.command,
        toolCallId: params.itemId,
        description: params.reason,
        decisionOptions: ['allow', 'deny'],
      } as PermissionRequestedEvent)

      // Emit agent waiting for approval status
      this.emitEvent({
        eventId: this.createEventId('status-wait'),
        taskId: this.options.taskId,
        runId: this.options.runId,
        timestamp: Date.now(),
        type: 'agent.status.changed',
        scope: 'turn',
        turnId,
        status: 'waiting_for_approval',
      } as AgentStatusChangedEvent)
    }
  }

  private handleServerNotification(method: string, params: ItemNotificationParams): void {
    if (params.threadId && params.threadId !== this.threadId) return
    const notificationTurnId = params.turn?.id || params.turnId || this.activeTurnId
    if (this.startingTurn && method.startsWith('item/') && notificationTurnId && this.matchesCurrentTurn(notificationTurnId)) {
      this.startingTurn.observedActivity = true
    }
    switch (method) {
      case 'turn/started': {
        const turnId = params.turn?.id || params.turnId
        if (!turnId || !this.matchesCurrentTurn(turnId) || this.isStopped || this.isStopping) break
        if (this.startingTurn) this.startingTurn.turnId = turnId
        this.activeTurnId = turnId
        this.emitEvent({
          eventId: this.createEventId('turn-start'),
          taskId: this.options.taskId,
          runId: this.options.runId,
          timestamp: Date.now(),
          type: 'agent.status.changed',
          scope: 'turn',
          turnId,
          status: Array.from(this.pendingApprovals.values()).some((pending) => pending.turnId === turnId)
            ? 'waiting_for_approval'
            : 'running',
        } as AgentStatusChangedEvent)
        break
      }

      case 'turn/completed': {
        const turnId = params.turn?.id || params.turnId
        // A stale/duplicate completion cannot release the next turn's send lock
        // or change its status. Identity is mandatory for lifecycle transitions.
        if (!turnId || !this.matchesCurrentTurn(turnId)) break
        if (this.startingTurn) this.startingTurn.turnId = turnId
        this.completedTurnIds.add(turnId)
        this.expireTurnApprovals(turnId)
        if (this.activeTurnId === turnId) this.activeTurnId = undefined

        const rawStatus = params.turn?.status || params.status
        const turnError = params.turn?.error || params.error
        let finalStatus: AgentRunStatus = 'completed'
        if (rawStatus === 'failed' || rawStatus === 'error' || Boolean(turnError)) {
          finalStatus = 'error'
        } else if (rawStatus === 'interrupted' || rawStatus === 'cancelled' || rawStatus === 'stopped') {
          finalStatus = 'stopped'
        }

        this.emitEvent({
          eventId: this.createEventId('turn-cmpl'),
          taskId: this.options.taskId,
          runId: this.options.runId,
          timestamp: Date.now(),
          type: 'agent.status.changed',
          scope: 'turn',
          turnId,
          status: finalStatus,
          error: turnError ? (typeof turnError === 'string' ? turnError : JSON.stringify(turnError)) : undefined,
        } as AgentStatusChangedEvent)
        break
      }

      case 'item/started': {
        const item: Partial<ThreadItemPayload> = params.item || {}
        if (item.type === 'agentMessage' || item.type === 'reasoning') {
          this.emitEvent({
            eventId: this.createEventId('msg-start'),
            taskId: this.options.taskId,
            runId: this.options.runId,
            timestamp: Date.now(),
            type: 'message.started',
            turnId: notificationTurnId,
            messageId: item.id || params.itemId || this.createEventId('msg'),
            role: 'assistant',
          } as MessageStartedEvent)
        } else if (
          item.type === 'commandExecution' ||
          item.type === 'dynamicToolCall' ||
          item.type === 'mcpToolCall' ||
          item.type === 'fileChange'
        ) {
          const toolName =
            item.type === 'commandExecution'
              ? 'command_exec'
              : item.type === 'fileChange'
                ? 'file_change'
                : item.type === 'mcpToolCall'
                  ? `${item.server}/${item.tool}`
                  : item.tool || 'dynamic_tool'

          this.emitEvent({
            eventId: this.createEventId('tool-start'),
            taskId: this.options.taskId,
            runId: this.options.runId,
            timestamp: Date.now(),
            type: 'tool.started',
            toolCallId: item.id || params.itemId || this.createEventId('tool'),
            toolName,
            input:
              item.type === 'commandExecution'
                ? { command: item.command, cwd: item.cwd }
                : item.type === 'fileChange'
                  ? { changes: item.changes }
                  : item.arguments,
            turnId: notificationTurnId,
          } as ToolStartedEvent)
        }
        break
      }

      case 'item/agentMessage/delta': {
        if (params.delta && params.itemId) {
          this.emitEvent({
            eventId: this.createEventId('msg-delta'),
            taskId: this.options.taskId,
            runId: this.options.runId,
            timestamp: Date.now(),
            type: 'message.delta',
            turnId: notificationTurnId,
            messageId: params.itemId,
            deltaType: 'text',
            content: params.delta,
          } as MessageDeltaEvent)
        }
        break
      }

      case 'item/reasoning/textDelta':
      case 'item/reasoning/summaryTextDelta': {
        if (params.delta && params.itemId) {
          this.emitEvent({
            eventId: this.createEventId('rsn-delta'),
            taskId: this.options.taskId,
            runId: this.options.runId,
            timestamp: Date.now(),
            type: 'message.delta',
            turnId: notificationTurnId,
            messageId: params.itemId,
            deltaType: 'thinking',
            content: params.delta,
          } as MessageDeltaEvent)
        }
        break
      }

      case 'item/commandExecution/outputDelta': {
        if (params.delta && params.itemId) {
          this.emitEvent({
            eventId: this.createEventId('tool-delta'),
            taskId: this.options.taskId,
            runId: this.options.runId,
            timestamp: Date.now(),
            type: 'tool.output.delta',
            turnId: notificationTurnId,
            toolCallId: params.itemId,
            delta: params.delta,
          } as ToolOutputDeltaEvent)
        }
        break
      }

      case 'item/completed': {
        const item: Partial<ThreadItemPayload> = params.item || {}
        if (item.type === 'agentMessage') {
          this.emitEvent({
            eventId: this.createEventId('msg-end'),
            taskId: this.options.taskId,
            runId: this.options.runId,
            timestamp: Date.now(),
            type: 'message.completed',
            turnId: notificationTurnId,
            messageId: item.id || params.itemId || this.createEventId('msg'),
            fullContent: item.text,
            finishReason: 'stop',
          } as MessageCompletedEvent)
        } else if (item.type === 'reasoning') {
          const parts = item.content?.length ? item.content : item.summary
          const content = parts?.map(part => typeof part === 'string' ? part : part.text ?? '').join('')
          this.emitEvent({
            eventId: this.createEventId('rsn-end'),
            taskId: this.options.taskId,
            runId: this.options.runId,
            timestamp: Date.now(),
            type: 'message.completed',
            turnId: notificationTurnId,
            messageId: item.id || params.itemId || this.createEventId('msg'),
            fullContent: content,
            contentType: 'thinking',
            finishReason: 'stop',
          } as MessageCompletedEvent)
        } else if (
          item.type === 'commandExecution' ||
          item.type === 'dynamicToolCall' ||
          item.type === 'mcpToolCall' ||
          item.type === 'fileChange'
        ) {
          const isError =
            item.type === 'commandExecution'
              ? item.exitCode !== 0
              : item.type === 'fileChange'
                ? item.status === 'failed'
                : item.status === 'failed' || item.success === false

          this.emitEvent({
            eventId: this.createEventId('tool-end'),
            taskId: this.options.taskId,
            runId: this.options.runId,
            timestamp: Date.now(),
            type: 'tool.completed',
            turnId: notificationTurnId,
            toolCallId: item.id || params.itemId || this.createEventId('tool'),
            exitCode: item.exitCode ?? (isError ? 1 : 0),
            output:
              item.aggregatedOutput ??
              item.output ??
              item.result ??
              item.changes ??
              item.contentItems,
            isError,
          } as ToolCompletedEvent)
        }
        break
      }

      case 'error': {
        if (notificationTurnId && !this.matchesCurrentTurn(notificationTurnId)) break
        this.emitEvent({
          eventId: this.createEventId('err'),
          taskId: this.options.taskId,
          runId: this.options.runId,
          timestamp: Date.now(),
          type: 'agent.status.changed',
          scope: notificationTurnId || this.startingTurn ? 'turn' : 'session',
          turnId: notificationTurnId,
          status: 'error',
          error: params.message || JSON.stringify(params),
        } as AgentStatusChangedEvent)
        break
      }
    }
  }

  private matchesCurrentTurn(turnId: string): boolean {
    if (this.completedTurnIds.has(turnId)) return false
    const expectedTurnId = this.activeTurnId || this.startingTurn?.turnId
    return expectedTurnId ? expectedTurnId === turnId : Boolean(this.startingTurn)
  }

  private expireTurnApprovals(turnId: string): void {
    for (const [approvalId, pending] of this.pendingApprovals) {
      if (pending.turnId !== turnId) continue
      this.pendingApprovals.delete(approvalId)
      this.emitEvent({
        eventId: this.createEventId('appr-expired'),
        taskId: this.options.taskId,
        runId: this.options.runId,
        timestamp: Date.now(),
        type: 'permission.state.changed',
        turnId,
        approvalId,
        state: 'expired',
      })
    }
  }

  private emitEvent(event: AgentEvent): void {
    if (event.type === 'agent.status.changed') {
      event.scope ??= 'session'
      // Buffered turn records may arrive after a crash but before stream close.
      // They keep their own outcome without reviving the failed session state.
      if (event.scope === 'session' || this.currentStatus !== 'error' || !this.childProcess || !this.isProcessExited(this.childProcess)) {
        this.currentStatus = event.status
      }
    }
    try {
      this.options.onEvent?.(event)
    } catch (err) {
      console.error('Error in CodexAdapter onEvent callback:', err)
    }
  }

  private rejectAllPending(error: Error): void {
    for (const [id, pending] of this.pendingRequests.entries()) {
      pending.reject(error)
      this.pendingRequests.delete(id)
    }
  }

  private createEventId(prefix: string): string {
    return `evt-${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
  }
}
