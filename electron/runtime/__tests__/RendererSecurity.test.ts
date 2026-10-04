import { afterEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { assertTrustedSender, canonicalChildDirectory, isAllowedExternalUrl, isTrustedRendererUrl } from '../RendererSecurity'

const directories: string[] = []
afterEach(() => directories.splice(0).forEach(dir => fs.rmSync(dir, { recursive: true, force: true })))

describe('renderer security boundary', () => {
  const renderer = '/tmp/a project/dist/index.html'
  const url = pathToFileURL(renderer).href
  it('accepts only the application document or exact configured development origin and path', () => {
    expect(isTrustedRendererUrl(`${url}#task`, renderer)).toBe(true)
    for (const other of ['https://example.com', 'file:///tmp/other.html', 'file://host/tmp/a%20project/dist/index.html', 'about:blank']) {
      expect(isTrustedRendererUrl(other, renderer)).toBe(false)
    }
    expect(isTrustedRendererUrl('http://localhost:5173/#task', renderer, 'http://localhost:5173/')).toBe(true)
    for (const other of ['http://localhost:5174/', 'http://localhost:5173/other', 'https://localhost:5173/', 'http://user@localhost:5173/']) {
      expect(isTrustedRendererUrl(other, renderer, 'http://localhost:5173/')).toBe(false)
    }
  })
  it('rejects another webContents, subframe and remotely navigated main document', () => {
    const frame = {}
    const windowContents = { mainFrame: frame }
    expect(() => assertTrustedSender({ sender: windowContents, senderFrame: frame }, windowContents, url, renderer)).not.toThrow()
    expect(() => assertTrustedSender({ sender: {}, senderFrame: frame }, windowContents, url, renderer)).toThrow()
    expect(() => assertTrustedSender({ sender: windowContents, senderFrame: {} }, windowContents, url, renderer)).toThrow()
    expect(() => assertTrustedSender({ sender: windowContents, senderFrame: frame }, windowContents, 'https://example.com', renderer)).toThrow()
  })
  it('refuses arbitrary external protocols and credential-bearing URLs', () => {
    for (const value of ['file:///etc/passwd', 'javascript:alert(1)', 'data:text/html,test', 'vscode://open', 'https://u:p@example.com', 'https://example.com\n']) {
      expect(isAllowedExternalUrl(value)).toBe(false)
    }
    expect(isAllowedExternalUrl('https://example.com/a?q=b')).toBe(true)
    expect(isAllowedExternalUrl('mailto:hello@example.com')).toBe(true)
  })
  it('rejects sibling prefix matches, traversal, project root and symlink escape', () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'ziaf-boundary-'))
    directories.push(base)
    const project = path.join(base, 'project')
    const sibling = path.join(base, 'project-other')
    fs.mkdirSync(path.join(project, 'worktrees', 'task'), { recursive: true })
    fs.mkdirSync(sibling)
    fs.symlinkSync(sibling, path.join(project, 'outside'))
    expect(canonicalChildDirectory(project, path.join(project, 'worktrees', 'task'))).toBe(fs.realpathSync(path.join(project, 'worktrees', 'task')))
    for (const candidate of [project, sibling, path.join(project, '..', 'project-other'), path.join(project, 'outside')]) {
      expect(() => canonicalChildDirectory(project, candidate)).toThrow()
    }
  })
})
