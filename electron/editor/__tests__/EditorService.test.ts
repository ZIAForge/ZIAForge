import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { EditorService } from '../EditorService'
import { EDITOR_DEFAULT_BYTES, EDITOR_FULL_BYTES, EDITOR_WINDOW_BYTES, type EditorOpenRequest } from '../../../shared/editor'

describe('task-scoped editor', () => {
  let root: string; let service: EditorService
  const request = (relativePath: string): EditorOpenRequest => ({ repoId: 'repo', taskId: 'task', scope: 'task', relativePath })
  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'ziaf-editor-'))
    service = new EditorService({ draftsDirectory: path.join(root, 'drafts'), resolveRoot: scope => { if (scope.repoId !== 'repo' || scope.taskId !== 'task') throw new Error('Unknown task'); return root } })
  })
  afterEach(async () => { await fs.rm(root, { recursive: true, force: true }) })

  it('creates an empty extension-neutral file without overwriting an existing name', async () => {
    const doc = await service.create(request('new.py'))
    expect(doc.text).toBe('')
    await fs.writeFile(path.join(root, 'new.py'), 'valuable')
    await expect(service.create({ ...request('new.py'), text: 'replacement' })).rejects.toThrow()
    expect(await fs.readFile(path.join(root, 'new.py'), 'utf8')).toBe('valuable')
  })

  it('preserves UTF-16 BOM/CRLF and retains original bytes on atomic save', async () => {
    const original = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('Привет\r\nworld\r\n', 'utf16le')])
    await fs.writeFile(path.join(root, 'hello.txt'), original)
    await fs.chmod(path.join(root, 'hello.txt'), 0o664)
    const doc = await service.open(request('hello.txt'))
    expect(doc).toMatchObject({ encoding: 'utf16le', bom: true, lineEnding: 'CRLF', text: 'Привет\r\nworld\r\n', mode: 'full' })
    const result = await service.save({ id: doc.id, version: doc.version, start: doc.start, end: doc.end, text: 'Привет\r\nedited\r\n' })
    expect(result.status).toBe('saved')
    if (result.status !== 'saved') throw new Error('Expected save')
    expect(await fs.readFile(path.join(root, result.document.backupPath!))).toEqual(original)
    expect(await fs.readFile(path.join(root, 'hello.txt'))).toEqual(Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('Привет\r\nedited\r\n', 'utf16le')]))
    expect((await fs.stat(path.join(root, 'hello.txt'))).mode & 0o777).toBe(0o664)
  })

  it('refuses external changes without overwriting either current bytes or the draft', async () => {
    const filename = path.join(root, 'a.ts'); await fs.writeFile(filename, 'old')
    const doc = await service.open(request('a.ts'))
    await service.storeDraft({ id: doc.id, document: doc, text: 'my edit' })
    await fs.writeFile(filename, 'external edit')
    expect(await service.save({ id: doc.id, version: doc.version, start: doc.start, end: doc.end, text: 'my edit' })).toMatchObject({ status: 'conflict' })
    expect(await fs.readFile(filename, 'utf8')).toBe('external edit')
    expect(await service.loadDraft(request('a.ts'))).toMatchObject({ text: 'my edit', document: { version: doc.version } })
  })

  it('denies traversal, escaped symlinks, swapped roots and binary editing', async () => {
    await expect(service.open(request('../outside'))).rejects.toThrow('relative')
    await fs.symlink(os.tmpdir(), path.join(root, 'outside'))
    await expect(service.open(request('outside'))).rejects.toThrow('outside')
    await fs.writeFile(path.join(root, 'binary'), Buffer.from([0, 1, 2, 3]))
    const doc = await service.open(request('binary'))
    expect(doc.mode).toBe('binary')
    await expect(service.save({ id: doc.id, version: doc.version, start: doc.start, end: doc.end, text: 'x' })).rejects.toThrow('Invalid')
    await fs.unlink(path.join(root, 'binary')); await fs.symlink('/etc/hosts', path.join(root, 'binary'))
    await expect(service.read({ id: doc.id })).rejects.toThrow('outside')
  })

  it('streams an edited window preserving all unseen bytes and UTF-8 boundaries', async () => {
    const original = Buffer.alloc(EDITOR_DEFAULT_BYTES + 4096, 0x61)
    Buffer.from('😀MARKER').copy(original, EDITOR_WINDOW_BYTES - 2)
    const filename = path.join(root, 'huge.log'); await fs.writeFile(filename, original)
    const doc = await service.open(request('huge.log'))
    expect(doc.mode).toBe('window'); expect(doc.end - doc.start).toBeLessThanOrEqual(EDITOR_WINDOW_BYTES)
    expect(doc.text).not.toContain('\ufffd')
    const next = await service.read({ id: doc.id, offset: doc.end })
    expect(next.text.startsWith('😀MARKER')).toBe(true)
    const edited = next.text.replace('MARKER', 'modified')
    const result = await service.save({ id: next.id, version: next.version, start: next.start, end: next.end, text: edited })
    expect(result.status).toBe('saved')
    const actual = await fs.readFile(filename)
    const expected = Buffer.concat([original.subarray(0, next.start), Buffer.from(edited), original.subarray(next.end)])
    // Native byte equality avoids a JS property walk over millions of Buffer indices.
    expect(actual.equals(expected)).toBe(true)
  })

  it('supports bounded search across a chunk boundary and explicit full-load limits', async () => {
    const filename = path.join(root, 'big.txt'); const content = Buffer.alloc(EDITOR_DEFAULT_BYTES + 4096, 0x61)
    Buffer.from('FIND_ME').copy(content, EDITOR_DEFAULT_BYTES - 3); await fs.writeFile(filename, content)
    const doc = await service.open(request('big.txt'))
    expect(await service.search({ id: doc.id, version: doc.version, query: 'FIND_ME', offset: 0 })).toMatchObject({ offset: EDITOR_DEFAULT_BYTES - 3, done: true })
    const full = await service.read({ id: doc.id, full: true }); expect(full.mode).toBe('full'); expect(full.text.length).toBe(content.length)
    const handle = await fs.open(filename, 'r+'); await handle.truncate(EDITOR_FULL_BYTES + 1); await handle.close()
    await expect(service.read({ id: doc.id, full: true })).rejects.toThrow('64 MiB')
  })

  it('recovers draft after session close and detects stale draft on save', async () => {
    await fs.writeFile(path.join(root, 'draft.md'), 'disk')
    const doc = await service.open(request('draft.md'))
    await service.storeDraft({ id: doc.id, document: doc, text: 'unsent changes' }); service.close({ id: doc.id })
    const draft = await service.loadDraft(request('draft.md')); expect(draft?.text).toBe('unsent changes')
    await fs.writeFile(path.join(root, 'draft.md'), 'new disk')
    const reopened = await service.open(request('draft.md'))
    expect(await service.save({ id: reopened.id, version: doc.version, start: doc.start, end: doc.end, text: draft!.text })).toMatchObject({ status: 'conflict' })
    expect(await fs.readFile(path.join(root, 'draft.md'), 'utf8')).toBe('new disk')
  })
})
