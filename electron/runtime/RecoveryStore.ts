import fs from 'node:fs'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { assertPrivateFile, ensurePrivateDirectory } from './privateStorage'
import { withRecoveryWriteLock } from './RecoveryWriteLock'

export interface RecoveryBackup { id: string; bytes: number; savedAt: number }
export interface RecoveryInspection {
  state: 'missing' | 'valid' | 'corrupt'
  fingerprint: string | null
  backups: RecoveryBackup[]
  invalidBackups: number
}
export interface RecoveryStoreOptions<T> {
  /** Main-process owned path, never a renderer-provided arbitrary filename. */
  filename: string
  validate: (value: unknown) => asserts value is T
  maxBytes?: number
  retainedBackups?: number
}
export class RecoveryRequiredError extends Error {
  readonly code = 'RECOVERY_REQUIRED'
  constructor(readonly inspection: RecoveryInspection) {
    super('Saved data is damaged. Inspect and explicitly restore a validated backup; the original file has been preserved.')
    this.name = 'RecoveryRequiredError'
  }
}

const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
const backupPattern = /^[a-f0-9]{64}$/

/**
 * Atomic metadata with bounded, schema-checked revisions and explicit recovery.
 * The caller supplies the exact domain validator, including task/project identity.
 * This is not a filesystem sandbox against a hostile process running as this user.
 */
export class RecoveryStore<T> {
  readonly filename: string
  private readonly directory: string
  private readonly maxBytes: number
  private readonly retainedBackups: number
  constructor(private readonly options: RecoveryStoreOptions<T>) {
    if (!path.isAbsolute(options.filename)) throw new Error('Recovery storage requires an absolute backend-owned path')
    this.filename = path.resolve(options.filename)
    this.directory = `${this.filename}.recovery`
    this.maxBytes = options.maxBytes ?? 16 * 1024 * 1024
    this.retainedBackups = options.retainedBackups ?? 8
    if (!Number.isSafeInteger(this.maxBytes) || this.maxBytes < 1 || !Number.isSafeInteger(this.retainedBackups) || this.retainedBackups < 1 || this.retainedBackups > 100) throw new Error('Invalid recovery storage limits')
  }

  private bytes(file: string): Buffer | null {
    assertPrivateFile(file)
    let fd: number
    try { fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW) }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error }
    try {
      if (fs.fstatSync(fd).size > this.maxBytes) throw new Error('Saved metadata exceeds its configured size limit')
      const bytes = fs.readFileSync(fd)
      if (bytes.length > this.maxBytes) throw new Error('Saved metadata exceeds its configured size limit')
      return bytes
    } finally { fs.closeSync(fd) }
  }
  private parse(bytes: Buffer): T {
    const value: unknown = JSON.parse(bytes.toString('utf8'))
    this.options.validate(value)
    return value
  }
  private syncDirectory(directory: string): void {
    const fd = fs.openSync(directory, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW)
    try { fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
  }
  private publish(file: string, bytes: Buffer, replace: boolean): void {
    assertPrivateFile(file)
    const temporary = `${file}.${randomUUID()}.tmp`
    const fd = fs.openSync(temporary, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600)
    try {
      try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
      assertPrivateFile(file)
      if (replace) fs.renameSync(temporary, file)
      else fs.linkSync(temporary, file)
      this.syncDirectory(path.dirname(file))
    } finally { fs.rmSync(temporary, { force: true }) }
  }
  private preserve(bytes: Buffer, suffix: 'json' | 'damaged'): string {
    ensurePrivateDirectory(this.directory)
    const id = digest(bytes)
    const file = path.join(this.directory, `${id}.${suffix}`)
    const previous = this.bytes(file)
    if (previous) {
      if (!previous.equals(bytes)) throw new Error('Recovery archive does not match its content identity')
    } else this.publish(file, bytes, false)
    return id
  }
  private locked<R>(operation: () => R): R {
    return withRecoveryWriteLock(this.directory, operation)
  }
  private backups(): { valid: RecoveryBackup[]; invalid: number } {
    try {
      const stat = fs.lstatSync(this.directory)
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Unsafe recovery storage directory')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { valid: [], invalid: 0 }
      throw error
    }
    const valid: RecoveryBackup[] = []
    let invalid = 0
    for (const name of fs.readdirSync(this.directory)) {
      const id = name.replace(/\.json$/, '')
      if (!name.endsWith('.json') || !backupPattern.test(id)) continue
      const file = path.join(this.directory, name)
      // Unsafe paths and I/O errors are not corrupt JSON and must fail closed.
      const bytes = this.bytes(file)
      if (!bytes) continue
      try {
        if (digest(bytes) !== id) throw new Error('Backup content identity differs')
        this.parse(bytes)
      } catch { invalid++; continue }
      valid.push({ id, bytes: bytes.length, savedAt: fs.statSync(file).mtimeMs })
    }
    valid.sort((a, b) => b.savedAt - a.savedAt || a.id.localeCompare(b.id))
    return { valid, invalid }
  }
  private inspection(bytes: Buffer | null): RecoveryInspection {
    const backups = this.backups()
    let state: RecoveryInspection['state'] = bytes === null ? 'missing' : 'valid'
    if (bytes !== null) { try { this.parse(bytes) } catch { state = 'corrupt' } }
    return { state, fingerprint: bytes === null ? null : digest(bytes), backups: backups.valid, invalidBackups: backups.invalid }
  }
  inspect(): RecoveryInspection { return this.inspection(this.bytes(this.filename)) }

  /** Null means genuinely absent. Damage never produces defaults or an empty array. */
  read(): T | null {
    const bytes = this.bytes(this.filename)
    if (bytes === null) return null
    try { return this.parse(bytes) }
    catch { throw new RecoveryRequiredError(this.inspection(bytes)) }
  }

  /** expectedFingerprint is an optional compare-and-swap guard for reviewed edits. */
  write(value: T, expectedFingerprint?: string | null): void {
    this.options.validate(value)
    const serialized = Buffer.from(JSON.stringify(value), 'utf8')
    if (serialized.length > this.maxBytes) throw new Error('Saved metadata exceeds its configured size limit')
    this.parse(serialized)
    this.locked(() => {
      const previous = this.bytes(this.filename)
      if (expectedFingerprint !== undefined && (previous === null ? null : digest(previous)) !== expectedFingerprint) throw new Error('Saved data changed. Inspect the current revision before retrying.')
      if (previous !== null) {
        try { this.parse(previous) } catch { throw new RecoveryRequiredError(this.inspection(previous)) }
        this.preserve(previous, 'json')
      }
      this.publish(this.filename, serialized, true)
      this.preserve(serialized, 'json')
      const backups = this.backups().valid
      const currentId = digest(serialized)
      // Keep the current revision even if the clock moves backwards.
      const retained = new Set([currentId, ...backups.filter(item => item.id !== currentId).slice(0, this.retainedBackups - 1).map(item => item.id)])
      for (const backup of backups) if (!retained.has(backup.id)) fs.unlinkSync(path.join(this.directory, `${backup.id}.json`))
      this.syncDirectory(this.directory)
    })
  }

  restore(request: { expectedFingerprint: string; backupId: string }): { fingerprint: string; preservedFingerprint: string } {
    if (!backupPattern.test(request.backupId) || !backupPattern.test(request.expectedFingerprint)) throw new Error('Invalid recovery identity')
    return this.locked(() => {
      const current = this.bytes(this.filename)
      if (!current || digest(current) !== request.expectedFingerprint) throw new Error('Damaged data changed. Inspect again before restoring.')
      const inspection = this.inspection(current)
      if (inspection.state !== 'corrupt') throw new Error('Only damaged data can be restored through recovery')
      if (!inspection.backups.some(backup => backup.id === request.backupId)) throw new Error('This backup does not pass the current document validation')
      const selected = this.bytes(path.join(this.directory, `${request.backupId}.json`))
      if (!selected || digest(selected) !== request.backupId) throw new Error('The selected backup changed')
      this.parse(selected)
      const preservedFingerprint = this.preserve(current, 'damaged')
      this.publish(this.filename, selected, true)
      return { fingerprint: digest(selected), preservedFingerprint }
    })
  }
}
