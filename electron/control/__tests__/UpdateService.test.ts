import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Offline release-policy tests only. These mocks do not certify macOS signing,
// published updater metadata, network availability, download integrity or install.
const native = vi.hoisted(() => ({
  app: { isPackaged: false, getVersion: vi.fn(() => '1.0.0') },
  updater: { autoDownload: false, autoInstallOnAppQuit: false, allowPrerelease: false, allowDowngrade: false,
    on: vi.fn(), setFeedURL: vi.fn(), checkForUpdates: vi.fn(async () => undefined), downloadUpdate: vi.fn(async () => undefined), quitAndInstall: vi.fn() },
  codesign: vi.fn(() => ({ status: 0, stderr: 'Signature=adhoc' })),
}))
vi.mock('electron', () => ({ app: native.app }))
vi.mock('electron-updater', () => ({ autoUpdater: native.updater }))
vi.mock('node:child_process', async importOriginal => ({ ...await importOriginal<typeof import('node:child_process')>(), spawnSync: native.codesign }))
import { UpdateService } from '../UpdateService'

let directory: string, resourceDescriptor: PropertyDescriptor | undefined, platformDescriptor: PropertyDescriptor | undefined
const fetchMock = vi.fn<typeof fetch>()
const releases = (items: Array<{ tag_name: string; prerelease?: boolean; draft?: boolean }>) => new Response(JSON.stringify(items.map(item => ({ prerelease: false, draft: false, ...item }))), { status: 200, headers: { 'Content-Type': 'application/json' } })
beforeEach(() => {
  vi.clearAllMocks(); fetchMock.mockReset(); native.app.isPackaged = false
  directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ziaf-update-policy-')))
  resourceDescriptor = Object.getOwnPropertyDescriptor(process, 'resourcesPath')
  platformDescriptor = Object.getOwnPropertyDescriptor(process, 'platform')
  Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })
  Object.defineProperty(process, 'resourcesPath', { value: directory, configurable: true })
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  if (platformDescriptor) Object.defineProperty(process, 'platform', platformDescriptor)
  if (resourceDescriptor) Object.defineProperty(process, 'resourcesPath', resourceDescriptor)
  else Reflect.deleteProperty(process, 'resourcesPath')
  fs.rmSync(directory, { recursive: true, force: true })
})

describe('offline update release policy', () => {
  it('orders semantic versions and keeps preview tags out of stable even if the GitHub flag is inconsistent', async () => {
    const catalog = [ { tag_name: 'v1.9.0' }, { tag_name: 'v1.10.0' }, { tag_name: 'v2.0.0-beta.2', prerelease: false }, { tag_name: 'v2.0.0-beta.10', prerelease: true }, { tag_name: 'v8.0.0', draft: true }, { tag_name: 'not-semver' } ]
    const service = new UpdateService(directory)
    service.configure({ repository: 'fixture/releases', channel: 'stable', automatic: false })
    fetchMock.mockResolvedValueOnce(releases(catalog))
    expect(await service.check()).toMatchObject({ state: 'available', version: '1.10.0', currentChannel: 'stable' })
    service.configure({ repository: 'fixture/releases', channel: 'preview', automatic: false })
    fetchMock.mockResolvedValueOnce(releases(catalog))
    expect(await service.check()).toMatchObject({ state: 'available', version: '2.0.0-beta.10', currentChannel: 'preview' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(native.updater.checkForUpdates).not.toHaveBeenCalled()
  })

  it('does not auto-download or install development or unsigned packages even when automatic is enabled', async () => {
    const service = new UpdateService(directory)
    fetchMock.mockImplementation(async () => releases([{ tag_name: 'v1.1.0' }]))
    service.configure({ repository: 'fixture/releases', channel: 'stable', automatic: true })
    fs.writeFileSync(path.join(directory, 'app-update.yml'), 'provider: github\n')
    expect(await service.check()).toMatchObject({ state: 'available', version: '1.1.0' })
    await expect(service.download()).rejects.toThrow(/signed/)
    expect(native.codesign).not.toHaveBeenCalled()
    native.app.isPackaged = true
    expect(await service.check()).toMatchObject({ state: 'available', version: '1.1.0' })
    await expect(service.download()).rejects.toThrow(/signed/)
    expect(native.codesign).toHaveBeenCalled()
    expect(native.updater.setFeedURL).not.toHaveBeenCalled()
    expect(native.updater.checkForUpdates).not.toHaveBeenCalled()
    expect(native.updater.downloadUpdate).not.toHaveBeenCalled()
    expect(native.updater.autoInstallOnAppQuit).toBe(false)
    expect(() => service.install()).toThrow(/No verified update/)
    await service.close()
  })

  it('requires an explicit repository and available verified update before download or install', async () => {
    const service = new UpdateService(directory)
    await expect(service.check()).rejects.toThrow(/repository/)
    await expect(service.download()).rejects.toThrow(/available update/)
    expect(() => service.install()).toThrow(/verified update/)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(native.updater.quitAndInstall).not.toHaveBeenCalled()
  })

  it('coalesces a pending check, reports network failure honestly and allows a later explicit retry', async () => {
    const service = new UpdateService(directory)
    service.configure({ repository: 'fixture/releases', channel: 'stable', automatic: false })
    let reject!: (error: Error) => void
    fetchMock.mockImplementationOnce(() => new Promise<Response>((_resolve, fail) => { reject = fail }))
    const first = service.check(), second = service.check()
    expect(first).toBe(second); expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(service.status().state).toBe('checking')
    reject(new Error('Offline fixture network failure'))
    expect(await first).toMatchObject({ state: 'error', message: expect.stringContaining('network failure') })
    expect(native.updater.downloadUpdate).not.toHaveBeenCalled()
    fetchMock.mockResolvedValueOnce(releases([{ tag_name: 'v0.9.0' }, { tag_name: 'v1.0.0' }]))
    expect(await service.check()).toMatchObject({ state: 'current', version: '1.0.0' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('automatically checks immediately and every six hours, fences configuration and cancels pending work on close', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    const service = new UpdateService(directory)
    let resolveFirst!: (response: Response) => void
    fetchMock.mockImplementationOnce(() => new Promise<Response>(resolve => { resolveFirst = resolve }))
    try {
      service.configure({ repository: 'fixture/releases', channel: 'stable', automatic: true })
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(service.status().state).toBe('checking')
      expect(() => service.configure({ repository: 'fixture/other', channel: 'preview', automatic: true })).toThrow(/pending update/)
      resolveFirst(releases([{ tag_name: 'v1.0.0' }]))
      expect(await service.check()).toMatchObject({ state: 'current', currentChannel: 'stable' })
      let secondSignal: AbortSignal | undefined
      fetchMock.mockImplementationOnce((_url, options) => new Promise<Response>((_resolve, reject) => {
        secondSignal = options?.signal as AbortSignal
        secondSignal.addEventListener('abort', () => reject(secondSignal!.reason), { once: true })
      }))
      await vi.advanceTimersByTimeAsync(6 * 60 * 60 * 1000 - 1)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(1)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(secondSignal?.aborted).toBe(false)
      expect(() => service.configure({ repository: 'fixture/other', channel: 'preview', automatic: false })).toThrow(/pending update/)
      await service.close()
      expect(secondSignal?.aborted).toBe(true)
      expect(service.status().state).toBe('error')
      await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(native.updater.downloadUpdate).not.toHaveBeenCalled()
    } finally { await service.close() }
  })
})
