import fs from 'node:fs'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import {
  MAX_INPUT_IMAGE_BATCH_BYTES, MAX_INPUT_IMAGE_BYTES, MAX_INPUT_IMAGE_CACHE_BYTES, MAX_INPUT_IMAGES,
  validInputImageId, validInputImageOwner, validInputImageRef,
  type AgentInputImageOwner, type AgentInputImageRef,
} from '../../shared/agent-input-images'
import { rasterInfo } from './AgentMediaStore'
import { assertPrivateFile, ensurePrivateDirectory, writePrivateMetadata } from './privateStorage'
import { syncDirectoryAsync } from './syncDirectory'

/** Never return this main-only result over IPC or put it in a journal. */
export interface ResolvedAgentInputImage { id: string; mime: AgentInputImageRef['mime']; dataUrl: string }
interface StoredInputImage { version: 1; owner: AgentInputImageOwner; ref: AgentInputImageRef }
const MAX_METADATA_BYTES = 4096
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
const sameOwner = (a: AgentInputImageOwner, b: AgentInputImageOwner) => a.taskId === b.taskId && a.chatId === b.chatId && a.sessionId === b.sessionId && a.runId === b.runId
function copyOwner(value: AgentInputImageOwner): AgentInputImageOwner {
  if (!validInputImageOwner(value)) throw new Error('Invalid input image owner')
  return { ...value }
}
function copyIds(ids: readonly string[]): string[] {
  if (!Array.isArray(ids) || ids.length > MAX_INPUT_IMAGES || new Set(ids).size !== ids.length || !ids.every(validInputImageId)) throw new Error('Select up to four distinct input images')
  return [...ids]
}
function safeName(selected: string): string {
  // eslint-disable-next-line no-control-regex
  return path.basename(selected).replace(/[\x00-\x1f\x7f/\\\u202a-\u202e\u2066-\u2069]/g, '_').slice(0, 160).trim() || 'image'
}

/** Reads only a pinned regular file, never an unbounded readFile of a mutable source. */
async function readBoundedFile(filename: string, maximum: number): Promise<Buffer> {
  const before = await fs.promises.lstat(filename)
  if (before.isSymbolicLink() || !before.isFile()) throw new Error('Choose a regular image file, not a symbolic link')
  const handle = await fs.promises.open(filename, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK)
  try {
    const pinned = await handle.stat()
    if (!pinned.isFile() || pinned.dev !== before.dev || pinned.ino !== before.ino) throw new Error('The selected image changed; select it again')
    if (!Number.isSafeInteger(pinned.size) || pinned.size <= 0 || pinned.size > maximum) throw new Error('Invalid or oversized input image file')
    const bytes = Buffer.alloc(pinned.size + 1)
    let used = 0
    while (used < bytes.length) {
      const result = await handle.read(bytes, used, bytes.length - used, used)
      if (!result.bytesRead) break
      used += result.bytesRead
    }
    const after = await handle.stat()
    if (used !== pinned.size || after.size !== pinned.size || after.mtimeMs !== pinned.mtimeMs || after.ctimeMs !== pinned.ctimeMs) throw new Error('The selected image changed; select it again')
    return bytes.subarray(0, used)
  } finally { await handle.close() }
}

/**
 * Only the main-process native picker may pass paths to stage(). Renderer callers use IDs.
 * Immutable private copies survive renderer remounts/retry; there is no implicit expiry or inference.
 */
export class AgentInputImageStore {
  private static readonly queues = new Map<string, Promise<unknown>>()
  private readonly directory: string
  constructor(directory: string) {
    this.directory = path.resolve(directory)
    ensurePrivateDirectory(this.directory)
  }

  async stage(owner: AgentInputImageOwner, nativeDialogPaths: readonly string[], signal?: AbortSignal): Promise<AgentInputImageRef[]> {
    const pinnedOwner = copyOwner(owner)
    if (!Array.isArray(nativeDialogPaths) || !nativeDialogPaths.length || nativeDialogPaths.length > MAX_INPUT_IMAGES ||
      new Set(nativeDialogPaths).size !== nativeDialogPaths.length || nativeDialogPaths.some(value => typeof value !== 'string' || !path.isAbsolute(value) || value.includes('\0'))) throw new Error('Select one to four image files in the file picker')
    const selected = [...nativeDialogPaths]
    return this.serialized(async () => {
      signal?.throwIfAborted()
      const existing = await this.listSaved(pinnedOwner)
      if (existing.length + selected.length > MAX_INPUT_IMAGES) throw new Error('Remove an attached image before adding more than four images')
      let total = existing.reduce((sum, item) => sum + item.ref.bytes, 0)
      const staged: { saved: StoredInputImage; bytes: Buffer }[] = []
      for (const filename of selected) {
        signal?.throwIfAborted()
        let bytes: Buffer
        try { bytes = await readBoundedFile(filename, MAX_INPUT_IMAGE_BYTES) }
        catch { throw new Error('Could not read the selected image. Choose a regular PNG, JPEG or WebP file up to 16 MiB, not a symbolic link.') }
        total += bytes.length
        if (total > MAX_INPUT_IMAGE_BATCH_BYTES) throw new Error('Attached images must total at most 20 MiB')
        const info = rasterInfo(bytes)
        const ref: AgentInputImageRef = { id: `input-image-${randomUUID()}`, name: safeName(filename), ...info, bytes: bytes.length, sha256: digest(bytes) }
        if (!validInputImageRef(ref)) throw new Error('Invalid input image metadata')
        staged.push({ saved: { version: 1, owner: pinnedOwner, ref }, bytes })
      }
      const used = await this.cacheBytes()
      const additional = staged.reduce((sum, { bytes, saved }) => sum + bytes.length + Buffer.byteLength(JSON.stringify(saved)), 0)
      if (used + additional > MAX_INPUT_IMAGE_CACHE_BYTES) throw new Error('Private input image cache is full. Remove unused attached images before adding more.')
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

  async list(owner: AgentInputImageOwner): Promise<AgentInputImageRef[]> {
    const pinnedOwner = copyOwner(owner)
    return this.serialized(async () => (await this.listSaved(pinnedOwner)).map(item => ({ ...item.ref })))
  }

  async resolve(owner: AgentInputImageOwner, ids: readonly string[]): Promise<ResolvedAgentInputImage[]> {
    const pinnedOwner = copyOwner(owner), selected = copyIds(ids)
    return this.serialized(async () => {
      const saved = await this.owned(pinnedOwner, selected)
      if (saved.reduce((sum, item) => sum + item.ref.bytes, 0) > MAX_INPUT_IMAGE_BATCH_BYTES) throw new Error('Attached images must total at most 20 MiB')
      const result: ResolvedAgentInputImage[] = []
      for (const { ref } of saved) {
        assertPrivateFile(this.imageFile(ref.id))
        const bytes = await readBoundedFile(this.imageFile(ref.id), MAX_INPUT_IMAGE_BYTES)
        if (bytes.length !== ref.bytes || digest(bytes) !== ref.sha256) throw new Error('Saved input image checksum does not match; remove it and attach it again')
        const info = rasterInfo(bytes)
        if (info.mime !== ref.mime || info.width !== ref.width || info.height !== ref.height) throw new Error('Saved input image header does not match')
        result.push({ id: ref.id, mime: ref.mime, dataUrl: `data:${ref.mime};base64,${bytes.toString('base64')}` })
      }
      return result
    })
  }

  async discard(owner: AgentInputImageOwner, ids: readonly string[]): Promise<void> {
    const pinnedOwner = copyOwner(owner), selected = copyIds(ids)
    return this.serialized(async () => {
      await this.owned(pinnedOwner, selected) // Validate every owner before removing any attachment.
      for (const id of selected) await this.removeFiles(id)
      await syncDirectoryAsync(this.directory)
    })
  }

  private imageFile(id: string) { return path.join(this.directory, `${id}.bin`) }
  private metadataFile(id: string) { return path.join(this.directory, `${id}.json`) }

  private async readSaved(id: string): Promise<StoredInputImage> {
    let saved: StoredInputImage
    try {
      assertPrivateFile(this.metadataFile(id))
      saved = JSON.parse((await readBoundedFile(this.metadataFile(id), MAX_METADATA_BYTES)).toString('utf8')) as StoredInputImage
    } catch { throw new Error('Saved input image is unavailable; attach it again') }
    if (!saved || typeof saved !== 'object' || Object.keys(saved).length !== 3 || saved.version !== 1 ||
      !validInputImageOwner(saved.owner) || !validInputImageRef(saved.ref) || saved.ref.id !== id) throw new Error('Invalid saved input image metadata')
    return saved
  }

  private async listSaved(owner: AgentInputImageOwner): Promise<StoredInputImage[]> {
    ensurePrivateDirectory(this.directory)
    const result: StoredInputImage[] = []
    for (const file of (await fs.promises.readdir(this.directory)).sort()) {
      if (!file.endsWith('.json') || !validInputImageId(file.slice(0, -5))) continue
      const saved = await this.readSaved(file.slice(0, -5))
      if (sameOwner(saved.owner, owner)) result.push(saved)
    }
    if (result.length > MAX_INPUT_IMAGES || result.reduce((sum, item) => sum + item.ref.bytes, 0) > MAX_INPUT_IMAGE_BATCH_BYTES) throw new Error('Saved input images exceed the pending attachment limit')
    return result
  }

  private async owned(owner: AgentInputImageOwner, ids: readonly string[]): Promise<StoredInputImage[]> {
    const result: StoredInputImage[] = []
    for (const id of ids) {
      const saved = await this.readSaved(id)
      if (!sameOwner(saved.owner, owner)) throw new Error('Input image belongs to a different task, chat, session or run')
      result.push(saved)
    }
    return result
  }

  private async cacheBytes(): Promise<number> {
    ensurePrivateDirectory(this.directory)
    let total = 0
    for (const file of await fs.promises.readdir(this.directory)) {
      const stat = await fs.promises.lstat(path.join(this.directory, file))
      if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('Unsafe input image cache entry')
      total += stat.size // Orphaned/temporary files also consume quota; never delete unrelated paths.
    }
    return total
  }

  private async writeBytes(id: string, bytes: Buffer): Promise<void> {
    const destination = this.imageFile(id), temporary = `${destination}.${randomUUID()}.tmp`
    const handle = await fs.promises.open(temporary, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY | fs.constants.O_NOFOLLOW, 0o600)
    let published = false
    try {
      try {
        try { await handle.writeFile(bytes); await handle.sync() } finally { await handle.close() }
        await fs.promises.link(temporary, destination)
        published = true
        await syncDirectoryAsync(this.directory)
      } finally { await fs.promises.unlink(temporary) }
    } catch (error) {
      if (published) await fs.promises.unlink(destination)
      throw error
    }
  }

  private async removeFiles(id: string): Promise<void> {
    for (const file of [this.imageFile(id), this.metadataFile(id)]) {
      // unlink never follows a replaced leaf symlink and never recursively removes a directory.
      await fs.promises.unlink(file).catch(error => { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error })
    }
  }

  private serialized<T>(action: () => Promise<T>): Promise<T> {
    const operation = (AgentInputImageStore.queues.get(this.directory) ?? Promise.resolve()).catch(() => {}).then(async () => {
      try { ensurePrivateDirectory(this.directory); return await action() }
      catch (error) {
        // Filesystem errors include absolute paths. They must not cross the IPC boundary.
        if ((error as NodeJS.ErrnoException)?.code) throw new Error('Private input image storage is unavailable; remove the attachment or try again')
        throw error
      }
    })
    AgentInputImageStore.queues.set(this.directory, operation)
    void operation.finally(() => { if (AgentInputImageStore.queues.get(this.directory) === operation) AgentInputImageStore.queues.delete(this.directory) }).catch(() => {})
    return operation
  }
}
