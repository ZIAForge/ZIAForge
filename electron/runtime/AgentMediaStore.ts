import fs from 'node:fs'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { MAX_IMAGE_BYTES, MAX_VIDEO_BYTES, validMediaRef, type AgentMediaRef, type AgentImageRef, type AgentVideoRef } from '../../shared/agent-media'
import { assertPrivateFile, ensurePrivateDirectory, readPrivateMetadata, writePrivateMetadata } from './privateStorage'
import { syncDirectoryAsync } from './syncDirectory'

const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
const safeId = /^[A-Za-z0-9_-]{1,160}$/
export interface MediaOwner { taskId: string; runId: string }
export const MAX_MEDIA_CACHE_BYTES = 512 * 1024 * 1024

/** Raster headers are checked before any decoder can allocate their pixel buffer. */
export function rasterInfo(bytes: Buffer): Pick<AgentImageRef, 'mime' | 'width' | 'height'> {
  let mime: AgentImageRef['mime'], width = 0, height = 0
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

interface Mp4Box { type: string; start: number; payload: number; end: number }
/** Container metadata validation only; playback still belongs to the browser's decoder. */
export function videoInfo(bytes: Buffer): Pick<AgentVideoRef, 'mime' | 'width' | 'height' | 'durationMs'> {
  if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > MAX_VIDEO_BYTES) throw new Error('Invalid or oversized MP4 video')
  let count = 0
  const boxes = (start: number, end: number): Mp4Box[] => {
    const result: Mp4Box[] = []
    for (let offset = start; offset < end;) {
      if (++count > 4096 || end - offset < 8) throw new Error('Invalid MP4 box header')
      let size = bytes.readUInt32BE(offset), header = 8
      if (size === 1) {
        if (end - offset < 16) throw new Error('Invalid MP4 extended size')
        const extended = bytes.readBigUInt64BE(offset + 8)
        if (extended > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Invalid MP4 extended size')
        size = Number(extended); header = 16
      } else if (size === 0) size = end - offset
      if (size < header || size > end - offset) throw new Error('Invalid MP4 box bounds')
      result.push({ type: bytes.toString('ascii', offset + 4, offset + 8), start: offset, payload: offset + header, end: offset + size })
      offset += size
    }
    return result
  }
  const only = (items: Mp4Box[], type: string): Mp4Box => {
    const found = items.filter(box => box.type === type)
    if (found.length !== 1) throw new Error(`MP4 requires one ${type} box`)
    return found[0]
  }
  const duration = (box: Mp4Box): number | undefined => {
    const version = bytes[box.payload], scaleOffset = version === 0 ? 12 : version === 1 ? 20 : -1
    if (scaleOffset < 0 || box.end - box.payload < scaleOffset + (version === 0 ? 8 : 12)) throw new Error('Invalid MP4 duration header')
    const scale = bytes.readUInt32BE(box.payload + scaleOffset)
    if (!scale) throw new Error('Invalid MP4 timescale')
    const ticks = version === 0 ? BigInt(bytes.readUInt32BE(box.payload + scaleOffset + 4)) : bytes.readBigUInt64BE(box.payload + scaleOffset + 4)
    if (ticks === (version === 0 ? 0xffffffffn : 0xffffffffffffffffn)) return undefined
    const ms = (ticks * 1000n + BigInt(Math.floor(scale / 2))) / BigInt(scale)
    if (ms <= 0n || ms > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Invalid MP4 duration')
    return Number(ms)
  }
  const top = boxes(0, bytes.length), ftyp = only(top, 'ftyp'), moov = only(top, 'moov')
  if (ftyp.start > 65536 || ftyp.end - ftyp.payload < 8 || ftyp.end - ftyp.payload > 4096 || (ftyp.end - ftyp.payload) % 4 || moov.end - moov.payload > 4 * 1024 * 1024) throw new Error('Invalid or oversized MP4 metadata')
  const brands = [bytes.toString('ascii', ftyp.payload, ftyp.payload + 4)]
  for (let offset = ftyp.payload + 8; offset < ftyp.end; offset += 4) brands.push(bytes.toString('ascii', offset, offset + 4))
  if (!brands.some(brand => /^(?:isom|iso[2-9]|mp4[12]|avc1|dash|M4V |MSNV)$/.test(brand))) throw new Error('Unsupported MP4 brand')
  if (!top.some(box => box.type === 'mdat' && box.end > box.payload)) throw new Error('MP4 video data is missing')
  const movie = boxes(moov.payload, moov.end), movieDuration = duration(only(movie, 'mvhd'))
  const tracks = movie.filter(box => box.type === 'trak')
  if (!tracks.length || tracks.length > 16) throw new Error('Invalid MP4 track count')
  const videos: Array<{ width: number; height: number; durationMs?: number }> = []
  for (const track of tracks) {
    const children = boxes(track.payload, track.end), mdia = only(children, 'mdia'), media = boxes(mdia.payload, mdia.end), hdlr = only(media, 'hdlr')
    if (hdlr.end - hdlr.payload < 12 || bytes[hdlr.payload] !== 0) throw new Error('Invalid MP4 handler')
    if (bytes.toString('ascii', hdlr.payload + 8, hdlr.payload + 12) !== 'vide') continue
    const tkhd = only(children, 'tkhd'), version = bytes[tkhd.payload], widthOffset = version === 0 ? 76 : version === 1 ? 88 : -1
    if (widthOffset < 0 || tkhd.end - tkhd.payload < widthOffset + 8) throw new Error('Invalid MP4 video track')
    const widthFixed = bytes.readUInt32BE(tkhd.payload + widthOffset), heightFixed = bytes.readUInt32BE(tkhd.payload + widthOffset + 4)
    const width = widthFixed / 65536, height = heightFixed / 65536
    if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0 || width > 32768 || height > 32768 || width * height > 32_000_000) throw new Error('Video dimensions exceed the display limit')
    const durationMs = duration(only(media, 'mdhd')) ?? movieDuration
    videos.push({ width, height, ...(durationMs !== undefined ? { durationMs } : {}) })
  }
  if (videos.length !== 1) throw new Error('MP4 requires one video track')
  return { mime: 'video/mp4', ...videos[0] }
}

/** Binary bytes stay outside event journals and conversation documents. */
export class AgentMediaStore {
  private static readonly queues = new Map<string, Promise<unknown>>()
  constructor(private readonly directory: string) { ensurePrivateDirectory(directory) }
  async storeBase64(owner: MediaOwner, encoded: string, signal?: AbortSignal): Promise<AgentImageRef> {
    if (!safeId.test(owner.taskId) || !safeId.test(owner.runId)) throw new Error('Invalid image owner')
    if (typeof encoded !== 'string' || !encoded.length || encoded.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 || encoded.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) throw new Error('Invalid or oversized base64 image')
    signal?.throwIfAborted()
    const bytes = Buffer.from(encoded, 'base64')
    if (!bytes.length || bytes.length > MAX_IMAGE_BYTES || bytes.toString('base64') !== encoded) throw new Error('Invalid encoded image bytes')
    return this.persist(owner, bytes, rasterInfo(bytes), signal) as Promise<AgentImageRef>
  }
  async storeVideo(owner: MediaOwner, source: Buffer, signal?: AbortSignal): Promise<AgentVideoRef> {
    if (!safeId.test(owner.taskId) || !safeId.test(owner.runId)) throw new Error('Invalid video owner')
    signal?.throwIfAborted()
    if (!Buffer.isBuffer(source) || !source.length || source.length > MAX_VIDEO_BYTES) throw new Error('Invalid or oversized MP4 video')
    // Snapshot before the queued write; callers cannot mutate verified bytes while waiting.
    const bytes = Buffer.from(source)
    return this.persist(owner, bytes, videoInfo(bytes), signal) as Promise<AgentVideoRef>
  }
  private persist(owner: MediaOwner, bytes: Buffer, info: Pick<AgentImageRef, 'mime' | 'width' | 'height'> | Pick<AgentVideoRef, 'mime' | 'width' | 'height' | 'durationMs'>, signal?: AbortSignal): Promise<AgentMediaRef> {
    owner = { ...owner }
    const operation = (AgentMediaStore.queues.get(this.directory) ?? Promise.resolve()).catch(() => {}).then(async () => {
      signal?.throwIfAborted()
      ensurePrivateDirectory(this.directory)
      const files = await fs.promises.readdir(this.directory)
      let used = 0
      for (const file of files.filter(name => /^media-[a-f0-9-]{36}\.bin$/.test(name))) { const stat = await fs.promises.lstat(path.join(this.directory, file)); if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('Unsafe media cache'); used += stat.size }
      if (used + bytes.length > MAX_MEDIA_CACHE_BYTES) throw new Error('Private media cache is full; preserve needed media before clearing the private cache')
      const ref: AgentMediaRef = { id: `media-${randomUUID()}`, sourceRunId: owner.runId, ...info, bytes: bytes.length, sha256: digest(bytes) }
      const file = path.join(this.directory, `${ref.id}.bin`), temporary = `${file}.${randomUUID()}.tmp`
      const handle = await fs.promises.open(temporary, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY | fs.constants.O_NOFOLLOW, 0o600)
      let published = false
      try {
        try { await handle.writeFile(bytes); await handle.sync() } finally { await handle.close() }
        signal?.throwIfAborted(); await fs.promises.link(temporary, file); published = true; await syncDirectoryAsync(this.directory)
        await writePrivateMetadata(path.join(this.directory, `${ref.id}.json`), { version: 1, taskId: owner.taskId, ref })
      } catch (error) {
        if (published) {
          await fs.promises.rm(file, { force: true })
          // Metadata publication may succeed before a directory sync fails. Remove only our exact record.
          const metadataFile = path.join(this.directory, `${ref.id}.json`)
          try { const saved = await readPrivateMetadata(metadataFile); if (JSON.stringify(saved) === JSON.stringify({ version: 1, taskId: owner.taskId, ref })) await fs.promises.rm(metadataFile, { force: true }) } catch { /* Preserve unowned or unreadable records. */ }
        }
        throw error
      }
      finally { await fs.promises.rm(temporary, { force: true }) }
      if (signal?.aborted) { await fs.promises.rm(file, { force: true }); await fs.promises.rm(path.join(this.directory, `${ref.id}.json`), { force: true }); signal.throwIfAborted() }
      return ref
    })
    AgentMediaStore.queues.set(this.directory, operation)
    void operation.finally(() => { if (AgentMediaStore.queues.get(this.directory) === operation) AgentMediaStore.queues.delete(this.directory) }).catch(() => {})
    return operation
  }
  async read(taskId: string, ref: AgentMediaRef): Promise<Buffer> {
    if (!safeId.test(taskId) || !validMediaRef(ref)) throw new Error('Invalid media reference')
    ref = { ...ref }
    const metadataFile = path.join(this.directory, `${ref.id}.json`)
    assertPrivateFile(metadataFile)
    if (fs.statSync(metadataFile).size > 4096) throw new Error('Invalid media metadata size')
    const saved = await readPrivateMetadata(metadataFile) as { version: number; taskId: string; ref: AgentMediaRef }
    if (saved.version !== 1 || saved.taskId !== taskId || !validMediaRef(saved.ref) || Object.keys(ref).length !== Object.keys(saved.ref).length || Object.keys(ref).some(key => Reflect.get(ref, key) !== Reflect.get(saved.ref, key))) throw new Error('Media belongs to a different task or run')
    const file = path.join(this.directory, `${ref.id}.bin`); assertPrivateFile(file)
    const handle = await fs.promises.open(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK)
    try {
      const pinned = await handle.stat()
      if (!pinned.isFile() || pinned.size !== ref.bytes) throw new Error('Media cache is damaged')
      const bytes = Buffer.alloc(ref.bytes)
      let offset = 0
      while (offset < bytes.length) {
        const result = await handle.read(bytes, offset, bytes.length - offset, offset)
        if (!result.bytesRead) throw new Error('Media cache is truncated')
        offset += result.bytesRead
      }
      if ((await handle.stat()).size !== ref.bytes || digest(bytes) !== ref.sha256) throw new Error('Media cache checksum does not match')
      const info = ref.mime === 'video/mp4' ? videoInfo(bytes) : rasterInfo(bytes)
      if (info.mime !== ref.mime || info.width !== ref.width || info.height !== ref.height || ref.mime === 'video/mp4' && ref.durationMs !== undefined && (!('durationMs' in info) || info.durationMs !== ref.durationMs)) throw new Error('Media header does not match its reference')
      return bytes
    } finally { await handle.close() }
  }
}
