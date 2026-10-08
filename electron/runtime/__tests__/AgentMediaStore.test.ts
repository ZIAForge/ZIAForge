import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AgentMediaStore, MAX_MEDIA_CACHE_BYTES, rasterInfo } from '../AgentMediaStore'
import { MAX_VIDEO_BYTES, validMediaRef, validImageMediaRef } from '../../../shared/agent-media'
import { downloadApiImage } from '../../api/ApiMediaDownload'
import { EventJournal } from '../EventJournal'
import { queueContext } from '../QueueStore'
import type { ResolvedApiConnection } from '../../api/ApiProviderStore'

const roots: string[] = []
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXioAAAAASUVORK5CYII=', 'base64')
const setup = () => { const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ziaf-media-'))); roots.push(root); return { root, store: new AgentMediaStore(path.join(root, 'media')) } }
// ISO-BMFF header fixture, intentionally not a codec/playback fixture.
const box = (kind: string, ...payload: Buffer[]) => { const body = Buffer.concat(payload), header = Buffer.alloc(8); header.writeUInt32BE(body.length + 8); header.write(kind, 4, 'ascii'); return Buffer.concat([header, body]) }
function mp4(options: { version?: 0 | 1; handler?: string; width?: number; height?: number; unknownDuration?: boolean; extendedMdat?: boolean } = {}) {
  const version = options.version ?? 0
  const timed = (length: number) => { const body = Buffer.alloc(length); body[0] = version; body.writeUInt32BE(1000, version === 0 ? 12 : 20); if (version === 0) body.writeUInt32BE(options.unknownDuration ? 0xffffffff : 6040, 16); else body.writeBigUInt64BE(options.unknownDuration ? 0xffffffffffffffffn : 6040n, 24); return body }
  const tkhd = Buffer.alloc(version === 0 ? 84 : 96); tkhd[0] = version; tkhd.writeUInt32BE((options.width ?? 736) * 65536, version === 0 ? 76 : 88); tkhd.writeUInt32BE((options.height ?? 400) * 65536, version === 0 ? 80 : 92)
  const hdlr = Buffer.alloc(24); hdlr.write(options.handler ?? 'vide', 8, 'ascii')
  const ftyp = box('ftyp', Buffer.from('isom\0\0\0\0isommp42', 'binary'))
  const moov = box('moov', box('mvhd', timed(version === 0 ? 100 : 112)), box('trak', box('tkhd', tkhd), box('mdia', box('mdhd', timed(version === 0 ? 24 : 36)), box('hdlr', hdlr))))
  let mdat = box('mdat', Buffer.from([1, 2, 3, 4]))
  if (options.extendedMdat) { const header = Buffer.alloc(16); header.writeUInt32BE(1); header.write('mdat', 4); header.writeBigUInt64BE(20n, 8); mdat = Buffer.concat([header, Buffer.from([1, 2, 3, 4])]) }
  return Buffer.concat([ftyp, moov, mdat])
}
afterEach(() => { vi.restoreAllMocks(); roots.splice(0).forEach(root => fs.rmSync(root, { recursive: true, force: true })) })
describe('private media custody', () => {
  it('retains verified private bytes across store restart with metadata-only references', async () => {
    const { root, store } = setup(), ref = await store.storeBase64({ taskId: 'task', runId: 'run-1' }, png.toString('base64'))
    expect(ref).toMatchObject({ width: 1, height: 1, mime: 'image/png', bytes: png.length })
    expect(JSON.stringify(ref)).not.toContain(png.toString('base64'))
    expect(fs.statSync(path.join(root, 'media', `${ref.id}.bin`)).mode & 0o777).toBe(0o600)
    expect(await new AgentMediaStore(path.join(root, 'media')).read('task', ref)).toEqual(png)
    await expect(store.read('other-task', ref)).rejects.toThrow('different task')
    await expect(store.read('task', { ...ref, sourceRunId: 'foreign-run' })).rejects.toThrow('different task')
    fs.writeFileSync(path.join(root, 'media', `${ref.id}.bin`), Buffer.alloc(png.length))
    await expect(store.read('task', ref)).rejects.toThrow('checksum')
  })
  it('refuses linked cache files, invalid MIME/base64, oversized dimensions and cancellation', async () => {
    const { root, store } = setup()
    for (const bytes of [Buffer.from('<svg/>'), Buffer.from('not an image')]) await expect(store.storeBase64({ taskId: 'task', runId: 'run-1' }, bytes.toString('base64'))).rejects.toThrow()
    await expect(store.storeBase64({ taskId: 'task', runId: 'run-1' }, '!!!=')).rejects.toThrow('base64')
    const bomb = Buffer.from(png); bomb.writeUInt32BE(32768, 16); bomb.writeUInt32BE(32768, 20)
    await expect(store.storeBase64({ taskId: 'task', runId: 'run-1' }, bomb.toString('base64'))).rejects.toThrow('dimensions')
    await expect(store.storeBase64({ taskId: 'task', runId: 'run-1' }, png.toString('base64'), AbortSignal.abort())).rejects.toThrow()
    const ref = await store.storeBase64({ taskId: 'task', runId: 'run-1' }, png.toString('base64'))
    const file = path.join(root, 'media', `${ref.id}.bin`); fs.rmSync(file); fs.symlinkSync(path.join(root, 'outside'), file)
    await expect(store.read('task', ref)).rejects.toThrow('Unsafe')
  })
  it.each([0, 1] as const)('retains owned MP4 bytes and container metadata across restart (header version %s)', async version => {
    const { root, store } = setup(), bytes = mp4({ version, extendedMdat: true })
    const ref = await store.storeVideo({ taskId: 'task', runId: 'run-video' }, bytes)
    expect(ref).toMatchObject({ mime: 'video/mp4', width: 736, height: 400, durationMs: 6040, bytes: bytes.length })
    expect(validMediaRef(ref)).toBe(true); expect(validImageMediaRef(ref)).toBe(false)
    expect(fs.statSync(path.join(root, 'media', `${ref.id}.bin`)).mode & 0o777).toBe(0o600)
    expect(await new AgentMediaStore(path.join(root, 'media')).read('task', ref)).toEqual(bytes)
    await expect(store.read('foreign', ref)).rejects.toThrow('different task')
    await expect(store.read('task', { ...ref, sourceRunId: 'foreign-run' })).rejects.toThrow('different task')
    const withoutDuration = { ...ref }; delete withoutDuration.durationMs
    await expect(store.read('task', withoutDuration)).rejects.toThrow('different task')
    const journal = new EventJournal(path.join(root, 'video-events.ndjson'), { privateStorage: true })
    const event = { eventId: 'video-event', taskId: 'task', runId: 'run-video', timestamp: 1, type: 'tool.completed' as const, toolCallId: 'video-tool', media: [ref] }
    await journal.append(event); expect(await journal.readEvents()).toEqual([event])
    expect(fs.readFileSync(journal.filePath, 'utf8')).not.toContain(bytes.toString('base64'))
    fs.writeFileSync(path.join(root, 'media', `${ref.id}.bin`), Buffer.alloc(bytes.length))
    await expect(store.read('task', ref)).rejects.toThrow('checksum')
  })
  it('keeps the old exact image reference contract and never treats MP4 as a raster input', async () => {
    const { store } = setup(), image = await store.storeBase64({ taskId: 'task', runId: 'run' }, png.toString('base64'))
    expect(Object.keys(image)).toHaveLength(7); expect(validImageMediaRef(image)).toBe(true)
    expect(validMediaRef({ ...image, durationMs: 6040 })).toBe(false)
    const video = await store.storeVideo({ taskId: 'task', runId: 'run' }, mp4({ unknownDuration: true }))
    expect(Object.keys(video)).toHaveLength(7); expect(video.durationMs).toBeUndefined()
    expect(validMediaRef({ ...video, bytes: MAX_VIDEO_BYTES + 1 })).toBe(false)
    for (const durationMs of [0, -1, 1.5, Infinity, undefined]) expect(validMediaRef({ ...video, durationMs })).toBe(false)
    expect(validMediaRef({ ...video, url: 'https://foreign.invalid' })).toBe(false)
    expect(() => rasterInfo(mp4())).toThrow('Only PNG')
  })
  it('rejects malformed, audio-only and oversized MP4 metadata before publication', async () => {
    const { root, store } = setup(), malformed = mp4(); malformed.writeUInt32BE(malformed.length + 1, 0)
    const extended = mp4({ extendedMdat: true }); extended.writeBigUInt64BE(0xffffffffffffffffn, extended.length - 12)
    const unsupported = mp4(); unsupported.write('zzzz', 8); unsupported.write('zzzzzzzz', 16)
    const hugeHeader = Buffer.concat([box('ftyp', Buffer.from('isom\0\0\0\0isom', 'binary')), box('moov', Buffer.alloc(4 * 1024 * 1024 + 1)), box('mdat', Buffer.from([1]))])
    for (const bytes of [png, malformed, extended, unsupported, mp4({ handler: 'soun' }), mp4({ width: 32768, height: 32768 }), mp4().subarray(0, 40), hugeHeader]) {
      await expect(store.storeVideo({ taskId: 'task', runId: 'run' }, bytes)).rejects.toThrow()
    }
    expect(fs.readdirSync(path.join(root, 'media'))).toEqual([])
  })
  it('snapshots caller-owned buffers, preserves file sync and cleans aborted or failed atomic publication', async () => {
    const { root, store } = setup(), source = mp4(), original = Buffer.from(source), owner = { taskId: 'task', runId: 'run' }
    const saving = store.storeVideo(owner, source); source.fill(0); owner.taskId = 'foreign'; owner.runId = 'foreign-run'
    const ref = await saving; expect(ref.sourceRunId).toBe('run'); expect(await store.read('task', ref)).toEqual(original)
    const directory = path.join(root, 'media'), baseline = fs.readdirSync(directory).sort()
    const open = fs.promises.open.bind(fs.promises); let syncs = 0
    vi.spyOn(fs.promises, 'open').mockImplementation(async (...args) => { const handle = await open(...args); if (String(args[0]).endsWith('.tmp')) { const sync = handle.sync.bind(handle); vi.spyOn(handle, 'sync').mockImplementation(async () => { syncs++; return sync() }) } return handle })
    const link = fs.promises.link.bind(fs.promises), controller = new AbortController()
    vi.spyOn(fs.promises, 'link').mockImplementation(async (from, to) => { await link(from, to); if (String(to).endsWith('.json')) controller.abort() })
    await expect(store.storeVideo({ taskId: 'task', runId: 'run' }, mp4(), controller.signal)).rejects.toThrow()
    expect(syncs).toBe(2)
    expect(fs.readdirSync(directory).sort()).toEqual(baseline)
    vi.mocked(fs.promises.link).mockImplementation(async (from, to) => { if (String(to).endsWith('.json')) throw new Error('metadata publication failed'); await link(from, to) })
    await expect(store.storeVideo({ taskId: 'task', runId: 'run' }, mp4())).rejects.toThrow('metadata publication failed')
    expect(fs.readdirSync(directory).sort()).toEqual(baseline)
    await expect(store.storeVideo({ taskId: 'task', runId: 'run' }, mp4(), AbortSignal.abort())).rejects.toThrow()
  })
  it('enforces the shared media quota without evicting retained files', async () => {
    const { root, store } = setup(), retained = path.join(root, 'media', `media-${randomUUID()}.bin`)
    const file = fs.openSync(retained, 'wx', 0o600); try { fs.ftruncateSync(file, MAX_MEDIA_CACHE_BYTES) } finally { fs.closeSync(file) }
    await expect(store.storeVideo({ taskId: 'task', runId: 'run' }, mp4())).rejects.toThrow('cache is full')
    await expect(store.storeBase64({ taskId: 'task', runId: 'run' }, png.toString('base64'))).rejects.toThrow('cache is full')
    expect(fs.statSync(retained).size).toBe(MAX_MEDIA_CACHE_BYTES)
    expect(fs.readdirSync(path.join(root, 'media'))).toEqual([path.basename(retained)])
  })
  it('rejects oversized or forged media before journal append and during replay', async () => {
    const { root, store } = setup(), ref = await store.storeBase64({ taskId: 'task', runId: 'run-1' }, png.toString('base64'))
    const journal = new EventJournal(path.join(root, 'events.ndjson'), { privateStorage: true })
    const event = { eventId: 'event-1', taskId: 'task', runId: 'run-1', timestamp: 1, type: 'tool.completed' as const, toolCallId: 'call', media: [ref] }
    await journal.append(event)
    await expect(journal.append({ ...event, output: png.toString('base64').repeat(300) })).rejects.toThrow('media event')
    await expect(journal.append({ ...event, media: [{ ...ref, sourceRunId: 'foreign-run' }] })).rejects.toThrow('media event')
    fs.appendFileSync(journal.filePath, JSON.stringify({ ...event, eventId: 'forged', media: [{ ...ref, url: 'https://foreign.invalid/' }] }) + '\n')
    expect(await journal.readEvents()).toEqual([event])
    const replay: unknown[] = []; await journal.streamEvents(value => { replay.push(value) }); expect(replay).toEqual([event])
  })
  it('downloads only pinned protected file IDs with header auth and no redirects', async () => {
    const connection: ResolvedApiConnection = { id: 'api', name: 'Fixture', baseUrl: 'https://example.invalid/v1', model: 'm', enabled: true, hasApiKey: true, apiKey: 'synthetic-only' }
    const request = vi.fn(async () => new Response(png, { headers: { 'content-type': 'image/png', 'content-length': String(png.length) } }))
    const id = `file_${'a'.repeat(32)}`
    expect(await downloadApiImage(connection, id, new AbortController().signal, request)).toEqual(png)
    expect(request).toHaveBeenCalledWith(`https://example.invalid/v1/files/${id}/content`, expect.objectContaining({ redirect: 'error', headers: { Authorization: 'Bearer synthetic-only' } }))
    await expect(downloadApiImage(connection, 'https://foreign.invalid/key', new AbortController().signal, request)).rejects.toThrow('file ID')
    expect(request).toHaveBeenCalledTimes(1)
    await expect(downloadApiImage(connection, id, new AbortController().signal, async () => new Response('denied', { status: 401 }))).rejects.toThrow('HTTP 401')
    await expect(downloadApiImage(connection, id, new AbortController().signal, async () => new Response(png, { headers: { 'content-type': 'image/svg+xml' } }))).rejects.toThrow('MIME')
  })
  it('preserves legacy queue fingerprints while pinning Responses launch context', () => {
    const launch = { provider: 'api', presetName: '', model: 'm', apiConnectionId: 'api' }
    expect(queueContext(launch)).toBe(queueContext({ ...launch, apiTransport: 'chat-completions' }))
    const responses = { ...launch, apiTransport: 'responses', apiBaseUrl: 'https://first.invalid/v1' }
    expect(queueContext(responses)).not.toBe(queueContext({ ...responses, apiBaseUrl: 'https://other.invalid/v1' }))
    expect(queueContext(responses)).not.toBe(queueContext({ ...responses, apiAllowCommands: true }))
    expect(queueContext(responses)).not.toBe(queueContext(launch))
  })
})
