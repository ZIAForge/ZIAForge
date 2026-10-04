import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ApiFileTools } from '../ApiFileTools'
const roots: string[] = []
function fixture(readOnly = false) { const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ziaf-api-files-'))); roots.push(root); const cwd = path.join(root, 'workspace'); fs.mkdirSync(cwd); return { root, cwd, tools: new ApiFileTools(cwd, readOnly) } }
afterEach(() => roots.splice(0).forEach(root => fs.rmSync(root, { recursive: true, force: true })))
describe('bounded native API file tools', () => {
  it('writes only the exact reviewed revision and preserves concurrent edits', () => {
    const { cwd, tools } = fixture(); const file = path.join(cwd, 'file.txt'); fs.writeFileSync(file, 'before')
    const read = tools.execute('read_file', { path: 'file.txt' }) as { sha256: string }
    fs.writeFileSync(file, 'concurrent user edit')
    expect(() => tools.execute('write_file', { path: 'file.txt', content: 'must not overwrite', expectedSha256: read.sha256 })).toThrow('changed')
    expect(fs.readFileSync(file, 'utf8')).toBe('concurrent user edit')
    expect(tools.execute('write_file', { path: 'new.txt', content: 'new', expectedSha256: null })).toMatchObject({ bytes: 3 })
  })
  it('rejects injected writes for a reviewer, path traversal, git internals, symlinks and hardlinks', () => {
    const { root, cwd, tools } = fixture(true); const outside = path.join(root, 'outside.txt'); fs.writeFileSync(outside, 'outside untouched')
    fs.symlinkSync(outside, path.join(cwd, 'link')); fs.linkSync(outside, path.join(cwd, 'hardlink'))
    expect(() => tools.execute('write_file', { path: 'new.txt', content: 'x', expectedSha256: null })).toThrow('Read-only')
    for (const relative of ['../outside.txt', outside, '.git/config', '.GIT/config', 'link', 'hardlink']) expect(() => tools.execute('read_file', { path: relative })).toThrow()
    expect(fs.readFileSync(outside, 'utf8')).toBe('outside untouched')
  })
  it('bounds text reads and literal search and excludes binary files', () => {
    const { cwd, tools } = fixture(); fs.writeFileSync(path.join(cwd, 'a.txt'), 'alpha\nbeta alpha\n'); fs.writeFileSync(path.join(cwd, 'binary'), Buffer.from([0, 1])); fs.writeFileSync(path.join(cwd, 'large'), 'x'.repeat(256 * 1024 + 1))
    expect(tools.execute('search_text', { path: '.', query: 'alpha' })).toMatchObject({ matches: [{ path: 'a.txt', line: 1 }, { path: 'a.txt', line: 2 }] })
    expect(() => tools.execute('read_file', { path: 'binary' })).toThrow('UTF-8')
    expect(() => tools.execute('read_file', { path: 'large' })).toThrow('256 KiB')
    expect(() => tools.execute('terminal', { path: '.' })).toThrow('Unknown')
  })
})
