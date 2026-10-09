import fs from 'node:fs'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { TextDecoder } from 'node:util'
import {
  MAX_INPUT_DOCUMENT_BATCH_BYTES, MAX_INPUT_DOCUMENT_BYTES, MAX_INPUT_DOCUMENT_CACHE_BYTES, MAX_INPUT_DOCUMENTS, MAX_INPUT_TEXT_DOCUMENT_BYTES,
  validInputDocumentId, validInputDocumentOwner, validInputDocumentRef,
  type AgentInputDocumentOwner, type AgentInputDocumentRef,
} from '../../shared/agent-input-documents'
import { assertPrivateFile, ensurePrivateDirectory, writePrivateMetadata } from './privateStorage'
import { syncDirectoryAsync } from './syncDirectory'

/** Main-only provider input. Never return this result over IPC or store it in the event journal. */
export interface ResolvedAgentInputDocument { id: string; name: string; mime: AgentInputDocumentRef['mime']; data: string }
interface StoredInputDocument { version: 1; owner: AgentInputDocumentOwner; ref: AgentInputDocumentRef }
const MAX_METADATA_BYTES = 4096
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
const sameOwner = (a: AgentInputDocumentOwner, b: AgentInputDocumentOwner) => a.taskId === b.taskId && a.chatId === b.chatId && a.sessionId === b.sessionId && a.runId === b.runId
function copyOwner(value: AgentInputDocumentOwner): AgentInputDocumentOwner {
  if (!validInputDocumentOwner(value)) throw new Error('Invalid input document owner')
  return { ...value }
}
function copyIds(ids: readonly string[]): string[] {
  if (!Array.isArray(ids) || ids.length > MAX_INPUT_DOCUMENTS || new Set(ids).size !== ids.length || !ids.every(validInputDocumentId)) throw new Error('Select up to four distinct input documents')
  return [...ids]
}
function safeName(selected: string): string {
  // eslint-disable-next-line no-control-regex
  return path.basename(selected).replace(/[\x00-\x1f\x7f/\\\u202a-\u202e\u2066-\u2069]/g, '_').slice(0, 160).trim() || 'document'
}

/** Native selections and cached copies cannot traverse a symlink in any path component. */
async function assertRegularPath(filename: string): Promise<fs.Stats> {
  const absolute = path.resolve(filename)
  let current = path.parse(absolute).root
  const components = absolute.slice(current.length).split(path.sep).filter(Boolean)
  let last: fs.Stats | undefined
  for (let index = 0; index < components.length; index++) {
    current = path.join(current, components[index])
    const stat = await fs.promises.lstat(current)
    if (stat.isSymbolicLink() || (index < components.length - 1 ? !stat.isDirectory() : !stat.isFile())) throw new Error('Choose a regular document file, not a symbolic link')
    last = stat
  }
  if (!last) throw new Error('Choose a regular document file')
  return last
}

async function readBoundedFile(filename: string, maximum: number): Promise<Buffer> {
  const before = await assertRegularPath(filename)
  const handle = await fs.promises.open(filename, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK)
  try {
    const pinned = await handle.stat()
    if (!pinned.isFile() || pinned.dev !== before.dev || pinned.ino !== before.ino) throw new Error('The selected document changed; select it again')
    if (!Number.isSafeInteger(pinned.size) || pinned.size <= 0 || pinned.size > maximum) throw new Error('Invalid or oversized input document file')
    const bytes = Buffer.alloc(pinned.size + 1)
    let used = 0
    while (used < bytes.length) {
      const result = await handle.read(bytes, used, bytes.length - used, used)
      if (!result.bytesRead) break
      used += result.bytesRead
    }
    const after = await handle.stat()
    if (used !== pinned.size || after.size !== pinned.size || after.mtimeMs !== pinned.mtimeMs || after.ctimeMs !== pinned.ctimeMs) throw new Error('The selected document changed; select it again')
    return bytes.subarray(0, used)
  } finally { await handle.close() }
}

function textData(bytes: Buffer): string {
  if (bytes.length > MAX_INPUT_TEXT_DOCUMENT_BYTES) throw new Error('Input text documents must be at most 1 MiB')
  if (bytes.includes(0)) throw new Error('Only PDF or UTF-8 text documents can be attached')
  try { return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes) }
  catch { throw new Error('Input document is not valid UTF-8 text') }
}
function documentMime(bytes: Buffer, name: string): AgentInputDocumentRef['mime'] {
  if (bytes.length >= 8 && /^%PDF-[12]\.\d/.test(bytes.toString('ascii', 0, 8))) return 'application/pdf'
  if (path.extname(name).toLowerCase() === '.pdf') throw new Error('Input PDF does not have a PDF signature')
  textData(bytes)
  return 'text/plain'
}

/** Immutable, owner-bound copies are issued only after a native main-process file selection. */
export class AgentInputDocumentStore {
  private static readonly queues = new Map<string, Promise<unknown>>()
  private readonly directory: string
  constructor(directory: string) { this.directory = path.resolve(directory); ensurePrivateDirectory(this.directory) }

  async stage(owner: AgentInputDocumentOwner, nativeDialogPaths: readonly string[], signal?: AbortSignal): Promise<AgentInputDocumentRef[]> {
    const pinnedOwner = copyOwner(owner)
    if (!Array.isArray(nativeDialogPaths) || !nativeDialogPaths.length || nativeDialogPaths.length > MAX_INPUT_DOCUMENTS || new Set(nativeDialogPaths).size !== nativeDialogPaths.length ||
      nativeDialogPaths.some(value => typeof value !== 'string' || !path.isAbsolute(value) || value.includes('\0'))) throw new Error('Select one to four PDF or text files in the file picker')
    const selected = [...nativeDialogPaths]
    return this.serialized(async () => {
      signal?.throwIfAborted()
      const existing = await this.listSaved(pinnedOwner)
      if (existing.length + selected.length > MAX_INPUT_DOCUMENTS) throw new Error('Remove an attached document before adding more than four documents')
      let total = existing.reduce((sum, item) => sum + item.ref.bytes, 0)
      const staged: { saved: StoredInputDocument; bytes: Buffer }[] = []
      for (const filename of selected) {
        signal?.throwIfAborted()
        let bytes: Buffer
        try { bytes = await readBoundedFile(filename, MAX_INPUT_DOCUMENT_BYTES) }
        catch { throw new Error('Could not read the selected document. Choose a regular PDF or UTF-8 text file up to 16 MiB, not a symbolic link.') }
        total += bytes.length
        if (total > MAX_INPUT_DOCUMENT_BATCH_BYTES) throw new Error('Attached documents must total at most 20 MiB')
        const ref: AgentInputDocumentRef = { id: `input-document-${randomUUID()}`, name: safeName(filename), mime: documentMime(bytes, filename), bytes: bytes.length, sha256: digest(bytes) }
        if (!validInputDocumentRef(ref)) throw new Error('Invalid input document metadata')
        staged.push({ saved: { version: 1, owner: pinnedOwner, ref }, bytes })
      }
      const used = await this.cacheBytes()
      const additional = staged.reduce((sum, { bytes, saved }) => sum + bytes.length + Buffer.byteLength(JSON.stringify(saved)), 0)
      if (used + additional > MAX_INPUT_DOCUMENT_CACHE_BYTES) throw new Error('Private input document cache is full. Remove unused attached documents before adding more.')
      const published: string[] = []
      try {
        for (const { saved, bytes } of staged) {
          signal?.throwIfAborted()
          await this.writeBytes(saved.ref.id, bytes)
          published.push(saved.ref.id)
          await writePrivateMetadata(this.metadataFile(saved.ref.id), saved)
        }
        signal?.throwIfAborted()
        return staged.map(({ saved }) => ({ ...saved.ref }))
      } catch (error) {
        for (const id of published) await this.removeFiles(id)
        throw error
      }
    })
  }

  async list(owner: AgentInputDocumentOwner): Promise<AgentInputDocumentRef[]> {
    const pinnedOwner = copyOwner(owner)
    return this.serialized(async () => (await this.listSaved(pinnedOwner)).map(item => ({ ...item.ref })))
  }
  async resolve(owner: AgentInputDocumentOwner, ids: readonly string[]): Promise<ResolvedAgentInputDocument[]> {
    const pinnedOwner = copyOwner(owner), selected = copyIds(ids)
    return this.serialized(async () => {
      const saved = await this.owned(pinnedOwner, selected)
      if (saved.reduce((sum, item) => sum + item.ref.bytes, 0) > MAX_INPUT_DOCUMENT_BATCH_BYTES) throw new Error('Attached documents must total at most 20 MiB')
      const result: ResolvedAgentInputDocument[] = []
      for (const { ref } of saved) {
        assertPrivateFile(this.documentFile(ref.id))
        const bytes = await readBoundedFile(this.documentFile(ref.id), MAX_INPUT_DOCUMENT_BYTES)
        if (bytes.length !== ref.bytes || digest(bytes) !== ref.sha256) throw new Error('Saved input document checksum does not match; remove it and attach it again')
        if (documentMime(bytes, ref.name) !== ref.mime) throw new Error('Saved input document signature does not match')
        result.push({ id: ref.id, name: ref.name, mime: ref.mime, data: ref.mime === 'application/pdf' ? bytes.toString('base64') : textData(bytes) })
      }
      return result
    })
  }
  async discard(owner: AgentInputDocumentOwner, ids: readonly string[]): Promise<void> {
    const pinnedOwner = copyOwner(owner), selected = copyIds(ids)
    return this.serialized(async () => {
      await this.owned(pinnedOwner, selected)
      for (const id of selected) await this.removeFiles(id)
      await syncDirectoryAsync(this.directory)
    })
  }

  private documentFile(id: string) { return path.join(this.directory, `${id}.bin`) }
  private metadataFile(id: string) { return path.join(this.directory, `${id}.json`) }
  private async readSaved(id: string): Promise<StoredInputDocument> {
    let saved: StoredInputDocument
    try {
      assertPrivateFile(this.metadataFile(id))
      saved = JSON.parse((await readBoundedFile(this.metadataFile(id), MAX_METADATA_BYTES)).toString('utf8')) as StoredInputDocument
    } catch { throw new Error('Saved input document is unavailable; attach it again') }
    if (!saved || typeof saved !== 'object' || Array.isArray(saved) || Object.keys(saved).length !== 3 || saved.version !== 1 ||
      !validInputDocumentOwner(saved.owner) || !validInputDocumentRef(saved.ref) || saved.ref.id !== id) throw new Error('Invalid saved input document metadata')
    return saved
  }
  private async listSaved(owner: AgentInputDocumentOwner): Promise<StoredInputDocument[]> {
    const result: StoredInputDocument[] = []
    for (const file of (await fs.promises.readdir(this.directory)).sort()) {
      if (!file.endsWith('.json') || !validInputDocumentId(file.slice(0, -5))) continue
      const saved = await this.readSaved(file.slice(0, -5))
      if (sameOwner(saved.owner, owner)) result.push(saved)
    }
    if (result.length > MAX_INPUT_DOCUMENTS || result.reduce((sum, item) => sum + item.ref.bytes, 0) > MAX_INPUT_DOCUMENT_BATCH_BYTES) throw new Error('Saved input documents exceed the pending attachment limit')
    return result
  }
  private async owned(owner: AgentInputDocumentOwner, ids: readonly string[]): Promise<StoredInputDocument[]> {
    const result: StoredInputDocument[] = []
    for (const id of ids) {
      const saved = await this.readSaved(id)
      if (!sameOwner(saved.owner, owner)) throw new Error('Input document belongs to a different task, chat, session or run')
      result.push(saved)
    }
    return result
  }
  private async cacheBytes(): Promise<number> {
    let total = 0
    for (const file of await fs.promises.readdir(this.directory)) {
      const stat = await fs.promises.lstat(path.join(this.directory, file))
      if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('Unsafe input document cache entry')
      total += stat.size
    }
    return total
  }
  private async writeBytes(id: string, bytes: Buffer): Promise<void> {
    const destination = this.documentFile(id), temporary = `${destination}.${randomUUID()}.tmp`
    const handle = await fs.promises.open(temporary, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY | fs.constants.O_NOFOLLOW, 0o600)
    let published = false
    try {
      try {
        try { await handle.writeFile(bytes); await handle.sync() } finally { await handle.close() }
        await fs.promises.link(temporary, destination); published = true
        await syncDirectoryAsync(this.directory)
      } finally { await fs.promises.unlink(temporary) }
    } catch (error) { if (published) await fs.promises.unlink(destination); throw error }
  }
  private async removeFiles(id: string): Promise<void> {
    for (const file of [this.documentFile(id), this.metadataFile(id)]) await fs.promises.unlink(file).catch(error => { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error })
  }
  private serialized<T>(action: () => Promise<T>): Promise<T> {
    const operation = (AgentInputDocumentStore.queues.get(this.directory) ?? Promise.resolve()).catch(() => {}).then(async () => {
      try { ensurePrivateDirectory(this.directory); return await action() }
      catch (error) {
        if ((error as NodeJS.ErrnoException)?.code) throw new Error('Private input document storage is unavailable; remove the attachment or try again')
        throw error
      }
    })
    AgentInputDocumentStore.queues.set(this.directory, operation)
    void operation.finally(() => { if (AgentInputDocumentStore.queues.get(this.directory) === operation) AgentInputDocumentStore.queues.delete(this.directory) }).catch(() => {})
    return operation
  }
}
