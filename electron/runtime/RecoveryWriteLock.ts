import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { assertPrivateFile, ensurePrivateDirectory } from './privateStorage'
import { syncDirectory } from './syncDirectory'

interface Owner {
  generation: number
  pid: number
  token: string
  host: string
  birth?: string
  state: 'held' | 'released'
}
const pattern = /^(\d{16})\.json$/
const finished = new Map<string, string>()
let ownBirth: string | undefined
let birthRead = false

function birth(pid: number): string | undefined {
  if (process.platform === 'win32') return undefined
  try {
    return execFileSync('/bin/ps', ['-p', String(pid), '-o', 'lstart='], {
      encoding: 'utf8', timeout: 1000, maxBuffer: 1024, stdio: ['ignore', 'pipe', 'ignore'],
      env: { ...process.env, LC_ALL: 'C', TZ: 'UTC' },
    }).trim() || undefined
  } catch { return undefined }
}
function sync(directory: string): void {
  syncDirectory(directory)
}
function publish(file: string, owner: Owner, replace: boolean): void {
  assertPrivateFile(file)
  const temporary = `${file}.${owner.token}.tmp`
  const fd = fs.openSync(temporary, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600)
  try {
    try { fs.writeFileSync(fd, JSON.stringify(owner)); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
    if (replace) fs.renameSync(temporary, file)
    else fs.linkSync(temporary, file)
    sync(path.dirname(file))
  } finally { fs.rmSync(temporary, { force: true }) }
}
function record(file: string, generation: number): Owner {
  assertPrivateFile(file)
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW)
  let raw: unknown
  try {
    if (fs.fstatSync(fd).size > 4096) throw new Error('Invalid recovery lock owner')
    raw = JSON.parse(fs.readFileSync(fd, 'utf8'))
  } finally { fs.closeSync(fd) }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid recovery lock owner')
  const value = raw as Record<string, unknown>
  if (value.generation !== generation || !Number.isSafeInteger(value.pid) || Number(value.pid) < 1 || typeof value.token !== 'string' || !/^[a-f0-9-]{36}$/.test(value.token) || typeof value.host !== 'string' || !value.host || (value.birth !== undefined && typeof value.birth !== 'string') || !['held', 'released'].includes(String(value.state))) throw new Error('Invalid recovery lock owner')
  return value as unknown as Owner
}
function generations(directory: string): number[] {
  return fs.readdirSync(directory).filter(name => pattern.test(name)).map(name => {
    const value = Number(name.slice(0, 16))
    if (!Number.isSafeInteger(value) || value < 1) throw new Error('Invalid recovery lock generation')
    return value
  }).sort((a, b) => a - b)
}
function mayAdvance(directory: string, owner: Owner): boolean {
  if (owner.state === 'released' || finished.get(directory) === owner.token) return true
  if (owner.host !== os.hostname()) return false
  try { process.kill(owner.pid, 0) }
  catch (error) { return (error as NodeJS.ErrnoException).code === 'ESRCH' }
  // PID reuse is not ownership; unavailable process identity always fails closed.
  const currentBirth = owner.birth ? birth(owner.pid) : undefined
  return Boolean(owner.birth && currentBirth && owner.birth !== currentBirth)
}

/**
 * Every takeover publishes the next generation; it never unlinks a stale lock.
 * Two reclaimers therefore contend on the same exclusive hard-link operation.
 * Released old generations can be pruned without ever removing the latest one.
 */
export function withRecoveryWriteLock<T>(recoveryDirectory: string, operation: () => T): T {
  ensurePrivateDirectory(recoveryDirectory)
  // Pre-release ownerless directory locks cannot prove that a writer is absent.
  if (fs.existsSync(path.join(recoveryDirectory, 'write.lock'))) throw new Error('Unknown legacy recovery lock owner; close older app instances before inspecting this lock')
  const directory = path.join(recoveryDirectory, 'write-locks')
  ensurePrivateDirectory(directory)
  if (!birthRead) { ownBirth = birth(process.pid); birthRead = true }
  const filename = (generation: number) => path.join(directory, `${String(generation).padStart(16, '0')}.json`)
  for (let attempt = 0; attempt < 16; attempt++) {
    const previous = generations(directory).at(-1) ?? 0
    if (previous) {
      let owner: Owner
      try { owner = record(filename(previous), previous) }
      catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue; throw error }
      if (!mayAdvance(directory, owner)) throw new Error('Saved data is being written by another active or unverified owner. Retry after that writer finishes.')
    }
    if (previous === Number.MAX_SAFE_INTEGER) throw new Error('Recovery lock generation exhausted')
    const owner: Owner = { generation: previous + 1, pid: process.pid, token: randomUUID(), host: os.hostname(), birth: ownBirth, state: 'held' }
    const file = filename(owner.generation)
    try {
      publish(file, owner, false)
      // A delayed contender may publish an already-pruned older generation. It
      // must never enter the operation or replace that old path during cleanup.
      if (generations(directory).at(-1) !== owner.generation) continue
      if (record(file, owner.generation).token !== owner.token) continue
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') continue
      // Publication can fail after its hard link (for example directory fsync).
      // This process knows no protected operation started under its token.
      finished.set(directory, owner.token)
      throw error
    }
    finished.delete(directory)
    const release = () => {
      // A failed release write is known finished in this process; after a crash
      // liveness/birth verification establishes the same fact for the next app.
      finished.set(directory, owner.token)
      const current = record(file, owner.generation)
      if (current.token !== owner.token) throw new Error('Recovery lock ownership changed')
      publish(file, { ...owner, state: 'released' }, true)
      finished.delete(directory)
      // Snapshot only; never delete newly created generations from another writer.
      for (const old of generations(directory).filter(value => value < owner.generation - 7)) {
        const oldFile = filename(old)
        assertPrivateFile(oldFile)
        try { fs.unlinkSync(oldFile) } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
      }
      sync(directory)
    }
    try { return operation() }
    finally { release() }
  }
  throw new Error('Saved data is busy. Retry after the current writer finishes.')
}
