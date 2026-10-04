import { ChildProcess, SpawnOptions } from 'node:child_process'
import { AgentEvent, ApprovalDecision } from '../../shared/agent-events'
import {
  AgentProviderType,
  AgentRunStatus,
  SendPromptRequest,
  ResolveApprovalRequest,
} from '../../shared/agent-commands'
import { CodexAdapter, CodexAdapterOptions } from './CodexAdapter'
import { AntigravityAdapter, AntigravityAdapterOptions } from './AntigravityAdapter'
import { ClaudeAdapter, ClaudeAdapterOptions } from './ClaudeAdapter'
import { ProcessSupervisor } from '../runtime/ProcessSupervisor'
import { ApiAdapter, API_CAPABILITIES, type ApiAdapterOptions } from './ApiAdapter'

/**
 * Common polymorphic interface fulfilled by all agent adapters
 */
export interface AgentAdapter {
  start(): Promise<{ pid?: number; sessionId?: string; threadId?: string; conversationId?: string }>
  sendPrompt(request: SendPromptRequest): Promise<{ turnId: string }>
  /** Acknowledges interruption; wait for matching turn completion before sending again. */
  interruptTurn?(expectedTurnId?: string): Promise<{ turnId: string }>
  resolveApproval(
    approvalIdOrRequest: string | ResolveApprovalRequest,
    decision?: ApprovalDecision | string,
    note?: string
  ): Promise<void>
  stop(force?: boolean): Promise<void>
  getStatus(): AgentRunStatus
  getPid(): number | undefined
  getSessionId(): string | undefined
  getCapabilities(): AgentCapabilities
  getProvider(): AgentProviderType
  getTaskId(): string
  getRunId(): string
}

/**
 * Capability profile defining what an agent provider supports
 */
export interface AgentCapabilities {
  textStreaming: boolean
  toolCalls: boolean
  thinkingStreaming: boolean
  toolOutputStreaming: boolean
  interactiveApprovals: boolean
  attachments: boolean
}

export const CODEX_CAPABILITIES: AgentCapabilities = Object.freeze({
  textStreaming: true,
  toolCalls: true,
  thinkingStreaming: true,
  toolOutputStreaming: true,
  interactiveApprovals: true,
  attachments: false,
})

export const ANTIGRAVITY_CAPABILITIES: AgentCapabilities = Object.freeze({
  textStreaming: true,
  toolCalls: true,
  thinkingStreaming: false,
  toolOutputStreaming: false,
  interactiveApprovals: false,
  attachments: false,
})

export const CLAUDE_CAPABILITIES: AgentCapabilities = Object.freeze({
  textStreaming: true,
  toolCalls: true,
  thinkingStreaming: true,
  toolOutputStreaming: false,
  interactiveApprovals: true,
  attachments: false,
})

export interface CreateAdapterOptions {
  taskId: string
  runId?: string
  worktreePath: string
  agentProvider?: AgentProviderType | string
  reasoningEffort?: string | null
  model?: string
  supervisor?: ProcessSupervisor
  onEvent?: (event: AgentEvent) => void
  onRawLog?: (stream: 'stdout' | 'stderr', line: string) => void
  apiConnection?: ApiAdapterOptions['connection']
  apiHistoryDirectory?: string
  apiResumeSessionId?: string
  apiReadOnly?: boolean
  toolPolicy?: 'none'
  spawnProcess?: (command: string, args: string[], options: SpawnOptions) => ChildProcess

  // Binary overrides
  codexResumeThreadId?: string
  claudeResumeSessionId?: string
  claudeSessionId?: string
  codexBinPath?: string
  approvalPolicy?: CodexAdapterOptions['approvalPolicy']
  sandbox?: CodexAdapterOptions['sandbox']
  env?: Record<string, string | undefined>
  agyBinPath?: string
  claudeBinPath?: string
  claudePermissionMode?: ClaudeAdapterOptions['permissionMode']
  agyPermissionMode?: 'cli-settings' | 'dangerously-skip'
  agyMode?: 'plan'
  agyConversationId?: string

  // Timeouts & buffer bounds
  startupTimeoutMs?: number
  stdinWriteTimeoutMs?: number
  killTimeoutMs?: number
  killGraceMs?: number
  maxLineBufferBytes?: number
  maxTurnBufferBytes?: number
  maxTrackedRecords?: number
  emitRawLogEvents?: boolean
}

interface CustomProviderRegistration {
  capabilities: AgentCapabilities
  factory: (options: CreateAdapterOptions) => AgentAdapter
}

const BUILTIN_CAPABILITIES = new Map<string, AgentCapabilities>([
  ['codex', CODEX_CAPABILITIES],
  ['antigravity', ANTIGRAVITY_CAPABILITIES],
  ['claude', CLAUDE_CAPABILITIES],
  ['api', API_CAPABILITIES],
])

/**
 * Factory and capability gating service for agent adapters.
 */
export class AgentAdapterFactory {
  private static customProviders = new Map<string, CustomProviderRegistration>()

  /**
   * Registers an external or custom agent provider adapter.
   */
  static registerProvider(
    provider: string,
    capabilities: AgentCapabilities,
    factory: (options: CreateAdapterOptions) => AgentAdapter
  ): void {
    const key = provider.toLowerCase().trim()
    if (!key) {
      throw new Error('Provider name cannot be empty')
    }
    if (BUILTIN_CAPABILITIES.has(key)) {
      throw new Error(`Cannot override built-in provider: "${provider}"`)
    }
    this.customProviders.set(key, {
      capabilities: Object.freeze({ ...capabilities }),
      factory,
    })
  }

  /**
   * Unregisters a previously registered custom agent provider adapter.
   */
  static unregisterProvider(provider: string): void {
    const key = provider.toLowerCase().trim()
    this.customProviders.delete(key)
  }

  /**
   * Returns a list of all currently supported provider keys.
   */
  static getSupportedProviders(): string[] {
    return ['codex', 'antigravity', 'claude', 'api', ...Array.from(this.customProviders.keys())]
  }

  /**
   * Resolves the canonical agent provider key from explicit provider or model inference.
   */
  static resolveProvider(provider?: string, model?: string): AgentProviderType | string {
    if (provider && provider.trim()) {
      const normalized = provider.toLowerCase().trim()
      if (BUILTIN_CAPABILITIES.has(normalized) || this.customProviders.has(normalized)) {
        return normalized
      }
      throw new Error(`Unsupported agent provider: "${provider}"`)
    }

    if (model && model.trim()) {
      const lowerModel = model.toLowerCase().trim()

      const hasPrefix = (prefixes: string[]): boolean => {
        return prefixes.some((p) => {
          return (
            lowerModel === p ||
            lowerModel.startsWith(`${p}-`) ||
            lowerModel.startsWith(`${p}/`) ||
            lowerModel.startsWith(`${p}:`) ||
            lowerModel.startsWith(`${p}_`)
          )
        })
      }

      if (hasPrefix(['claude', 'anthropic'])) {
        return 'claude'
      }
      if (hasPrefix(['gemini', 'agy', 'antigravity', 'google'])) {
        return 'antigravity'
      }
      if (hasPrefix(['gpt', 'o1', 'o3', 'o4', 'codex', 'openai'])) {
        return 'codex'
      }
    }

    // Default provider
    return 'codex'
  }

  /**
   * Returns the capabilities profile for a provider.
   */
  static getCapabilities(provider: AgentProviderType | string): AgentCapabilities {
    const normalized = typeof provider === 'string' ? provider.toLowerCase().trim() : ''
    const builtin = BUILTIN_CAPABILITIES.get(normalized)
    if (builtin) {
      return { ...builtin }
    }
    const custom = this.customProviders.get(normalized)
    if (custom) {
      return { ...custom.capabilities }
    }
    throw new Error(`Unsupported agent provider: "${provider}"`)
  }

  /**
   * Checks whether a provider supports a specific capability.
   * Only returns true if the capability is an own property of the profile and strictly true.
   */
  static hasCapability(
    provider: AgentProviderType | string,
    capability: keyof AgentCapabilities | string
  ): boolean {
    const caps = this.getCapabilities(provider)
    if (!Object.prototype.hasOwnProperty.call(caps, capability)) {
      return false
    }
    return (caps as unknown as Record<string, unknown>)[capability] === true
  }

  /**
   * Asserts that a provider supports a capability, throwing a descriptive error if not.
   */
  static assertCapability(
    provider: AgentProviderType | string,
    capability: keyof AgentCapabilities | string,
    actionContext?: string
  ): void {
    if (!this.hasCapability(provider, capability)) {
      const formattedName = String(capability).replace(/([A-Z])/g, ' $1').toLowerCase()
      const contextMsg = actionContext ? ` for ${actionContext}` : ''
      throw new Error(
        `Agent provider "${provider}" does not support ${formattedName}${contextMsg}`
      )
    }
  }

  /**
   * Pre-flight assertion for SendPromptRequest.
   */
  static assertCanSendPrompt(
    provider: AgentProviderType | string,
    request: SendPromptRequest
  ): void {
    if (request.attachments && request.attachments.length > 0) {
      if (!this.hasCapability(provider, 'attachments')) {
        throw new Error(`Attachments are not supported by ${provider} adapter`)
      }
    }
  }

  /**
   * Pre-flight assertion for ResolveApprovalRequest.
   */
  static assertCanResolveApproval(
    provider: AgentProviderType | string,
    request?: ResolveApprovalRequest
  ): void {
    if (request && !request.approvalId) {
      throw new Error('approvalId is required to resolve approval')
    }
    if (!this.hasCapability(provider, 'interactiveApprovals')) {
      throw new Error(`Interactive approvals are not supported by ${provider} adapter`)
    }
  }

  /**
   * Instantiates the appropriate AgentAdapter instance.
   */
  static createAdapter(options: CreateAdapterOptions): AgentAdapter {
    const provider = this.resolveProvider(options.agentProvider, options.model)
    const runId = options.runId || `run-${Date.now()}`
    if (options.toolPolicy !== undefined && options.toolPolicy !== 'none') throw new Error('Invalid agent tool policy')
    if (options.toolPolicy === 'none' && provider !== 'claude' && provider !== 'api') throw new Error(`Provider ${provider} cannot enforce a tool-free architect session; choose Claude or an API connection`)

    if (provider === 'api') {
      if (!options.apiConnection || !options.apiHistoryDirectory) throw new Error('A resolved API connection and private history directory are required')
      return new ApiAdapter({ taskId: options.taskId, runId, worktreePath: options.worktreePath, connection: options.apiConnection, historyDirectory: options.apiHistoryDirectory, resumeSessionId: options.apiResumeSessionId, readOnly: options.apiReadOnly, toolPolicy: options.toolPolicy, model: options.model, reasoningEffort: options.reasoningEffort, onEvent: options.onEvent, onRawLog: options.onRawLog })
    }

    if (provider === 'codex') {
      const codexOptions: CodexAdapterOptions = {
        taskId: options.taskId,
        runId,
        worktreePath: options.worktreePath,
        model: options.model, reasoningEffort: options.reasoningEffort,
        codexBinPath: options.codexBinPath,
        resumeThreadId: options.codexResumeThreadId,
        approvalPolicy: options.approvalPolicy,
        sandbox: options.sandbox,
        env: options.env,
        emitRawLogEvents: options.emitRawLogEvents,
        killTimeoutMs: options.killTimeoutMs,
        maxLineBufferBytes: options.maxLineBufferBytes,
        spawnProcess: options.spawnProcess,
        onEvent: options.onEvent,
        onRawLog: options.onRawLog,
      }
      return new CodexAdapter(codexOptions)
    }

    if (provider === 'antigravity') {
      const agyOptions: AntigravityAdapterOptions = {
        taskId: options.taskId,
        runId,
        worktreePath: options.worktreePath,
        model: options.model, reasoningEffort: options.reasoningEffort,
        agyBinPath: options.agyBinPath,
        permissionMode: options.agyPermissionMode,
        mode: options.agyMode,
        conversationId: options.agyConversationId,
        env: options.env,
        supervisor: options.supervisor,
        startupTimeoutMs: options.startupTimeoutMs,
        stdinWriteTimeoutMs: options.stdinWriteTimeoutMs,
        maxTurnBufferBytes: options.maxTurnBufferBytes,
        maxTrackedRecords: options.maxTrackedRecords,
        emitRawLogEvents: options.emitRawLogEvents,
        killTimeoutMs: options.killTimeoutMs,
        maxLineBufferBytes: options.maxLineBufferBytes,
        spawnProcess: options.spawnProcess,
        onEvent: options.onEvent,
        onRawLog: options.onRawLog,
      }
      return new AntigravityAdapter(agyOptions)
    }

    if (provider === 'claude') {
      const claudeOptions: ClaudeAdapterOptions = {
        taskId: options.taskId,
        runId,
        worktreePath: options.worktreePath,
        model: options.model, reasoningEffort: options.reasoningEffort,
        claudeBinPath: options.claudeBinPath,
        resumeSessionId: options.claudeResumeSessionId,
        sessionId: options.claudeSessionId,
        permissionMode: options.claudePermissionMode,
        toolPolicy: options.toolPolicy,
        env: options.env,
        emitRawLogEvents: options.emitRawLogEvents,
        startupTimeoutMs: options.startupTimeoutMs,
        stdinWriteTimeoutMs: options.stdinWriteTimeoutMs,
        killTimeoutMs: options.killTimeoutMs,
        killGraceMs: options.killGraceMs,
        maxLineBufferBytes: options.maxLineBufferBytes,
        maxTurnBufferBytes: options.maxTurnBufferBytes,
        maxTrackedRecords: options.maxTrackedRecords,
        supervisor: options.supervisor,
        spawnProcess: options.spawnProcess,
        onEvent: options.onEvent,
        onRawLog: options.onRawLog,
      }
      return new ClaudeAdapter(claudeOptions)
    }

    const custom = this.customProviders.get(provider)
    if (custom) {
      return custom.factory(options)
    }

    throw new Error(`Unsupported agent provider: "${provider}"`)
  }
}

/**
 * Functional helpers
 */
export function createAgentAdapter(options: CreateAdapterOptions): AgentAdapter {
  return AgentAdapterFactory.createAdapter(options)
}

export function getAgentCapabilities(provider: AgentProviderType | string): AgentCapabilities {
  return AgentAdapterFactory.getCapabilities(provider)
}

export function resolveAgentProvider(provider?: string, model?: string): AgentProviderType | string {
  return AgentAdapterFactory.resolveProvider(provider, model)
}
