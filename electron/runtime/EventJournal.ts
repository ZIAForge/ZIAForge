import { validArtifactRef, MAX_ARTIFACTS_PER_EVENT } from '../../shared/agent-artifacts'
import { validInputDocumentRef, MAX_INPUT_DOCUMENTS, MAX_INPUT_DOCUMENT_BATCH_BYTES } from '../../shared/agent-input-documents'
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { createFeedProjector } from '../../shared/agent-feed'
import { assertPrivateFile, ensurePrivateDirectory } from './privateStorage'
import { validMediaRef } from '../../shared/agent-media'
import { MAX_INPUT_IMAGES, MAX_INPUT_IMAGE_BATCH_BYTES, validInputImageRef } from '../../shared/agent-input-images'
import {
  AgentEvent,
  ReconstructedToolItem,
  ReconstructedApprovalItem,
  ReconstructedMessage,
} from '../../shared/agent-events'

export type {
  ReconstructedToolItem,
  ReconstructedApprovalItem,
  ReconstructedMessage,
}

export class EventJournal {
  readonly filePath: string
  private writeQueue: Promise<void> = Promise.resolve()

  constructor(filePath: string, private readonly options: { privateStorage?: boolean } = {}) {
    this.filePath = path.resolve(filePath)
  }

  /**
   * Validates IDs and constructs a canonical journal path guaranteed to reside within baseDir.
   */
  static getJournalPath(baseDir: string, taskId: string, runId: string): string {
    const safeIdPattern = /^[a-zA-Z0-9_-]+$/
    if (!safeIdPattern.test(taskId)) {
      throw new Error(`Invalid taskId format: "${taskId}". Must contain only alphanumeric, dash or underscore characters.`)
    }
    if (!safeIdPattern.test(runId)) {
      throw new Error(`Invalid runId format: "${runId}". Must contain only alphanumeric, dash or underscore characters.`)
    }

    const resolvedBase = path.resolve(baseDir)
    const targetPath = path.resolve(resolvedBase, 'artifacts', 'worktrees', taskId, 'runs', runId, 'events.ndjson')

    if (!targetPath.startsWith(resolvedBase + path.sep) && targetPath !== resolvedBase) {
      throw new Error(`Path traversal detected: target path "${targetPath}" escapes base directory "${resolvedBase}"`)
    }

    return targetPath
  }

  private ensureDir(): void {
    const dir = path.dirname(this.filePath)
    if (this.options.privateStorage) {
      ensurePrivateDirectory(dir)
      assertPrivateFile(this.filePath)
      return
    }
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
  }

  /**
   * Checks if the journal file ends with a newline.
   * If it ends abruptly (torn line), returns '\n' prefix to preserve data integrity.
   * Verifies bytesRead and avoids swallowing non-ENOENT I/O errors.
   */
  private async getRepairPrefix(): Promise<string> {
    if (!fs.existsSync(this.filePath)) return ''
    const stat = await fs.promises.stat(this.filePath)
    if (stat.size === 0) return ''

    const fd = await fs.promises.open(this.filePath, fs.constants.O_RDONLY | (this.options.privateStorage ? fs.constants.O_NOFOLLOW : 0))
    try {
      const buf = Buffer.alloc(1)
      const { bytesRead } = await fd.read(buf, 0, 1, stat.size - 1)
      if (bytesRead === 1 && buf[0] !== 0x0A) {
        return '\n'
      }
      return ''
    } finally {
      await fd.close()
    }
  }

  /**
   * Appends a single event to the NDJSON journal safely.
   */
  async append(event: AgentEvent): Promise<void> {
    return this.appendBatch([event])
  }

  /**
   * Appends multiple events in sequence or batch safely to NDJSON.
   * Tolerates prior failures without poisoning the write queue for future writes.
   */
  async appendBatch(events: AgentEvent[]): Promise<void> {
    if (events.length === 0) return
    for (const event of events) if (!validMediaEvent(event)) throw new Error('Invalid or oversized media event')

    const rawPayload = events.map((evt) => JSON.stringify(evt)).join('\n') + '\n'

    // Chain execution without poisoning queue on failure
    const currentWrite = this.writeQueue.catch(() => {}).then(async () => {
      this.ensureDir()
      const prefix = await this.getRepairPrefix()
      if (this.options.privateStorage) {
        const handle = await fs.promises.open(this.filePath, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_APPEND | fs.constants.O_NOFOLLOW, 0o600)
        try {
          await handle.chmod(0o600)
          await handle.writeFile(prefix + rawPayload, 'utf8')
        } finally { await handle.close() }
      } else {
        await fs.promises.appendFile(this.filePath, prefix + rawPayload, { encoding: 'utf8' })
      }
    })

    this.writeQueue = currentWrite
    return currentWrite
  }

  /**
   * Reads all valid events from the journal. Corrupted/incomplete lines are safely skipped.
   */
  async readEvents(): Promise<AgentEvent[]> {
    await this.writeQueue
    if (this.options.privateStorage) assertPrivateFile(this.filePath)
    if (!fs.existsSync(this.filePath)) {
      return []
    }

    const events: AgentEvent[] = []
    const fileStream = this.options.privateStorage
      ? (await fs.promises.open(this.filePath, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW)).createReadStream({ encoding: 'utf8' })
      : fs.createReadStream(this.filePath, { encoding: 'utf8' })
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    })

    for await (const line of rl) {
      const trimmed = line.trim()
      if (!trimmed) continue

      try {
        const parsed = JSON.parse(trimmed) as AgentEvent
        if (parsed && typeof parsed === 'object' && parsed.eventId && parsed.type && validMediaEvent(parsed)) {
          events.push(parsed)
        }
      } catch {
        // Corrupted or incomplete line (e.g. process killed during write) - skip safely
      }
    }

    return events
  }

  /**
   * Stream events one by one via a callback.
   * Returns the count of processed valid events. Awaits asynchronous callbacks.
   */
  async streamEvents(onEvent: (event: AgentEvent) => Promise<void> | void): Promise<number> {
    await this.writeQueue
    if (this.options.privateStorage) assertPrivateFile(this.filePath)
    if (!fs.existsSync(this.filePath)) {
      return 0
    }

    let count = 0
    const fileStream = this.options.privateStorage
      ? (await fs.promises.open(this.filePath, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW)).createReadStream({ encoding: 'utf8' })
      : fs.createReadStream(this.filePath, { encoding: 'utf8' })
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    })

    for await (const line of rl) {
      const trimmed = line.trim()
      if (!trimmed) continue

      let parsed: AgentEvent | null = null
      try {
        const json = JSON.parse(trimmed)
        if (json && typeof json === 'object' && json.eventId && json.type && validMediaEvent(json as AgentEvent)) {
          parsed = json as AgentEvent
        }
      } catch {
        // Skip corrupted JSON line
        continue
      }

      if (parsed) {
        await onEvent(parsed)
        count++
      }
    }

    return count
  }

  /**
   * Reconstructs an ordered projection of conversation feed items from the append-only event stream.
   * Correctly accumulates tool outputs, reconciles fullContent, and tracks statuses.
   */
  async reconstructFeed(): Promise<ReconstructedMessage[]> {
    const events = await this.readEvents()
    const projector = createFeedProjector()
    for (const event of events) projector.apply(event)
    return projector.messages()
  }
}

/** New binary results are metadata only; old non-media journals stay compatible. */
function validMediaEvent(event: AgentEvent): boolean {
  if (event.type === 'tool.started' && event.executor !== undefined && !['caller', 'provider'].includes(event.executor)) return false
  if (event.type === 'message.started' && event.inputDocuments !== undefined) {
    if (event.role !== 'user' || !Array.isArray(event.inputDocuments) || event.inputDocuments.length > MAX_INPUT_DOCUMENTS || !event.inputDocuments.every(validInputDocumentRef) || new Set(event.inputDocuments.map(ref => ref.id)).size !== event.inputDocuments.length || event.inputDocuments.reduce((bytes, ref) => bytes + ref.bytes, 0) > MAX_INPUT_DOCUMENT_BATCH_BYTES || Buffer.byteLength(JSON.stringify(event)) > 16 * 1024) return false
  }
  if ((event.type === 'message.started' || event.type === 'tool.completed') && event.artifacts !== undefined && (!Array.isArray(event.artifacts) || event.artifacts.length > MAX_ARTIFACTS_PER_EVENT || !event.artifacts.every(ref => validArtifactRef(ref) && ref.sourceRunId === event.runId) || Buffer.byteLength(JSON.stringify(event)) > 16 * 1024)) return false
  if (event.type === 'message.started' && event.inputImages !== undefined) {
    if (event.role !== 'user' || !Array.isArray(event.inputImages) || event.inputImages.length > MAX_INPUT_IMAGES || !event.inputImages.every(validInputImageRef) || new Set(event.inputImages.map(ref => ref.id)).size !== event.inputImages.length || event.inputImages.reduce((bytes, ref) => bytes + ref.bytes, 0) > MAX_INPUT_IMAGE_BATCH_BYTES || Buffer.byteLength(JSON.stringify(event)) > 16 * 1024) return false
  }
  if ((event.type !== 'tool.completed' && event.type !== 'message.started') || event.media === undefined) return true
  if (event.type === 'message.started' && event.role !== 'user') return false
  return Array.isArray(event.media) && event.media.length <= 4 && event.media.every(ref => validMediaRef(ref) && ref.sourceRunId === event.runId) && Buffer.byteLength(JSON.stringify(event)) <= 16 * 1024
}
