import { validateReasoningEffort } from '../runtime/AgentExecutionPolicy'
/**
 * ClaudeAdapter
 *
 * Implements the streaming execution adapter for Anthropic Claude Code CLI (claude)
 * via `-p --input-format stream-json --output-format stream-json --include-partial-messages --verbose`.
 *
 * Emits typed AgentEvent events (message.started, message.delta, message.completed,
 * tool.started, tool.completed, agent.status.changed, raw.log) directly into ZIAForge's
 * EventJournal with block-level deduplication between streaming deltas and final assistant snapshots.
 */

import { spawn, ChildProcess, SpawnOptions } from 'child_process'
import { StringDecoder } from 'string_decoder'
import * as crypto from 'crypto'
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
import { ProcessSupervisor } from '../runtime/ProcessSupervisor'

export interface ClaudeAdapterOptions {
  toolPolicy?: 'none'
  taskId: string
  runId: string
  worktreePath: string
  /** Explicit native identity. Resume never falls back to a new conversation. */
  resumeSessionId?: string
  sessionId?: string
  claudeBinPath?: string
  reasoningEffort?: string | null
  model?: string
  permissionMode?: 'default' | 'acceptEdits' | 'plan' | 'bypassPermissions' | 'dontAsk'
  env?: Record<string, string | undefined>
  startupTimeoutMs?: number
  stdinWriteTimeoutMs?: number
  killTimeoutMs?: number
  killGraceMs?: number
  maxLineBufferBytes?: number
  maxTurnBufferBytes?: number
  maxTrackedRecords?: number
  emitRawLogEvents?: boolean
  supervisor?: ProcessSupervisor
  onEvent?: (event: AgentEvent) => void
  onRawLog?: (stream: 'stdout' | 'stderr', line: string) => void
  spawnProcess?: (command: string, args: string[], options: SpawnOptions) => ChildProcess
}

export interface ClaudeCapabilities {
  textStreaming: boolean
  toolCalls: boolean
  thinkingStreaming: boolean
  toolOutputStreaming: boolean
  interactiveApprovals: boolean
  attachments: boolean
}

const DEFAULT_MAX_LINE_BUFFER_BYTES = 5 * 1024 * 1024 // 5MB
const DEFAULT_MAX_TURN_BUFFER_BYTES = 10 * 1024 * 1024 // 10MB
const DEFAULT_STARTUP_TIMEOUT_MS = 15000
const DEFAULT_STDIN_WRITE_TIMEOUT_MS = 5000
const DEFAULT_KILL_TIMEOUT_MS = 1000
const DEFAULT_KILL_GRACE_MS = 500

interface BlockState {
  type: 'text' | 'thinking' | 'tool_use' | 'unknown'
  streamedText: string
  publishedText: string
  streamedThinking: string
  publishedThinking: string
  toolId?: string
  toolName?: string
  toolInputJson: string
  toolInput?: unknown
  toolArgumentsComplete: boolean
}

interface ToolExecutionState {
  toolCallId: string
  toolName: string
  startedEmitted: boolean
  completedEmitted: boolean
}

interface PendingStdinWrite {
  reject: (err: Error) => void
  timer?: NodeJS.Timeout
}

interface PendingControl {
  resolve(value: Record<string, unknown>): void
  reject(error: Error): void
  timer: NodeJS.Timeout
}
interface PendingApproval {
  requestId: string
  turnId: string
  input: Record<string, unknown>
  submitting?: boolean
}
interface GenerationContext {
  generation: number
  proc: ChildProcess
  retired: boolean
  descendantsSurviving?: boolean
  terminating?: boolean
  sessionId?: string
  stdoutDecoder: StringDecoder
  stderrDecoder: StringDecoder
  stdoutBuffer: string
  stderrBuffer: string
  stdoutDiscardingUntilNewline: boolean
  stderrDiscardingUntilNewline: boolean
  seenUuids: Set<string>
  activeTurnId?: string
  activeMessageId?: string
  claudeMessageId?: string
  messageStartedEmitted: boolean
  turnCompletedEmitted: boolean
  turnAccumulatedText: string
  turnAccumulatedThinking: string
  previousStepsText: string
  turnTotalBytes: number
  turnBufferExceeded?: boolean
  maxStreamedTextBlockIndex: number
  maxStreamedThinkingBlockIndex: number
  blocks: Map<number, BlockState>
  activeTools: Map<string, ToolExecutionState>
  pendingStdinWrites: Set<PendingStdinWrite>
  controls: Map<string, PendingControl>
  approvals: Map<string, PendingApproval>
  interruptingTurnId?: string
  initializing?: boolean
  terminationPromise?: Promise<void>
  exitCode?: number | null
  signalCode?: NodeJS.Signals | string | null
}

export class ClaudeAdapter {
  private options: ClaudeAdapterOptions
  private activeGen?: GenerationContext
  private supervisor: ProcessSupervisor
  private processGeneration = 0
  private isStopped = false
  private isStopping = false
  private currentStatus: AgentRunStatus = 'idle'
  private startingPromise?: Promise<{ pid: number; sessionId?: string }>
  private rejectStartup?: (err: Error) => void
  private turnCounter = 0
  private eventCounter = 0

  constructor(options: ClaudeAdapterOptions) {
    validateReasoningEffort('claude', options.reasoningEffort)
    if (options.toolPolicy !== undefined && options.toolPolicy !== 'none') throw new Error('Invalid Claude tool policy')
    for (const reference of [options.resumeSessionId, options.sessionId]) if (reference !== undefined && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reference)) throw new Error('Claude session reference must be a UUID')
    if (options.resumeSessionId && options.sessionId) throw new Error('Choose either a new Claude identity or resume, not both')
    this.options = { ...options }
    this.supervisor = options.supervisor ?? new ProcessSupervisor()
  }

  getPid(): number | undefined {
    return this.activeGen?.proc.pid
  }

  getSessionId(): string | undefined {
    return this.activeGen?.sessionId
  }

  getCurrentStatus(): AgentRunStatus {
    return this.currentStatus
  }

  getStatus(): AgentRunStatus {
    return this.currentStatus
  }

  getCapabilities(): ClaudeCapabilities {
    return {
      textStreaming: true,
      thinkingStreaming: true,
      toolCalls: this.options.toolPolicy !== 'none',
      toolOutputStreaming: false,
      interactiveApprovals: this.options.toolPolicy !== 'none',
      attachments: false,
    }
  }

  getProvider(): AgentProviderType {
    return 'claude'
  }

  getTaskId(): string {
    return this.options.taskId
  }

  getRunId(): string {
    return this.options.runId
  }

  /**
   * Spawns the claude process with stream-json flags and installs generation-isolated listeners.
   */
  async start(): Promise<{ pid: number; sessionId?: string }> {
    if (this.isStopped || this.isStopping) {
      throw new Error('Cannot start ClaudeAdapter: adapter has been stopped')
    }

    if (this.startingPromise) {
      return this.startingPromise
    }

    if (
      this.activeGen &&
      !this.activeGen.retired &&
      !this.isProcessExited(this.activeGen.proc) &&
      this.currentStatus !== 'error'
    ) {
      return Promise.resolve({
        pid: this.activeGen.proc.pid ?? -1,
        sessionId: this.activeGen.sessionId,
      })
    }

    const startTask = async (): Promise<{ pid: number; sessionId?: string }> => {
      if (this.activeGen) {
        const prevGen = this.activeGen
        try {
          await this.terminateGenerationProcess(prevGen, true)
          prevGen.descendantsSurviving = false
        } catch (err) {
          prevGen.descendantsSurviving = true
          throw err
        }
        this.finalizeActiveTurnOnTermination(
          prevGen,
          'interrupted',
          'Previous process replaced by new start()'
        )
        this.retireGeneration(prevGen, new Error('Previous process replaced by new start()'))
        if (this.activeGen === prevGen) {
          this.activeGen = undefined
        }
      }

      if (this.isStopped || this.isStopping) {
        throw new Error('Cannot start ClaudeAdapter: adapter has been stopped')
      }
      if (this.turnCounter > 0) throw new Error('Claude session disconnected; create a new chat to continue without losing context')

      return new Promise<{ pid: number; sessionId?: string }>((resolve, reject) => {
        let isSettled = false
        let startupTimer: NodeJS.Timeout | undefined

        const startupTimeoutMs = this.options.startupTimeoutMs ?? DEFAULT_STARTUP_TIMEOUT_MS
        if (startupTimeoutMs > 0) {
          startupTimer = setTimeout(() => {
            if (!isSettled) {
              onSpawnFailure(new Error(`Claude process startup timed out after ${startupTimeoutMs}ms`))
            }
          }, startupTimeoutMs)
        }

        this.rejectStartup = (err: Error) => {
          if (!isSettled) {
            isSettled = true
            if (startupTimer) clearTimeout(startupTimer)
            this.rejectStartup = undefined
            if (this.activeGen) {
              this.currentStatus = 'error'
              this.finalizeActiveTurnOnTermination(this.activeGen, 'error', err.message)
              this.retireGeneration(this.activeGen, err)
              void this.terminateGenerationProcess(this.activeGen, true).catch(() => {})
            }
            reject(err)
          }
        }

        const spawnFn = this.options.spawnProcess || spawn
        const spawnArgs = [
          '-p',
          '--input-format',
          'stream-json',
          '--output-format',
          'stream-json',
          '--include-partial-messages',
          '--verbose',
          '--permission-prompt-tool', 'stdio',
          '--permission-mode', this.options.toolPolicy === 'none' ? 'dontAsk' : this.options.permissionMode ?? 'default',
          ...(this.options.toolPolicy === 'none' ? ['--tools', '', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}', '--setting-sources', '', '--disable-slash-commands'] : []),
          ...(this.options.reasoningEffort != null ? ['--effort', this.options.reasoningEffort] : []),
        ]
        if (this.options.model) {
          spawnArgs.push('--model', this.options.model)
        }

        if (this.options.resumeSessionId) spawnArgs.push('--resume', this.options.resumeSessionId)
        else if (this.options.sessionId) spawnArgs.push('--session-id', this.options.sessionId)

        const currentGenIndex = ++this.processGeneration

        let proc: ChildProcess
        try {
          proc = spawnFn(this.options.claudeBinPath || 'claude', spawnArgs, {
            cwd: this.options.worktreePath,
            stdio: ['pipe', 'pipe', 'pipe'],
            env: {
              ...(this.options.env ?? process.env),
              CI: 'true',
            },
          })
        } catch (err) {
          isSettled = true
          if (startupTimer) clearTimeout(startupTimer)
          this.rejectStartup = undefined
          reject(err)
          return
        }

        const gen: GenerationContext = {
          sessionId: this.options.resumeSessionId ?? this.options.sessionId,
          generation: currentGenIndex,
          proc,
          retired: false,
          stdoutDecoder: new StringDecoder('utf8'),
          stderrDecoder: new StringDecoder('utf8'),
          stdoutBuffer: '',
          stderrBuffer: '',
          stdoutDiscardingUntilNewline: false,
          stderrDiscardingUntilNewline: false,
          seenUuids: new Set<string>(),
          messageStartedEmitted: false,
          turnCompletedEmitted: false,
          turnAccumulatedText: '',
          turnAccumulatedThinking: '',
          previousStepsText: '',
          turnTotalBytes: 0,
          maxStreamedTextBlockIndex: -1,
          maxStreamedThinkingBlockIndex: -1,
          blocks: new Map(),
          activeTools: new Map(),
          pendingStdinWrites: new Set(),
          controls: new Map(),
          approvals: new Map(),
        }

        // Immediately take ownership of the process generation
        this.activeGen = gen

        // Check if stop was called immediately before or during spawn
        if (this.isStopped || this.isStopping) {
          isSettled = true
          if (startupTimer) clearTimeout(startupTimer)
          this.rejectStartup = undefined
          this.retireGeneration(gen, new Error('Adapter stopped during startup'))
          void this.terminateGenerationProcess(gen, true).catch(() => {})
          reject(new Error('Cannot start ClaudeAdapter: adapter has been stopped'))
          return
        }

        const onSpawnSuccess = () => {
          if (gen.initializing || isSettled) return
          gen.initializing = true
          void this.sendControl(gen, { subtype: 'initialize', hooks: null }).then(() => onReady(), onSpawnFailure)
        }
        const onReady = () => {
          if (gen.retired || this.activeGen !== gen || gen.exitCode !== undefined || this.isProcessExited(proc)) { onSpawnFailure(new Error('Claude process exited during initialization')); return }
          if (!isSettled) {
            isSettled = true
            if (startupTimer) clearTimeout(startupTimer)
            this.rejectStartup = undefined

            // Reset terminal status on successful start
            if (this.currentStatus === 'error' || this.currentStatus === 'stopped') {
              this.currentStatus = 'idle'
              this.emitEvent({
                eventId: this.createEventId('status-idle'),
                taskId: this.options.taskId,
                runId: this.options.runId,
                timestamp: Date.now(),
                type: 'agent.status.changed',
                status: 'idle',
              } as AgentStatusChangedEvent)
            } else {
              this.currentStatus = 'idle'
            }

            resolve({
              pid: proc.pid ?? -1,
              sessionId: gen.sessionId,
            })
          }
        }

        const onSpawnFailure = (err: Error) => {
          if (!isSettled) {
            isSettled = true
            if (startupTimer) clearTimeout(startupTimer)
            this.rejectStartup = undefined
            this.currentStatus = 'error'
            this.finalizeActiveTurnOnTermination(gen, 'error', err.message)
            this.retireGeneration(gen, err)
            void this.terminateGenerationProcess(gen, true).catch(() => {})
            reject(err)
          }
        }

        proc.once('spawn', onSpawnSuccess)

        proc.on('error', (err) => {
          if (!isSettled) {
            onSpawnFailure(err)
          } else {
            if (gen.retired || this.activeGen !== gen) return
            this.handleProcessError(gen, err)
          }
        })

        if (proc.pid && proc.pid > 0) {
          process.nextTick(() => {
            if (!isSettled) {
              onSpawnSuccess()
            }
          })
        }

        proc.stdin?.on?.('error', (err) => {
          if (gen.retired || this.activeGen !== gen) return
          console.error(`ClaudeAdapter stdin error [${this.options.taskId}]:`, err)
        })

        proc.stdout?.on('error', (err) => {
          if (gen.retired || this.activeGen !== gen) return
          console.error(`ClaudeAdapter stdout error [${this.options.taskId}]:`, err)
          this.handleProcessError(gen, err)
        })

        proc.stderr?.on('error', (err) => {
          if (gen.retired || this.activeGen !== gen) return
          console.error(`ClaudeAdapter stderr error [${this.options.taskId}]:`, err)
        })

        proc.stdout?.on('data', (chunk: Buffer) => {
          this.handleStdoutChunk(gen, chunk)
        })

        proc.stderr?.on('data', (chunk: Buffer) => {
          this.handleStderrChunk(gen, chunk)
        })

        proc.once('exit', (exitCode, signalCode) => {
          // Record exit info, but keep activeGen alive until close finishes draining streams
          gen.exitCode = exitCode
          gen.signalCode = signalCode
          // close drains the last result before the session terminal event.
        })

        const onProcessClose = (code: number | null, signal: NodeJS.Signals | string | null) => {
          if (gen.retired) return

          // Flush trailing buffers before marking retired
          this.flushBuffers(gen)
          if (gen.retired || this.activeGen !== gen) return
          if (!isSettled) { onSpawnFailure(new Error('Claude process closed before initialize response')); return }

          this.finalizeActiveTurnOnTermination(
            gen,
            'interrupted',
            `Process closed with code ${code}, signal ${signal}`
          )

          // If stop() or start() is managing shutdown, or termination is in progress, or descendants survived,
          // do NOT clear activeGen.
          // activeGen must be preserved so stop() can be retried to terminate remaining descendants!
          if (!this.isStopping && !this.isStopped && !gen.terminating && !gen.descendantsSurviving) {
            if (this.activeGen === gen) {
              this.activeGen = undefined
              if (this.currentStatus !== 'error' && this.currentStatus !== 'stopped') {
                this.currentStatus = 'error'
                this.emitEvent({
                  eventId: this.createEventId('err-close'),
                  taskId: this.options.taskId,
                  runId: this.options.runId,
                  timestamp: Date.now(),
                  type: 'agent.status.changed',
                  status: 'error',
                  error: `Process terminated unexpectedly with code ${code}, signal ${signal}`,
                } as AgentStatusChangedEvent)
              }
            }

            this.retireGeneration(
              gen,
              new Error(`Claude process exited with code ${code}, signal ${signal}`)
            )
          }
        }

        proc.once('close', (code, signal) => onProcessClose(code, signal))
      })
    }

    const promise = startTask()
    this.startingPromise = promise
    promise.catch(() => {})

    try {
      return await promise
    } finally {
      if (this.startingPromise === promise) {
        this.startingPromise = undefined
      }
    }
  }

  /**
   * Sends a user prompt to the active claude process formatted as stream-json on stdin.
   */
  async sendPrompt(request: SendPromptRequest): Promise<{ turnId: string }> {
    if (request.taskId !== this.options.taskId || (request.runId && request.runId !== this.options.runId)) throw new Error('Stale Claude prompt ownership')
    if (this.isStopped || this.isStopping) {
      throw new Error('Cannot send prompt: adapter is not started or has stopped')
    }

    if (this.currentStatus === 'error') {
      throw new Error(`Cannot send prompt: adapter is in error state`)
    }

    if (request.attachments && request.attachments.length > 0) {
      throw new Error('Attachments are not supported by ClaudeAdapter in stream-json mode')
    }

    if (this.startingPromise) await this.startingPromise
    if (!this.activeGen || this.activeGen.retired || this.isProcessExited(this.activeGen.proc)) {
      await this.start()
    }

    const gen = this.activeGen
    if (!gen || gen.retired || this.isProcessExited(gen.proc)) {
      throw new Error('Cannot send prompt: failed to establish active Claude process')
    }

    if (gen.activeTurnId) {
      throw new Error(
        `Cannot send prompt: turn is already in progress (${gen.activeTurnId})`
      )
    }

    const turnId = `turn-${++this.turnCounter}-${Date.now()}`
    const messageId = `msg-${turnId}`
    const messageUuid = crypto.randomUUID()

    gen.activeTurnId = turnId
    gen.activeMessageId = messageId
    gen.claudeMessageId = undefined
    gen.messageStartedEmitted = false
    gen.turnCompletedEmitted = false
    gen.turnAccumulatedText = ''
    gen.turnAccumulatedThinking = ''
    gen.previousStepsText = ''
    gen.turnTotalBytes = 0
    gen.turnBufferExceeded = false
    gen.maxStreamedTextBlockIndex = -1
    gen.maxStreamedThinkingBlockIndex = -1
    gen.blocks.clear()
    gen.activeTools.clear()

    this.currentStatus = 'running'
    this.emitEvent({
      eventId: this.createEventId('status-run'),
      taskId: this.options.taskId,
      runId: this.options.runId,
      timestamp: Date.now(),
      type: 'agent.status.changed',
      status: 'running',
      scope: 'turn',
      turnId,
    } as AgentStatusChangedEvent)

    // Ensure session_id is always present in JSON, never dropped as undefined
    const messagePayload = {
      type: 'user',
      uuid: messageUuid,
      session_id: gen.sessionId ?? '',
      parent_tool_use_id: null,
      message: {
        role: 'user',
        content: request.text,
      },
    }

    const jsonLine = JSON.stringify(messagePayload)

    try {
      await this.writeLineToStdin(gen, jsonLine)
    } catch (writeErr) {
      if (this.isStopping || this.isStopped) throw writeErr
      if (this.activeGen === gen) {
        this.currentStatus = 'error'
        this.finalizeActiveTurnOnTermination(
          gen,
          'error',
          (writeErr as Error).message || 'Failed to write prompt to stdin'
        )
        this.emitEvent({
          eventId: this.createEventId('err-stdin'),
          taskId: this.options.taskId,
          runId: this.options.runId,
          timestamp: Date.now(),
          type: 'agent.status.changed',
          status: 'error',
          error: (writeErr as Error).message || 'Failed to write prompt to stdin',
        } as AgentStatusChangedEvent)
      }
      gen.activeTurnId = undefined
      gen.activeMessageId = undefined
      throw writeErr
    }

    return { turnId }
  }

  async interruptTurn(expectedTurnId?: string): Promise<{ turnId: string }> {
    const gen = this.activeGen
    const turnId = gen?.activeTurnId
    if (!gen || gen.retired || this.isStopped || this.isStopping || !turnId || (expectedTurnId && expectedTurnId !== turnId)) throw new Error('Unknown or stale active Claude turn')
    if (gen.interruptingTurnId === turnId) throw new Error('Claude turn interruption already requested')
    gen.interruptingTurnId = turnId
    try {
      await this.sendControl(gen, { subtype: 'interrupt' })
      return { turnId }
    } catch (error) {
      if (gen.interruptingTurnId === turnId) gen.interruptingTurnId = undefined
      throw error
    }
  }

  async resolveApproval(
    approvalIdOrRequest: string | ResolveApprovalRequest,
    decision?: ApprovalDecision | string,
    note?: string
  ): Promise<void> {
    if (this.options.toolPolicy === 'none') throw new Error('Tools are disabled for this session')
    if (typeof approvalIdOrRequest !== 'string' && (approvalIdOrRequest.taskId !== this.options.taskId || (approvalIdOrRequest.runId && approvalIdOrRequest.runId !== this.options.runId))) throw new Error('Stale approval ownership')
    const approvalId = typeof approvalIdOrRequest === 'string' ? approvalIdOrRequest : approvalIdOrRequest.approvalId
    const chosen = typeof approvalIdOrRequest === 'string' ? decision : approvalIdOrRequest.decision
    const gen = this.activeGen
    const pending = gen?.approvals.get(approvalId)
    if (chosen !== 'allow' && chosen !== 'deny') throw new Error('Invalid approval decision')
    if (!gen || gen.retired || this.isStopping || this.isStopped || !pending || pending.turnId !== gen.activeTurnId || pending.submitting) throw new Error('Unknown or stale Claude approval')
    pending.submitting = true
    try {
      await this.writeLineToStdin(gen, JSON.stringify({ type: 'control_response', response: { subtype: 'success', request_id: pending.requestId, response: chosen === 'allow' ? { behavior: 'allow', updatedInput: pending.input } : { behavior: 'deny', message: note ?? 'User denied this tool invocation' } } }))
      if (this.activeGen !== gen || gen.retired || gen.approvals.get(approvalId) !== pending || gen.activeTurnId !== pending.turnId) return
      gen.approvals.delete(approvalId)
      this.emitEvent({ ...this.eventBase(), type: 'permission.state.changed', turnId: pending.turnId, approvalId, state: 'resolved', decision: chosen, resolvedBy: 'user' })
      if (!gen.approvals.size && gen.activeTurnId === pending.turnId) {
        this.currentStatus = 'running'
        this.emitEvent({ ...this.eventBase(), type: 'agent.status.changed', scope: 'turn', turnId: pending.turnId, status: 'running' })
      }
    } catch (error) {
      if (gen.approvals.get(approvalId) === pending) pending.submitting = false
      throw error
    }
  }

  private eventBase() {
    return { eventId: this.createEventId('control'), taskId: this.options.taskId, runId: this.options.runId, timestamp: Date.now() }
  }

  private sendControl(gen: GenerationContext, request: Record<string, unknown>): Promise<Record<string, unknown>> {
    const requestId = crypto.randomUUID()
    const result = new Promise<Record<string, unknown>>((resolve, reject) => {
      const timer = setTimeout(() => {
        gen.controls.delete(requestId)
        reject(new Error(`Claude ${String(request.subtype)} acknowledgment timed out`))
      }, this.options.startupTimeoutMs && this.options.startupTimeoutMs > 0 ? this.options.startupTimeoutMs : DEFAULT_STARTUP_TIMEOUT_MS)
      gen.controls.set(requestId, { resolve, reject, timer })
      void this.writeLineToStdin(gen, JSON.stringify({ type: 'control_request', request_id: requestId, request })).catch(error => {
        const pending = gen.controls.get(requestId)
        if (pending) { clearTimeout(pending.timer); gen.controls.delete(requestId); pending.reject(error) }
      })
    })
    return result
  }

  private handleControl(gen: GenerationContext, parsed: Record<string, unknown>): boolean {
    if (parsed.type === 'control_response') {
      const response = parsed.response as Record<string, unknown> | undefined
      const id = typeof response?.request_id === 'string' ? response.request_id : ''
      const pending = gen.controls.get(id)
      if (pending) {
        clearTimeout(pending.timer)
        gen.controls.delete(id)
        if (response?.subtype === 'error') pending.reject(new Error(typeof response.error === 'string' ? response.error : 'Claude control request rejected'))
        else if (response?.subtype === 'success') pending.resolve((response.response ?? {}) as Record<string, unknown>)
        else pending.reject(new Error('Malformed Claude control response'))
      }
      return true
    }
    if (parsed.type === 'control_cancel_request') {
      for (const [id, approval] of gen.approvals) if (approval.requestId === parsed.request_id) {
        gen.approvals.delete(id)
        this.emitEvent({ ...this.eventBase(), type: 'permission.state.changed', approvalId: id, turnId: approval.turnId, state: 'expired' })
      }
      if (!gen.approvals.size && gen.activeTurnId) this.emitEvent({ ...this.eventBase(), type: 'agent.status.changed', scope: 'turn', turnId: gen.activeTurnId, status: 'running' })
      return true
    }
    if (parsed.type !== 'control_request') return false
    const request = parsed.request as Record<string, unknown> | undefined
    const requestId = typeof parsed.request_id === 'string' ? parsed.request_id : ''
    const turnId = gen.activeTurnId
    if (!requestId) return true
    if (request?.subtype !== 'can_use_tool' || !turnId || !request.input || typeof request.input !== 'object' || Array.isArray(request.input) || typeof request.tool_name !== 'string') {
      void this.writeLineToStdin(gen, JSON.stringify({ type: 'control_response', response: { subtype: 'error', request_id: requestId, error: 'Unsupported or inactive control request' } })).catch(error => this.handleProcessError(gen, error))
      return true
    }
    if (this.options.toolPolicy === 'none') {
      void this.writeLineToStdin(gen, JSON.stringify({ type: 'control_response', response: { subtype: 'success', request_id: requestId, response: { behavior: 'deny', message: 'All tools are disabled for this isolated report-only session' } } })).catch(error => this.handleProcessError(gen, error))
      return true
    }
    const approvalId = `${this.options.runId}-g${gen.generation}-${requestId}`
    if (gen.approvals.has(approvalId)) return true
    if (gen.approvals.size >= (this.options.maxTrackedRecords ?? 10000)) { this.triggerBufferOverflow(gen, 'Approval limit exceeded'); return true }
    if (!this.checkTurnBufferLimit(gen, Buffer.byteLength(JSON.stringify(request.input), 'utf8') + requestId.length)) return true
    gen.approvals.set(approvalId, { requestId, turnId, input: request.input as Record<string, unknown> })
    this.ensureMessageStarted(gen)
    this.emitEvent({ ...this.eventBase(), type: 'permission.requested', turnId, approvalId, command: JSON.stringify({ tool: request.tool_name, input: request.input }), toolCallId: typeof request.tool_use_id === 'string' ? request.tool_use_id : undefined, description: `Claude requests permission to use ${request.tool_name}`, decisionOptions: ['allow', 'deny'], riskLevel: 'high' })
    if (this.activeGen === gen && gen.activeTurnId === turnId && gen.approvals.has(approvalId)) {
      this.currentStatus = 'waiting_for_approval'
      this.emitEvent({ ...this.eventBase(), type: 'agent.status.changed', scope: 'turn', turnId, status: 'waiting_for_approval' })
    }
    return true
  }

  private expireApprovals(gen: GenerationContext, turnId?: string): void {
    const expired = [...gen.approvals].filter(([, approval]) => !turnId || approval.turnId === turnId)
    for (const [id] of expired) gen.approvals.delete(id)
    for (const [id, approval] of expired) this.emitEvent({ ...this.eventBase(), type: 'permission.state.changed', turnId: approval.turnId, approvalId: id, state: 'expired' })
  }

  /**
   * Stops the adapter, terminating active processes and emitting completion/cancellation events.
   */
  async stop(force = false): Promise<void> {
    if (this.isStopped && !force) return
    this.isStopping = true

    if (this.rejectStartup) {
      this.rejectStartup(new Error('ClaudeAdapter: adapter was stopped during startup'))
    }

    const gen = this.activeGen
    if (gen) {
      // Reject any pending stdin writes
      for (const pending of gen.pendingStdinWrites) {
        if (pending.timer) clearTimeout(pending.timer)
        pending.reject(new Error('Process stopped while stdin write was pending'))
      }
      gen.pendingStdinWrites.clear()

      this.finalizeActiveTurnOnTermination(gen, 'interrupted', 'Process stopped by user')
      try {
        await this.terminateGenerationProcess(gen, force)
        gen.descendantsSurviving = false
      } catch (err) {
        this.isStopping = false
        gen.descendantsSurviving = true
        throw err
      }
      this.retireGeneration(gen, new Error('Adapter stopped'))
      if (this.activeGen === gen) {
        this.activeGen = undefined
      }
    }

    this.isStopped = true
    this.isStopping = false
    this.currentStatus = 'stopped'

    this.emitEvent({
      eventId: this.createEventId('status-stop'),
      taskId: this.options.taskId,
      runId: this.options.runId,
      timestamp: Date.now(),
      type: 'agent.status.changed',
      status: 'stopped',
    } as AgentStatusChangedEvent)
  }

  // ---------------------------------------------------------------------------
  // Turn Lifecycle Helpers
  // ---------------------------------------------------------------------------

  private reconstructCurrentStepText(gen: GenerationContext): string {
    const sortedIndices = Array.from(gen.blocks.keys()).sort((a, b) => a - b)
    let text = ''
    for (const idx of sortedIndices) {
      const block = gen.blocks.get(idx)
      if (block && block.type === 'text') {
        text += block.publishedText || block.streamedText
      }
    }
    return text
  }

  private reconstructTurnText(gen: GenerationContext): string {
    return (gen.previousStepsText || '') + this.reconstructCurrentStepText(gen)
  }

  private finalizeActiveTurnOnTermination(
    gen: GenerationContext,
    reason: 'stop' | 'error' | 'interrupted',
    errMessage?: string
  ): void {
    if (gen.turnCompletedEmitted || (!gen.activeTurnId && !gen.activeMessageId)) return

    // Ensure parent message is started before emitting any tool events or termination completion
    this.ensureMessageStarted(gen)

    const messageId = gen.activeMessageId
    const turnId = gen.activeTurnId
    const reconstructedText = this.reconstructTurnText(gen)
    const turnAccumulatedText = reconstructedText || gen.turnAccumulatedText
    const toolsToComplete = Array.from(gen.activeTools.values())

    // Clear state BEFORE emitting events to prevent re-entrant callbacks
    gen.turnCompletedEmitted = true
    gen.interruptingTurnId = undefined
    gen.activeTurnId = undefined
    gen.activeMessageId = undefined
    gen.turnAccumulatedText = ''
    gen.turnAccumulatedThinking = ''
    gen.turnTotalBytes = 0
    gen.blocks.clear()
    gen.activeTools.clear()

    this.expireApprovals(gen, turnId)

    for (const tool of toolsToComplete) {
      if (!tool.startedEmitted) {
        tool.startedEmitted = true
        this.emitEvent({
          eventId: this.createEventId('tool-start-abort'),
          taskId: this.options.taskId,
          runId: this.options.runId,
          timestamp: Date.now(),
          type: 'tool.started',
          toolCallId: tool.toolCallId,
          toolName: tool.toolName,
          parentMessageId: messageId,
          turnId,
        } as ToolStartedEvent)
      }
      if (!tool.completedEmitted) {
        tool.completedEmitted = true
        this.emitEvent({
          eventId: this.createEventId('tool-term'),
          taskId: this.options.taskId,
          runId: this.options.runId,
          timestamp: Date.now(),
          type: 'tool.completed',
          turnId,
          toolCallId: tool.toolCallId,
          output: errMessage || `Tool execution terminated (${reason})`,
          isError: true,
          outcome: 'failed',
        } as ToolCompletedEvent)
      }
    }

    if (messageId) {
      this.emitEvent({
        eventId: this.createEventId('msg-done'),
        taskId: this.options.taskId,
        runId: this.options.runId,
        timestamp: Date.now(),
        type: 'message.completed',
        turnId,
        messageId,
        fullContent: turnAccumulatedText,
        finishReason: reason,
      } as MessageCompletedEvent)
    }
    this.emitEvent({ ...this.eventBase(), type: 'agent.status.changed', scope: 'turn', turnId, status: reason === 'error' ? 'error' : 'stopped', error: reason === 'error' ? errMessage : undefined })
  }

  private writeLineToStdin(gen: GenerationContext, data: string): Promise<void> {
    const stdin = gen.proc.stdin
    if (gen.retired || !stdin || !stdin.writable) {
      return Promise.reject(new Error('Cannot write to child process stdin: stream is not writable'))
    }

    return new Promise<void>((resolve, reject) => {
      let isSettled = false
      let timer: NodeJS.Timeout | undefined

      const timeoutMs = this.options.stdinWriteTimeoutMs ?? DEFAULT_STDIN_WRITE_TIMEOUT_MS
      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          if (!isSettled) {
            isSettled = true
            cleanup()
            const err = new Error(`ClaudeAdapter stdin write timed out after ${timeoutMs}ms`)
            this.currentStatus = 'error'
            this.finalizeActiveTurnOnTermination(gen, 'error', err.message)
            this.emitEvent({ ...this.eventBase(), type: 'agent.status.changed', scope: 'session', status: 'error', error: err.message })
            this.retireGeneration(gen, err)
            void this.terminateGenerationProcess(gen, true).catch(() => {})
            reject(err)
          }
        }, timeoutMs)
      }

      const pendingRecord: PendingStdinWrite = {
        reject: (err: Error) => {
          if (!isSettled) {
            isSettled = true
            cleanup()
            reject(err)
          }
        },
        timer,
      }
      gen.pendingStdinWrites.add(pendingRecord)

      const cleanup = () => {
        if (timer) clearTimeout(timer)
        gen.pendingStdinWrites.delete(pendingRecord)
        stdin.removeListener('error', onError)
      }

      const onError = (err: Error) => {
        if (!isSettled) {
          isSettled = true
          cleanup()
          reject(err)
        }
      }

      stdin.once('error', onError)

      try {
        const canContinue = stdin.write(data + '\n', (writeErr) => {
          if (isSettled) return
          isSettled = true
          cleanup()
          if (writeErr) {
            reject(writeErr)
          } else {
            resolve()
          }
        })

        if (!canContinue && !isSettled) {
          // Backpressured; callback will still settle
        }
      } catch (syncErr) {
        if (!isSettled) {
          isSettled = true
          cleanup()
          reject(syncErr as Error)
        }
      }
    })
  }

  // ---------------------------------------------------------------------------
  // Stream I/O Parsers
  // ---------------------------------------------------------------------------

  private handleStdoutChunk(gen: GenerationContext, chunk: Buffer): void {
    if (gen.retired || this.activeGen !== gen) return

    let textChunk = gen.stdoutDecoder.write(chunk)

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

    if (Buffer.byteLength(remainder, 'utf8') > maxBuffer) {
      console.warn(`ClaudeAdapter stdout line buffer exceeded ${maxBuffer} bytes, discarding line remainder`)
      gen.stdoutBuffer = ''
      gen.stdoutDiscardingUntilNewline = true
    } else {
      gen.stdoutBuffer = remainder
    }

    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line) continue
      if (Buffer.byteLength(rawLine, 'utf8') > maxBuffer) {
        console.warn(`ClaudeAdapter: oversized stdout line discarded`)
        continue
      }
      this.processStdoutLine(gen, line)
    }
  }

  private handleStderrChunk(gen: GenerationContext, chunk: Buffer): void {
    if (gen.retired || this.activeGen !== gen) return

    let textChunk = gen.stderrDecoder.write(chunk)

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
      console.warn(`ClaudeAdapter stderr line buffer exceeded ${maxBuffer} bytes, discarding line remainder`)
      gen.stderrBuffer = ''
      gen.stderrDiscardingUntilNewline = true
    } else {
      gen.stderrBuffer = remainder
    }

    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line) continue
      if (Buffer.byteLength(rawLine, 'utf8') > maxBuffer) {
        console.warn(`ClaudeAdapter: oversized stderr line discarded`)
        continue
      }
      this.processStderrLine(line)
    }
  }

  private processStderrLine(line: string): void {
    if (this.options.onRawLog) {
      this.options.onRawLog('stderr', line)
    }
    if (this.options.emitRawLogEvents) {
      this.emitEvent({
        eventId: this.createEventId('raw-stderr'),
        taskId: this.options.taskId,
        runId: this.options.runId,
        timestamp: Date.now(),
        type: 'raw.log',
        stream: 'stderr',
        line,
      } as RawLogEvent)
    }
  }

  private processStdoutLine(gen: GenerationContext, line: string): void {
    if (gen.retired || this.activeGen !== gen) return

    if (this.options.onRawLog) {
      this.options.onRawLog('stdout', line)
    }
    if (this.options.emitRawLogEvents) {
      this.emitEvent({
        eventId: this.createEventId('raw-stdout'),
        taskId: this.options.taskId,
        runId: this.options.runId,
        timestamp: Date.now(),
        type: 'raw.log',
        stream: 'stdout',
        line,
      } as RawLogEvent)
    }

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(line)
    } catch {
      return
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return
    if (this.handleControl(gen, parsed)) return

    if (this.options.toolPolicy === 'none') {
      const event = parsed.event as { content_block?: { type?: string }; delta?: { type?: string } } | undefined
      const message = parsed.message as { content?: Array<{ type?: string }> } | undefined
      const toolRecord = parsed.parent_tool_use_id != null
        || parsed.type === 'stream_event' && (event?.content_block?.type === 'tool_use' || event?.delta?.type === 'input_json_delta')
        || ['assistant', 'user'].includes(String(parsed.type)) && Array.isArray(message?.content) && message.content.some(item => ['tool_use', 'tool_result'].includes(String(item?.type)))
      if (toolRecord) {
        this.handleProcessError(gen, new Error('Claude returned tool activity in a tool-free session'))
        void this.stop(true).catch(() => {})
        return
      }
    }

    // Deduplicate exact wrapper UUIDs
    const uuid = typeof parsed.uuid === 'string' ? parsed.uuid : undefined
    if (uuid) {
      if (gen.seenUuids.has(uuid)) {
        return
      }
      gen.seenUuids.add(uuid)
      const maxTracked = this.options.maxTrackedRecords ?? 10000
      if (gen.seenUuids.size > maxTracked) {
        const first = gen.seenUuids.values().next().value
        if (first) gen.seenUuids.delete(first)
      }
    }

    // Subagent sessions must never replace the root conversation identity.
    if (parsed.parent_tool_use_id !== null && parsed.parent_tool_use_id !== undefined) return
    if (typeof parsed.session_id === 'string' && parsed.session_id) {
      if (gen.sessionId && gen.sessionId !== parsed.session_id) {
        if (parsed.type === 'system' && parsed.subtype === 'init' && this.options.resumeSessionId) {
          const error = 'Claude resumed an unexpected conversation; refusing to continue'
          this.finalizeActiveTurnOnTermination(gen, 'error', error)
          this.emitEvent({ eventId: this.createEventId('resume-error'), taskId: this.options.taskId, runId: this.options.runId, timestamp: Date.now(), type: 'agent.status.changed', scope: 'session', status: 'error', error })
          void this.stop(true).catch(() => {})
        }
        return
      }
      gen.sessionId = parsed.session_id
    }

    const type = String(parsed.type || '')
    if (type !== 'system' && !gen.activeTurnId) return

    switch (type) {
      case 'system':
        this.handleSystemRecord(gen, parsed)
        break
      case 'stream_event':
        this.handleStreamEventRecord(gen, parsed)
        break
      case 'assistant':
        this.handleAssistantRecord(gen, parsed)
        break
      case 'user':
        this.handleUserRecord(gen, parsed)
        break
      case 'result':
        this.handleResultRecord(gen, parsed)
        break
    }
  }

  private handleSystemRecord(gen: GenerationContext, parsed: Record<string, unknown>): void {
    if (typeof parsed.session_id === 'string' && parsed.session_id) {
      gen.sessionId = parsed.session_id
    }
  }

  private handleStreamEventRecord(gen: GenerationContext, parsed: Record<string, unknown>): void {
    const rawEvent = parsed.event
    if (!rawEvent || typeof rawEvent !== 'object') return
    const event = rawEvent as Record<string, unknown>
    const eventType = String(event.type || '')

    switch (eventType) {
      case 'message_start': {
        const rawMsg = (event.message || {}) as Record<string, unknown>
        const newMsgId = typeof rawMsg.id === 'string' && rawMsg.id ? rawMsg.id : undefined
        if (newMsgId) {
          if (gen.claudeMessageId && gen.claudeMessageId !== newMsgId) {
            gen.previousStepsText += this.reconstructCurrentStepText(gen)
            gen.claudeMessageId = newMsgId
            gen.blocks.clear()
            gen.maxStreamedTextBlockIndex = -1
            gen.maxStreamedThinkingBlockIndex = -1
          } else if (!gen.claudeMessageId) {
            gen.claudeMessageId = newMsgId
          }
        }
        break
      }
      case 'content_block_start':
        this.handleContentBlockStart(gen, event)
        break
      case 'content_block_delta':
        this.handleContentBlockDelta(gen, event)
        break
      case 'content_block_stop':
        this.handleContentBlockStop(gen, event)
        break
    }
  }

  private handleContentBlockStart(gen: GenerationContext, event: Record<string, unknown>): void {
    if (gen.turnBufferExceeded) return

    const index = typeof event.index === 'number' ? event.index : 0
    const state = this.getOrCreateBlock(gen, index, 'unknown', true)
    if (!state) return

    const rawBlock = event.content_block as Record<string, unknown> | undefined

    if (rawBlock && typeof rawBlock === 'object') {
      const blockType = String(rawBlock.type || '')
      if (blockType === 'text') {
        state.type = 'text'
        const initialText = typeof rawBlock.text === 'string' ? rawBlock.text : ''
        if (initialText) {
          const addedBytes = Buffer.byteLength(initialText, 'utf8')
          if (!this.checkTurnBufferLimit(gen, addedBytes)) return

          state.streamedText += initialText
          if (state.streamedText.length > state.publishedText.length) {
            const newDelta = state.streamedText.slice(state.publishedText.length)
            state.publishedText = state.streamedText

            gen.maxStreamedTextBlockIndex = Math.max(gen.maxStreamedTextBlockIndex, index)
            this.ensureMessageStarted(gen)
            if (gen.retired || this.activeGen !== gen || !gen.activeTurnId) return

            gen.turnAccumulatedText += newDelta
            this.emitEvent({
              eventId: this.createEventId('delta'),
              taskId: this.options.taskId,
              runId: this.options.runId,
              timestamp: Date.now(),
              type: 'message.delta',
              messageId: gen.activeMessageId!,
              deltaType: 'text',
              content: newDelta,
            } as MessageDeltaEvent)
          }
        }
      } else if (blockType === 'thinking') {
        state.type = 'thinking'
        const initialThinking = typeof rawBlock.thinking === 'string' ? rawBlock.thinking : ''
        if (initialThinking) {
          const addedBytes = Buffer.byteLength(initialThinking, 'utf8')
          if (!this.checkTurnBufferLimit(gen, addedBytes)) return

          state.streamedThinking += initialThinking
          if (state.streamedThinking.length > state.publishedThinking.length) {
            const newDelta = state.streamedThinking.slice(state.publishedThinking.length)
            state.publishedThinking = state.streamedThinking

            gen.maxStreamedThinkingBlockIndex = Math.max(gen.maxStreamedThinkingBlockIndex, index)
            this.ensureMessageStarted(gen)
            if (gen.retired || this.activeGen !== gen || !gen.activeTurnId) return

            gen.turnAccumulatedThinking += newDelta
            this.emitEvent({
              eventId: this.createEventId('delta-think'),
              taskId: this.options.taskId,
              runId: this.options.runId,
              timestamp: Date.now(),
              type: 'message.delta',
              messageId: gen.activeMessageId!,
              deltaType: 'thinking',
              content: newDelta,
            } as MessageDeltaEvent)
          }
        }
      } else if (blockType === 'tool_use') {
        state.type = 'tool_use'
        const toolId = String(rawBlock.id || `tool-${index}`)
        const toolName = String(rawBlock.name || 'tool')

        if (
          rawBlock.input !== undefined &&
          typeof rawBlock.input === 'object' &&
          rawBlock.input !== null &&
          Object.keys(rawBlock.input).length > 0
        ) {
          const inputBytes = Buffer.byteLength(JSON.stringify(rawBlock.input), 'utf8')
          if (!this.checkTurnBufferLimit(gen, inputBytes)) return
        }

        state.toolId = toolId
        state.toolName = toolName

        let tool = gen.activeTools.get(toolId)
        if (!tool) {
          const maxTracked = this.options.maxTrackedRecords ?? 10000
          if (gen.activeTools.size >= maxTracked) {
            this.triggerBufferOverflow(gen, `Turn active tool limit exceeded (${maxTracked} tools)`)
            return
          }
          if (!this.checkTurnBufferLimit(gen, 256)) return

          tool = {
            toolCallId: toolId,
            toolName,
            startedEmitted: false,
            completedEmitted: false,
          }
          gen.activeTools.set(toolId, tool)
        }

        if (
          rawBlock.input !== undefined &&
          typeof rawBlock.input === 'object' &&
          rawBlock.input !== null &&
          Object.keys(rawBlock.input).length > 0
        ) {
          state.toolInput = rawBlock.input
          state.toolArgumentsComplete = true
          tool.startedEmitted = true
          this.ensureMessageStarted(gen)
          if (gen.retired || this.activeGen !== gen || !gen.activeTurnId) return
          this.emitEvent({
            eventId: this.createEventId('tool-start'),
            taskId: this.options.taskId,
            runId: this.options.runId,
            timestamp: Date.now(),
            type: 'tool.started',
            toolCallId: toolId,
            toolName,
            input: rawBlock.input,
            parentMessageId: gen.activeMessageId,
            turnId: gen.activeTurnId,
          } as ToolStartedEvent)
        }
      }
    }
  }

  private handleContentBlockDelta(gen: GenerationContext, event: Record<string, unknown>): void {
    if (gen.turnBufferExceeded) return

    const index = typeof event.index === 'number' ? event.index : 0
    const delta = (event.delta || {}) as Record<string, unknown>
    const deltaType = String(delta.type || '')

    if (deltaType === 'text_delta') {
      const text = typeof delta.text === 'string' ? delta.text : ''
      if (!text) return

      const addedBytes = Buffer.byteLength(text, 'utf8')
      if (!this.checkTurnBufferLimit(gen, addedBytes)) return

      const block = this.getOrCreateBlock(gen, index, 'text')
      if (!block) return

      block.type = 'text'
      block.streamedText += text
      if (block.streamedText.length > block.publishedText.length) {
        const newDelta = block.streamedText.slice(block.publishedText.length)
        block.publishedText = block.streamedText

        gen.maxStreamedTextBlockIndex = Math.max(gen.maxStreamedTextBlockIndex, index)
        this.ensureMessageStarted(gen)
        if (gen.retired || this.activeGen !== gen || !gen.activeTurnId) return

        gen.turnAccumulatedText += newDelta
        this.emitEvent({
          eventId: this.createEventId('delta'),
          taskId: this.options.taskId,
          runId: this.options.runId,
          timestamp: Date.now(),
          type: 'message.delta',
          messageId: gen.activeMessageId!,
          deltaType: 'text',
          content: newDelta,
        } as MessageDeltaEvent)
      }
    } else if (deltaType === 'thinking_delta') {
      const thinking = typeof delta.thinking === 'string' ? delta.thinking : ''
      if (!thinking) return

      const addedBytes = Buffer.byteLength(thinking, 'utf8')
      if (!this.checkTurnBufferLimit(gen, addedBytes)) return

      const block = this.getOrCreateBlock(gen, index, 'thinking')
      if (!block) return

      block.type = 'thinking'
      block.streamedThinking += thinking
      if (block.streamedThinking.length > block.publishedThinking.length) {
        const newDelta = block.streamedThinking.slice(block.publishedThinking.length)
        block.publishedThinking = block.streamedThinking

        gen.maxStreamedThinkingBlockIndex = Math.max(gen.maxStreamedThinkingBlockIndex, index)
        this.ensureMessageStarted(gen)
        if (gen.retired || this.activeGen !== gen || !gen.activeTurnId) return

        gen.turnAccumulatedThinking += newDelta
        this.emitEvent({
          eventId: this.createEventId('delta-think'),
          taskId: this.options.taskId,
          runId: this.options.runId,
          timestamp: Date.now(),
          type: 'message.delta',
          messageId: gen.activeMessageId!,
          deltaType: 'thinking',
          content: newDelta,
        } as MessageDeltaEvent)
      }
    } else if (deltaType === 'input_json_delta') {
      const partial = typeof delta.partial_json === 'string' ? delta.partial_json : ''
      if (!partial) return

      const addedBytes = Buffer.byteLength(partial, 'utf8')
      if (!this.checkTurnBufferLimit(gen, addedBytes)) return

      const block = this.getOrCreateBlock(gen, index, 'tool_use')
      if (!block) return

      block.type = 'tool_use'
      block.toolInputJson += partial
    }
  }

  private handleContentBlockStop(gen: GenerationContext, event: Record<string, unknown>): void {
    const index = typeof event.index === 'number' ? event.index : 0
    const block = gen.blocks.get(index)
    if (!block) return

    if (block.type === 'tool_use' && block.toolId) {
      block.toolArgumentsComplete = true
      let parsedInput: unknown = block.toolInput
      if (parsedInput === undefined && block.toolInputJson) {
        try {
          parsedInput = JSON.parse(block.toolInputJson)
        } catch {
          parsedInput = block.toolInputJson
        }
      }
      block.toolInput = parsedInput

      const tool = gen.activeTools.get(block.toolId)
      if (tool && !tool.startedEmitted) {
        tool.startedEmitted = true
        this.ensureMessageStarted(gen)
        if (gen.retired || this.activeGen !== gen || !gen.activeTurnId) return
        this.emitEvent({
          eventId: this.createEventId('tool-start'),
          taskId: this.options.taskId,
          runId: this.options.runId,
          timestamp: Date.now(),
          type: 'tool.started',
          toolCallId: tool.toolCallId,
          toolName: tool.toolName,
          input: parsedInput ?? {},
          parentMessageId: gen.activeMessageId,
          turnId: gen.activeTurnId,
        } as ToolStartedEvent)
      }
    }
  }

  /**
   * Reconciles assistant snapshot records against accumulated stream deltas.
   * Matches blocks by identity and type rather than raw array indices,
   * publishes missing suffixes, parses tool inputs, and prevents duplicate emissions.
   */
  private handleAssistantRecord(gen: GenerationContext, parsed: Record<string, unknown>): void {
    if (gen.turnBufferExceeded) return

    const message = (parsed.message || {}) as Record<string, unknown>
    const msgId = typeof message.id === 'string' && message.id ? message.id : undefined
    if (msgId) {
      if (gen.claudeMessageId && gen.claudeMessageId !== msgId) {
        gen.previousStepsText += this.reconstructCurrentStepText(gen)
        gen.claudeMessageId = msgId
        gen.blocks.clear()
        gen.maxStreamedTextBlockIndex = -1
        gen.maxStreamedThinkingBlockIndex = -1
      } else if (!gen.claudeMessageId) {
        gen.claudeMessageId = msgId
      }
    }

    const content = Array.isArray(message.content) ? message.content : []

    for (let i = 0; i < content.length; i++) {
      if (gen.turnBufferExceeded) return
      const itemRecord = (content[i] || {}) as Record<string, unknown>
      const itemType = String(itemRecord.type || '')
      const blockIndex = typeof itemRecord.index === 'number' ? itemRecord.index : i

      if (itemType === 'text') {
        const snapshotText = typeof itemRecord.text === 'string' ? itemRecord.text : ''
        const existingBlock = gen.blocks.get(blockIndex)
        const currentPublished = existingBlock?.publishedText || ''

        let suffix = ''
        if (snapshotText.startsWith(currentPublished)) {
          suffix = snapshotText.slice(currentPublished.length)
        } else if (snapshotText.length > currentPublished.length) {
          suffix = snapshotText.slice(currentPublished.length)
        }

        const currentBytes = Buffer.byteLength(currentPublished, 'utf8')
        const snapshotBytes = Buffer.byteLength(snapshotText, 'utf8')
        const suffixBytes = Buffer.byteLength(suffix, 'utf8')
        const snapshotGrowth = snapshotBytes > currentBytes ? snapshotBytes - currentBytes : 0
        const addedBytes = Math.max(suffixBytes, snapshotGrowth)

        if (addedBytes > 0) {
          if (!this.checkTurnBufferLimit(gen, addedBytes)) return
        }

        const block = this.getOrCreateBlock(gen, blockIndex, 'text')
        if (!block) return
        block.type = 'text'
        block.toolArgumentsComplete = true

        if (suffix) {
          block.publishedText = snapshotText
          const shouldEmitDelta = blockIndex >= gen.maxStreamedTextBlockIndex
          if (shouldEmitDelta) {
            gen.maxStreamedTextBlockIndex = Math.max(gen.maxStreamedTextBlockIndex, blockIndex)
            this.ensureMessageStarted(gen)
            if (gen.retired || this.activeGen !== gen || !gen.activeTurnId) return

            gen.turnAccumulatedText += suffix
            this.emitEvent({
              eventId: this.createEventId('delta-suffix'),
              taskId: this.options.taskId,
              runId: this.options.runId,
              timestamp: Date.now(),
              type: 'message.delta',
              messageId: gen.activeMessageId!,
              deltaType: 'text',
              content: suffix,
            } as MessageDeltaEvent)
          }
        }
      } else if (itemType === 'thinking') {
        const snapshotThinking = typeof itemRecord.thinking === 'string' ? itemRecord.thinking : ''
        const existingBlock = gen.blocks.get(blockIndex)
        const currentPublished = existingBlock?.publishedThinking || ''

        let suffix = ''
        if (snapshotThinking.startsWith(currentPublished)) {
          suffix = snapshotThinking.slice(currentPublished.length)
        } else if (snapshotThinking.length > currentPublished.length) {
          suffix = snapshotThinking.slice(currentPublished.length)
        }

        const currentBytes = Buffer.byteLength(currentPublished, 'utf8')
        const snapshotBytes = Buffer.byteLength(snapshotThinking, 'utf8')
        const suffixBytes = Buffer.byteLength(suffix, 'utf8')
        const snapshotGrowth = snapshotBytes > currentBytes ? snapshotBytes - currentBytes : 0
        const addedBytes = Math.max(suffixBytes, snapshotGrowth)

        if (addedBytes > 0) {
          if (!this.checkTurnBufferLimit(gen, addedBytes)) return
        }

        const block = this.getOrCreateBlock(gen, blockIndex, 'thinking')
        if (!block) return
        block.type = 'thinking'
        block.toolArgumentsComplete = true

        if (suffix) {
          block.publishedThinking = snapshotThinking
          const shouldEmitDelta = blockIndex >= gen.maxStreamedThinkingBlockIndex
          if (shouldEmitDelta) {
            gen.maxStreamedThinkingBlockIndex = Math.max(gen.maxStreamedThinkingBlockIndex, blockIndex)
            this.ensureMessageStarted(gen)
            if (gen.retired || this.activeGen !== gen || !gen.activeTurnId) return

            gen.turnAccumulatedThinking += suffix
            this.emitEvent({
              eventId: this.createEventId('delta-think-suffix'),
              taskId: this.options.taskId,
              runId: this.options.runId,
              timestamp: Date.now(),
              type: 'message.delta',
              messageId: gen.activeMessageId!,
              deltaType: 'thinking',
              content: suffix,
            } as MessageDeltaEvent)
          }
        }
      } else if (itemType === 'tool_use') {
        const toolId = String(itemRecord.id || `tool-${blockIndex}`)
        const toolName = String(itemRecord.name || 'tool')

        const block = this.getOrCreateBlock(gen, blockIndex, 'tool_use')
        if (!block) return
        block.type = 'tool_use'
        block.toolId = toolId
        block.toolName = toolName
        block.toolArgumentsComplete = true

        let tool = gen.activeTools.get(toolId)
        const isNewTool = !tool
        if (!tool) {
          const maxTracked = this.options.maxTrackedRecords ?? 10000
          if (gen.activeTools.size >= maxTracked) {
            this.triggerBufferOverflow(gen, `Turn active tool limit exceeded (${maxTracked} tools)`)
            return
          }
          if (!this.checkTurnBufferLimit(gen, 256)) return

          tool = {
            toolCallId: toolId,
            toolName,
            startedEmitted: false,
            completedEmitted: false,
          }
        }

        const parsedInput = itemRecord.input !== undefined ? itemRecord.input : undefined
        if (!tool.startedEmitted && parsedInput !== undefined) {
          let inputBytes = 0
          try {
            inputBytes = Buffer.byteLength(
              typeof parsedInput === 'string'
                ? parsedInput
                : JSON.stringify(parsedInput),
              'utf8'
            )
          } catch {
            inputBytes = 0
          }
          if (inputBytes > 0) {
            if (!this.checkTurnBufferLimit(gen, inputBytes)) return
          }
        }

        if (isNewTool) {
          gen.activeTools.set(toolId, tool)
        }

        if (!tool.startedEmitted) {
          tool.startedEmitted = true
          this.ensureMessageStarted(gen)
          if (gen.retired || this.activeGen !== gen || !gen.activeTurnId) return
          this.emitEvent({
            eventId: this.createEventId('tool-start-snap'),
            taskId: this.options.taskId,
            runId: this.options.runId,
            timestamp: Date.now(),
            type: 'tool.started',
            toolCallId: toolId,
            toolName,
            input: parsedInput ?? {},
            parentMessageId: gen.activeMessageId,
            turnId: gen.activeTurnId,
          } as ToolStartedEvent)
        }
      }
    }
  }

  /**
   * Handles stdout record of type "user" containing tool_result blocks.
   * This is where tools actually finish executing.
   */
  private handleUserRecord(gen: GenerationContext, parsed: Record<string, unknown>): void {
    const message = (parsed.message || {}) as Record<string, unknown>
    const content = Array.isArray(message.content) ? message.content : []

    for (const item of content) {
      if (!item || typeof item !== 'object') continue
      const itemRecord = item as Record<string, unknown>
      if (itemRecord.type === 'tool_result') {
        const toolCallId = String(itemRecord.tool_use_id || '')
        if (!toolCallId) continue

        let tool = gen.activeTools.get(toolCallId)
        if (!tool) {
          const maxTracked = this.options.maxTrackedRecords ?? 10000
          if (gen.activeTools.size >= maxTracked) {
            this.triggerBufferOverflow(gen, `Turn active tool limit exceeded (${maxTracked} tools)`)
            return
          }
          if (!this.checkTurnBufferLimit(gen, 256)) return

          tool = {
            toolCallId,
            toolName: 'tool',
            startedEmitted: true,
            completedEmitted: false,
          }
          gen.activeTools.set(toolCallId, tool)
          this.ensureMessageStarted(gen)
          this.emitEvent({
            eventId: this.createEventId('tool-start-pre-result-new'),
            taskId: this.options.taskId,
            runId: this.options.runId,
            timestamp: Date.now(),
            type: 'tool.started',
            toolCallId,
            toolName: tool.toolName,
            parentMessageId: gen.activeMessageId,
            turnId: gen.activeTurnId,
          } as ToolStartedEvent)
        } else if (!tool.startedEmitted) {
          tool.startedEmitted = true
          this.ensureMessageStarted(gen)
          this.emitEvent({
            eventId: this.createEventId('tool-start-pre-result'),
            taskId: this.options.taskId,
            runId: this.options.runId,
            timestamp: Date.now(),
            type: 'tool.started',
            toolCallId,
            toolName: tool.toolName,
            parentMessageId: gen.activeMessageId,
            turnId: gen.activeTurnId,
          } as ToolStartedEvent)
        }

        if (tool.completedEmitted) continue
        tool.completedEmitted = true

        const isError = Boolean(itemRecord.is_error)
        let outputStr = ''
        if (typeof itemRecord.content === 'string') {
          outputStr = itemRecord.content
        } else if (itemRecord.content !== undefined) {
          try {
            outputStr = JSON.stringify(itemRecord.content)
          } catch {
            outputStr = String(itemRecord.content)
          }
        }

        this.emitEvent({
          eventId: this.createEventId('tool-done'),
          taskId: this.options.taskId,
          runId: this.options.runId,
          timestamp: Date.now(),
          type: 'tool.completed',
          toolCallId,
          output: outputStr,
          isError,
          outcome: isError ? 'failed' : 'completed',
        } as ToolCompletedEvent)
      }
    }
    // Retain gen.claudeMessageId until the next upstream message boundary
    // so that message_start can detect the transition and cleanly reset block state.
  }

  /**
   * Handles stdout record of type "result".
   * This is the final event of the turn, indicating success or error.
   */
  private handleResultRecord(gen: GenerationContext, parsed: Record<string, unknown>): void {
    if (gen.turnBufferExceeded || !gen.activeTurnId) return

    const resultRecord = parsed
    const subtype = String(resultRecord.subtype || '')
    const errorsList = Array.isArray(resultRecord.errors)
      ? resultRecord.errors
          .map((e) => (typeof e === 'string' ? e : JSON.stringify(e)))
          .filter(Boolean)
          .join('; ')
      : ''

    const isError =
      Boolean(resultRecord.is_error) ||
      subtype === 'error' ||
      subtype === 'failed' ||
      Boolean(errorsList)

    if (isError) {
      const errMessage =
        errorsList ||
        (typeof resultRecord.result === 'string' && resultRecord.result
          ? resultRecord.result
          : typeof resultRecord.error === 'string' && resultRecord.error
          ? resultRecord.error
          : 'Claude execution resulted in an error')

      this.currentStatus = 'idle'
      this.finalizeActiveTurnOnTermination(gen, gen.interruptingTurnId === gen.activeTurnId ? 'interrupted' : 'error', errMessage)
      return
    }

    // Success result
    this.ensureMessageStarted(gen)
    if (gen.retired || !gen.activeTurnId || !gen.activeMessageId) return

    const currentStepText = this.reconstructCurrentStepText(gen)
    const currentTurnText = this.reconstructTurnText(gen) || gen.turnAccumulatedText
    let targetFullText = currentTurnText

    // Reconcile any missing suffix from resultRecord.result against accumulated text
    if (typeof resultRecord.result === 'string' && resultRecord.result) {
      const resText = resultRecord.result
      if (gen.previousStepsText) {
        const stepCandidate = gen.previousStepsText + resText
        const hasCurrentStepPrefix = Boolean(
          currentStepText && resText.startsWith(currentStepText)
        )

        if (hasCurrentStepPrefix) {
          // Confirmed prefix of the current step takes highest priority
          targetFullText = stepCandidate
        } else if (resText.startsWith(currentTurnText)) {
          // Full turn match (e.g. steps 'A', 'B' and resText = 'AB' or 'ABC')
          targetFullText = resText
        } else if (stepCandidate.startsWith(currentTurnText)) {
          // Step candidate extends current turn (e.g. step 2 had no streamed text yet)
          targetFullText = stepCandidate
        } else if (resText.length > currentTurnText.length) {
          targetFullText = resText
        } else if (stepCandidate.length >= currentTurnText.length) {
          targetFullText = stepCandidate
        }
      } else if (resText.startsWith(currentTurnText) || resText.length > currentTurnText.length) {
        targetFullText = resText
      }

      // Reconcile missing suffix or new text and strictly enforce memory limit
      const currentBytes = Buffer.byteLength(currentTurnText, 'utf8')
      const targetBytes = Buffer.byteLength(targetFullText, 'utf8')

      if (targetBytes > currentBytes) {
        const addedBytes = targetBytes - currentBytes
        if (!this.checkTurnBufferLimit(gen, addedBytes)) return
      }

      if (targetFullText.startsWith(currentTurnText)) {
        const missingSuffix = targetFullText.slice(currentTurnText.length)
        if (missingSuffix) {
          gen.turnAccumulatedText += missingSuffix
          this.emitEvent({
            eventId: this.createEventId('delta-res'),
            taskId: this.options.taskId,
            runId: this.options.runId,
            timestamp: Date.now(),
            type: 'message.delta',
            messageId: gen.activeMessageId,
            deltaType: 'text',
            content: missingSuffix,
          } as MessageDeltaEvent)
        }
      } else if (!currentTurnText && targetFullText) {
        gen.turnAccumulatedText = targetFullText
        this.emitEvent({
          eventId: this.createEventId('delta-res-init'),
          taskId: this.options.taskId,
          runId: this.options.runId,
          timestamp: Date.now(),
          type: 'message.delta',
          messageId: gen.activeMessageId,
          deltaType: 'text',
          content: targetFullText,
        } as MessageDeltaEvent)
      }
    }

    if (gen.turnCompletedEmitted || !gen.activeTurnId) return

    const fullContent = targetFullText
    const messageId = gen.activeMessageId
    const turnId = gen.activeTurnId
    const toolsToComplete = Array.from(gen.activeTools.values())

    // Complete any uncompleted tools implicitly
    for (const tool of toolsToComplete) {
      if (!tool.startedEmitted) {
        tool.startedEmitted = true
        this.ensureMessageStarted(gen)
        this.emitEvent({
          eventId: this.createEventId('tool-start-implicit'),
          taskId: this.options.taskId,
          runId: this.options.runId,
          timestamp: Date.now(),
          type: 'tool.started',
          toolCallId: tool.toolCallId,
          toolName: tool.toolName,
          parentMessageId: messageId,
          turnId,
        } as ToolStartedEvent)
      }
      if (!tool.completedEmitted) {
        tool.completedEmitted = true
        this.emitEvent({
          eventId: this.createEventId('tool-done-implicit'),
          taskId: this.options.taskId,
          runId: this.options.runId,
          timestamp: Date.now(),
          type: 'tool.completed',
          toolCallId: tool.toolCallId,
          output: '',
          isError: false,
          outcome: 'completed',
        } as ToolCompletedEvent)
      }
      if (gen.turnCompletedEmitted || gen.retired || this.activeGen !== gen || this.isStopped || this.isStopping) {
        return
      }
    }

    if (gen.turnCompletedEmitted || gen.retired || this.activeGen !== gen || this.isStopped || this.isStopping) {
      return
    }

    const interrupted = gen.interruptingTurnId === turnId
    gen.interruptingTurnId = undefined
    gen.turnCompletedEmitted = true
    gen.activeTurnId = undefined
    gen.activeMessageId = undefined
    gen.messageStartedEmitted = false
    gen.turnAccumulatedText = ''
    gen.turnAccumulatedThinking = ''
    gen.turnTotalBytes = 0
    gen.blocks.clear()
    gen.activeTools.clear()

    this.expireApprovals(gen, turnId)
    if (this.activeGen === gen && !gen.activeTurnId && !this.isStopping && !this.isStopped) this.currentStatus = 'idle'

    if (messageId) {
      this.emitEvent({
        eventId: this.createEventId('msg-done'),
        taskId: this.options.taskId,
        runId: this.options.runId,
        timestamp: Date.now(),
        type: 'message.completed',
        turnId,
        messageId,
        fullContent,
        finishReason: interrupted ? 'interrupted' : 'stop',
      } as MessageCompletedEvent)
    }

    this.emitEvent({ ...this.eventBase(), type: 'agent.status.changed', scope: 'turn', turnId, status: interrupted ? 'stopped' : 'completed' })
  }

  // ---------------------------------------------------------------------------
  // Internal Process Lifecycle Helpers
  // ---------------------------------------------------------------------------

  private handleProcessError(gen: GenerationContext, err: Error): void {
    if (gen.retired || this.activeGen !== gen) return

    this.currentStatus = 'error'
    this.finalizeActiveTurnOnTermination(gen, 'error', err.message)

    this.emitEvent({
      eventId: this.createEventId('err-proc'),
      taskId: this.options.taskId,
      runId: this.options.runId,
      timestamp: Date.now(),
      type: 'agent.status.changed',
      status: 'error',
      error: `Claude process error: ${err.message}`,
    } as AgentStatusChangedEvent)
  }

  private flushBuffers(gen: GenerationContext): void {
    const stdoutTail = gen.stdoutDecoder.end()
    if (stdoutTail) gen.stdoutBuffer += stdoutTail

    const stderrTail = gen.stderrDecoder.end()
    if (stderrTail) gen.stderrBuffer += stderrTail

    if (gen.stdoutBuffer.trim()) {
      const lines = gen.stdoutBuffer.split('\n')
      gen.stdoutBuffer = ''
      for (const rawLine of lines) {
        const line = rawLine.trim()
        if (line) this.processStdoutLine(gen, line)
      }
    }

    if (gen.stderrBuffer.trim()) {
      const lines = gen.stderrBuffer.split('\n')
      gen.stderrBuffer = ''
      for (const rawLine of lines) {
        const line = rawLine.trim()
        if (line) this.processStderrLine(line)
      }
    }
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

  private triggerBufferOverflow(gen: GenerationContext, reason: string): void {
    if (gen.turnBufferExceeded) return
    gen.turnBufferExceeded = true
    const err = new Error(reason)
    this.currentStatus = 'error'
    gen.turnAccumulatedText = ''
    gen.turnAccumulatedThinking = ''
    gen.previousStepsText = ''
    gen.blocks.clear()
    this.finalizeActiveTurnOnTermination(gen, 'error', err.message)
    gen.activeTools.clear()
    this.emitEvent({
      eventId: this.createEventId('err-turn-oom'),
      taskId: this.options.taskId,
      runId: this.options.runId,
      timestamp: Date.now(),
      type: 'agent.status.changed',
      status: 'error',
      error: err.message,
    } as AgentStatusChangedEvent)
  }

  private getOrCreateBlock(
    gen: GenerationContext,
    index: number,
    defaultType: 'text' | 'thinking' | 'tool_use' | 'unknown' = 'unknown',
    resetIfExists = false
  ): BlockState | undefined {
    if (gen.turnBufferExceeded) return undefined

    let block = gen.blocks.get(index)
    if (!block) {
      const maxTracked = this.options.maxTrackedRecords ?? 10000
      if (gen.blocks.size >= maxTracked) {
        this.triggerBufferOverflow(gen, `Turn block limit exceeded (${maxTracked} blocks)`)
        return undefined
      }

      if (!this.checkTurnBufferLimit(gen, 256)) {
        return undefined
      }

      block = {
        type: defaultType,
        streamedText: '',
        publishedText: '',
        streamedThinking: '',
        publishedThinking: '',
        toolInputJson: '',
        toolArgumentsComplete: false,
      }
      gen.blocks.set(index, block)
    } else if (resetIfExists) {
      block.type = defaultType
      block.streamedText = ''
      block.publishedText = ''
      block.streamedThinking = ''
      block.publishedThinking = ''
      block.toolId = undefined
      block.toolName = undefined
      block.toolInputJson = ''
      block.toolInput = undefined
      block.toolArgumentsComplete = false
    }
    return block
  }

  private checkTurnBufferLimit(gen: GenerationContext, addedBytes: number): boolean {
    if (gen.turnBufferExceeded) {
      return false
    }
    gen.turnTotalBytes += addedBytes
    const max = this.options.maxTurnBufferBytes ?? DEFAULT_MAX_TURN_BUFFER_BYTES
    if (gen.turnTotalBytes > max) {
      this.triggerBufferOverflow(gen, `Turn buffer exceeded ${max} bytes`)
      return false
    }
    return true
  }

  private terminateGenerationProcess(gen: GenerationContext, force = false): Promise<void> {
    if (gen.terminationPromise) {
      return gen.terminationPromise
    }

    const pid = gen.proc.pid
    const timeout = this.options.killTimeoutMs ?? DEFAULT_KILL_TIMEOUT_MS
    const graceTimeout = Math.min(timeout, this.options.killGraceMs ?? DEFAULT_KILL_GRACE_MS)

    gen.terminating = true

    const termPromise = (async () => {
      try {
        if (!pid || pid <= 0 || this.isProcessExited(gen.proc)) {
          if (pid && pid > 0) {
            const killed = await this.supervisor.terminateProcessTree(pid, {
              timeoutMs: graceTimeout,
              force: true,
            })
            if (!killed) {
              throw new Error(
                `Failed to terminate descendant processes for process tree [pid: ${pid}]`
              )
            }
          }
          gen.descendantsSurviving = false
          return
        }

        let treeKilled = true

        // 1. Process tree termination via supervisor
        const supervisorPromise = (async () => {
          if (pid && pid > 0) {
            try {
              const killed = await this.supervisor.terminateProcessTree(pid, {
                timeoutMs: timeout,
                force,
              })
              if (!killed && !force) {
                const forceKilled = await this.supervisor.terminateProcessTree(pid, {
                  timeoutMs: graceTimeout,
                  force: true,
                })
                if (!forceKilled) {
                  treeKilled = false
                }
              } else if (!killed && force) {
                treeKilled = false
              }
            } catch (err) {
              console.error('ClaudeAdapter: supervisor terminateProcessTree failed:', err)
              treeKilled = false
            }
          }
        })()

        // 2. Direct process exit promise
        const rootExitPromise = new Promise<void>((resolve, reject) => {
          let isSettled = false
          let killTimer: NodeJS.Timeout | undefined

          const cleanup = () => {
            if (killTimer) clearTimeout(killTimer)
            gen.proc.removeListener('close', onClose)
            gen.proc.removeListener('exit', onExit)
          }

          const settle = () => {
            if (!isSettled) {
              isSettled = true
              cleanup()
              resolve()
            }
          }

          const onExit = () => {
            setTimeout(() => settle(), graceTimeout)
          }

          const onClose = () => {
            settle()
          }

          gen.proc.once('exit', onExit)
          gen.proc.once('close', onClose)

          if (force) {
            try {
              gen.proc.kill('SIGKILL')
            } catch (killErr) {
              console.error(`ClaudeAdapter: kill failed:`, killErr)
              if (!isSettled) {
                isSettled = true
                cleanup()
                reject(killErr)
                return
              }
            }

            killTimer = setTimeout(() => {
              if (!isSettled) {
                if (!this.isProcessExited(gen.proc)) {
                  isSettled = true
                  cleanup()
                  reject(
                    new Error(
                      `Failed to terminate child process [pid: ${gen.proc.pid}] within ${timeout}ms`
                    )
                  )
                } else {
                  settle()
                }
              }
            }, timeout)
          } else {
            try {
              gen.proc.kill('SIGTERM')
            } catch (killErr) {
              console.error(`ClaudeAdapter: SIGTERM failed:`, killErr)
              if (!isSettled) {
                isSettled = true
                cleanup()
                reject(killErr)
                return
              }
            }

            // After initial timeout, escalate to SIGKILL and give an async grace period for exit delivery
            killTimer = setTimeout(() => {
              if (!isSettled && !this.isProcessExited(gen.proc)) {
                try {
                  gen.proc.kill('SIGKILL')
                } catch (killErr) {
                  console.error(`ClaudeAdapter: graceful escalation to SIGKILL failed:`, killErr)
                }

                // Secondary grace period: allow SIGKILL exit delivery to arrive asynchronously
                killTimer = setTimeout(() => {
                  if (this.isProcessExited(gen.proc)) {
                    settle()
                  } else {
                    if (!isSettled) {
                      isSettled = true
                      cleanup()
                      reject(
                        new Error(
                          `Failed to terminate child process [pid: ${gen.proc.pid}] within ${timeout}ms`
                        )
                      )
                    }
                  }
                }, graceTimeout)
              } else {
                settle()
              }
            }, timeout)
          }
        })

        // Wait for both root process exit and supervisor process tree termination
        await Promise.all([rootExitPromise, supervisorPromise])

        if (!treeKilled) {
          throw new Error(
            `Failed to terminate descendant processes for process tree [pid: ${pid}]`
          )
        }
        gen.descendantsSurviving = false
      } catch (err) {
        gen.descendantsSurviving = true
        throw err
      } finally {
        gen.terminating = false
        gen.terminationPromise = undefined
      }
    })()

    gen.terminationPromise = termPromise
    return termPromise
  }

  private retireGeneration(gen: GenerationContext, err?: Error): void {
    gen.retired = true
    for (const pending of gen.controls.values()) { clearTimeout(pending.timer); pending.reject(err ?? new Error('Generation retired')) }
    gen.controls.clear()
    this.expireApprovals(gen)

    for (const pending of gen.pendingStdinWrites) {
      if (pending.timer) clearTimeout(pending.timer)
      pending.reject(err ?? new Error('Generation retired'))
    }
    gen.pendingStdinWrites.clear()

    gen.proc.removeAllListeners('data')
    gen.proc.removeAllListeners('error')
    gen.proc.on('error', () => {})

    if (gen.proc.stdin) {
      gen.proc.stdin.removeAllListeners()
      gen.proc.stdin.on('error', () => {})
    }
    if (gen.proc.stdout) {
      gen.proc.stdout.removeAllListeners()
      gen.proc.stdout.on('error', () => {})
    }
    if (gen.proc.stderr) {
      gen.proc.stderr.removeAllListeners()
      gen.proc.stderr.on('error', () => {})
    }
  }

  private isProcessExited(proc: ChildProcess): boolean {
    return (
      (proc.exitCode !== null && proc.exitCode !== undefined) ||
      (proc.signalCode !== null && proc.signalCode !== undefined)
    )
  }

  private emitEvent(event: AgentEvent): void {
    if (event.type === 'agent.status.changed') event = { ...event, scope: event.scope ?? 'session' }
    else if (event.type !== 'raw.log' && !event.turnId) event = { ...event, turnId: this.activeGen?.activeTurnId }
    if (this.options.onEvent) {
      this.options.onEvent(event)
    }
  }

  private createEventId(prefix: string): string {
    return `${prefix}-${++this.eventCounter}-${Date.now()}`
  }
}
