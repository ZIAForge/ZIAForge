import fs from 'node:fs/promises'
import { constants } from 'node:fs'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import type { FileHandle } from 'node:fs/promises'
import { isWithin } from '../runtime/ProjectAccess'
import { EDITOR_DEFAULT_BYTES, EDITOR_FULL_BYTES, EDITOR_WINDOW_BYTES, type EditorDocument, type EditorDraft, type EditorEncoding, type EditorOpenRequest, type EditorReadRequest, type EditorSaveRequest, type EditorSaveResult, type EditorScope, type EditorSearchRequest, type EditorSearchResult } from '../../shared/editor'

interface Session { scope: EditorScope; root: string; rootIdentity: string; filename: string; relativePath: string; version: string; encoding: EditorEncoding; bom: boolean; document?: EditorDocument }
export interface EditorServiceOptions {
  /** Resolve saved backend grants, never a renderer-provided absolute root. */
  resolveRoot(scope: EditorScope): string | Promise<string>
  draftsDirectory: string
}
const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex')
async function readBytes(handle: FileHandle, buffer: Buffer, position: number): Promise<number> {
  let total = 0
  while (total < buffer.length) {
    const { bytesRead } = await handle.read(buffer, total, buffer.length - total, position + total)
    if (!bytesRead) break
    total += bytesRead
  }
  return total
}
function signature(stat: Awaited<ReturnType<FileHandle['stat']>>): string {
  return digest([stat.dev, stat.ino, stat.size, stat.mtimeMs, stat.ctimeMs, stat.mode].join(':'))
}
function validOffset(value: number, max: number): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > max) throw new Error('Invalid file offset')
  return value
}
function decode(bytes: Buffer, encoding: EditorEncoding): string {
  if (encoding === 'binary') return ''
  return new TextDecoder(encoding === 'utf8' ? 'utf-8' : encoding === 'utf16le' ? 'utf-16le' : 'utf-16be', { fatal: true, ignoreBOM: true }).decode(bytes)
}
function encode(text: string, encoding: EditorEncoding): Buffer {
  if (encoding === 'binary') throw new Error('Binary files cannot be edited as text')
  // Prevent silently replacing isolated surrogate code units with U+FFFD.
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    if (code >= 0xd800 && code <= 0xdbff) { const next = text.charCodeAt(++i); if (!(next >= 0xdc00 && next <= 0xdfff)) throw new Error('Text contains an incomplete Unicode character') }
    else if (code >= 0xdc00 && code <= 0xdfff) throw new Error('Text contains an incomplete Unicode character')
  }
  const bytes = Buffer.from(text, encoding === 'utf8' ? 'utf8' : 'utf16le')
  return encoding === 'utf16be' ? bytes.swap16() : bytes
}
function endings(text: string): EditorDocument['lineEnding'] {
  const crlf = text.includes('\r\n'); const rest = text.replaceAll('\r\n', '')
  const kinds = [crlf && 'CRLF', rest.includes('\r') && 'CR', rest.includes('\n') && 'LF'].filter(Boolean)
  return kinds.length > 1 ? 'mixed' : (kinds[0] || 'LF') as EditorDocument['lineEnding']
}

/** Bounded reads; same-directory atomic replacement; no open descriptors survive an IPC call. */
export class EditorService {
  private sessions = new Map<string, Session>()
  private queues = new Map<string, Promise<unknown>>()
  constructor(private readonly options: EditorServiceOptions) {}

  private async serial<T>(key: string, action: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(key) ?? Promise.resolve()
    const current = previous.catch(() => undefined).then(action)
    this.queues.set(key, current)
    try { return await current } finally { if (this.queues.get(key) === current) this.queues.delete(key) }
  }
  private async resolve(request: EditorOpenRequest): Promise<{ root: string; rootIdentity: string; filename: string; relativePath: string }> {
    if (!request || typeof request.repoId !== 'string' || !['task', 'project'].includes(request.scope) || (request.scope === 'task' && typeof request.taskId !== 'string')) throw new Error('A registered task or project is required')
    const relative = request.relativePath
    if (typeof relative !== 'string' || !relative || relative.length > 4096 || path.isAbsolute(relative) || relative.split(/[\\/]/).includes('..') || /[\x00-\x1f]/.test(relative)) throw new Error('Expected a relative file path inside the selected folder') // eslint-disable-line no-control-regex
    const root = await fs.realpath(await this.options.resolveRoot(request))
    const rootStat = await fs.stat(root)
    if (!rootStat.isDirectory()) throw new Error('The registered root is not a folder')
    const rootIdentity = `${rootStat.dev}:${rootStat.ino}`
    const candidate = path.resolve(root, relative)
    if (!isWithin(root, candidate, false)) throw new Error('File is outside the selected folder')
    const filename = await fs.realpath(candidate)
    if (!isWithin(root, filename, false)) throw new Error('Linked file is outside the selected folder')
    return { root, rootIdentity, filename, relativePath: relative }
  }
  private async checked(session: Session): Promise<FileHandle> {
    const current = await this.resolve({ ...session.scope, relativePath: session.relativePath })
    if (current.root !== session.root || current.rootIdentity !== session.rootIdentity || current.filename !== session.filename) throw new Error('The file or registered folder moved. Reopen it before continuing.')
    const handle = await fs.open(current.filename, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)
    try {
      const stat = await handle.stat()
      if (!stat.isFile()) throw new Error('Only regular files are supported')
      // Recheck after opening: a directory may have been replaced while open() awaited.
      const opened = await this.resolve({ ...session.scope, relativePath: session.relativePath })
      const linked = await fs.stat(opened.filename)
      if (opened.root !== session.root || opened.rootIdentity !== session.rootIdentity || opened.filename !== session.filename || linked.ino !== stat.ino || linked.dev !== stat.dev) throw new Error('The file moved while opening. Reopen it before continuing.')
      return handle
    } catch (error) { await handle.close(); throw error }
  }
  private session(id: string): Session {
    const session = this.sessions.get(id)
    if (!session) throw new Error('Editor session expired. Reopen the file.')
    return session
  }
  async create(request: EditorOpenRequest & { text?: string }): Promise<EditorDocument> {
    if (!request || typeof request.repoId !== 'string' || !['task', 'project'].includes(request.scope) || (request.scope === 'task' && typeof request.taskId !== 'string')) throw new Error('A registered task or project is required')
    const relative = request.relativePath
    if (typeof relative !== 'string' || !relative || relative.length > 4096 || path.isAbsolute(relative) || relative.split(/[\\/]/).some(part => part === '..' || !part) || /[\x00-\x1f]/.test(relative)) throw new Error('Expected a relative file path') // eslint-disable-line no-control-regex
    if (request.text !== undefined && (typeof request.text !== 'string' || Buffer.byteLength(request.text) > EDITOR_DEFAULT_BYTES)) throw new Error('Invalid new file text')
    const root = await fs.realpath(await this.options.resolveRoot(request))
    const parent = await fs.realpath(path.dirname(path.join(root, relative)))
    if (!isWithin(root, parent)) throw new Error('Destination is outside the selected folder')
    const filename = path.join(parent, path.basename(relative))
    const handle = await fs.open(filename, 'wx', 0o644)
    try { await handle.writeFile(request.text ?? ''); await handle.sync() } finally { await handle.close() }
    return this.open(request)
  }
  async open(request: EditorOpenRequest): Promise<EditorDocument> {
    const resolved = await this.resolve(request)
    const id = randomUUID()
    const scope = { repoId: request.repoId, taskId: request.taskId, scope: request.scope }
    const session: Session = { ...resolved, scope, version: '', encoding: 'utf8', bom: false }
    this.sessions.set(id, session)
    try { return await this.read({ id, full: request.full }) } catch (error) { this.sessions.delete(id); throw error }
  }
  async read(request: EditorReadRequest): Promise<EditorDocument> {
    const session = this.session(request.id)
    const handle = await this.checked(session)
    try {
      const stat = await handle.stat(); const version = signature(stat)
      const prefix = Buffer.alloc(Math.min(stat.size, 8192)); await readBytes(handle, prefix, 0)
      const encoding: EditorEncoding = prefix[0] === 0xff && prefix[1] === 0xfe ? 'utf16le' : prefix[0] === 0xfe && prefix[1] === 0xff ? 'utf16be' : prefix.includes(0) ? 'binary' : 'utf8'
      const bom = encoding.startsWith('utf16') || (prefix[0] === 0xef && prefix[1] === 0xbb && prefix[2] === 0xbf)
      const bomLength = bom ? encoding === 'utf8' ? 3 : 2 : 0
      const full = stat.size <= EDITOR_DEFAULT_BYTES || request.full === true
      if (full && stat.size > EDITOR_FULL_BYTES) throw new Error('Full editing is limited to 64 MiB; use fragment editing for this file')
      let start = full ? bomLength : Math.max(bomLength, validOffset(request.offset ?? 0, stat.size))
      if (encoding.startsWith('utf16')) start -= (start - bomLength) % 2
      const bytes = Buffer.alloc(Math.min(stat.size - start, full ? EDITOR_FULL_BYTES : EDITOR_WINDOW_BYTES) + (full ? 0 : Math.min(4, stat.size - start - Math.min(stat.size - start, EDITOR_WINDOW_BYTES))))
      const bytesRead = await readBytes(handle, bytes, start)
      let from = 0; let end = bytesRead
      if (!full && encoding === 'utf8') {
        while (from < Math.min(4, end) && (bytes[from] & 0xc0) === 0x80) from++
        end = Math.min(end, EDITOR_WINDOW_BYTES)
        if (start + end < stat.size) while (end > from && (bytes[end] & 0xc0) === 0x80) end--
      } else if (encoding.startsWith('utf16')) {
        end -= end % 2
        const unit = (at: number) => encoding === 'utf16le' ? bytes.readUInt16LE(at) : bytes.readUInt16BE(at)
        if (!full && end >= 2 && unit(0) >= 0xdc00 && unit(0) <= 0xdfff) from = 2
        if (!full && end >= from + 2 && start + end < stat.size && unit(end - 2) >= 0xd800 && unit(end - 2) <= 0xdbff) end -= 2
      }
      let text = ''; let actualEncoding = encoding; let warning: string | undefined
      try { text = decode(bytes.subarray(from, end), encoding) } catch { actualEncoding = 'binary'; warning = 'This file is not valid UTF-8/UTF-16. Open it in an external editor to preserve its bytes.' }
      if (signature(await handle.stat()) !== version) throw new Error('The file changed while reading. Reload it.')
      session.version = version; session.encoding = actualEncoding; session.bom = bom
      const document: EditorDocument = { id: request.id, relativePath: session.relativePath, size: stat.size, version, encoding: actualEncoding, bom, mode: actualEncoding === 'binary' ? 'binary' : full ? 'full' : 'window', text, start: start + from, end: start + end, canLoadFull: stat.size <= EDITOR_FULL_BYTES, lineEnding: endings(text), warning }
      session.document = document
      return document
    } finally { await handle.close() }
  }
  async save(request: EditorSaveRequest): Promise<EditorSaveResult> {
    const session = this.session(request.id)
    return this.serial(session.filename, async () => {
      const document = session.document
      if (!document || document.encoding === 'binary' || typeof request.text !== 'string' || request.text.length > EDITOR_FULL_BYTES) throw new Error('Invalid editor save')
      if (request.version !== document.version) return { status: 'conflict', message: 'The recovered draft belongs to an earlier disk version. Your text is retained; reload or copy it before retrying.' }
      if (request.start !== document.start || request.end !== document.end) throw new Error('The editor fragment changed. Reopen the original fragment before saving.')
      const replacement = encode(request.text, session.encoding)
      if (replacement.length > EDITOR_FULL_BYTES) throw new Error('Edited fragment exceeds 64 MiB')
      const source = await this.checked(session)
      const temp = path.join(path.dirname(session.filename), `.${path.basename(session.filename)}.ziaforge-${randomUUID()}.tmp`)
      const backup = path.join(path.dirname(session.filename), `.${path.basename(session.filename)}.ziaforge-backup-${randomUUID()}`)
      let output: FileHandle | undefined; let backupCreated = false; let replaced = false
      let originalIdentity: { ino: number; dev: number } | undefined
      try {
        const before = await source.stat()
        originalIdentity = { ino: before.ino, dev: before.dev }
        if (signature(before) !== request.version) return { status: 'conflict', message: 'The file changed on disk. Your edit is retained; reload or copy it before retrying.' }
        if (before.nlink !== 1) throw new Error('Saving a hard-linked file is disabled to avoid changing its link semantics')
        output = await fs.open(temp, 'wx', before.mode & 0o777)
        await output.chmod(before.mode & 0o777) // open() applies umask; restore the original permission bits.
        const buffer = Buffer.alloc(1024 * 1024)
        const copy = async (from: number, to: number) => {
          for (let pos = from; pos < to;) {
            const { bytesRead } = await source.read(buffer, 0, Math.min(buffer.length, to - pos), pos)
            if (!bytesRead) throw new Error('File changed during save')
            await output!.writeFile(buffer.subarray(0, bytesRead)); pos += bytesRead
          }
        }
        await copy(0, request.start); await output.writeFile(replacement); await copy(request.end, before.size)
        await output.sync(); await output.close(); output = undefined
        const current = await this.resolve({ ...session.scope, relativePath: session.relativePath })
        if (current.root !== session.root || current.rootIdentity !== session.rootIdentity || current.filename !== session.filename || signature(await source.stat()) !== request.version || signature(await fs.stat(session.filename)) !== request.version) return { status: 'conflict', message: 'The file changed during save. Your edit is retained and the original was not overwritten.' }
        // Keep the previous inode as a recoverable backup, including writes by external open handles.
        await fs.link(session.filename, backup); backupCreated = true
        if ((await fs.stat(backup)).ino !== before.ino) throw new Error('File identity changed before replacement')
        await fs.rename(temp, session.filename)
        replaced = true
        const parent = await fs.open(path.dirname(session.filename), 'r'); try { await parent.sync() } finally { await parent.close() }
        const updated = await this.read({ id: request.id, offset: request.start, full: document.mode === 'full' })
        updated.backupPath = path.basename(backup)
        await this.storeDraft({ id: request.id, discard: true })
        return { status: 'saved', document: updated }
      } finally {
        await output?.close().catch(() => undefined); await source.close()
        await fs.unlink(temp).catch(() => undefined)
        // Successful backups are retained deliberately; callers display their exact names.
        if (!backupCreated) await fs.unlink(backup).catch(() => undefined)
        else if (!replaced) {
          // A failed rename must not leave our own extra hard link blocking a retry.
          // Retain the backup if the original pathname no longer points to that inode.
          const current = await fs.stat(session.filename).catch(() => undefined)
          if (current?.ino === originalIdentity?.ino && current?.dev === originalIdentity?.dev) await fs.unlink(backup).catch(() => undefined)
        }
      }
    })
  }
  async search(request: EditorSearchRequest): Promise<EditorSearchResult> {
    const session = this.session(request.id)
    if (request.version !== session.version || typeof request.query !== 'string' || !request.query || request.query.length > 4096) throw new Error('Invalid search request')
    const needle = encode(request.query, session.encoding)
    const handle = await this.checked(session)
    try {
      const stat = await handle.stat()
      if (signature(stat) !== request.version) throw new Error('The file changed. Reload before searching.')
      const offset = validOffset(request.offset, stat.size)
      const bytes = Buffer.alloc(Math.min(stat.size - offset, 8 * 1024 * 1024 + needle.length))
      const bytesRead = await readBytes(handle, bytes, offset)
      let found = bytes.subarray(0, bytesRead).indexOf(needle)
      while (found >= 0 && session.encoding.startsWith('utf16') && (offset + found) % 2 !== 0) found = bytes.subarray(0, bytesRead).indexOf(needle, found + 1)
      if (signature(await handle.stat()) !== request.version) throw new Error('The file changed while searching')
      return found >= 0 ? { offset: offset + found, nextOffset: offset + found + needle.length, done: true } : { nextOffset: Math.min(stat.size, offset + Math.max(1, bytesRead - needle.length + 1)), done: offset + bytesRead >= stat.size }
    } finally { await handle.close() }
  }
  private draftPath(session: Pick<Session, 'scope' | 'relativePath'>): string {
    return path.join(this.options.draftsDirectory, digest(JSON.stringify([session.scope.repoId, session.scope.taskId, session.scope.scope, session.relativePath])) + '.json')
  }
  async loadDraft(request: EditorOpenRequest): Promise<EditorDraft | null> {
    await this.resolve(request)
    try {
      const file = this.draftPath({ scope: request, relativePath: request.relativePath })
      const stat = await fs.stat(file)
      if (stat.size > EDITOR_FULL_BYTES * 8) throw new Error('Saved editor draft is oversized')
      const value = JSON.parse(await fs.readFile(file, 'utf8')) as EditorDraft
      if (!value || typeof value.text !== 'string' || value.text.length > EDITOR_FULL_BYTES || !value.document || value.document.relativePath !== request.relativePath || typeof value.document.version !== 'string' || !Number.isSafeInteger(value.document.start) || !Number.isSafeInteger(value.document.end) || value.document.start < 0 || value.document.end < value.document.start || !['full', 'window', 'binary'].includes(value.document.mode) || !['utf8', 'utf16le', 'utf16be', 'binary'].includes(value.document.encoding)) throw new Error('Saved editor draft is invalid; preserve it before reopening')
      return value
    } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error }
  }
  async storeDraft(request: { id: string; document: EditorDocument; text: string } | { id: string; discard: true }): Promise<void> {
    const session = this.session(request.id); const filename = this.draftPath(session)
    await this.serial(filename, async () => {
      if ('discard' in request) { await fs.unlink(filename).catch(error => { if (error.code !== 'ENOENT') throw error }); return }
      if (typeof request.text !== 'string' || request.text.length > EDITOR_FULL_BYTES || request.document.id !== request.id) throw new Error('Invalid editor draft')
      await fs.mkdir(this.options.draftsDirectory, { recursive: true, mode: 0o700 })
      const temporary = `${filename}.${randomUUID()}.tmp`
      try {
        const handle = await fs.open(temporary, 'wx', 0o600)
        try { await handle.writeFile(JSON.stringify({ document: request.document, text: request.text, updatedAt: Date.now() })); await handle.sync() } finally { await handle.close() }
        await fs.rename(temporary, filename)
      } finally { await fs.unlink(temporary).catch(() => undefined) }
    })
  }
  async revealPath(request: EditorScope & { relativePath?: string }): Promise<{ path: string; isFile: boolean }> {
    if (request.relativePath) return { path: (await this.resolve({ ...request, relativePath: request.relativePath })).filename, isFile: true }
    return { path: await fs.realpath(await this.options.resolveRoot(request)), isFile: false }
  }
  close(request: { id: string }): void { this.sessions.delete(request.id) }
}
