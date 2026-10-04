import fs from 'node:fs'
import path from 'node:path'

export interface DiagnosticLogOptions {
  /** A diagnostic log, never a conversation/event-journal destination. */
  filePath: string
  maxBytes?: number
  retainedFiles?: number
  maxEntryBytes?: number
  now?: () => Date
}

const REDACTED = '[REDACTED]'

/** Best-effort credential filtering. Callers must omit prompts and provider output. */
export function redactDiagnosticText(value: string): string {
  return value
    .replace(/-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----[\s\S]*?(?:-----END (?:[A-Z ]+ )?PRIVATE KEY-----|$)/g, REDACTED)
    .replace(/\b(Bearer|Basic)\s+[A-Za-z\d+/_=.-]+/gi, `$1 ${REDACTED}`)
    .replace(/(\b(?:authorization|proxy-authorization|cookie|set-cookie)\s*:\s*)[^\r\n]+/gi, `$1${REDACTED}`)
    .replace(/(["']?\b(?:[a-z\d_-]*api[_-]?key|[a-z\d_-]*access[_-]?token|[a-z\d_-]*refresh[_-]?token|[a-z\d_-]*auth[_-]?token|client[_-]?secret|password|passwd|secret)\b["']?\s*[:=]\s*)(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\s,;&}]+)/gi, `$1${REDACTED}`)
    .replace(/\b(?:sk-(?:ant-)?[A-Za-z\d_-]{8,}|gh[pousr]_[A-Za-z\d_]{12,}|github_pat_[A-Za-z\d_]{12,}|AIza[A-Za-z\d_-]{20,}|xox[baprs]-[A-Za-z\d-]{10,})\b/g, REDACTED)
    .replace(/\beyJ[A-Za-z\d_-]+\.[A-Za-z\d_-]+\.[A-Za-z\d_-]+\b/g, REDACTED)
    .replace(/(https?:\/\/)[^\s/@:]+:[^\s/@]+@/gi, `$1${REDACTED}@`)
    .replace(/([?&](?:token|key|api_key|access_token|refresh_token|password|secret)=)[^&#\s]*/gi, `$1${REDACTED}`)
}

function boundedText(value: string, maxBytes: number): string {
  const bytes = Buffer.from(value, 'utf8')
  if (bytes.length <= maxBytes) return value
  const suffix = ' [truncated]'
  return bytes.subarray(0, Math.max(0, maxBytes - Buffer.byteLength(suffix)))
    .toString('utf8').replace(/\uFFFD$/, '') + suffix
}

/** Every entry occupies exactly one line; terminal controls cannot spoof receipts. */
export function formatDiagnosticText(message: string, maxBytes = 8192): string {
  const printable = message
    // CSI / OSC sequences emitted by CLIs have no diagnostic value here.
    // eslint-disable-next-line no-control-regex -- deliberately remove terminal escape sequences
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07]*(?:\x07|\x1b\\)/g, '')
    // eslint-disable-next-line no-control-regex -- deliberately remove nonprinting controls
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')
  // Normalize first: terminal styling can split a credential name or value.
  return boundedText(redactDiagnosticText(printable).replace(/\r/g, '\\r').replace(/\n/g, '\\n'), maxBytes)
}

export class DiagnosticLog {
  private readonly maxBytes: number
  private readonly retainedFiles: number
  private readonly maxEntryBytes: number

  constructor(private readonly options: DiagnosticLogOptions) {
    this.maxBytes = Math.max(256, options.maxBytes ?? 512 * 1024)
    this.retainedFiles = Math.max(0, Math.min(10, Math.floor(options.retainedFiles ?? 3)))
    this.maxEntryBytes = Math.max(64, Math.min(options.maxEntryBytes ?? 8192, this.maxBytes))
  }

  /** Returns the same sanitized entry that callers may print to a console. */
  append(message: string, source: 'Main' | 'Renderer' | 'Critical' = 'Main'): string {
    const prefix = `[${(this.options.now?.() ?? new Date()).toISOString()}] [${source}] `
    const safeText = formatDiagnosticText(message, this.maxEntryBytes - Buffer.byteLength(prefix) - 1)
    const line = `${prefix}${safeText}\n`
    const file = this.options.filePath
    fs.mkdirSync(path.dirname(file), { recursive: true })
    // Older versions wrote 0644 logs. Restrict both the current file and retained
    // archives before a rename can carry their old permissions into a new slot.
    for (let i = 0; i <= this.retainedFiles; i++) this.restrictExistingFile(i === 0 ? file : `${file}.${i}`)
    let size = 0
    try {
      const stat = fs.lstatSync(file)
      if (!stat.isFile()) throw new Error('Diagnostic destination must be a regular file')
      size = stat.size
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
    if (size + Buffer.byteLength(line) > this.maxBytes) this.rotate()
    const fd = fs.openSync(file, fs.constants.O_WRONLY | fs.constants.O_APPEND | fs.constants.O_CREAT | fs.constants.O_NOFOLLOW, 0o600)
    try {
      fs.fchmodSync(fd, 0o600)
      fs.writeSync(fd, line)
    } finally {
      fs.closeSync(fd)
    }
    return safeText
  }

  private restrictExistingFile(file: string): void {
    let fd: number | undefined
    try {
      if (!fs.lstatSync(file).isFile()) throw new Error('Diagnostic destination must be a regular file')
      fd = fs.openSync(file, fs.constants.O_RDWR | fs.constants.O_NOFOLLOW)
      const stat = fs.fstatSync(fd)
      if (!stat.isFile()) throw new Error('Diagnostic destination must be a regular file')
      fs.fchmodSync(fd, 0o600)
      if (stat.size > this.maxBytes) {
        // Upgrade from the former unbounded writer: retain only complete recent
        // lines, without reading an arbitrarily large historical file into RAM.
        const tail = Buffer.alloc(this.maxBytes)
        const read = fs.readSync(fd, tail, 0, tail.length, stat.size - tail.length)
        const firstNewline = tail.subarray(0, read).indexOf(0x0a)
        const retained = firstNewline < 0 ? Buffer.alloc(0) : tail.subarray(firstNewline + 1, read)
        fs.ftruncateSync(fd, 0)
        if (retained.length) fs.writeSync(fd, retained, 0, retained.length, 0)
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    } finally {
      if (fd !== undefined) fs.closeSync(fd)
    }
  }

  private rotate(): void {
    const file = this.options.filePath
    if (this.retainedFiles === 0) {
      fs.rmSync(file, { force: true })
      return
    }
    fs.rmSync(`${file}.${this.retainedFiles}`, { force: true })
    for (let i = this.retainedFiles - 1; i >= 1; i--) {
      if (fs.existsSync(`${file}.${i}`)) fs.renameSync(`${file}.${i}`, `${file}.${i + 1}`)
    }
    if (fs.existsSync(file)) fs.renameSync(file, `${file}.1`)
  }
}
