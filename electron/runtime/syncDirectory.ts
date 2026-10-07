import fs from 'node:fs'

/**
 * Flush a published directory entry where Node supports directory descriptors.
 * Windows cannot fsync a directory. Callers still flush each regular file before
 * atomic publication; genuine file errors and POSIX directory errors propagate.
 */
export function syncDirectory(directory: string): void {
  if (process.platform === 'win32') return
  const fd = fs.openSync(directory, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW)
  try { fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
}

export async function syncDirectoryAsync(directory: string): Promise<void> {
  if (process.platform === 'win32') return
  const handle = await fs.promises.open(directory, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW)
  try { await handle.sync() } finally { await handle.close() }
}
