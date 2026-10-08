import path from 'node:path'
import { createHash } from 'node:crypto'
import type { AgentChatIdentity, AgentMessageQueue, AgentQueuedMessage } from '../../shared/agent-session'
import { RecoveryStore, type RecoveryInspection } from './RecoveryStore'

type Outcome = 'delivered' | 'cancelled' | 'rejected'
interface SavedItem extends AgentQueuedMessage { acceptedRunId: string; context: string }
interface Receipt { clientMessageId: string; textHash: string; outcome: Outcome }
interface Document extends AgentChatIdentity {
  version: 1
  sessionId: string
  revision: number
  paused: boolean
  items: SavedItem[]
  receipts: Receipt[]
  error?: string
}
const id = /^[A-Za-z0-9_-]{1,160}$/
const hash = /^[a-f0-9]{64}$/
const MAX_ITEMS = 100
const MAX_TEXT_BYTES = 4 * 1024 * 1024
const MAX_IDENTITIES = 10_000
const digest = (value: string) => createHash('sha256').update(value).digest('hex')
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

/** Durable input outbox. A dispatch intent is saved before any provider call. */
export class QueueStore {
  readonly filename: string
  private readonly store: RecoveryStore<Document>
  private document: Document
  private fingerprint: string | null
  private failure?: string
  private readonly restoreGuard: RecoveryStore<{ version: 1; pending: boolean }>

  constructor(baseDirectory: string, identity: AgentChatIdentity & { sessionId: string }, mode: 'open' | 'inspect' = 'open') {
    if (![identity.taskId, identity.chatId, identity.sessionId].every(value => id.test(value))) throw new Error('Invalid message queue identity')
    this.filename = path.join(baseDirectory, identity.taskId, 'queues', `${identity.sessionId}.json`)
    const validate = (value: unknown): asserts value is Document => {
      const invalid = () => { throw new Error('Saved message queue is damaged; preserve it and restore a validated backup') }
      if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid()
      const doc = value as Document
      if (doc.version !== 1 || doc.taskId !== identity.taskId || doc.chatId !== identity.chatId || doc.sessionId !== identity.sessionId || !Number.isSafeInteger(doc.revision) || doc.revision < 0 || typeof doc.paused !== 'boolean' || !Array.isArray(doc.items) || !Array.isArray(doc.receipts) || doc.items.length > MAX_ITEMS || doc.items.length + doc.receipts.length > MAX_IDENTITIES || doc.error !== undefined && (typeof doc.error !== 'string' || doc.error.length > 2000)) return invalid()
      const ids = new Set<string>()
      let bytes = 0
      for (const item of doc.items) {
        if (!item || typeof item !== 'object' || Array.isArray(item) || typeof item.clientMessageId !== 'string' || !id.test(item.clientMessageId) || ids.has(item.clientMessageId) || typeof item.text !== 'string' || !item.text.trim() || item.text.length > 1_000_000 || !Number.isSafeInteger(item.createdAt) || item.createdAt < 0 || !['queued', 'dispatching', 'uncertain'].includes(item.status) || typeof item.acceptedRunId !== 'string' || !id.test(item.acceptedRunId) || typeof item.context !== 'string' || !hash.test(item.context) || item.error !== undefined && (typeof item.error !== 'string' || item.error.length > 2000)) return invalid()
        ids.add(item.clientMessageId); bytes += Buffer.byteLength(item.text)
      }
      if (bytes > MAX_TEXT_BYTES) return invalid()
      for (const receipt of doc.receipts) {
        if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt) || typeof receipt.clientMessageId !== 'string' || !id.test(receipt.clientMessageId) || ids.has(receipt.clientMessageId) || typeof receipt.textHash !== 'string' || !hash.test(receipt.textHash) || !['delivered', 'cancelled', 'rejected'].includes(receipt.outcome)) return invalid()
        ids.add(receipt.clientMessageId)
      }
    }
    this.store = new RecoveryStore({ filename: this.filename, validate, maxBytes: 8 * 1024 * 1024 })
    this.restoreGuard = new RecoveryStore({ filename: `${this.filename}.restore-state`, validate: (value): asserts value is { version: 1; pending: boolean } => {
      if (!value || typeof value !== 'object' || Array.isArray(value) || (value as { version?: unknown }).version !== 1 || typeof (value as { pending?: unknown }).pending !== 'boolean') throw new Error('Message queue recovery marker is damaged')
    } })
    const inspection = this.store.inspect()
    this.fingerprint = inspection.fingerprint
    this.document = { version: 1, taskId: identity.taskId, chatId: identity.chatId, sessionId: identity.sessionId, revision: 0, paused: false, items: [], receipts: [] }
    if (mode === 'inspect') return
    const saved = this.store.read()
    if (!saved && (inspection.backups.length || inspection.invalidBackups)) throw new Error('Saved message queue is missing; preserve its recovery files before continuing')
    this.document = saved ?? this.document
    const guardInspection = this.restoreGuard.inspect()
    const restoring = this.restoreGuard.read()?.pending ?? Boolean(guardInspection.backups.length || guardInspection.invalidBackups)
    if (saved && (saved.items.length || !saved.paused || restoring)) this.mutate(doc => {
      doc.paused = true
      for (const item of doc.items) if (restoring || item.status === 'dispatching') { item.status = 'uncertain'; item.error = 'Application stopped during delivery or restored older queue data. This input will not be sent again automatically.' }
    })
    if (restoring) this.restoreGuard.write({ version: 1, pending: false })
  }

  snapshot(): AgentMessageQueue {
    return { revision: this.document.revision + (this.failure ? 1 : 0), paused: this.document.paused || Boolean(this.failure), items: this.document.items.map(item => ({ clientMessageId: item.clientMessageId, text: item.text, createdAt: item.createdAt, status: item.status, error: item.error })), error: this.failure ?? this.document.error }
  }
  get size(): number { return this.document.items.length }
  get blocked(): boolean { return Boolean(this.failure) }
  acceptedRunIds(): ReadonlySet<string> { return new Set(this.document.items.map(item => item.acceptedRunId)) }
  inspect(): RecoveryInspection & { error?: string } {
    const guard = this.restoreGuard.inspect()
    if (guard.state === 'corrupt') return { ...guard, error: 'Message queue recovery marker is damaged. Restore its validated backup; queued inputs will remain quarantined.' }
    const result = this.store.inspect()
    return result.state === 'missing' && (result.backups.length || result.invalidBackups) ? { ...result, state: 'corrupt', error: 'Saved message queue is missing while recovery history remains; it was not recreated.' } : result
  }
  restore(request: { expectedFingerprint: string; backupId: string }): { fingerprint: string; preservedFingerprint: string } {
    const guard = this.restoreGuard.inspect()
    if (guard.state === 'corrupt' && guard.fingerprint === request.expectedFingerprint) {
      // Quarantine the primary before restoring a marker that might say false.
      // If the primary is damaged too, it already prevents all execution; its
      // subsequent explicit restore follows the guarded path below.
      const primary = this.store.inspect()
      if (primary.state === 'valid') {
        this.fingerprint = primary.fingerprint
        this.document = this.store.read()!
        this.mutate(doc => { doc.paused = true; for (const item of doc.items) item.status = 'uncertain' })
      }
      const restored = this.restoreGuard.restore(request)
      this.restoreGuard.write({ version: 1, pending: true })
      return { ...restored, fingerprint: this.restoreGuard.inspect().fingerprint! }
    }
    // Marker is durable before restoring older state. A crash between restore
    // and quarantine cannot turn an old queued record into automatic delivery.
    this.restoreGuard.write({ version: 1, pending: true })
    const restored = this.store.restore(request)
    this.fingerprint = restored.fingerprint
    this.document = this.store.read()!
    this.mutate(doc => {
      doc.paused = true
      for (const item of doc.items) { item.status = 'uncertain'; item.error = 'Restored queue entry may already have been delivered. Dismiss it; it will not be resent automatically.' }
    })
    this.restoreGuard.write({ version: 1, pending: false })
    return { ...restored, fingerprint: this.fingerprint! }
  }
  quarantineSeenInputs(ids: ReadonlySet<string>): void {
    if (!this.document.items.some(item => item.status === 'queued' && ids.has(item.clientMessageId))) return
    this.mutate(doc => {
      doc.paused = true
      for (const item of doc.items) if (ids.has(item.clientMessageId)) { item.status = 'uncertain'; item.error = 'This input already appears in saved conversation history and will not be resent automatically.' }
    })
  }
  hasIdentity(clientMessageId: string): boolean { return this.document.items.some(item => item.clientMessageId === clientMessageId) || this.document.receipts.some(item => item.clientMessageId === clientMessageId) }
  assertContext(context: string, runIds: ReadonlySet<string>): void {
    if (this.document.items.some(item => item.status !== 'uncertain' && (item.context !== context || !runIds.has(item.acceptedRunId)))) throw new Error('Pending messages belong to another saved provider configuration or run; they were not sent')
  }
  accept(request: { clientMessageId: string; text: string; runId: string }, context: string): void {
    const existing = this.document.items.find(item => item.clientMessageId === request.clientMessageId)
    const receipt = this.document.receipts.find(item => item.clientMessageId === request.clientMessageId)
    if (existing || receipt) {
      if ((existing ? digest(existing.text) : receipt!.textHash) !== digest(request.text)) throw new Error('Message identity was already used with different content')
      if (this.failure) throw new Error(this.failure)
      return
    }
    if (this.document.items.length >= MAX_ITEMS || this.document.items.length + this.document.receipts.length >= MAX_IDENTITIES || this.document.items.reduce((bytes, item) => bytes + Buffer.byteLength(item.text), Buffer.byteLength(request.text)) > MAX_TEXT_BYTES) throw new Error('Message queue limit reached; finish or cancel queued inputs, or start a new chat')
    this.mutate(doc => { doc.items.push({ clientMessageId: request.clientMessageId, text: request.text, acceptedRunId: request.runId, context, createdAt: Date.now(), status: 'queued' }); doc.error = undefined })
  }
  pause(paused: boolean): void {
    if (!paused && this.document.items.some(item => item.status === 'uncertain')) throw new Error('Dismiss messages with uncertain delivery before continuing the queue')
    if (this.document.paused !== paused) this.mutate(doc => { doc.paused = paused })
    else if (this.failure) throw new Error(this.failure)
  }
  beginDispatch(): AgentQueuedMessage | undefined {
    if (this.failure || this.document.paused || this.document.items.some(item => item.status !== 'queued')) return undefined
    const next = this.document.items[0]
    if (!next) return undefined
    this.mutate(doc => { doc.items[0].status = 'dispatching' })
    return clone(this.document.items[0])
  }
  finish(clientMessageId: string, outcome: Outcome): void {
    const item = this.document.items.find(value => value.clientMessageId === clientMessageId)
    if (!item) return
    if (outcome === 'cancelled' && item.status === 'dispatching') throw new Error('This message is already being delivered; interrupt its active turn instead')
    this.mutate(doc => {
      doc.items = doc.items.filter(value => value.clientMessageId !== clientMessageId)
      doc.receipts.push({ clientMessageId, textHash: digest(item.text), outcome })
      if (outcome === 'rejected') { doc.paused = true; doc.error = 'The provider rejected a queued input. Review its failed conversation entry before continuing.' }
    })
  }
  uncertain(clientMessageId: string): void {
    this.mutate(doc => {
      const item = doc.items.find(value => value.clientMessageId === clientMessageId)
      if (item) { item.status = 'uncertain'; item.error = 'Delivery was not confirmed. This input will not be sent again automatically.' }
      doc.paused = true
    })
  }
  private mutate(operation: (doc: Document) => void): void {
    if (this.failure) throw new Error(this.failure)
    const next = clone(this.document)
    operation(next); next.revision++
    try {
      this.store.write(next, this.fingerprint)
      this.fingerprint = digest(JSON.stringify(next))
      this.document = next
    } catch (error) {
      // A write may have published before directory fsync failed. Never infer that
      // it did not happen, clear the draft, or attempt a provider call afterward.
      this.failure = 'Message queue storage failed. Execution is paused; restart and inspect the saved queue before continuing.'
      throw error
    }
  }
}

/** Fixed-key input avoids property-order differences between saved and live launch configs. */
export function queueContext(launch: { toolPolicy?: 'none'; reasoningEffort?: string | null; provider: string; presetName: string; model?: string; apiConnectionId?: string; approvalPolicy?: string; sandbox?: string; claudePermissionMode?: string; agyPermissionMode?: string; apiReadOnly?: boolean; apiTransport?: string; apiProfile?: string; apiBaseUrl?: string; apiAllowCommands?: boolean; apiGrokConfig?: { contextWindow?: number; maxTurns?: number } }): string {
  return digest(JSON.stringify([launch.provider, launch.presetName, launch.model ?? null, launch.apiConnectionId ?? null, launch.approvalPolicy ?? 'on-request', launch.sandbox ?? 'workspace-write', launch.claudePermissionMode ?? 'default', launch.agyPermissionMode ?? 'cli-settings', launch.apiReadOnly ?? false, ...(launch.reasoningEffort !== undefined ? [{ reasoningEffort: launch.reasoningEffort }] : []), ...(launch.toolPolicy !== undefined ? [{ toolPolicy: launch.toolPolicy }] : []), ...(launch.apiTransport === 'responses' ? [{ apiTransport: launch.apiTransport, apiProfile: launch.apiProfile ?? 'openai-compatible', apiBaseUrl: launch.apiBaseUrl ?? null, apiAllowCommands: launch.apiAllowCommands ?? false }] : []), ...(launch.apiProfile === 'grok-connector-v1' ? [{ apiGrokConfig: { contextWindow: launch.apiGrokConfig?.contextWindow ?? null, maxTurns: launch.apiGrokConfig?.maxTurns ?? null } }] : [])]))
}
