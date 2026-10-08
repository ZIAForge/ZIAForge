import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AgentInputImageStore } from '../AgentInputImageStore'
import { MAX_INPUT_IMAGE_BYTES, MAX_INPUT_IMAGE_CACHE_BYTES, validInputImageRef, type AgentInputImageOwner } from '../../../shared/agent-input-images'

const roots: string[] = []
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXioAAAAASUVORK5CYII=', 'base64')
const owner: AgentInputImageOwner = { taskId: 'task-a', chatId: 'chat-a', sessionId: 'session-a', runId: 'run-a' }
const setup = () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ziaf-input-image-')))
  roots.push(root)
  const directory = path.join(root, 'private-images')
  const source = (name: string, bytes = png) => { const filename = path.join(root, name); fs.writeFileSync(filename, bytes); return filename }
  return { root, directory, store: new AgentInputImageStore(directory), source }
}
afterEach(() => {
  vi.restoreAllMocks()
  roots.splice(0).forEach(root => fs.rmSync(root, { recursive: true, force: true }))
})

describe('private input image custody', () => {
  it('copies selected bytes privately and restores only metadata after store restart without rereading the source', async () => {
    const { root, directory, store, source } = setup()
    const selected = source('selected.png')
    const [ref] = await store.stage(owner, [selected])
    expect(validInputImageRef(ref)).toBe(true)
    expect(ref).toMatchObject({ name: 'selected.png', mime: 'image/png', bytes: png.length, width: 1, height: 1 })
    expect(JSON.stringify(ref)).not.toContain(root)
    expect(JSON.stringify(ref)).not.toContain('data:')
    expect(JSON.stringify(ref)).not.toContain(png.toString('base64'))
    if (process.platform !== 'win32') {
      expect(fs.statSync(directory).mode & 0o777).toBe(0o700)
      for (const suffix of ['bin', 'json']) expect(fs.statSync(path.join(directory, `${ref.id}.${suffix}`)).mode & 0o777).toBe(0o600)
    }
    fs.rmSync(selected)
    const restarted = new AgentInputImageStore(directory)
    expect(await restarted.list(owner)).toEqual([ref])
    const resolved = [{ id: ref.id, mime: 'image/png', dataUrl: `data:image/png;base64,${png.toString('base64')}` }]
    expect(await restarted.resolve(owner, [ref.id])).toEqual(resolved)
    expect(await restarted.resolve(owner, [ref.id])).toEqual(resolved)
    await restarted.discard(owner, [ref.id])
    expect(await restarted.list(owner)).toEqual([])
    expect(fs.readdirSync(directory)).toEqual([])
  })

  it('rejects every stale owner field and validates a whole discard batch before deleting anything', async () => {
    const { store, source } = setup()
    const [ref] = await store.stage(owner, [source('mine.png')])
    for (const field of ['taskId', 'chatId', 'sessionId', 'runId'] as const) {
      const other = { ...owner, [field]: `other-${field}` }
      expect(await store.list(other)).toEqual([])
      await expect(store.resolve(other, [ref.id])).rejects.toThrow('different task, chat, session or run')
      await expect(store.discard(other, [ref.id])).rejects.toThrow('different task, chat, session or run')
    }
    const otherOwner = { ...owner, chatId: 'chat-b' }
    const [foreign] = await store.stage(otherOwner, [source('foreign.png')])
    await expect(store.discard(owner, [ref.id, foreign.id])).rejects.toThrow('different task')
    expect(await store.list(owner)).toEqual([ref])
    await expect(store.resolve(owner, [ref.id, ref.id])).rejects.toThrow('distinct')
    await expect(store.discard(owner, ['../../selected.png'])).rejects.toThrow('distinct')
    await expect(store.resolve({ ...owner, taskId: '../escape' }, [ref.id])).rejects.toThrow('owner')
  })

  it('enforces four pending images across picker calls and concurrent store instances', async () => {
    const { directory, store, source } = setup()
    const paths = Array.from({ length: 5 }, (_, i) => source(`image-${i}.png`))
    await store.stage(owner, paths.slice(0, 3))
    const concurrent = await Promise.allSettled([
      store.stage(owner, [paths[3]]),
      new AgentInputImageStore(directory).stage(owner, [paths[4]]),
    ])
    expect(concurrent.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect(concurrent.filter(result => result.status === 'rejected')).toHaveLength(1)
    expect(await store.list(owner)).toHaveLength(4)
    expect(fs.readdirSync(directory)).toHaveLength(8)
  })

  it('enforces individual, cumulative batch and total private store byte limits without partial staging', async () => {
    const { directory, store, source } = setup()
    const padded = Buffer.alloc(11 * 1024 * 1024); png.copy(padded)
    const first = source('large-a.png', padded), second = source('large-b.png', padded)
    await expect(store.stage(owner, [first, second])).rejects.toThrow('20 MiB')
    expect(fs.readdirSync(directory)).toEqual([])
    await store.stage(owner, [first])
    await expect(store.stage(owner, [second])).rejects.toThrow('20 MiB')
    expect(await store.list(owner)).toHaveLength(1)
    const oversized = source('too-large.png'); fs.truncateSync(oversized, MAX_INPUT_IMAGE_BYTES + 1)
    await expect(store.stage(owner, [oversized])).rejects.toThrow('16 MiB')
    const orphan = path.join(directory, 'interrupted-copy.tmp'); fs.writeFileSync(orphan, ''); fs.truncateSync(orphan, MAX_INPUT_IMAGE_CACHE_BYTES)
    await expect(store.stage(owner, [source('small.png')])).rejects.toThrow('cache is full')
    expect(fs.statSync(orphan).size).toBe(MAX_INPUT_IMAGE_CACHE_BYTES)
    expect(await store.list(owner)).toHaveLength(1)
  })

  it('rejects symlinks, non-raster data and oversized pixel buffers before creating copies', async () => {
    const { root, directory, store, source } = setup()
    const target = source('target.png'), linked = path.join(root, 'linked.png')
    fs.symlinkSync(target, linked)
    await expect(store.stage(owner, [linked])).rejects.toThrow('symbolic link')
    await expect(store.stage(owner, [root])).rejects.toThrow('regular')
    await expect(store.stage(owner, [source('fake.png', Buffer.from('<svg/>'))])).rejects.toThrow('PNG, JPEG and WebP')
    const bomb = Buffer.from(png); bomb.writeUInt32BE(32768, 16); bomb.writeUInt32BE(32768, 20)
    await expect(store.stage(owner, [source('bomb.png', bomb)])).rejects.toThrow('dimensions')
    await expect(store.stage(owner, [target], AbortSignal.abort())).rejects.toThrow()
    expect(fs.readdirSync(directory)).toEqual([])
    const missing = path.join(root, 'missing-private-name.png')
    await expect(store.stage(owner, [missing])).rejects.not.toThrow(root)
  })

  it('checks copied bytes and pinned metadata on resolve while allowing owned damaged-image removal', async () => {
    const { directory, store, source } = setup()
    const [ref] = await store.stage(owner, [source('selected.png')])
    fs.writeFileSync(path.join(directory, `${ref.id}.bin`), Buffer.alloc(png.length))
    await expect(store.resolve(owner, [ref.id])).rejects.toThrow('checksum')
    await store.discard(owner, [ref.id])
    const [linkedRef] = await store.stage(owner, [source('second.png')])
    const file = path.join(directory, `${linkedRef.id}.bin`), outside = source('outside.png')
    fs.rmSync(file); fs.symlinkSync(outside, file)
    await expect(store.resolve(owner, [linkedRef.id])).rejects.toThrow('Unsafe')
    await store.discard(owner, [linkedRef.id])
    expect(fs.readFileSync(outside)).toEqual(png)
    const [metadataRef] = await store.stage(owner, [source('third.png')])
    const metadata = path.join(directory, `${metadataRef.id}.json`)
    fs.rmSync(metadata); fs.symlinkSync(outside, metadata)
    await expect(store.resolve(owner, [metadataRef.id])).rejects.toThrow('unavailable')
    await expect(store.discard(owner, [metadataRef.id])).rejects.toThrow('unavailable')
    expect(fs.readFileSync(outside)).toEqual(png)
  })

  it('detects a source growing during its pinned read and does not retain a partial batch', async () => {
    const { directory, store, source } = setup()
    const selected = source('mutable.png')
    const open = fs.promises.open.bind(fs.promises)
    vi.spyOn(fs.promises, 'open').mockImplementation(async (...args) => {
      const handle = await open(...args)
      if (args[0] === selected) {
        const readable = handle as unknown as { read(buffer: Buffer, offset: number, length: number, position: number): Promise<{ bytesRead: number; buffer: Buffer }> }
        const read = readable.read.bind(readable)
        vi.spyOn(readable, 'read').mockImplementation(async (buffer, offset, length, position) => {
          const result = await read(buffer, offset, length, position)
          fs.appendFileSync(selected, Buffer.from('growth'))
          return result
        })
      }
      return handle
    })
    await expect(store.stage(owner, [source('unchanged.png'), selected])).rejects.toThrow('Could not read')
    expect(fs.readdirSync(directory)).toEqual([])
  })

  it('rolls back newly published bytes if metadata publication fails and bounds display names', async () => {
    const { directory, store, source } = setup()
    const link = fs.promises.link.bind(fs.promises)
    vi.spyOn(fs.promises, 'link').mockImplementation(async (existing, destination) => {
      if (String(destination).endsWith('.json')) throw Object.assign(new Error('fixture write failure'), { code: 'ENOSPC' })
      return link(existing, destination)
    })
    await expect(store.stage(owner, [source('selected.png')])).rejects.toThrow('storage is unavailable')
    expect(fs.readdirSync(directory)).toEqual([])
    vi.restoreAllMocks()
    const [ref] = await store.stage(owner, [source(`${'a'.repeat(170)}.png`)])
    expect(ref.name).toHaveLength(160)
    expect(validInputImageRef({ ...ref, name: '../outside' })).toBe(false)
    expect(validInputImageRef({ ...ref, path: '/private/path' })).toBe(false)
  })
})
