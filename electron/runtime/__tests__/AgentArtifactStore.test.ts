import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AgentArtifactStore, verifiedArtifactMime } from '../AgentArtifactStore'
import { MAX_ARTIFACT_BYTES, MAX_ARTIFACT_CACHE_BYTES, validArtifactMetadata, validArtifactRef, type AgentArtifactMetadata } from '../../../shared/agent-artifacts'

const roots: string[] = []
const owner = { taskId: 'task-a', runId: 'run-a' }
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXioAAAAASUVORK5CYII=', 'base64')
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
const metadata = (bytes: Buffer, extra: Partial<AgentArtifactMetadata> = {}): AgentArtifactMetadata => ({ id: `file_${'a'.repeat(32)}`, filename: 'result.txt', mime_type: 'text/plain', bytes: bytes.length, sha256: sha(bytes), ...extra })
function setup() {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ziaf-artifact-'))); roots.push(root)
  const directory = path.join(root, 'private-artifacts')
  return { root, directory, store: new AgentArtifactStore(directory) }
}
afterEach(() => { vi.restoreAllMocks(); roots.splice(0).forEach(root => fs.rmSync(root, { recursive: true, force: true })) })

describe('private generated artifact custody', () => {
  it('retains private immutable bytes across store restart with metadata-only references', async () => {
    const { root, directory, store } = setup(), bytes = Buffer.from('Synthetic result Привет')
    const source = { ...metadata(bytes), kind: 'file', api_url: `/v1/files/file_${'a'.repeat(32)}/content`, owner_url: '/api/private-file' }
    const ref = await store.store(owner, source, bytes)
    expect(validArtifactMetadata(source)).toBe(true); expect(validArtifactRef(ref)).toBe(true)
    expect(ref).toMatchObject({ sourceRunId: owner.runId, filename: source.filename, mime: 'text/plain', providerFileId: source.id, bytes: bytes.length, sha256: sha(bytes) })
    expect(Object.keys(ref)).toHaveLength(7)
    const serialized = JSON.stringify(ref), manifest = fs.readFileSync(path.join(directory, `${ref.id}.json`), 'utf8')
    for (const forbidden of [root, source.api_url, source.owner_url, bytes.toString('base64')]) { expect(serialized).not.toContain(forbidden); expect(manifest).not.toContain(forbidden) }
    if (process.platform !== 'win32') {
      expect(fs.statSync(directory).mode & 0o777).toBe(0o700)
      for (const suffix of ['bin', 'json']) expect(fs.statSync(path.join(directory, `${ref.id}.${suffix}`)).mode & 0o777).toBe(0o600)
    }
    const restarted = new AgentArtifactStore(directory)
    expect(await restarted.read(owner.taskId, ref)).toEqual(bytes)
    expect(await restarted.store(owner, source, bytes)).toEqual(ref)
    expect(fs.readdirSync(directory)).toHaveLength(2)
  })

  it('retains revision/supersession metadata and allows both immutable versions to be saved', async () => {
    const { store } = setup(), firstBytes = Buffer.from('first'), nextBytes = Buffer.from('second')
    const first = await store.store(owner, metadata(firstBytes, { revision: 1 }), firstBytes)
    const next = await store.store(owner, metadata(nextBytes, { id: `file_${'b'.repeat(32)}`, revision: 2, supersedes_file_id: first.providerFileId }), nextBytes)
    expect(first.id).not.toBe(next.id)
    expect(next).toMatchObject({ revision: 2, supersedesFileId: first.providerFileId })
    expect(await store.read(owner.taskId, first)).toEqual(firstBytes)
    expect(await store.read(owner.taskId, next)).toEqual(nextBytes)
    await expect(store.store(owner, metadata(nextBytes), nextBytes)).rejects.toThrow('reused with different metadata')
    const anotherRun = await store.store({ ...owner, runId: 'run-b' }, metadata(firstBytes), firstBytes)
    expect(anotherRun.id).not.toBe(first.id); expect(anotherRun.sourceRunId).toBe('run-b')
  })

  it('downloads HTML, SVG and unknown bytes only as octet-stream while preserving the original file', async () => {
    const { store } = setup()
    for (const [mime, text, index] of [['text/html', '<script>unsafe()</script>', 1], ['image/svg+xml', '<svg onload="unsafe()"/>', 2], ['application/x-private-file', 'opaque result', 3]] as const) {
      const bytes = Buffer.from(text), ref = await store.store(owner, metadata(bytes, { id: `file_${String(index).repeat(32)}`, filename: mime === 'text/html' ? 'page.html' : 'result.svg', mime_type: mime }), bytes)
      expect(ref.mime).toBe('application/octet-stream')
      expect(await store.read(owner.taskId, ref)).toEqual(bytes)
    }
    const bytes = Buffer.from('%PDF-1.7\nSynthetic PDF\n%%EOF'), pdf = await store.store(owner, metadata(bytes, { id: `file_${'d'.repeat(32)}`, filename: 'result.pdf', mime_type: 'application/pdf' }), bytes)
    expect(pdf.mime).toBe('application/pdf'); expect(await store.read(owner.taskId, pdf)).toEqual(bytes)
  })

  it('rejects invalid ownership, digest, byte length, signatures and forged public reference fields', async () => {
    const { directory, store } = setup(), bytes = Buffer.from('text')
    await expect(store.store({ ...owner, taskId: '../foreign' }, metadata(bytes), bytes)).rejects.toThrow('owner')
    await expect(store.store(owner, metadata(bytes, { sha256: 'b'.repeat(64) }), bytes)).rejects.toThrow('checksum')
    await expect(store.store(owner, metadata(bytes, { bytes: bytes.length + 1 }), bytes)).rejects.toThrow('byte length')
    await expect(store.store(owner, metadata(bytes, { mime_type: 'image/png' }), bytes)).rejects.toThrow()
    await expect(store.store(owner, metadata(bytes, { bytes: MAX_ARTIFACT_BYTES + 1 }), bytes)).rejects.toThrow('metadata')
    for (const extra of [{ filename: '../file' }, { mime_type: 'text/plain; charset=utf-8' }, { revision: 0 }, { supersedes_file_id: metadata(bytes).id }]) expect(validArtifactMetadata(metadata(bytes, extra))).toBe(false)
    expect(fs.readdirSync(directory)).toEqual([])
    const ref = await store.store(owner, metadata(bytes), bytes)
    await expect(store.read('foreign', ref)).rejects.toThrow('different task')
    for (const extra of [{ sourceRunId: 'foreign-run' }, { filename: 'changed.txt' }, { mime: 'application/octet-stream' }, { revision: 1 }]) await expect(store.read(owner.taskId, { ...ref, ...extra })).rejects.toThrow('different task')
    for (const extra of [{ path: '/private/path' }, { url: 'https://foreign.invalid' }, { data: bytes.toString('base64') }, { mime: 'text/html' }]) expect(validArtifactRef({ ...ref, ...extra })).toBe(false)
  })

  it('checks known raster, PDF, ZIP and text signatures without executing any format', async () => {
    expect(verifiedArtifactMime(png, 'image/png')).toBe('image/png')
    expect(verifiedArtifactMime(Buffer.from('%PDF-1.7\n'), 'application/pdf')).toBe('application/pdf')
    const zip = Buffer.alloc(22); zip.set([80, 75, 5, 6])
    expect(verifiedArtifactMime(zip, 'application/zip')).toBe('application/zip')
    expect(verifiedArtifactMime(Buffer.from('Valid UTF-8 — текст'), 'text/markdown')).toBe('text/markdown')
    for (const mime of ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf', 'application/zip', 'video/mp4', 'audio/wav', 'audio/mpeg']) expect(() => verifiedArtifactMime(Buffer.from('not a binary signature'), mime)).toThrow()
    expect(() => verifiedArtifactMime(Buffer.from([195, 40]), 'text/plain')).toThrow('UTF-8')
    expect(() => verifiedArtifactMime(Buffer.from([0]), 'text/plain')).toThrow('binary')
  })

  it('refuses linked or mutated cache bytes and metadata, without reading a foreign target', async () => {
    const { root, directory, store } = setup(), bytes = Buffer.from('original')
    const ref = await store.store(owner, metadata(bytes), bytes), binary = path.join(directory, `${ref.id}.bin`)
    fs.writeFileSync(binary, Buffer.from('modified'))
    await expect(store.read(owner.taskId, ref)).rejects.toThrow('checksum')
    const outside = path.join(root, 'outside'); fs.writeFileSync(outside, bytes)
    fs.unlinkSync(binary); fs.symlinkSync(outside, binary)
    await expect(store.read(owner.taskId, ref)).rejects.toThrow('Unsafe')
    fs.unlinkSync(binary); fs.writeFileSync(binary, bytes)
    const manifest = path.join(directory, `${ref.id}.json`)
    fs.unlinkSync(manifest); fs.symlinkSync(outside, manifest)
    await expect(store.read(owner.taskId, ref)).rejects.toThrow('Unsafe')
    expect(fs.readFileSync(outside)).toEqual(bytes)
  })

  it('snapshots transport-owned buffers and metadata before queued persistence', async () => {
    const { store } = setup(), bytes = Buffer.from('immutable'), expected = Buffer.from(bytes), mutableOwner = { ...owner }, source = metadata(bytes)
    const pending = store.store(mutableOwner, source, bytes)
    bytes.fill(0); mutableOwner.taskId = 'other'; mutableOwner.runId = 'other-run'; source.filename = 'changed.txt'; source.sha256 = 'b'.repeat(64)
    const ref = await pending
    expect(ref.filename).toBe('result.txt'); expect(ref.sourceRunId).toBe(owner.runId)
    expect(await store.read(owner.taskId, ref)).toEqual(expected)
  })

  it('serializes duplicate delivery across stores and enforces quota without eviction', async () => {
    const { directory, store } = setup(), bytes = Buffer.from('retained')
    const refs = await Promise.all([store.store(owner, metadata(bytes), bytes), new AgentArtifactStore(directory).store(owner, metadata(bytes), bytes)])
    expect(refs[0]).toEqual(refs[1]); expect(fs.readdirSync(directory)).toHaveLength(2)
    const orphan = path.join(directory, 'interrupted-copy.tmp'); fs.writeFileSync(orphan, ''); fs.truncateSync(orphan, MAX_ARTIFACT_CACHE_BYTES)
    await expect(store.store(owner, metadata(bytes, { id: `file_${'b'.repeat(32)}` }), bytes)).rejects.toThrow('cache is full')
    expect(fs.statSync(orphan).size).toBe(MAX_ARTIFACT_CACHE_BYTES)
    expect(await store.read(owner.taskId, refs[0])).toEqual(bytes)
  })

  it('rolls back only new files on cancellation or failed metadata publication and preserves zero-byte files', async () => {
    const { directory, store } = setup(), bytes = Buffer.from('retained'), first = await store.store(owner, metadata(bytes), bytes), baseline = fs.readdirSync(directory).sort()
    const link = fs.promises.link.bind(fs.promises), controller = new AbortController()
    vi.spyOn(fs.promises, 'link').mockImplementation(async (from, to) => { await link(from, to); if (String(to).endsWith('.json')) controller.abort() })
    await expect(store.store(owner, metadata(bytes, { id: `file_${'b'.repeat(32)}` }), bytes, controller.signal)).rejects.toThrow()
    expect(fs.readdirSync(directory).sort()).toEqual(baseline)
    vi.mocked(fs.promises.link).mockImplementation(async (from, to) => { if (String(to).endsWith('.json')) throw Object.assign(new Error('synthetic failure'), { code: 'ENOSPC' }); await link(from, to) })
    await expect(store.store(owner, metadata(bytes, { id: `file_${'c'.repeat(32)}` }), bytes)).rejects.toThrow('storage is unavailable')
    expect(fs.readdirSync(directory).sort()).toEqual(baseline)
    vi.restoreAllMocks()
    expect(await store.read(owner.taskId, first)).toEqual(bytes)
    const empty = Buffer.alloc(0), ref = await store.store(owner, metadata(empty, { id: `file_${'d'.repeat(32)}` }), empty)
    expect(await store.read(owner.taskId, ref)).toEqual(empty)
  })

  it('detects a file growing during a pinned read', async () => {
    const { directory, store } = setup(), bytes = Buffer.from('original'), ref = await store.store(owner, metadata(bytes), bytes), file = path.join(directory, `${ref.id}.bin`)
    const open = fs.promises.open.bind(fs.promises)
    vi.spyOn(fs.promises, 'open').mockImplementation(async (...args) => {
      const handle = await open(...args)
      if (args[0] === file) {
        const readable = handle as unknown as { read(buffer: Buffer, offset: number, length: number, position: number): Promise<{ bytesRead: number; buffer: Buffer }> }
        const read = readable.read.bind(readable)
        vi.spyOn(readable, 'read').mockImplementation(async (buffer, offset, length, position) => { const result = await read(buffer, offset, length, position); fs.appendFileSync(file, 'growth'); return result })
      }
      return handle
    })
    await expect(store.read(owner.taskId, ref)).rejects.toThrow('changed during its read')
  })
})
