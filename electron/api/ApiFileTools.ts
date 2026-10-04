import fs from 'node:fs'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { isWithin } from '../runtime/ProjectAccess'

const sha = (content: Buffer | string) => createHash('sha256').update(content).digest('hex')
const MAX_FILE = 256 * 1024
export const API_READ_TOOLS = [
  { type: 'function', function: { name: 'read_file', description: 'Read a UTF-8 workspace file and its SHA-256 for safe subsequent edits.', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'], additionalProperties: false } } },
  { type: 'function', function: { name: 'list_files', description: 'List a workspace directory without following links.', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'], additionalProperties: false } } },
  { type: 'function', function: { name: 'search_text', description: 'Bounded literal text search in workspace files.', parameters: { type: 'object', properties: { path: { type: 'string' }, query: { type: 'string' } }, required: ['path', 'query'], additionalProperties: false } } },
]
export const API_WRITE_TOOL = { type: 'function', function: { name: 'write_file', description: 'Write a UTF-8 workspace file after explicit user permission. Supply the SHA-256 from read_file, or null for a new file. Parent directory must exist.', parameters: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' }, expectedSha256: { type: ['string', 'null'] } }, required: ['path', 'content', 'expectedSha256'], additionalProperties: false } } }

/** Bounded workspace access, without a shell or external executable. */
export class ApiFileTools {
  constructor(private readonly cwd: string, private readonly readOnly: boolean) {
    if (!path.isAbsolute(cwd) || fs.realpathSync(cwd) !== cwd || !fs.lstatSync(cwd).isDirectory()) throw new Error('API worktree must be canonical')
  }
  private target(relative: unknown, allowDirectory = false): string {
    if (typeof relative !== 'string' || relative.length > 2000 || relative.includes('\0') || path.isAbsolute(relative) || relative.split(/[\\/]/).some(part => part === '..' || ['.git', '.ssh', '.aws'].includes(part.toLowerCase()))) throw new Error('Tool path must stay inside the workspace')
    const target = path.resolve(this.cwd, relative)
    if (!isWithin(this.cwd, target, allowDirectory)) throw new Error('Tool path must stay inside the workspace')
    let current = this.cwd
    for (const component of path.relative(this.cwd, target).split(path.sep).filter(Boolean)) {
      current = path.join(current, component)
      try { const stat = fs.lstatSync(current); if (stat.isSymbolicLink() || (!stat.isDirectory() && (!stat.isFile() || stat.nlink !== 1))) throw new Error('Tool access to links or special files is disabled') }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; if (current !== target) throw new Error('Tool parent directory does not exist') }
    }
    if (fs.realpathSync(this.cwd) !== this.cwd) throw new Error('Workspace ownership changed')
    return target
  }
  private read(file: string): Buffer {
    const handle = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW)
    try {
      const stat = fs.fstatSync(handle)
      if (!stat.isFile() || stat.nlink !== 1 || stat.size > MAX_FILE) throw new Error('File is not a regular file or exceeds the 256 KiB tool limit')
      const buffer = Buffer.alloc(MAX_FILE + 1)
      let size = 0, count = 0
      do { count = fs.readSync(handle, buffer, size, buffer.length - size, null); size += count } while (count && size < buffer.length)
      const data = buffer.subarray(0, size)
      if (data.length > MAX_FILE || data.includes(0)) throw new Error('Only bounded UTF-8 text files are supported')
      return data
    } finally { fs.closeSync(handle) }
  }
  private children(directory: string, limit: number): { entries: fs.Dirent[]; truncated: boolean } {
    const handle = fs.opendirSync(directory), entries: fs.Dirent[] = []
    try {
      let entry: fs.Dirent | null
      while ((entry = handle.readSync())) {
        if (['.git', '.ssh', '.aws'].includes(entry.name.toLowerCase())) continue
        if (entries.length === limit) return { entries, truncated: true }
        entries.push(entry)
      }
      return { entries, truncated: false }
    } finally { handle.closeSync() }
  }
  validate(name: string, input: unknown): Record<string, unknown> {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid tool arguments')
    const args = input as Record<string, unknown>
    const keys = name === 'write_file' ? ['path', 'content', 'expectedSha256'] : name === 'search_text' ? ['path', 'query'] : ['path']
    if (![...API_READ_TOOLS.map(tool => tool.function.name), 'write_file'].includes(name) || Object.keys(args).some(key => !keys.includes(key)) || keys.some(key => !(key in args))) throw new Error('Unknown tool or arguments')
    this.target(args.path, name === 'list_files' || name === 'search_text')
    if (name === 'write_file') {
      if (this.readOnly) throw new Error('Read-only policy forbids file writes')
      if (typeof args.content !== 'string' || Buffer.byteLength(args.content) > MAX_FILE || args.content.includes('\0') || !(args.expectedSha256 === null || typeof args.expectedSha256 === 'string' && /^[a-f0-9]{64}$/.test(args.expectedSha256))) throw new Error('Invalid file write content or expected revision')
    }
    if (name === 'search_text' && (typeof args.query !== 'string' || !args.query.length || args.query.length > 1000)) throw new Error('Search requires a bounded nonempty literal query')
    return args
  }
  execute(name: string, input: unknown): unknown {
    const args = this.validate(name, input), file = this.target(args.path, name === 'list_files' || name === 'search_text')
    if (name === 'read_file') { const data = this.read(file); return { content: data.toString('utf8'), sha256: sha(data) } }
    if (name === 'list_files') {
      const { entries, truncated } = this.children(file, 1000)
      return { entries: entries.map(item => ({ name: item.name, type: item.isSymbolicLink() ? 'link (unavailable)' : item.isDirectory() ? 'directory' : 'file' })), truncated }
    }
    if (name === 'search_text') {
      const matches: Array<{ path: string; line: number; text: string }> = [], queue = [file]
      let examined = 0, bytes = 0, truncated = false
      while (queue.length && examined < 1000 && bytes < 4 * 1024 * 1024 && matches.length < 100) {
        const next = queue.shift()!; examined++
        try {
          this.target(path.relative(this.cwd, next), true)
          if (fs.lstatSync(next).isDirectory()) { const children = this.children(next, Math.max(0, 1000 - examined - queue.length)); truncated ||= children.truncated; for (const item of children.entries) queue.push(path.join(next, item.name)); continue }
          const content = this.read(next); bytes += content.length
          content.toString('utf8').split('\n').forEach((text, index) => { if (matches.length < 100 && text.includes(args.query as string)) matches.push({ path: path.relative(this.cwd, next), line: index + 1, text: text.slice(0, 2000) }) })
        } catch { /* Inaccessible, linked, excluded, binary and oversized files are not searched. */ }
      }
      return { matches, truncated: truncated || queue.length > 0 || matches.length >= 100 }
    }
    let before: Buffer | undefined
    try { before = this.read(file) } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
    if ((before ? sha(before) : null) !== args.expectedSha256) throw new Error('File changed since it was read; read it again before editing')
    const temporary = path.join(path.dirname(file), `.ziaforge-api-${randomUUID()}.tmp`)
    const handle = fs.openSync(temporary, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY | fs.constants.O_NOFOLLOW, before ? fs.statSync(file).mode & 0o777 : 0o600)
    try {
      fs.writeFileSync(handle, args.content as string); fs.fsyncSync(handle)
      this.target(args.path)
      if ((fs.existsSync(file) ? sha(this.read(file)) : null) !== args.expectedSha256) throw new Error('File changed before the approved edit; its bytes were preserved')
      fs.renameSync(temporary, file)
      return { path: args.path, sha256: sha(args.content as string), bytes: Buffer.byteLength(args.content as string) }
    } finally { fs.closeSync(handle); fs.rmSync(temporary, { force: true }) }
  }
}
