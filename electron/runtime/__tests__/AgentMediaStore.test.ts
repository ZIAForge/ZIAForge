import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AgentMediaStore } from '../AgentMediaStore'
import { downloadApiImage } from '../../api/ApiMediaDownload'
import { EventJournal } from '../EventJournal'
import { queueContext } from '../QueueStore'
import type { ResolvedApiConnection } from '../../api/ApiProviderStore'

const roots: string[] = []
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXioAAAAASUVORK5CYII=', 'base64')
const setup = () => { const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ziaf-media-'))); roots.push(root); return { root, store: new AgentMediaStore(path.join(root, 'media')) } }
afterEach(() => { roots.splice(0).forEach(root => fs.rmSync(root, { recursive: true, force: true })) })
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
