import fs from 'node:fs'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { MAX_IMAGE_BYTES, validMediaRef, type AgentMediaRef } from '../../shared/agent-media'
import { assertPrivateFile, ensurePrivateDirectory, readPrivateMetadata, writePrivateMetadata } from './privateStorage'
import { syncDirectoryAsync } from './syncDirectory'

const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
const safeId = /^[A-Za-z0-9_-]{1,160}$/
export interface MediaOwner { taskId: string; runId: string }

/** Raster headers are checked before any decoder can allocate their pixel buffer. */
export function rasterInfo(bytes: Buffer): Pick<AgentMediaRef, 'mime' | 'width' | 'height'> {
  let mime: AgentMediaRef['mime'], width = 0, height = 0
  if (bytes.length >= 33 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && bytes.toString('ascii', 12, 16) === 'IHDR') {
    mime = 'image/png'; width = bytes.readUInt32BE(16); height = bytes.readUInt32BE(20)
  } else if (bytes.length > 12 && bytes[0] === 255 && bytes[1] === 216) {
    mime = 'image/jpeg'
    let offset = 2
    while (offset + 4 < bytes.length) {
      if (bytes[offset++] !== 255) throw new Error('Invalid JPEG header')
      while (bytes[offset] === 255) offset++
      const marker = bytes[offset++]
      if (marker === 217 || marker === 218) break
      if (marker === 1 || marker >= 208 && marker <= 215) continue
      const size = bytes.readUInt16BE(offset)
      if (size < 2 || offset + size > bytes.length) throw new Error('Invalid JPEG segment')
      if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker) && size >= 8) { height = bytes.readUInt16BE(offset + 3); width = bytes.readUInt16BE(offset + 5); break }
      offset += size
    }
  } else if (bytes.length >= 30 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP' && bytes.readUInt32LE(4) + 8 === bytes.length) {
    mime = 'image/webp'
    const kind = bytes.toString('ascii', 12, 16)
    if (kind === 'VP8X') { width = 1 + bytes.readUIntLE(24, 3); height = 1 + bytes.readUIntLE(27, 3) }
    else if (kind === 'VP8 ' && bytes.subarray(23, 26).equals(Buffer.from([157, 1, 42]))) { width = bytes.readUInt16LE(26) & 16383; height = bytes.readUInt16LE(28) & 16383 }
    else if (kind === 'VP8L' && bytes[20] === 47) { const packed = bytes.readUInt32LE(21); width = (packed & 16383) + 1; height = ((packed >>> 14) & 16383) + 1 }
  } else throw new Error('Only PNG, JPEG and WebP image results are supported')
  if (!width || !height || width > 32768 || height > 32768 || width * height > 32_000_000) throw new Error('Image dimensions exceed the display limit')
  return { mime, width, height }
}

/** Binary bytes stay outside event journals and conversation documents. */
export class AgentMediaStore {
  private static readonly queues = new Map<string, Promise<unknown>>()
  constructor(private readonly directory: string) { ensurePrivateDirectory(directory) }
  async storeBase64(owner: MediaOwner, encoded: string, signal?: AbortSignal): Promise<AgentMediaRef> {
    if (!safeId.test(owner.taskId) || !safeId.test(owner.runId)) throw new Error('Invalid image owner')
    if (typeof encoded !== 'string' || !encoded.length || encoded.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 || encoded.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) throw new Error('Invalid or oversized base64 image')
    signal?.throwIfAborted()
    const bytes = Buffer.from(encoded, 'base64')
    if (!bytes.length || bytes.length > MAX_IMAGE_BYTES || bytes.toString('base64') !== encoded) throw new Error('Invalid encoded image bytes')
    const info = rasterInfo(bytes)
    const operation = (AgentMediaStore.queues.get(this.directory) ?? Promise.resolve()).catch(() => {}).then(async () => {
      signal?.throwIfAborted()
      ensurePrivateDirectory(this.directory)
      const files = await fs.promises.readdir(this.directory)
      let used = 0
      for (const file of files.filter(name => /^media-[a-f0-9-]{36}\.bin$/.test(name))) { const stat = await fs.promises.lstat(path.join(this.directory, file)); if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('Unsafe image cache'); used += stat.size }
      if (used + bytes.length > 128 * 1024 * 1024) throw new Error('Private image cache is full; preserve needed images before clearing the private cache')
      const ref: AgentMediaRef = { id: `media-${randomUUID()}`, sourceRunId: owner.runId, ...info, bytes: bytes.length, sha256: digest(bytes) }
      const file = path.join(this.directory, `${ref.id}.bin`), temporary = `${file}.${randomUUID()}.tmp`
      const handle = await fs.promises.open(temporary, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY | fs.constants.O_NOFOLLOW, 0o600)
      try {
        try { await handle.writeFile(bytes); await handle.sync() } finally { await handle.close() }
        signal?.throwIfAborted(); await fs.promises.link(temporary, file); await syncDirectoryAsync(this.directory)
        await writePrivateMetadata(path.join(this.directory, `${ref.id}.json`), { version: 1, taskId: owner.taskId, ref })
      } catch (error) { await fs.promises.rm(file, { force: true }); throw error }
      finally { await fs.promises.rm(temporary, { force: true }) }
      if (signal?.aborted) { await fs.promises.rm(file, { force: true }); await fs.promises.rm(path.join(this.directory, `${ref.id}.json`), { force: true }); signal.throwIfAborted() }
      return ref
    })
    AgentMediaStore.queues.set(this.directory, operation)
    void operation.finally(() => { if (AgentMediaStore.queues.get(this.directory) === operation) AgentMediaStore.queues.delete(this.directory) }).catch(() => {})
    return operation
  }
  async read(taskId: string, ref: AgentMediaRef): Promise<Buffer> {
    if (!safeId.test(taskId) || !validMediaRef(ref)) throw new Error('Invalid image reference')
    const metadataFile = path.join(this.directory, `${ref.id}.json`)
    assertPrivateFile(metadataFile)
    if (fs.statSync(metadataFile).size > 4096) throw new Error('Invalid image metadata size')
    const saved = await readPrivateMetadata(metadataFile) as { version: number; taskId: string; ref: AgentMediaRef }
    if (saved.version !== 1 || saved.taskId !== taskId || !validMediaRef(saved.ref) || Object.keys(ref).some(key => ref[key as keyof AgentMediaRef] !== saved.ref[key as keyof AgentMediaRef])) throw new Error('Image belongs to a different task or run')
    const file = path.join(this.directory, `${ref.id}.bin`); assertPrivateFile(file)
    const handle = await fs.promises.open(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW)
    try {
      if ((await handle.stat()).size !== ref.bytes) throw new Error('Image cache is damaged')
      const bytes = await handle.readFile()
      if (bytes.length !== ref.bytes || digest(bytes) !== ref.sha256) throw new Error('Image cache checksum does not match')
      const info = rasterInfo(bytes)
      if (info.mime !== ref.mime || info.width !== ref.width || info.height !== ref.height) throw new Error('Image header does not match its reference')
      return bytes
    } finally { await handle.close() }
  }
}
