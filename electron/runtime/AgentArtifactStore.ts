import fs from 'node:fs'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { TextDecoder } from 'node:util'
import {
  MAX_ARTIFACT_BYTES, MAX_ARTIFACT_CACHE_BYTES, validArtifactId, validArtifactMetadata, validArtifactRef,
  type AgentArtifactMetadata, type AgentArtifactRef,
} from '../../shared/agent-artifacts'
import { rasterInfo, videoInfo } from './AgentMediaStore'
import { assertPrivateFile, ensurePrivateDirectory, writePrivateMetadata } from './privateStorage'
import { syncDirectoryAsync } from './syncDirectory'

export interface AgentArtifactOwner { taskId: string; runId: string }
interface StoredArtifact { version: 1; taskId: string; ref: AgentArtifactRef }
const MAX_METADATA_BYTES = 4096
const MAX_CACHE_FILES = 10_000
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
const safeId = /^[A-Za-z0-9_-]{1,160}$/
function copyOwner(owner: AgentArtifactOwner): AgentArtifactOwner {
  if (!owner || typeof owner !== 'object' || Array.isArray(owner) || Object.keys(owner).length !== 2 || typeof owner.taskId !== 'string' || typeof owner.runId !== 'string' || !safeId.test(owner.taskId) || !safeId.test(owner.runId)) throw new Error('Invalid artifact owner')
  return { taskId: owner.taskId, runId: owner.runId }
}
function sameRef(a: AgentArtifactRef, b: AgentArtifactRef): boolean {
  return Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(key => Reflect.get(a, key) === Reflect.get(b, key))
}
function validUtf8(bytes: Buffer): void {
  if (bytes.includes(0)) throw new Error('Artifact text contains binary data')
  const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })
  try {
    // Validate without retaining a second file-sized string in the main process.
    for (let offset = 0; offset < bytes.length; offset += 65536) decoder.decode(bytes.subarray(offset, offset + 65536), { stream: true })
    decoder.decode()
  } catch { throw new Error('Artifact text is not valid UTF-8') }
}

/** Known types require their own byte signature. Unsafe/unknown formats are download-only. */
export function verifiedArtifactMime(bytes: Buffer, declared: string): string {
  if (['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(declared)) {
    if (rasterInfo(bytes).mime !== declared) throw new Error('Artifact MIME does not match its image signature')
    return declared
  }
  let matches = true
  if (declared === 'application/pdf') matches = bytes.length >= 8 && /^%PDF-[12]\.\d/.test(bytes.toString('ascii', 0, 8))
  else if (declared === 'video/mp4') { videoInfo(bytes); return declared }
  else if (['application/zip', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'].includes(declared)) {
    matches = bytes.length >= 22 && (bytes.subarray(0, 4).equals(Buffer.from([80, 75, 3, 4])) || bytes.subarray(0, 4).equals(Buffer.from([80, 75, 5, 6])))
  } else if (declared === 'application/gzip') matches = bytes.length >= 10 && bytes.subarray(0, 3).equals(Buffer.from([31, 139, 8]))
  else if (declared === 'audio/wav' || declared === 'audio/x-wav') matches = bytes.length >= 44 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WAVE' && bytes.readUInt32LE(4) + 8 === bytes.length
  else if (declared === 'audio/ogg' || declared === 'video/ogg' || declared === 'application/ogg') matches = bytes.length >= 27 && bytes.toString('ascii', 0, 4) === 'OggS' && bytes[4] === 0
  else if (declared === 'audio/flac') matches = bytes.length >= 8 && bytes.toString('ascii', 0, 4) === 'fLaC'
  else if (declared === 'audio/mpeg') matches = bytes.length >= 10 && (bytes.toString('ascii', 0, 3) === 'ID3' || bytes[0] === 255 && (bytes[1] & 224) === 224 && (bytes[1] & 6) !== 0)
  else if (['text/plain', 'text/markdown', 'text/csv', 'text/tab-separated-values', 'application/json', 'application/xml', 'text/xml'].includes(declared)) { validUtf8(bytes); return declared }
  else return 'application/octet-stream'
  if (!matches) throw new Error('Artifact MIME does not match its byte signature')
  return declared
}

/** Pinned, bounded reads reject leaf replacement and mutation during the read. */
async function readPinnedFile(filename: string, maximum: number): Promise<Buffer> {
  const before = await fs.promises.lstat(filename)
  if (before.isSymbolicLink() || !before.isFile()) throw new Error('Unsafe artifact cache file')
  const handle = await fs.promises.open(filename, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK)
  try {
    const pinned = await handle.stat()
    if (!pinned.isFile() || pinned.dev !== before.dev || pinned.ino !== before.ino || !Number.isSafeInteger(pinned.size) || pinned.size < 0 || pinned.size > maximum) throw new Error('Artifact cache file changed or exceeds its limit')
    const bytes = Buffer.alloc(pinned.size + 1)
    let used = 0
    while (used < bytes.length) {
      const result = await handle.read(bytes, used, bytes.length - used, used)
      if (!result.bytesRead) break
      used += result.bytesRead
    }
    const after = await handle.stat()
    if (used !== pinned.size || after.size !== pinned.size || after.mtimeMs !== pinned.mtimeMs || after.ctimeMs !== pinned.ctimeMs) throw new Error('Artifact cache file changed during its read')
    return bytes.subarray(0, used)
  } finally { await handle.close() }
}

/** No provider URLs, filesystem paths or binary payloads leave this private store in a reference. */
export class AgentArtifactStore {
  private static readonly queues = new Map<string, Promise<unknown>>()
  private readonly directory: string
  constructor(directory: string) { this.directory = path.resolve(directory); ensurePrivateDirectory(this.directory) }

  async store(owner: AgentArtifactOwner, metadata: AgentArtifactMetadata, source: Buffer, signal?: AbortSignal): Promise<AgentArtifactRef> {
    const pinnedOwner = copyOwner(owner)
    if (!validArtifactMetadata(metadata) || !Buffer.isBuffer(source) || source.length !== metadata.bytes || source.length > MAX_ARTIFACT_BYTES) throw new Error('Invalid artifact metadata or byte length')
    signal?.throwIfAborted()
    // Copy before queueing so transport-owned objects cannot change the verified result.
    const bytes = Buffer.from(source)
    if (digest(bytes) !== metadata.sha256) throw new Error('Artifact checksum does not match its metadata')
    const refData = {
      filename: metadata.filename, mime: verifiedArtifactMime(bytes, metadata.mime_type), bytes: bytes.length, sha256: metadata.sha256,
      providerFileId: metadata.id, ...(metadata.revision !== undefined ? { revision: metadata.revision } : {}),
      ...(metadata.supersedes_file_id !== undefined ? { supersedesFileId: metadata.supersedes_file_id } : {}),
    }
    return this.serialized(async () => {
      signal?.throwIfAborted()
      const entries = await this.cacheEntries()
      for (const filename of entries.names.filter(name => name.endsWith('.json') && validArtifactId(name.slice(0, -5)))) {
        const previous = await this.readSaved(filename.slice(0, -5))
        if (previous.taskId === pinnedOwner.taskId && previous.ref.sourceRunId === pinnedOwner.runId && previous.ref.providerFileId === refData.providerFileId) {
          const candidate = { id: previous.ref.id, sourceRunId: pinnedOwner.runId, ...refData }
          if (!sameRef(previous.ref, candidate)) throw new Error('Artifact file identity was reused with different metadata')
          await this.readVerified(pinnedOwner.taskId, previous.ref)
          signal?.throwIfAborted()
          return { ...previous.ref }
        }
      }
      const ref: AgentArtifactRef = { id: `artifact-${randomUUID()}`, sourceRunId: pinnedOwner.runId, ...refData }
      if (!validArtifactRef(ref)) throw new Error('Invalid artifact reference')
      const saved: StoredArtifact = { version: 1, taskId: pinnedOwner.taskId, ref }
      if (entries.used + bytes.length + Buffer.byteLength(JSON.stringify(saved)) > MAX_ARTIFACT_CACHE_BYTES || entries.records >= MAX_CACHE_FILES) throw new Error('Private artifact cache is full; preserve needed files before clearing the private cache')
      const file = this.artifactFile(ref.id), temporary = `${file}.${randomUUID()}.tmp`
      let published = false
      const handle = await fs.promises.open(temporary, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY | fs.constants.O_NOFOLLOW, 0o600)
      try {
        try { await handle.writeFile(bytes); await handle.sync() } finally { await handle.close() }
        signal?.throwIfAborted()
        await fs.promises.link(temporary, file); published = true
        await syncDirectoryAsync(this.directory)
        await writePrivateMetadata(this.metadataFile(ref.id), saved)
        signal?.throwIfAborted()
        return { ...ref }
      } catch (error) {
        if (published) for (const owned of [file, this.metadataFile(ref.id)]) await fs.promises.unlink(owned).catch(failure => { if ((failure as NodeJS.ErrnoException).code !== 'ENOENT') throw failure })
        throw error
      } finally { await fs.promises.unlink(temporary).catch(error => { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }) }
    })
  }

  async read(taskId: string, ref: AgentArtifactRef): Promise<Buffer> {
    if (typeof taskId !== 'string' || !safeId.test(taskId) || !validArtifactRef(ref)) throw new Error('Invalid artifact reference')
    const pinnedRef = { ...ref }
    return this.serialized(() => this.readVerified(taskId, pinnedRef))
  }

  private artifactFile(id: string) { return path.join(this.directory, `${id}.bin`) }
  private metadataFile(id: string) { return path.join(this.directory, `${id}.json`) }
  private async readSaved(id: string): Promise<StoredArtifact> {
    assertPrivateFile(this.metadataFile(id))
    let saved: StoredArtifact
    try { saved = JSON.parse((await readPinnedFile(this.metadataFile(id), MAX_METADATA_BYTES)).toString('utf8')) as StoredArtifact }
    catch (error) { if ((error as NodeJS.ErrnoException).code) throw error; throw new Error('Saved artifact metadata is unavailable or damaged') }
    if (!saved || typeof saved !== 'object' || Array.isArray(saved) || Object.keys(saved).length !== 3 || saved.version !== 1 || typeof saved.taskId !== 'string' || !safeId.test(saved.taskId) || !validArtifactRef(saved.ref) || saved.ref.id !== id) throw new Error('Invalid saved artifact metadata')
    return saved
  }
  private async readVerified(taskId: string, ref: AgentArtifactRef): Promise<Buffer> {
    const saved = await this.readSaved(ref.id)
    if (saved.taskId !== taskId || !sameRef(saved.ref, ref)) throw new Error('Artifact belongs to a different task or run')
    assertPrivateFile(this.artifactFile(ref.id))
    const bytes = await readPinnedFile(this.artifactFile(ref.id), MAX_ARTIFACT_BYTES)
    if (bytes.length !== ref.bytes || digest(bytes) !== ref.sha256) throw new Error('Artifact cache checksum does not match')
    if (verifiedArtifactMime(bytes, ref.mime) !== ref.mime) throw new Error('Artifact cache MIME does not match')
    return bytes
  }
  private async cacheEntries(): Promise<{ names: string[]; used: number; records: number }> {
    const names = await fs.promises.readdir(this.directory)
    let used = 0, records = 0
    for (const filename of names) {
      const stat = await fs.promises.lstat(path.join(this.directory, filename))
      if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('Unsafe artifact cache entry')
      used += stat.size // Interrupted copies count toward quota; existing files are never evicted.
      if (filename.endsWith('.json') && validArtifactId(filename.slice(0, -5))) records++
    }
    return { names, used, records }
  }
  private serialized<T>(action: () => Promise<T>): Promise<T> {
    const operation = (AgentArtifactStore.queues.get(this.directory) ?? Promise.resolve()).catch(() => {}).then(async () => {
      try { ensurePrivateDirectory(this.directory); return await action() }
      catch (error) {
        if ((error as NodeJS.ErrnoException)?.code) throw new Error('Private artifact storage is unavailable; preserve the file and try again')
        throw error
      }
    })
    AgentArtifactStore.queues.set(this.directory, operation)
    void operation.finally(() => { if (AgentArtifactStore.queues.get(this.directory) === operation) AgentArtifactStore.queues.delete(this.directory) }).catch(() => {})
    return operation
  }
}
