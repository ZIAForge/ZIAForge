import { validateReasoningEffort } from '../runtime/AgentExecutionPolicy'
/**
 * AntigravityAdapter
 *
 * Implements the streaming execution adapter for Google Antigravity CLI (agy)
 * via `--input-format stream-json --output-format stream-json`.
 *
 * Emits typed AgentEvent events (message.started, message.delta, message.completed,
 * tool.started, tool.completed, agent.status.changed, raw.log) directly into ZIAForge's
 * EventJournal without screen scraping.
 */

import { spawn, ChildProcess, SpawnOptions } from 'child_process'
import { StringDecoder } from 'string_decoder'
import * as path from 'path'
import * as fs from 'fs'
import { ProcessSupervisor } from '../runtime/ProcessSupervisor'
import {
  AgentEvent,
  AgentStatusChangedEvent,
  MessageStartedEvent,
  MessageDeltaEvent,
  MessageCompletedEvent,
  ToolStartedEvent,
  ToolCompletedEvent,
  RawLogEvent,
  ApprovalDecision,
} from '../../shared/agent-events'
import {
  SendPromptRequest,
  AgentRunStatus,
  ResolveApprovalRequest,
  AgentProviderType,
} from '../../shared/agent-commands'

export interface AntigravityAdapterOptions {
  taskId: string
  runId: string
  worktreePath: string
  agyBinPath?: string
  reasoningEffort?: string | null
  model?: string
  /** CLI-native policy; neither choice promises a read-only filesystem. */
  permissionMode?: 'cli-settings' | 'dangerously-skip'
  /** Native planning mode for Help; this is not a universal filesystem boundary. */
  mode?: 'plan'
  conversationId?: string
  env?: Record<string, string | undefined>
  supervisor?: ProcessSupervisor
  startupTimeoutMs?: number
  stdinWriteTimeoutMs?: number
  interruptTimeoutMs?: number
  killTimeoutMs?: number
  maxTurnBufferBytes?: number
  maxTrackedRecords?: number
  emitRawLogEvents?: boolean
  maxLineBufferBytes?: number
  onEvent?: (event: AgentEvent) => void
  onRawLog?: (stream: 'stdout' | 'stderr', line: string) => void
  spawnProcess?: (command: string, args: string[], options: SpawnOptions) => ChildProcess
}

export interface AntigravityCapabilities {
  textStreaming: boolean
  toolCalls: boolean
  thinkingStreaming: boolean
  toolOutputStreaming: boolean
  interactiveApprovals: boolean
  attachments: boolean
}

interface GenerationContext {
  generation: number
  proc: ChildProcess
  retired: boolean
  ready: boolean
  onReady?: () => void
  conversationId?: string
  stdoutDecoder: StringDecoder
  stderrDecoder: StringDecoder
  stdoutBuffer: string
  stderrBuffer: string
  stdoutDiscardingUntilNewline: boolean
  stderrDiscardingUntilNewline: boolean
  activeTurnId?: string
  activeMessageId?: string
  messageStartedEmitted: boolean
  turnAccumulatedText: string
  activeStepTools: Map<number, string>
  startedToolSteps: Set<number>
  completedToolSteps: Set<number>
  pendingWrites: Set<(error: Error) => void>
  ownershipTimer?: NodeJS.Timeout
  terminationPromise?: Promise<void>
  interruptRequested?: boolean
  interruptConfirmed?: boolean
  interruptTimer?: NodeJS.Timeout
}

const DEFAULT_MAX_LINE_BUFFER_BYTES = 1 * 1024 * 1024 // 1 MB

export class AntigravityAdapter {
  private options: AntigravityAdapterOptions
  private supervisor: ProcessSupervisor
  private activeGen?: GenerationContext
  private processGeneration = 0
  private turnCounter = 0
  private eventCounter = 0
  private isStopped = false
  private isStopping = false
  private currentStatus: AgentRunStatus = 'idle'
  private finalizingTurn = false
  private startingPromise?: Promise<{ pid: number; conversationId?: string }>
  private rejectStartup?: (err: Error) => void
  private readonly workspaceIdentity: { dev: number; ino: number }

  private readonly capabilities: AntigravityCapabilities = {
    textStreaming: true,
    toolCalls: true,
    thinkingStreaming: false,
    toolOutputStreaming: false,
    interactiveApprovals: false,
    attachments: false,
  }

  constructor(options: AntigravityAdapterOptions) {
    validateReasoningEffort('antigravity', options.reasoningEffort)
    this.supervisor = options.supervisor ?? new ProcessSupervisor()
    if (options.permissionMode !== undefined && !['cli-settings', 'dangerously-skip'].includes(options.permissionMode)) {
      throw new Error('Unsupported Antigravity permission policy; read-only and workspace-write are not enforced by this CLI transport')
    }
    if (options.conversationId !== undefined && !/^[a-zA-Z0-9_-]{1,200}$/.test(options.conversationId)) {
      throw new Error('Invalid Antigravity conversation identifier')
    }
    const workspace = this.readWorkspace(options.worktreePath)
    this.workspaceIdentity = { dev: workspace.stat.dev, ino: workspace.stat.ino }
    this.options = {
      ...options,
      worktreePath: workspace.canonical,
      agyBinPath: options.agyBinPath || 'agy',
      maxLineBufferBytes: options.maxLineBufferBytes ?? DEFAULT_MAX_LINE_BUFFER_BYTES,
    }
  }

  private readWorkspace(directory: string): { canonical: string; stat: fs.Stats } {
    if (typeof directory !== 'string' || !path.isAbsolute(directory) || directory.includes('\0')) {
      throw new Error('Antigravity workspace must be an absolute existing directory')
    }
    try {
      const normalized = path.resolve(directory)
      const direct = fs.lstatSync(normalized)
      if (!direct.isDirectory() || direct.isSymbolicLink()) throw new Error('Not a directory')
      const canonical = fs.realpathSync(normalized)
      const stat = fs.statSync(canonical)
      if (!stat.isDirectory()) throw new Error('Not a directory')
      return { canonical, stat }
    } catch {
      throw new Error('Antigravity workspace is missing, inaccessible or is not a real directory')
    }
  }

  private assertWorkspace(directory = this.options.worktreePath): void {
    const workspace = this.readWorkspace(directory)
    if (workspace.canonical !== this.options.worktreePath || workspace.stat.dev !== this.workspaceIdentity.dev || workspace.stat.ino !== this.workspaceIdentity.ino) {
      throw new Error('Antigravity workspace does not match the saved task directory; restore the workspace before continuing')
    }
  }

  getCapabilities(): AntigravityCapabilities {
    return { ...this.capabilities }
  }

  getConversationId(): string | undefined {
    return this.activeGen?.conversationId ?? this.options.conversationId
  }

  getActiveTurnId(): string | undefined {
    return this.activeGen?.activeTurnId
  }

  getPid(): number | undefined {
    return this.activeGen?.proc.pid
  }

  getCurrentStatus(): AgentRunStatus {
    return this.currentStatus
  }

  getStatus(): AgentRunStatus {
    return this.currentStatus
  }

  getSessionId(): string | undefined {
    return this.getConversationId()
  }

  getProvider(): AgentProviderType {
    return 'antigravity'
  }

  getTaskId(): string {
    return this.options.taskId
  }

  getRunId(): string {
    return this.options.runId
  }

  /**
   * Spawns the agy process with stream-json flags and installs generation-isolated listeners.
   * Confirms process startup via the 'spawn' event or early error rejection.
   */
  async start(): Promise<{ pid: number; conversationId?: string }> {
    if (this.isStopped || this.isStopping) {
      throw new Error('Cannot start AntigravityAdapter: adapter has been stopped')
    }
    this.assertWorkspace()

    if (this.startingPromise) {
      return this.startingPromise
    }

    // If an existing generation is still active and not retired, deduplicate
    if (
      this.currentStatus !== 'error' &&
      this.activeGen?.ready &&
      !this.activeGen.retired &&
      !this.isProcessExited(this.activeGen.proc)
    ) {
      return Promise.resolve({
        pid: this.activeGen.proc.pid ?? -1,
        conversationId: this.activeGen.conversationId,
      })
    }

    const startTask = async (): Promise<{ pid: number; conversationId?: string }> => {
      // If previous process was retired but hasn't fully terminated, block until terminated to prevent zombies
      if (this.activeGen && !this.isProcessExited(this.activeGen.proc)) {
        await this.terminateGenerationProcess(this.activeGen, true)
      }

      if (this.isStopped || this.isStopping) {
        throw new Error('Cannot start AntigravityAdapter: adapter has been stopped')
      }
      this.assertWorkspace()

      return new Promise<{ pid: number; conversationId?: string }>((resolve, reject) => {
        let isSettled = false

        this.rejectStartup = (err: Error) => {
          if (!isSettled) {
            isSettled = true
            clearTimeout(startupTimer)
            this.rejectStartup = undefined
            if (this.activeGen) {
              this.currentStatus = 'error'
              this.finalizeActiveTurnOnTermination(this.activeGen, 'error', err.message)
              this.retireGeneration(this.activeGen, err)
            }
            reject(err)
          }
        }

        if (this.activeGen) {
          this.finalizeActiveTurnOnTermination(
            this.activeGen,
            'interrupted',
            'Previous process replaced by new start()'
          )
          this.retireGeneration(this.activeGen, new Error('Previous process replaced by new start()'))
        }

        const spawnFn = this.options.spawnProcess || spawn
      // agy 1.2.7 selects default-cli-project independently of process.cwd.
      // --add-dir binds this conversation's actual workspace, also on resume.
      const spawnArgs = ['--input-format', 'stream-json', '--output-format', 'stream-json', '--disable-slash-commands', '--add-dir', this.options.worktreePath]
      if (this.options.reasoningEffort != null) spawnArgs.push('--effort', this.options.reasoningEffort)
      if (this.options.mode) spawnArgs.push('--mode', this.options.mode)
      spawnArgs.push(this.options.permissionMode === 'dangerously-skip' ? '--dangerously-skip-permissions' : '--sandbox')
      if (this.options.conversationId) spawnArgs.push('--conversation', this.options.conversationId)
      if (this.options.model) {
        spawnArgs.push('--model', this.options.model)
      }

      const currentGenIndex = ++this.processGeneration

      let proc: ChildProcess
      try {
        proc = spawnFn(this.options.agyBinPath!, spawnArgs, {
          cwd: this.options.worktreePath,
          stdio: ['pipe', 'pipe', 'pipe'],
          env: {
            ...(this.options.env ?? process.env),
            PWD: this.options.worktreePath,
            CI: 'true',
          },
        })
      } catch (err) {
        isSettled = true
        this.rejectStartup = undefined
        reject(err)
        return
      }

      const gen: GenerationContext = {
        generation: currentGenIndex,
        proc,
        retired: false,
        ready: false,
        stdoutDecoder: new StringDecoder('utf8'),
        stderrDecoder: new StringDecoder('utf8'),
        stdoutBuffer: '',
        stderrBuffer: '',
        stdoutDiscardingUntilNewline: false,
        stderrDiscardingUntilNewline: false,
        messageStartedEmitted: false,
        turnAccumulatedText: '',
        activeStepTools: new Map(),
        startedToolSteps: new Set(),
        completedToolSteps: new Set(),
        pendingWrites: new Set(),
      }

      this.activeGen = gen

      const onReady = () => {
        if (isSettled) return
        if (this.isStopped || this.isStopping) {
          onSpawnFailure(new Error('Cannot start AntigravityAdapter: adapter was stopped during startup'))
          return
        }
        try { if (proc.pid) this.supervisor.trackProcessTree(proc.pid) }
        catch (error) { onSpawnFailure(error instanceof Error ? error : new Error(String(error))); return }
        isSettled = true
        clearTimeout(startupTimer)
        this.rejectStartup = undefined
        gen.ready = true
        this.currentStatus = 'running'
        if (proc.pid) {
          gen.ownershipTimer = setInterval(() => {
            if (this.isProcessExited(proc)) return
            try { this.supervisor.trackProcessTree(proc.pid!) }
            catch (error) {
              clearInterval(gen.ownershipTimer)
              if (!gen.retired) this.handleProcessError(gen, error instanceof Error ? error : new Error(String(error)))
            }
          }, 250)
          gen.ownershipTimer.unref?.()
        }
          this.emitEvent({
            eventId: this.createEventId('status-ready'),
            taskId: this.options.taskId,
            runId: this.options.runId,
            timestamp: Date.now(),
            type: 'agent.status.changed',
            status: 'running',
            scope: 'session',
          } as AgentStatusChangedEvent)
        resolve({ pid: proc.pid ?? -1, conversationId: gen.conversationId })
      }

      const onSpawnFailure = (err: Error) => {
        if (isSettled) return
        isSettled = true
        clearTimeout(startupTimer)
        this.rejectStartup = undefined
        this.currentStatus = 'error'
        this.finalizeActiveTurnOnTermination(gen, 'error', err.message)
        this.retireGeneration(gen, err)
        reject(err)
      }

      gen.onReady = onReady
      const startupTimer = setTimeout(() => onSpawnFailure(new Error('Antigravity initialization timed out before an init event')), this.options.startupTimeoutMs ?? 15_000)
      startupTimer.unref?.()

      // Persistent process error handler (covers both startup failure and runtime crashes)
      proc.on('error', (err) => {
        if (!isSettled) {
          onSpawnFailure(err)
        } else {
          if (gen.retired || this.activeGen !== gen) return
          this.handleProcessError(gen, err)
        }
      })

      proc.stdin?.on?.('error', (err) => {
        if (gen.retired || this.activeGen !== gen) return
        if (!isSettled) onSpawnFailure(err)
        else this.handleProcessError(gen, err)
      })

      proc.stdout?.on('error', (err) => {
        if (gen.retired || this.activeGen !== gen) return
        if (!isSettled) onSpawnFailure(err)
        else this.handleProcessError(gen, err)
      })

      proc.stderr?.on('error', (err) => {
        if (gen.retired || this.activeGen !== gen) return
        if (!isSettled) onSpawnFailure(err)
        else this.handleProcessError(gen, err)
      })

      proc.stdout?.on('data', (chunk: Buffer | string) => {
        if (gen.retired || this.activeGen !== gen) return
        this.handleStdoutData(gen, chunk)
      })

      proc.stderr?.on('data', (chunk: Buffer | string) => {
        if (gen.retired || this.activeGen !== gen) return
        this.handleStderrData(gen, chunk)
      })

      // On process close, wait for stdio streams to drain completely
      let closeHandled = false
      const onProcessClose = (code: number | null, signal: string | null) => {
        if (!isSettled) {
          onSpawnFailure(new Error(`Antigravity exited before initialization (code ${code}, signal ${signal})`))
          return
        }
        if (closeHandled || gen.retired || this.activeGen !== gen) return
        closeHandled = true

        this.flushBuffers(gen)
        if (gen.retired || this.activeGen !== gen) return
        clearTimeout(gen.interruptTimer)
        if (gen.interruptRequested && gen.interruptConfirmed && !this.isStopping && !this.isStopped) {
          // agy acknowledges SIGINT, drains its result, then exits. Resume only
          // after that close and verified cleanup, never into the dying stdin.
          this.retireGeneration(gen, new Error('Antigravity turn interrupted'))
          void this.terminateGenerationProcess(gen, false).then(async () => {
            if (this.isStopped || this.isStopping) return
            await this.start()
          }).catch(error => {
            if (this.isStopped || this.isStopping) return
            this.currentStatus = 'error'
            this.emitEvent({ eventId: this.createEventId('resume-error'), taskId: this.options.taskId, runId: this.options.runId, timestamp: Date.now(), type: 'agent.status.changed', scope: 'session', status: 'error', error: `Antigravity could not resume after interruption: ${error instanceof Error ? error.message : String(error)}` })
          })
          return
        }
        this.finalizeActiveTurnOnTermination(
          gen,
          'error',
          `Antigravity process terminated with code ${code}, signal ${signal}`
        )

        // Deduplicate terminal error status emission
        if (this.currentStatus !== 'error' && this.currentStatus !== 'stopped') {
          this.currentStatus = 'error'
          this.emitEvent({
            eventId: this.createEventId('err-close'),
            taskId: this.options.taskId,
            runId: this.options.runId,
            timestamp: Date.now(),
            type: 'agent.status.changed',
            status: 'error',
            scope: 'session',
            error: `Process terminated unexpectedly with code ${code}, signal ${signal}`,
          } as AgentStatusChangedEvent)
        }

        this.retireGeneration(
          gen,
          new Error(`Antigravity process exited with code ${code}, signal ${signal}`)
        )
      }

      // Respect actual stream closure; close fires only after stdio has finished draining
      proc.once('close', (code, signal) => onProcessClose(code, signal))
    })
  }

  const promise = startTask()
  this.startingPromise = promise

  try {
    return await promise
  } finally {
    if (this.startingPromise === promise) {
      this.startingPromise = undefined
    }
  }
}

  /**
   * Submits a prompt to Antigravity CLI over stream-json stdin.
   * Format: {"event":"user","message":{"content":"..."}}\n
   */
  async sendPrompt(request: SendPromptRequest): Promise<{ turnId: string }> {
    if (this.isStopped || this.isStopping || !this.activeGen?.ready || this.activeGen.retired || this.activeGen.interruptRequested) {
      throw new Error('Cannot send prompt: adapter is not started or has stopped')
    }

    if (this.currentStatus === 'error') {
      throw new Error('Cannot send prompt: adapter is in error state. Start a new session or restart adapter.')
    }

    const gen = this.activeGen
    try { this.assertWorkspace() }
    catch (error) {
      const failure = error instanceof Error ? error : new Error(String(error))
      this.handleProcessError(gen, failure)
      throw failure
    }

    if (gen.activeTurnId || this.finalizingTurn) {
      throw new Error('Cannot send prompt: a turn is already in progress (adapter is busy)')
    }

    if (request.attachments && request.attachments.length > 0) {
      throw new Error('Attachments are not supported in stream-json mode')
    }
    if (typeof request.text !== 'string' || !request.text.trim()) throw new Error('A non-empty text prompt is required')
    if (Buffer.byteLength(request.text, 'utf8') > (this.options.maxTurnBufferBytes ?? 8 * 1024 * 1024)) throw new Error('Antigravity prompt exceeds the turn size limit')

    const turnId = `${this.options.taskId}-${this.options.runId}-g${gen.generation}-turn-${++this.turnCounter}`
    const messageId = `${turnId}-assistant`

    gen.activeTurnId = turnId
    gen.activeMessageId = messageId
    gen.messageStartedEmitted = false
    gen.turnAccumulatedText = ''
    gen.activeStepTools.clear()
    gen.startedToolSteps.clear()
    gen.completedToolSteps.clear()

    this.currentStatus = 'running'
      this.emitEvent({
        eventId: this.createEventId('status'),
        taskId: this.options.taskId,
        runId: this.options.runId,
        timestamp: Date.now(),
        type: 'agent.status.changed',
        status: 'running',
        scope: 'turn',
        turnId,
      } as AgentStatusChangedEvent)

    const payload = {
      event: 'user',
      message: {
        content: request.text,
      },
    }

    try {
      await this.writeLineToStdin(gen, JSON.stringify(payload))
    } catch (writeErr) {
      if (gen.retired) throw writeErr
      const errMsg = writeErr instanceof Error ? writeErr.message : String(writeErr)
      this.currentStatus = 'error'
      this.finalizeActiveTurnOnTermination(gen, 'error', errMsg)
      this.retireGeneration(
        gen,
        writeErr instanceof Error ? writeErr : new Error(String(writeErr))
      )
      throw writeErr
    }

    if (this.activeGen !== gen || gen.retired) {
      throw new Error('Process retired while submitting prompt')
    }

    return { turnId }
  }

  /**
   * Native SIGINT cancels the current turn. agy exits after its terminal result;
   * the close handler resumes the same native conversation before accepting input.
   */
  async interruptTurn(turnId: string): Promise<{ turnId: string }> {
    const gen = this.activeGen
    if (this.isStopped || this.isStopping || !gen?.ready || gen.retired || !gen.activeTurnId || gen.activeTurnId !== turnId) throw new Error('Unknown or stale Antigravity turn')
    if (gen.interruptRequested) return { turnId }
    if (!gen.conversationId) throw new Error('Antigravity conversation identity is unavailable')
    gen.interruptRequested = true
    this.currentStatus = 'starting'
    this.emitEvent({ eventId: this.createEventId('interrupt-restart'), taskId: this.options.taskId, runId: this.options.runId, timestamp: Date.now(), type: 'agent.status.changed', scope: 'session', status: 'starting' })
    if (this.isStopped || this.isStopping || gen.retired || this.activeGen !== gen) throw new Error('Antigravity interruption was cancelled during shutdown')
    gen.interruptTimer = setTimeout(() => {
      if (this.activeGen === gen && !gen.retired && !this.isStopping && !this.isStopped) this.handleProcessError(gen, new Error('Antigravity did not finish its native interruption in time; resume the conversation to continue'))
    }, this.options.interruptTimeoutMs ?? 10_000)
    gen.interruptTimer.unref?.()
    try {
      if (!gen.proc.kill('SIGINT')) throw new Error('Antigravity did not accept the interrupt signal')
    } catch (error) {
      this.handleProcessError(gen, error instanceof Error ? error : new Error(String(error)))
      throw error
    }
    return { turnId }
  }

  /**
   * Antigravity CLI does not support interactive approvals via stream-json.
   * Rejects immediately.
   */
  async resolveApproval(
    _approvalIdOrRequest: string | ResolveApprovalRequest,
    _decision?: ApprovalDecision | string,
    _note?: string
  ): Promise<void> {
    void _approvalIdOrRequest
    void _decision
    void _note
    throw new Error('Interactive approvals are not supported by Antigravity CLI stream-json')
  }

  /**
   * Stops the adapter, terminating active processes and emitting completion/cancellation events.
   * Supports force escalation and allows retry on failure.
   */
  async stop(force = false): Promise<void> {
    if (this.isStopped && !force) return
    this.isStopping = true

    if (this.rejectStartup) {
      this.rejectStartup(new Error('Cannot start AntigravityAdapter: adapter was stopped during startup'))
      this.rejectStartup = undefined
    }

    const gen = this.activeGen
    if (gen) {
      this.flushBuffers(gen)
      this.finalizeActiveTurnOnTermination(gen, 'interrupted', 'Adapter was stopped by user')
      this.retireGeneration(gen, new Error('AntigravityAdapter stopped'))
      try {
        await this.terminateGenerationProcess(gen, force)
      } catch (err) {
        this.isStopping = false
        throw err
      }
    }

    this.isStopped = true
    this.currentStatus = 'stopped'
    this.isStopping = false
    this.emitEvent({ eventId: this.createEventId('session-stopped'), taskId: this.options.taskId, runId: this.options.runId, timestamp: Date.now(), type: 'agent.status.changed', status: 'stopped', scope: 'session' })
  }

  private retireGeneration(gen: GenerationContext, _error: Error): void {
    gen.retired = true
    clearTimeout(gen.interruptTimer)
    for (const reject of [...gen.pendingWrites]) reject(_error)

    const proc = gen.proc
    proc.stdout?.removeAllListeners?.('data')
    proc.stderr?.removeAllListeners?.('data')

    if (!this.isStopping && !this.isStopped) {
      void this.terminateGenerationProcess(gen, false).catch(() => {})
    }
  }

  private handleProcessError(gen: GenerationContext, err: Error): void {
    const isNewError = this.currentStatus !== 'error'
    this.currentStatus = 'error'
    this.finalizeActiveTurnOnTermination(gen, 'error', err.message)
    this.retireGeneration(gen, err)

    if (isNewError) {
      this.emitEvent({
        eventId: this.createEventId('err-runtime'),
        taskId: this.options.taskId,
        runId: this.options.runId,
        timestamp: Date.now(),
        type: 'agent.status.changed',
        status: 'error',
        scope: 'session',
        error: err.message,
      } as AgentStatusChangedEvent)
    }
  }

  private finalizeActiveTurnOnTermination(
    gen: GenerationContext,
    finishReason: 'error' | 'interrupted',
    errorMessage?: string
  ): void {
    if (!gen.activeTurnId && !gen.activeMessageId) return

    // 1. Snapshot active turn state
    const turnId = gen.activeTurnId
    const messageId = gen.activeMessageId
    const messageWasStarted = gen.messageStartedEmitted
    const turnAccumulatedText = gen.turnAccumulatedText
    const toolsToComplete: Array<{ stepIndex: number; toolCallId: string }> = []

    for (const [stepIndex, toolCallId] of gen.activeStepTools.entries()) {
      if (gen.startedToolSteps.has(stepIndex) && !gen.completedToolSteps.has(stepIndex)) {
        toolsToComplete.push({ stepIndex, toolCallId })
      }
    }

    // 2. Clear state BEFORE invoking listeners to prevent duplicate emissions on callback reentrancy
    gen.activeTurnId = undefined
    gen.activeMessageId = undefined
    gen.messageStartedEmitted = false
    gen.turnAccumulatedText = ''
    gen.activeStepTools.clear()
    gen.startedToolSteps.clear()
    gen.completedToolSteps.clear()

    // 3. Ensure message.started was emitted before completing
    if (messageId && !messageWasStarted) {
      this.emitEvent({
        eventId: this.createEventId('msg-start'),
        taskId: this.options.taskId,
        runId: this.options.runId,
        timestamp: Date.now(),
        type: 'message.started',
        messageId,
        role: 'assistant',
        turnId,
      } as MessageStartedEvent)
    }

    // 4. Complete open tools with failed outcome
    for (const { toolCallId } of toolsToComplete) {
      this.emitEvent({
        eventId: this.createEventId('tool-abort'),
        taskId: this.options.taskId,
        runId: this.options.runId,
        timestamp: Date.now(),
        type: 'tool.completed',
        toolCallId,
        output: errorMessage || 'Process terminated before tool completion',
        isError: true,
        outcome: 'failed',
        turnId,
      } as ToolCompletedEvent)
    }

    // 5. Complete active message with terminal reason
    if (messageId) {
      this.emitEvent({
        eventId: this.createEventId('msg-abort'),
        taskId: this.options.taskId,
        runId: this.options.runId,
        timestamp: Date.now(),
        type: 'message.completed',
        messageId,
        fullContent: turnAccumulatedText,
        finishReason,
        turnId,
      } as MessageCompletedEvent)
    }
    this.emitEvent({ eventId: this.createEventId('turn-ended'), taskId: this.options.taskId, runId: this.options.runId, timestamp: Date.now(), type: 'agent.status.changed', scope: 'turn', status: finishReason === 'interrupted' ? 'stopped' : 'error', turnId, error: errorMessage })
  }

  private writeLineToStdin(gen: GenerationContext, data: string): Promise<void> {
    if (gen.retired || !gen.proc.stdin || !gen.proc.stdin.writable) {
      return Promise.reject(new Error('Cannot write to child process stdin: stream is not writable'))
    }

    return new Promise<void>((resolve, reject) => {
      let settled = false
      const timer = setTimeout(() => {
        finish(new Error('Antigravity stdin write timed out'))
      }, this.options.stdinWriteTimeoutMs ?? 10_000)
      timer.unref?.()
      const finish = (err?: Error | null) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        gen.pendingWrites.delete(finish)
        if (err) reject(err)
        else resolve()
      }
      gen.pendingWrites.add(finish)
      try {
        gen.proc.stdin!.write(`${data}\n`, (err) => {
          finish(err)
        })
      } catch (err) {
        console.error('AntigravityAdapter failed to write to stdin:', err)
        finish(err instanceof Error ? err : new Error(String(err)))
      }
    })
  }

  private flushBuffers(gen: GenerationContext): void {
    const remainingStdout = gen.stdoutDecoder.end()
    if (remainingStdout) {
      gen.stdoutBuffer += remainingStdout
    }
    if (gen.stdoutBuffer.trim()) {
      const lines = gen.stdoutBuffer.split('\n')
      gen.stdoutBuffer = ''
      for (const rawLine of lines) {
        const line = rawLine.trim()
        if (!line) continue
        this.processStdoutLine(gen, line)
      }
    }

    const remainingStderr = gen.stderrDecoder.end()
    if (remainingStderr) {
      gen.stderrBuffer += remainingStderr
    }
    if (gen.stderrBuffer.trim()) {
      const lines = gen.stderrBuffer.split('\n')
      gen.stderrBuffer = ''
      for (const rawLine of lines) {
        const line = rawLine.trim()
        if (!line) continue
        this.processStderrLine(line)
      }
    }
  }

  private handleStdoutData(gen: GenerationContext, chunk: Buffer | string): void {
    let textChunk = typeof chunk === 'string' ? chunk : gen.stdoutDecoder.write(chunk)

    // If currently discarding an oversized line until its newline, discard the prefix
    if (gen.stdoutDiscardingUntilNewline) {
      const newlineIndex = textChunk.indexOf('\n')
      if (newlineIndex === -1) {
        return
      }
      textChunk = textChunk.slice(newlineIndex + 1)
      gen.stdoutDiscardingUntilNewline = false
    }

    gen.stdoutBuffer += textChunk

    const lines = gen.stdoutBuffer.split('\n')
    const remainder = lines.pop() || ''
    const maxBuffer = this.options.maxLineBufferBytes ?? DEFAULT_MAX_LINE_BUFFER_BYTES

    // Check remainder size to prevent memory leaks from unterminated lines
    if (Buffer.byteLength(remainder, 'utf8') > maxBuffer) {
      console.warn(`AntigravityAdapter stdout line buffer exceeded ${maxBuffer} bytes, discarding line remainder`)
      gen.stdoutBuffer = ''
      gen.stdoutDiscardingUntilNewline = true
    } else {
      gen.stdoutBuffer = remainder
    }

    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line) continue
      if (Buffer.byteLength(rawLine, 'utf8') > maxBuffer) {
        console.warn(`AntigravityAdapter: oversized line discarded (${Buffer.byteLength(rawLine, 'utf8')} bytes)`)
        continue
      }
      this.processStdoutLine(gen, line)
    }
  }

  private processStdoutLine(gen: GenerationContext, line: string): void {
    try {
      this.options.onRawLog?.('stdout', line)
    } catch (logErr) {
      console.error('AntigravityAdapter error in onRawLog callback:', logErr)
    }

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

    let parsed: Record<string, unknown> | null = null
    try {
      parsed = JSON.parse(line)
    } catch {
      // Non-JSON diagnostic line, safely ignored
      return
    }

    if (parsed && typeof parsed === 'object') {
      this.processIncomingRecord(gen, parsed)
    }
  }

  private handleStderrData(gen: GenerationContext, chunk: Buffer | string): void {
    let textChunk = typeof chunk === 'string' ? chunk : gen.stderrDecoder.write(chunk)

    if (gen.stderrDiscardingUntilNewline) {
      const newlineIndex = textChunk.indexOf('\n')
      if (newlineIndex === -1) {
        return
      }
      textChunk = textChunk.slice(newlineIndex + 1)
      gen.stderrDiscardingUntilNewline = false
    }

    gen.stderrBuffer += textChunk

    const lines = gen.stderrBuffer.split('\n')
    const remainder = lines.pop() || ''
    const maxBuffer = this.options.maxLineBufferBytes ?? DEFAULT_MAX_LINE_BUFFER_BYTES

    if (Buffer.byteLength(remainder, 'utf8') > maxBuffer) {
      console.warn(`AntigravityAdapter stderr line buffer exceeded ${maxBuffer} bytes, discarding line remainder`)
      gen.stderrBuffer = ''
      gen.stderrDiscardingUntilNewline = true
    } else {
      gen.stderrBuffer = remainder
    }

    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line) continue
      if (Buffer.byteLength(rawLine, 'utf8') > maxBuffer) {
        console.warn(`AntigravityAdapter: oversized stderr line discarded`)
        continue
      }
      this.processStderrLine(line)
    }
  }

  private processStderrLine(line: string): void {
    try {
      this.options.onRawLog?.('stderr', line)
    } catch (logErr) {
      console.error('AntigravityAdapter error in onRawLog callback:', logErr)
    }

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

  private processIncomingRecord(gen: GenerationContext, record: Record<string, unknown>): void {
    if (gen.retired || this.activeGen !== gen) return

    const event = record.event as string | undefined

    if (event === 'init') {
      const convId = record.conversation_id
      if (typeof convId !== 'string' || !convId.trim() || convId.length > 200 ||
          (gen.conversationId !== undefined && gen.conversationId !== convId) ||
          (this.options.conversationId !== undefined && this.options.conversationId !== convId)) {
        const error = new Error('Antigravity sent an invalid or mismatched conversation initialization')
        if (this.rejectStartup) this.rejectStartup(error)
        else this.handleProcessError(gen, error)
        return
      }
      try {
        const init = record.init
        if (!init || typeof init !== 'object' || Array.isArray(init) || typeof (init as Record<string, unknown>).cwd !== 'string') {
          throw new Error('Antigravity initialization did not confirm its working directory')
        }
        // init.cwd attests the launch directory, not the native project roots;
        // the separate --add-dir contract above supplies those roots.
        this.assertWorkspace((init as { cwd: string }).cwd)
      } catch (error) {
        const failure = error instanceof Error ? error : new Error(String(error))
        if (this.rejectStartup) this.rejectStartup(failure)
        else this.handleProcessError(gen, failure)
        return
      }
      gen.conversationId = convId
      this.options.conversationId = convId
      gen.onReady?.()
      return
    }

    if (!gen.ready) {
      const error = new Error('Antigravity emitted a record before initialization')
      this.rejectStartup?.(error)
      return
    }

    if (event === 'step_update') {
      const stepUpdate = record.step_update as Record<string, unknown> | undefined
      if (!stepUpdate) return
      if (stepUpdate.conversation_id !== undefined && stepUpdate.conversation_id !== gen.conversationId) return
      this.handleStepUpdate(gen, stepUpdate)
      return
    }

    if (event === 'result') {
      const result = record.result as Record<string, unknown> | undefined
      if (!result) return
      if (result.conversation_id !== undefined && result.conversation_id !== gen.conversationId) return
      this.handleResult(gen, result)
      return
    }
  }

  private handleStepUpdate(gen: GenerationContext, stepUpdate: Record<string, unknown>): void {
    if (!gen.activeTurnId || !gen.activeMessageId) {
      return
    }

    const stepType = stepUpdate.step_type as string | undefined
    const state = stepUpdate.state as string | undefined
    const stepIndex = Number(stepUpdate.step_index ?? 0)

    if (stepType === 'agent_response') {
      this.ensureMessageStarted(gen)
      // Callback reentrancy guard
      if (gen.retired || !gen.activeTurnId || !gen.activeMessageId) return

      const textDelta = stepUpdate.text_delta
      if (typeof textDelta === 'string' && textDelta) {
        if (Buffer.byteLength(gen.turnAccumulatedText, 'utf8') + Buffer.byteLength(textDelta, 'utf8') > (this.options.maxTurnBufferBytes ?? 8 * 1024 * 1024)) {
          this.handleProcessError(gen, new Error('Antigravity response exceeded the turn size limit'))
          return
        }
        gen.turnAccumulatedText += textDelta
        this.emitEvent({
          eventId: this.createEventId('delta'),
          taskId: this.options.taskId,
          runId: this.options.runId,
          timestamp: Date.now(),
          type: 'message.delta',
          messageId: gen.activeMessageId!,
          deltaType: 'text',
          content: textDelta,
        } as MessageDeltaEvent)
      }
      return
    }

    if (stepType === 'tool') {
      this.ensureMessageStarted(gen)
      // Callback reentrancy guard
      if (gen.retired || !gen.activeTurnId || !gen.activeMessageId) return

      const toolName = (stepUpdate.tool_name ||
        (stepUpdate.tool_info as Record<string, unknown>)?.name ||
        'unknown') as string
      const toolInfo = (stepUpdate.tool_info || {}) as Record<string, unknown>

      let toolCallId = gen.activeStepTools.get(stepIndex)
      if (!toolCallId) {
        if (gen.activeStepTools.size >= (this.options.maxTrackedRecords ?? 4096)) {
          this.handleProcessError(gen, new Error('Antigravity tool count exceeded the turn limit'))
          return
        }
        toolCallId = `${gen.activeMessageId}-tool-${stepIndex}`
        gen.activeStepTools.set(stepIndex, toolCallId)
      }

      if (!gen.startedToolSteps.has(stepIndex)) {
        gen.startedToolSteps.add(stepIndex)
        this.emitEvent({
          eventId: this.createEventId('tool-start'),
          taskId: this.options.taskId,
          runId: this.options.runId,
          timestamp: Date.now(),
          type: 'tool.started',
          toolCallId,
          toolName,
          input: toolInfo.parameters,
          parentMessageId: gen.activeMessageId,
          turnId: gen.activeTurnId,
        } as ToolStartedEvent)
      }

      // Revalidate state after emitting tool.started
      if (gen.retired || !gen.activeTurnId || !gen.activeMessageId) return

      if ((state === 'DONE' || state === 'ERROR') && !gen.completedToolSteps.has(stepIndex)) {
        gen.completedToolSteps.add(stepIndex)
        const isError = state === 'ERROR' || !!toolInfo.error
        const error = toolInfo.error
        const errorText = typeof error === 'string' ? error
          : error && typeof error === 'object' && typeof (error as Record<string, unknown>).message === 'string'
            ? (error as Record<string, unknown>).message
            : error ? JSON.stringify(error) : 'Antigravity reported that the tool failed'
        this.emitEvent({
          eventId: this.createEventId('tool-done'),
          taskId: this.options.taskId,
          runId: this.options.runId,
          timestamp: Date.now(),
          type: 'tool.completed',
          toolCallId,
          output: isError ? errorText : toolInfo.output,
          isError,
          outcome: isError ? 'failed' : 'completed',
        } as ToolCompletedEvent)
      }
    }
  }

  private handleResult(gen: GenerationContext, result: Record<string, unknown>): void {
    if (!gen.activeTurnId || !gen.activeMessageId) {
      return
    }

    const status = (result.status as string) || 'UNKNOWN'

    if (gen.interruptRequested && (status === 'INTERRUPTED' || status === 'CANCELED' || (status === 'ERROR' && result.error === 'interrupted'))) {
      gen.interruptConfirmed = true
      this.finalizeActiveTurnOnTermination(gen, 'interrupted', 'Turn interrupted by user')
      return
    }

    if (status === 'SUCCESS') {
      // A terminal result can win the race against a delivered SIGINT. Preserve
      // its actual outcome, but still wait for the signal-driven process exit.
      if (gen.interruptRequested) gen.interruptConfirmed = true
      this.ensureMessageStarted(gen)
      // Callback reentrancy guard
      if (gen.retired || !gen.activeTurnId || !gen.activeMessageId) return

      const fullContent = typeof result.response === 'string' ? result.response : gen.turnAccumulatedText
      if (Buffer.byteLength(fullContent, 'utf8') > (this.options.maxTurnBufferBytes ?? 8 * 1024 * 1024)) {
        this.handleProcessError(gen, new Error('Antigravity result exceeded the turn size limit'))
        return
      }
      // Native SUCCESS describes the request lifecycle, not permission or tool
      // success: agy can send tool ERROR + empty response + denied_actions.
      const denied = Array.isArray(result.denied_actions) && result.denied_actions.length > 0
      const incompleteTool = [...gen.startedToolSteps].some(index => !gen.completedToolSteps.has(index))
      if (denied || incompleteTool) {
        const error = denied
          ? 'Antigravity denied a required tool action. Headless mode cannot request interactive approval. Review permissions in Composer options or native CLI settings, then explicitly resend if appropriate.'
          : 'Antigravity ended the turn without confirming a tool result. The action outcome is unknown; inspect it before explicitly retrying.'
        gen.turnAccumulatedText = fullContent
        // Keep the persistent session usable, but fence reentrant sends until
        // the failed turn is fully published. Do not retry or change policy.
        this.finalizingTurn = true
        try { this.finalizeActiveTurnOnTermination(gen, 'error', error) }
        finally { this.finalizingTurn = false }
        return
      }
      const turnId = gen.activeTurnId
      const messageId = gen.activeMessageId!

      // Clear active turn state BEFORE emitting message.completed
      gen.activeTurnId = undefined
      gen.activeMessageId = undefined
      gen.messageStartedEmitted = false
      gen.turnAccumulatedText = ''
      gen.activeStepTools.clear()
      gen.startedToolSteps.clear()
      gen.completedToolSteps.clear()

      this.finalizingTurn = true
      this.emitEvent({
        eventId: this.createEventId('msg-done'),
        taskId: this.options.taskId,
        runId: this.options.runId,
        timestamp: Date.now(),
        type: 'message.completed',
        messageId,
        fullContent,
        finishReason: 'stop',
        turnId,
      } as MessageCompletedEvent)
      this.finalizingTurn = false
      this.emitEvent({ eventId: this.createEventId('turn-completed'), taskId: this.options.taskId, runId: this.options.runId, timestamp: Date.now(), type: 'agent.status.changed', status: 'completed', scope: 'turn', turnId })

      return
    }

    if (status === 'ERROR' || status === 'INVALID') {
      const rawError = result.error
      let errMessage: string
      if (typeof rawError === 'string') {
        errMessage = rawError
      } else if (rawError && typeof rawError === 'object') {
        errMessage = (rawError as Record<string, unknown>).message
          ? String((rawError as Record<string, unknown>).message)
          : JSON.stringify(rawError)
      } else {
        errMessage = `Antigravity returned status ${status}`
      }

      const isNewError = this.currentStatus !== 'error'
      // Set status to error BEFORE finalization so callbacks cannot submit new turns
      this.currentStatus = 'error'
      this.finalizeActiveTurnOnTermination(gen, 'error', errMessage)

      if (isNewError) {
        this.emitEvent({
          eventId: this.createEventId('err-status'),
          taskId: this.options.taskId,
          runId: this.options.runId,
          timestamp: Date.now(),
          type: 'agent.status.changed',
          status: 'error',
          scope: 'session',
          error: String(errMessage),
        } as AgentStatusChangedEvent)
      }

      return
    }

    if (status === 'CANCELED' || status === 'INTERRUPTED') {
      this.finalizeActiveTurnOnTermination(gen, 'interrupted', `Turn was ${status.toLowerCase()}`)
      return
    }

    if (status === 'RUNNING' || status === 'WAITING') {
      this.handleProcessError(gen, new Error(`Antigravity ended a turn with non-success terminal status ${status}`))
      return
    }
    this.handleProcessError(gen, new Error('Antigravity returned an unknown terminal result status'))
  }

  private ensureMessageStarted(gen: GenerationContext): void {
    if (gen.messageStartedEmitted || !gen.activeMessageId) return
    gen.messageStartedEmitted = true

    this.emitEvent({
      eventId: this.createEventId('msg-start'),
      taskId: this.options.taskId,
      runId: this.options.runId,
      timestamp: Date.now(),
      type: 'message.started',
      messageId: gen.activeMessageId,
      role: 'assistant',
    } as MessageStartedEvent)
  }

  private terminateGenerationProcess(gen: GenerationContext, force: boolean): Promise<void> {
    const proc = gen.proc
    const pid = proc.pid
    // Record birth identities while the process is still a parent. EOF may orphan
    // subprocesses before Electron receives the root exit event.
    try { if (pid) this.supervisor.trackProcessTree(pid) }
    catch (error) { return Promise.reject(error) }
    if (gen.terminationPromise) {
      if (force && !this.isProcessExited(proc)) proc.kill('SIGKILL')
      return gen.terminationPromise
    }
    const timeout = this.options.killTimeoutMs ?? 1000
    // Native 1.2.7 can need >1s to flush/save an idle conversation after EOF.
    // Keep a larger graceful window without extending forced escalation.
    const gracefulTimeout = this.options.killTimeoutMs ?? 3000
    const rootExit = new Promise<void>((resolve, reject) => {
      if (this.isProcessExited(proc)) { resolve(); return }
      let timer: NodeJS.Timeout | undefined
      let settled = false
      const finish = (error?: Error) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        proc.removeListener('exit', onExit)
        proc.removeListener('close', onExit)
        if (error) reject(error)
        else resolve()
      }
      const onExit = () => finish()
      const signal = (name: NodeJS.Signals) => {
        if (settled || this.isProcessExited(proc)) { finish(); return }
        try { proc.kill(name) } catch (error) { finish(error instanceof Error ? error : new Error(String(error))) }
      }
      const deadline = () => {
        if (settled) return
        if (this.isProcessExited(proc)) finish()
        else finish(new Error(`Failed to terminate child process with PID ${pid}`))
      }
      const forceAfterGrace = () => {
        signal('SIGKILL')
        if (!settled) timer = setTimeout(deadline, Math.min(timeout, 500))
      }
      proc.once('exit', onExit)
      proc.once('close', onExit)
      if (force) {
        forceAfterGrace()
      } else {
        // EOF is the documented normal shutdown; never use process death as a
        // pretend turn interruption. A busy session gets bounded escalation.
        try { proc.stdin?.end() } catch (error) { finish(error instanceof Error ? error : new Error(String(error))) }
        if (!settled) timer = setTimeout(() => {
          signal('SIGTERM')
          if (!settled) timer = setTimeout(forceAfterGrace, timeout)
        }, gracefulTimeout)
      }
      timer?.unref?.()
    })
    const operation = (async () => {
      let rootError: unknown
      try { await rootExit } catch (error) { rootError = error }
      let treeStopped = true
      if (pid) treeStopped = await this.supervisor.terminateProcessTree(pid, { timeoutMs: Math.min(timeout, 500), force: true })
      if (rootError) throw rootError
      if (!treeStopped) throw new Error(`Failed to terminate descendant processes for PID ${pid}`)
      clearInterval(gen.ownershipTimer)
      if (this.activeGen === gen) this.activeGen = undefined
    })()
    gen.terminationPromise = operation
    void operation.catch(() => { if (gen.terminationPromise === operation) gen.terminationPromise = undefined })
    return operation
  }

  private isProcessExited(proc: ChildProcess): boolean {
    return (
      (proc.exitCode !== null && proc.exitCode !== undefined) ||
      (proc.signalCode !== null && proc.signalCode !== undefined)
    )
  }

  private emitEvent(event: AgentEvent): void {
    // Capture identity synchronously; the session coordinator queues journal writes.
    if (!event.turnId && event.type !== 'raw.log' &&
        (event.type !== 'agent.status.changed' || event.scope === 'turn')) {
      event = { ...event, turnId: this.activeGen?.activeTurnId }
    }
    try {
      this.options.onEvent?.(event)
    } catch (err) {
      console.error(`AntigravityAdapter: error in onEvent listener for ${event.type}:`, err)
    }
  }

  private createEventId(prefix: string): string {
    return `${this.options.taskId}-${this.options.runId}-${prefix}-${Date.now()}-${++this.eventCounter}`
  }
}
