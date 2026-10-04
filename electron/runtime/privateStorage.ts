import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

/** Private, application-owned storage. Never follow a symlink supplied in its path. */
export function ensurePrivateDirectory(directory: string): void {
  const absolute = path.resolve(directory)
  let current = path.parse(absolute).root
  for (const component of absolute.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, component)
    try {
      const stat = fs.lstatSync(current)
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('Unsafe session storage directory')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      fs.mkdirSync(current, { mode: 0o700 })
    }
  }
}

export function assertPrivateFile(file: string): void {
  ensurePrivateDirectory(path.dirname(file))
  try {
    const stat = fs.lstatSync(file)
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('Unsafe session storage file')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
}

export async function writePrivateMetadata(file: string, data: unknown): Promise<void> {
  assertPrivateFile(file)
  const serialized = JSON.stringify(data)
  const temporary = `${file}.${randomUUID()}.tmp`
  let created = false
  try {
    const handle = await fs.promises.open(temporary, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600)
    created = true
    try {
      await handle.writeFile(serialized, 'utf8')
      await handle.sync()
    } finally { await handle.close() }
    assertPrivateFile(file)
    // Hard-link publication is atomic and refuses an existing destination, unlike rename.
    // A crash can leave a private temporary file, but never a partial session.json.
    await fs.promises.link(temporary, file)
    const directory = await fs.promises.open(path.dirname(file), fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW)
    try { await directory.sync() } finally { await directory.close() }
  } finally {
    if (created) await fs.promises.unlink(temporary).catch(error => {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    })
  }
}

export async function readPrivateMetadata(file: string): Promise<unknown> {
  assertPrivateFile(file)
  const handle = await fs.promises.open(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW)
  try { return JSON.parse(await handle.readFile('utf8')) as unknown } finally { await handle.close() }
}

/** Atomic replacement for an already validated mutable state document. */
export async function replacePrivateMetadata(file: string, data: unknown): Promise<void> {
  assertPrivateFile(file)
  const temporary = `${file}.${randomUUID()}.tmp`
  const handle = await fs.promises.open(temporary, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600)
  try {
    try { await handle.writeFile(JSON.stringify(data), 'utf8'); await handle.sync() } finally { await handle.close() }
    assertPrivateFile(file)
    await fs.promises.rename(temporary, file)
    const directory = await fs.promises.open(path.dirname(file), fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW)
    try { await directory.sync() } finally { await directory.close() }
  } finally { await fs.promises.rm(temporary, { force: true }) }
}
