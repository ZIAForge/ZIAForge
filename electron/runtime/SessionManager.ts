import { AgentMediaStore } from './AgentMediaStore'
import { validMediaRef, type AgentMediaRequest } from '../../shared/agent-media'
import type { ApiTransport, ApiProfile } from '../../shared/api-provider'
import type { AgentExecutionOptions } from '../../shared/agent-models'
import { effectivePermissionLabel, isPermissionLabel, validateReasoningEffort } from './AgentExecutionPolicy'
import fs from 'node:fs'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import type { AgentEvent, AgentStatusChangedEvent } from '../../shared/agent-events'
import type { AgentApprovalRequest, AgentQueueControlRequest, AgentQueueCancelRequest, AgentChatIdentity, AgentSendReceipt, AgentSendRequest, AgentSessionRef, AgentSessionReconfigureRequest, AgentSessionDiagnostic, AgentSessionProvider, AgentSessionSnapshot, AgentSessionUpdate, AgentTurnRequest } from '../../shared/agent-session'
import { createFeedProjector } from '../../shared/agent-feed'
import { AgentAdapterFactory, type AgentAdapter, type CreateAdapterOptions } from '../agents/AgentAdapterFactory'
import { formatDiagnosticText } from './DiagnosticLog'
import { CodexRpcRejectedError } from '../agents/CodexAdapter'
import { ApprovalRegistry } from './ApprovalRegistry'
import { EventJournal } from './EventJournal'
import { SessionRegistry } from './SessionRegistry'
import { assertPrivateFile, readPrivateMetadata, writePrivateMetadata } from './privateStorage'
import { RecoveryStore, RecoveryRequiredError, type RecoveryInspection } from './RecoveryStore'
import type { RecoveryDocument } from '../../shared/recovery'
import { QueueStore, queueContext } from './QueueStore'

/** Only main-process resolution of saved task/preset configuration may supply this. */
export interface TrustedAgentSessionConfig extends AgentChatIdentity, AgentExecutionOptions {
  presetName: string
  cwd: string
  model?: string
  provider?: AgentSessionProvider
  apiConnectionId?: string
  apiConnection?: CreateAdapterOptions['apiConnection']
  apiReadOnly?: boolean
  apiTransport?: ApiTransport
  apiProfile?: ApiProfile
  apiBaseUrl?: string
  apiAllowCommands?: boolean
  toolPolicy?: 'none'
  codexBinPath?: string
  claudeBinPath?: string
  agyBinPath?: string
  claudePermissionMode?: CreateAdapterOptions['claudePermissionMode']
  agyPermissionMode?: CreateAdapterOptions['agyPermissionMode']
  agyConversationId?: string
  approvalPolicy?: CreateAdapterOptions['approvalPolicy']
  sandbox?: CreateAdapterOptions['sandbox']
  env?: Record<string, string | undefined>
  /** Private UI-only launch provenance, never part of provider context or default diagnostic artifacts. */
  launchNotice?: string
}
export interface SessionManagerOptions {
  registry: SessionRegistry
  baseStorageDir: string
  getJournal(taskId: string, runId: string): EventJournal
  createAdapter?: (options: CreateAdapterOptions) => AgentAdapter
}
export type PersistedAgentLaunch = Pick<TrustedAgentSessionConfig, 'presetName' | 'model' | 'reasoningEffort' | 'permissions' | 'approvalPolicy' | 'sandbox' | 'claudePermissionMode' | 'agyPermissionMode' | 'apiConnectionId' | 'apiReadOnly' | 'toolPolicy' | 'apiTransport' | 'apiProfile' | 'apiBaseUrl' | 'apiAllowCommands'> & { provider: AgentSessionProvider }
interface Metadata extends AgentChatIdentity, AgentSessionRef {
  version: 1
  provider?: AgentSessionProvider
  apiConnectionId?: string
  presetName: string
  model?: string
  createdAt: number
  launch?: PersistedAgentLaunch
  previousRunId?: string
  handoff?: string
  nativeHistoryInherited?: boolean
}
interface Delivery {
  persistent?: boolean
  text: string
  request: AgentSendRequest
  promise: Promise<AgentSendReceipt>
  resolve(value: AgentSendReceipt): void
  reject(reason: Error): void
}
interface Entry {
  state: AgentSessionSnapshot
  metadata: Metadata
  previousFeed: AgentSessionSnapshot['feed']
  providerReference?: string
  changing?: boolean
  privateKeyStreams?: Set<string>
  journal: EventJournal
  projector: ReturnType<typeof createFeedProjector>
  approvals: ApprovalRegistry
  adapter?: AgentAdapter
  events: Promise<void>
  eventIds: Set<string>
  completedTurns: Set<string>
  usageRequests: Set<string>
  deliveries: Map<string, Delivery>
  queue: Delivery[]
  messageQueue: QueueStore
  inputIds: Set<string>
  dispatching: boolean
  notification?: ReturnType<typeof setTimeout>
  storageError?: Error
  terminal?: boolean
  stoppedSuccessfully?: boolean
  terminating?: Promise<void>
}
class InvalidSessionMetadata extends Error {}
export class SessionMetadataRecoveryError extends Error {
  readonly code = 'SESSION_RECOVERY_REQUIRED'
  constructor(readonly taskId: string, readonly runId: string) {
    super(`Saved session history is damaged (${taskId}/${runId}). Preserve its files and restore a validated backup before continuing. A new conversation was not started.`)
    this.name = 'SessionMetadataRecoveryError'
  }
}
const safeId = /^[A-Za-z0-9_-]{1,160}$/
const asError = (error: unknown): Error => error instanceof Error ? error : new Error(String(error))

/** Interactive coordinator, owned by RunService. Provider callbacks only enter through its ordered journal pump. */
export class SessionManager {
  private readonly entries = new Map<string, Entry>()
  private readonly creating = new Map<string, Promise<AgentSessionSnapshot>>()
  private readonly creatingTasks = new Map<string, string>()
  private readonly removalLocks = new Map<string, number>()
  private readonly loading = new Map<string, Promise<Entry | undefined>>()
  private readonly listeners = new Set<(update: AgentSessionUpdate) => void>()
  private readonly transitions = new Map<string, { signature: string; promise: Promise<AgentSessionSnapshot> }>()
  private closing = false
  private startedSession = false
  private mediaStore?: AgentMediaStore
  constructor(private readonly options: SessionManagerOptions) {}

  // A legacy/CLI coordinator need not allocate API media storage. Keep the
  // strict private-path validation at the first actual image operation.
  private getMediaStore(): AgentMediaStore {
    return this.mediaStore ??= new AgentMediaStore(path.join(this.options.baseStorageDir, 'api-conversations', 'media'))
  }

  /** Main-only, logical ownership checked against the visible current/ancestor feed. */
  async readMedia(request: AgentMediaRequest) {
    if (!request || typeof request !== 'object' || Array.isArray(request) || Object.keys(request).some(key => !['sessionId', 'runId', 'mediaId'].includes(key)) || typeof request.mediaId !== 'string') throw new Error('Invalid media request')
    const entry = this.require(request)
    const ref = this.view(entry).feed.flatMap(message => message.tools ?? []).flatMap(tool => tool.media ?? []).find(ref => ref.id === request.mediaId)
    if (!ref || !validMediaRef(ref)) throw new Error('Image is unavailable in this conversation')
    const bytes = await this.getMediaStore().read(entry.state.taskId, ref)
    if (this.require(request) !== entry) throw new Error('Media owner changed')
    return { bytes: new Uint8Array(bytes), mime: ref.mime }
  }

  onEvent(callback: (update: AgentSessionUpdate) => void): () => void {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  /** Idle connected sessions do not block reviewed Git operations. */
  hasActiveTask(taskId: string): boolean {
    if ([...this.creatingTasks.values()].includes(taskId)) return true
    return [...this.entries.values()].some(entry => entry.state.taskId === taskId && Boolean(entry.changing || entry.terminating || entry.dispatching || entry.queue.length || entry.messageQueue.size || entry.state.activeTurn || ['starting', 'stopping'].includes(entry.state.sessionStatus)))
  }

  /** Directory removal is stricter than Git commits: even an idle adapter owns its cwd. */
  reserveWorktreeRemoval(taskId: string): () => void {
    if (!safeId.test(taskId)) throw new Error('Invalid task identity for worktree removal')
    this.assertTaskAvailable(taskId)
    if (this.closing || this.hasActiveTask(taskId) || [...this.entries.values()].some(entry => entry.state.taskId === taskId && entry.adapter && !entry.stoppedSuccessfully)) {
      throw new Error('A session is still attached to this worktree. End its session or restart the application before removing the worktree; chat history is preserved.')
    }
    // Reserve synchronously before the caller awaits Git. Existing startup and
    // send guards also cover a delayed Resume or a new chat during removal.
    this.removalLocks.set(taskId, (this.removalLocks.get(taskId) ?? 0) + 1)
    let released = false
    return () => {
      if (released) return
      released = true
      const remaining = (this.removalLocks.get(taskId) ?? 1) - 1
      if (remaining) this.removalLocks.set(taskId, remaining)
      else this.removalLocks.delete(taskId)
    }
  }

  private identity(identity: AgentChatIdentity): string {
    if (!safeId.test(identity.taskId) || !safeId.test(identity.chatId)) throw new Error('Invalid task or chat identity')
    return `session-${createHash('sha256').update(JSON.stringify([identity.taskId, identity.chatId])).digest('hex').slice(0, 40)}`
  }

  create(config: TrustedAgentSessionConfig): Promise<AgentSessionSnapshot> {
    if (this.removalLocks.has(config.taskId)) return Promise.reject(new Error('Project removal is in progress'))
    if (this.closing) return Promise.reject(new Error('Session service is shutting down'))
    const key = this.identity(config)
    const pending = this.creating.get(key)
    if (pending) return pending.then(snapshot => {
      if (snapshot.presetName !== config.presetName || snapshot.provider !== (config.provider ?? 'codex') || snapshot.apiConnectionId !== config.apiConnectionId || snapshot.model !== config.model || snapshot.reasoningEffort !== config.reasoningEffort || snapshot.permissions !== effectivePermissionLabel(config) || this.entries.get(snapshot.sessionId)?.metadata.launch?.toolPolicy !== config.toolPolicy) throw new Error('This chat is starting with another preset')
      return snapshot
    })
    const promise = this.createInternal(config, key)
    this.creating.set(key, promise)
    this.creatingTasks.set(key, config.taskId)
    void promise.finally(() => { if (this.creating.get(key) === promise) { this.creating.delete(key); this.creatingTasks.delete(key) } }).catch(() => {})
    return promise
  }

  private async createInternal(config: TrustedAgentSessionConfig, sessionId: string): Promise<AgentSessionSnapshot> {
    const existing = await this.load(config)
    this.assertTaskAvailable(config.taskId)
    if (existing) {
      if (existing.state.presetName !== config.presetName || existing.state.provider !== (config.provider ?? 'codex') || existing.state.apiConnectionId !== config.apiConnectionId || existing.state.model !== config.model || existing.state.reasoningEffort !== config.reasoningEffort || existing.state.permissions !== effectivePermissionLabel(config) || existing.metadata.launch?.toolPolicy !== config.toolPolicy) throw new Error('This chat already uses another configuration; explicitly change the selection to continue')
      if (existing.state.sessionStatus !== 'ready') throw new Error('This session is disconnected or unavailable; its history is preserved. Create a new chat to continue.')
      return this.view(existing)
    }
    return this.startEntry(config, sessionId)
  }

  /** Frozen launch policy; main resolves only current trusted cwd, binary and environment. */
  persistedLaunch(ref: AgentSessionRef): PersistedAgentLaunch {
    const entry = this.require(ref)
    return { ...this.frozenLaunch(entry) }
  }

  private frozenLaunch(entry: Entry): PersistedAgentLaunch {
    return { approvalPolicy: 'on-request', sandbox: 'workspace-write', claudePermissionMode: 'default', agyPermissionMode: 'cli-settings',
      provider: entry.state.provider, presetName: entry.state.presetName, model: entry.state.model, ...entry.metadata.launch, permissions: entry.state.permissions }
  }

  resume(ref: AgentSessionRef, config: TrustedAgentSessionConfig): Promise<AgentSessionSnapshot> {
    const pending = this.transitions.get(`${ref.sessionId}:resume:${ref.runId}`)
    if (pending) return pending.promise
    const entry = this.require(ref)
    if (entry.state.sessionStatus === 'ready' && !entry.changing) return Promise.resolve(this.view(entry))
    return this.change(ref, { ...config, ...this.frozenLaunch(entry) }, undefined, true)
  }

  reconfigure(request: AgentSessionReconfigureRequest, config: TrustedAgentSessionConfig): Promise<AgentSessionSnapshot> {
    return this.change(request, config, request.requestId, false)
  }

  private change(ref: AgentSessionRef, config: TrustedAgentSessionConfig, requestId: string | undefined, resume: boolean): Promise<AgentSessionSnapshot> {
    const signature = JSON.stringify([ref.sessionId, ref.runId, config.taskId, config.chatId, config.provider, config.presetName, config.model, { reasoningEffort: config.reasoningEffort }, config.permissions, config.approvalPolicy, config.sandbox, config.claudePermissionMode, config.agyPermissionMode, config.apiConnectionId, config.apiReadOnly, config.apiTransport, config.apiProfile, config.apiBaseUrl, config.apiAllowCommands, config.toolPolicy, resume])
    const operationKey = `${ref.sessionId}:${resume ? 'resume' : 'reconfigure'}:${requestId ?? ref.runId}`
    const previous = this.transitions.get(operationKey)
    if (previous) return previous.signature === signature ? previous.promise : Promise.reject(new Error('Switch request identity was already used with another selection'))
    const entry = this.require(ref)
    this.assertTaskAvailable(entry.state.taskId)
    if (config.taskId !== entry.state.taskId || config.chatId !== entry.state.chatId) throw new Error('Session configuration belongs to another chat')
    if (config.toolPolicy !== entry.metadata.launch?.toolPolicy) return Promise.reject(new Error('Tool isolation cannot be changed within a conversation; create a fresh isolated context'))
    if (this.closing || entry.changing || entry.terminating || entry.storageError || entry.messageQueue.blocked || (!resume && entry.messageQueue.size > 0) || entry.dispatching || entry.queue.length || entry.state.activeTurn || ['starting', 'stopping'].includes(entry.state.sessionStatus)) {
      return Promise.reject(new Error('Wait for the active turn and queued messages to finish before resuming or changing the session'))
    }
    if (resume && !entry.providerReference && entry.projector.messages().some(message => message.role === 'user')) return Promise.reject(new Error('This legacy session has no saved provider reference. Select a preset explicitly to continue with a history handoff.'))
    // Reserve synchronously: sends and concurrent switches cannot pass an awaited stop.
    entry.changing = true
    const promise = (async () => {
      await entry.events
      this.assertTaskAvailable(entry.state.taskId)
      if (entry.storageError || entry.messageQueue.blocked || (!resume && entry.messageQueue.size > 0) || entry.state.activeTurn || entry.dispatching || entry.queue.length) throw new Error('Session became busy; finish the active turn before changing it')
      this.pauseMessages(entry)
      if (entry.messageQueue.blocked) throw new Error('Message queue storage requires recovery before resuming')
      try { await entry.adapter?.stop(false) } catch (error) {
        await this.enqueue(entry, this.status(entry, 'error', 'session', undefined, asError(error).message)).catch(() => {})
        throw error
      }
      entry.stoppedSuccessfully = true
      await entry.events
      await this.enqueue(entry, this.status(entry, 'stopped', 'session'))
      if (this.closing || !this.owns(entry)) throw new Error('Session service is shutting down or ownership changed')
      this.assertTaskAvailable(entry.state.taskId)
      this.options.registry.setAgentSessionPid(entry.state.sessionId, entry.state.runId, undefined)
      const sameProvider = entry.state.provider === (config.provider ?? 'codex') && (entry.state.provider !== 'api' || entry.metadata.apiConnectionId === config.apiConnectionId && entry.state.model === config.model && (entry.metadata.launch?.apiReadOnly ?? false) === (config.apiReadOnly ?? false) && (entry.metadata.launch?.apiTransport ?? 'chat-completions') === (config.apiTransport ?? config.apiConnection?.transport ?? 'chat-completions') && (entry.metadata.launch?.apiProfile ?? 'openai-compatible') === (config.apiProfile ?? config.apiConnection?.profile ?? 'openai-compatible') && (entry.metadata.launch?.apiAllowCommands ?? false) === (config.apiAllowCommands ?? config.apiConnection?.allowCommands ?? false) && (!entry.metadata.launch?.apiBaseUrl || entry.metadata.launch.apiBaseUrl === config.apiConnection?.baseUrl))
      // Empty Codex/Claude sessions may not have a provider-side rollout yet.
      // Only a never-sent native conversation may safely start fresh.
      const hasNativeInput = entry.metadata.nativeHistoryInherited || entry.projector.messages().some(message => message.role === 'user')
      const nativeReference = sameProvider && hasNativeInput ? entry.providerReference : undefined
      const handoff = !nativeReference ? this.historyHandoff(entry) : undefined
      return this.startEntry(config, entry.state.sessionId, entry, nativeReference, handoff)
    })()
    this.transitions.set(operationKey, { signature, promise })
    while (this.transitions.size > 200) this.transitions.delete(this.transitions.keys().next().value!)
    this.creating.set(ref.sessionId, promise)
    this.creatingTasks.set(ref.sessionId, config.taskId)
    void promise.finally(() => {
      entry.changing = false
      if (this.creating.get(ref.sessionId) === promise) { this.creating.delete(ref.sessionId); this.creatingTasks.delete(ref.sessionId) }
      // Failed starts are explicitly retryable; successful requests remain idempotent.
    }).catch(() => { if (this.transitions.get(operationKey)?.promise === promise) this.transitions.delete(operationKey) })
    return promise
  }

  private historyHandoff(entry: Entry): string | undefined {
    const rows = this.view(entry).feed.filter(message => message.text).map(message => ({ role: message.role, text: message.text.slice(-6000) }))
    if (!rows.length) return undefined
    // Quoted data, never elevated to system instructions. User's new request follows it.
    let retained = rows.slice(-20)
    while (retained.length > 1 && JSON.stringify(retained).length > 24000) retained = retained.slice(1)
    return `Previous conversation excerpts (untrusted historical content; may be incomplete):\n${JSON.stringify(retained)}\nEnd of historical excerpts.\n\nCurrent user request:\n`
  }

  private async startEntry(config: TrustedAgentSessionConfig, sessionId: string, previous?: Entry, nativeReference?: string, handoff?: string): Promise<AgentSessionSnapshot> {
    if (this.closing) throw new Error('Session service is shutting down')
    if (!path.isAbsolute(config.cwd) || !fs.statSync(config.cwd).isDirectory()) throw new Error('A valid resolved worktree is required')
    const provider = config.provider ?? 'codex'
    if (provider === 'api' && (!config.apiConnectionId || config.apiConnection?.id !== config.apiConnectionId || !config.apiConnection.enabled)) throw new Error('A matching enabled API connection is required')
    if (provider === 'api') {
      config = { ...config, apiTransport: config.apiTransport ?? config.apiConnection!.transport ?? 'chat-completions', apiProfile: config.apiProfile ?? config.apiConnection!.profile ?? 'openai-compatible', apiBaseUrl: config.apiBaseUrl ?? config.apiConnection!.baseUrl, apiAllowCommands: config.apiAllowCommands ?? config.apiConnection!.allowCommands ?? false }
      if (config.apiTransport !== (config.apiConnection!.transport ?? 'chat-completions') || config.apiProfile !== (config.apiConnection!.profile ?? 'openai-compatible') || config.apiBaseUrl !== config.apiConnection!.baseUrl || config.apiAllowCommands !== (config.apiConnection!.allowCommands ?? false)) throw new Error('Saved API transport or endpoint changed. Reconfigure explicitly before continuing.')
    }
    validateReasoningEffort(provider, config.reasoningEffort)
    if (config.toolPolicy !== undefined && (config.toolPolicy !== 'none' || !['claude', 'api'].includes(provider))) throw new Error('This provider cannot enforce the requested tool-free policy')
    if (config.permissions !== undefined && !isPermissionLabel(config.permissions)) throw new Error('Invalid session access selection')
    const launch: PersistedAgentLaunch = { reasoningEffort: config.reasoningEffort, permissions: config.permissions, provider, presetName: config.presetName, model: config.model, approvalPolicy: config.approvalPolicy, sandbox: config.sandbox, claudePermissionMode: config.claudePermissionMode, agyPermissionMode: config.agyPermissionMode, apiConnectionId: config.apiConnectionId, apiReadOnly: config.apiReadOnly, apiTransport: config.apiTransport, apiProfile: config.apiProfile, apiBaseUrl: config.apiBaseUrl, apiAllowCommands: config.apiAllowCommands, toolPolicy: config.toolPolicy }
    const metadata: Metadata = { version: 1, provider, apiConnectionId: config.apiConnectionId, taskId: config.taskId, chatId: config.chatId, sessionId, runId: `run-${randomUUID()}`, presetName: config.presetName, model: config.model, createdAt: Math.max(Date.now(), (previous?.metadata.createdAt ?? 0) + 1), launch, previousRunId: previous?.state.runId, handoff, nativeHistoryInherited: nativeReference !== undefined }
    const entry = this.makeEntry(metadata, previous?.messageQueue)
    if (previous) for (const id of previous.inputIds) entry.inputIds.add(id)
    entry.messageQueue.assertContext(queueContext(this.frozenLaunch(entry)), new Set([metadata.runId, ...(previous ? [...previous.messageQueue.acceptedRunIds()] : [])]))
    if (previous) entry.previousFeed = [...previous.previousFeed, ...previous.projector.messages().map(message => ({ ...message, id: `${previous.state.runId}:${message.id}` }))]
    // Publish metadata before replacing the in-memory owner. A failed disk write leaves old history accessible.
    this.metadataStore(config.taskId, metadata.runId).write(metadata, null)
    this.startedSession = true
    this.entries.set(sessionId, entry)
    try {
      await this.enqueue(entry, this.status(entry, 'starting', 'session'))
      if (config.launchNotice) this.diagnostic(entry, 'session', config.launchNotice)
      if (this.closing) throw new Error('Session service is shutting down')
      this.assertTaskAvailable(config.taskId)
      const factory = this.options.createAdapter ?? AgentAdapterFactory.createAdapter.bind(AgentAdapterFactory)
      const owner: { adapter?: AgentAdapter } = {}
      const claudeSessionId = provider === 'claude' && !nativeReference ? randomUUID() : undefined
      const adapter = factory({ apiStoreMedia: async (_itemId, encoded, signal) => {
        signal.throwIfAborted()
        if (!this.owns(entry) || this.closing || !entry.adapter || owner.adapter !== entry.adapter) throw new Error('Image session is no longer active')
        const media = await this.getMediaStore().storeBase64({ taskId: metadata.taskId, runId: metadata.runId }, encoded, signal)
        signal.throwIfAborted()
        if (!this.owns(entry) || this.closing || owner.adapter !== entry.adapter) throw new Error('Image session changed during caching')
        return media
      }, toolPolicy: config.toolPolicy, apiConnection: config.apiConnection, apiReadOnly: config.apiReadOnly, apiHistoryDirectory: path.join(this.options.baseStorageDir, 'api-conversations'), apiResumeSessionId: provider === 'api' ? nativeReference : undefined, taskId: config.taskId, runId: metadata.runId, worktreePath: config.cwd, agentProvider: provider, model: config.model, reasoningEffort: config.reasoningEffort, claudeBinPath: config.claudeBinPath, agyBinPath: config.agyBinPath, claudePermissionMode: config.claudePermissionMode, agyPermissionMode: config.agyPermissionMode, agyConversationId: (provider === 'antigravity' ? nativeReference : undefined) ?? config.agyConversationId, codexResumeThreadId: provider === 'codex' ? nativeReference : undefined, claudeResumeSessionId: provider === 'claude' ? nativeReference : undefined, claudeSessionId, codexBinPath: config.codexBinPath, approvalPolicy: config.approvalPolicy, sandbox: config.sandbox, env: config.env,
        onRawLog: (stream, line) => { if (this.owns(entry) && owner.adapter && entry.adapter === owner.adapter) this.diagnostic(entry, stream, line) },
        onEvent: event => {
          if (!this.owns(entry) || !owner.adapter || entry.adapter !== owner.adapter) return
          void this.enqueue(entry, event).catch(() => {})
        } })
      owner.adapter = adapter
      entry.adapter = adapter
      const capabilities = adapter.getCapabilities()
      entry.state.capabilities = { attachments: capabilities.attachments, interactiveApprovals: capabilities.interactiveApprovals, interruptTurn: typeof adapter.interruptTurn === 'function' }
      // Retain reference before process spawn when known, including failed resume attempts.
      if (nativeReference) await this.saveReference(entry, nativeReference)
      if (this.closing || entry.terminating || entry.state.sessionStatus !== 'starting') throw new Error('Session startup was cancelled')
      this.assertTaskAvailable(config.taskId)
      const started = await adapter.start()
      await entry.events
      this.assertTaskAvailable(config.taskId)
      if (!this.owns(entry) || this.closing || !['starting', 'ready'].includes(entry.state.sessionStatus) || entry.terminating || entry.storageError) throw new Error('Session startup was cancelled or failed')
      if (provider !== 'api' && (!started.pid || started.pid <= 0)) throw new Error('Provider did not create a valid process')
      const reference = provider === 'claude' ? (nativeReference ?? claudeSessionId) : (adapter.getSessionId() ?? started.threadId ?? started.sessionId ?? started.conversationId)
      if (nativeReference && reference !== nativeReference) throw new Error('Provider resumed an unexpected conversation')
      if (reference && !entry.providerReference) await this.saveReference(entry, reference)
      await entry.events
      if (!this.owns(entry) || this.closing || entry.terminating || entry.storageError || !['starting', 'ready'].includes(entry.state.sessionStatus)) throw new Error('Session startup was cancelled or failed')
      this.assertTaskAvailable(config.taskId)
      this.options.registry.setAgentSessionPid(sessionId, metadata.runId, started.pid)
      await this.enqueue(entry, this.status(entry, 'running', 'session'))
      if (previous) this.diagnostic(entry, 'session', nativeReference ? 'Native provider conversation resumed; earlier history retained.' : 'Provider changed. Recent conversation excerpts will be sent with your next message; full history remains visible.')
      return this.view(entry)
    } catch (error) {
      if (!entry.storageError) await this.enqueue(entry, this.status(entry, 'error', 'session', undefined, asError(error).message)).catch(() => {})
      await entry.adapter?.stop(true).catch(() => {})
      throw error
    }
  }

  private async saveReference(entry: Entry, id: string): Promise<void> {
    if (!/^[A-Za-z0-9_-]{1,200}$/.test(id)) throw new Error('Provider returned an invalid conversation reference')
    await writePrivateMetadata(path.join(path.dirname(entry.journal.filePath), 'provider.json'), { version: 1, provider: entry.state.provider, id })
    entry.providerReference = id
    entry.state.resumeAvailable = true
  }

  private diagnostic(entry: Entry, source: AgentSessionDiagnostic['source'], raw: string): void {
    if (/-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/.test(raw)) (entry.privateKeyStreams ??= new Set()).add(source)
    const hidden = entry.privateKeyStreams?.has(source)
    const message = hidden ? '[REDACTED PRIVATE KEY]' : formatDiagnosticText(raw, 2048)
    if (/-----END (?:[A-Z ]+ )?PRIVATE KEY-----/.test(raw)) entry.privateKeyStreams?.delete(source)
    const diagnostics = entry.state.diagnostics ??= []
    diagnostics.push({ id: randomUUID(), timestamp: Date.now(), source, level: source === 'stderr' ? 'warning' : 'info', message })
    while (diagnostics.length > 200 || (diagnostics.length > 1 && diagnostics.reduce((bytes, item) => bytes + Buffer.byteLength(item.message), 0) > 128 * 1024)) diagnostics.shift()
    entry.state.diagnosticsRevision = (entry.state.diagnosticsRevision ?? 0) + 1
    this.scheduleUpdate(entry)
  }

  async attach(identity: AgentChatIdentity): Promise<AgentSessionSnapshot | null> {
    this.assertTaskAvailable(identity.taskId)
    const key = this.identity(identity)
    const starting = this.creating.get(key)
    if (starting) return starting
    const entry = await this.load(identity)
    this.assertTaskAvailable(identity.taskId)
    if (!entry) return null
    await entry.events
    this.assertTaskAvailable(identity.taskId)
    return this.view(entry)
  }

  async snapshot(ref: AgentSessionRef): Promise<AgentSessionSnapshot> {
    const entry = this.require(ref)
    await entry.events
    return this.view(entry)
  }

  send(request: AgentSendRequest): Promise<AgentSendReceipt> {
    const entry = this.require(request)
    if (this.removalLocks.has(entry.state.taskId)) return Promise.reject(new Error('Project removal is in progress'))
    if (!safeId.test(request.clientMessageId) || !request.text.trim() || request.text.length > 1_000_000) return Promise.reject(new Error('Invalid message identity or text'))
    const previous = entry.deliveries.get(request.clientMessageId)
    if (previous) return previous.text === request.text ? previous.promise : Promise.reject(new Error('Message identity was already used with different content'))
    if (entry.inputIds.has(request.clientMessageId)) return Promise.reject(new Error('This message identity already appears in saved history; inspect its outcome instead of sending it again'))
    if (entry.messageQueue.hasIdentity(request.clientMessageId)) return Promise.reject(new Error('Message identity belongs to the durable queue; it cannot be sent again'))
    if (entry.messageQueue.size || entry.messageQueue.blocked) return Promise.reject(new Error('Finish or cancel the saved message queue before sending directly'))
    if (this.closing || entry.changing || entry.terminating || entry.state.sessionStatus !== 'ready' || !entry.adapter || entry.storageError) return Promise.reject(new Error('Session is not ready to accept messages'))
    let resolve!: Delivery['resolve']
    let reject!: Delivery['reject']
    const promise = new Promise<AgentSendReceipt>((ok, fail) => { resolve = ok; reject = fail })
    const delivery = { request: { ...request }, text: request.text, promise, resolve, reject }
    entry.deliveries.set(request.clientMessageId, delivery)
    entry.queue.push(delivery)
    this.pump(entry)
    return promise
  }

  async queue(request: AgentSendRequest): Promise<AgentSessionSnapshot> {
    const entry = this.require(request)
    this.assertTaskAvailable(entry.state.taskId)
    if (!safeId.test(request.clientMessageId) || typeof request.text !== 'string' || !request.text.trim() || request.text.length > 1_000_000) throw new Error('Invalid message identity or text')
    if (this.closing || entry.changing || entry.terminating || entry.storageError || entry.messageQueue.blocked || entry.state.sessionStatus !== 'ready' || !entry.adapter) throw new Error('Session is not ready to accept queued messages')
    if ((entry.deliveries.has(request.clientMessageId) || entry.inputIds.has(request.clientMessageId)) && !entry.messageQueue.hasIdentity(request.clientMessageId)) throw new Error('This message identity has already been used; it cannot be queued again')
    this.mutateQueue(entry, () => entry.messageQueue.accept(request, queueContext(this.frozenLaunch(entry))))
    this.pump(entry)
    return this.view(entry)
  }

  async setQueuePaused(request: AgentQueueControlRequest): Promise<AgentSessionSnapshot> {
    const entry = this.require(request)
    this.assertTaskAvailable(entry.state.taskId)
    if (typeof request.paused !== 'boolean' || this.closing || entry.changing || entry.terminating || entry.storageError) throw new Error('Session cannot change its saved queue now')
    if (!request.paused && (entry.state.sessionStatus !== 'ready' || !entry.adapter)) throw new Error('Resume this provider conversation before continuing its queue')
    this.mutateQueue(entry, () => entry.messageQueue.pause(request.paused))
    this.pump(entry)
    return this.view(entry)
  }

  async cancelQueued(request: AgentQueueCancelRequest): Promise<AgentSessionSnapshot> {
    const entry = this.require(request)
    this.assertTaskAvailable(entry.state.taskId)
    if (!safeId.test(request.clientMessageId) || this.closing || entry.changing || entry.terminating) throw new Error('Session cannot cancel this queued message now')
    this.mutateQueue(entry, () => entry.messageQueue.finish(request.clientMessageId, 'cancelled'))
    return this.view(entry)
  }

  private mutateQueue(entry: Entry, action: () => void): void {
    try { action() } finally { this.scheduleUpdate(entry) }
  }
  private pauseMessages(entry: Entry): void {
    // Storage failure blocks the outbox, but must never prevent Stop/Quit or
    // falsify the provider's actual turn status.
    try { if (entry.messageQueue.size) this.mutateQueue(entry, () => entry.messageQueue.pause(true)) } catch { /* Snapshot exposes the independent queue storage error. */ }
  }

  private pump(entry: Entry): void {
    if (this.removalLocks.has(entry.state.taskId) || entry.terminating || entry.changing || entry.dispatching || entry.state.activeTurn || entry.messageQueue.blocked || entry.state.sessionStatus !== 'ready' || !entry.adapter || this.closing) return
    let delivery = entry.queue.shift()
    if (!delivery) {
      let saved
      try { saved = entry.messageQueue.beginDispatch() } catch { this.scheduleUpdate(entry); return }
      if (!saved) return
      // queue() already acknowledged durable storage. This private promise only
      // feeds the existing turn pump and must not create an unhandled rejection.
      let resolve!: Delivery['resolve']; let reject!: Delivery['reject']
      const promise = new Promise<AgentSendReceipt>((ok, fail) => { resolve = ok; reject = fail })
      void promise.catch(() => {})
      delivery = { persistent: true, text: saved.text, request: { sessionId: entry.state.sessionId, runId: entry.state.runId, clientMessageId: saved.clientMessageId, text: saved.text }, promise, resolve, reject }
      entry.deliveries.set(saved.clientMessageId, delivery)
      this.scheduleUpdate(entry)
    }
    entry.dispatching = true
    const adapter = entry.adapter
    void (async () => {
      const clientMessageId = delivery.request.clientMessageId
      const base = { taskId: entry.state.taskId, runId: entry.state.runId, timestamp: Date.now(), clientMessageId }
      try {
        // Persist the input before invoking the provider, so fast output cannot overtake it.
        await this.enqueue(entry, { ...base, eventId: randomUUID(), type: 'message.started', messageId: `user-${clientMessageId}`, role: 'user' })
        await this.enqueue(entry, { ...base, eventId: randomUUID(), type: 'message.delta', messageId: `user-${clientMessageId}`, deltaType: 'text', content: delivery.text })
        await this.enqueue(entry, { ...base, eventId: randomUUID(), type: 'message.completed', messageId: `user-${clientMessageId}`, finishReason: 'stop' })
        await this.enqueue(entry, { ...this.status(entry, 'starting', 'turn'), clientMessageId })
        this.assertTaskAvailable(entry.state.taskId)
        if (!this.owns(entry) || entry.adapter !== adapter || this.closing || entry.terminating || entry.state.sessionStatus !== 'ready') throw new Error('Session stopped before message delivery')
        const result = await adapter.sendPrompt({ taskId: entry.state.taskId, runId: entry.state.runId, text: (entry.metadata.handoff ?? '') + delivery.text })
        await entry.events
        if (!this.owns(entry) || entry.adapter !== adapter || entry.storageError) throw new Error('Session changed during message delivery')
        if (entry.state.activeTurn?.clientMessageId === clientMessageId && !entry.state.activeTurn.turnId) {
          await this.enqueue(entry, { ...this.status(entry, 'running', 'turn', result.turnId), clientMessageId })
        }
        entry.metadata.handoff = undefined
        if (delivery.persistent) {
          try { this.mutateQueue(entry, () => entry.messageQueue.finish(clientMessageId, 'delivered')) } catch { /* Provider accepted the turn. Keep its real lifecycle and Stop available; the blocked outbox retains its uncertain intent. */ }
        }
        delivery.resolve({ sessionId: entry.state.sessionId, runId: entry.state.runId, clientMessageId, turnId: result.turnId, cursor: entry.state.cursor, outcome: 'accepted' })
      } catch (error) {
        if (entry.state.activeTurn?.clientMessageId === clientMessageId && !entry.storageError) {
          await this.enqueue(entry, { ...this.status(entry, 'error', 'turn', entry.state.activeTurn.turnId, asError(error).message), clientMessageId }).catch(() => {})
        }
        if (error instanceof CodexRpcRejectedError && error.method === 'turn/start' && error.deliveryRejected && !entry.storageError) {
          // A definitive refusal is a durable receipt, not permission to replay this ID.
          // The user may explicitly retry using a new ID; unknown outcomes remain deduplicated failures.
          try {
            await this.enqueue(entry, { ...base, eventId: randomUUID(), type: 'message.completed', messageId: `user-${clientMessageId}`, finishReason: 'error' })
            if (delivery.persistent) this.mutateQueue(entry, () => entry.messageQueue.finish(clientMessageId, 'rejected'))
            delivery.resolve({ sessionId: entry.state.sessionId, runId: entry.state.runId, clientMessageId, cursor: entry.state.cursor, outcome: 'rejected', error: error.message })
          } catch (journalError) { delivery.reject(asError(journalError)) }
        } else {
          if (delivery.persistent) { try { this.mutateQueue(entry, () => entry.messageQueue.uncertain(clientMessageId)) } catch { /* Storage failure keeps the intent fail-closed. */ } }
          delivery.reject(asError(error))
        }
      } finally {
        entry.dispatching = false
        this.pump(entry)
      }
    })()
  }

  async interrupt(request: AgentTurnRequest): Promise<void> {
    const entry = this.requireTurn(request)
    const adapter = entry.adapter!
    if (!adapter.interruptTurn) throw new Error('Turn interruption is unavailable')
    this.pauseMessages(entry)
    if (entry.state.activeTurn?.status === 'interrupting') return
    await this.enqueue(entry, this.status(entry, 'stopping', 'turn', request.turnId))
    try {
      await adapter.interruptTurn(request.turnId)
      await entry.events
    } catch (error) {
      if (this.owns(entry) && entry.state.activeTurn?.turnId === request.turnId) await this.enqueue(entry, this.status(entry, entry.approvals.getActiveByTask(entry.state.taskId).length ? 'waiting_for_approval' : 'running', 'turn', request.turnId))
      throw error
    }
  }

  terminate(request: AgentSessionRef): Promise<void> {
    const entry = this.require(request)
    if (entry.terminating) return entry.terminating
    if ((!entry.adapter || entry.stoppedSuccessfully) && (entry.state.sessionStatus === 'stopped' || entry.state.sessionStatus === 'disconnected')) return Promise.resolve()
    this.pauseMessages(entry)
    const adapter = entry.adapter
    // Reserve the session synchronously so new sends cannot race the journal or stop.
    entry.state.sessionStatus = 'stopping'
    this.failQueued(entry, new Error('Session ended by user; create a new chat to continue'))
    const operation = (async () => {
      await this.enqueue(entry, this.status(entry, 'stopping', 'session'))
      try {
        await adapter?.stop(false)
        entry.stoppedSuccessfully = true
        await entry.events
        if (!this.owns(entry) || entry.adapter !== adapter) return
        this.options.registry.setAgentSessionPid(entry.state.sessionId, entry.state.runId, undefined)
        await this.enqueue(entry, this.status(entry, 'stopped', 'session'))
      } catch (error) {
        if (this.owns(entry)) await this.enqueue(entry, this.status(entry, 'error', 'session', undefined, asError(error).message)).catch(() => {})
        throw error
      }
    })()
    entry.terminating = operation
    void operation.finally(() => { if (entry.terminating === operation) entry.terminating = undefined }).catch(() => {})
    return operation
  }

  private assertTaskAvailable(taskId: string): void {
    if (this.removalLocks.has(taskId)) throw new Error('Project removal is in progress')
  }

  /** Main must hold this lease through filesystem deletion AND registration persistence. */
  beginTaskRemoval(taskIds: readonly string[]): { terminated: Promise<void>; release(): void } {
    const selected = new Set(taskIds)
    if ([...selected].some(taskId => !safeId.test(taskId))) throw new Error('Invalid task identity for project removal')
    for (const taskId of selected) this.removalLocks.set(taskId, (this.removalLocks.get(taskId) ?? 0) + 1)
    let released = false
    const release = () => {
      if (released) return
      released = true
      for (const taskId of selected) {
        const remaining = (this.removalLocks.get(taskId) ?? 1) - 1
        if (remaining) this.removalLocks.set(taskId, remaining)
        else this.removalLocks.delete(taskId)
      }
    }
    const creating = [...this.creating].filter(([key]) => selected.has(this.creatingTasks.get(key) ?? '')).map(([, promise]) => promise)
    const terminateOwned = () => Promise.allSettled([...this.entries.values()].filter(entry => selected.has(entry.state.taskId)).map(entry => this.terminate(entry.state)))
    const terminated = (async () => {
      // Cancel handshakes before waiting for create, otherwise startup could keep running until timeout.
      const first = await terminateOwned()
      await Promise.allSettled(creating)
      const second = await terminateOwned()
      const failure = [...first, ...second].find(result => result.status === 'rejected')
      if (failure?.status === 'rejected') throw failure.reason
    })()
    // The caller owns finally/release; attach a rejection handler immediately for safe UI scheduling.
    void terminated.catch(() => {})
    return { terminated, release }
  }

  async terminateTasks(taskIds: readonly string[]): Promise<void> {
    const removal = this.beginTaskRemoval(taskIds)
    try { await removal.terminated } finally { removal.release() }
  }

  async resolveApproval(request: AgentApprovalRequest): Promise<void> {
    const entry = this.requireTurn(request)
    if (request.decision !== 'allow' && request.decision !== 'deny') throw new Error('Invalid approval decision')
    const record = entry.approvals.get(request.approvalId)
    if (!record || record.runId !== request.runId || record.data?.turnId !== request.turnId) throw new Error('Approval does not belong to the active turn')
    await entry.approvals.resolve(request.approvalId, request.decision)
    await entry.events
  }

  private require(ref: AgentSessionRef): Entry {
    const entry = this.entries.get(ref.sessionId)
    if (!entry || entry.state.runId !== ref.runId) throw new Error('Unknown or stale session identity')
    return entry
  }
  private requireTurn(ref: AgentTurnRequest): Entry {
    const entry = this.require(ref)
    this.assertTaskAvailable(entry.state.taskId)
    if (this.closing || entry.terminating || entry.storageError || entry.state.sessionStatus !== 'ready' || !entry.adapter || !entry.state.activeTurn || entry.state.activeTurn.turnId !== ref.turnId) throw new Error('Unknown or stale active turn')
    return entry
  }
  private owns(entry: Entry): boolean { return this.entries.get(entry.state.sessionId) === entry }
  private status(entry: Entry, status: AgentStatusChangedEvent['status'], scope: 'turn' | 'session', turnId?: string, error?: string): AgentStatusChangedEvent {
    return { eventId: randomUUID(), taskId: entry.state.taskId, runId: entry.state.runId, timestamp: Date.now(), type: 'agent.status.changed', status, scope, turnId, error }
  }

  private enqueue(entry: Entry, incoming: AgentEvent): Promise<void> {
    // Capture input ownership now, before later turns can take over the event queue.
    const event = { ...incoming, clientMessageId: incoming.clientMessageId ?? entry.state.activeTurn?.clientMessageId }
    const operation = entry.events.then(async () => {
      if (!this.owns(entry) || entry.storageError || event.taskId !== entry.state.taskId || event.runId !== entry.state.runId || event.type === 'raw.log' || entry.eventIds.has(event.eventId)) return
      const isTurn = event.type !== 'agent.status.changed' || event.scope === 'turn'
      if (entry.terminal && isTurn) return
      if (isTurn && event.turnId && (entry.completedTurns.has(event.turnId) || (entry.state.activeTurn?.turnId && entry.state.activeTurn.turnId !== event.turnId))) return
      await entry.journal.append(event)
      if (!this.owns(entry)) return
      this.apply(entry, event)
      this.scheduleUpdate(entry)
    })
    entry.events = operation.catch(error => {
      entry.storageError = asError(error)
      entry.state.cursor++
      entry.terminal = true
      entry.state.sessionStatus = 'error'
      entry.state.error = 'Conversation storage failed; execution stopped to preserve history integrity.'
      if (entry.state.activeTurn) entry.state.lastTurn = { ...entry.state.activeTurn, status: 'failed', error: entry.state.error }
      entry.state.activeTurn = undefined
      entry.projector.apply(this.status(entry, 'error', 'session', undefined, entry.state.error))
      this.options.registry.registerAgentSession(entry.state)
      this.failQueued(entry, entry.storageError)
      this.scheduleUpdate(entry)
      void entry.adapter?.stop(true).catch(() => {})
    })
    return operation
  }

  private apply(entry: Entry, event: AgentEvent, replay = false): void {
    entry.eventIds.add(event.eventId)
    if (event.type === 'message.started' && event.role === 'user' && event.clientMessageId) entry.inputIds.add(event.clientMessageId)
    entry.state.cursor++
    entry.projector.apply(event)
    if (event.type === 'usage.reported' && !entry.usageRequests.has(event.requestId)) {
      entry.usageRequests.add(event.requestId)
      const usage = entry.state.usage ??= { inputTokens: 0, outputTokens: 0, totalTokens: 0, requests: 0 }
      usage.inputTokens += event.inputTokens; usage.outputTokens += event.outputTokens; usage.totalTokens += event.totalTokens; usage.requests++
    }
    if (event.type === 'agent.status.changed') {
      if (event.scope === 'turn') {
        const active = entry.state.activeTurn
        if (event.status === 'starting') entry.state.activeTurn = { clientMessageId: event.clientMessageId ?? '', status: 'starting', turnId: event.turnId }
        else if (active && ['completed', 'stopped', 'error'].includes(event.status)) {
          if (!replay && event.status !== 'completed') this.pauseMessages(entry)
          entry.state.lastTurn = { clientMessageId: active.clientMessageId, turnId: event.turnId ?? active.turnId, status: event.status === 'completed' ? 'completed' : event.status === 'stopped' ? 'interrupted' : 'failed', error: event.error }
          if (entry.state.lastTurn.turnId) entry.completedTurns.add(entry.state.lastTurn.turnId)
          entry.state.activeTurn = undefined
          if (!replay) entry.approvals.clearForTask(entry.state.taskId)
        } else if (active) {
          if (event.turnId) active.turnId = event.turnId
          if (event.status === 'waiting_for_approval') active.status = 'waiting_for_approval'
          else if (event.status === 'stopping') active.status = 'interrupting'
          else if (event.status === 'running' && active.status !== 'interrupting') active.status = 'running'
        }
      } else {
        entry.state.sessionStatus = event.status === 'running' ? 'ready' : event.status === 'starting' ? 'starting' : event.status === 'stopping' ? 'stopping' : event.status === 'error' ? 'error' : 'stopped'
        if (event.error) entry.state.error = event.error
        if (['error', 'stopped', 'completed'].includes(event.status)) {
          entry.terminal = true
          const active = entry.state.activeTurn
          if (active) entry.state.lastTurn = { ...active, status: 'failed', error: event.error ?? 'Provider session closed' }
          entry.state.activeTurn = undefined
          if (!replay) { this.pauseMessages(entry); entry.approvals.clearForTask(entry.state.taskId); this.failQueued(entry, new Error(event.error ?? 'Provider session closed')) }
        }
      }
    }
    if (!replay && event.type === 'permission.requested' && !entry.approvals.get(event.approvalId)) {
      const adapter = entry.adapter
      entry.approvals.register({ ...event, data: { turnId: event.turnId }, resolver: async decision => {
        // Submission must be recorded before releasing a privileged provider action.
        await entry.events
        if (entry.storageError) throw entry.storageError
        this.assertTaskAvailable(entry.state.taskId)
        if (this.closing || !adapter || entry.adapter !== adapter || !this.owns(entry) || entry.state.activeTurn?.turnId !== event.turnId) throw new Error('Approval belongs to an inactive turn')
        await adapter.resolveApproval(event.approvalId, decision)
      } })
    }
    if (!replay && event.type === 'permission.state.changed') {
      const record = entry.approvals.get(event.approvalId)
      if (record && (event.state === 'expired' || event.state === 'resolved')) { record.state = event.state; record.decision = event.decision }
    }
    this.options.registry.registerAgentSession(entry.state)
    if (!replay && event.type === 'agent.status.changed' && event.scope === 'session' && event.status === 'running' && entry.adapter && this.owns(entry)) {
      // A provider may recover its native conversation in a replacement process.
      // Ownership stays with this run; never retain the old OS PID as its owner.
      this.options.registry.setAgentSessionPid(entry.state.sessionId, entry.state.runId, entry.adapter.getPid())
    }
    if (!replay && !entry.state.activeTurn) queueMicrotask(() => this.pump(entry))
  }

  private makeEntry(metadata: Metadata, messageQueue = new QueueStore(this.options.baseStorageDir, metadata)): Entry {
    const state: AgentSessionSnapshot = { taskId: metadata.taskId, chatId: metadata.chatId, sessionId: metadata.sessionId, runId: metadata.runId, presetName: metadata.presetName, reasoningEffort: metadata.launch?.reasoningEffort, permissions: metadata.launch ? effectivePermissionLabel(metadata.launch) : undefined, model: metadata.model, apiConnectionId: metadata.apiConnectionId, provider: metadata.provider ?? 'codex', sessionStatus: 'starting', cursor: 0, capabilities: { attachments: false, interactiveApprovals: metadata.provider !== 'antigravity', interruptTurn: metadata.provider !== 'antigravity' }, feed: [], pendingApprovals: [] }
    const entry: Entry = { state, metadata, previousFeed: [], journal: this.options.getJournal(metadata.taskId, metadata.runId), projector: createFeedProjector(), approvals: new ApprovalRegistry(), events: Promise.resolve(), eventIds: new Set(), completedTurns: new Set(), usageRequests: new Set(), deliveries: new Map(), queue: [], messageQueue, inputIds: new Set(), dispatching: false }
    entry.approvals.onStateChanged(record => {
      // Provider completion/expiry is canonical; registry contributes submission/rollback only.
      if (record.state !== 'submitting' && record.state !== 'pending') return
      void this.enqueue(entry, { eventId: randomUUID(), taskId: metadata.taskId, runId: metadata.runId, timestamp: Date.now(), type: 'permission.state.changed', approvalId: record.approvalId, state: record.state, turnId: typeof record.data?.turnId === 'string' ? record.data.turnId : undefined }).catch(() => {})
    })
    return entry
  }

  private view(entry: Entry): AgentSessionSnapshot {
    const feed = [...entry.previousFeed, ...entry.projector.messages()]
    return JSON.parse(JSON.stringify({ ...entry.state, queue: entry.messageQueue.snapshot(), feed, pendingApprovals: feed.flatMap(message => (message.approvals ?? []).filter(approval => approval.state === 'pending' || approval.state === 'submitting').map(approval => ({ ...approval, turnId: message.turnId }))) })) as AgentSessionSnapshot
  }
  private scheduleUpdate(entry: Entry): void {
    if (entry.notification) return
    entry.notification = setTimeout(() => {
      entry.notification = undefined
      if (!this.owns(entry)) return
      const update = { snapshot: this.view(entry) }
      for (const listener of this.listeners) { try { listener(update) } catch { /* One disconnected renderer cannot break the session. */ } }
    }, 16)
    entry.notification.unref?.()
  }
  private failQueued(entry: Entry, error: Error): void { for (const delivery of entry.queue.splice(0)) delivery.reject(error) }

  /** Ownership is useful even when non-identity configuration is damaged. */
  private metadataOwner(value: unknown, taskId: string, runId: string): AgentChatIdentity | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
    const item = value as Partial<Metadata>
    if (item.version !== 1 || item.taskId !== taskId || item.runId !== runId || typeof item.chatId !== 'string' || !safeId.test(item.chatId)) return undefined
    if (item.sessionId !== this.identity({ taskId, chatId: item.chatId })) return undefined
    return { taskId, chatId: item.chatId }
  }

  private validateMetadata(raw: unknown, taskId: string, runId: string): Metadata {
    const invalid = () => { throw new InvalidSessionMetadata('Invalid saved session configuration') }
    if (!this.metadataOwner(raw, taskId, runId)) invalid()
    const value = raw as Metadata
    const validLabel = (label: unknown): label is string => typeof label === 'string' && label.trim().length > 0 && label.length <= 200 && ![...label].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
    if (value.provider !== undefined && !['codex', 'claude', 'antigravity', 'api'].includes(value.provider)) invalid()
    if (value.presetName !== '' && !validLabel(value.presetName)) invalid()
    if (value.model !== undefined && !validLabel(value.model)) invalid()
    if (typeof value.createdAt !== 'number' || !Number.isFinite(value.createdAt) || value.createdAt <= 0) invalid()
    if (value.apiConnectionId !== undefined && (typeof value.apiConnectionId !== 'string' || !safeId.test(value.apiConnectionId))) invalid()
    if (value.provider === 'api' && !value.apiConnectionId) invalid()
    if (value.previousRunId !== undefined && (typeof value.previousRunId !== 'string' || !safeId.test(value.previousRunId))) invalid()
    if (value.nativeHistoryInherited !== undefined && typeof value.nativeHistoryInherited !== 'boolean') invalid()
    if (value.handoff !== undefined && (typeof value.handoff !== 'string' || value.handoff.length > 26000)) invalid()
    if (value.launch !== undefined) {
      const launch = value.launch
      if (!launch || typeof launch !== 'object' || Array.isArray(launch) || launch.provider !== (value.provider ?? 'codex') || launch.presetName !== value.presetName || launch.model !== value.model) invalid()
      if (launch.apiTransport !== undefined && !['chat-completions', 'responses'].includes(launch.apiTransport) || launch.apiProfile !== undefined && !['openai-compatible', 'codex-connector'].includes(launch.apiProfile) || launch.apiAllowCommands !== undefined && typeof launch.apiAllowCommands !== 'boolean' || launch.apiBaseUrl !== undefined && (typeof launch.apiBaseUrl !== 'string' || launch.apiBaseUrl.length > 2000)) invalid()
      if (launch.apiConnectionId !== value.apiConnectionId || (launch.apiReadOnly !== undefined && typeof launch.apiReadOnly !== 'boolean')) invalid()
      try { validateReasoningEffort(launch.provider, launch.reasoningEffort) } catch { invalid() }
      if (launch.toolPolicy === 'none' && !['claude', 'api'].includes(launch.provider)) invalid()
      if (launch.permissions !== undefined && !isPermissionLabel(launch.permissions)) invalid()
      const allowed: Record<string, readonly string[]> = { toolPolicy: ['none'], approvalPolicy: ['on-request', 'never', 'untrusted'], sandbox: ['read-only', 'workspace-write', 'danger-full-access'], claudePermissionMode: ['default', 'acceptEdits', 'plan', 'bypassPermissions', 'dontAsk'], agyPermissionMode: ['cli-settings', 'dangerously-skip'] }
      for (const [key, choices] of Object.entries(allowed)) if ((launch as unknown as Record<string, unknown>)[key] !== undefined && !choices.includes((launch as unknown as Record<string, string>)[key])) invalid()
      if (Object.keys(launch).some(key => !['provider', 'presetName', 'model', 'reasoningEffort', 'permissions', 'apiConnectionId', 'apiReadOnly', 'apiTransport', 'apiProfile', 'apiBaseUrl', 'apiAllowCommands', ...Object.keys(allowed)].includes(key))) invalid()
    }
    return value
  }

  private load(identity: AgentChatIdentity): Promise<Entry | undefined> {
    const key = this.identity(identity)
    const existing = this.entries.get(key)
    if (existing) return Promise.resolve(existing)
    const pending = this.loading.get(key)
    if (pending) return pending
    const promise = this.loadInternal(identity, key)
    this.loading.set(key, promise)
    void promise.finally(() => { if (this.loading.get(key) === promise) this.loading.delete(key) }).catch(() => {})
    return promise
  }
  private metadataFilename(taskId: string, runId: string): string {
    if (!safeId.test(taskId) || !safeId.test(runId)) throw new Error('Invalid saved session identity')
    return path.join(path.dirname(EventJournal.getJournalPath(this.options.baseStorageDir, taskId, runId)), 'session.json')
  }
  private metadataStore(taskId: string, runId: string): RecoveryStore<Metadata> {
    return new RecoveryStore<Metadata>({ filename: this.metadataFilename(taskId, runId), maxBytes: 1024 * 1024,
      validate: (value): asserts value is Metadata => { this.validateMetadata(value, taskId, runId) } })
  }
  private runsDirectory(taskId: string): string {
    const parent = path.dirname(path.dirname(this.metadataFilename(taskId, 'placeholder')))
    assertPrivateFile(path.join(parent, '.path-check'))
    return parent
  }
  private checkedRunDirectories(directories: fs.Dirent[]): string[] {
    return directories.flatMap(directory => {
      if (directory.isSymbolicLink()) throw new Error('Unsafe session storage directory')
      return directory.isDirectory() && safeId.test(directory.name) ? [directory.name] : []
    })
  }
  private runDirectories(taskId: string): string[] {
    return this.checkedRunDirectories(fs.readdirSync(this.runsDirectory(taskId), { withFileTypes: true }))
  }
  private hasRunEvidence(taskId: string, runId: string): boolean {
    const folder = path.dirname(this.metadataFilename(taskId, runId))
    for (const name of ['events.ndjson', 'provider.json']) {
      const file = path.join(folder, name)
      assertPrivateFile(file)
      try { fs.lstatSync(file); return true } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
    }
    // A previously published metadata backup is evidence even if its primary
    // was removed. Empty or failed-publication temporary directories are not.
    return this.metadataStore(taskId, runId).inspect().backups.length > 0
  }

  inspectRecovery(taskId: string, runId: string): RecoveryInspection & { error?: string } {
    if (!this.runDirectories(taskId).includes(runId)) throw new Error('The saved session run does not exist')
    const inspection = this.metadataStore(taskId, runId).inspect()
    return inspection.state === 'missing' && this.hasRunEvidence(taskId, runId)
      ? { ...inspection, state: 'corrupt', error: 'Session metadata is missing while saved history remains. Preserve the history and restore a known good metadata copy; the missing file was not recreated.' }
      : inspection
  }
  async listRecovery(taskId: string): Promise<RecoveryDocument[]> {
    const reports = this.runDirectories(taskId).flatMap<RecoveryDocument>(runId => {
      const target = { domain: 'session' as const, taskId, runId }
      try {
        const inspection = this.inspectRecovery(taskId, runId)
        return inspection.state === 'corrupt' ? [{ target, ...inspection }] : []
      } catch (error) {
        return [{ target, state: 'unavailable' as const, fingerprint: null, backups: [], invalidBackups: 0, error: asError(error).message }]
      }
    })
    const queueDirectory = path.join(this.options.baseStorageDir, taskId, 'queues')
    assertPrivateFile(path.join(queueDirectory, '.path-check'))
    const sessionIds = new Set(fs.readdirSync(queueDirectory).map(name => name.replace(/\.json(?:\.recovery)?$/, '')).filter(name => /^session-[a-f0-9]{40}$/.test(name)))
    for (const sessionId of sessionIds) {
      const target = { domain: 'message-queue' as const, taskId, sessionId }
      try {
        const inspection = this.inspectQueueRecovery(taskId, sessionId)
        if (inspection.state === 'corrupt') reports.push({ target, ...inspection })
      } catch (error) { reports.push({ target, state: 'unavailable', fingerprint: null, backups: [], invalidBackups: 0, error: asError(error).message }) }
    }
    return reports
  }
  private recoveryQueue(taskId: string, sessionId: string): QueueStore {
    if (!safeId.test(taskId) || !/^session-[a-f0-9]{40}$/.test(sessionId)) throw new Error('Invalid saved message queue identity')
    for (const runId of this.runDirectories(taskId)) {
      try {
        const metadata = this.metadataStore(taskId, runId).read()
        if (metadata?.sessionId === sessionId) return new QueueStore(this.options.baseStorageDir, metadata, 'inspect')
      } catch (error) { if (!(error instanceof RecoveryRequiredError)) throw error }
    }
    throw new Error('Restore this conversation metadata before inspecting its message queue')
  }
  inspectQueueRecovery(taskId: string, sessionId: string): RecoveryInspection & { error?: string } {
    return this.recoveryQueue(taskId, sessionId).inspect()
  }
  restoreQueueRecovery(taskId: string, sessionId: string, request: { expectedFingerprint: string; backupId: string }): { fingerprint: string; preservedFingerprint: string } {
    if (this.closing || this.startedSession || this.entries.size || this.creating.size || this.loading.size || this.removalLocks.size) throw new Error('Restart the application and restore saved queues before opening or starting chats')
    return this.recoveryQueue(taskId, sessionId).restore(request)
  }
  restoreRecovery(taskId: string, runId: string, request: { expectedFingerprint: string; backupId: string }): { fingerprint: string; preservedFingerprint: string } {
    // This synchronous boundary cannot interleave with create/load. A fresh
    // manager may inspect documents, but must restore before caching history or
    // starting any provider; no live owner or stale projection is discarded.
    if (this.closing || this.startedSession || this.entries.size || this.creating.size || this.loading.size || this.removalLocks.size) throw new Error('Restart the application and restore session metadata before opening or starting chats')
    this.inspectRecovery(taskId, runId)
    return this.metadataStore(taskId, runId).restore(request)
  }

  private async loadInternal(identity: AgentChatIdentity, key: string): Promise<Entry | undefined> {
    const matches: Metadata[] = []
    const directories = await fs.promises.readdir(this.runsDirectory(identity.taskId), { withFileTypes: true })
    for (const runId of this.checkedRunDirectories(directories)) {
      const file = this.metadataFilename(identity.taskId, runId)
      try {
        const metadata = this.metadataStore(identity.taskId, runId).read()
        if (!metadata) {
          if (this.hasRunEvidence(identity.taskId, runId)) throw new SessionMetadataRecoveryError(identity.taskId, runId)
          continue
        }
        if (metadata.sessionId === key) matches.push(metadata)
      } catch (error) {
        if (!(error instanceof RecoveryRequiredError)) throw error
        // Invalid configuration with a complete, path-bound ownership envelope
        // can be isolated to its proven other chat. Torn/unknown identity cannot:
        // it could be the newest run, so neither empty history nor an older
        // matching run is a safe fallback. Never infer identity from mtime.
        let owner: AgentChatIdentity | undefined
        try { owner = this.metadataOwner(await readPrivateMetadata(file), identity.taskId, runId) }
        catch (failure) { if (!(failure instanceof SyntaxError) && (failure as NodeJS.ErrnoException).code !== 'ENOENT') throw failure }
        if (owner && owner.chatId !== identity.chatId) continue
        throw new SessionMetadataRecoveryError(identity.taskId, runId)
      }
    }
    const metadata = matches.sort((a, b) => b.createdAt - a.createdAt)[0]
    if (!metadata) return undefined
    const entry = this.makeEntry(metadata)
    const visited = new Set<string>([metadata.runId])
    const history: Metadata[] = []
    let ancestor = metadata.previousRunId
    while (ancestor) {
      if (visited.has(ancestor) || visited.size > 1000) throw new Error('Invalid session history lineage')
      visited.add(ancestor)
      const parent = matches.find(value => value.runId === ancestor)
      if (!parent) throw new Error('A previous conversation history segment is missing')
      history.unshift(parent)
      ancestor = parent.previousRunId
    }
    entry.messageQueue.assertContext(queueContext(this.frozenLaunch(entry)), visited)
    for (const parent of history) {
      const projector = createFeedProjector()
      for (const event of await this.options.getJournal(parent.taskId, parent.runId).readEvents()) {
        if (event.taskId === parent.taskId && event.runId === parent.runId) {
          projector.apply(event)
          if (event.type === 'message.started' && event.role === 'user' && event.clientMessageId) entry.inputIds.add(event.clientMessageId)
        }
      }
      projector.apply({ ...this.status(entry, 'stopped', 'session'), runId: parent.runId })
      entry.previousFeed.push(...projector.messages().map(message => ({ ...message, id: `${parent.runId}:${message.id}` })))
    }
    try {
      const reference = await readPrivateMetadata(path.join(path.dirname(entry.journal.filePath), 'provider.json')) as { version?: unknown; provider?: unknown; id?: unknown }
      if (reference && typeof reference === 'object' && !Array.isArray(reference) && reference.version === 1 && reference.provider === entry.state.provider && typeof reference.id === 'string' && /^[A-Za-z0-9_-]{1,200}$/.test(reference.id)) {
        entry.providerReference = reference.id
        entry.state.resumeAvailable = true
      }
    } catch (error) { if (!(error instanceof SyntaxError) && (error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
    const events = await entry.journal.readEvents()
    for (const event of events) if (event.taskId === metadata.taskId && event.runId === metadata.runId && !entry.eventIds.has(event.eventId)) this.apply(entry, event, true)
    entry.messageQueue.quarantineSeenInputs(entry.inputIds)
    if (events.some(event => event.type === 'agent.status.changed' && event.scope === 'turn' && ['running', 'completed', 'stopped'].includes(event.status))) entry.metadata.handoff = undefined
    // A journal is history, never evidence that a provider process or approval remains alive.
    const disconnected = this.status(entry, 'error', 'session', undefined, 'Provider disconnected after application restart. Resume this conversation to continue; interrupted inputs are never resent automatically.')
    entry.projector.apply(disconnected)
    if (entry.state.activeTurn) entry.state.lastTurn = { ...entry.state.activeTurn, status: 'failed', error: disconnected.error }
    entry.state.activeTurn = undefined
    entry.state.sessionStatus = 'disconnected'
    entry.state.error = disconnected.error
    this.entries.set(key, entry)
    this.options.registry.registerAgentSession(entry.state)
    return entry
  }

  async shutdown(): Promise<void> {
    this.closing = true
    // Stop a pending handshake immediately; waiting for create first would leave it running until timeout.
    const stopped = new Set<Entry>()
    await Promise.allSettled([...this.entries.values()].map(async entry => {
      this.failQueued(entry, new Error('Application is shutting down'))
      try { this.pauseMessages(entry) } catch { /* Shutdown still owns and stops the provider; restore pauses persisted inputs. */ }
      try {
        await entry.adapter?.stop(false)
        stopped.add(entry)
        this.options.registry.setAgentSessionPid(entry.state.sessionId, entry.state.runId, undefined)
      } catch (error) {
        await this.enqueue(entry, this.status(entry, 'error', 'session', undefined, asError(error).message)).catch(() => {})
      }
    }))
    await Promise.allSettled([...this.creating.values()])
    await Promise.allSettled([...this.entries.values()].map(async entry => {
      await entry.events
      if (stopped.has(entry) && entry.adapter && !entry.storageError) await this.enqueue(entry, this.status(entry, 'stopped', 'session'))
      if (entry.notification) clearTimeout(entry.notification)
      entry.approvals.clearAll()
    }))
  }
}
