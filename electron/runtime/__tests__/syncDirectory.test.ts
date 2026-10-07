import fs from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { syncDirectory, syncDirectoryAsync } from '../syncDirectory'

const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')!
afterEach(() => {
  Object.defineProperty(process, 'platform', originalPlatform)
  vi.restoreAllMocks()
})

describe('portable directory flushing', () => {
  it('does not try to open a directory on Windows, synchronously or asynchronously', async () => {
    Object.defineProperty(process, 'platform', { ...originalPlatform, value: 'win32' })
    const open = vi.spyOn(fs, 'openSync').mockImplementation(() => { throw new Error('Directory descriptors are unsupported') })
    const asyncOpen = vi.spyOn(fs.promises, 'open').mockRejectedValue(new Error('Directory descriptors are unsupported'))
    syncDirectory('private-directory')
    await syncDirectoryAsync('private-directory')
    expect(open).not.toHaveBeenCalled()
    expect(asyncOpen).not.toHaveBeenCalled()
  })

  it('propagates POSIX flush errors and closes the directory descriptor', () => {
    Object.defineProperty(process, 'platform', { ...originalPlatform, value: 'linux' })
    vi.spyOn(fs, 'openSync').mockReturnValue(42)
    const flush = vi.spyOn(fs, 'fsyncSync').mockImplementation(() => { throw new Error('Directory flush failed') })
    const close = vi.spyOn(fs, 'closeSync').mockImplementation(() => undefined)
    expect(() => syncDirectory('private-directory')).toThrow('Directory flush failed')
    expect(flush).toHaveBeenCalledWith(42)
    expect(close).toHaveBeenCalledWith(42)
  })

  it('propagates asynchronous POSIX flush errors and closes the handle', async () => {
    Object.defineProperty(process, 'platform', { ...originalPlatform, value: 'darwin' })
    const handle = { sync: vi.fn().mockRejectedValue(new Error('Directory flush failed')), close: vi.fn().mockResolvedValue(undefined) }
    vi.spyOn(fs.promises, 'open').mockResolvedValue(handle as unknown as Awaited<ReturnType<typeof fs.promises.open>>)
    await expect(syncDirectoryAsync('private-directory')).rejects.toThrow('Directory flush failed')
    expect(handle.close).toHaveBeenCalledOnce()
  })
})
