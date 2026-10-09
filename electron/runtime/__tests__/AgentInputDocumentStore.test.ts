import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AgentInputDocumentStore } from '../AgentInputDocumentStore'
import { MAX_INPUT_DOCUMENT_BYTES, MAX_INPUT_DOCUMENT_CACHE_BYTES, MAX_INPUT_TEXT_DOCUMENT_BYTES, validInputDocumentRef, type AgentInputDocumentOwner } from '../../../shared/agent-input-documents'

const roots: string[] = []
const owner: AgentInputDocumentOwner = { taskId: 'task-a', chatId: 'chat-a', sessionId: 'session-a', runId: 'run-a' }
const pdf = Buffer.from('%PDF-1.7\nSynthetic PDF fixture\n%%EOF')
const text = Buffer.from('\uFEFFТекст — synthetic document\n')
function setup() {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ziaf-input-document-'))); roots.push(root)
  const directory = path.join(root, 'private-documents')
  const source = (name: string, bytes = text) => { const filename = path.join(root, name); fs.writeFileSync(filename, bytes); return filename }
  return { root, directory, store: new AgentInputDocumentStore(directory), source }
}
afterEach(() => { vi.restoreAllMocks(); roots.splice(0).forEach(root => fs.rmSync(root, { recursive: true, force: true })) })

describe('private input document custody', () => {
  it('copies PDF/text after a native selection and restores metadata/retry without reopening the source', async () => {
    const { root, directory, store, source } = setup(), selected = [source('selected.pdf', pdf), source('notes.txt')]
    const refs = await store.stage(owner, selected)
    expect(refs.every(validInputDocumentRef)).toBe(true)
    expect(refs.map(ref => ref.mime)).toEqual(['application/pdf', 'text/plain'])
    expect(JSON.stringify(refs)).not.toContain(root); expect(JSON.stringify(refs)).not.toContain(pdf.toString('base64'))
    if (process.platform !== 'win32') {
      expect(fs.statSync(directory).mode & 0o777).toBe(0o700)
      for (const ref of refs) for (const suffix of ['bin', 'json']) expect(fs.statSync(path.join(directory, `${ref.id}.${suffix}`)).mode & 0o777).toBe(0o600)
    }
    selected.forEach(filename => fs.unlinkSync(filename))
    const restarted = new AgentInputDocumentStore(directory)
    expect(await restarted.list(owner)).toEqual(expect.arrayContaining(refs))
    const resolved = [
      { id: refs[0].id, name: 'selected.pdf', mime: 'application/pdf', data: pdf.toString('base64') },
      { id: refs[1].id, name: 'notes.txt', mime: 'text/plain', data: text.toString('utf8') },
    ]
    expect(await restarted.resolve(owner, refs.map(ref => ref.id))).toEqual(resolved)
    expect(await restarted.resolve(owner, refs.map(ref => ref.id))).toEqual(resolved)
    await restarted.discard(owner, refs.map(ref => ref.id))
    expect(await restarted.list(owner)).toEqual([]); expect(fs.readdirSync(directory)).toEqual([])
  })

  it('checks every owner field and validates the entire discard batch before deleting any document', async () => {
    const { store, source } = setup(), [ref] = await store.stage(owner, [source('mine.txt')])
    for (const field of ['taskId', 'chatId', 'sessionId', 'runId'] as const) {
      const other = { ...owner, [field]: `other-${field}` }
      expect(await store.list(other)).toEqual([])
      await expect(store.resolve(other, [ref.id])).rejects.toThrow('different task, chat, session or run')
      await expect(store.discard(other, [ref.id])).rejects.toThrow('different task, chat, session or run')
    }
    const [foreign] = await store.stage({ ...owner, chatId: 'chat-b' }, [source('foreign.txt')])
    await expect(store.discard(owner, [ref.id, foreign.id])).rejects.toThrow('different task')
    expect(await store.list(owner)).toEqual([ref])
    await expect(store.resolve(owner, [ref.id, ref.id])).rejects.toThrow('distinct')
    await expect(store.resolve(owner, ['../../escape'])).rejects.toThrow('distinct')
    await expect(store.list({ ...owner, taskId: '../escape' })).rejects.toThrow('owner')
  })

  it('enforces four pending documents across native picker calls and concurrent stores', async () => {
    const { directory, store, source } = setup(), files = Array.from({ length: 5 }, (_, i) => source(`document-${i}.txt`))
    await store.stage(owner, files.slice(0, 3))
    const results = await Promise.allSettled([store.stage(owner, [files[3]]), new AgentInputDocumentStore(directory).stage(owner, [files[4]])])
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1)
    expect(await store.list(owner)).toHaveLength(4)
    await expect(store.stage(owner, [files[0]])).rejects.toThrow('four documents')
  })

  it('enforces PDF16 MiB, text1 MiB, aggregate20 MiB and private cache limits without partial batches', async () => {
    const { directory, store, source } = setup()
    const large = Buffer.alloc(11 * 1024 * 1024); pdf.copy(large)
    const first = source('large-a.pdf', large), second = source('large-b.pdf', large)
    await expect(store.stage(owner, [first, second])).rejects.toThrow('20 MiB')
    expect(fs.readdirSync(directory)).toEqual([])
    await store.stage(owner, [first])
    await expect(store.stage(owner, [second])).rejects.toThrow('20 MiB')
    const tooLarge = source('too-large.pdf', pdf); fs.truncateSync(tooLarge, MAX_INPUT_DOCUMENT_BYTES + 1)
    await expect(store.stage(owner, [tooLarge])).rejects.toThrow('16 MiB')
    await expect(store.stage(owner, [source('too-large.txt', Buffer.alloc(MAX_INPUT_TEXT_DOCUMENT_BYTES + 1, 65))])).rejects.toThrow('1 MiB')
    const orphan = path.join(directory, 'interrupted-copy.tmp'); fs.writeFileSync(orphan, ''); fs.truncateSync(orphan, MAX_INPUT_DOCUMENT_CACHE_BYTES)
    await expect(store.stage(owner, [source('small.txt')])).rejects.toThrow('cache is full')
    expect(fs.statSync(orphan).size).toBe(MAX_INPUT_DOCUMENT_CACHE_BYTES); expect(await store.list(owner)).toHaveLength(1)
  })

  it('requires PDF magic or fatal UTF-8 and refuses source/parent symlinks and nonregular files', async () => {
    const { root, directory, store, source } = setup(), target = source('target.txt')
    const linked = path.join(root, 'linked.txt'); fs.symlinkSync(target, linked)
    const linkedDirectory = path.join(root, 'linked-directory'); fs.symlinkSync(root, linkedDirectory)
    for (const selected of [linked, path.join(linkedDirectory, 'target.txt'), root]) await expect(store.stage(owner, [selected])).rejects.toThrow('regular')
    await expect(store.stage(owner, [source('fake.pdf', Buffer.from('ordinary text'))])).rejects.toThrow('PDF signature')
    await expect(store.stage(owner, [source('invalid.txt', Buffer.from([195, 40]))])).rejects.toThrow('UTF-8')
    await expect(store.stage(owner, [source('binary.txt', Buffer.from([0, 1, 2]))])).rejects.toThrow('PDF or UTF-8')
    await expect(store.stage(owner, [target], AbortSignal.abort())).rejects.toThrow()
    expect(fs.readdirSync(directory)).toEqual([])
    await expect(store.stage(owner, [path.join(root, 'missing-private-file.txt')])).rejects.not.toThrow(root)
  })

  it('checks pinned cache bytes/metadata and allows owned damaged-document removal safely', async () => {
    const { directory, store, source } = setup(), [ref] = await store.stage(owner, [source('selected.txt')])
    fs.writeFileSync(path.join(directory, `${ref.id}.bin`), Buffer.alloc(text.length, 65))
    await expect(store.resolve(owner, [ref.id])).rejects.toThrow('checksum')
    await store.discard(owner, [ref.id])
    const [linkedRef] = await store.stage(owner, [source('second.txt')]), outside = source('outside.txt'), binary = path.join(directory, `${linkedRef.id}.bin`)
    fs.unlinkSync(binary); fs.symlinkSync(outside, binary)
    await expect(store.resolve(owner, [linkedRef.id])).rejects.toThrow('Unsafe')
    await store.discard(owner, [linkedRef.id]); expect(fs.readFileSync(outside)).toEqual(text)
    const [metadataRef] = await store.stage(owner, [source('third.txt')]), manifest = path.join(directory, `${metadataRef.id}.json`)
    fs.unlinkSync(manifest); fs.symlinkSync(outside, manifest)
    await expect(store.resolve(owner, [metadataRef.id])).rejects.toThrow('unavailable')
    await expect(store.discard(owner, [metadataRef.id])).rejects.toThrow('unavailable')
    expect(fs.readFileSync(outside)).toEqual(text)
  })

  it('rejects mutable sources during a pinned read and rolls back failed or cancelled publication', async () => {
    const { directory, store, source } = setup(), selected = source('mutable.txt'), open = fs.promises.open.bind(fs.promises)
    vi.spyOn(fs.promises, 'open').mockImplementation(async (...args) => {
      const handle = await open(...args)
      if (args[0] === selected) {
        const readable = handle as unknown as { read(buffer: Buffer, offset: number, length: number, position: number): Promise<{ bytesRead: number; buffer: Buffer }> }
        const read = readable.read.bind(readable)
        vi.spyOn(readable, 'read').mockImplementation(async (buffer, offset, length, position) => { const result = await read(buffer, offset, length, position); fs.appendFileSync(selected, 'growth'); return result })
      }
      return handle
    })
    await expect(store.stage(owner, [source('unchanged.txt'), selected])).rejects.toThrow('Could not read')
    expect(fs.readdirSync(directory)).toEqual([]); vi.restoreAllMocks()
    const link = fs.promises.link.bind(fs.promises)
    vi.spyOn(fs.promises, 'link').mockImplementation(async (from, to) => { if (String(to).endsWith('.json')) throw Object.assign(new Error('fixture failure'), { code: 'ENOSPC' }); await link(from, to) })
    await expect(store.stage(owner, [source('selected.txt')])).rejects.toThrow('storage is unavailable')
    expect(fs.readdirSync(directory)).toEqual([])
    const controller = new AbortController()
    vi.mocked(fs.promises.link).mockImplementation(async (from, to) => { await link(from, to); if (String(to).endsWith('.json')) controller.abort() })
    await expect(store.stage(owner, [source('cancelled.txt')], controller.signal)).rejects.toThrow()
    expect(fs.readdirSync(directory)).toEqual([])
  })

  it('bounds display names and rejects inline bytes, URLs, oversized text and undefined optional custody', async () => {
    const { store, source } = setup(), [ref] = await store.stage(owner, [source(`${'a'.repeat(170)}.txt`)])
    expect(ref.name).toHaveLength(160)
    for (const extra of [{ name: '../outside' }, { path: '/private/path' }, { data: 'inline' }, { url: 'https://foreign.invalid' }, { mime: 'text/html' }, { bytes: MAX_INPUT_TEXT_DOCUMENT_BYTES + 1 }]) expect(validInputDocumentRef({ ...ref, ...extra })).toBe(false)
  })
})
